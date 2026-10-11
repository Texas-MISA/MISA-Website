import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

import {
  AUDITED_MARK_COLUMNS,
  MAX_PHOTO_BYTES,
  MAX_THUMB_BYTES,
  MAX_VIDEO_BYTES,
  ORPHAN_AGE_MS,
  parseVideoPath,
  PHOTO_BUCKET,
  prepareBingoVideoUpload,
  recordBingoPhoto,
  recordBingoVideo,
  removeBingoProof,
  renameBingoActivity,
  squareFolder,
  UPLOAD_CACHE_CONTROL,
  VIDEO_BUCKET,
  videoPath,
  type House,
  type VideoContentType,
} from "@/lib/bingo";
import type { Database } from "@/lib/types/database";

import {
  claimFreeSquare,
  cleanupBingo,
  fakeJpeg,
  fakeVideo,
  fileExists,
  filesIn,
  insertMark,
  newBingoTracker,
  squaresByPosition,
  type ClaimedSquare,
} from "./bingo-fixtures";
import { anonClient, testClient } from "./helpers";

// The write cores of lib/bingo.ts (migration 33), against the local stack's
// real database AND real Storage. Every core takes the service-role client;
// authorization and the audit write belong to the action around it (task 2),
// so what is tested here is what the core promises: the compare-and-set, the
// statuses, the snapshots, and that no file is left behind or deleted wrongly.

type Client = SupabaseClient<Database>;

const db = testClient();
const track = newBingoTracker();

afterAll(async () => {
  await cleanupBingo(db, track);
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * The real client, except that the payload of every insert into or update of
 * bingo_marks goes through `change` first. The DATABASE then refuses the write
 * for real (a CHECK, or the unique index), which is the one moment no race can
 * reach deterministically: after the core's uploads, before its row. The core
 * takes its client as a parameter for exactly this; nothing is mocked.
 *
 * 🪤 `writes()` counts the writes it altered, and every caller asserts exactly
 * one. A status of "error" alone would also come back from a regression that
 * fails BEFORE the write, and the test would pass without the cleanup it is
 * about ever running.
 */
function perturbMarkWrites(
  client: Client,
  change: (values: Record<string, unknown>) => Record<string, unknown>
): { client: Client; writes: () => number } {
  let writes = 0;
  const perturbed = new Proxy(client, {
    get(target, prop) {
      if (prop === "from") {
        return (relation: string) => {
          const builder = target.from(relation as "bingo_marks");
          if (relation !== "bingo_marks") return builder;
          return new Proxy(builder, {
            get(inner, key) {
              if (key === "insert" || key === "update") {
                const write = Reflect.get(inner, key, inner) as (
                  values: unknown,
                  options?: unknown
                ) => unknown;
                return (values: Record<string, unknown>, options?: unknown) => {
                  writes++;
                  return write.call(inner, change(values), options);
                };
              }
              const value = Reflect.get(inner, key, inner);
              return typeof value === "function" ? value.bind(inner) : value;
            },
          });
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { client: perturbed, writes: () => writes };
}

type FileApi = ReturnType<Client["storage"]["from"]>;

/**
 * The real client, except that each `storage.from(bucket)` hands its file API
 * to `wrap` first, which may replace a method. Every other call, and every
 * bucket `wrap` passes through, reaches the real Storage API.
 */
function withStorage(client: Client, wrap: (bucket: string, api: FileApi) => FileApi): Client {
  return new Proxy(client, {
    get(target, prop) {
      if (prop === "storage") {
        const storage = target.storage;
        return new Proxy(storage, {
          get(inner, key) {
            if (key === "from") return (bucket: string) => wrap(bucket, inner.from(bucket));
            const value = Reflect.get(inner, key, inner);
            return typeof value === "function" ? value.bind(inner) : value;
          },
        });
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function replaceMethod<K extends keyof FileApi>(
  api: FileApi,
  key: K,
  replacement: FileApi[K]
): FileApi {
  return new Proxy(api, {
    get(inner, prop) {
      if (prop === key) return replacement;
      const value = Reflect.get(inner, prop, inner);
      return typeof value === "function" ? value.bind(inner) : value;
    },
  });
}

/** What a Storage error looks like to the cores: they read only `message`,
 * `status` and `statusCode`. */
function injectedStorageError(what: string) {
  return Object.assign(new Error(`injected ${what} failure`), {
    name: "StorageApiError",
    status: 500,
    statusCode: "500",
  });
}

/**
 * Every remove() in these buckets fails, as a Storage outage would. `attempts`
 * records what the core TRIED to delete, as `<bucket>/<path>`, so a test can
 * tell "reported as an orphan" from "never tried".
 */
function failingRemoves(client: Client, buckets: readonly string[]) {
  const attempts: string[] = [];
  const faulty = withStorage(client, (bucket, api) =>
    buckets.includes(bucket)
      ? replaceMethod(api, "remove", (async (paths: string[]) => {
          attempts.push(...paths.map((path) => `${bucket}/${path}`));
          return { data: null, error: injectedStorageError("remove") };
        }) as unknown as FileApi["remove"])
      : api
  );
  return { client: faulty, attempts };
}

/**
 * info() in the video bucket answers without `field`: dropped from the
 * object, or null, which is what the Storage server sends when it has no
 * value (`size: … ?? null`). storage-js passes either straight through.
 */
function infoWithout(client: Client, field: "size" | "contentType", as: "dropped" | "null") {
  let calls = 0;
  const faulty = withStorage(client, (bucket, api) =>
    bucket === VIDEO_BUCKET
      ? replaceMethod(api, "info", (async (path: string) => {
          calls++;
          const real = await api.info(path);
          if (real.error) return real;
          const data: Record<string, unknown> = { ...real.data };
          if (as === "dropped") delete data[field];
          else data[field] = null;
          return { data, error: null };
        }) as unknown as FileApi["info"])
      : api
  );
  return { client: faulty, calls: () => calls };
}

async function markOn(claim: ClaimedSquare) {
  const { data, error } = await db
    .from("bingo_marks")
    .select(AUDITED_MARK_COLUMNS)
    .eq("house", claim.house)
    .eq("square_id", claim.squareId)
    .maybeSingle();
  if (error) throw new Error(`mark read failed: ${error.message}`);
  return data;
}

/** Move a mark's token on, the way another officer's save would. */
async function bump(markId: string): Promise<string> {
  const { data, error } = await db
    .from("bingo_marks")
    .update({ created_at: new Date().toISOString() })
    .eq("id", markId)
    .select("updated_at")
    .single();
  if (error) throw new Error(`bump failed: ${error.message}`);
  return data.updated_at;
}

/** What an officer's browser does: mint a token, then upload with the ANON key. */
async function uploadVideo(
  claim: { house: House; position: number },
  contentType: VideoContentType = "video/mp4"
): Promise<string> {
  const prepared = await prepareBingoVideoUpload(db, {
    house: claim.house,
    position: claim.position,
    contentType,
    size: 64,
  });
  if (prepared.status !== "ready") throw new Error(`prepare failed: ${prepared.status}`);
  const { error } = await anonClient()
    .storage.from(VIDEO_BUCKET)
    .uploadToSignedUrl(prepared.path, prepared.token, fakeVideo(), {
      contentType,
      cacheControl: UPLOAD_CACHE_CONTROL,
    });
  if (error) throw new Error(`signed upload failed: ${error.message}`);
  return prepared.path;
}

function photoInput(claim: ClaimedSquare, expectedUpdatedAt: string | null) {
  return {
    house: claim.house,
    position: claim.position,
    expectedUpdatedAt,
    photo: fakeJpeg(2048),
    thumb: fakeJpeg(256),
  };
}

// ---------------------------------------------------------------------------

describe("recordBingoPhoto", () => {
  it("adds a mark with both files stored, and returns the audit snapshots", async () => {
    const claim = await claimFreeSquare(db, track);
    const result = await recordBingoPhoto(db, photoInput(claim, null));

    expect(result.status).toBe("added");
    if (result.status !== "added") return;
    const row = await markOn(claim);
    expect(row).not.toBeNull();
    expect(result.markId).toBe(row!.id);
    // The fresh token, as the raw PostgREST string.
    expect(result.updatedAt).toBe(row!.updated_at);
    expect(result.before).toBeNull();
    expect(result.orphanPaths).toEqual([]);
    // The audited columns, minus the token.
    expect(Object.keys(result.after).sort()).toEqual(
      ["created_at", "house", "id", "kind", "media_path", "square_id", "thumb_path"].sort()
    );
    expect(result.after).toMatchObject({
      house: claim.house,
      square_id: claim.squareId,
      kind: "photo",
    });

    const folder = squareFolder(claim.house, claim.position);
    expect(row!.media_path).toMatch(new RegExp(`^${folder}/[0-9a-f-]{36}\\.jpg$`));
    expect(row!.thumb_path).toBe(row!.media_path.replace(/\.jpg$/, "-thumb.jpg"));
    expect(await filesIn(db, PHOTO_BUCKET, claim.house, claim.position)).toEqual(
      [row!.media_path, row!.thumb_path].sort()
    );

    const info = await db.storage.from(PHOTO_BUCKET).info(row!.media_path);
    expect(info.data?.contentType).toBe("image/jpeg");
    expect(info.data?.size).toBe(2048);
    expect(info.data?.cacheControl).toBe(`max-age=${UPLOAD_CACHE_CONTROL}`);
  });

  it("replaces it, deleting the old files", async () => {
    const claim = await claimFreeSquare(db, track);
    const first = await recordBingoPhoto(db, photoInput(claim, null));
    if (first.status !== "added") throw new Error(first.status);

    const second = await recordBingoPhoto(db, photoInput(claim, first.updatedAt));
    expect(second.status).toBe("replaced");
    if (second.status !== "replaced") return;

    expect(second.markId).toBe(first.markId);
    expect(second.before).toEqual(first.after);
    expect(second.after.media_path).not.toBe(first.after.media_path);
    expect(second.orphanPaths).toEqual([]);
    expect(await filesIn(db, PHOTO_BUCKET, claim.house, claim.position)).toEqual(
      [second.after.media_path, second.after.thumb_path].sort()
    );
  });

  it("is a conflict on a stale token, and uploads nothing", async () => {
    const claim = await claimFreeSquare(db, track);
    const first = await recordBingoPhoto(db, photoInput(claim, null));
    if (first.status !== "added") throw new Error(first.status);
    const fresh = await bump(first.markId);

    const stale = await recordBingoPhoto(db, photoInput(claim, first.updatedAt));
    expect(stale).toEqual({ status: "conflict" });
    expect((await markOn(claim))!.updated_at).toBe(fresh);
    expect(await filesIn(db, PHOTO_BUCKET, claim.house, claim.position)).toEqual(
      [first.after.media_path, first.after.thumb_path].sort()
    );
  });

  it("is a conflict when the mark appeared, or vanished, since the page rendered", async () => {
    // Appeared: the page showed no mark, and there is one.
    const appeared = await claimFreeSquare(db, track);
    await insertMark(db, appeared);
    expect(await recordBingoPhoto(db, photoInput(appeared, null))).toEqual({
      status: "conflict",
    });

    // Vanished: the page showed a mark, and there is none.
    const vanished = await claimFreeSquare(db, track);
    expect(
      await recordBingoPhoto(db, photoInput(vanished, "2026-10-10T12:00:00.123456+00:00"))
    ).toEqual({ status: "conflict" });
    expect(await markOn(vanished)).toBeNull();
    expect(await filesIn(db, PHOTO_BUCKET, vanished.house, vanished.position)).toEqual([]);
  });

  it("treats an empty token as 'no mark', as a form posts it", async () => {
    const claim = await claimFreeSquare(db, track);
    const result = await recordBingoPhoto(db, photoInput(claim, ""));
    expect(result.status).toBe("added");
  });

  it("lets exactly one of two concurrent adds win, leaving only the winner's files", async () => {
    const claim = await claimFreeSquare(db, track);
    const results = await Promise.all([
      recordBingoPhoto(db, photoInput(claim, null)),
      recordBingoPhoto(db, photoInput(claim, null)),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual(["added", "conflict"]);
    const winner = results.find((r) => r.status === "added");
    if (winner?.status !== "added") throw new Error("no winner");
    expect(await filesIn(db, PHOTO_BUCKET, claim.house, claim.position)).toEqual(
      [winner.after.media_path, winner.after.thumb_path].sort()
    );
  });

  it("deletes its uploads when the database refuses the write", async () => {
    const claim = await claimFreeSquare(db, track);
    // 'X' fails bingo_marks_house_valid, AFTER both files are uploaded.
    const refusing = perturbMarkWrites(db, (values) => ({ ...values, house: "X" }));
    expect(await recordBingoPhoto(refusing.client, photoInput(claim, null))).toEqual({
      status: "error",
    });
    // The error came from the write itself, not from anything before it.
    expect(refusing.writes()).toBe(1);
    expect(await markOn(claim)).toBeNull();
    expect(await filesIn(db, PHOTO_BUCKET, claim.house, claim.position)).toEqual([]);
  });

  it("reports a racing insert's 23505 as a conflict, and deletes its uploads", async () => {
    const claim = await claimFreeSquare(db, track);
    // Another square this house has already done: the insert collides on
    // (house, square_id) exactly as a racing officer's would.
    const taken = await claimFreeSquare(db, track, claim.house);
    await insertMark(db, taken);
    const racing = perturbMarkWrites(db, (values) => ({ ...values, square_id: taken.squareId }));

    expect(await recordBingoPhoto(racing.client, photoInput(claim, null))).toEqual({
      status: "conflict",
    });
    // The conflict came from the insert's 23505, not from the pre-check.
    expect(racing.writes()).toBe(1);
    expect(await markOn(claim)).toBeNull();
    expect(await filesIn(db, PHOTO_BUCKET, claim.house, claim.position)).toEqual([]);
  });

  it("deletes its uploads when a replace's write is refused, keeping the old proof", async () => {
    const claim = await claimFreeSquare(db, track);
    const first = await recordBingoPhoto(db, photoInput(claim, null));
    if (first.status !== "added") throw new Error(first.status);

    const refusing = perturbMarkWrites(db, (values) => ({ ...values, kind: "audio" }));
    expect(await recordBingoPhoto(refusing.client, photoInput(claim, first.updatedAt))).toEqual({
      status: "error",
    });
    expect(refusing.writes()).toBe(1);
    expect((await markOn(claim))!.media_path).toBe(first.after.media_path);
    expect(await filesIn(db, PHOTO_BUCKET, claim.house, claim.position)).toEqual(
      [first.after.media_path, first.after.thumb_path].sort()
    );
  });

  it("refuses bad input before touching anything", async () => {
    const claim = await claimFreeSquare(db, track);
    const base = photoInput(claim, null);
    const cases: Array<[Parameters<typeof recordBingoPhoto>[1], string]> = [
      [{ ...base, house: "X" as House }, "house"],
      [{ ...base, position: 12 }, "position"],
      [{ ...base, position: 25 }, "position"],
      [{ ...base, photo: fakeJpeg(MAX_PHOTO_BYTES + 1) }, "photo_size"],
      [{ ...base, photo: new Uint8Array(0) }, "photo_size"],
      [{ ...base, photo: PNG }, "photo_type"],
      [{ ...base, thumb: fakeJpeg(MAX_THUMB_BYTES + 1) }, "thumb_size"],
      [{ ...base, thumb: PNG }, "thumb_type"],
    ];
    for (const [input, reason] of cases) {
      expect(await recordBingoPhoto(db, input), reason).toEqual({ status: "invalid", reason });
    }
    expect(await markOn(claim)).toBeNull();
    expect(await filesIn(db, PHOTO_BUCKET, claim.house, claim.position)).toEqual([]);
  });

  it("accepts files at exactly the caps", async () => {
    const claim = await claimFreeSquare(db, track);
    const result = await recordBingoPhoto(db, {
      ...photoInput(claim, null),
      photo: fakeJpeg(MAX_PHOTO_BYTES),
      thumb: fakeJpeg(MAX_THUMB_BYTES),
    });
    expect(result.status).toBe("added");
  });

  it("deletes a replaced VIDEO's files from both buckets", async () => {
    const claim = await claimFreeSquare(db, track);
    const path = await uploadVideo(claim);
    const video = await recordBingoVideo(db, {
      house: claim.house,
      position: claim.position,
      expectedUpdatedAt: null,
      videoPath: path,
      poster: fakeJpeg(128),
    });
    if (video.status !== "added") throw new Error(video.status);

    const photo = await recordBingoPhoto(db, photoInput(claim, video.updatedAt));
    expect(photo.status).toBe("replaced");
    if (photo.status !== "replaced") return;
    expect(photo.before.kind).toBe("video");
    expect(photo.after.kind).toBe("photo");
    expect(await fileExists(db, VIDEO_BUCKET, path)).toBe(false);
    expect(await filesIn(db, VIDEO_BUCKET, claim.house, claim.position)).toEqual([]);
    // The poster went with it; only the new photo and thumbnail remain.
    expect(await filesIn(db, PHOTO_BUCKET, claim.house, claim.position)).toEqual(
      [photo.after.media_path, photo.after.thumb_path].sort()
    );
  });
});

// ---------------------------------------------------------------------------

describe("prepareBingoVideoUpload", () => {
  it("mints a token for one fresh path in this square's folder", async () => {
    const claim = await claimFreeSquare(db, track);
    for (const contentType of ["video/mp4", "video/quicktime"] as const) {
      const prepared = await prepareBingoVideoUpload(db, {
        house: claim.house,
        position: claim.position,
        contentType,
        size: MAX_VIDEO_BYTES,
      });
      expect(prepared.status).toBe("ready");
      if (prepared.status !== "ready") return;
      expect(parseVideoPath(prepared.path, claim.house, claim.position)?.contentType).toBe(
        contentType
      );
      expect(prepared.token.length).toBeGreaterThan(20);
      expect(prepared.sweptPaths).toEqual([]);
      // It writes no row, and the object does not exist until the browser
      // uploads it.
      expect(await markOn(claim)).toBeNull();
      expect(await fileExists(db, VIDEO_BUCKET, prepared.path)).toBe(false);
    }
  });

  it("hands the browser a token the anon key can upload with, once", async () => {
    const claim = await claimFreeSquare(db, track);
    const path = await uploadVideo(claim);
    expect(await fileExists(db, VIDEO_BUCKET, path)).toBe(true);
  });

  it("refuses a type or size the bucket would", async () => {
    const claim = await claimFreeSquare(db, track);
    const base = { house: claim.house, position: claim.position, contentType: "video/mp4", size: 64 };
    const cases: Array<[Parameters<typeof prepareBingoVideoUpload>[1], string]> = [
      [{ ...base, house: "Z" as House }, "house"],
      [{ ...base, position: 12 }, "position"],
      [{ ...base, contentType: "video/webm" }, "video_type"],
      [{ ...base, contentType: "image/jpeg" }, "video_type"],
      [{ ...base, size: 0 }, "video_size"],
      [{ ...base, size: MAX_VIDEO_BYTES + 1 }, "video_size"],
      [{ ...base, size: 1.5 }, "video_size"],
      [{ ...base, size: Number.NaN }, "video_size"],
    ];
    for (const [input, reason] of cases) {
      expect(await prepareBingoVideoUpload(db, input), reason).toEqual({
        status: "invalid",
        reason,
      });
    }
  });

  it("sweeps abandoned uploads older than the orphan age, and only those", async () => {
    const claim = await claimFreeSquare(db, track);
    const folder = squareFolder(claim.house, claim.position);
    const store = async (path: string) => {
      const { error } = await db.storage
        .from(VIDEO_BUCKET)
        .upload(path, fakeVideo(), { contentType: "video/mp4" });
      if (error) throw new Error(`fixture upload failed: ${error.message}`);
    };
    const abandoned = videoPath(claim.house, claim.position, crypto.randomUUID(), "video/mp4");
    const recorded = videoPath(claim.house, claim.position, crypto.randomUUID(), "video/mp4");
    const notOurs = `${folder}/not-an-upload.mp4`;
    await store(abandoned);
    await store(recorded);
    await store(notOurs);
    await insertMark(db, claim, { kind: "video", mediaPath: recorded, thumbPath: null });

    // Right now nothing is old enough.
    const now = await prepareBingoVideoUpload(db, {
      house: claim.house,
      position: claim.position,
      contentType: "video/mp4",
      size: 64,
    });
    expect(now.status === "ready" && now.sweptPaths).toEqual([]);
    expect(await fileExists(db, VIDEO_BUCKET, abandoned)).toBe(true);

    // Past the token's lifetime, the unrecorded upload goes. The recorded one
    // and the one whose name we never mint stay.
    const later = new Date(Date.now() + ORPHAN_AGE_MS + 60_000);
    const swept = await prepareBingoVideoUpload(
      db,
      { house: claim.house, position: claim.position, contentType: "video/mp4", size: 64 },
      later
    );
    expect(swept.status === "ready" && swept.sweptPaths).toEqual([abandoned]);
    expect(await fileExists(db, VIDEO_BUCKET, abandoned)).toBe(false);
    expect(await fileExists(db, VIDEO_BUCKET, recorded)).toBe(true);
    expect(await fileExists(db, VIDEO_BUCKET, notOurs)).toBe(true);
  });

  it("sweeps only its own square's folder", async () => {
    const claim = await claimFreeSquare(db, track);
    const neighbour = await claimFreeSquare(db, track, claim.house);
    const elsewhere = videoPath(neighbour.house, neighbour.position, crypto.randomUUID(), "video/mp4");
    const { error } = await db.storage
      .from(VIDEO_BUCKET)
      .upload(elsewhere, fakeVideo(), { contentType: "video/mp4" });
    expect(error).toBeNull();

    const swept = await prepareBingoVideoUpload(
      db,
      { house: claim.house, position: claim.position, contentType: "video/mp4", size: 64 },
      new Date(Date.now() + ORPHAN_AGE_MS + 60_000)
    );
    expect(swept.status === "ready" && swept.sweptPaths).toEqual([]);
    expect(await fileExists(db, VIDEO_BUCKET, elsewhere)).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("recordBingoVideo", () => {
  it("adds a mark from an uploaded video and its poster", async () => {
    const claim = await claimFreeSquare(db, track);
    const path = await uploadVideo(claim);
    const result = await recordBingoVideo(db, {
      house: claim.house,
      position: claim.position,
      expectedUpdatedAt: null,
      videoPath: path,
      poster: fakeJpeg(128),
    });

    expect(result.status).toBe("added");
    if (result.status !== "added") return;
    expect(result.after).toMatchObject({ kind: "video", media_path: path });
    const poster = result.after.thumb_path!;
    // The poster has its own uuid, so a repeated request cannot collide on it.
    expect(poster).toMatch(
      new RegExp(`^${squareFolder(claim.house, claim.position)}/[0-9a-f-]{36}-poster\\.jpg$`)
    );
    expect(poster.startsWith(path.replace(/\.mp4$/, ""))).toBe(false);
    expect(await filesIn(db, PHOTO_BUCKET, claim.house, claim.position)).toEqual([poster]);
    expect(await fileExists(db, VIDEO_BUCKET, path)).toBe(true);
  });

  it("adds one without a poster, and takes a QuickTime file", async () => {
    const claim = await claimFreeSquare(db, track);
    const path = await uploadVideo(claim, "video/quicktime");
    const result = await recordBingoVideo(db, {
      house: claim.house,
      position: claim.position,
      expectedUpdatedAt: null,
      videoPath: path,
    });
    expect(result.status).toBe("added");
    if (result.status !== "added") return;
    expect(result.after.thumb_path).toBeNull();
    expect(result.after.media_path).toMatch(/\.mov$/);
  });

  it("refuses a path for another square or another house, touching nothing", async () => {
    const claim = await claimFreeSquare(db, track);
    const otherSquare = await claimFreeSquare(db, track, claim.house);
    const foreign = await uploadVideo(otherSquare);
    const otherHouse = videoPath(
      claim.house === "M" ? "I" : "M",
      claim.position,
      crypto.randomUUID(),
      "video/mp4"
    );

    for (const path of [foreign, otherHouse]) {
      expect(
        await recordBingoVideo(db, {
          house: claim.house,
          position: claim.position,
          expectedUpdatedAt: null,
          videoPath: path,
        }),
        path
      ).toEqual({ status: "invalid", reason: "video_path" });
    }
    expect(await markOn(claim)).toBeNull();
    // Never delete what failed the path check: it may be someone's proof.
    expect(await fileExists(db, VIDEO_BUCKET, foreign)).toBe(true);
  });

  it("refuses a path with nothing uploaded at it", async () => {
    const claim = await claimFreeSquare(db, track);
    const prepared = await prepareBingoVideoUpload(db, {
      house: claim.house,
      position: claim.position,
      contentType: "video/mp4",
      size: 64,
    });
    if (prepared.status !== "ready") throw new Error(prepared.status);
    expect(
      await recordBingoVideo(db, {
        house: claim.house,
        position: claim.position,
        expectedUpdatedAt: null,
        videoPath: prepared.path,
      })
    ).toEqual({ status: "invalid", reason: "video_missing" });
    expect(await markOn(claim)).toBeNull();
  });

  it("refuses an object whose type is not its extension's, and deletes it", async () => {
    const claim = await claimFreeSquare(db, track);
    // QuickTime bytes at an .mp4 path: a type the bucket allows, but not the
    // one the browser declared when the path was minted.
    const path = videoPath(claim.house, claim.position, crypto.randomUUID(), "video/mp4");
    const { error } = await db.storage
      .from(VIDEO_BUCKET)
      .upload(path, fakeVideo(), { contentType: "video/quicktime" });
    expect(error).toBeNull();

    expect(
      await recordBingoVideo(db, {
        house: claim.house,
        position: claim.position,
        expectedUpdatedAt: null,
        videoPath: path,
      })
    ).toEqual({ status: "invalid", reason: "video_type" });
    expect(await markOn(claim)).toBeNull();
    expect(await fileExists(db, VIDEO_BUCKET, path)).toBe(false);
  });

  it("refuses an empty object, and deletes it", async () => {
    const claim = await claimFreeSquare(db, track);
    const path = videoPath(claim.house, claim.position, crypto.randomUUID(), "video/mp4");
    const { error } = await db.storage
      .from(VIDEO_BUCKET)
      .upload(path, new Uint8Array(0), { contentType: "video/mp4" });
    expect(error).toBeNull();

    expect(
      await recordBingoVideo(db, {
        house: claim.house,
        position: claim.position,
        expectedUpdatedAt: null,
        videoPath: path,
      })
    ).toEqual({ status: "invalid", reason: "video_size" });
    expect(await fileExists(db, VIDEO_BUCKET, path)).toBe(false);
  });

  it.each([
    ["size", "dropped"],
    ["size", "null"],
    ["contentType", "dropped"],
    ["contentType", "null"],
  ] as const)(
    "is an error that deletes NOTHING when info() has no %s (%s)",
    async (field, as) => {
      // 🐛 Review of dda956c: a missing size deleted the upload as video_size,
      // and a missing type as video_type. An absent value is not evidence
      // that the video is bad; the officer must be able to try again.
      const claim = await claimFreeSquare(db, track);
      const path = await uploadVideo(claim);
      const input = {
        house: claim.house,
        position: claim.position,
        expectedUpdatedAt: null,
        videoPath: path,
        poster: fakeJpeg(128),
      };
      const thin = infoWithout(db, field, as);

      expect(await recordBingoVideo(thin.client, input)).toEqual({ status: "error" });
      expect(thin.calls()).toBe(1);
      expect(await fileExists(db, VIDEO_BUCKET, path)).toBe(true);
      expect(await markOn(claim)).toBeNull();
      // It stopped before the poster, too.
      expect(await filesIn(db, PHOTO_BUCKET, claim.house, claim.position)).toEqual([]);

      // ...so once info() answers in full, the same upload records.
      expect((await recordBingoVideo(db, input)).status).toBe("added");
    }
  );

  it("is a conflict on a stale token, and deletes the unrecorded video", async () => {
    const claim = await claimFreeSquare(db, track);
    const existing = await insertMark(db, claim);
    await bump(existing.id);
    const path = await uploadVideo(claim);

    expect(
      await recordBingoVideo(db, {
        house: claim.house,
        position: claim.position,
        expectedUpdatedAt: existing.updated_at,
        videoPath: path,
        poster: fakeJpeg(128),
      })
    ).toEqual({ status: "conflict" });
    expect((await markOn(claim))!.media_path).toBe(existing.media_path);
    expect(await fileExists(db, VIDEO_BUCKET, path)).toBe(false);
    // The poster was never uploaded.
    expect(await filesIn(db, PHOTO_BUCKET, claim.house, claim.position)).toEqual([]);
  });

  it("keeps the video when a repeated record finds it already recorded", async () => {
    // A double click, or a retry after the first request succeeded: the second
    // is a conflict, and must NOT delete the video the first one recorded.
    const claim = await claimFreeSquare(db, track);
    const path = await uploadVideo(claim);
    const input = {
      house: claim.house,
      position: claim.position,
      expectedUpdatedAt: null,
      videoPath: path,
      poster: fakeJpeg(128),
    };
    const first = await recordBingoVideo(db, input);
    expect(first.status).toBe("added");
    expect(await recordBingoVideo(db, input)).toEqual({ status: "conflict" });

    expect((await markOn(claim))!.media_path).toBe(path);
    expect(await fileExists(db, VIDEO_BUCKET, path)).toBe(true);
    // The second request uploaded no poster: only the winner's is there.
    if (first.status !== "added") return;
    expect(await filesIn(db, PHOTO_BUCKET, claim.house, claim.position)).toEqual([
      first.after.thumb_path!,
    ]);
  });

  it("lets one of two concurrent records of one upload win, and keeps its video", async () => {
    const claim = await claimFreeSquare(db, track);
    const path = await uploadVideo(claim);
    const input = {
      house: claim.house,
      position: claim.position,
      expectedUpdatedAt: null,
      videoPath: path,
      poster: fakeJpeg(128),
    };
    const results = await Promise.all([recordBingoVideo(db, input), recordBingoVideo(db, input)]);
    expect(results.map((r) => r.status).sort()).toEqual(["added", "conflict"]);
    const winner = results.find((r) => r.status === "added");
    if (winner?.status !== "added") throw new Error("no winner");
    expect(await fileExists(db, VIDEO_BUCKET, path)).toBe(true);
    // The loser's poster, if it got as far as uploading one, is gone.
    expect(await filesIn(db, PHOTO_BUCKET, claim.house, claim.position)).toEqual([
      winner.after.thumb_path!,
    ]);
  });

  it("refuses to replace a mark with the file it already holds", async () => {
    const claim = await claimFreeSquare(db, track);
    const path = await uploadVideo(claim);
    const first = await recordBingoVideo(db, {
      house: claim.house,
      position: claim.position,
      expectedUpdatedAt: null,
      videoPath: path,
    });
    if (first.status !== "added") throw new Error(first.status);

    expect(
      await recordBingoVideo(db, {
        house: claim.house,
        position: claim.position,
        expectedUpdatedAt: first.updatedAt,
        videoPath: path,
      })
    ).toEqual({ status: "invalid", reason: "video_path" });
    expect((await markOn(claim))!.updated_at).toBe(first.updatedAt);
    expect(await fileExists(db, VIDEO_BUCKET, path)).toBe(true);
  });

  it("deletes its poster and the video when the write is refused", async () => {
    const claim = await claimFreeSquare(db, track);
    const path = await uploadVideo(claim);
    const refusing = perturbMarkWrites(db, (values) => ({ ...values, house: "X" }));

    expect(
      await recordBingoVideo(refusing.client, {
        house: claim.house,
        position: claim.position,
        expectedUpdatedAt: null,
        videoPath: path,
        poster: fakeJpeg(128),
      })
    ).toEqual({ status: "error" });
    expect(refusing.writes()).toBe(1);
    expect(await markOn(claim)).toBeNull();
    expect(await fileExists(db, VIDEO_BUCKET, path)).toBe(false);
    expect(await filesIn(db, PHOTO_BUCKET, claim.house, claim.position)).toEqual([]);
  });

  it("refuses a bad poster without deleting the video", async () => {
    const claim = await claimFreeSquare(db, track);
    const path = await uploadVideo(claim);
    const base = {
      house: claim.house,
      position: claim.position,
      expectedUpdatedAt: null,
      videoPath: path,
    };
    expect(await recordBingoVideo(db, { ...base, poster: PNG })).toEqual({
      status: "invalid",
      reason: "poster_type",
    });
    expect(
      await recordBingoVideo(db, { ...base, poster: fakeJpeg(MAX_THUMB_BYTES + 1) })
    ).toEqual({ status: "invalid", reason: "poster_size" });
    expect(await fileExists(db, VIDEO_BUCKET, path)).toBe(true);
    // ...so the officer can record it again with a good one.
    expect((await recordBingoVideo(db, { ...base, poster: fakeJpeg(128) })).status).toBe("added");
  });

  it("replaces a photo mark, deleting the photo and its thumbnail", async () => {
    const claim = await claimFreeSquare(db, track);
    const photo = await recordBingoPhoto(db, photoInput(claim, null));
    if (photo.status !== "added") throw new Error(photo.status);
    const path = await uploadVideo(claim);

    const video = await recordBingoVideo(db, {
      house: claim.house,
      position: claim.position,
      expectedUpdatedAt: photo.updatedAt,
      videoPath: path,
      poster: fakeJpeg(128),
    });
    expect(video.status).toBe("replaced");
    if (video.status !== "replaced") return;
    expect(video.before).toEqual(photo.after);
    expect(video.orphanPaths).toEqual([]);
    expect(await filesIn(db, PHOTO_BUCKET, claim.house, claim.position)).toEqual([
      video.after.thumb_path!,
    ]);
  });
});

// ---------------------------------------------------------------------------

describe("removeBingoProof", () => {
  it("removes the mark and its files, returning the before snapshot", async () => {
    const claim = await claimFreeSquare(db, track);
    const added = await recordBingoPhoto(db, photoInput(claim, null));
    if (added.status !== "added") throw new Error(added.status);

    const removed = await removeBingoProof(db, {
      markId: added.markId,
      expectedUpdatedAt: added.updatedAt,
    });
    expect(removed).toEqual({
      status: "removed",
      markId: added.markId,
      before: added.after,
      after: null,
      orphanPaths: [],
    });
    expect(await markOn(claim)).toBeNull();
    expect(await filesIn(db, PHOTO_BUCKET, claim.house, claim.position)).toEqual([]);
  });

  it("removes a video mark's files from both buckets", async () => {
    const claim = await claimFreeSquare(db, track);
    const path = await uploadVideo(claim);
    const added = await recordBingoVideo(db, {
      house: claim.house,
      position: claim.position,
      expectedUpdatedAt: null,
      videoPath: path,
      poster: fakeJpeg(128),
    });
    if (added.status !== "added") throw new Error(added.status);

    const removed = await removeBingoProof(db, {
      markId: added.markId,
      expectedUpdatedAt: added.updatedAt,
    });
    expect(removed.status).toBe("removed");
    expect(await fileExists(db, VIDEO_BUCKET, path)).toBe(false);
    expect(await filesIn(db, PHOTO_BUCKET, claim.house, claim.position)).toEqual([]);
  });

  it("is a conflict on a stale token, removing nothing", async () => {
    const claim = await claimFreeSquare(db, track);
    const added = await recordBingoPhoto(db, photoInput(claim, null));
    if (added.status !== "added") throw new Error(added.status);
    await bump(added.markId);

    expect(
      await removeBingoProof(db, { markId: added.markId, expectedUpdatedAt: added.updatedAt })
    ).toEqual({ status: "conflict" });
    expect(await markOn(claim)).not.toBeNull();
    expect(await filesIn(db, PHOTO_BUCKET, claim.house, claim.position)).toEqual(
      [added.after.media_path, added.after.thumb_path].sort()
    );
  });

  it("is not_found for a mark that is gone or never was", async () => {
    const claim = await claimFreeSquare(db, track);
    const added = await recordBingoPhoto(db, photoInput(claim, null));
    if (added.status !== "added") throw new Error(added.status);
    const input = { markId: added.markId, expectedUpdatedAt: added.updatedAt };
    expect((await removeBingoProof(db, input)).status).toBe("removed");
    // Another officer removed it first.
    expect(await removeBingoProof(db, input)).toEqual({ status: "not_found" });
    expect(
      await removeBingoProof(db, { markId: crypto.randomUUID(), expectedUpdatedAt: "x" })
    ).toEqual({ status: "not_found" });
    expect(await removeBingoProof(db, { markId: "not-a-uuid", expectedUpdatedAt: "x" })).toEqual({
      status: "not_found",
    });
  });
});

// ---------------------------------------------------------------------------

describe("a file Storage will not delete", () => {
  // 📌 orphanPaths is what task 2 writes into the audit note, as
  // "<bucket>/<path>", so an officer can find the file in the dashboard. The
  // database write has already happened when the delete fails, so the status
  // must still say so: the row is the truth, and the file is only a cost.

  it("is reported after a photo replace, which still succeeds", async () => {
    const claim = await claimFreeSquare(db, track);
    const first = await recordBingoPhoto(db, photoInput(claim, null));
    if (first.status !== "added") throw new Error(first.status);

    const stuck = failingRemoves(db, [PHOTO_BUCKET]);
    const second = await recordBingoPhoto(stuck.client, photoInput(claim, first.updatedAt));
    expect(second.status).toBe("replaced");
    if (second.status !== "replaced") return;

    const old = [
      `${PHOTO_BUCKET}/${first.after.media_path}`,
      `${PHOTO_BUCKET}/${first.after.thumb_path}`,
    ].sort();
    expect([...second.orphanPaths].sort()).toEqual(old);
    expect([...stuck.attempts].sort()).toEqual(old);
    // The new photo is recorded, and the old files are where orphanPaths says.
    expect((await markOn(claim))!.media_path).toBe(second.after.media_path);
    expect(await fileExists(db, PHOTO_BUCKET, first.after.media_path)).toBe(true);
    expect(await fileExists(db, PHOTO_BUCKET, first.after.thumb_path!)).toBe(true);
  });

  it("is reported after a video replace, each file under its own bucket", async () => {
    // A video with a poster, replaced by another. Only the video bucket fails,
    // so the old video is the one orphan and the old poster really goes.
    const claim = await claimFreeSquare(db, track);
    const firstPath = await uploadVideo(claim);
    const first = await recordBingoVideo(db, {
      house: claim.house,
      position: claim.position,
      expectedUpdatedAt: null,
      videoPath: firstPath,
      poster: fakeJpeg(128),
    });
    if (first.status !== "added") throw new Error(first.status);
    const secondPath = await uploadVideo(claim);

    const stuck = failingRemoves(db, [VIDEO_BUCKET]);
    const second = await recordBingoVideo(stuck.client, {
      house: claim.house,
      position: claim.position,
      expectedUpdatedAt: first.updatedAt,
      videoPath: secondPath,
      poster: fakeJpeg(128),
    });
    expect(second.status).toBe("replaced");
    if (second.status !== "replaced") return;

    expect(second.orphanPaths).toEqual([`${VIDEO_BUCKET}/${firstPath}`]);
    expect(stuck.attempts).toEqual([`${VIDEO_BUCKET}/${firstPath}`]);
    expect((await markOn(claim))!.media_path).toBe(secondPath);
    expect(await fileExists(db, VIDEO_BUCKET, firstPath)).toBe(true);
    expect(await fileExists(db, PHOTO_BUCKET, first.after.thumb_path!)).toBe(false);
  });

  it("is reported after a remove, which still removes the mark", async () => {
    const claim = await claimFreeSquare(db, track);
    const path = await uploadVideo(claim);
    const added = await recordBingoVideo(db, {
      house: claim.house,
      position: claim.position,
      expectedUpdatedAt: null,
      videoPath: path,
      poster: fakeJpeg(128),
    });
    if (added.status !== "added") throw new Error(added.status);

    const stuck = failingRemoves(db, [PHOTO_BUCKET, VIDEO_BUCKET]);
    const removed = await removeBingoProof(stuck.client, {
      markId: added.markId,
      expectedUpdatedAt: added.updatedAt,
    });
    expect(removed.status).toBe("removed");
    if (removed.status !== "removed") return;

    const both = [`${PHOTO_BUCKET}/${added.after.thumb_path}`, `${VIDEO_BUCKET}/${path}`].sort();
    expect([...removed.orphanPaths].sort()).toEqual(both);
    expect([...stuck.attempts].sort()).toEqual(both);
    expect(removed.before).toEqual(added.after);
    expect(await markOn(claim)).toBeNull();
    expect(await fileExists(db, VIDEO_BUCKET, path)).toBe(true);
    expect(await fileExists(db, PHOTO_BUCKET, added.after.thumb_path!)).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("renameBingoActivity", () => {
  // Renames move global state every house card reads, so each test puts the
  // square back the way it found it.
  async function withSquare(
    run: (square: { id: string; position: number; activity: string; updated_at: string }) => Promise<void>
  ) {
    const squares = await squaresByPosition(db);
    const positions = [...squares.keys()];
    const position = positions[Math.floor(Math.random() * positions.length)];
    const square = { ...squares.get(position)!, position };
    try {
      await run(square);
    } finally {
      await db.from("bingo_squares").update({ activity: square.activity }).eq("id", square.id);
    }
  }

  it("renames the activity for every house, returning before and after", async () => {
    await withSquare(async (square) => {
      const activity = `TEST renamed ${crypto.randomUUID().slice(0, 8)}`;
      const result = await renameBingoActivity(db, {
        squareId: square.id,
        activity: `  ${activity} `,
        expectedUpdatedAt: square.updated_at,
      });
      expect(result.status).toBe("renamed");
      if (result.status !== "renamed") return;

      expect(result.before).toEqual({ id: square.id, position: square.position, activity: square.activity });
      expect(result.after).toEqual({ id: square.id, position: square.position, activity });
      const after = (await squaresByPosition(db)).get(square.position)!;
      expect(after.activity).toBe(activity);
      expect(result.updatedAt).toBe(after.updated_at);
      expect(result.updatedAt).not.toBe(square.updated_at);
    });
  });

  it("writes nothing for the same text, even padded", async () => {
    await withSquare(async (square) => {
      const result = await renameBingoActivity(db, {
        squareId: square.id,
        activity: ` ${square.activity}  `,
        expectedUpdatedAt: square.updated_at,
      });
      expect(result).toEqual({
        status: "unchanged",
        squareId: square.id,
        updatedAt: square.updated_at,
      });
      expect((await squaresByPosition(db)).get(square.position)!.updated_at).toBe(
        square.updated_at
      );
    });
  });

  it("is a conflict on a stale token, even for the text already there", async () => {
    await withSquare(async (square) => {
      const renamed = await renameBingoActivity(db, {
        squareId: square.id,
        activity: "TEST first rename",
        expectedUpdatedAt: square.updated_at,
      });
      expect(renamed.status).toBe("renamed");

      for (const activity of ["TEST second rename", "TEST first rename"]) {
        expect(
          await renameBingoActivity(db, {
            squareId: square.id,
            activity,
            expectedUpdatedAt: square.updated_at,
          }),
          activity
        ).toEqual({ status: "conflict" });
      }
      expect((await squaresByPosition(db)).get(square.position)!.activity).toBe(
        "TEST first rename"
      );
    });
  });

  it("refuses blank, overlong or control-character text", async () => {
    await withSquare(async (square) => {
      for (const activity of ["", "   ", "x".repeat(61), "Pool\nDay"]) {
        expect(
          await renameBingoActivity(db, {
            squareId: square.id,
            activity,
            expectedUpdatedAt: square.updated_at,
          }),
          JSON.stringify(activity)
        ).toEqual({ status: "invalid", reason: "activity" });
      }
      expect((await squaresByPosition(db)).get(square.position)!.updated_at).toBe(
        square.updated_at
      );
    });
  });

  it("is not_found for a square that does not exist", async () => {
    for (const squareId of [crypto.randomUUID(), "not-a-uuid"]) {
      expect(
        await renameBingoActivity(db, {
          squareId,
          activity: "TEST nothing",
          expectedUpdatedAt: "x",
        }),
        squareId
      ).toEqual({ status: "not_found" });
    }
  });
});

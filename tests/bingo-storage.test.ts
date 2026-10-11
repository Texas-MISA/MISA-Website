import { afterAll, describe, expect, it } from "vitest";

import {
  bingoPublicUrl,
  MAX_VIDEO_BYTES,
  ORPHAN_AGE_MS,
  PHOTO_BUCKET,
  photoPaths,
  UPLOAD_CACHE_CONTROL,
  VIDEO_BUCKET,
  videoPath,
  type BingoBucket,
} from "@/lib/bingo";

import {
  claimFreeSquare,
  cleanupBingo,
  fakeJpeg,
  fakeVideo,
  fileExists,
  newBingoTracker,
} from "./bingo-fixtures";
import { anonClient, signInAsOutsider, testClient } from "./helpers";

// The two house-bingo buckets (migration 33), seen from outside.
//
// 🔓 There is NO policy on storage.objects for any API role, so with RLS on,
// anon and a signed-in non-officer can neither list a bucket nor write to it.
// A signed upload token, minted with the service role for one path, is the
// only way a browser writes — and it is the one exception to "the browser
// never writes" the officer approved (2026-10-10), for video bytes only.
//
// Asserted on OUTCOMES, the way tests/security.test.ts asserts the table
// matrix: every refused write is followed by a service-role read showing
// nothing moved, because a storage call can return an empty success while
// doing nothing, and an error code alone would not tell the two apart.

const db = testClient();
const track = newBingoTracker();

afterAll(async () => {
  await cleanupBingo(db, track);
});

const BUCKETS: Array<{ bucket: BingoBucket; bytes: () => Uint8Array; type: string }> = [
  { bucket: PHOTO_BUCKET, bytes: () => fakeJpeg(), type: "image/jpeg" },
  { bucket: VIDEO_BUCKET, bytes: () => fakeVideo(), type: "video/mp4" },
];

/** A path in a claimed square's folder, in the bucket's naming. */
async function freshPath(bucket: BingoBucket): Promise<string> {
  const claim = await claimFreeSquare(db, track);
  return bucket === PHOTO_BUCKET
    ? photoPaths(claim.house, claim.position, crypto.randomUUID()).media
    : videoPath(claim.house, claim.position, crypto.randomUUID(), "video/mp4");
}

/** An object the service role stored, as an officer's upload would be. */
async function storedObject(bucket: BingoBucket, bytes: Uint8Array, type: string) {
  const path = await freshPath(bucket);
  const { error } = await db.storage.from(bucket).upload(path, bytes, { contentType: type });
  if (error) throw new Error(`fixture upload failed: ${error.message}`);
  return path;
}

function tokenClaims(token: string): { iat: number; exp: number; upsert?: boolean } {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
}

describe("the buckets", () => {
  it("are public, with the limits and types migration 33 sets", async () => {
    const photos = await db.storage.getBucket(PHOTO_BUCKET);
    expect(photos.error).toBeNull();
    expect(photos.data).toMatchObject({
      public: true,
      file_size_limit: 5242880,
      allowed_mime_types: ["image/jpeg"],
    });

    const videos = await db.storage.getBucket(VIDEO_BUCKET);
    expect(videos.error).toBeNull();
    expect(videos.data).toMatchObject({
      public: true,
      file_size_limit: MAX_VIDEO_BYTES,
      allowed_mime_types: ["video/mp4", "video/quicktime"],
    });
  });

  it("refuse a type they do not take, even from the service role", async () => {
    const path = await freshPath(VIDEO_BUCKET);
    const { error } = await db.storage
      .from(VIDEO_BUCKET)
      .upload(path, fakeJpeg(), { contentType: "image/jpeg" });
    expect(error).not.toBeNull();
    expect(await fileExists(db, VIDEO_BUCKET, path)).toBe(false);
  });
});

const ROLES = [
  { label: "anon", client: async () => anonClient() },
  // A signed-in user with NO admin_profiles row: one confirmed email away for
  // anyone, since signup is enabled.
  { label: "a signed-in non-officer", client: () => signInAsOutsider(testClient()) },
];

describe.each(ROLES)("$label", ({ client }) => {
  it.each(BUCKETS)("cannot list $bucket, though objects are in it", async ({ bucket, bytes, type }) => {
    const path = await storedObject(bucket, bytes(), type);
    const folder = path.split("/").slice(0, 2).join("/");
    const role = await client();

    const { data } = await role.storage.from(bucket).list(folder);
    expect(data ?? []).toEqual([]);
    const root = await role.storage.from(bucket).list();
    expect(root.data ?? []).toEqual([]);

    // Guards the guard: the object really is there, as the service role.
    const visible = await db.storage.from(bucket).list(folder);
    expect((visible.data ?? []).map((o) => o.name)).toContain(path.split("/").at(-1));
  });

  it.each(BUCKETS)("cannot upload to $bucket without a token", async ({ bucket, bytes, type }) => {
    const path = await freshPath(bucket);
    const role = await client();
    const { error } = await role.storage
      .from(bucket)
      .upload(path, bytes(), { contentType: type, cacheControl: UPLOAD_CACHE_CONTROL });
    expect(error).not.toBeNull();
    expect(await fileExists(db, bucket, path)).toBe(false);
  });

  it.each(BUCKETS)("cannot mint an upload token for $bucket", async ({ bucket }) => {
    const path = await freshPath(bucket);
    const role = await client();
    const { data, error } = await role.storage.from(bucket).createSignedUploadUrl(path);
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it.each(BUCKETS)(
    "cannot delete, move or overwrite an object in $bucket",
    async ({ bucket, bytes, type }) => {
      const path = await storedObject(bucket, bytes(), type);
      const role = await client();

      await role.storage.from(bucket).remove([path]);
      expect(await fileExists(db, bucket, path)).toBe(true);

      const moved = `${path.split("/").slice(0, 2).join("/")}/${crypto.randomUUID()}.moved`;
      await role.storage.from(bucket).move(path, moved);
      expect(await fileExists(db, bucket, path)).toBe(true);
      expect(await fileExists(db, bucket, moved)).toBe(false);

      const overwrite = await role.storage
        .from(bucket)
        .update(path, bytes().subarray(0, 8), { contentType: type });
      expect(overwrite.error).not.toBeNull();
      const info = await db.storage.from(bucket).info(path);
      expect(info.data?.size).toBe(bytes().length);
    }
  );
});

describe("a signed upload token", () => {
  it("lives no longer than the orphan sweep waits, and cannot upsert", async () => {
    const path = await freshPath(VIDEO_BUCKET);
    const { data, error } = await db.storage.from(VIDEO_BUCKET).createSignedUploadUrl(path);
    expect(error).toBeNull();
    const claims = tokenClaims(data!.token);
    // 📌 Measured 2026-10-10 on the local stack (CLI 2.120.0): 7200 s, the
    // same two hours the hosted project documents, and not the 60 s an older
    // local default was feared to be. The inequality is what lets the sweep
    // empty a path for good: by the time an upload is old enough to sweep,
    // the token that named its path has expired and cannot fill it again.
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(ORPHAN_AGE_MS / 1000);
    expect(claims.exp - claims.iat).toBeGreaterThan(0);
    expect(claims.upsert).toBe(false);
  });

  it("lets the anon key upload exactly one object, of an allowed type", async () => {
    const path = await freshPath(VIDEO_BUCKET);
    const { data } = await db.storage.from(VIDEO_BUCKET).createSignedUploadUrl(path);
    const anon = anonClient();

    // A disallowed type is refused by the bucket, and nothing is stored.
    const wrongType = await anon.storage
      .from(VIDEO_BUCKET)
      .uploadToSignedUrl(path, data!.token, fakeJpeg(), { contentType: "image/jpeg" });
    expect(wrongType.error).not.toBeNull();
    expect(await fileExists(db, VIDEO_BUCKET, path)).toBe(false);

    const good = await anon.storage
      .from(VIDEO_BUCKET)
      .uploadToSignedUrl(path, data!.token, fakeVideo(), {
        contentType: "video/mp4",
        cacheControl: UPLOAD_CACHE_CONTROL,
      });
    expect(good.error).toBeNull();
    expect(await fileExists(db, VIDEO_BUCKET, path)).toBe(true);

    // The same token cannot overwrite what it created.
    const again = await anon.storage
      .from(VIDEO_BUCKET)
      .uploadToSignedUrl(path, data!.token, fakeVideo(8), { contentType: "video/mp4" });
    expect(again.error).not.toBeNull();
    const info = await db.storage.from(VIDEO_BUCKET).info(path);
    expect(info.data?.size).toBe(fakeVideo().length);
  });

  it("names one path: it is refused anywhere else", async () => {
    const path = await freshPath(VIDEO_BUCKET);
    const elsewhere = await freshPath(VIDEO_BUCKET);
    const { data } = await db.storage.from(VIDEO_BUCKET).createSignedUploadUrl(path);

    const { error } = await anonClient()
      .storage.from(VIDEO_BUCKET)
      .uploadToSignedUrl(elsewhere, data!.token, fakeVideo(), { contentType: "video/mp4" });
    expect(error).not.toBeNull();
    expect(await fileExists(db, VIDEO_BUCKET, elsewhere)).toBe(false);
    expect(await fileExists(db, VIDEO_BUCKET, path)).toBe(false);
  });
});

describe("a stored object", () => {
  it.each(BUCKETS)(
    "answers 200 at its public URL in $bucket, by design, until it is deleted",
    async ({ bucket, bytes, type }) => {
      const path = await storedObject(bucket, bytes(), type);
      const url = bingoPublicUrl(db, bucket, path);
      expect(url).toContain(`/storage/v1/object/public/${bucket}/${path}`);

      const live = await fetch(url);
      expect(live.status).toBe(200);
      expect(live.headers.get("content-type")).toBe(type);
      await live.arrayBuffer();

      await db.storage.from(bucket).remove([path]);
      const gone = await fetch(url);
      expect(gone.status).not.toBe(200);
      await gone.arrayBuffer();
    }
  );
});

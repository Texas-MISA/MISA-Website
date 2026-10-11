import { readdirSync, readFileSync } from "node:fs";

import { afterAll, describe, expect, it } from "vitest";

import {
  ACTIVITY_COUNT,
  ACTIVITY_POSITIONS,
  AUDITED_MARK_COLUMNS,
  AUDITED_SQUARE_COLUMNS,
  BOARD_CELLS,
  BOARD_COLUMNS,
  boardRows,
  FREE_POSITION,
  formatProgress,
  houseCard,
  houseLabel,
  houseProgress,
  HOUSES,
  houseSlug,
  isActivityPosition,
  isHouse,
  isJpeg,
  isMarkKind,
  isVideoContentType,
  MARK_KINDS,
  MAX_ACTIVITY_LENGTH,
  MAX_PHOTO_BYTES,
  MAX_THUMB_BYTES,
  MAX_UPLOAD_REQUEST_BYTES,
  MAX_VIDEO_BYTES,
  mediaBucket,
  normalizeActivity,
  ORPHAN_AGE_MS,
  parseActivityPosition,
  parseHouseParam,
  parseVideoPath,
  PHOTO_BUCKET,
  PHOTO_LONG_EDGE,
  photoPaths,
  posterPath,
  readBingoBoard,
  scaledDimensions,
  squareFolder,
  THUMB_LONG_EDGE,
  UPLOAD_CACHE_CONTROL,
  VIDEO_BUCKET,
  VIDEO_CONTENT_TYPES,
  VIDEO_EXTENSIONS,
  videoPath,
  type BingoBoard,
  type BingoMark,
} from "@/lib/bingo";

import {
  claimFreeSquare,
  cleanupBingo,
  insertMark,
  newBingoTracker,
  SEEDED_ACTIVITIES,
  squaresByPosition,
} from "./bingo-fixtures";
import { anonClient, getTestOfficer, testClient } from "./helpers";

// House bingo, migration 33: the vocabulary, the constraints and the board
// read. The write cores are tests/bingo-writes.test.ts; the buckets' boundary
// is tests/bingo-storage.test.ts.

const MIGRATION = "supabase/migrations/20260730000033_house_bingo.sql";
const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

const db = testClient();
const track = newBingoTracker();

afterAll(async () => {
  await cleanupBingo(db, track);
});

const UUID = "0b7f4c1e-9d2a-4e3b-8c5d-6a7b8c9d0e1f";

// ---------------------------------------------------------------------------
// Pure
// ---------------------------------------------------------------------------

describe("the houses", () => {
  it("are M, I, S and A, exactly as bingo_marks_house_valid lists them", () => {
    expect([...HOUSES]).toEqual(["M", "I", "S", "A"]);
    // Mirrored, not merely similar: the CHECK's list is this list.
    expect(readFileSync(MIGRATION, "utf8")).toContain(
      "check (house in ('M', 'I', 'S', 'A'))"
    );
  });

  it("are recognised by isHouse and nothing else is", () => {
    for (const house of HOUSES) expect(isHouse(house)).toBe(true);
    for (const value of ["m", "X", "", " M", "MI", null, undefined, 1]) {
      expect(isHouse(value), String(value)).toBe(false);
    }
  });

  it("read from a URL in lowercase only, so each card has one URL", () => {
    expect(parseHouseParam("m")).toBe("M");
    expect(parseHouseParam("i")).toBe("I");
    expect(parseHouseParam("s")).toBe("S");
    expect(parseHouseParam("a")).toBe("A");
    for (const raw of ["M", "x", "", " m", "m ", "ma", undefined, null, ["m"]]) {
      expect(parseHouseParam(raw), JSON.stringify(raw)).toBeNull();
    }
    expect(HOUSES.map(houseSlug)).toEqual(["m", "i", "s", "a"]);
  });

  it("have a label", () => {
    expect(houseLabel("M")).toBe("M House");
    expect(houseLabel("A")).toBe("A House");
  });
});

describe("the positions", () => {
  it("are a 5x5 grid whose centre, 12, is free", () => {
    expect(BOARD_COLUMNS).toBe(5);
    expect(BOARD_CELLS).toBe(25);
    expect(FREE_POSITION).toBe(12);
  });

  it("hold 24 activities: 0 to 24 except the centre", () => {
    expect(ACTIVITY_COUNT).toBe(24);
    expect([...ACTIVITY_POSITIONS]).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
      23, 24,
    ]);
  });

  it("are validated as integers, never the centre", () => {
    for (const position of ACTIVITY_POSITIONS) expect(isActivityPosition(position)).toBe(true);
    for (const value of [12, -1, 25, 7.5, NaN, Infinity, "7", null]) {
      expect(isActivityPosition(value), String(value)).toBe(false);
    }
  });

  it("parse from a form or URL in one spelling only", () => {
    expect(parseActivityPosition("0")).toBe(0);
    expect(parseActivityPosition("7")).toBe(7);
    expect(parseActivityPosition("24")).toBe(24);
    expect(parseActivityPosition(7)).toBe(7);
    for (const raw of ["12", "07", " 7", "7 ", "7.0", "+7", "-1", "25", "", "x", 12, null]) {
      expect(parseActivityPosition(raw), JSON.stringify(raw)).toBeNull();
    }
  });
});

describe("the activity text", () => {
  it("is trimmed and bounded to 1–60 characters", () => {
    expect(MAX_ACTIVITY_LENGTH).toBe(60);
    expect(normalizeActivity("  Pool Day ")).toBe("Pool Day");
    expect(normalizeActivity("")).toBeNull();
    expect(normalizeActivity("   ")).toBeNull();
    expect(normalizeActivity("x".repeat(60))).toBe("x".repeat(60));
    expect(normalizeActivity("x".repeat(61))).toBeNull();
    expect(normalizeActivity(null)).toBeNull();
  });

  it("is counted in code points, as char_length counts it", () => {
    // An emoji is two UTF-16 units and one character: 59 + 1 is 60.
    const sixty = `${"x".repeat(59)}🎳`;
    expect(sixty.length).toBe(61);
    expect(normalizeActivity(sixty)).toBe(sixty);
    expect(normalizeActivity(`${sixty}x`)).toBeNull();
  });

  it("refuses control characters", () => {
    expect(normalizeActivity("Pool\nDay")).toBeNull();
    expect(normalizeActivity("Pool\u0000Day")).toBeNull();
    expect(normalizeActivity("Pool\u007fDay")).toBeNull();
    // A straight apostrophe is ordinary text.
    expect(normalizeActivity("Midnight McDonald's")).toBe("Midnight McDonald's");
  });
});

describe("the resizer's arithmetic", () => {
  it("brings the longer side down to the edge and keeps the ratio", () => {
    expect(scaledDimensions(4032, 3024, PHOTO_LONG_EDGE)).toEqual({ width: 2048, height: 1536 });
    expect(scaledDimensions(3024, 4032, PHOTO_LONG_EDGE)).toEqual({ width: 1536, height: 2048 });
    expect(scaledDimensions(4000, 4000, THUMB_LONG_EDGE)).toEqual({ width: 480, height: 480 });
    expect(scaledDimensions(1920, 1080, THUMB_LONG_EDGE)).toEqual({ width: 480, height: 270 });
  });

  it("never scales up", () => {
    expect(scaledDimensions(800, 600, PHOTO_LONG_EDGE)).toEqual({ width: 800, height: 600 });
    expect(scaledDimensions(2048, 100, PHOTO_LONG_EDGE)).toEqual({ width: 2048, height: 100 });
  });

  it("keeps a sliver at least one pixel wide", () => {
    expect(scaledDimensions(10000, 1, THUMB_LONG_EDGE)).toEqual({ width: 480, height: 1 });
  });

  it("answers null for a size that is not an image", () => {
    expect(scaledDimensions(0, 100, 480)).toBeNull();
    expect(scaledDimensions(100, -1, 480)).toBeNull();
    expect(scaledDimensions(NaN, 100, 480)).toBeNull();
    expect(scaledDimensions(100, 100, 0)).toBeNull();
    expect(scaledDimensions(Infinity, 100, 480)).toBeNull();
  });

  it("uses a 2048 edge for photos and 480 for thumbnails", () => {
    expect(PHOTO_LONG_EDGE).toBe(2048);
    expect(THUMB_LONG_EDGE).toBe(480);
  });
});

describe("the JPEG signature", () => {
  it("is FF D8 FF", () => {
    expect(isJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(isJpeg(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(true);
    expect(isJpeg(new Uint8Array([0xff, 0xd8]))).toBe(false);
    expect(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false); // PNG
    expect(isJpeg(new Uint8Array([0x00, 0xd8, 0xff]))).toBe(false);
    expect(isJpeg(new Uint8Array([]))).toBe(false);
  });
});

describe("the caps and upload settings", () => {
  it("are the sizes the plan names", () => {
    expect(MAX_PHOTO_BYTES).toBe(3 * 1024 * 1024);
    expect(MAX_THUMB_BYTES).toBe(300 * 1024);
    expect(MAX_VIDEO_BYTES).toBe(50 * 1024 * 1024);
    expect(MAX_UPLOAD_REQUEST_BYTES).toBe(4 * 1024 * 1024);
    expect(ORPHAN_AGE_MS).toBe(2 * 60 * 60 * 1000);
    expect(UPLOAD_CACHE_CONTROL).toBe("3600");
  });

  it("fit a photo and its thumbnail in one request, under Vercel's 4.5 MB", () => {
    expect(MAX_PHOTO_BYTES + MAX_THUMB_BYTES).toBeLessThan(MAX_UPLOAD_REQUEST_BYTES);
    expect(MAX_UPLOAD_REQUEST_BYTES).toBeLessThan(4.5 * 1000 * 1000);
  });

  it("match the buckets the migration creates", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    expect(PHOTO_BUCKET).toBe("bingo-photos");
    expect(VIDEO_BUCKET).toBe("bingo-videos");
    expect(sql).toContain("('bingo-photos', 'bingo-photos', true, 5242880, array['image/jpeg'])");
    expect(sql).toContain(
      "('bingo-videos', 'bingo-videos', true, 52428800, array['video/mp4', 'video/quicktime'])"
    );
    // The video cap IS the bucket's limit, and the photo caps sit under it.
    expect(MAX_VIDEO_BYTES).toBe(52428800);
    expect(MAX_PHOTO_BYTES).toBeLessThan(5242880);
  });

  it("map the two video types to their extensions", () => {
    expect(VIDEO_EXTENSIONS).toEqual({ "video/mp4": "mp4", "video/quicktime": "mov" });
    expect([...VIDEO_CONTENT_TYPES]).toEqual(["video/mp4", "video/quicktime"]);
    expect(isVideoContentType("video/mp4")).toBe(true);
    expect(isVideoContentType("video/quicktime")).toBe(true);
    for (const type of ["video/webm", "image/jpeg", "", "VIDEO/MP4", null]) {
      expect(isVideoContentType(type), String(type)).toBe(false);
    }
  });

  it("know which bucket each kind's media lives in", () => {
    expect([...MARK_KINDS]).toEqual(["photo", "video"]);
    expect(isMarkKind("photo")).toBe(true);
    expect(isMarkKind("audio")).toBe(false);
    expect(mediaBucket("photo")).toBe(PHOTO_BUCKET);
    expect(mediaBucket("video")).toBe(VIDEO_BUCKET);
  });
});

describe("the storage paths", () => {
  it("are <house, lowercased>/<position>/<uuid>", () => {
    expect(squareFolder("M", 7)).toBe("m/7");
    expect(photoPaths("M", 7, UUID)).toEqual({
      media: `m/7/${UUID}.jpg`,
      thumb: `m/7/${UUID}-thumb.jpg`,
    });
    expect(posterPath("S", 0, UUID)).toBe(`s/0/${UUID}-poster.jpg`);
    expect(videoPath("A", 24, UUID, "video/mp4")).toBe(`a/24/${UUID}.mp4`);
    expect(videoPath("I", 13, UUID, "video/quicktime")).toBe(`i/13/${UUID}.mov`);
  });

  it("accept a video path only for THIS house and position", () => {
    expect(parseVideoPath(`m/7/${UUID}.mp4`, "M", 7)).toEqual({
      uploadId: UUID,
      extension: "mp4",
      contentType: "video/mp4",
    });
    expect(parseVideoPath(`m/7/${UUID}.mov`, "M", 7)?.contentType).toBe("video/quicktime");

    for (const path of [
      `m/8/${UUID}.mp4`, // another square
      `i/7/${UUID}.mp4`, // another house
      `M/7/${UUID}.mp4`, // the house's other spelling
      `m/07/${UUID}.mp4`, // the position's other spelling
      `m/7/${UUID.toUpperCase()}.mp4`, // a uuid we never mint
      `m/7/${UUID}.jpg`, // a photo name
      `m/7/${UUID}-poster.jpg`,
      `m/7/${UUID}.mp4.mp4`,
      `m/7/x/${UUID}.mp4`, // a deeper folder
      `/m/7/${UUID}.mp4`,
      `m/7/../8/${UUID}.mp4`,
      `m/7/${UUID}.MP4`,
      `m/7/not-a-uuid.mp4`,
      "",
    ]) {
      expect(parseVideoPath(path, "M", 7), path).toBeNull();
    }
    expect(parseVideoPath(42, "M", 7)).toBeNull();
    // The square itself must be real.
    expect(parseVideoPath(`m/12/${UUID}.mp4`, "M", 12)).toBeNull();
  });
});

describe("the audit column lists", () => {
  it("carry the token, which withoutToken strips from both sides", () => {
    expect(AUDITED_SQUARE_COLUMNS).toBe("id, position, activity, updated_at");
    expect(AUDITED_MARK_COLUMNS).toBe(
      "id, house, square_id, kind, media_path, thumb_path, created_at, updated_at"
    );
  });
});

describe("the module stays importable from the browser", () => {
  it("imports nothing server-only", () => {
    // The officer upload component imports the constants and the resizer
    // arithmetic from here, in the browser.
    const source = readFileSync("lib/bingo.ts", "utf8");
    const imports = [...source.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["@/lib/members", "@/lib/types/database", "@supabase/supabase-js"]);
    expect(source).not.toMatch(/import\s+"server-only"/);
    // Both supabase-js and the generated types are type-only imports.
    expect(source).toMatch(/^import type \{ SupabaseClient \} from "@supabase\/supabase-js";$/m);
    expect(source).toMatch(/^import type \{ Database \} from "@\/lib\/types\/database";$/m);
    // lib/members.ts, the one runtime import, imports nothing at all.
    expect(readFileSync("lib/members.ts", "utf8")).not.toMatch(/^import /m);
  });
});

// A board built by hand, for the pure card and progress helpers.
function syntheticBoard(marks: Array<Pick<BingoMark, "house" | "squareId">>): BingoBoard {
  return {
    squares: ACTIVITY_POSITIONS.map((position) => ({
      id: `sq-${position}`,
      position,
      activity: `Activity ${position}`,
      updatedAt: "2026-10-10T00:00:00+00:00",
    })),
    marks: marks.map((mark, i) => ({
      id: `mk-${i}`,
      house: mark.house,
      squareId: mark.squareId,
      kind: "photo",
      mediaPath: `x/${i}.jpg`,
      thumbPath: `x/${i}-thumb.jpg`,
      createdAt: "2026-10-10T00:00:00+00:00",
      updatedAt: "2026-10-10T00:00:00+00:00",
    })),
  };
}

describe("a house's card", () => {
  it("is 25 cells in position order, with the house letter in the centre", () => {
    const card = houseCard(syntheticBoard([]), "S");
    expect(card).toHaveLength(25);
    expect(card.map((cell) => cell.position)).toEqual([...Array(25).keys()]);
    expect(card[12]).toEqual({ kind: "free", position: 12, house: "S" });
    expect(card.filter((cell) => cell.kind === "free")).toHaveLength(1);
  });

  it("shows only that house's marks", () => {
    const board = syntheticBoard([
      { house: "M", squareId: "sq-0" },
      { house: "I", squareId: "sq-1" },
      { house: "M", squareId: "sq-24" },
    ]);
    const card = houseCard(board, "M");
    const marked = card.filter((cell) => cell.kind === "activity" && cell.mark !== null);
    expect(marked.map((cell) => cell.position)).toEqual([0, 24]);
    const cellOne = card[1];
    expect(cellOne.kind === "activity" && cellOne.mark).toBeNull();
  });

  it("lays out in five rows of five", () => {
    const rows = boardRows(houseCard(syntheticBoard([]), "A"));
    expect(rows).toHaveLength(5);
    for (const row of rows) expect(row).toHaveLength(5);
    expect(rows[2][2].kind).toBe("free");
    expect(boardRows([1, 2, 3, 4, 5, 6])).toEqual([[1, 2, 3, 4, 5], [6]]);
  });

  it("counts progress out of 24, per house", () => {
    const board = syntheticBoard([
      { house: "M", squareId: "sq-0" },
      { house: "M", squareId: "sq-1" },
      { house: "I", squareId: "sq-1" },
      // A mark naming no square on the board is not progress.
      { house: "M", squareId: "sq-12" },
    ]);
    expect(houseProgress(board, "M")).toBe(2);
    expect(houseProgress(board, "I")).toBe(1);
    expect(houseProgress(board, "S")).toBe(0);
    expect(formatProgress(houseProgress(board, "M"))).toBe("2 of 24");
    expect(formatProgress(24)).toBe("24 of 24");
  });
});

// ---------------------------------------------------------------------------
// The migration's source
// ---------------------------------------------------------------------------

describe("the migration these source assertions read", () => {
  it("is still the latest to define the house CHECK and seed the board", () => {
    // 🪤 The assertions above read migration 33's SOURCE, which stays the truth
    // only while no later migration replaces what they quote. If one does,
    // these must move to that file.
    const prefix = (file: string) => /^(\d{14})_/.exec(file)?.[1] ?? "";
    const own = prefix(MIGRATION.split("/").at(-1)!);
    expect(own).toBe("20260730000033");
    const later = readdirSync("supabase/migrations").filter(
      (file) => file.endsWith(".sql") && prefix(file) > own
    );
    for (const file of later) {
      const sql = readFileSync(`supabase/migrations/${file}`, "utf8");
      expect(sql, file).not.toMatch(/constraint\s+bingo_marks_house_valid/i);
      expect(sql, file).not.toMatch(/insert\s+into\s+public\.bingo_squares/i);
      expect(sql, file).not.toMatch(/into\s+storage\.buckets/i);
    }
  });

  it("seeds exactly the officer's 24 activities", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    const rows = [...sql.matchAll(/^\s+\((\d+),\s+'((?:[^']|'')*)'\)[,;]$/gm)].map(
      (m) => [Number(m[1]), m[2].replace(/''/g, "'")] as const
    );
    expect(new Map(rows)).toEqual(SEEDED_ACTIVITIES);
    expect(rows).toHaveLength(24);
  });
});

// ---------------------------------------------------------------------------
// The database
// ---------------------------------------------------------------------------

describe("the seeded board", () => {
  it("holds the 24 activities at their positions, exactly as the card reads", async () => {
    // Reads the stack as the migration left it. A square renamed in a local
    // walkthrough fails here: reset the stack.
    const squares = await squaresByPosition(db);
    expect(squares.size).toBe(24);
    expect(new Map([...squares].map(([position, row]) => [position, row.activity]))).toEqual(
      SEEDED_ACTIVITIES
    );
    // A straight apostrophe, as the officer's card has it.
    expect(squares.get(24)?.activity).toBe("Midnight McDonald's");
    expect(squares.has(FREE_POSITION)).toBe(false);
  });
});

describe("bingo_squares constraints", () => {
  it("refuses a position outside 0–24, or the free centre", async () => {
    for (const position of [-1, 12, 25]) {
      const { error } = await db
        .from("bingo_squares")
        .insert({ position, activity: "TEST square" });
      expect(error?.code, String(position)).toBe(CHECK_VIOLATION);
    }
  });

  it("refuses a second activity at a position", async () => {
    const squares = await squaresByPosition(db);
    const { error } = await db
      .from("bingo_squares")
      .update({ position: 1 })
      .eq("id", squares.get(0)!.id);
    expect(error?.code).toBe(UNIQUE_VIOLATION);
  });

  it("refuses an untrimmed, empty or overlong activity", async () => {
    const squares = await squaresByPosition(db);
    const square = squares.get(0)!;
    for (const activity of [" House Dinner", "House Dinner ", "", "x".repeat(61)]) {
      const { error } = await db
        .from("bingo_squares")
        .update({ activity })
        .eq("id", square.id);
      expect(error?.code, JSON.stringify(activity)).toBe(CHECK_VIOLATION);
    }
  });

  it("accepts 60 characters, and bumps updated_at on every change", async () => {
    const squares = await squaresByPosition(db);
    const square = squares.get(0)!;
    try {
      const { data, error } = await db
        .from("bingo_squares")
        .update({ activity: "x".repeat(60) })
        .eq("id", square.id)
        .select("updated_at")
        .single();
      expect(error).toBeNull();
      expect(data!.updated_at).not.toBe(square.updated_at);
    } finally {
      await db.from("bingo_squares").update({ activity: square.activity }).eq("id", square.id);
    }
  });
});

describe("bingo_marks constraints", () => {
  it("accepts all four houses, and refuses anything else", async () => {
    // The database's half of HOUSES, by SQLSTATE.
    for (const house of HOUSES) {
      const claim = await claimFreeSquare(db, track, house);
      const { error } = await db.from("bingo_marks").insert({
        house,
        square_id: claim.squareId,
        kind: "video",
        media_path: `test/${crypto.randomUUID()}.mp4`,
      });
      expect(error, house).toBeNull();
    }

    const claim = await claimFreeSquare(db, track);
    for (const house of ["X", "m", "", "MI"]) {
      const { error } = await db.from("bingo_marks").insert({
        house,
        square_id: claim.squareId,
        kind: "video",
        media_path: `test/${crypto.randomUUID()}.mp4`,
      });
      expect(error?.code, JSON.stringify(house)).toBe(CHECK_VIOLATION);
    }
  });

  it("refuses a kind other than photo or video", async () => {
    const claim = await claimFreeSquare(db, track);
    const { error } = await db.from("bingo_marks").insert({
      house: claim.house,
      square_id: claim.squareId,
      kind: "audio",
      media_path: `test/${crypto.randomUUID()}.mp3`,
      thumb_path: `test/${crypto.randomUUID()}.jpg`,
    });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("requires a thumbnail for a photo, and not for a video", async () => {
    const claim = await claimFreeSquare(db, track);
    const photo = await db.from("bingo_marks").insert({
      house: claim.house,
      square_id: claim.squareId,
      kind: "photo",
      media_path: `test/${crypto.randomUUID()}.jpg`,
      thumb_path: null,
    });
    expect(photo.error?.code).toBe(CHECK_VIOLATION);

    const video = await insertMark(db, claim, { kind: "video", thumbPath: null });
    expect(video.thumb_path).toBeNull();
  });

  it("holds one mark per house per square", async () => {
    const claim = await claimFreeSquare(db, track);
    await insertMark(db, claim);
    const { error } = await db.from("bingo_marks").insert({
      house: claim.house,
      square_id: claim.squareId,
      kind: "video",
      media_path: `test/${crypto.randomUUID()}.mp4`,
    });
    expect(error?.code).toBe(UNIQUE_VIOLATION);
  });

  it("never lets two marks share one stored file", async () => {
    const first = await claimFreeSquare(db, track);
    const second = await claimFreeSquare(db, track);
    const mark = await insertMark(db, first);
    const { error } = await db.from("bingo_marks").insert({
      house: second.house,
      square_id: second.squareId,
      kind: "photo",
      media_path: mark.media_path,
      thumb_path: `test/${crypto.randomUUID()}.jpg`,
    });
    expect(error?.code).toBe(UNIQUE_VIOLATION);
  });

  it("refuses to delete a square that a house has completed (RESTRICT)", async () => {
    const claim = await claimFreeSquare(db, track);
    await insertMark(db, claim);
    const { error } = await db.from("bingo_squares").delete().eq("id", claim.squareId);
    expect(error?.code).toBe(FOREIGN_KEY_VIOLATION);
    const squares = await squaresByPosition(db);
    expect(squares.get(claim.position)?.id).toBe(claim.squareId);
  });

  it("bumps updated_at on every change", async () => {
    const claim = await claimFreeSquare(db, track);
    const mark = await insertMark(db, claim);
    const { data, error } = await db
      .from("bingo_marks")
      .update({ thumb_path: `test/${crypto.randomUUID()}.jpg` })
      .eq("id", mark.id)
      .select("updated_at")
      .single();
    expect(error).toBeNull();
    expect(data!.updated_at).not.toBe(mark.updated_at);
  });
});

describe("the audit log", () => {
  it("accepts 'bingo_square' and 'bingo_mark' as entity types", async () => {
    // ⚠️ admin_audit is append-only, so a row written under an entity_type the
    // CHECK does not carry fails at the insert, and one written under a WRONG
    // type can never be corrected. This is the assertion that the SQL check and
    // AuditEntityType moved together. These two rows stay, as every audit row
    // a test writes does.
    const squares = await squaresByPosition(db);
    const actor = await getTestOfficer(db);
    const square = await db.from("admin_audit").insert({
      entity_type: "bingo_square",
      entity_id: squares.get(0)!.id,
      actor_id: actor,
      action: "bingo_square.renamed",
      note: "TEST audit check",
    });
    expect(square.error).toBeNull();

    const mark = await db.from("admin_audit").insert({
      entity_type: "bingo_mark",
      entity_id: crypto.randomUUID(),
      actor_id: actor,
      action: "bingo_mark.added",
      note: "TEST audit check",
    });
    expect(mark.error).toBeNull();
  });

  it("still refuses an entity type nobody declared", async () => {
    const { error } = await db.from("admin_audit").insert({
      entity_type: "bingo",
      entity_id: crypto.randomUUID(),
      actor_id: await getTestOfficer(db),
      action: "bingo_mark.added",
    });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });
});

describe("readBingoBoard", () => {
  it("returns the 24 squares in order and every house's marks", async () => {
    const claim = await claimFreeSquare(db, track);
    const fixture = await insertMark(db, claim);

    const result = await readBingoBoard(db);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    expect(result.board.squares.map((square) => square.position)).toEqual([...ACTIVITY_POSITIONS]);
    expect(result.board.squares.map((square) => square.activity)).toEqual([
      ...SEEDED_ACTIVITIES.values(),
    ]);

    const mark = result.board.marks.find((m) => m.id === fixture.id);
    expect(mark).toEqual({
      id: fixture.id,
      house: claim.house,
      squareId: claim.squareId,
      kind: "photo",
      mediaPath: fixture.media_path,
      thumbPath: fixture.thumb_path,
      createdAt: expect.any(String),
      // The raw PostgREST string, untouched: it is a compare-and-set token.
      updatedAt: fixture.updated_at,
    });

    const cell = houseCard(result.board, claim.house).find(
      (c) => c.position === claim.position
    );
    expect(cell?.kind === "activity" && cell.mark?.id).toBe(fixture.id);
    expect(houseProgress(result.board, claim.house)).toBeGreaterThanOrEqual(1);
  });

  it("carries nothing about officers or members", async () => {
    const claim = await claimFreeSquare(db, track);
    await insertMark(db, claim);
    const result = await readBingoBoard(db);
    if (result.kind !== "ok") throw new Error("board read failed");
    expect(Object.keys(result.board).sort()).toEqual(["marks", "squares"]);
    for (const square of result.board.squares) {
      expect(Object.keys(square).sort()).toEqual(["activity", "id", "position", "updatedAt"]);
    }
    for (const mark of result.board.marks) {
      expect(Object.keys(mark).sort()).toEqual([
        "createdAt",
        "house",
        "id",
        "kind",
        "mediaPath",
        "squareId",
        "thumbPath",
        "updatedAt",
      ]);
    }
  });

  it("is an ERROR through the anon key, never an empty board", async () => {
    // 🪤 Deny-all RLS answers anon with zero rows and no error. Read through
    // the wrong client, the board would otherwise look perfectly empty.
    const result = await readBingoBoard(anonClient());
    expect(result).toEqual({ kind: "error" });
  });
});

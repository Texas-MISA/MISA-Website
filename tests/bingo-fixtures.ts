import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ACTIVITY_POSITIONS,
  HOUSES,
  PHOTO_BUCKET,
  squareFolder,
  VIDEO_BUCKET,
  type BingoBucket,
  type House,
} from "@/lib/bingo";
import type { Database } from "@/lib/types/database";

// Shared fixtures for the house-bingo tests (migration 33). Not a test file:
// vitest's include pattern is *.test.ts.
//
// ⚠️ The board is GLOBAL STATE, like app_settings. There is one set of 24
// squares and every house's marks live beside them, so these fixtures never
// assume an empty board: each test claims a (house, square) that has no mark
// right now and has not been claimed earlier in the run, and cleans up only
// what it claimed. A developer's local walkthrough marks, and a crashed run's
// leftovers, are stepped round rather than deleted.

type Client = SupabaseClient<Database>;

/**
 * Migration 33's board, transcribed from the officer's card. The test files
 * check this against both the migration's source and the database.
 */
export const SEEDED_ACTIVITIES: ReadonlyMap<number, string> = new Map([
  [0, "House Dinner"],
  [1, "Study Session"],
  [2, "Bowling Union Underground"],
  [3, "Photo at Capitol Building"],
  [4, "Karaoke Night"],
  [5, "Food Review Video"],
  [6, "Pool Day"],
  [7, "Attend a UT Sports Event"],
  [8, "Holiday Potluck"],
  [9, "Movie Night"],
  [10, "Photo at McCombs Statue"],
  [11, "Coffee Run"],
  [13, "Photo at UT Tower"],
  [14, "Pickle Ball"],
  [15, "Volleyball"],
  [16, "Game Night"],
  [17, "House Picnic"],
  [18, "Grab a Sweet Treat"],
  [19, "MISA Promotional Video"],
  [20, "Morning Hike"],
  [21, "Mini Golf"],
  [22, "Barton Springs"],
  [23, "Photo at Monochrome for Austin"],
  [24, "Midnight McDonald's"],
]);

/**
 * Bytes that pass isJpeg (FF D8 FF) and end with the EOI marker. Not a
 * decodable picture, and nothing here needs one: the server checks the
 * signature and the size, and never decodes.
 */
export function fakeJpeg(size = 64): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  bytes[size - 2] = 0xff;
  bytes[size - 1] = 0xd9;
  return bytes;
}

/** Bytes standing in for a video. The bucket checks the declared type, never
 * the content. */
export function fakeVideo(size = 64): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);
  return bytes;
}

export type ClaimedSquare = { house: House; position: number; squareId: string };

export type BingoTracker = {
  /** `${house}:${position}`, so one run never claims a square twice. */
  claimed: Map<string, ClaimedSquare>;
};

export function newBingoTracker(): BingoTracker {
  return { claimed: new Map() };
}

/** The current squares, by position. */
export async function squaresByPosition(
  db: Client
): Promise<Map<number, { id: string; activity: string; updated_at: string }>> {
  const { data, error } = await db
    .from("bingo_squares")
    .select("id, position, activity, updated_at");
  if (error) throw new Error(`bingo squares read failed: ${error.message}`);
  return new Map(data.map((row) => [row.position, row]));
}

/**
 * A (house, position) with no mark right now and not claimed earlier in this
 * run, for `onlyHouse` when it is given. Walks the pairs from a random start,
 * so reruns spread across the board instead of piling onto one square.
 */
export async function claimFreeSquare(
  db: Client,
  track: BingoTracker,
  onlyHouse?: House
): Promise<ClaimedSquare> {
  const squares = await squaresByPosition(db);
  const { data: marks, error } = await db.from("bingo_marks").select("house, square_id");
  if (error) throw new Error(`bingo marks read failed: ${error.message}`);
  const taken = new Set(marks.map((mark) => `${mark.house}:${mark.square_id}`));

  const pairs = HOUSES.filter((house) => onlyHouse === undefined || house === onlyHouse).flatMap(
    (house) => ACTIVITY_POSITIONS.map((position) => ({ house, position }))
  );
  const start = Math.floor(Math.random() * pairs.length);
  for (let i = 0; i < pairs.length; i++) {
    const { house, position } = pairs[(start + i) % pairs.length];
    const key = `${house}:${position}`;
    const square = squares.get(position);
    if (!square || track.claimed.has(key) || taken.has(`${house}:${square.id}`)) continue;
    const claim = { house, position, squareId: square.id };
    track.claimed.set(key, claim);
    return claim;
  }
  throw new Error(
    "every (house, square) on the local board already has a mark — clean the local stack"
  );
}

/** Every object in one square's folder, as paths. */
export async function filesIn(
  db: Client,
  bucket: BingoBucket,
  house: House,
  position: number
): Promise<string[]> {
  const folder = squareFolder(house, position);
  const { data, error } = await db.storage
    .from(bucket)
    .list(folder, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (error) throw new Error(`listing ${bucket}/${folder} failed: ${error.message}`);
  return data.filter((object) => object.id !== null).map((object) => `${folder}/${object.name}`);
}

export async function fileExists(
  db: Client,
  bucket: BingoBucket,
  path: string
): Promise<boolean> {
  const { data, error } = await db.storage.from(bucket).exists(path);
  if (error && data !== false) throw new Error(`exists(${bucket}/${path}) failed: ${error.message}`);
  return data;
}

/** A mark written straight to the table, for the tests that need one in place
 * rather than the write cores' own. No files behind it unless the test adds
 * them. */
export async function insertMark(
  db: Client,
  claim: ClaimedSquare,
  values: { kind?: string; mediaPath?: string; thumbPath?: string | null } = {}
): Promise<{ id: string; updated_at: string; media_path: string; thumb_path: string | null }> {
  const folder = squareFolder(claim.house, claim.position);
  const id = crypto.randomUUID();
  const kind = values.kind ?? "photo";
  const { data, error } = await db
    .from("bingo_marks")
    .insert({
      house: claim.house,
      square_id: claim.squareId,
      kind,
      media_path: values.mediaPath ?? `${folder}/${id}.${kind === "video" ? "mp4" : "jpg"}`,
      thumb_path:
        values.thumbPath === undefined ? `${folder}/${id}-thumb.jpg` : values.thumbPath,
    })
    .select("id, updated_at, media_path, thumb_path")
    .single();
  if (error) throw new Error(`fixture mark insert failed: ${error.message}`);
  return data;
}

/**
 * Remove every mark and every stored file under the squares this run claimed.
 * Claimed squares had no mark when claimed, so everything there is the run's.
 */
export async function cleanupBingo(db: Client, track: BingoTracker): Promise<void> {
  for (const claim of track.claimed.values()) {
    await db
      .from("bingo_marks")
      .delete()
      .eq("house", claim.house)
      .eq("square_id", claim.squareId);
    for (const bucket of [PHOTO_BUCKET, VIDEO_BUCKET] as const) {
      const paths = await filesIn(db, bucket, claim.house, claim.position);
      if (paths.length > 0) await db.storage.from(bucket).remove(paths);
    }
  }
  track.claimed.clear();
}

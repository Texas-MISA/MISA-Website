import type { SupabaseClient } from "@supabase/supabase-js";

import { withoutToken } from "@/lib/members";
import type { Database } from "@/lib/types/database";

// House bingo (migration 33): the vocabulary, the storage paths, the board read
// and the write cores. Same contract as lib/checkin.ts and lib/lookup.ts: the
// client (and, for the orphan sweep, the clock) is injected, nothing imports
// next/* or a server-only module, and every decision lives here rather than in
// the action or the Route Handler. The officer upload component imports the
// constants and pure helpers from the browser, which is why this module must
// never gain a server-only import.
//
// The board is one shared set of 24 activities. Every house card shows them in
// the same positions, row-major 0–24 on a 5×5 grid, and position 12 is the free
// centre square: it shows the house letter and is never stored. A square is
// DONE for a house exactly when a bingo_marks row exists for it, and that row
// holds the one photo or video that proves it.
//
// 🔓 WHO MAY CALL THE WRITE CORES. Each takes the SERVICE-ROLE client and does
// no authorization of its own: the action or Route Handler around it starts
// with getOfficer() (lib/auth.ts), writes the admin_audit row from the
// before/after this returns, and revalidates. The cores never throw; every
// outcome is a status.
//
// 🔓 THE ONE BROWSER WRITE. A photo is uploaded by our own Route Handler. A
// video is too big for a function body, so prepareBingoVideoUpload mints a
// signed upload token for ONE path, the browser uploads that object with the
// anon key, and recordBingoVideo checks the object before it records the mark.
// There is no policy on storage.objects for any API role, and there must never
// be one: the token is the only way a browser writes, and it names one path.

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// The board's vocabulary
// ---------------------------------------------------------------------------

/** The four houses. Mirrors `bingo_marks_house_valid` — change both together,
 * as with EVENT_CATEGORIES and MEMBER_TYPES. */
export const HOUSES = ["M", "I", "S", "A"] as const;
export type House = (typeof HOUSES)[number];

export function isHouse(value: unknown): value is House {
  return typeof value === "string" && (HOUSES as readonly string[]).includes(value);
}

/** Squares per row, and squares on a card. */
export const BOARD_COLUMNS = 5;
export const BOARD_CELLS = BOARD_COLUMNS * BOARD_COLUMNS;

/** The free centre square. It shows the house letter and is never stored, so
 * it can never be marked, renamed or counted. */
export const FREE_POSITION = 12;

/** The 24 positions that hold an activity: 0–24 except the free centre. */
export const ACTIVITY_POSITIONS: readonly number[] = Array.from(
  { length: BOARD_CELLS },
  (_, position) => position
).filter((position) => position !== FREE_POSITION);

/** 24. Every house's progress is out of this. */
export const ACTIVITY_COUNT = ACTIVITY_POSITIONS.length;

/** `bingo_squares_activity_length`'s upper bound, in characters. */
export const MAX_ACTIVITY_LENGTH = 60;

export const MARK_KINDS = ["photo", "video"] as const;
export type MarkKind = (typeof MARK_KINDS)[number];

export function isMarkKind(value: unknown): value is MarkKind {
  return typeof value === "string" && (MARK_KINDS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Storage: buckets, caps, and the upload settings
// ---------------------------------------------------------------------------

/** Full photos, thumbnails and video posters: image/jpeg only, 5 MiB a file
 * (migration 33). Public: members see the proof on a no-login page. */
export const PHOTO_BUCKET = "bingo-photos";
/** Videos: video/mp4 and video/quicktime, 50 MiB a file. Public. */
export const VIDEO_BUCKET = "bingo-videos";
export type BingoBucket = typeof PHOTO_BUCKET | typeof VIDEO_BUCKET;

/** A full photo, after the browser has resized it to PHOTO_LONG_EDGE. Tighter
 * than the bucket's 5 MiB, which is only the backstop. */
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
/** A photo's thumbnail or a video's poster frame. */
export const MAX_THUMB_BYTES = 300 * 1024;
/** A video. The bucket's own limit, since the browser uploads it directly. */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
/**
 * The whole photo upload request: full photo plus thumbnail plus form fields.
 * Under Vercel's 4.5 MB function body limit with room to spare, and above
 * MAX_PHOTO_BYTES + MAX_THUMB_BYTES, so a request within both caps always fits.
 */
export const MAX_UPLOAD_REQUEST_BYTES = 4 * 1024 * 1024;

/** The browser resizes a photo so its longer side is at most this. */
export const PHOTO_LONG_EDGE = 2048;
/** ...and makes a thumbnail (or a video's poster) at most this. */
export const THUMB_LONG_EDGE = 480;

export const PHOTO_CONTENT_TYPE = "image/jpeg";

/** The video types the bucket accepts, and the extension each is stored under. */
export const VIDEO_EXTENSIONS = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
} as const;
export type VideoContentType = keyof typeof VIDEO_EXTENSIONS;
export type VideoExtension = (typeof VIDEO_EXTENSIONS)[VideoContentType];
export const VIDEO_CONTENT_TYPES = Object.keys(
  VIDEO_EXTENSIONS
) as readonly VideoContentType[];

/** The same map read backwards, derived so the two cannot disagree. */
const VIDEO_TYPE_FOR_EXTENSION = Object.fromEntries(
  VIDEO_CONTENT_TYPES.map((type) => [VIDEO_EXTENSIONS[type], type])
) as Record<VideoExtension, VideoContentType>;

export function isVideoContentType(value: unknown): value is VideoContentType {
  return (
    typeof value === "string" &&
    (VIDEO_CONTENT_TYPES as readonly string[]).includes(value)
  );
}

/**
 * How long an unrecorded video may sit in its square's folder before the sweep
 * deletes it, counted from when it was stored: 2 hours, the signed upload
 * token's lifetime (measured locally, 2026-10-10: the token's exp − iat is
 * 7200 s, the same as the hosted project).
 *
 * The officer's browser records a video the moment its upload finishes, so one
 * still unrecorded two hours after it was stored has been abandoned. And
 * because no token outlives this, a path the sweep has emptied can never be
 * filled again: the token that named it has expired.
 */
export const ORPHAN_AGE_MS = 2 * 60 * 60 * 1000;

/**
 * `Cache-Control: max-age` for every upload, in seconds, as storage-js takes
 * it. A removed or replaced file is deleted from the bucket at once, but a CDN
 * or browser holding a copy keeps serving it until this runs out, so this is
 * how long a removed photo can still be seen: an hour at most.
 */
export const UPLOAD_CACHE_CONTROL = "3600";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** The house as it appears in a URL and a storage path: `m`. */
export function houseSlug(house: House): string {
  return house.toLowerCase();
}

/**
 * A house from a URL segment: `m` → `M`, and anything else → null.
 *
 * Lowercase only, so each card has exactly one URL; `M` is refused rather than
 * accepted as a second spelling of the same page.
 */
export function parseHouseParam(raw: unknown): House | null {
  if (typeof raw !== "string") return null;
  return HOUSES.find((house) => houseSlug(house) === raw) ?? null;
}

/** An integer 0–24 other than the free centre. */
export function isActivityPosition(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < BOARD_CELLS &&
    value !== FREE_POSITION
  );
}

/**
 * A position from a form field or a URL: the number itself, or its plain
 * decimal spelling. `"7"` → 7; `"07"`, `" 7"`, `"7.0"` and `"12"` → null, so
 * one square has one spelling, exactly as in its storage path.
 */
export function parseActivityPosition(raw: unknown): number | null {
  if (typeof raw === "number") return isActivityPosition(raw) ? raw : null;
  if (typeof raw !== "string" || !/^(0|[1-9][0-9]?)$/.test(raw)) return null;
  const position = Number(raw);
  return isActivityPosition(position) ? position : null;
}

/** "M House". */
export function houseLabel(house: House): string {
  return `${house} House`;
}

/**
 * The size to draw an image at so its longer side is at most `longEdge`, for
 * the browser resizer. Never scales UP: an image already within the edge keeps
 * its own size. Null for a size that is not a real image (zero, negative or not
 * finite), which is what a failed decode reports.
 */
export function scaledDimensions(
  width: number,
  height: number,
  longEdge: number
): { width: number; height: number } | null {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(longEdge) ||
    width <= 0 ||
    height <= 0 ||
    longEdge <= 0
  ) {
    return null;
  }
  const long = Math.max(width, height);
  const scale = long > longEdge ? longEdge / long : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Starts with the JPEG SOI marker and the first marker byte: FF D8 FF. */
export function isJpeg(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  );
}

/**
 * The activity as it will be stored: trimmed, 1–60 characters, or null.
 *
 * Counted in code points, which is what Postgres's char_length counts; a JS
 * `.length` counts an emoji twice and would refuse a 60-character label the
 * CHECK accepts. Control characters are refused here although the CHECK does
 * not refuse them: a label shown on every card never needs one, and a NUL
 * cannot be stored in Postgres text at all.
 */
export function normalizeActivity(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const activity = raw.trim();
  const codePoints = [...activity];
  if (codePoints.length < 1 || codePoints.length > MAX_ACTIVITY_LENGTH) return null;
  const hasControl = codePoints.some((char) => {
    const code = char.codePointAt(0)!;
    return code < 0x20 || code === 0x7f;
  });
  return hasControl ? null : activity;
}

/** "7 of 24". */
export function formatProgress(done: number): string {
  return `${done} of ${ACTIVITY_COUNT}`;
}

/** Cells in rows of BOARD_COLUMNS, top row first. */
export function boardRows<T>(cells: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (let start = 0; start < cells.length; start += BOARD_COLUMNS) {
    rows.push(cells.slice(start, start + BOARD_COLUMNS));
  }
  return rows;
}

// ---------------------------------------------------------------------------
// The uploader's file decisions
// ---------------------------------------------------------------------------
//
// Run in the browser by the proof form, on the file the officer chose, before
// anything is sent.

/**
 * Extensions read as a photo when the browser reports no type at all. HEIC is
 * one: whether it opens is the browser's decoder's to say (Safari can, Chrome
 * cannot), and the form words a failed decode itself.
 */
const PHOTO_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);

/** A file name's extension, lowercased, without the dot: `"IMG_1.MOV"` →
 * `"mov"`. Only what follows the LAST dot, and `""` when there is no dot. */
export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/**
 * Whether a chosen file is a photo or a video, or neither. The browser's type
 * decides when there is one, and a type that is neither image nor video is
 * refused. With no type at all, which some pickers report, the extension
 * decides.
 */
export function proofKindOf(file: File): MarkKind | null {
  if (file.type.startsWith("image/")) return "photo";
  if (file.type.startsWith("video/")) return "video";
  if (file.type !== "") return null;
  const extension = fileExtension(file.name);
  if (PHOTO_EXTENSIONS.has(extension)) return "photo";
  if (VIDEO_CONTENT_TYPES.some((type) => VIDEO_EXTENSIONS[type] === extension)) {
    return "video";
  }
  return null;
}

/**
 * The file with a type VIDEO_BUCKET takes, or null when it has none.
 *
 * A browser that reports no type gets one from the extension, re-wrapped into
 * a NEW File, because that type is what Storage records: uploadToSignedUrl
 * sends a File as FormData and ignores its own contentType option. Any other
 * reported type (video/x-m4v, image/heic) is refused, never overridden.
 */
export function withVideoType(file: File): File | null {
  if (isVideoContentType(file.type)) return file;
  if (file.type !== "") return null;
  const extension = fileExtension(file.name);
  const type = VIDEO_CONTENT_TYPES.find((t) => VIDEO_EXTENSIONS[t] === extension);
  return type === undefined ? null : new File([file], file.name, { type });
}

// ---------------------------------------------------------------------------
// The upload request
// ---------------------------------------------------------------------------
//
// The two gates /admin/bingo/upload puts in front of the write cores, kept
// pure so they can be tested without a request context.

/**
 * The host a same-origin check holds Origin against: the first
 * comma-separated value of x-forwarded-host, trimmed, or else Host. The order
 * Next's own Server Action check uses (parseHostHeader in
 * next/dist/server/app-render/action-handler.js).
 */
function requestHost(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  return forwarded ? forwarded : headers.get("host");
}

/**
 * True when the request's Origin names the host it was sent to.
 *
 * The comparison Next makes before it runs any Server Action: Origin's host
 * against requestHost(). This app sets no serverActions.allowedOrigins, so the
 * two accept the same requests, with one difference: a MISSING Origin, which
 * Next lets through with a warning, is refused here, along with the literal
 * "null" (an opaque origin) and anything that is not a URL. Every browser
 * sends Origin on a POST, and the proof form is this route's only caller.
 */
export function isSameOriginRequest(headers: Headers): boolean {
  const origin = headers.get("origin");
  if (origin === null || origin === "null") return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const host = requestHost(headers);
  return host !== null && host !== "" && originHost === host;
}

/**
 * Whether a Content-Length header lets the request in: absent, since the body
 * is counted as it arrives anyway (readBodyWithin), or a plain decimal integer
 * no greater than `cap`. A malformed value is refused rather than ignored: no
 * well-behaved client sends one.
 */
export function declaredLengthWithin(value: string | null, cap: number): boolean {
  if (value === null) return true;
  return /^\d+$/.test(value) && Number(value) <= cap;
}

export type BodyRead =
  | { kind: "ok"; bytes: Uint8Array<ArrayBuffer> }
  /** More than the cap arrived. Reading stopped there. */
  | { kind: "too_large" }
  /** The stream failed part-way, as when the connection drops. */
  | { kind: "unreadable" };

/**
 * Read a request body, giving up the moment it passes `cap` bytes.
 *
 * It counts what actually ARRIVES, so neither a missing Content-Length nor a
 * false one gets a bigger body past the cap. It keeps nothing past the cap
 * either: the reader is cancelled at the chunk that crossed it. (Upstream,
 * Next may already hold the whole body; the route's header says why.)
 */
export async function readBodyWithin(
  body: ReadableStream<Uint8Array> | null,
  cap: number
): Promise<BodyRead> {
  if (body === null) return { kind: "ok", bytes: new Uint8Array(0) };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > cap) {
        reader.cancel().catch(() => {});
        return { kind: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { kind: "unreadable" };
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return { kind: "ok", bytes };
}

// ---------------------------------------------------------------------------
// Storage paths
// ---------------------------------------------------------------------------
//
// <house letter, lowercased>/<position>/<uuid>, with one fresh uuid per upload:
//
//   bingo-photos  m/7/<uuid>.jpg         a photo's full JPEG
//                 m/7/<uuid>-thumb.jpg   its thumbnail
//                 m/7/<uuid>-poster.jpg  a video's poster frame
//   bingo-videos  m/7/<uuid>.mp4 | .mov  a video
//
// A fresh uuid every time means an upload never overwrites anything (every
// upload is no-upsert), and a replaced file's URL dies with it rather than
// serving the new picture under a URL a cache already holds.
//
// 📌 A poster gets its OWN uuid, not its video's. Two copies of the same record
// request (a double click, a retry) then never collide on the poster's path,
// and the database write alone decides which one wins.

/** Lowercase canonical uuid, as crypto.randomUUID() writes it. */
const UPLOAD_ID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** A row id as a form posts it back. Postgres accepts either case. */
const ROW_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `m/7`: every file proving one house's square lives under this. */
export function squareFolder(house: House, position: number): string {
  return `${houseSlug(house)}/${position}`;
}

/** The full photo and its thumbnail, both in PHOTO_BUCKET. */
export function photoPaths(
  house: House,
  position: number,
  uploadId: string
): { media: string; thumb: string } {
  const folder = squareFolder(house, position);
  return { media: `${folder}/${uploadId}.jpg`, thumb: `${folder}/${uploadId}-thumb.jpg` };
}

/** A video's poster frame, in PHOTO_BUCKET. */
export function posterPath(house: House, position: number, uploadId: string): string {
  return `${squareFolder(house, position)}/${uploadId}-poster.jpg`;
}

/** A video, in VIDEO_BUCKET. */
export function videoPath(
  house: House,
  position: number,
  uploadId: string,
  contentType: VideoContentType
): string {
  return `${squareFolder(house, position)}/${uploadId}.${VIDEO_EXTENSIONS[contentType]}`;
}

export type ParsedVideoPath = {
  uploadId: string;
  extension: VideoExtension;
  /** The type the extension stands for, which the stored object must carry. */
  contentType: VideoContentType;
};

/**
 * A video path, accepted only if it belongs to THIS house and position.
 *
 * 🔓 The browser hands this path back after uploading, so it is untrusted. A
 * path for another square, another house, or anything that is not exactly
 * what videoPath() builds is refused, and nothing here ever deletes an object
 * at a path that failed this check.
 */
export function parseVideoPath(
  path: unknown,
  house: House,
  position: number
): ParsedVideoPath | null {
  if (typeof path !== "string" || !isHouse(house) || !isActivityPosition(position)) {
    return null;
  }
  const folder = `${squareFolder(house, position)}/`;
  if (!path.startsWith(folder)) return null;
  const extensions = Object.keys(VIDEO_TYPE_FOR_EXTENSION).join("|");
  const match = new RegExp(`^(${UPLOAD_ID})\\.(${extensions})$`).exec(
    path.slice(folder.length)
  );
  if (!match) return null;
  const extension = match[2] as VideoExtension;
  return {
    uploadId: match[1],
    extension,
    contentType: VIDEO_TYPE_FOR_EXTENSION[extension],
  };
}

/** The bucket a mark's media lives in: a photo's JPEG or a video. */
export function mediaBucket(kind: MarkKind): BingoBucket {
  return kind === "video" ? VIDEO_BUCKET : PHOTO_BUCKET;
}

/** A stored file's public URL. Builds a string; makes no request. */
export function bingoPublicUrl(db: Client, bucket: BingoBucket, path: string): string {
  return db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** The proof itself: the full photo, or the video. */
export function markMediaUrl(db: Client, mark: BingoMark): string {
  return bingoPublicUrl(db, mediaBucket(mark.kind), mark.mediaPath);
}

/** The picture a card shows: a photo's thumbnail or a video's poster. Null for
 * a video recorded without a poster. */
export function markThumbUrl(db: Client, mark: BingoMark): string | null {
  return mark.thumbPath === null ? null : bingoPublicUrl(db, PHOTO_BUCKET, mark.thumbPath);
}

// ---------------------------------------------------------------------------
// The audit contract
// ---------------------------------------------------------------------------

/**
 * The columns both sides of a `bingo_square.renamed` audit row select.
 *
 * Unbroken literals with `as const`, because PostgREST types the returned row
 * off the string and a concatenation widens it to `string`. `updated_at` is
 * read back as the next compare-and-set token and stripped from BOTH sides of
 * the snapshot (withoutToken), so the audit never shows a timestamp change.
 */
export const AUDITED_SQUARE_COLUMNS = "id, position, activity, updated_at" as const;

/** The same contract for `bingo_mark.added`, `.replaced` and `.removed`. */
export const AUDITED_MARK_COLUMNS =
  "id, house, square_id, kind, media_path, thumb_path, created_at, updated_at" as const;

type SquareRow = Pick<
  Database["public"]["Tables"]["bingo_squares"]["Row"],
  "id" | "position" | "activity" | "updated_at"
>;
type MarkRow = Pick<
  Database["public"]["Tables"]["bingo_marks"]["Row"],
  | "id"
  | "house"
  | "square_id"
  | "kind"
  | "media_path"
  | "thumb_path"
  | "created_at"
  | "updated_at"
>;

/** A square as an audit row's before/after records it. */
export type AuditedSquare = Omit<SquareRow, "updated_at">;
/** A mark as an audit row's before/after records it. */
export type AuditedMark = Omit<MarkRow, "updated_at">;

// ---------------------------------------------------------------------------
// The board read
// ---------------------------------------------------------------------------

export type BingoSquare = {
  id: string;
  position: number;
  activity: string;
  /** Raw PostgREST string: the rename's compare-and-set token. */
  updatedAt: string;
};

export type BingoMark = {
  id: string;
  house: House;
  squareId: string;
  kind: MarkKind;
  mediaPath: string;
  thumbPath: string | null;
  createdAt: string;
  /** Raw PostgREST string: the replace and remove compare-and-set token. */
  updatedAt: string;
};

export type BingoBoard = {
  /** All 24, in position order. */
  squares: BingoSquare[];
  marks: BingoMark[];
};

export type BingoBoardResult =
  | { kind: "ok"; board: BingoBoard }
  | { kind: "error" };

// The board's reads, kept apart from the audited lists even where they match:
// the symmetry rule is about the two sides of one diff, not about every read of
// a table agreeing (lib/members.ts says the same of its field columns).
const BOARD_SQUARE_COLUMNS = "id, position, activity, updated_at" as const;
const BOARD_MARK_COLUMNS =
  "id, house, square_id, kind, media_path, thumb_path, created_at, updated_at" as const;

/**
 * The whole board: every square and every house's marks.
 *
 * Returns a discriminated result, never an empty board on failure (the model is
 * lib/roster-index.ts): a failed read rendered as a board with nothing done
 * would tell every house its proof had vanished.
 *
 * 🪤 Exactly the 24 activity positions, or it is an ERROR. Both tables are
 * deny-all, and RLS answers the anon key with ZERO rows and no error, so a
 * board read through the wrong client would otherwise come back as a perfectly
 * well-formed empty board. Read with the service role.
 *
 * Carries nothing about officers or members: who added a mark is in admin_audit
 * and never leaves the server through this.
 */
export async function readBingoBoard(db: Client): Promise<BingoBoardResult> {
  try {
    const [squares, marks] = await Promise.all([
      db.from("bingo_squares").select(BOARD_SQUARE_COLUMNS).order("position"),
      db.from("bingo_marks").select(BOARD_MARK_COLUMNS).order("created_at"),
    ]);

    if (squares.error) {
      console.error("bingo board squares read failed:", squares.error.message);
      return { kind: "error" };
    }
    if (marks.error) {
      console.error("bingo board marks read failed:", marks.error.message);
      return { kind: "error" };
    }

    const positions = squares.data.map((square) => square.position);
    if (
      positions.length !== ACTIVITY_COUNT ||
      positions.some((position, index) => position !== ACTIVITY_POSITIONS[index])
    ) {
      console.error(
        `bingo board read returned ${positions.length} squares, not the ${ACTIVITY_COUNT} activity positions`
      );
      return { kind: "error" };
    }

    const boardMarks: BingoMark[] = [];
    for (const row of marks.data) {
      // The CHECKs make both impossible; a value outside them means the schema
      // and this module disagree, which is not something to render past.
      if (!isHouse(row.house) || !isMarkKind(row.kind)) {
        console.error(`bingo mark ${row.id} has house ${row.house} and kind ${row.kind}`);
        return { kind: "error" };
      }
      boardMarks.push({
        id: row.id,
        house: row.house,
        squareId: row.square_id,
        kind: row.kind,
        mediaPath: row.media_path,
        thumbPath: row.thumb_path,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }

    return {
      kind: "ok",
      board: {
        squares: squares.data.map((row) => ({
          id: row.id,
          position: row.position,
          activity: row.activity,
          updatedAt: row.updated_at,
        })),
        marks: boardMarks,
      },
    };
  } catch (e) {
    console.error("bingo board read failed:", e instanceof Error ? e.message : String(e));
    return { kind: "error" };
  }
}

export type BingoCell =
  /** The free centre: shows the house letter, never marked. */
  | { kind: "free"; position: number; house: House }
  | { kind: "activity"; position: number; square: BingoSquare; mark: BingoMark | null };

/**
 * One house's card: the free centre plus every square, in position order, each
 * with that house's mark if it has one. 25 cells for a board readBingoBoard
 * returned; lay them out with boardRows.
 */
export function houseCard(board: BingoBoard, house: House): BingoCell[] {
  const marks = new Map(
    board.marks.filter((mark) => mark.house === house).map((mark) => [mark.squareId, mark])
  );
  const cells: BingoCell[] = [];
  let freePlaced = false;
  for (const square of [...board.squares].sort((a, b) => a.position - b.position)) {
    if (!freePlaced && square.position > FREE_POSITION) {
      cells.push({ kind: "free", position: FREE_POSITION, house });
      freePlaced = true;
    }
    cells.push({
      kind: "activity",
      position: square.position,
      square,
      mark: marks.get(square.id) ?? null,
    });
  }
  if (!freePlaced) cells.push({ kind: "free", position: FREE_POSITION, house });
  return cells;
}

/** How many of the board's squares this house has done. */
export function houseProgress(board: BingoBoard, house: House): number {
  const squares = new Set(board.squares.map((square) => square.id));
  const done = new Set(
    board.marks
      .filter((mark) => mark.house === house && squares.has(mark.squareId))
      .map((mark) => mark.squareId)
  );
  return done.size;
}

/** One house's line in the standings: how many of its squares are done. */
export type HouseStanding = { house: House; done: number };

/**
 * Every house's progress, in HOUSES order (M, I, S, A), for the member portal's
 * standings.
 *
 * 📌 NEVER sorted by progress. The score is just "N of 24" (user's decision,
 * 2026-10-10), so the list is not a ranking, and a list that reordered itself
 * on a refresh would move a house's line out from under the member reading it.
 */
export function houseStandings(board: BingoBoard): HouseStanding[] {
  return HOUSES.map((house) => ({ house, done: houseProgress(board, house) }));
}

// ---------------------------------------------------------------------------
// The write cores
// ---------------------------------------------------------------------------

/** Why an input was refused before anything was written. */
export type BingoInvalidReason =
  | "house"
  | "position"
  | "photo_size"
  | "photo_type"
  | "thumb_size"
  | "thumb_type"
  /** A video type the bucket does not take, or an object whose stored type
   * does not match its path's extension. */
  | "video_type"
  | "video_size"
  /** Not a video path for this house and square, or the path the mark
   * already holds. */
  | "video_path"
  /** Nothing is stored at the path: the upload never finished. */
  | "video_missing"
  | "poster_size"
  | "poster_type"
  /** Blank, over MAX_ACTIVITY_LENGTH, or holding a control character. */
  | "activity";

type Invalid = { status: "invalid"; reason: BingoInvalidReason };

/** Recording proof for one house's square: an add or a replace. */
export type RecordProofResult =
  | Invalid
  /** The officer's screen is stale: the mark appeared, changed or vanished
   * since it was rendered, or another officer won the race to add it. */
  | { status: "conflict" }
  | { status: "error" }
  | {
      status: "added";
      markId: string;
      /** The new compare-and-set token. */
      updatedAt: string;
      before: null;
      after: AuditedMark;
      /** Always empty for an add; present so both outcomes read alike. */
      orphanPaths: string[];
    }
  | {
      status: "replaced";
      markId: string;
      updatedAt: string;
      before: AuditedMark;
      after: AuditedMark;
      /**
       * The replaced proof's files that could NOT be deleted, each as
       * `<bucket>/<path>`, for the audit note. Empty when cleanup succeeded.
       */
      orphanPaths: string[];
    };

export type RecordPhotoInput = {
  house: House;
  position: number;
  /** The mark's updated_at as the page received it (the raw PostgREST
   * string), or null when the page showed the square not done. */
  expectedUpdatedAt: string | null;
  /** The full JPEG, already resized in the browser. */
  photo: Uint8Array;
  thumb: Uint8Array;
};

export type PrepareVideoInput = {
  house: House;
  position: number;
  /**
   * The File's own type, `file.type`, as the browser reports it.
   *
   * 🪤 It must be that, not a type chosen anywhere else. Given a File or Blob,
   * uploadToSignedUrl sends FormData and IGNORES its contentType option, so the
   * stored object carries `file.type` whatever the call says. The path's
   * extension is minted from this value, and recordBingoVideo refuses an object
   * whose stored type is not its extension's.
   */
  contentType: string;
  /** The file's size in bytes. */
  size: number;
};

export type PrepareVideoResult =
  | Invalid
  | { status: "error" }
  | {
      status: "ready";
      /** In VIDEO_BUCKET. The browser uploads to exactly this path... */
      path: string;
      /** ...with uploadToSignedUrl and this token, then hands the path to
       * recordBingoVideo. Valid for the token's lifetime (ORPHAN_AGE_MS). */
      token: string;
      /** Abandoned uploads the sweep deleted from this square's folder. */
      sweptPaths: string[];
    };

export type RecordVideoInput = {
  house: House;
  position: number;
  expectedUpdatedAt: string | null;
  /** The path prepareBingoVideoUpload returned, as the browser hands it back. */
  videoPath: string;
  /** A JPEG poster frame, if the browser could make one. */
  poster?: Uint8Array | null;
};

export type RemoveProofInput = {
  markId: string;
  expectedUpdatedAt: string;
};

export type RemoveProofResult =
  /** No such mark: never existed, or another officer already removed it. */
  | { status: "not_found" }
  /** The mark was replaced since the page was rendered. */
  | { status: "conflict" }
  | { status: "error" }
  | {
      status: "removed";
      markId: string;
      before: AuditedMark;
      after: null;
      /** Files that could NOT be deleted, as `<bucket>/<path>`. */
      orphanPaths: string[];
    };

export type RenameActivityInput = {
  squareId: string;
  activity: string;
  expectedUpdatedAt: string;
};

export type RenameActivityResult =
  | { status: "invalid"; reason: "activity" }
  | { status: "not_found" }
  | { status: "conflict" }
  | { status: "error" }
  /** The text already reads that way. Nothing was written and nothing should
   * be audited; `updatedAt` is the current token. */
  | { status: "unchanged"; squareId: string; updatedAt: string }
  | {
      status: "renamed";
      squareId: string;
      updatedAt: string;
      before: AuditedSquare;
      after: AuditedSquare;
    };

const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

/**
 * Record a photo as one house's proof for one square.
 *
 * Checks both files (size, then the JPEG signature), compares the mark against
 * what the page showed, uploads the two files, then writes the row with a
 * compare-and-set: an insert when the page showed no mark (a racing insert's
 * 23505 is a conflict), an update keyed on the page's updated_at otherwise.
 * If the write fails, both uploads are deleted again. On a replace, the old
 * proof's files are deleted from whichever buckets they live in.
 */
export async function recordBingoPhoto(
  db: Client,
  input: RecordPhotoInput
): Promise<RecordProofResult> {
  try {
    if (!isHouse(input.house)) return invalid("house");
    if (!isActivityPosition(input.position)) return invalid("position");
    const photoProblem = jpegProblem(input.photo, MAX_PHOTO_BYTES);
    if (photoProblem) return invalid(photoProblem === "size" ? "photo_size" : "photo_type");
    const thumbProblem = jpegProblem(input.thumb, MAX_THUMB_BYTES);
    if (thumbProblem) return invalid(thumbProblem === "size" ? "thumb_size" : "thumb_type");
    const expected = expectedToken(input.expectedUpdatedAt);

    const squareId = await squareIdAt(db, input.position);
    if (squareId === null) return { status: "error" };
    const current = await readMark(db, input.house, squareId);
    if (current.kind === "error") return { status: "error" };
    // Checked before uploading so a stale screen costs no upload. The write
    // below is still a compare-and-set; this only saves the round trip.
    if (staleScreen(current.row, expected)) return { status: "conflict" };

    const paths = photoPaths(input.house, input.position, crypto.randomUUID());
    if (!(await uploadJpeg(db, paths.media, input.photo))) return { status: "error" };
    if (!(await uploadJpeg(db, paths.thumb, input.thumb))) {
      await deleteFiles(db, [{ bucket: PHOTO_BUCKET, path: paths.media }]);
      return { status: "error" };
    }

    const written = await writeMark(db, input.house, squareId, current.row, expected, {
      kind: "photo",
      media_path: paths.media,
      thumb_path: paths.thumb,
    });
    if (written.kind !== "ok") {
      // These two files are this request's own, so nothing else can be
      // pointing at them.
      await deleteFiles(db, [
        { bucket: PHOTO_BUCKET, path: paths.media },
        { bucket: PHOTO_BUCKET, path: paths.thumb },
      ]);
      return { status: written.kind };
    }

    return await finishRecord(db, current.row, written.row);
  } catch (e) {
    console.error("recordBingoPhoto failed:", e instanceof Error ? e.message : String(e));
    return { status: "error" };
  }
}

/**
 * Get a video upload ready: sweep the square's abandoned uploads, then mint a
 * signed upload token for ONE fresh path. Writes no row.
 *
 * The token is minted with the service role and without upsert, so the
 * browser can create that one object and nothing else, and cannot overwrite
 * it. The bucket enforces the type and the 50 MiB limit on the upload itself;
 * recordBingoVideo checks both again before recording.
 *
 * `now` is injectable, like the clock in lib/checkin.ts, so the sweep can be
 * tested without waiting two hours.
 */
export async function prepareBingoVideoUpload(
  db: Client,
  input: PrepareVideoInput,
  now: Date = new Date()
): Promise<PrepareVideoResult> {
  try {
    if (!isHouse(input.house)) return invalid("house");
    if (!isActivityPosition(input.position)) return invalid("position");
    if (!isVideoContentType(input.contentType)) return invalid("video_type");
    if (!Number.isInteger(input.size) || input.size <= 0 || input.size > MAX_VIDEO_BYTES) {
      return invalid("video_size");
    }

    const sweptPaths = await sweepVideoOrphans(db, input.house, input.position, now);

    const path = videoPath(input.house, input.position, crypto.randomUUID(), input.contentType);
    const { data, error } = await db.storage.from(VIDEO_BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      console.error("bingo video token failed:", error?.message ?? "no token");
      return { status: "error" };
    }

    return { status: "ready", path, token: data.token, sweptPaths };
  } catch (e) {
    console.error("prepareBingoVideoUpload failed:", e instanceof Error ? e.message : String(e));
    return { status: "error" };
  }
}

/**
 * Record an uploaded video as one house's proof for one square.
 *
 * The path comes back from the browser, so it is checked against THIS house
 * and position, and the object behind it is checked with info(): it must
 * exist, be within MAX_VIDEO_BYTES, and carry the type its extension stands
 * for. Then the optional poster is checked and uploaded, and the row is written
 * with the same compare-and-set as a photo.
 *
 * When it does not record, cleanup depends on why. A stale page, a refused
 * write, a failed poster upload, or a stored size or type that is PRESENT AND
 * WRONG deletes the video, but only if no mark points at it (a double-submitted
 * record whose twin already won has its video in the winner's row), along with
 * any poster this request uploaded. Anything else deletes nothing: a bad path,
 * a bad poster, nothing uploaded, a failed read, or an info() answer missing
 * its size or type, which is an error rather than evidence against the upload.
 * An abandoned video is the sweep's to collect.
 */
export async function recordBingoVideo(
  db: Client,
  input: RecordVideoInput
): Promise<RecordProofResult> {
  try {
    if (!isHouse(input.house)) return invalid("house");
    if (!isActivityPosition(input.position)) return invalid("position");
    const parsed = parseVideoPath(input.videoPath, input.house, input.position);
    if (!parsed) return invalid("video_path");
    const poster = input.poster ?? null;
    if (poster !== null) {
      const posterProblem = jpegProblem(poster, MAX_THUMB_BYTES);
      if (posterProblem) {
        return invalid(posterProblem === "size" ? "poster_size" : "poster_type");
      }
    }
    const expected = expectedToken(input.expectedUpdatedAt);

    const object = await db.storage.from(VIDEO_BUCKET).info(input.videoPath);
    if (object.error) {
      if (object.error.statusCode === "404" || object.error.status === 404) {
        return invalid("video_missing");
      }
      console.error("bingo video info failed:", object.error.message);
      return { status: "error" };
    }
    // 🪤 storage-js camel-cases the server's JSON and checks nothing, and the
    // Storage server sends `size` and `content_type` as null when it has no
    // value for them. A missing value says nothing about the upload, so it is
    // an error that deletes NOTHING: the officer can try again, and the sweep
    // collects the video if they give up.
    const { size, contentType } = object.data;
    if (typeof size !== "number" || typeof contentType !== "string") {
      console.error(
        `bingo video info for ${input.videoPath} lacks a size or a type:`,
        `size ${String(size)}, type ${String(contentType)}`
      );
      return { status: "error" };
    }
    // Present and wrong is another matter: the object can never be recorded,
    // so it goes. The bucket refuses an oversized upload, so the size check
    // fires only if its limit ever drifts from migration 33's, or on an empty
    // file. The type check is a live path, not a backstop: the bucket takes
    // either video type at either extension, and the stored type is the
    // File's own `file.type` (uploadToSignedUrl ignores its contentType
    // option), so a file the browser calls video/quicktime, uploaded to an
    // `.mp4` path, passes the bucket and is refused here.
    if (size <= 0 || size > MAX_VIDEO_BYTES) {
      await discardVideo(db, input.videoPath);
      return invalid("video_size");
    }
    if (contentType !== parsed.contentType) {
      await discardVideo(db, input.videoPath);
      return invalid("video_type");
    }

    const squareId = await squareIdAt(db, input.position);
    if (squareId === null) return { status: "error" };
    const current = await readMark(db, input.house, squareId);
    if (current.kind === "error") return { status: "error" };
    // A repeat of a record that already succeeded lands here too: its page
    // showed no mark. discardVideo finds the video in that mark and keeps it.
    if (staleScreen(current.row, expected)) {
      await discardVideo(db, input.videoPath);
      return { status: "conflict" };
    }
    // Replacing a mark with the file it already holds would delete that file
    // as the "old" proof. The UI never asks for it; a crafted request can.
    if (current.row?.media_path === input.videoPath) return invalid("video_path");

    let thumbPath: string | null = null;
    if (poster !== null) {
      thumbPath = posterPath(input.house, input.position, crypto.randomUUID());
      if (!(await uploadJpeg(db, thumbPath, poster))) {
        await discardVideo(db, input.videoPath);
        return { status: "error" };
      }
    }

    const written = await writeMark(db, input.house, squareId, current.row, expected, {
      kind: "video",
      media_path: input.videoPath,
      thumb_path: thumbPath,
    });
    if (written.kind !== "ok") {
      if (thumbPath !== null) {
        await deleteFiles(db, [{ bucket: PHOTO_BUCKET, path: thumbPath }]);
      }
      await discardVideo(db, input.videoPath);
      return { status: written.kind };
    }

    return await finishRecord(db, current.row, written.row);
  } catch (e) {
    console.error("recordBingoVideo failed:", e instanceof Error ? e.message : String(e));
    return { status: "error" };
  }
}

/**
 * Remove one mark's proof: the square goes back to not done for that house.
 *
 * A compare-and-set DELETE keyed on the page's updated_at, so a mark replaced
 * since the page was rendered is not removed from under the officer who
 * replaced it. Then its files are deleted; any that could not be are returned.
 */
export async function removeBingoProof(
  db: Client,
  input: RemoveProofInput
): Promise<RemoveProofResult> {
  try {
    if (typeof input.markId !== "string" || !ROW_ID.test(input.markId)) {
      return { status: "not_found" };
    }

    const { data: before, error } = await db
      .from("bingo_marks")
      .select(AUDITED_MARK_COLUMNS)
      .eq("id", input.markId)
      .maybeSingle();
    if (error) {
      console.error("removeBingoProof read failed:", error.message);
      return { status: "error" };
    }
    if (!before) return { status: "not_found" };
    if (before.updated_at !== input.expectedUpdatedAt) return { status: "conflict" };

    const { data: deleted, error: deleteError } = await db
      .from("bingo_marks")
      .delete()
      .eq("id", input.markId)
      // The raw PostgREST string, never a Date: a JS Date round trip truncates
      // microseconds and this would never match.
      .eq("updated_at", input.expectedUpdatedAt)
      .select("id");
    if (deleteError) {
      console.error("removeBingoProof delete failed:", deleteError.message);
      return { status: "error" };
    }
    if (deleted.length === 0) {
      // Someone moved between the read and the delete: a replace (the row is
      // still there) or a removal (it is not).
      const { data: still, error: stillError } = await db
        .from("bingo_marks")
        .select("id")
        .eq("id", input.markId)
        .maybeSingle();
      if (stillError) {
        console.error("removeBingoProof re-read failed:", stillError.message);
        return { status: "error" };
      }
      return still ? { status: "conflict" } : { status: "not_found" };
    }

    const orphanPaths = await deleteFiles(db, proofFiles(before));
    return {
      status: "removed",
      markId: before.id,
      before: withoutToken(before),
      after: null,
      orphanPaths,
    };
  } catch (e) {
    console.error("removeBingoProof failed:", e instanceof Error ? e.message : String(e));
    return { status: "error" };
  }
}

/**
 * Rename one activity. It shows on all four cards at once.
 *
 * Trimmed and bounded by normalizeActivity, then a compare-and-set UPDATE.
 * The same text writes nothing and returns `unchanged`; with a stale token it
 * is a conflict instead, because handing a stale screen the live token would
 * let its next save pass over an edit it never saw (the rule
 * app/actions/members.ts records).
 */
export async function renameBingoActivity(
  db: Client,
  input: RenameActivityInput
): Promise<RenameActivityResult> {
  try {
    if (typeof input.squareId !== "string" || !ROW_ID.test(input.squareId)) {
      return { status: "not_found" };
    }
    const activity = normalizeActivity(input.activity);
    if (activity === null) return { status: "invalid", reason: "activity" };

    const { data: before, error } = await db
      .from("bingo_squares")
      .select(AUDITED_SQUARE_COLUMNS)
      .eq("id", input.squareId)
      .maybeSingle();
    if (error) {
      console.error("renameBingoActivity read failed:", error.message);
      return { status: "error" };
    }
    if (!before) return { status: "not_found" };
    if (before.updated_at !== input.expectedUpdatedAt) return { status: "conflict" };
    if (before.activity === activity) {
      return { status: "unchanged", squareId: before.id, updatedAt: before.updated_at };
    }

    const { data: after, error: updateError } = await db
      .from("bingo_squares")
      .update({ activity })
      .eq("id", input.squareId)
      .eq("updated_at", input.expectedUpdatedAt)
      .select(AUDITED_SQUARE_COLUMNS)
      .maybeSingle();
    if (updateError) {
      if (updateError.code === CHECK_VIOLATION) return { status: "invalid", reason: "activity" };
      console.error("renameBingoActivity update failed:", updateError.message);
      return { status: "error" };
    }
    if (!after) return { status: "conflict" };

    return {
      status: "renamed",
      squareId: after.id,
      updatedAt: after.updated_at,
      before: withoutToken(before),
      after: withoutToken(after),
    };
  } catch (e) {
    console.error("renameBingoActivity failed:", e instanceof Error ? e.message : String(e));
    return { status: "error" };
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function invalid(reason: BingoInvalidReason): Invalid {
  return { status: "invalid", reason };
}

/** A form cannot post null, so an empty token means "the page showed no
 * mark", exactly as null does. */
function expectedToken(value: string | null | undefined): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function jpegProblem(bytes: unknown, max: number): "size" | "type" | null {
  if (!(bytes instanceof Uint8Array)) return "type";
  if (bytes.byteLength === 0 || bytes.byteLength > max) return "size";
  return isJpeg(bytes) ? null : "type";
}

/**
 * True when the mark is not what the page showed: it appeared (the page showed
 * none), vanished (the page showed one), or changed (its token moved). The two
 * tokens are compared as raw PostgREST strings.
 */
function staleScreen(row: MarkRow | null, expected: string | null): boolean {
  if (row === null) return expected !== null;
  return expected === null || row.updated_at !== expected;
}

/** The square at an activity position, or null when it cannot be read. */
async function squareIdAt(db: Client, position: number): Promise<string | null> {
  const { data, error } = await db
    .from("bingo_squares")
    .select("id")
    .eq("position", position)
    .maybeSingle();
  if (error || !data) {
    console.error(
      `bingo square ${position} read failed:`,
      error?.message ?? "no square at that position"
    );
    return null;
  }
  return data.id;
}

async function readMark(
  db: Client,
  house: House,
  squareId: string
): Promise<{ kind: "ok"; row: MarkRow | null } | { kind: "error" }> {
  const { data, error } = await db
    .from("bingo_marks")
    .select(AUDITED_MARK_COLUMNS)
    .eq("house", house)
    .eq("square_id", squareId)
    .maybeSingle();
  if (error) {
    console.error("bingo mark read failed:", error.message);
    return { kind: "error" };
  }
  return { kind: "ok", row: data };
}

/**
 * The compare-and-set write. No mark on the page: insert, and a racing
 * insert's 23505 on (house, square_id) is a conflict. A mark on the page:
 * update that row only while its updated_at still matches, and zero rows back
 * is a conflict. Both select the audited columns, so before and after match.
 */
async function writeMark(
  db: Client,
  house: House,
  squareId: string,
  current: MarkRow | null,
  expected: string | null,
  values: { kind: MarkKind; media_path: string; thumb_path: string | null }
): Promise<{ kind: "ok"; row: MarkRow } | { kind: "conflict" } | { kind: "error" }> {
  if (current === null) {
    const { data, error } = await db
      .from("bingo_marks")
      .insert({ house, square_id: squareId, ...values })
      .select(AUDITED_MARK_COLUMNS)
      .single();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) return { kind: "conflict" };
      console.error("bingo mark insert failed:", error.message);
      return { kind: "error" };
    }
    return { kind: "ok", row: data };
  }

  // The caller has already refused this, but a null token can match no row.
  if (expected === null) return { kind: "conflict" };
  const { data, error } = await db
    .from("bingo_marks")
    .update(values)
    .eq("id", current.id)
    // The raw PostgREST string, never a Date: a JS Date round trip truncates
    // microseconds, and this compare-and-set would then never match.
    .eq("updated_at", expected)
    .select(AUDITED_MARK_COLUMNS)
    .maybeSingle();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { kind: "conflict" };
    console.error("bingo mark update failed:", error.message);
    return { kind: "error" };
  }
  return data ? { kind: "ok", row: data } : { kind: "conflict" };
}

/** After a successful write: delete a replaced mark's old files, then build
 * the result the caller audits from. */
async function finishRecord(
  db: Client,
  before: MarkRow | null,
  after: MarkRow
): Promise<RecordProofResult> {
  if (before === null) {
    return {
      status: "added",
      markId: after.id,
      updatedAt: after.updated_at,
      before: null,
      after: withoutToken(after),
      orphanPaths: [],
    };
  }
  // Never delete a file the new row holds, whatever the old row says.
  const keep = new Set(proofFiles(after).map(fileKey));
  const orphanPaths = await deleteFiles(
    db,
    proofFiles(before).filter((file) => !keep.has(fileKey(file)))
  );
  return {
    status: "replaced",
    markId: after.id,
    updatedAt: after.updated_at,
    before: withoutToken(before),
    after: withoutToken(after),
    orphanPaths,
  };
}

type StoredFile = { bucket: BingoBucket; path: string };

function fileKey(file: StoredFile): string {
  return `${file.bucket}/${file.path}`;
}

/** Every file a mark holds, each in the bucket it lives in: a video's media in
 * VIDEO_BUCKET, everything else (photos, thumbnails, posters) in PHOTO_BUCKET. */
function proofFiles(mark: MarkRow): StoredFile[] {
  const files: StoredFile[] = [
    { bucket: mark.kind === "video" ? VIDEO_BUCKET : PHOTO_BUCKET, path: mark.media_path },
  ];
  if (mark.thumb_path !== null) files.push({ bucket: PHOTO_BUCKET, path: mark.thumb_path });
  return files;
}

async function uploadJpeg(db: Client, path: string, bytes: Uint8Array): Promise<boolean> {
  const { error } = await db.storage.from(PHOTO_BUCKET).upload(path, bytes, {
    contentType: PHOTO_CONTENT_TYPE,
    cacheControl: UPLOAD_CACHE_CONTROL,
    upsert: false,
  });
  if (error) {
    console.error(`bingo upload of ${path} failed:`, error.message);
    return false;
  }
  return true;
}

/**
 * Delete files, bucket by bucket. Returns the ones that could not be deleted,
 * as `<bucket>/<path>`, and never throws: by the time this runs the database
 * already says what is true, and a leftover file is a cost, not a lie.
 */
async function deleteFiles(db: Client, files: StoredFile[]): Promise<string[]> {
  const orphans: string[] = [];
  for (const bucket of [PHOTO_BUCKET, VIDEO_BUCKET] as const) {
    const paths = files.filter((file) => file.bucket === bucket).map((file) => file.path);
    if (paths.length === 0) continue;
    try {
      const { error } = await db.storage.from(bucket).remove(paths);
      if (error) {
        console.error(`bingo delete from ${bucket} failed:`, error.message);
        orphans.push(...paths.map((path) => `${bucket}/${path}`));
      }
    } catch (e) {
      console.error(
        `bingo delete from ${bucket} failed:`,
        e instanceof Error ? e.message : String(e)
      );
      orphans.push(...paths.map((path) => `${bucket}/${path}`));
    }
  }
  return orphans;
}

/**
 * Delete an uploaded video that will not be recorded, unless a mark points at
 * it. When the check itself fails the video stays, and the sweep decides later.
 *
 * ⚠️ One race remains, and it is accepted: two copies of one record request in
 * flight together, where one fails for a transient reason before its twin has
 * written. Its check finds no mark yet and deletes a video the twin is about to
 * record. The result is a mark whose video is gone, which the officer sees and
 * replaces.
 */
async function discardVideo(db: Client, path: string): Promise<void> {
  const { data, error } = await db
    .from("bingo_marks")
    .select("id")
    .eq("media_path", path)
    .limit(1);
  if (error) {
    console.error("bingo video reference check failed:", error.message);
    return;
  }
  if (data.length > 0) return;
  await deleteFiles(db, [{ bucket: VIDEO_BUCKET, path }]);
}

/** Objects per listing page, and the most pages one sweep reads. A square's
 * folder holds a handful; the bound is there so a sweep cannot run away. */
const SWEEP_PAGE = 100;
const SWEEP_MAX_PAGES = 10;

/**
 * Delete this square's abandoned video uploads: objects in its folder older
 * than ORPHAN_AGE_MS that no mark references. Best effort, and never blocks
 * the upload it runs before: any failure is logged and sweeps nothing.
 *
 * Only names parseVideoPath accepts for this square are candidates, and the
 * references are read for the whole folder at once, so the query stays one
 * short request however many objects there are.
 */
async function sweepVideoOrphans(
  db: Client,
  house: House,
  position: number,
  now: Date
): Promise<string[]> {
  const folder = squareFolder(house, position);
  try {
    const old: string[] = [];
    for (let page = 0; page < SWEEP_MAX_PAGES; page++) {
      const { data, error } = await db.storage.from(VIDEO_BUCKET).list(folder, {
        limit: SWEEP_PAGE,
        offset: page * SWEEP_PAGE,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) {
        console.error("bingo sweep listing failed:", error.message);
        return [];
      }
      for (const object of data) {
        // A folder entry has no id and no timestamps.
        if (object.id === null || object.created_at === null) continue;
        const path = `${folder}/${object.name}`;
        if (!parseVideoPath(path, house, position)) continue;
        const created = Date.parse(object.created_at);
        if (Number.isNaN(created) || now.getTime() - created <= ORPHAN_AGE_MS) continue;
        old.push(path);
      }
      if (data.length < SWEEP_PAGE) break;
    }
    if (old.length === 0) return [];

    // Every mark whose media sits in this folder. The folder name holds no
    // LIKE wildcard: a lowercase letter, a slash and digits.
    const { data: refs, error: refError } = await db
      .from("bingo_marks")
      .select("media_path")
      .like("media_path", `${folder}/%`);
    if (refError) {
      console.error("bingo sweep reference read failed:", refError.message);
      return [];
    }
    const referenced = new Set(refs.map((ref) => ref.media_path));
    const orphans = old.filter((path) => !referenced.has(path));
    if (orphans.length === 0) return [];

    const failed = new Set(
      await deleteFiles(
        db,
        orphans.map((path) => ({ bucket: VIDEO_BUCKET, path }))
      )
    );
    return orphans.filter((path) => !failed.has(`${VIDEO_BUCKET}/${path}`));
  } catch (e) {
    console.error("bingo sweep failed:", e instanceof Error ? e.message : String(e));
    return [];
  }
}

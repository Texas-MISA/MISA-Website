"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";

import {
  prepareBingoVideoUpload,
  type PrepareVideoUploadResult,
} from "@/app/actions/bingo";
import {
  isVideoContentType,
  MAX_PHOTO_BYTES,
  MAX_THUMB_BYTES,
  MAX_VIDEO_BYTES,
  PHOTO_CONTENT_TYPE,
  PHOTO_LONG_EDGE,
  scaledDimensions,
  THUMB_LONG_EDGE,
  UPLOAD_CACHE_CONTROL,
  VIDEO_BUCKET,
  VIDEO_CONTENT_TYPES,
  VIDEO_EXTENSIONS,
  type BingoInvalidReason,
} from "@/lib/bingo";
import { createClient } from "@/lib/supabase/client";

import { Banner } from "@/components/ui/banner";
import { buttonClass } from "@/components/ui/button";
import { controlClass, Field } from "@/components/ui/field";

// The proof uploader: one photo or one video for one house's square.
//
// A PHOTO never leaves this device at full size. It is decoded and resized in
// one step by createImageBitmap, re-encoded as a JPEG (which also strips its
// EXIF, GPS included, and must keep doing so), and posted with a thumbnail to
// the officer-only Route Handler at /admin/bingo/upload, which stores both
// with the service role.
//
// A VIDEO is too big for a function body, so:
//   1. prepareBingoVideoUpload (an officer-only Server Action) mints a signed
//      upload token for one fresh path;
//   2. this browser uploads the file there with the anon key — 🔓 the ONE
//      client-side write in this codebase (user's decision, 2026-10-10), and
//      lib/supabase/client.ts's one importer;
//   3. the Route Handler checks the object and records it.
//
// Officers use this on their phones straight after an activity, which is what
// most of the care below is for:
//
// 🪤 Never draw a full-size photo onto a canvas. Safari caps a canvas at
//    16.7 MP, under a 24 MP phone photo. Every canvas here is the TARGET size.
// 🪤 JPEG, never WebP: Safari cannot encode WebP and silently hands back a
//    PNG instead.
// 🪤 The input's `accept` lists image/jpeg FIRST and leaves HEIC out, which
//    is what makes iOS hand over a JPEG for a HEIC photo.
// 🪤 A video's stored type is the File's own `file.type`: uploadToSignedUrl
//    sends a File as FormData and ignores its contentType option. So an empty
//    type is filled in from the extension by re-wrapping the File, before the
//    path (whose extension comes from that type) is minted.

const UPLOAD_ROUTE = "/admin/bingo/upload";

/** JPEG first and no HEIC — see the header. */
const ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime";

const PHOTO_QUALITY = 0.85;
const THUMB_QUALITY = 0.8;
/** How far the quality drops for the one retry when a JPEG is over its cap. */
const RETRY_QUALITY_DROP = 0.2;

/** Where the poster frame is taken from, and how long to try. */
const POSTER_AT_SECONDS = 0.5;
const POSTER_TIMEOUT_MS = 5000;

/** Extensions read as a photo when the browser reports no type at all. */
const PHOTO_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);

type Step = "preparing" | "uploading" | "saving";

const STEP_TEXT: Record<Step, string> = {
  preparing: "Preparing…",
  uploading: "Uploading video… this can take a minute on mobile data",
  saving: "Saving…",
};

const CANT_OPEN_PHOTO =
  "This browser can't open that photo. Upload it from your phone, or save it as a JPEG first.";
const CANT_ENCODE_PHOTO =
  "This browser couldn't turn that photo into a JPEG. Try another browser, or save it as a JPEG first.";
const NOT_PROOF =
  "That isn't a file this page takes. Choose a JPEG, PNG or WebP photo, or an MP4 or MOV video.";
const VIDEO_TOO_BIG = "Videos must be under 50 MB. Trim it and try again.";
const VIDEO_TYPE = "Videos must be MP4 or MOV.";
const SESSION_EXPIRED =
  "Your session has expired. Sign in again, then try once more.";
const STALE = "Someone else just changed this square. Reload to see it.";
const STORAGE_FULL =
  "Storage is full, so nothing more can be uploaded until space is freed. Tell whoever looks after the website.";
const OFFLINE =
  "The upload couldn't reach the server. Check your connection and try again.";
const FAILED = "Something went wrong and nothing was saved. Try again.";

/** Every refusal a write core can give, in words. A Record, so a reason added
 * to lib/bingo.ts without a sentence here is a type error. */
const REASON_MESSAGES: Record<BingoInvalidReason, string> = {
  house:
    "This page's house isn't one of the four. Go back to the card and open the square again.",
  position:
    "This page's square isn't on the card. Go back to the card and open it again.",
  photo_size: "The resized photo is still over 3 MB. Try a different photo.",
  photo_type: CANT_ENCODE_PHOTO,
  thumb_size: "The photo's preview came out too large. Try a different photo.",
  thumb_type: CANT_ENCODE_PHOTO,
  video_type: VIDEO_TYPE,
  video_size: VIDEO_TOO_BIG,
  video_path:
    "The upload didn't match this square. Reload the page and try again.",
  video_missing: "The video didn't finish uploading. Try again.",
  poster_size: "The video's preview image came out too large. Try again.",
  poster_type: "The video's preview image wasn't a JPEG. Try again.",
  activity: "That activity name can't be saved.",
};

export type ProofUploaded = "added" | "replaced";

type Failure = { ok: false; message: string };
type Outcome = { ok: true; status: ProofUploaded } | Failure;
type Target = { house: string; position: number; expectedUpdatedAt: string };
type Size = { width: number; height: number };

export function ProofForm({
  house,
  position,
  expectedUpdatedAt,
  mode,
  onUploaded,
  onCancel,
}: {
  /** The house's slug, `m`. */
  house: string;
  position: number;
  /**
   * The mark's updated_at as the page rendered it — the raw PostgREST string,
   * never round-tripped through a Date — or "" when the square is not done.
   */
  expectedUpdatedAt: string;
  mode: "upload" | "replace";
  /** Called once the proof is recorded, before the page refreshes. */
  onUploaded: (status: ProofUploaded) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [error, setError] = useState<string | null>(null);
  const working = step !== null;
  // 🪤 Until React has hydrated this form it is plain HTML, and Upload would
  // submit it natively: a GET of this page with the file's NAME in the query
  // string, which reloads and drops the chosen file. The page sits in a
  // Suspense boundary (loading.tsx), so on a slow phone that window is real.
  // false on the server and through hydration, true after; no effect needed.
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  );

  // Leaving mid-upload loses the upload (an orphaned video is swept later, but
  // the officer would have to start again), so the browser is asked to warn.
  // beforeunload opens nothing itself; it is the only hook a tab close has.
  useEffect(() => {
    if (!working) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [working]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;
    const form = event.currentTarget;
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a photo or a video first.");
      return;
    }
    setError(null);

    const target: Target = { house, position, expectedUpdatedAt };
    let outcome: Outcome;
    try {
      const kind = kindOf(file);
      outcome =
        kind === "photo"
          ? await sendPhoto(file, target, setStep)
          : kind === "video"
            ? await sendVideo(file, target, setStep)
            : fail(NOT_PROOF);
    } catch (e) {
      console.error("bingo proof upload failed:", e);
      outcome = fail(FAILED);
    }
    setStep(null);

    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }
    form.reset();
    onUploaded(outcome.status);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field
        label={mode === "replace" ? "New photo or video" : "Photo or video"}
        hint="A photo is resized on this device before it uploads. A video uploads as it is, up to 50 MB."
      >
        <input
          ref={inputRef}
          type="file"
          name="proof"
          accept={ACCEPT}
          disabled={working}
          onChange={() => setError(null)}
          className={controlClass(
            "md",
            "w-full file:mr-3 file:cursor-pointer file:border file:border-misa-border file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-misa-secondary"
          )}
        />
      </Field>

      {error && <Banner tone="critical">{error}</Banner>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={working || !hydrated}
          className={buttonClass()}
        >
          {mode === "replace" ? "Replace" : "Upload"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={working}
            className={buttonClass({ variant: "quiet" })}
          >
            Cancel
          </button>
        )}
        {/* Visible, because a disabled button says nothing about why. */}
        {step && (
          <span className="text-sm text-misa-secondary">{STEP_TEXT[step]}</span>
        )}
      </div>

      {/* 🪤 Mounted before anything is said, as a live region must be: a node
          that mounts already holding its text is not announced. `sr-only` is
          absolutely positioned, so it adds no gap to this column. */}
      <p role="status" className="sr-only">
        {step ? STEP_TEXT[step] : (error ?? "")}
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------------
// A photo
// ---------------------------------------------------------------------------

async function sendPhoto(
  file: File,
  target: Target,
  setStep: (step: Step) => void
): Promise<Outcome> {
  setStep("preparing");
  const resized = await resizePhoto(file);
  if (!resized.ok) return resized;

  const body = targetFields("photo", target);
  body.set("photo", resized.photo, "photo.jpg");
  body.set("thumb", resized.thumb, "thumb.jpg");

  setStep("saving");
  return record(body);
}

async function resizePhoto(
  file: File
): Promise<{ ok: true; photo: Blob; thumb: Blob } | Failure> {
  const url = URL.createObjectURL(file);
  try {
    // The size, read off an <img>, which reports it after EXIF orientation is
    // applied (as createImageBitmap's "from-image" applies it) and decodes
    // only as much as it must. An image this browser cannot decode at all —
    // HEIC in Chrome — fails here.
    const img = await loadImage(url);
    if (img === null) return fail(CANT_OPEN_PHOTO);
    const full = scaledDimensions(img.naturalWidth, img.naturalHeight, PHOTO_LONG_EDGE);
    const small = scaledDimensions(img.naturalWidth, img.naturalHeight, THUMB_LONG_EDGE);
    if (full === null || small === null) return fail(CANT_OPEN_PHOTO);

    // Decoded and resized in ONE step, so the full-size picture never lands
    // on a canvas. A browser without the resize options hands back the full
    // bitmap, and the target-sized canvas below scales it instead. With no
    // createImageBitmap at all, the <img> is the source.
    const bitmap = await resizedBitmap(file, full);
    const source: CanvasImageSource = bitmap ?? img;
    try {
      const photo = await encodeJpeg(source, full, PHOTO_QUALITY, MAX_PHOTO_BYTES);
      if (!photo.ok) {
        return fail(photo.reason === "size" ? REASON_MESSAGES.photo_size : CANT_ENCODE_PHOTO);
      }
      // The thumbnail the same way, from the already-resized picture.
      const thumbBitmap = bitmap ? await resizedBitmap(bitmap, small) : null;
      try {
        const thumb = await encodeJpeg(
          thumbBitmap ?? source,
          small,
          THUMB_QUALITY,
          MAX_THUMB_BYTES
        );
        if (!thumb.ok) {
          return fail(thumb.reason === "size" ? REASON_MESSAGES.thumb_size : CANT_ENCODE_PHOTO);
        }
        return { ok: true, photo: photo.blob, thumb: thumb.blob };
      } finally {
        thumbBitmap?.close();
      }
    } finally {
      bitmap?.close();
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = document.createElement("img");
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function resizedBitmap(
  source: ImageBitmapSource,
  size: Size
): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    return await createImageBitmap(source, {
      resizeWidth: size.width,
      resizeHeight: size.height,
      resizeQuality: "high",
      imageOrientation: "from-image",
    });
  } catch {
    return null;
  }
}

/**
 * Draw `source` onto a canvas of exactly `size` and encode it as a JPEG,
 * lowering the quality once if the result is over `max`.
 */
async function encodeJpeg(
  source: CanvasImageSource,
  size: Size,
  quality: number,
  max: number
): Promise<{ ok: true; blob: Blob } | { ok: false; reason: "encode" | "size" }> {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  try {
    const context = canvas.getContext("2d");
    if (context === null) return { ok: false, reason: "encode" };
    // White under the picture: a JPEG has no alpha, and a transparent PNG
    // would otherwise come out with a black background.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, size.width, size.height);

    for (const attempt of [quality, quality - RETRY_QUALITY_DROP]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, PHOTO_CONTENT_TYPE, attempt)
      );
      // A browser that cannot make a JPEG answers with a PNG, not an error.
      if (blob === null || blob.type !== PHOTO_CONTENT_TYPE) {
        return { ok: false, reason: "encode" };
      }
      if (blob.size <= max) return { ok: true, blob };
    }
    return { ok: false, reason: "size" };
  } finally {
    // iOS Safari holds a canvas's memory until it is resized away.
    canvas.width = 0;
    canvas.height = 0;
  }
}

// ---------------------------------------------------------------------------
// A video
// ---------------------------------------------------------------------------

async function sendVideo(
  file: File,
  target: Target,
  setStep: (step: Step) => void
): Promise<Outcome> {
  const video = withVideoType(file);
  if (video === null) return fail(VIDEO_TYPE);
  if (video.size === 0) return fail("That video is empty. Choose it again.");
  if (video.size > MAX_VIDEO_BYTES) return fail(VIDEO_TOO_BIG);

  setStep("preparing");
  const poster = await capturePoster(video);

  let ticket: PrepareVideoUploadResult;
  try {
    ticket = await prepareBingoVideoUpload({
      house: target.house,
      position: target.position,
      contentType: video.type,
      size: video.size,
    });
  } catch {
    // 🪤 With no session, proxy.ts redirects the action's POST to the login
    // page, and the call THROWS rather than answering `unauthorized` (which
    // only a signed-in non-officer gets). Ask which it was before blaming the
    // connection, or a signed-out officer is told to check their signal.
    return fail((await signedOut()) ? SESSION_EXPIRED : OFFLINE);
  }
  if (ticket.status === "unauthorized") return fail(SESSION_EXPIRED);
  if (ticket.status === "invalid") return fail(REASON_MESSAGES[ticket.reason]);
  if (ticket.status === "error") {
    return fail("Couldn't get the upload ready. Try again.");
  }

  setStep("uploading");
  try {
    // 🔓 THE ONE BROWSER WRITE: this file's bytes, to the one path the token
    // names. The anon-key client; the token alone authorises it.
    const { error } = await createClient()
      .storage.from(VIDEO_BUCKET)
      .uploadToSignedUrl(ticket.path, ticket.token, video, {
        cacheControl: UPLOAD_CACHE_CONTROL,
      });
    if (error) return fail(storageMessage(error));
  } catch {
    return fail(OFFLINE);
  }

  setStep("saving");
  const body = targetFields("video", target);
  body.set("videoPath", ticket.path);
  if (poster !== null) body.set("poster", poster, "poster.jpg");
  return record(body);
}

/**
 * The file with a type the bucket takes, or null. A browser that reports no
 * type gets one from the extension, re-wrapped into a new File because that
 * type is what Storage will record.
 */
function withVideoType(file: File): File | null {
  if (isVideoContentType(file.type)) return file;
  if (file.type !== "") return null;
  const extension = extensionOf(file.name);
  const type = VIDEO_CONTENT_TYPES.find((t) => VIDEO_EXTENSIONS[t] === extension);
  return type === undefined ? null : new File([file], file.name, { type });
}

/**
 * One frame, about half a second in, as a THUMB_LONG_EDGE JPEG — or null.
 *
 * Best effort and bounded: a video this browser cannot decode (HEVC in Chrome
 * on Windows) errors or never seeks, and after POSTER_TIMEOUT_MS the upload
 * goes ahead without one.
 */
async function capturePoster(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  // Older iOS Safari reads the attribute rather than the property.
  video.setAttribute("playsinline", "");
  video.preload = "auto";
  let timer: number | undefined;
  try {
    const seeked = new Promise<void>((resolve, reject) => {
      video.addEventListener("error", () => reject(new Error("decode")), {
        once: true,
      });
      video.addEventListener(
        "loadedmetadata",
        () => {
          const duration = video.duration;
          video.currentTime =
            Number.isFinite(duration) && duration > 0
              ? Math.min(POSTER_AT_SECONDS, duration / 2)
              : POSTER_AT_SECONDS;
        },
        { once: true }
      );
      video.addEventListener("seeked", () => resolve(), { once: true });
    });
    const timeout = new Promise<never>((_, reject) => {
      timer = window.setTimeout(
        () => reject(new Error("timeout")),
        POSTER_TIMEOUT_MS
      );
    });
    video.src = url;
    await Promise.race([seeked, timeout]);

    const size = scaledDimensions(video.videoWidth, video.videoHeight, THUMB_LONG_EDGE);
    if (size === null) return null;
    const poster = await encodeJpeg(video, size, THUMB_QUALITY, MAX_THUMB_BYTES);
    return poster.ok ? poster.blob : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

/** What a Storage refusal means to the officer. */
function storageMessage(error: Error): string {
  const { status, statusCode } = error as Error & {
    status?: unknown;
    statusCode?: unknown;
  };
  const code = Number(status ?? statusCode);
  const text = error.message.toLowerCase();
  if (code === 413 || text.includes("maximum allowed size")) return VIDEO_TOO_BIG;
  if (code === 415 || text.includes("mime type")) return VIDEO_TYPE;
  // ⚠️ Unverified wording: the local stack has no quota to exceed, so this
  // matches what a full project plausibly answers rather than a captured
  // response.
  if (
    code === 507 ||
    /quota|storage (is )?full|insufficient storage|storage limit/.test(text)
  ) {
    return STORAGE_FULL;
  }
  return "The video didn't upload. Check your connection and try again.";
}

// ---------------------------------------------------------------------------
// Recording it
// ---------------------------------------------------------------------------

function targetFields(kind: "photo" | "video", target: Target): FormData {
  const body = new FormData();
  body.set("kind", kind);
  body.set("house", target.house);
  body.set("position", String(target.position));
  body.set("expectedUpdatedAt", target.expectedUpdatedAt);
  return body;
}

async function record(body: FormData): Promise<Outcome> {
  let response: Response;
  try {
    // `manual`: with no session, proxy.ts answers with a redirect to the login
    // page, and following it would send the whole upload there as well.
    response = await fetch(UPLOAD_ROUTE, {
      method: "POST",
      body,
      redirect: "manual",
    });
  } catch {
    return fail(OFFLINE);
  }
  if (response.type === "opaqueredirect") return fail(SESSION_EXPIRED);

  let reply: { status?: unknown; reason?: unknown } | null = null;
  try {
    const parsed: unknown = await response.json();
    if (typeof parsed === "object" && parsed !== null) reply = parsed;
  } catch {
    // Not JSON: something other than the Route Handler answered.
  }
  if (reply === null) return fail(FAILED);

  switch (reply.status) {
    case "added":
    case "replaced":
      return { ok: true, status: reply.status };
    case "invalid":
      return fail(
        reasonMessage(reply.reason) ??
          "The upload was refused. Reload the page and try again."
      );
    case "conflict":
      return fail(STALE);
    case "unauthorized":
      return fail(SESSION_EXPIRED);
    case "forbidden":
      return fail(
        "The upload was refused because it didn't come from this page. Reload it and try again."
      );
    case "too_large":
      return fail("That upload is too large to send. Try a smaller photo.");
    default:
      return fail(FAILED);
  }
}

/**
 * Whether the session is gone. proxy.ts answers any /admin request without one
 * with a redirect to the login page, which `manual` surfaces as an opaque
 * redirect; signed in, a GET here is a harmless 405 from the Route Handler.
 */
async function signedOut(): Promise<boolean> {
  try {
    const response = await fetch(UPLOAD_ROUTE, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
    });
    return response.type === "opaqueredirect";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------

/** useSyncExternalStore's subscription, for a value that never changes once
 * the client has it. */
function subscribeToNothing(): () => void {
  return () => {};
}

function fail(message: string): Failure {
  return { ok: false, message };
}

function reasonMessage(reason: unknown): string | null {
  return typeof reason === "string" &&
    Object.prototype.hasOwnProperty.call(REASON_MESSAGES, reason)
    ? REASON_MESSAGES[reason as BingoInvalidReason]
    : null;
}

function kindOf(file: File): "photo" | "video" | null {
  if (file.type.startsWith("image/")) return "photo";
  if (file.type.startsWith("video/")) return "video";
  if (file.type !== "") return null;
  const extension = extensionOf(file.name);
  if (PHOTO_EXTENSIONS.has(extension)) return "photo";
  if (VIDEO_CONTENT_TYPES.some((type) => VIDEO_EXTENSIONS[type] === extension)) {
    return "video";
  }
  return null;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

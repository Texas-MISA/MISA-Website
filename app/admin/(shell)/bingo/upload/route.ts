import { revalidatePath } from "next/cache";

import { writeAudit } from "@/app/actions/audit";
import { getOfficer } from "@/lib/auth";
import {
  houseSlug,
  MAX_UPLOAD_REQUEST_BYTES,
  recordBingoPhoto,
  recordBingoVideo,
  type BingoInvalidReason,
} from "@/lib/bingo";
import { createAdminClient } from "@/lib/supabase/admin";
import { bingoUploadSchema } from "@/lib/validation";

// Recording house bingo proof (migration 33): a photo, or a video the browser
// has already uploaded with a signed token. A Route Handler rather than a
// Server Action because an action's body is capped at 1 MB, and a resized
// photo is up to 3 MiB.
//
// The request is multipart FormData:
//
//   kind=photo  house, position, expectedUpdatedAt, photo (JPEG), thumb (JPEG)
//   kind=video  house, position, expectedUpdatedAt, videoPath, poster? (JPEG)
//
// `house` is the slug (`m`), `position` 0–24 except 12, and
// `expectedUpdatedAt` the mark's raw updated_at as the page rendered it, or ""
// when the page showed the square not done. The answer is JSON,
// `{ status, reason?, updatedAt? }`:
//
//   200 added | replaced (with updatedAt)   400 invalid (with reason when the
//   403 unauthorized | forbidden                 write core refused a value)
//   413 too_large                           409 conflict      500 error
//
// ⚠️ It opens with getOfficer() and returns 403, NEVER requireOfficer() — the
// same rule app/admin/(shell)/members/export/route.ts records: a redirect to
// the login page is the wrong answer to a fetch, which would follow it and
// parse the login page as JSON.
//
// ⚠️ Route Handlers do NOT run layouts, so app/admin/(shell)/layout.tsx and
// its requireOfficer() do not run here. Sitting inside the (shell) group is
// colocation with the square page, nothing more. proxy.ts's `/admin/:path*`
// matcher does redirect a request with no session before it gets here, but
// that is a convenience, not the boundary: the 403 below is what refuses a
// signed-in user with no admin_profiles row, and what survives a matcher
// change. Both are required; neither substitutes for the other.
//
// 🔓 A SAME-ORIGIN CHECK, because the framework makes none here. Server
// Actions compare Origin with Host for us; a Route Handler acting on a cookie
// session does not. SameSite=Lax on the session cookie already keeps it off a
// cross-site POST, so this is the second check, and the one that does not rest
// on a cookie attribute. A browser always sends Origin on a POST.
//
// 🪤 Locally, request.url's origin is the dev server's own
// (http://localhost:3000), whatever host the browser used, so a page opened at
// http://127.0.0.1:3000 is refused as forbidden. On Vercel it is built from the
// Host header and matches.

// getOfficer reads cookies, so this could never be static anyway. Stated so
// a change to Route Handler caching cannot quietly make it so.
export const dynamic = "force-dynamic";

const BOARD = "/admin/bingo";

type Reply =
  | {
      status:
        | "unauthorized"
        | "forbidden"
        | "too_large"
        | "invalid"
        | "conflict"
        | "error";
      reason?: BingoInvalidReason;
    }
  | { status: "added" | "replaced"; updatedAt: string };

function reply(body: Reply, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: Request): Promise<Response> {
  const officer = await getOfficer();
  if (!officer) return reply({ status: "unauthorized" }, 403);

  const origin = request.headers.get("origin");
  if (origin === null || origin !== new URL(request.url).origin) {
    return reply({ status: "forbidden" }, 403);
  }

  // 📌 Refused BEFORE the body is read. proxy.ts matches this path, and Next
  // buffers a proxied request body only up to proxyClientMaxBodySize (10 MB by
  // default), silently truncating past it. MAX_UPLOAD_REQUEST_BYTES (4 MiB)
  // sits under both that and Vercel's 4.5 MB function limit, and a request
  // within the photo and thumbnail caps always fits inside it.
  const declared = request.headers.get("content-length");
  if (
    declared === null ||
    !/^\d+$/.test(declared) ||
    Number(declared) > MAX_UPLOAD_REQUEST_BYTES
  ) {
    return reply({ status: "too_large" }, 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply({ status: "invalid" }, 400);
  }

  try {
    const parsed = bingoUploadSchema.safeParse({
      kind: form.get("kind"),
      house: form.get("house"),
      position: form.get("position"),
      expectedUpdatedAt: form.get("expectedUpdatedAt"),
      photo: form.get("photo"),
      thumb: form.get("thumb"),
      videoPath: form.get("videoPath"),
      // Optional, and FormData answers null for a missing field where the
      // schema's optional() means undefined.
      poster: form.get("poster") ?? undefined,
    });
    if (!parsed.success) return reply({ status: "invalid" }, 400);
    const fields = parsed.data;

    const db = createAdminClient();
    const result =
      fields.kind === "photo"
        ? await recordBingoPhoto(db, {
            house: fields.house,
            position: fields.position,
            expectedUpdatedAt: fields.expectedUpdatedAt,
            photo: await bytesOf(fields.photo),
            thumb: await bytesOf(fields.thumb),
          })
        : await recordBingoVideo(db, {
            house: fields.house,
            position: fields.position,
            expectedUpdatedAt: fields.expectedUpdatedAt,
            videoPath: fields.videoPath,
            poster: fields.poster ? await bytesOf(fields.poster) : null,
          });

    switch (result.status) {
      case "added":
      case "replaced":
        await writeAudit(db, {
          entityType: "bingo_mark",
          entityId: result.markId,
          actorId: officer.userId,
          action:
            result.status === "added"
              ? "bingo_mark.added"
              : "bingo_mark.replaced",
          before: result.before,
          after: result.after,
          note:
            result.orphanPaths.length > 0
              ? `Files not deleted: ${result.orphanPaths.join(", ")}`
              : null,
        });
        revalidatePath(BOARD);
        revalidatePath(`${BOARD}/${houseSlug(fields.house)}/${fields.position}`);
        return reply({ status: result.status, updatedAt: result.updatedAt }, 200);
      case "invalid":
        return reply({ status: "invalid", reason: result.reason }, 400);
      case "conflict":
        return reply({ status: "conflict" }, 409);
      case "error":
        return reply({ status: "error" }, 500);
    }
  } catch (e) {
    console.error(
      "bingo upload failed:",
      e instanceof Error ? e.message : String(e)
    );
    return reply({ status: "error" }, 500);
  }
}

async function bytesOf(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/app/actions/audit";
import { getOfficer } from "@/lib/auth";
import {
  declaredLengthWithin,
  houseSlug,
  isSameOriginRequest,
  MAX_UPLOAD_REQUEST_BYTES,
  readBodyWithin,
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
//   413 too_large (declared or counted)     409 conflict      500 error
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
// 🔓 A SAME-ORIGIN CHECK, because the framework makes none here. Next checks
// Origin before every Server Action; it does not for a Route Handler acting
// on a cookie session. SameSite=Lax on the session cookie already keeps it off
// a cross-site POST, so this is the second check, and the one that does not
// rest on a cookie attribute.
//
// It rests on headers, never on request.url, and is Next's own comparison:
// Origin's host against the first x-forwarded-host value, else Host
// (isSameOriginRequest in lib/bingo.ts, which cites the Next source). This app
// sets no serverActions.allowedOrigins, so it accepts what the site's Server
// Actions accept, except a request with no Origin at all, which Next lets
// through and this refuses. Next's server fills a missing x-forwarded-host from
// Host (base-server.js), so locally localhost, 127.0.0.1 and a LAN address
// all pass.
//
// 📌 THE BODY IS COUNTED, NOT TRUSTED. A Content-Length that is malformed or
// over MAX_UPLOAD_REQUEST_BYTES is refused before this handler reads a byte,
// but a MISSING one is no reason to refuse: nothing in this repository shows
// whether it survives every hop to this function. Either way the body is then
// read through readBodyWithin, which stops at the cap. The cap (4 MiB) sits
// under proxyClientMaxBodySize (10 MB by default): proxy.ts matches this path,
// and Next buffers a proxied body only that far and silently truncates past
// it, so a truncated body is refused as too large before it could ever parse
// as a complete one.
//
// 🪤 That buffering also means the early refusal saves the parse, not the
// upload. Next hands this handler the request only once the proxied body has
// ENDED (getCloneableBody's finalize() in next/dist/server/body-streams.js),
// so a client that declares 5 MiB and stalls gets no answer until it sends
// the rest or its connection times out, and a client that sends 5 MiB has
// sent all of it before the 413. Seen on the dev server, 2026-10-11.

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

  if (!isSameOriginRequest(request.headers)) {
    return reply({ status: "forbidden" }, 403);
  }

  // A declared length over the cap is refused before this handler reads a
  // byte. Then the body is counted as it arrives, whatever was declared; see
  // the header.
  // MAX_UPLOAD_REQUEST_BYTES also sits under Vercel's 4.5 MB function limit,
  // and a request within the photo and thumbnail caps always fits inside it.
  if (
    !declaredLengthWithin(
      request.headers.get("content-length"),
      MAX_UPLOAD_REQUEST_BYTES
    )
  ) {
    return reply({ status: "too_large" }, 413);
  }
  const body = await readBodyWithin(request.body, MAX_UPLOAD_REQUEST_BYTES);
  if (body.kind === "too_large") return reply({ status: "too_large" }, 413);
  if (body.kind === "unreadable") return reply({ status: "invalid" }, 400);

  // The counted bytes, parsed as the multipart body they claim to be: the
  // request's own Content-Type carries the boundary.
  let form: FormData;
  try {
    form = await new Response(body.bytes, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
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

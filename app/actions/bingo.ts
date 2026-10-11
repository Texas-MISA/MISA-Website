"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/app/actions/audit";
import { getOfficer } from "@/lib/auth";
import {
  prepareBingoVideoUpload as prepareVideoUpload,
  removeBingoProof as removeProof,
  renameBingoActivity as renameActivity,
  type BingoInvalidReason,
} from "@/lib/bingo";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  bingoRemoveSchema,
  bingoRenameSchema,
  bingoVideoPrepareSchema,
} from "@/lib/validation";

// House bingo's officer actions (migration 33): the video upload token, the
// rename, and the remove. A photo, and the record step of a video, go through
// the Route Handler at /admin/bingo/upload instead, because a Server Action
// body is capped at 1 MB and a resized photo is up to 3 MiB.
//
// Same house shape as app/actions/members.ts. Every action opens with
// getOfficer() and returns `unauthorized`, never requireOfficer(): its
// redirect() throws NEXT_REDIRECT, and the try/catch below would swallow it
// into a generic error. The decisions all live in lib/bingo.ts; these
// validate, call the core with the service role, audit, and revalidate.
//
// 🔓 No role check anywhere in this file, as with every officer action here
// (§9 #6): any officer may mark, replace, remove or rename. The audit log is
// the control.

const BOARD = "/admin/bingo";
/** Every square page. An action that is posted only a mark or a square id
 * does not know which house's page it was, so it revalidates them all. */
const SQUARES = "/admin/bingo/[house]/[position]";

// ---------------------------------------------------------------------------
// A video upload token
// ---------------------------------------------------------------------------

export type PrepareVideoUploadInput = {
  /** The house's slug, as the square page's URL carries it: `m`. */
  house: string;
  position: number | string;
  /** The File's own `file.type`. See PrepareVideoInput in lib/bingo.ts. */
  contentType: string;
  /** The file's size in bytes. */
  size: number;
};

export type PrepareVideoUploadResult =
  | { status: "unauthorized" }
  | { status: "invalid"; reason: BingoInvalidReason }
  | { status: "error" }
  /** Upload to exactly this path with this token, then hand the path to the
   * Route Handler to record. */
  | { status: "ready"; path: string; token: string };

/**
 * Mint a signed upload token for ONE fresh video path in this square's folder.
 *
 * 🔓 The ONE client-side write this codebase allows (user's decision,
 * 2026-10-10): a video is too big for a function body, so the browser uploads
 * its bytes straight to Storage with this token and the anon key. The token
 * names one path, cannot overwrite, and lives two hours; the Route Handler
 * checks the object before anything is recorded.
 *
 * Called from the uploader with arguments, not as a form action.
 *
 * ⚠️ Writes NO admin_audit row, deliberately. It changes no club data: no
 * mark is written, and the orphan sweep it runs deletes only files that no
 * mark references. The proof is audited when the Route Handler records it.
 */
export async function prepareBingoVideoUpload(
  input: PrepareVideoUploadInput
): Promise<PrepareVideoUploadResult> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const parsed = bingoVideoPrepareSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "invalid", reason: prepareReasonOf(parsed.error) };
  }

  try {
    const result = await prepareVideoUpload(createAdminClient(), parsed.data);
    // `sweptPaths` stays on the server: the browser needs the one path and
    // its token, and nothing about other uploads.
    if (result.status === "ready") {
      return { status: "ready", path: result.path, token: result.token };
    }
    return result;
  } catch (e) {
    console.error(
      "prepareBingoVideoUpload failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

// ---------------------------------------------------------------------------
// Renaming an activity
// ---------------------------------------------------------------------------

/** What the rename form posted, echoed back so React 19's post-action reset
 * restores it. The token says which version of the square the text was typed
 * against, so the form can drop an echo the page has since moved past. */
export type SubmittedActivityValues = {
  activity: string;
  expectedUpdatedAt: string;
};

export type RenameActivityState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | {
      status: "invalid";
      fieldErrors: Partial<Record<"activity", string[]>>;
      values: SubmittedActivityValues;
    }
  /** Someone renamed it since the page was rendered. */
  | { status: "conflict"; values: SubmittedActivityValues }
  /** No such square. */
  | { status: "not_found" }
  /** It already reads that way; nothing was written or audited. */
  | { status: "unchanged"; updatedAt: string; values: SubmittedActivityValues }
  /** `updatedAt` is the square's new token. */
  | {
      status: "saved";
      activity: string;
      updatedAt: string;
      values: SubmittedActivityValues;
    }
  | { status: "error"; values: SubmittedActivityValues };

/** Bounds what a hand-rolled POST can make the server reflect back. Four times
 * the limit, so the officer still sees what they typed past it. */
const ACTIVITY_ECHO_LIMIT = 240;
const TOKEN_ECHO_LIMIT = 64;

/**
 * Rename one activity. It changes all four houses' cards at once, and their
 * proof stays where it is: a mark belongs to the square, not to its text.
 */
export async function renameBingoActivity(
  _prev: RenameActivityState,
  formData: FormData
): Promise<RenameActivityState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const values: SubmittedActivityValues = {
    activity: echoField(formData.get("activity"), ACTIVITY_ECHO_LIMIT),
    expectedUpdatedAt: echoField(
      formData.get("expectedUpdatedAt"),
      TOKEN_ECHO_LIMIT
    ),
  };

  const parsed = bingoRenameSchema.safeParse({
    squareId: formData.get("squareId"),
    activity: formData.get("activity"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
  });
  if (!parsed.success) {
    return {
      status: "invalid",
      fieldErrors: fieldErrorsOf<"activity">(parsed.error, "activity"),
      values,
    };
  }

  try {
    const db = createAdminClient();
    const result = await renameActivity(db, parsed.data);

    switch (result.status) {
      case "invalid":
        // The schema ran normalizeActivity already, so this is the CHECK
        // disagreeing with it: a bug here rather than something to retype.
        return {
          status: "invalid",
          fieldErrors: { activity: ["That name can't be saved"] },
          values,
        };
      case "not_found":
        return { status: "not_found" };
      case "conflict":
        return { status: "conflict", values };
      case "error":
        return { status: "error", values };
      case "unchanged":
        return { status: "unchanged", updatedAt: result.updatedAt, values };
      case "renamed":
        await writeAudit(db, {
          entityType: "bingo_square",
          entityId: result.squareId,
          actorId: officer.userId,
          action: "bingo_square.renamed",
          before: result.before,
          after: result.after,
        });
        revalidateBingo();
        return {
          status: "saved",
          activity: result.after.activity,
          updatedAt: result.updatedAt,
          values,
        };
    }
  } catch (e) {
    console.error(
      "renameBingoActivity failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error", values };
  }
}

// ---------------------------------------------------------------------------
// Removing one house's proof
// ---------------------------------------------------------------------------

export type RemoveProofState =
  | { status: "idle" }
  | { status: "unauthorized" }
  /** Not a mark id and a token: a request the page never builds. */
  | { status: "invalid" }
  /** The proof was replaced since the page was rendered. */
  | { status: "conflict" }
  /** Already removed, by another officer or another tab. */
  | { status: "not_found" }
  | { status: "removed" }
  | { status: "error" };

/**
 * Remove one house's proof for one square: the square goes back to not done
 * for that house on the member portal, and its files are deleted.
 *
 * The audit row's `before` is the only record of what the proof was, like
 * event.deleted's.
 */
export async function removeBingoProof(
  _prev: RemoveProofState,
  formData: FormData
): Promise<RemoveProofState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const parsed = bingoRemoveSchema.safeParse({
    markId: formData.get("markId"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
  });
  if (!parsed.success) return { status: "invalid" };

  try {
    const db = createAdminClient();
    const result = await removeProof(db, parsed.data);
    if (result.status !== "removed") return { status: result.status };

    await writeAudit(db, {
      entityType: "bingo_mark",
      entityId: result.markId,
      actorId: officer.userId,
      action: "bingo_mark.removed",
      // `before` and no `after`, which AuditTrail renders as a removal.
      before: result.before,
      after: null,
      note: filesNotDeleted(result.orphanPaths),
    });

    revalidateBingo();
    return { status: "removed" };
  } catch (e) {
    console.error(
      "removeBingoProof failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

// ---------------------------------------------------------------------------

function echoField(value: FormDataEntryValue | null, max: number): string {
  // FormData.get can return a File; anything not a string echoes as empty.
  return typeof value === "string" ? value.slice(0, max) : "";
}

/** The audit note for files Storage would not delete, or null when cleanup
 * succeeded. Each entry is `<bucket>/<path>`. */
function filesNotDeleted(orphanPaths: string[]): string | null {
  return orphanPaths.length > 0
    ? `Files not deleted: ${orphanPaths.join(", ")}`
    : null;
}

/** Which refusal a malformed prepare request maps to. Only a crafted call gets
 * here; the uploader always sends all four fields. */
function prepareReasonOf(error: {
  issues: { path: PropertyKey[] }[];
}): BingoInvalidReason {
  const field = String(error.issues[0]?.path[0] ?? "");
  if (field === "house") return "house";
  if (field === "position") return "position";
  if (field === "size") return "video_size";
  return "video_type";
}

// Duplicated from app/actions/members.ts rather than shared: a "use server"
// module may only export async functions, so a helper like this cannot be
// exported from one and imported by the other.
function fieldErrorsOf<K extends string>(
  error: { issues: { path: PropertyKey[]; message: string }[] },
  fallback: K
): Partial<Record<K, string[]>> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? fallback);
    (fieldErrors[field] ??= []).push(issue.message);
  }
  return fieldErrors as Partial<Record<K, string[]>>;
}

function revalidateBingo() {
  revalidatePath(BOARD);
  revalidatePath(SQUARES, "page");
}

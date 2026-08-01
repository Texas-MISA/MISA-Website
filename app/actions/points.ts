"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { writeAudit, writeAuditBatch } from "@/app/actions/audit";
import { getOfficer } from "@/lib/auth";
import {
  AUDITED_ADJUSTMENT_COLUMNS,
  MAX_GRANT_MEMBERS,
  summarizeGrant,
} from "@/lib/points";
import { createAdminClient } from "@/lib/supabase/admin";
import { pointGrantSchema, pointVoidSchema } from "@/lib/validation";

// Point adjustments (§4.2, §7 Stage 5 phase 4) — the points that never came
// from a check-in: volunteering, recruiting, competition placings, and
// correcting a past mistake.
//
// Same house shape as app/actions/attendance-review.ts — read its header for
// why getOfficer() rather than requireOfficer(), and why every redirect() sits
// outside the try/catch. Service-role client throughout: point_adjustments is
// deny-all under RLS until Stage 8.
//
// Two exports and no more. There is deliberately no update path and no delete:
// an adjustment is immutable except for voiding, which is why the audit union
// carries points.granted and points.voided and nothing between them (§4.2). If
// a grant is wrong, void it with a reason and grant a corrected one — the
// ledger then shows what happened, which is the entire point of a ledger.
//
// Neither action takes an `intent`. saveSubmission's dual-verb shape is the
// local idiom and is the wrong reach here: there is no "grant and something".
//
// No role check and no self-grant check, and their absence is a decision rather
// than an oversight (§9 #9, #10, both resolved 2026-07-31). Any officer may
// grant any amount, to anyone including themselves; the reason, the named
// officer, and the ledger are the control. MAX_POINTS_PER_GRANT is a
// fat-finger guard in lib/points.ts and is not a policy cap — don't let it
// drift into being cited as one.

const LEDGER = "/admin/points";

// ---------------------------------------------------------------------------
// Granting
// ---------------------------------------------------------------------------

type GrantField = "memberIds" | "points" | "reason" | "category" | "eventId";

/**
 * The raw values the officer submitted, echoed back.
 *
 * React 19 resets an uncontrolled `<form action={…}>` once the action resolves,
 * so any state that re-renders the form reverts every field unless the action
 * hands the values back. `memberIds` rides along for the same reason and is the
 * one that actually hurts to lose: retyping a reason is an annoyance, but
 * re-finding eleven people in a roster is enough work that an officer would
 * reasonably grant to the four they can remember and move on.
 */
export type SubmittedGrantValues = {
  memberIds: string[];
  points: string;
  reason: string;
  category: string;
  eventId: string;
};

export type GrantState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  | {
      status: "invalid";
      fieldErrors: Partial<Record<GrantField, string[]>>;
      values: SubmittedGrantValues;
    }
  /** A picked member was deleted between the render and the save. */
  | { status: "stale_member"; values: SubmittedGrantValues }
  /** The linked event was deleted between the render and the save. */
  | { status: "stale_event"; values: SubmittedGrantValues };
// No success member: a grant redirects to the ledger, where the new rows are
// the confirmation.

/** Cap echoed values so a hand-rolled POST can't have the server reflect a
 * megabyte back into its own response (see app/actions/attendance.ts). */
const ECHO_LIMITS = {
  points: 8,
  reason: 500,
  category: 40,
  eventId: 40,
} as const;

/**
 * Award or deduct points for one or more members in a single action.
 *
 * **One insert, all-or-nothing.** This is the deliberate asymmetry with
 * bulkAssignEvent, which reports partial success: that one operates on rows
 * that already exist, so a skipped submission stays visibly in the queue for
 * someone to notice. A partial grant has no such backstop — eleven of twelve
 * members credited, the officer told it worked, and the twelfth finds out a
 * month later when the leaderboard is wrong. So a bad id costs the whole grant
 * and the officer keeps every pick to retry with.
 */
export async function grantPoints(
  _prev: GrantState,
  formData: FormData
): Promise<GrantState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  // Deduped before validation, not after. A repeated id is two rows for one
  // member — double points, and no constraint anywhere would catch it, since
  // point_adjustments has no uniqueness to violate. Deduping first also means a
  // selection of 55 containing 5 repeats passes the cap rather than failing
  // with a count the officer can't see on screen.
  //
  // ⚠️ The bound here is deliberately ABOVE MAX_GRANT_MEMBERS, and that matters.
  // Truncating to the cap would make a hand-rolled POST of 60 ids a silent
  // grant to the first 50 — a partial grant reported as success, which is the
  // exact failure this action's all-or-nothing insert exists to prevent. Any
  // oversized selection must be *refused*, so the slice only bounds how much
  // can be reflected back and leaves the refusing to pointGrantSchema's .max().
  const ECHO_MEMBER_CAP = MAX_GRANT_MEMBERS * 2;
  const memberIds = [
    ...new Set(
      formData
        .getAll("memberIds")
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    ),
  ].slice(0, ECHO_MEMBER_CAP);

  const values: SubmittedGrantValues = {
    memberIds,
    points: echoField(formData.get("points"), ECHO_LIMITS.points),
    reason: echoField(formData.get("reason"), ECHO_LIMITS.reason),
    category: echoField(formData.get("category"), ECHO_LIMITS.category),
    eventId: echoField(formData.get("eventId"), ECHO_LIMITS.eventId),
  };

  const parsed = pointGrantSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "invalid",
      fieldErrors: fieldErrorsOf<GrantField>(parsed.error, "memberIds"),
      values,
    };
  }
  const fields = parsed.data;
  const returnTo = safeLedgerUrl(formData.get("returnTo"));

  try {
    const db = createAdminClient();

    const { data: created, error } = await db
      .from("point_adjustments")
      .insert(
        fields.memberIds.map((memberId) => ({
          member_id: memberId,
          points: fields.points,
          reason: fields.reason,
          category: fields.category,
          event_id: fields.eventId,
          awarded_by: officer.userId,
          // No `term` key, deliberately. It defaults to current_term() in SQL,
          // and a term string typed in application code is a bug (§4.7). The
          // generated Insert type makes it optional, so nothing but this
          // comment and tests/point-actions.test.ts stops someone adding it —
          // it is read back in the .select() below instead.
        }))
      )
      .select(AUDITED_ADJUSTMENT_COLUMNS);

    if (error) {
      // A picked member or the linked event was deleted while the form was
      // open. No pre-flight existence check guards this: the foreign key IS the
      // check, and a read before the write would be TOCTOU anyway.
      if (error.code === "23503") {
        if (error.message.includes("member_id")) {
          return { status: "stale_member", values };
        }
        if (error.message.includes("event_id")) {
          return { status: "stale_event", values };
        }
      }
      // 23514 is a bug, not a case. Every check on the table — points <> 0,
      // reason_not_blank, the category list — is mirrored in pointGrantSchema,
      // so one reaching Postgres means the schema and the constraint have
      // drifted apart and the officer's message would be a lie either way.
      console.error("grantPoints failed:", error.message);
      return { status: "error" };
    }

    // One audit row per adjustment — the entity is the adjustment, not the
    // grant. The shared note is how the batch context travels, matching the
    // bulk-assign entries in app/actions/attendance-review.ts.
    await writeAuditBatch(
      db,
      created.map((row) => ({
        entityType: "point_adjustment" as const,
        entityId: row.id,
        actorId: officer.userId,
        action: "points.granted" as const,
        after: row,
        note:
          created.length > 1
            ? summarizeGrant(created.length, fields.points)
            : null,
      }))
    );

    revalidatePoints(null);
  } catch (e) {
    console.error(
      "grantPoints failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }

  // Outside the try/catch: redirect() signals by throwing NEXT_REDIRECT, and
  // the catch above would swallow it.
  redirect(returnTo);
}

// ---------------------------------------------------------------------------
// Voiding
// ---------------------------------------------------------------------------

export type VoidState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  | {
      status: "invalid";
      fieldErrors: Partial<Record<"voidReason", string[]>>;
      value: string;
    }
  /** Someone else voided it between the render and the save. */
  | { status: "already_voided" }
  | { status: "done" };

/**
 * Void an adjustment, with a reason (§4.2).
 *
 * Not a delete and not an edit: the row stays in the ledger, struck through,
 * and stops counting the instant this lands — both views filter
 * `voided_at is null`, so nothing application-side maintains that.
 *
 * There is no compare-and-set token here and the omission is deliberate, unlike
 * every single-row attendance mutation. point_adjustments carries no
 * `updated_at` because voiding is a one-way transition, which makes
 * `.is("voided_at", null)` a complete guard rather than an approximation:
 * the only thing a second officer could have done to this row is the exact
 * thing being attempted, and zero rows back says they got there first.
 */
export async function voidAdjustment(
  _prev: VoidState,
  formData: FormData
): Promise<VoidState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const value = echoField(formData.get("voidReason"), ECHO_LIMITS.reason);

  const parsed = pointVoidSchema.safeParse({
    id: formData.get("id"),
    voidReason: value,
  });
  if (!parsed.success) {
    return {
      status: "invalid",
      fieldErrors: fieldErrorsOf<"voidReason">(parsed.error, "voidReason"),
      value,
    };
  }
  const fields = parsed.data;

  try {
    const db = createAdminClient();

    const { data: before, error: beforeError } = await db
      .from("point_adjustments")
      .select(AUDITED_ADJUSTMENT_COLUMNS)
      .eq("id", fields.id)
      .maybeSingle();

    if (beforeError || !before) {
      console.error(
        "voidAdjustment failed:",
        beforeError?.message ?? "adjustment not found"
      );
      return { status: "error" };
    }

    // All three void columns move in one statement, so void_is_complete and
    // void_requires_reason can never observe a half-voided row.
    const { data: after, error } = await db
      .from("point_adjustments")
      .update({
        voided_at: new Date().toISOString(),
        voided_by: officer.userId,
        void_reason: fields.voidReason,
      })
      .eq("id", fields.id)
      .is("voided_at", null)
      // The same column list as `before`, and that is load-bearing rather than
      // tidiness. AuditTrail's diff unions the keys of both sides and renders a
      // key missing from one as "—", so a narrower list here made the void read
      // as `reason: "Staffed the info booth" → —` in the log: it looked like
      // voiding had erased the reason and the awarding officer. Only the three
      // void columns actually move, and now only those three show.
      .select(AUDITED_ADJUSTMENT_COLUMNS)
      .maybeSingle();

    if (error) {
      console.error("voidAdjustment failed:", error.message);
      return { status: "error" };
    }
    if (!after) return { status: "already_voided" };

    await writeAudit(db, {
      entityType: "point_adjustment",
      entityId: fields.id,
      actorId: officer.userId,
      action: "points.voided",
      before,
      after,
    });

    revalidatePoints(fields.id);
    return { status: "done" };
  } catch (e) {
    console.error(
      "voidAdjustment failed:",
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

/**
 * Where to send an officer after a grant.
 *
 * The value rides in a hidden input so the filtered ledger survives the round
 * trip, which makes it attacker-supplied — the same open-redirect shape as
 * safeQueueUrl() in app/actions/attendance-review.ts, and refused the same way.
 */
function safeLedgerUrl(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string" || raw === "") return LEDGER;
  if (raw !== LEDGER && !raw.startsWith(`${LEDGER}?`)) return LEDGER;
  if (raw.includes("\\") || raw.startsWith("//")) return LEDGER;
  return raw;
}

function revalidatePoints(id: string | null) {
  revalidatePath(LEDGER);
  if (id) revalidatePath(`${LEDGER}/${id}`);
  // Not /admin: unlike the attendance pending badge, nothing on the dashboard
  // aggregates points today. The day a points tile lands there, this is where
  // its revalidate belongs. /leaderboard likewise, when Stage 7 ships it —
  // granting and voiding both move public standings.
}

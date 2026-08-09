"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/app/actions/audit";
import { getOfficer } from "@/lib/auth";
import { formatDay } from "@/lib/events";
import { fetchFieldDefinitions } from "@/lib/member-fields";
import { AUDITED_MEMBER_COLUMNS, withoutToken } from "@/lib/members";
import {
  isOfferedChoice,
  mergedCustomFields,
  planMerge,
  type MergeAttendance,
  type MergeMember,
  type MergePlan,
  type PlannedAttendance,
  type PlannedField,
} from "@/lib/merge";
import { createAdminClient } from "@/lib/supabase/admin";
import { mergeSchema } from "@/lib/validation";

// Merging duplicate members (§4.2, §7 Stage 6 phase 8). Two actions over one
// pair: previewMerge writes nothing, commitMerge re-derives and writes.
//
// ⚠️ **No role check anywhere in this file, and that is a decision** — the same
// one app/actions/members.ts, dues.ts and member-import.ts record (§9 #6). The
// audit log is the control, not a gate. This is the most destructive action in
// the codebase and it is still not the thing to make role-branching start:
// funnelling every duplicate through whoever is busiest is how duplicates stop
// getting merged, and the misuse a gate guards against shows up in admin_audit
// either way.
//
// ⚠️ commitMerge RE-DERIVES the plan from the two ids rather than trusting the
// preview. Only the officer's explicit CHOICES arrive from the form, and each is
// re-validated against the freshly derived plan — the same posture as /attend's
// step=confirm, the dues import, and the roster import.

const DIRECTORY = "/admin/members";

/** One unbroken literal with `as const` — PostgREST types the returned row off
 * the string literal, and a concatenation widens it to plain `string`. */
const MERGE_MEMBER_COLUMNS =
  "id, full_name, email, eid, normalized_eid, active, joined_at, notes, custom_fields, updated_at" as const;

/** The attendance columns the plan needs, plus what the reject write audits. */
const MERGE_ATTENDANCE_COLUMNS =
  "id, event_id, member_id, status, resolution_note, resolved_at" as const;

// ---------------------------------------------------------------------------

export type MergeCounts = {
  attendanceMoved: number;
  attendanceRejected: number;
  adjustments: number;
  payments: number;
};

export type PreviewState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  | { status: "not_found" }
  | { status: "same_member" }
  | {
      status: "ready";
      survivor: { id: string; label: string; updatedAt: string };
      loser: { id: string; label: string };
      collisions: PlannedAttendance[];
      conflicts: PlannedField[];
      counts: MergeCounts;
      notes: string | null;
      joinedAt: string;
    };

export type CommitState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  | { status: "not_found" }
  | { status: "same_member" }
  /** Someone edited the survivor between the preview and the save. */
  | { status: "conflict" }
  /**
   * The re-count found rows still pointing at the loser, so the delete was
   * refused. Everything up to that point has landed and is safe — see the note
   * on `commitMerge`.
   */
  | { status: "incomplete"; remaining: string }
  | { status: "done"; counts: MergeCounts; survivorId: string };

// ---------------------------------------------------------------------------

async function loadMember(
  db: ReturnType<typeof createAdminClient>,
  id: string
): Promise<{ row: MergeMember; label: string; updatedAt: string } | null> {
  const { data, error } = await db
    .from("members")
    .select(MERGE_MEMBER_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    row: {
      id: data.id,
      fullName: data.full_name,
      email: data.email,
      eid: data.eid,
      normalizedEid: data.normalized_eid ?? "",
      active: data.active,
      joinedAt: data.joined_at,
      notes: data.notes,
      customFields: data.custom_fields,
    },
    label: `${data.full_name} (${data.eid})`,
    updatedAt: data.updated_at,
  };
}

async function loadAttendance(
  db: ReturnType<typeof createAdminClient>,
  memberId: string
): Promise<MergeAttendance[]> {
  // Events embedded so the plan can label a collision with something an officer
  // recognises. Formatted here, on the server, per the hydration rule.
  const { data, error } = await db
    .from("attendance")
    .select("id, event_id, status, events(title, starts_at)")
    .eq("member_id", memberId)
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("merge attendance read failed:", error.message);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    eventId: row.event_id,
    status: row.status,
    eventLabel: row.events
      ? `${row.events.title} — ${formatDay(row.events.starts_at)}`
      : "Unassigned check-in",
  }));
}

/** The work both actions share, so the commit runs the identical derivation the
 * preview did and cannot diverge from what the officer was shown. */
async function derive(
  db: ReturnType<typeof createAdminClient>,
  survivorId: string,
  loserId: string
) {
  const [survivor, loser] = await Promise.all([
    loadMember(db, survivorId),
    loadMember(db, loserId),
  ]);
  if (!survivor || !loser) return { kind: "not_found" as const };

  const [definitions, survivorAttendance, loserAttendance] = await Promise.all([
    fetchFieldDefinitions(db),
    loadAttendance(db, survivorId),
    loadAttendance(db, loserId),
  ]);

  const result = planMerge({
    survivor: survivor.row,
    loser: loser.row,
    survivorAttendance,
    loserAttendance,
    definitions,
  });
  if (result.kind === "same_member") return { kind: "same_member" as const };

  const [adjustments, payments] = await Promise.all([
    countRows(db, "point_adjustments", loserId),
    countRows(db, "dues_payments", loserId),
  ]);
  if (adjustments === null || payments === null) return { kind: "error" as const };

  return {
    kind: "ok" as const,
    survivor,
    loser,
    plan: result.plan,
    counts: countsOf(result.plan, adjustments, payments),
  };
}

async function countRows(
  db: ReturnType<typeof createAdminClient>,
  table: "attendance" | "point_adjustments" | "dues_payments",
  memberId: string
): Promise<number | null> {
  const { count, error } = await db
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId);
  if (error) {
    console.error(`merge count on ${table} failed:`, error.message);
    return null;
  }
  return count ?? 0;
}

function countsOf(
  plan: MergePlan,
  adjustments: number,
  payments: number
): MergeCounts {
  return {
    attendanceMoved: plan.attendance.filter((r) => r.outcome.kind === "move").length,
    attendanceRejected: plan.collisions.length,
    adjustments,
    payments,
  };
}

// ---------------------------------------------------------------------------
// previewMerge — writes nothing
// ---------------------------------------------------------------------------

export async function previewMerge(
  _prev: PreviewState,
  formData: FormData
): Promise<PreviewState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const parsed = mergeSchema.safeParse({
    survivorId: formData.get("survivorId"),
    loserId: formData.get("loserId"),
  });
  if (!parsed.success) return { status: "error" };

  try {
    const db = createAdminClient();
    const derived = await derive(db, parsed.data.survivorId, parsed.data.loserId);

    if (derived.kind === "not_found") return { status: "not_found" };
    if (derived.kind === "same_member") return { status: "same_member" };
    if (derived.kind === "error") return { status: "error" };

    return {
      status: "ready",
      survivor: {
        id: derived.survivor.row.id,
        label: derived.survivor.label,
        // Carried to the commit as the compare-and-set anchor, as the raw
        // PostgREST string — a JS Date round trip truncates the microseconds and
        // the CAS then never matches.
        updatedAt: derived.survivor.updatedAt,
      },
      loser: { id: derived.loser.row.id, label: derived.loser.label },
      collisions: derived.plan.collisions,
      conflicts: derived.plan.conflicts,
      counts: derived.counts,
      notes: derived.plan.notes,
      joinedAt: derived.plan.joinedAt,
    };
  } catch (e) {
    console.error(
      "previewMerge failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

// ---------------------------------------------------------------------------
// commitMerge — re-derives, then writes
// ---------------------------------------------------------------------------

/**
 * Merge `loserId` into `survivorId`.
 *
 * ⚠️ **Not atomic, and it cannot be.** PostgREST has no transaction across
 * statements — the same gap `writeAudit` records — so this is a sequence, and
 * the ORDER is the entire safety story rather than a matter of tidiness:
 *
 *   1. Reject the losing row of every colliding event. 🔓 This is the step the
 *      database cannot do for us: `attendance_one_per_event` is keyed on
 *      `normalized_eid`, not `member_id`, so repointing never trips it and the
 *      survivor would silently be credited twice for one event. See lib/merge.ts.
 *   2. Repoint attendance, then point_adjustments, then dues_payments.
 *   3. Update the survivor, compare-and-set on `members.updated_at`.
 *   4. RE-COUNT all three tables and refuse to delete unless every count is 0.
 *   5. Delete the loser.
 *
 * Step 4 is not defensive padding. `point_adjustments.member_id` is
 * `on delete cascade`, so a delete that runs while a grant still points at the
 * loser **destroys it with no error**; `attendance.member_id` is
 * `on delete set null`, so it silently orphans check-ins. Only
 * `dues_payments.member_id` is `on delete restrict` and would refuse. One of
 * three failing loudly is not a safety net, so the re-count is.
 *
 * Every partial failure therefore leaves a RECOVERABLE state: repointed but not
 * deleted is a visible duplicate holding no data, which the officer merges
 * again. The one irreversible step is last and is guarded.
 */
export async function commitMerge(
  _prev: CommitState,
  formData: FormData
): Promise<CommitState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const parsed = mergeSchema.safeParse({
    survivorId: formData.get("survivorId"),
    loserId: formData.get("loserId"),
  });
  if (!parsed.success) return { status: "error" };
  const { survivorId, loserId } = parsed.data;

  const expectedUpdatedAt = formData.get("expectedUpdatedAt");
  if (typeof expectedUpdatedAt !== "string" || expectedUpdatedAt === "") {
    return { status: "error" };
  }

  // The officer's per-field answers, keyed by definition key. Re-validated
  // against the freshly derived plan below — never trusted as posted.
  const choices: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("field:") && typeof value === "string") {
      choices[key.slice("field:".length)] = value;
    }
  }

  try {
    const db = createAdminClient();

    // Re-derived, not taken from the preview. If either member changed since,
    // the newer answer wins — including a collision that did not exist when the
    // officer looked.
    const derived = await derive(db, survivorId, loserId);
    if (derived.kind === "not_found") return { status: "not_found" };
    if (derived.kind === "same_member") return { status: "same_member" };
    if (derived.kind === "error") return { status: "error" };

    const { plan, survivor, loser } = derived;

    // The same discipline savePayment applies to start_term: the form is not a
    // way to write an arbitrary string into custom_fields, bypassing the option
    // list setMemberFieldValue enforces.
    for (const [key, value] of Object.entries(choices)) {
      const field = plan.conflicts.find((f) => f.key === key);
      if (!field || !isOfferedChoice(field, value)) {
        console.error("commitMerge: choice not offered for", key);
        return { status: "error" };
      }
    }

    const now = new Date().toISOString();
    const note = `merged into ${survivor.label}`;

    // --- 1. Resolve the collisions ------------------------------------------
    for (const collision of plan.collisions) {
      const { data: before, error: readError } = await db
        .from("attendance")
        .select(MERGE_ATTENDANCE_COLUMNS)
        .eq("id", collision.id)
        .maybeSingle();
      if (readError || !before) {
        console.error("commitMerge: collision row vanished", collision.id);
        return { status: "error" };
      }

      const { data: after, error } = await db
        .from("attendance")
        .update({
          status: "rejected",
          resolution_note: `Duplicate of an existing check-in for ${collision.eventLabel} — ${note}`,
          resolved_by: officer.userId,
          resolved_at: now,
        })
        .eq("id", collision.id)
        // ⚠️ Scoped on the status rather than compare-and-set on `updated_at`,
        // following the invariant that single-row mutations use a CAS and BULK
        // ones scope: a merge can touch many rows and carrying a token for each
        // through the form buys nothing. The scope is also what makes the race
        // benign — if another officer rejected this row first, zero rows come
        // back and the outcome we wanted is already true.
        .neq("status", "rejected")
        .select(MERGE_ATTENDANCE_COLUMNS)
        .maybeSingle();

      if (error) {
        console.error("commitMerge: reject failed:", error.message);
        return { status: "error" };
      }
      // Someone got there first. Nothing to log — the row already says what an
      // audit row would have said, and a second `attendance.rejected` naming a
      // change that did not happen is noise in the one log that exists to say
      // who changed what.
      if (!after) continue;

      // Its own audit row, so the queue's history explains a rejection that
      // nobody in the queue made.
      await writeAudit(db, {
        entityType: "attendance",
        entityId: collision.id,
        actorId: officer.userId,
        action: "attendance.rejected",
        before,
        after,
      });
    }

    // --- 2. Repoint ----------------------------------------------------------
    // Rejected rows move too: they are history, and leaving them behind would
    // strand them on a member about to be deleted (attendance is
    // `on delete set null`, so they would silently lose their link entirely).
    for (const table of ["attendance", "point_adjustments", "dues_payments"] as const) {
      const { error } = await db
        .from(table)
        .update({ member_id: survivorId })
        .eq("member_id", loserId);
      if (error) {
        console.error(`commitMerge: repoint ${table} failed:`, error.message);
        return { status: "error" };
      }
    }

    // --- 3. The survivor -----------------------------------------------------
    const { data: beforeMember, error: beforeError } = await db
      .from("members")
      .select(AUDITED_MEMBER_COLUMNS)
      .eq("id", survivorId)
      .maybeSingle();
    if (beforeError || !beforeMember) return { status: "error" };

    const { data: afterMember, error: updateError } = await db
      .from("members")
      .update({
        custom_fields: mergedCustomFields(plan, choices),
        notes: plan.notes,
        joined_at: plan.joinedAt,
      })
      .eq("id", survivorId)
      .eq("updated_at", expectedUpdatedAt)
      .select(AUDITED_MEMBER_COLUMNS)
      .maybeSingle();

    if (updateError) {
      console.error("commitMerge: survivor update failed:", updateError.message);
      return { status: "error" };
    }
    // ⚠️ A conflict here lands AFTER the repoints, which is deliberate and
    // safe: the loser is emptied but still present, so the officer re-previews
    // and the second pass has nothing left to move. Doing the CAS first would
    // mean a stale token blocked a merge that had already half-run.
    if (!afterMember) return { status: "conflict" };

    // --- 4. Prove the loser is empty before deleting -------------------------
    const remaining = await Promise.all([
      countRows(db, "attendance", loserId),
      countRows(db, "point_adjustments", loserId),
      countRows(db, "dues_payments", loserId),
    ]);
    if (remaining.some((count) => count === null)) return { status: "error" };

    const [attendanceLeft, adjustmentsLeft, paymentsLeft] = remaining as number[];
    if (attendanceLeft > 0 || adjustmentsLeft > 0 || paymentsLeft > 0) {
      // Refused, not forced. point_adjustments cascades, so deleting here would
      // destroy grants with no error anywhere.
      const parts = [
        attendanceLeft > 0 ? `${attendanceLeft} check-in(s)` : null,
        adjustmentsLeft > 0 ? `${adjustmentsLeft} adjustment(s)` : null,
        paymentsLeft > 0 ? `${paymentsLeft} payment(s)` : null,
      ].filter(Boolean);
      console.error("commitMerge: refusing to delete, rows remain:", parts);
      return { status: "incomplete", remaining: parts.join(", ") };
    }

    // --- 5. Delete -----------------------------------------------------------
    const { error: deleteError } = await db
      .from("members")
      .delete()
      .eq("id", loserId);
    if (deleteError) {
      console.error("commitMerge: delete failed:", deleteError.message);
      return { status: "incomplete", remaining: "the duplicate could not be removed" };
    }

    // One row, on the SURVIVOR. The loser's own audit history becomes
    // unreachable the moment its row is gone — there is no page for a member
    // that does not exist — so this row is the only surviving record of the
    // merge and it has to carry the whole story in `note`.
    await writeAudit(db, {
      entityType: "member",
      entityId: survivorId,
      actorId: officer.userId,
      action: "member.merged",
      before: withoutToken(beforeMember),
      after: withoutToken(afterMember),
      note: summarize(loser.label, loser.row.id, derived.counts),
    });

    revalidatePath(DIRECTORY);
    revalidatePath(`${DIRECTORY}/${survivorId}`);
    // A merge moves public standings (the loser's points land on the survivor),
    // and this used to call revalidatePath("/leaderboard") — written in phase 8
    // against a route that did not exist yet, so it revalidated a 404. Stage 7
    // built the board as `force-dynamic`, so there is nothing to revalidate;
    // see the note in revalidatePoints (app/actions/points.ts) for why all five
    // standings-moving modules resolve it that way rather than each remembering.

    return { status: "done", counts: derived.counts, survivorId };
  } catch (e) {
    console.error(
      "commitMerge failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

/** `merged Ada Lovelace (al1815) [<uuid>] — 4 check-ins, 1 rejected as
 * duplicate, 2 adjustments, 1 payment`. The uuid is in there because the
 * deleted row's own audit history is still keyed by it. */
function summarize(label: string, loserId: string, counts: MergeCounts): string {
  const parts = [
    `${counts.attendanceMoved} check-in${counts.attendanceMoved === 1 ? "" : "s"}`,
    counts.attendanceRejected > 0
      ? `${counts.attendanceRejected} rejected as duplicate`
      : null,
    `${counts.adjustments} adjustment${counts.adjustments === 1 ? "" : "s"}`,
    `${counts.payments} payment${counts.payments === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return `merged ${label} [${loserId}] — ${parts.join(", ")}`;
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { writeAudit, writeAuditBatch } from "@/app/actions/audit";
import {
  canApprove,
  planBulkAssign,
  type BulkCandidate,
  type BulkSkip,
} from "@/lib/attendance";
import { getOfficer } from "@/lib/auth";
import { centralWallTimeToInstant } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";
import {
  attendanceEditSchema,
  attendanceRejectSchema,
  bulkAssignSchema,
  manualAttendanceSchema,
} from "@/lib/validation";

// Officer attendance-review mutations (§4.2, §7 Stage 5).
//
// Same house shape as app/actions/events.ts — read its header for why
// getOfficer() rather than requireOfficer(), and why every redirect() sits
// outside the try/catch. Service-role client throughout: attendance is deny-all
// under RLS until Stage 8.
//
// Two rules this file exists to keep, both of which are easy to lose:
//
//   1. `present_requires_resolution` is never worked around. Approving checks
//      canApprove() first so the officer gets a sentence instead of a 23514,
//      but the constraint stays the guarantee — if one ever reaches Postgres,
//      that is a bug here, not a case to handle.
//   2. Audit granularity follows officer intent. Assigning an event, linking a
//      member, fixing a typo'd name and approving is ONE click and ONE
//      `attendance.approved` row; before/after already say which columns moved.

const QUEUE = "/admin/attendance";

// ---------------------------------------------------------------------------
// Single-submission resolution
// ---------------------------------------------------------------------------

type ResolutionField =
  | "submittedName"
  | "submittedEid"
  | "submittedEmail"
  | "eventId"
  | "memberId"
  | "resolutionNote";

/**
 * The raw strings the officer submitted, echoed back.
 *
 * React 19 resets an uncontrolled `<form action={…}>` once the action
 * resolves, so any state that re-renders the form — a validation error, a
 * conflict, a missing link — would otherwise silently revert every field to the
 * value it had before the edit. Stage 4 shipped that bug once already.
 */
export type SubmittedResolutionValues = Record<ResolutionField, string>;

export type ResolutionState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  /** Someone else changed the row between the render and the save. */
  | { status: "conflict"; values: SubmittedResolutionValues }
  /** Approve was pressed with a link still missing. */
  | {
      status: "needs_links";
      missing: "event" | "member" | "both";
      values: SubmittedResolutionValues;
    }
  /** The assignment would be a second row for this person at this event. */
  | { status: "duplicate"; values: SubmittedResolutionValues }
  | { status: "saved"; values: SubmittedResolutionValues }
  | {
      status: "invalid";
      fieldErrors: Partial<Record<ResolutionField, string[]>>;
      values: SubmittedResolutionValues;
    };

/**
 * Save one submission — and, with `intent=approve`, approve it in the same
 * write.
 *
 * One save per officer intent: the officer fixes whatever is wrong and presses
 * one button, rather than assigning an event, saving, linking a member, saving
 * again, and approving third. That is also why there is a single audit row.
 */
export async function saveSubmission(
  _prev: ResolutionState,
  formData: FormData
): Promise<ResolutionState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const values = echoResolution(formData);
  const id = asString(formData.get("id"));
  const updatedAt = asString(formData.get("updatedAt"));
  const approve = asString(formData.get("intent")) === "approve";
  const returnTo = safeQueueUrl(formData.get("returnTo"));

  if (!id || !updatedAt) return { status: "error" };

  const parsed = attendanceEditSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "invalid",
      fieldErrors: fieldErrorsOf<ResolutionField>(parsed.error, "submittedName"),
      values,
    };
  }
  const fields = parsed.data;

  // canApprove() is the decision — the JS mirror of
  // present_requires_resolution — and missingLinks only phrases it.
  if (
    approve &&
    !canApprove({ event_id: fields.eventId, member_id: fields.memberId })
  ) {
    return {
      status: "needs_links",
      missing: missingLinks(fields.eventId, fields.memberId) ?? "both",
      values,
    };
  }

  try {
    const db = createAdminClient();

    const { data: before, error: readError } = await db
      .from("attendance")
      .select(
        "id, event_id, member_id, submitted_name, submitted_eid, " +
          "submitted_email, submitted_at, status, source, resolution_note, " +
          "resolved_by, resolved_at, updated_at"
      )
      .eq("id", id)
      .single();

    if (readError || !before) {
      console.error("saveSubmission: row not found:", readError?.message);
      return { status: "error" };
    }

    // normalized_eid is generated — writing it is a 428C9. Editing
    // submitted_eid is what moves it, which is also how this update can
    // collide with the partial unique index below.
    const patch = {
      submitted_name: fields.submittedName,
      submitted_eid: fields.submittedEid,
      submitted_email: fields.submittedEmail,
      event_id: fields.eventId,
      member_id: fields.memberId,
      resolution_note: fields.resolutionNote,
      ...(approve
        ? {
            status: "present",
            resolved_by: officer.userId,
            resolved_at: new Date().toISOString(),
          }
        : {}),
    };

    const { data: after, error } = await db
      .from("attendance")
      .update(patch)
      // updated_at is carried as the raw PostgREST string: it has microsecond
      // precision, and a Date round trip truncates to milliseconds, after which
      // this compare-and-set never matches and every save reports a phantom
      // conflict.
      .eq("id", id)
      .eq("updated_at", updatedAt)
      .select(
        "id, event_id, member_id, submitted_name, submitted_eid, " +
          "submitted_email, status, resolution_note, resolved_by, resolved_at"
      )
      .maybeSingle();

    if (error) {
      if (error.code === "23505") return { status: "duplicate", values };
      console.error("saveSubmission failed:", error.message);
      return { status: "error" };
    }
    // Zero rows back means another officer saved between the render and here.
    if (!after) return { status: "conflict", values };

    await writeAudit(db, {
      entityType: "attendance",
      entityId: id,
      actorId: officer.userId,
      action: approve ? "attendance.approved" : "attendance.updated",
      before,
      after,
    });

    revalidateAttendance(id);
  } catch (e) {
    console.error(
      "saveSubmission failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }

  // Outside the try/catch: redirect() signals by throwing NEXT_REDIRECT.
  // Approving drains the row from the queue, so the officer goes back to the
  // filtered list they were working; a plain save keeps them on the row.
  if (approve) redirect(returnTo);
  return { status: "saved", values };
}

export type ReviewActionState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  | { status: "conflict" }
  /** Reopening would collide with the row that replaced this one. */
  | { status: "slot_taken"; holderId: string | null; holderName: string | null }
  | { status: "done" };

/** Reject a submission (§7 Stage 5). A note is prompted for but not required. */
export async function rejectSubmission(
  _prev: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const updatedAt = asString(formData.get("updatedAt"));
  const returnTo = safeQueueUrl(formData.get("returnTo"));

  const parsed = attendanceRejectSchema.safeParse({
    id: formData.get("id"),
    resolutionNote: formData.get("resolutionNote") ?? "",
  });
  if (!parsed.success || !updatedAt) return { status: "error" };
  const { id, resolutionNote } = parsed.data;

  try {
    const db = createAdminClient();

    const { data: before, error: readError } = await db
      .from("attendance")
      .select("id, event_id, member_id, status, resolution_note, resolved_at")
      .eq("id", id)
      .single();
    if (readError || !before) {
      console.error("rejectSubmission: row not found:", readError?.message);
      return { status: "error" };
    }

    const { data: after, error } = await db
      .from("attendance")
      .update({
        status: "rejected",
        resolution_note: resolutionNote,
        resolved_by: officer.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("updated_at", updatedAt)
      .select("id, event_id, member_id, status, resolution_note, resolved_at")
      .maybeSingle();

    if (error) {
      console.error("rejectSubmission failed:", error.message);
      return { status: "error" };
    }
    if (!after) return { status: "conflict" };

    await writeAudit(db, {
      entityType: "attendance",
      entityId: id,
      actorId: officer.userId,
      action: "attendance.rejected",
      before,
      after,
    });

    revalidateAttendance(id);
  } catch (e) {
    console.error(
      "rejectSubmission failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }

  redirect(returnTo);
}

/**
 * Send a resolved row back to `pending`.
 *
 * ⚠️ This is the one review mutation that can fail on a duplicate. The partial
 * unique index excludes `rejected` rows, so while this row sat rejected a
 * corrected entry may have taken its `(event_id, normalized_eid)` slot —
 * reopening it then collides with a row the officer probably created on
 * purpose. The seed's `Mira Petrova` on `Alumni Panel` is exactly this shape.
 * Naming the holder is the difference between a fixable message and a SQLSTATE.
 */
export async function reopenSubmission(
  _prev: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const id = asString(formData.get("id"));
  const updatedAt = asString(formData.get("updatedAt"));
  if (!id || !updatedAt) return { status: "error" };

  try {
    const db = createAdminClient();

    const { data: before, error: readError } = await db
      .from("attendance")
      .select(
        "id, event_id, member_id, normalized_eid, status, resolved_by, resolved_at"
      )
      .eq("id", id)
      .single();
    if (readError || !before) {
      console.error("reopenSubmission: row not found:", readError?.message);
      return { status: "error" };
    }

    const { data: after, error } = await db
      .from("attendance")
      .update({ status: "pending", resolved_by: null, resolved_at: null })
      .eq("id", id)
      .eq("updated_at", updatedAt)
      .select("id, event_id, member_id, status, resolved_by, resolved_at")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        const holder = await findSlotHolder(
          db,
          before.event_id,
          before.normalized_eid,
          id
        );
        return {
          status: "slot_taken",
          holderId: holder?.id ?? null,
          holderName: holder?.submitted_name ?? null,
        };
      }
      console.error("reopenSubmission failed:", error.message);
      return { status: "error" };
    }
    if (!after) return { status: "conflict" };

    await writeAudit(db, {
      entityType: "attendance",
      entityId: id,
      actorId: officer.userId,
      action: "attendance.reopened",
      before,
      after,
    });

    revalidateAttendance(id);
    return { status: "done" };
  } catch (e) {
    console.error(
      "reopenSubmission failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

/** Who currently holds the `(event_id, normalized_eid)` slot a reopen
 * wanted. Best effort — a null name degrades the message, not the outcome. */
async function findSlotHolder(
  db: ReturnType<typeof createAdminClient>,
  eventId: string | null,
  normalizedEid: string | null,
  excludeId: string
): Promise<{ id: string; submitted_name: string } | null> {
  if (!eventId || !normalizedEid) return null;
  const { data } = await db
    .from("attendance")
    .select("id, submitted_name")
    .eq("event_id", eventId)
    .eq("normalized_eid", normalizedEid)
    .neq("status", "rejected")
    .neq("id", excludeId)
    .maybeSingle();
  return data ?? null;
}

// ---------------------------------------------------------------------------
// Bulk assignment
// ---------------------------------------------------------------------------

export type BulkAssignState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  | { status: "invalid"; message: string }
  | {
      status: "done";
      assigned: number;
      approved: number;
      skipped: BulkSkip[];
      /** Rows that lost the `status = 'pending'` filter mid-flight. */
      raced: number;
    };

/**
 * Assign many pending submissions to one event.
 *
 * Explicitly checked ids only — never "everything matching this filter", which
 * is the classic bug in this kind of screen and produces a partial write that
 * looks complete. Reports partial success rather than failing wholesale: one
 * unassignable row must not cost the officer the other forty.
 *
 * Scoped on `status = 'pending'` rather than a compare-and-set, per the
 * invariant: carrying 200 `updated_at` strings through a form buys nothing,
 * and requested-minus-updated is reported so a row someone else resolved
 * mid-selection is visible rather than silently missing.
 */
export async function bulkAssignEvent(
  _prev: BulkAssignState,
  formData: FormData
): Promise<BulkAssignState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const parsed = bulkAssignSchema.safeParse({
    eventId: formData.get("eventId"),
    ids: formData.getAll("ids"),
    approve: formData.get("approve") === "yes",
  });
  if (!parsed.success) {
    return {
      status: "invalid",
      message: parsed.error.issues[0]?.message ?? "Check the selection",
    };
  }
  const { eventId, ids, approve } = parsed.data;

  try {
    const db = createAdminClient();

    const { data: selected, error: selectedError } = await db
      .from("attendance")
      .select(
        "id, submitted_name, submitted_at, status, normalized_eid, member_id"
      )
      .in("id", ids);
    if (selectedError) {
      console.error("bulkAssignEvent: selection read failed:", selectedError.message);
      return { status: "error" };
    }

    // Rows already on the target event, so the plan can skip a person who is
    // there rather than letting the unique index refuse the whole statement.
    // `rejected` is excluded because the partial index excludes it too.
    const { data: existing, error: existingError } = await db
      .from("attendance")
      .select("normalized_eid, member_id")
      .eq("event_id", eventId)
      .neq("status", "rejected");
    if (existingError) {
      console.error("bulkAssignEvent: existing read failed:", existingError.message);
      return { status: "error" };
    }

    const candidates: BulkCandidate[] = (selected ?? []).map((row) => ({
      id: row.id,
      submittedName: row.submitted_name,
      submittedAt: row.submitted_at,
      status: row.status,
      normalizedEid: row.normalized_eid,
      memberId: row.member_id,
    }));

    const plan = planBulkAssign({
      selected: candidates,
      existingOnEvent: (existing ?? []).map((row) => ({
        normalizedEid: row.normalized_eid,
        memberId: row.member_id,
      })),
      approve,
    });

    const resolvedAt = new Date().toISOString();
    let assigned = 0;
    let approved = 0;

    // Two statements, not one. A row with no member cannot go 'present' —
    // present_requires_resolution would reject it — so it takes the event link
    // and stays pending for someone to finish.
    if (plan.assignOnly.length > 0) {
      const updated = await applyBulk(db, plan.assignOnly, { event_id: eventId });
      if (updated === null) return { status: "error" };
      assigned += updated.length;
      await writeAuditBatch(
        db,
        updated.map((row) => auditEntry(row.id, officer.userId, "attendance.updated", eventId, plan))
      );
    }

    if (plan.assignAndApprove.length > 0) {
      const updated = await applyBulk(db, plan.assignAndApprove, {
        event_id: eventId,
        status: "present",
        resolved_by: officer.userId,
        resolved_at: resolvedAt,
      });
      if (updated === null) return { status: "error" };
      assigned += updated.length;
      approved += updated.length;
      await writeAuditBatch(
        db,
        updated.map((row) => auditEntry(row.id, officer.userId, "attendance.approved", eventId, plan))
      );
    }

    const raced =
      plan.assignOnly.length + plan.assignAndApprove.length - assigned;

    revalidateAttendance(null);
    return { status: "done", assigned, approved, skipped: plan.skipped, raced };
  } catch (e) {
    console.error(
      "bulkAssignEvent failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

type AttendanceUpdate = Database["public"]["Tables"]["attendance"]["Update"];

async function applyBulk(
  db: ReturnType<typeof createAdminClient>,
  ids: string[],
  patch: AttendanceUpdate
): Promise<{ id: string }[] | null> {
  const { data, error } = await db
    .from("attendance")
    .update(patch)
    .in("id", ids)
    // The scope, not a CAS. Anything already resolved falls out here and is
    // counted as raced.
    .eq("status", "pending")
    .select("id");

  if (error) {
    console.error("bulk update failed:", error.message);
    return null;
  }
  return data;
}

/** Bulk operations reuse the single-row verbs and carry batch context in the
 * note, so a row's history reads the same however the change was made. */
function auditEntry(
  id: string,
  actorId: string,
  action: "attendance.updated" | "attendance.approved",
  eventId: string,
  plan: { assignOnly: string[]; assignAndApprove: string[] }
) {
  const total = plan.assignOnly.length + plan.assignAndApprove.length;
  return {
    entityType: "attendance" as const,
    entityId: id,
    actorId,
    action,
    after: { event_id: eventId },
    note: `bulk assign of ${total} submissions`,
  };
}

// ---------------------------------------------------------------------------
// Manual entry
// ---------------------------------------------------------------------------

export type ManualEntryState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  | { status: "duplicate"; memberName: string | null }
  | {
      status: "invalid";
      fieldErrors: Partial<
        Record<"eventId" | "memberId" | "date" | "time" | "resolutionNote", string[]>
      >;
    };

/**
 * Record attendance for someone who never used the form — the paper-sheet case
 * (§4.2). Written straight to `present`, so both links are required and
 * `source` marks it as an officer's doing rather than a member's.
 */
export async function createManualAttendance(
  _prev: ManualEntryState,
  formData: FormData
): Promise<ManualEntryState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const parsed = manualAttendanceSchema.safeParse({
    eventId: formData.get("eventId"),
    memberId: formData.get("memberId"),
    date: formData.get("date"),
    time: formData.get("time"),
    resolutionNote: formData.get("resolutionNote") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "invalid",
      fieldErrors: fieldErrorsOf(parsed.error, "eventId"),
    };
  }
  const fields = parsed.data;
  const returnTo = safeQueueUrl(formData.get("returnTo"));

  try {
    const db = createAdminClient();

    // submitted_* are NOT NULL and are the record of what was claimed, so a
    // manual row copies them from the roster rather than leaving them blank.
    const { data: member, error: memberError } = await db
      .from("members")
      .select("id, full_name, eid, email")
      .eq("id", fields.memberId)
      .single();
    if (memberError || !member) {
      return {
        status: "invalid",
        fieldErrors: { memberId: ["That member no longer exists"] },
      };
    }

    // Central wall clock to an instant (§4.7). Never new Date("…T18:00") — the
    // server runs in UTC.
    const submittedAt = centralWallTimeToInstant(fields.date, fields.time);

    const { data: created, error } = await db
      .from("attendance")
      .insert({
        event_id: fields.eventId,
        member_id: member.id,
        submitted_name: member.full_name,
        submitted_eid: member.eid,
        submitted_email: member.email,
        submitted_at: submittedAt.toISOString(),
        source: "admin_manual",
        status: "present",
        resolution_note: fields.resolutionNote,
        resolved_by: officer.userId,
        resolved_at: new Date().toISOString(),
      })
      .select("id, event_id, member_id, status, source, submitted_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { status: "duplicate", memberName: member.full_name };
      }
      console.error("createManualAttendance failed:", error.message);
      return { status: "error" };
    }

    await writeAudit(db, {
      entityType: "attendance",
      entityId: created.id,
      actorId: officer.userId,
      action: "attendance.created",
      after: created,
      note: "entered by an officer",
    });

    revalidateAttendance(created.id);
  } catch (e) {
    console.error(
      "createManualAttendance failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }

  redirect(returnTo);
}

// ---------------------------------------------------------------------------

function missingLinks(
  eventId: string | null,
  memberId: string | null
): "event" | "member" | "both" | null {
  if (!eventId && !memberId) return "both";
  if (!eventId) return "event";
  if (!memberId) return "member";
  return null;
}

function echoResolution(formData: FormData): SubmittedResolutionValues {
  const read = (name: ResolutionField) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  return {
    submittedName: read("submittedName"),
    submittedEid: read("submittedEid"),
    submittedEmail: read("submittedEmail"),
    eventId: read("eventId"),
    memberId: read("memberId"),
    resolutionNote: read("resolutionNote"),
  };
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
 * Where to send an officer after a row leaves the queue.
 *
 * The value rides in a hidden input so the filtered view survives the round
 * trip, which makes it attacker-supplied — the same open-redirect shape as
 * safeNext() in app/actions/auth.ts, and refused the same way. Only the queue
 * path with a query string is allowed.
 */
function safeQueueUrl(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string" || raw === "") return QUEUE;
  if (raw !== QUEUE && !raw.startsWith(`${QUEUE}?`)) return QUEUE;
  if (raw.includes("\\") || raw.startsWith("//")) return QUEUE;
  return raw;
}

function revalidateAttendance(id: string | null) {
  revalidatePath(QUEUE);
  if (id) revalidatePath(`${QUEUE}/${id}`);
  // Approving changes point totals, and /admin is where the pending badge is.
  revalidatePath("/admin");
}

function asString(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

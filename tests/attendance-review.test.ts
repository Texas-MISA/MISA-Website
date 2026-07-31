import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { writeAudit } from "@/app/actions/audit";
import { planBulkAssign } from "@/lib/attendance";

import {
  at,
  claimSlot,
  cleanup,
  countAuditRows,
  createCurrentTermEvent,
  createTestAttendance,
  createTestEvent,
  createTestMember,
  getTestOfficer,
  latestAuditRow,
  newTracker,
  testClient,
  testIdentity,
  type Tracker,
} from "./helpers";

// Integration tests for the Stage 5 review mutations, against the LOCAL stack.
//
// As in tests/event-actions.test.ts, the "use server" exports in
// app/actions/attendance-review.ts are not called directly — they need a
// request context for cookies. What is tested here is the database behaviour
// those actions depend on and the exact statement sequences they run, so a
// change that breaks the contract fails here rather than in a browser.

const db = testClient();
const track: Tracker = newTracker();
let officerId: string;

beforeAll(async () => {
  officerId = await getTestOfficer(db);
});

afterAll(async () => {
  await cleanup(db, track);
});

describe("the updated_at compare-and-set", () => {
  it("bumps updated_at on every attendance update", async () => {
    // Migration 13 added the column and the trigger. If the trigger were
    // missing, the CAS below would pass forever and two officers would silently
    // overwrite each other — the failure mode is invisible without this.
    const identity = testIdentity();
    const row = await createTestAttendance(db, track, {
      submittedName: identity.fullName,
      submittedStudentId: identity.studentId,
      submittedEmail: identity.email,
      submittedAt: at(claimSlot(), 20),
    });

    const { data: after } = await db
      .from("attendance")
      .update({ resolution_note: "touched" })
      .eq("id", row.id)
      .select("updated_at")
      .single();

    expect(after!.updated_at).not.toBe(row.updated_at);
  });

  it("lets the first writer win and returns zero rows to the second", async () => {
    const identity = testIdentity();
    const row = await createTestAttendance(db, track, {
      submittedName: identity.fullName,
      submittedStudentId: identity.studentId,
      submittedEmail: identity.email,
      submittedAt: at(claimSlot(), 20),
    });

    // Both officers rendered the page at the same moment, so both hold the
    // same token.
    const token = row.updated_at;

    const { data: first } = await db
      .from("attendance")
      .update({ resolution_note: "first officer" })
      .eq("id", row.id)
      .eq("updated_at", token)
      .select("id")
      .maybeSingle();

    const { data: second } = await db
      .from("attendance")
      .update({ resolution_note: "second officer" })
      .eq("id", row.id)
      .eq("updated_at", token)
      .select("id")
      .maybeSingle();

    expect(first).not.toBeNull();
    // Zero rows, not an error — which is why the action checks for a null row
    // rather than only for `error`.
    expect(second).toBeNull();

    const { data: final } = await db
      .from("attendance")
      .select("resolution_note")
      .eq("id", row.id)
      .single();
    expect(final!.resolution_note).toBe("first officer");
  });

  it("survives the microsecond precision a Date round trip would lose", async () => {
    const identity = testIdentity();
    const row = await createTestAttendance(db, track, {
      submittedName: identity.fullName,
      submittedStudentId: identity.studentId,
      submittedEmail: identity.email,
      submittedAt: at(claimSlot(), 20),
    });

    // The invariant as a test: carrying updated_at through a JS Date truncates
    // to milliseconds, after which the CAS never matches and every save reports
    // a phantom conflict.
    const truncated = new Date(row.updated_at).toISOString();
    const { data: withTruncated } = await db
      .from("attendance")
      .update({ resolution_note: "should not apply" })
      .eq("id", row.id)
      .eq("updated_at", truncated)
      .select("id")
      .maybeSingle();

    const { data: withRaw } = await db
      .from("attendance")
      .update({ resolution_note: "applies" })
      .eq("id", row.id)
      .eq("updated_at", row.updated_at)
      .select("id")
      .maybeSingle();

    expect(withTruncated).toBeNull();
    expect(withRaw).not.toBeNull();
  });
});

describe("approving", () => {
  it("refuses to make a row present with a link missing", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();
    const row = await createTestAttendance(db, track, {
      eventId: event.id,
      submittedName: identity.fullName,
      submittedStudentId: identity.studentId,
      submittedEmail: identity.email,
      submittedAt: at(slot, 20),
    });

    // canApprove() exists so the officer gets a sentence instead of this, but
    // present_requires_resolution is the actual guarantee (§4.1).
    const { error } = await db
      .from("attendance")
      .update({ status: "present" })
      .eq("id", row.id);

    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("present_requires_resolution");
  });

  it("moves the leaderboard once both links are set", async () => {
    // Needs a current-term event: both views filter e.term = current_term(),
    // so the 2030 fixtures would make this assertion pass at zero.
    const event = await createCurrentTermEvent(db, track, { points: 3 });
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);

    const before = await leaderboardTotal(memberId);

    const row = await createTestAttendance(db, track, {
      eventId: event.id,
      memberId,
      submittedName: identity.fullName,
      submittedStudentId: identity.studentId,
      submittedEmail: identity.email,
      submittedAt: new Date(),
    });

    const { error } = await db
      .from("attendance")
      .update({
        status: "present",
        resolved_by: officerId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("updated_at", row.updated_at);

    expect(error).toBeNull();
    expect(await leaderboardTotal(memberId)).toBe(before + 3);
  });

  it("writes one audit row for an assign-and-approve", async () => {
    const event = await createCurrentTermEvent(db, track);
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);
    const row = await createTestAttendance(db, track, {
      submittedName: identity.fullName,
      submittedStudentId: identity.studentId,
      submittedEmail: identity.email,
      submittedAt: new Date(),
    });

    await db
      .from("attendance")
      .update({ event_id: event.id, member_id: memberId, status: "present" })
      .eq("id", row.id);

    // Granularity follows officer intent, not columns: linking both and
    // approving is one click and one row.
    await writeAudit(db, {
      entityType: "attendance",
      entityId: row.id,
      actorId: officerId,
      action: "attendance.approved",
      before: { status: "pending", event_id: null, member_id: null },
      after: { status: "present", event_id: event.id, member_id: memberId },
    });

    expect(await countAuditRows(db, "attendance", row.id)).toBe(1);
    expect((await latestAuditRow(db, "attendance", row.id))!.action).toBe(
      "attendance.approved"
    );
  });
});

describe("reopening a rejected row", () => {
  it("collides when a corrected row has taken the slot", async () => {
    // The seed's Mira Petrova shape. The partial unique index excludes
    // `rejected`, so a rejected duplicate and its replacement coexist happily
    // until someone reopens the old one.
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);

    const rejected = await createTestAttendance(db, track, {
      eventId: event.id,
      memberId,
      submittedName: identity.fullName,
      submittedStudentId: identity.studentId,
      submittedEmail: identity.email,
      submittedAt: at(slot, 18.1),
      status: "rejected",
    });

    // The corrected entry that now holds (event_id, normalized_student_id).
    const kept = await createTestAttendance(db, track, {
      eventId: event.id,
      memberId,
      submittedName: identity.fullName,
      submittedStudentId: identity.studentId,
      submittedEmail: identity.email,
      submittedAt: at(slot, 18.2),
      status: "present",
    });

    const { error } = await db
      .from("attendance")
      .update({ status: "pending", resolved_by: null, resolved_at: null })
      .eq("id", rejected.id)
      .eq("updated_at", rejected.updated_at);

    expect(error?.code).toBe("23505");

    // And the action's holder lookup finds the row to name in the message.
    const { data: holder } = await db
      .from("attendance")
      .select("id")
      .eq("event_id", event.id)
      .eq("normalized_student_id", identity.studentId.toUpperCase().replace(/[\s-]/g, ""))
      .neq("status", "rejected")
      .neq("id", rejected.id)
      .maybeSingle();
    expect(holder!.id).toBe(kept.id);
  });

  it("reopens cleanly when nothing holds the slot", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();
    const row = await createTestAttendance(db, track, {
      eventId: event.id,
      submittedName: identity.fullName,
      submittedStudentId: identity.studentId,
      submittedEmail: identity.email,
      submittedAt: at(slot, 18.1),
      status: "rejected",
    });

    const { data, error } = await db
      .from("attendance")
      .update({ status: "pending", resolved_by: null, resolved_at: null })
      .eq("id", row.id)
      .eq("updated_at", row.updated_at)
      .select("status, resolved_at")
      .maybeSingle();

    expect(error).toBeNull();
    expect(data!.status).toBe("pending");
    expect(data!.resolved_at).toBeNull();
  });
});

describe("bulk assignment", () => {
  it("does not 23505 on two selected rows that are the same person", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();

    // Same person, two submissions, two raw formats — the shape that makes an
    // unguarded bulk assign fail halfway.
    const first = await createTestAttendance(db, track, {
      submittedName: identity.fullName,
      submittedStudentId: identity.studentId,
      submittedEmail: identity.email,
      submittedAt: at(slot, 20),
    });
    const second = await createTestAttendance(db, track, {
      submittedName: identity.fullName,
      submittedStudentId: identity.studentId.replace("-", " "),
      submittedEmail: identity.email,
      submittedAt: at(slot, 21),
    });

    const { data: selected } = await db
      .from("attendance")
      .select("id, submitted_name, submitted_at, status, normalized_student_id, member_id")
      .in("id", [first.id, second.id]);

    const plan = planBulkAssign({
      selected: selected!.map((r) => ({
        id: r.id,
        submittedName: r.submitted_name,
        submittedAt: r.submitted_at,
        status: r.status,
        normalizedStudentId: r.normalized_student_id,
        memberId: r.member_id,
      })),
      existingOnEvent: [],
      approve: false,
    });

    expect(plan.assignOnly).toEqual([first.id]);
    expect(plan.skipped[0]).toMatchObject({ reason: "duplicate_in_selection" });

    const { error } = await db
      .from("attendance")
      .update({ event_id: event.id })
      .in("id", plan.assignOnly)
      .eq("status", "pending")
      .select("id");

    expect(error).toBeNull();

    // Applying the whole selection is what the plan prevents; prove the index
    // would in fact have refused it.
    const { error: wouldFail } = await db
      .from("attendance")
      .update({ event_id: event.id })
      .in("id", [second.id])
      .eq("status", "pending");
    expect(wouldFail?.code).toBe("23505");
  });

  it("leaves a row someone else resolved untouched, and counts it", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identityA = testIdentity();
    const identityB = testIdentity();

    const stillPending = await createTestAttendance(db, track, {
      submittedName: identityA.fullName,
      submittedStudentId: identityA.studentId,
      submittedEmail: identityA.email,
      submittedAt: at(slot, 20),
    });
    const alreadyRejected = await createTestAttendance(db, track, {
      submittedName: identityB.fullName,
      submittedStudentId: identityB.studentId,
      submittedEmail: identityB.email,
      submittedAt: at(slot, 21),
      status: "rejected",
    });

    // Bulk operations scope on status rather than carrying an updated_at per
    // row; requested-minus-updated is what makes the skip visible.
    const requested = [stillPending.id, alreadyRejected.id];
    const { data: updated } = await db
      .from("attendance")
      .update({ event_id: event.id })
      .in("id", requested)
      .eq("status", "pending")
      .select("id");

    expect(updated!.map((r) => r.id)).toEqual([stillPending.id]);
    expect(requested.length - updated!.length).toBe(1);
  });
});

describe("manual entry", () => {
  it("records a present row marked as an officer's doing", async () => {
    const event = await createCurrentTermEvent(db, track, { points: 2 });
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);

    const { data, error } = await db
      .from("attendance")
      .insert({
        event_id: event.id,
        member_id: memberId,
        submitted_name: identity.fullName,
        submitted_student_id: identity.studentId,
        submitted_email: identity.email,
        submitted_at: new Date().toISOString(),
        source: "admin_manual",
        status: "present",
        resolution_note: "Signed the paper sheet",
        resolved_by: officerId,
        resolved_at: new Date().toISOString(),
      })
      .select("id, source, status")
      .single();

    expect(error).toBeNull();
    track.attendanceIds.push(data!.id);
    expect(data!.source).toBe("admin_manual");
    expect(data!.status).toBe("present");
    expect(await leaderboardTotal(memberId)).toBe(2);
  });

  it("refuses a second manual row for the same member at the same event", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);

    const base = {
      event_id: event.id,
      member_id: memberId,
      submitted_name: identity.fullName,
      submitted_student_id: identity.studentId,
      submitted_email: identity.email,
      source: "admin_manual",
      status: "present",
    };

    const { data: first } = await db
      .from("attendance")
      .insert({ ...base, submitted_at: at(slot, 18.5).toISOString() })
      .select("id")
      .single();
    track.attendanceIds.push(first!.id);

    const { error } = await db
      .from("attendance")
      .insert({ ...base, submitted_at: at(slot, 18.6).toISOString() });

    expect(error?.code).toBe("23505");
  });
});

async function leaderboardTotal(memberId: string): Promise<number> {
  const { data, error } = await db
    .from("leaderboard")
    .select("total_points")
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw new Error(`leaderboard read failed: ${error.message}`);
  return data?.total_points ?? 0;
}

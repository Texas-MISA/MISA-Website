import { afterAll, describe, expect, it } from "vitest";

import { normalizeStudentId, resolveCheckin } from "@/lib/checkin";

import {
  adoptMemberByNormalizedId,
  at,
  claimSlot,
  cleanup,
  createTestEvent,
  createTestMember,
  newTracker,
  testClient,
  testIdentity,
} from "./helpers";

// §7 Stage 3 test cases, run against the local stack with injected
// timestamps — the wall clock is never consulted, and the half-open window
// semantics are exercised in the real SQL, not a mock.

const db = testClient();
const track = newTracker();

afterAll(() => cleanup(db, track));

async function attendanceRows(filter: {
  eventId?: string | null;
  memberId?: string;
}) {
  let q = db
    .from("attendance")
    .select("id, event_id, member_id, status, submitted_student_id");
  if (filter.eventId !== undefined) {
    q =
      filter.eventId === null ? q.is("event_id", null) : q.eq("event_id", filter.eventId);
  }
  if (filter.memberId !== undefined) q = q.eq("member_id", filter.memberId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

describe("window resolution", () => {
  it("during the window with a known member → present on the correct event", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);

    const result = await resolveCheckin(db, identity, at(slot, 18.5));

    expect(result).toEqual({ status: "present", eventTitle: event.title });
    const rows = await attendanceRows({ eventId: event.id });
    expect(rows).toHaveLength(1);
    expect(rows[0].member_id).toBe(memberId);
    expect(rows[0].status).toBe("present");
  });

  it("before the window opens (within 48h) → pending orphan", async () => {
    const slot = claimSlot();
    await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);

    const result = await resolveCheckin(db, identity, at(slot, 17));

    expect(result).toEqual({ status: "pending" });
    const rows = await attendanceRows({ memberId });
    expect(rows).toHaveLength(1);
    expect(rows[0].event_id).toBeNull();
    expect(rows[0].status).toBe("pending");
  });

  it("at the exact opening instant → present (lower bound inclusive)", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();
    await createTestMember(db, track, identity);

    const result = await resolveCheckin(db, identity, at(slot, 18));

    expect(result).toEqual({ status: "present", eventTitle: event.title });
  });

  it("at the exact closing instant → not this event (upper bound exclusive)", async () => {
    const slot = claimSlot();
    await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);

    const result = await resolveCheckin(db, identity, at(slot, 19));

    // No open event at 19:00 sharp, but well within the grace window.
    expect(result).toEqual({ status: "pending" });
    const rows = await attendanceRows({ memberId });
    expect(rows[0].event_id).toBeNull();
  });

  it("an hour after the window closes → pending (exit criterion b)", async () => {
    const slot = claimSlot();
    await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();
    await createTestMember(db, track, identity);

    const result = await resolveCheckin(db, identity, at(slot, 20));

    expect(result).toEqual({ status: "pending" });
  });

  it("just inside vs just outside the 48h orphan window", async () => {
    const slot = claimSlot();
    await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);

    // ends 19:00 + 47h59m → still inside the grace window.
    const inside = await resolveCheckin(db, identity, at(slot, 19 + 47.98));
    expect(inside).toEqual({ status: "pending" });

    // ends + 49h → outside: refused, and nothing written — same person, so
    // a regression that still inserted would show up in the row count.
    const before = await attendanceRows({ memberId });
    const outside = await resolveCheckin(db, identity, at(slot, 19 + 49));
    expect(outside).toEqual({ status: "refused" });
    const after = await attendanceRows({ memberId });
    expect(after).toHaveLength(before.length);
  });

  it("back-to-back events: the shared instant belongs to exactly one", async () => {
    const slot = claimSlot();
    const a = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
      title: `TEST back-to-back A ${slot}`,
    });
    const b = await createTestEvent(db, track, {
      starts: at(slot, 19),
      ends: at(slot, 20),
      title: `TEST back-to-back B ${slot}`,
    });

    const atBoundary = testIdentity();
    await createTestMember(db, track, atBoundary);
    const boundaryResult = await resolveCheckin(db, atBoundary, at(slot, 19));
    expect(boundaryResult).toEqual({ status: "present", eventTitle: b.title });

    const beforeBoundary = testIdentity();
    await createTestMember(db, track, beforeBoundary);
    const justBefore = await resolveCheckin(
      db,
      beforeBoundary,
      new Date(at(slot, 19).getTime() - 1000)
    );
    expect(justBefore).toEqual({ status: "present", eventTitle: a.title });

    const aRows = await attendanceRows({ eventId: a.id });
    const bRows = await attendanceRows({ eventId: b.id });
    expect(aRows).toHaveLength(1);
    expect(bRows).toHaveLength(1);
  });
});

describe("duplicates", () => {
  it("same ID twice at the same event → duplicate, one row", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();
    await createTestMember(db, track, identity);

    const first = await resolveCheckin(db, identity, at(slot, 18.2));
    expect(first.status).toBe("present");

    const second = await resolveCheckin(db, identity, at(slot, 18.4));
    expect(second).toEqual({ status: "duplicate", prior: "present" });

    expect(await attendanceRows({ eventId: event.id })).toHaveLength(1);
  });

  it("unique-index path: officer-queued row with no member link still blocks", async () => {
    // An admin-entered pending row can carry a normalized ID with no
    // member_id; the app-level (event_id, member_id) check can't see it, so
    // the insert must hit attendance_one_per_event and report the prior
    // pending row.
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();

    const direct = await db.from("attendance").insert({
      event_id: event.id,
      member_id: null,
      submitted_name: identity.fullName,
      submitted_student_id: identity.studentId,
      submitted_email: identity.email,
      submitted_at: at(slot, 18.1).toISOString(),
      source: "admin_manual",
      status: "pending",
    });
    expect(direct.error).toBeNull();

    const result = await resolveCheckin(db, identity, at(slot, 18.5));
    expect(result).toEqual({ status: "duplicate", prior: "pending" });
    await adoptMemberByNormalizedId(db, track, normalizeStudentId(identity.studentId));

    expect(await attendanceRows({ eventId: event.id })).toHaveLength(1);
  });

  it("second orphan inside the grace window → duplicate, one queue row", async () => {
    const slot = claimSlot();
    await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);

    const first = await resolveCheckin(db, identity, at(slot, 20));
    expect(first).toEqual({ status: "pending" });

    const second = await resolveCheckin(db, identity, at(slot, 20.1));
    expect(second).toEqual({ status: "duplicate", prior: "pending" });

    expect(await attendanceRows({ memberId })).toHaveLength(1);
  });

  it("a prior pending orphan never blocks an event-resolved submission", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);

    // Too early → orphan queued.
    const orphan = await resolveCheckin(db, identity, at(slot, 16));
    expect(orphan).toEqual({ status: "pending" });

    // During the window → present; the orphan must survive untouched
    // (never auto-resolved, §7 Stage 5 invariant).
    const present = await resolveCheckin(db, identity, at(slot, 18.5));
    expect(present).toEqual({ status: "present", eventTitle: event.title });

    const rows = await attendanceRows({ memberId });
    expect(rows).toHaveLength(2);
    const statuses = rows.map((r) => r.status).sort();
    expect(statuses).toEqual(["pending", "present"]);
    expect(rows.find((r) => r.status === "pending")!.event_id).toBeNull();
  });

  it("same member via two raw IDs (email-matched typo) → duplicate", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);

    // Typo'd ID, correct email → email match links to the existing member.
    const typo = await resolveCheckin(
      db,
      { ...identity, studentId: `${identity.studentId}9` },
      at(slot, 18.2)
    );
    expect(typo.status).toBe("present");

    // Correct ID now → different normalized ID, same member. The unique
    // index can't see this one; the (event_id, member_id) guard must.
    const correct = await resolveCheckin(db, identity, at(slot, 18.4));
    expect(correct).toEqual({ status: "duplicate", prior: "present" });

    const rows = await attendanceRows({ eventId: event.id });
    expect(rows).toHaveLength(1);
    expect(rows[0].member_id).toBe(memberId);
  });
});

describe("member resolution", () => {
  it("unknown ID during a window → member self-registered and present", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity(); // never inserted as a member

    const result = await resolveCheckin(db, identity, at(slot, 18.5));
    expect(result).toEqual({ status: "present", eventTitle: event.title });

    const normalized = normalizeStudentId(identity.studentId);
    const { data: member } = await db
      .from("members")
      .select("id, source, active, full_name")
      .eq("normalized_student_id", normalized)
      .single();
    await adoptMemberByNormalizedId(db, track, normalized);

    expect(member?.source).toBe("self_checkin");
    expect(member?.active).toBe(true);

    const rows = await attendanceRows({ eventId: event.id });
    expect(rows[0].member_id).toBe(member!.id);
  });

  it("typo'd ID with a known email links to the existing member", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);

    const submitted = {
      ...identity,
      studentId: `${identity.studentId}7`, // wrong ID
      email: identity.email.toUpperCase(), // and case-mangled email
    };
    const result = await resolveCheckin(db, submitted, at(slot, 18.5));
    expect(result.status).toBe("present");

    // Linked to the existing member — no duplicate person created.
    const rows = await attendanceRows({ eventId: event.id });
    expect(rows[0].member_id).toBe(memberId);
    const { count } = await db
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("normalized_student_id", normalizeStudentId(submitted.studentId));
    expect(count).toBe(0);
  });

  it("ID formatting variants all resolve to the same member", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity(); // studentId like T3-123456
    const memberId = await createTestMember(db, track, identity);
    const digits = identity.studentId.replace(/^T3-/, "");

    const variants = [
      `t3 ${digits}`,
      `T3${digits}`,
      ` t3-${digits} `,
    ];

    const first = await resolveCheckin(
      db,
      { ...identity, studentId: variants[0], email: "other@example.edu" },
      at(slot, 18.2)
    );
    expect(first.status).toBe("present");
    const rows = await attendanceRows({ eventId: event.id });
    expect(rows[0].member_id).toBe(memberId);

    // Every other variant is now a duplicate of the same person.
    for (const variant of variants.slice(1)) {
      const result = await resolveCheckin(
        db,
        { ...identity, studentId: variant, email: "other@example.edu" },
        at(slot, 18.5)
      );
      expect(result).toEqual({ status: "duplicate", prior: "present" });
    }
  });
});

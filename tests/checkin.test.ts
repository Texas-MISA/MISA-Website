import { afterAll, describe, expect, it } from "vitest";

import { normalizeEid, resolveCheckin } from "@/lib/checkin";

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

type Identity = { fullName: string; eid: string; email: string };

// The three ways a submission can arrive, spelled out at every call site.
// Deliberately local rather than folded into testIdentity(): that helper is
// shared with the other suites, and a default would make `declaredNew: false`
// invisible boilerplate at exactly the call sites whose meaning depends on it.

/** Box unchecked — "I've been here before". The overwhelmingly common case. */
function returning(identity: Identity) {
  return { ...identity, declaredNew: false, confirmed: false };
}

/** Ticked "this is my first MISA event", first pass. */
function asNew(identity: Identity) {
  return { ...identity, declaredNew: true, confirmed: false };
}

/** ...and confirmed on the review screen. The only path that can create. */
function confirmedNew(identity: Identity) {
  return { ...identity, declaredNew: true, confirmed: true };
}

async function attendanceRows(filter: {
  eventId?: string | null;
  memberId?: string;
}) {
  let q = db
    .from("attendance")
    .select("id, event_id, member_id, status, submitted_eid");
  if (filter.eventId !== undefined) {
    q =
      filter.eventId === null ? q.is("event_id", null) : q.eq("event_id", filter.eventId);
  }
  if (filter.memberId !== undefined) q = q.eq("member_id", filter.memberId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Whole-table counts. Test files never run concurrently (fileParallelism is
 * false) and `it`s within a file are serial, so these are stable — which makes
 * "nothing was written anywhere" an assertion rather than an inference.
 */
async function countRows(table: "attendance" | "members"): Promise<number> {
  const { count, error } = await db
    .from(table)
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
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

    const result = await resolveCheckin(db, returning(identity), at(slot, 18.5));

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

    const result = await resolveCheckin(db, returning(identity), at(slot, 17));

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

    const result = await resolveCheckin(db, returning(identity), at(slot, 18));

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

    const result = await resolveCheckin(db, returning(identity), at(slot, 19));

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

    const result = await resolveCheckin(db, returning(identity), at(slot, 20));

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
    const inside = await resolveCheckin(db, returning(identity), at(slot, 19 + 47.98));
    expect(inside).toEqual({ status: "pending" });

    // ends + 49h → outside: refused, and nothing written — same person, so
    // a regression that still inserted would show up in the row count.
    const before = await attendanceRows({ memberId });
    const outside = await resolveCheckin(db, returning(identity), at(slot, 19 + 49));
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
    const boundaryResult = await resolveCheckin(
      db,
      returning(atBoundary),
      at(slot, 19)
    );
    expect(boundaryResult).toEqual({ status: "present", eventTitle: b.title });

    const beforeBoundary = testIdentity();
    await createTestMember(db, track, beforeBoundary);
    const justBefore = await resolveCheckin(
      db,
      returning(beforeBoundary),
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

    const first = await resolveCheckin(db, returning(identity), at(slot, 18.2));
    expect(first.status).toBe("present");

    const second = await resolveCheckin(db, returning(identity), at(slot, 18.4));
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
    // On the roster: check-in no longer creates members on the returning
    // path, and this test is about the index, not about member resolution.
    const identity = testIdentity();
    await createTestMember(db, track, identity);

    const direct = await db.from("attendance").insert({
      event_id: event.id,
      member_id: null,
      submitted_name: identity.fullName,
      submitted_eid: identity.eid,
      submitted_email: identity.email,
      submitted_at: at(slot, 18.1).toISOString(),
      source: "admin_manual",
      status: "pending",
    });
    expect(direct.error).toBeNull();

    const result = await resolveCheckin(db, returning(identity), at(slot, 18.5));
    expect(result).toEqual({ status: "duplicate", prior: "pending" });

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

    const first = await resolveCheckin(db, returning(identity), at(slot, 20));
    expect(first).toEqual({ status: "pending" });

    const second = await resolveCheckin(db, returning(identity), at(slot, 20.1));
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
    const orphan = await resolveCheckin(db, returning(identity), at(slot, 16));
    expect(orphan).toEqual({ status: "pending" });

    // During the window → present; the orphan must survive untouched
    // (never auto-resolved, §7 Stage 5 invariant).
    const present = await resolveCheckin(db, returning(identity), at(slot, 18.5));
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
    // This also guards the ordering `unmatched` could break: the email
    // fallback has to run before any miss is reported, or this becomes
    // `unmatched` and the member is turned away instead of recognized.
    const typo = await resolveCheckin(
      db,
      returning({ ...identity, eid: `${identity.eid}9` }),
      at(slot, 18.2)
    );
    expect(typo.status).toBe("present");

    // Correct ID now → different normalized ID, same member. The unique
    // index can't see this one; the (event_id, member_id) guard must.
    const correct = await resolveCheckin(db, returning(identity), at(slot, 18.4));
    expect(correct).toEqual({ status: "duplicate", prior: "present" });

    const rows = await attendanceRows({ eventId: event.id });
    expect(rows).toHaveLength(1);
    expect(rows[0].member_id).toBe(memberId);
  });
});

describe("member resolution", () => {
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
      eid: `${identity.eid}7`, // wrong ID
      email: identity.email.toUpperCase(), // and case-mangled email
    };
    const result = await resolveCheckin(db, returning(submitted), at(slot, 18.5));
    expect(result.status).toBe("present");

    // Linked to the existing member — no duplicate person created.
    const rows = await attendanceRows({ eventId: event.id });
    expect(rows[0].member_id).toBe(memberId);
    const { count } = await db
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("normalized_eid", normalizeEid(submitted.eid));
    expect(count).toBe(0);
  });

  it("ID formatting variants all resolve to the same member", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity(); // eid like t3q1234560
    const memberId = await createTestMember(db, track, identity);
    const body = identity.eid.replace(/^t3q/, "");

    // Case is the axis that matters now — a real EID contains no punctuation,
    // and members type theirs in whatever case their keyboard was in. The
    // stray space and hyphen are still exercised because the generated column
    // still strips them and pasted values still carry them.
    const variants = [
      `T3Q${body}`,
      `t3q ${body}`,
      ` T3q-${body} `,
    ];

    // The literal email is safe only because every call here is `returning()`
    // and matches by ID — nothing is created. Never reuse it on a confirmed
    // path: members_email_lower is unique and the local database is not reset
    // between runs, so one created row would poison every later run.
    const first = await resolveCheckin(
      db,
      returning({ ...identity, eid: variants[0], email: "other@example.edu" }),
      at(slot, 18.2)
    );
    expect(first.status).toBe("present");
    const rows = await attendanceRows({ eventId: event.id });
    expect(rows[0].member_id).toBe(memberId);

    // Every other variant is now a duplicate of the same person.
    for (const variant of variants.slice(1)) {
      const result = await resolveCheckin(
        db,
        returning({ ...identity, eid: variant, email: "other@example.edu" }),
        at(slot, 18.5)
      );
      expect(result).toEqual({ status: "duplicate", prior: "present" });
    }
  });

  it("a lookup outage is an error, never `unmatched`", async () => {
    // The single most damaging way this refactor could go wrong: reporting a
    // transient database fault as "we don't have that info on file" would
    // turn a whole room away with no attendance and no trace. `unmatched` has
    // to mean "definitely not on the roster", not "we couldn't tell".
    const slot = claimSlot();
    await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();
    await createTestMember(db, track, identity);

    const result = await resolveCheckin(
      brokenMemberLookup(),
      returning(identity),
      at(slot, 18.5)
    );
    expect(result).toEqual({ status: "error" });
  });
});

describe("first-time confirmation (§4.2, docs/attend-confirmation-flow.md)", () => {
  it("no roster match, box unchecked → unmatched, and NOTHING is written", async () => {
    const slot = claimSlot();
    await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity(); // on no roster, by either key

    const attendanceBefore = await countRows("attendance");
    const membersBefore = await countRows("members");

    const result = await resolveCheckin(db, returning(identity), at(slot, 18.5));
    expect(result).toEqual({ status: "unmatched" });

    // The assertion that matters most. Checking only the returned status
    // would pass while the roster quietly grew a row per typo.
    expect(await countRows("attendance")).toBe(attendanceBefore);
    expect(await countRows("members")).toBe(membersBefore);
  });

  it("re-prompting forever still writes nothing", async () => {
    const slot = claimSlot();
    await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });

    const attendanceBefore = await countRows("attendance");
    const membersBefore = await countRows("members");

    // Someone who cannot get their details right gets no attendance and
    // leaves no trace — accepted, with officer manual entry as the recovery
    // path. There is no two-strikes fallback.
    for (let i = 0; i < 3; i++) {
      const result = await resolveCheckin(
        db,
        returning(testIdentity()),
        at(slot, 18.5)
      );
      expect(result).toEqual({ status: "unmatched" });
    }

    expect(await countRows("attendance")).toBe(attendanceBefore);
    expect(await countRows("members")).toBe(membersBefore);
  });

  it("box checked, unknown → confirmation first, writing nothing", async () => {
    const slot = claimSlot();
    await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();

    const attendanceBefore = await countRows("attendance");
    const membersBefore = await countRows("members");

    const result = await resolveCheckin(db, asNew(identity), at(slot, 18.5));
    expect(result).toEqual({ status: "needs_confirmation", existing: false });

    // Closing the tab at the review screen means it did not happen.
    expect(await countRows("attendance")).toBe(attendanceBefore);
    expect(await countRows("members")).toBe(membersBefore);
  });

  it("box checked, unknown, confirmed → creates the member with exactly the typed values", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();

    const result = await resolveCheckin(db, confirmedNew(identity), at(slot, 18.5));
    expect(result).toEqual({ status: "present", eventTitle: event.title });

    const normalized = normalizeEid(identity.eid);
    const { data: member } = await db
      .from("members")
      .select("id, source, full_name, eid, email")
      .eq("normalized_eid", normalized)
      .single();
    await adoptMemberByNormalizedId(db, track, normalized);

    expect(member?.source).toBe("self_checkin");
    expect(member?.full_name).toBe(identity.fullName);
    expect(member?.eid).toBe(identity.eid);
    expect(member?.email).toBe(identity.email);

    const rows = await attendanceRows({ eventId: event.id });
    expect(rows[0].member_id).toBe(member!.id);
  });

  it("box checked by an existing member → confirmation says so, then links", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);

    const preview = await resolveCheckin(db, asNew(identity), at(slot, 18.4));
    expect(preview).toEqual({ status: "needs_confirmation", existing: true });

    const membersBefore = await countRows("members");
    const confirmed = await resolveCheckin(
      db,
      confirmedNew(identity),
      at(slot, 18.5)
    );
    expect(confirmed).toEqual({ status: "present", eventTitle: event.title });

    // The checkbox is a hint, not an instruction: ticking it when you already
    // exist links you to yourself and must never create a second person.
    expect(await countRows("members")).toBe(membersBefore);
    const rows = await attendanceRows({ eventId: event.id });
    expect(rows).toHaveLength(1);
    expect(rows[0].member_id).toBe(memberId);
  });

  it("box checked, matched only by email → still links, never duplicates", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);

    // Right email, ID they've never used here — the email fallback has to be
    // consulted before the confirmed path is allowed to create.
    const submitted = { ...identity, eid: `${identity.eid}4` };
    const membersBefore = await countRows("members");

    const preview = await resolveCheckin(db, asNew(submitted), at(slot, 18.4));
    expect(preview).toEqual({ status: "needs_confirmation", existing: true });

    const confirmed = await resolveCheckin(
      db,
      confirmedNew(submitted),
      at(slot, 18.5)
    );
    expect(confirmed).toEqual({ status: "present", eventTitle: event.title });

    expect(await countRows("members")).toBe(membersBefore);
    const rows = await attendanceRows({ eventId: event.id });
    expect(rows[0].member_id).toBe(memberId);
  });

  it("a confirmed first-timer outside a window still queues as an orphan", async () => {
    const slot = claimSlot();
    await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();

    const result = await resolveCheckin(db, confirmedNew(identity), at(slot, 20));
    expect(result).toEqual({ status: "pending" });

    const normalized = normalizeEid(identity.eid);
    await adoptMemberByNormalizedId(db, track, normalized);
    const { data: member } = await db
      .from("members")
      .select("id")
      .eq("normalized_eid", normalized)
      .single();

    const rows = await attendanceRows({ memberId: member!.id });
    expect(rows).toHaveLength(1);
    expect(rows[0].event_id).toBeNull();
  });

  it("refusal wins over both new states — the oracle is closed off-season", async () => {
    const slot = claimSlot();
    await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });

    const membersBefore = await countRows("members");

    // Outside the grace window there is no event to attend, so neither a
    // re-prompt nor a review screen is reachable — and a probe learns nothing
    // about who is on the roster.
    const far = at(slot, 19 + 49);
    expect(await resolveCheckin(db, returning(testIdentity()), far)).toEqual({
      status: "refused",
    });
    expect(await resolveCheckin(db, asNew(testIdentity()), far)).toEqual({
      status: "refused",
    });
    expect(await resolveCheckin(db, confirmedNew(testIdentity()), far)).toEqual({
      status: "refused",
    });

    expect(await countRows("members")).toBe(membersBefore);
  });
});

type BrokenBuilder = {
  select: () => BrokenBuilder;
  eq: () => BrokenBuilder;
  ilike: () => BrokenBuilder;
  maybeSingle: () => Promise<{ data: null; error: { message: string } }>;
};

/**
 * The real client with `from("members")` replaced by a builder that always
 * errors. Everything else — the event RPCs, the attendance table — still
 * reaches the local stack, so the failure is isolated to the member lookup.
 */
function brokenMemberLookup(): typeof db {
  const broken: BrokenBuilder = {
    select: () => broken,
    eq: () => broken,
    ilike: () => broken,
    maybeSingle: async () => ({
      data: null,
      error: { message: "simulated members outage" },
    }),
  };

  return new Proxy(db, {
    get(target, prop, receiver) {
      if (prop !== "from") return Reflect.get(target, prop, receiver);
      return (table: string) =>
        table === "members" ? broken : target.from(table as "attendance");
    },
  }) as typeof db;
}

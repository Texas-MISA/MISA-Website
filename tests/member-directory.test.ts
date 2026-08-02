import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  applyMemberFilter,
  pageCount,
  pageRange,
  parseMemberFilter,
  PAGE_SIZE,
} from "@/lib/filters";

import {
  cleanup,
  createCurrentTermEvent,
  createTestAttendance,
  createTestMember,
  newTracker,
  testClient,
  testIdentity,
  type Tracker,
} from "./helpers";

// Integration tests for the directory query (§7 Stage 6 phase 1) against the
// local stack — real PostgREST, real view, real ordering. The pure translation
// is covered in filters.test.ts; what can only be checked here is that the
// filter, the count, and the pages agree with each other on live data.
//
// Fixture members are isolated by `joined_at`: they are placed in 2035, which
// no seed row occupies, so a joined-date filter selects exactly this file's
// rows out of a table the seed also populates. The 2030 convention the other
// files use for events does not help here — members have no term.
//
// ⚠️ `tests/global-setup.ts` unpins `app_settings.current_term` for the run, so
// `current_term()` is whatever today's date derives. The seed's 2026 events
// therefore fall out of scope and `events_possible` counts only the fixture
// events this file creates. That makes the denominator small and knowable,
// which is useful — but it also means a fixture member who attends one event
// can legitimately sit at 100%.

const db = testClient();
const track: Tracker = newTracker();

/** Far outside the seed's range, and outside the 2030 event fixtures too. */
const ISOLATION_DAY = "2035-06-15";

/** Every fixture row in this file, active and inactive alike. Individual tests
 * narrow from here; the default `state: "active"` would silently exclude the
 * deactivated fixtures and make every count assertion off by three. */
const isolated = () =>
  parseMemberFilter({
    joinedFrom: ISOLATION_DAY,
    joinedTo: ISOLATION_DAY,
    state: "all",
  });

function joinedAt(hour: number): Date {
  // 2035-06-15 is CDT (UTC-5), so hour 12 Central is 17:00 UTC.
  return new Date(Date.UTC(2035, 5, 15, hour + 5, 0, 0));
}

const ROW_COLUMNS =
  "id, full_name, active, source, events_attended, events_possible, attendance_rate, total_points" as const;

async function page(filter: ReturnType<typeof parseMemberFilter>) {
  const { from, to } = pageRange(filter.page);
  const { data, error, count } = await applyMemberFilter(
    db.from("member_directory").select(ROW_COLUMNS, { count: "exact" }),
    filter
  ).range(from, to);
  if (error) throw new Error(`directory query failed: ${error.message}`);
  return { rows: data, count: count ?? 0 };
}

// One more than a page, so the fixture set genuinely spans two pages. The
// seeded roster is 32 members and could never do this on its own — with a page
// size of 25 the select-all bug is invisible against the seed, which is exactly
// why these rows exist.
const FIXTURE_COUNT = PAGE_SIZE + 6;
const INACTIVE_EVERY = 13;
const SELF_CHECKIN_EVERY = 11;

const createdIds: string[] = [];
let sharedEventId = "";

beforeAll(async () => {
  for (let i = 0; i < FIXTURE_COUNT; i++) {
    const identity = testIdentity();
    const id = await createTestMember(db, track, identity, {
      // Many members share an hour on purpose: it leaves the sort columns tied
      // for most of the set, which is what makes the stability test meaningful.
      joinedAt: joinedAt(1 + (i % 5)),
      active: i % INACTIVE_EVERY !== 0,
      source: i % SELF_CHECKIN_EVERY === 0 ? "self_checkin" : "admin",
    });
    createdIds.push(id);
  }

  const event = await createCurrentTermEvent(db, track, { points: 2 });
  sharedEventId = event.id;
}, 60_000);

afterAll(async () => {
  await cleanup(db, track);
});

describe("the directory query on live data", () => {
  it("counts every matching member, not the ones on the page", async () => {
    const { rows, count } = await page(isolated());

    expect(count).toBe(FIXTURE_COUNT);
    expect(rows).toHaveLength(PAGE_SIZE);
    // The gap between these two numbers is the stage's headline bug: the
    // officer is told 31 and shown 25, and phase 2's "copy all matching" must
    // return 31.
    expect(count).toBeGreaterThan(rows.length);
  });

  it("pages cover every matching member exactly once", async () => {
    const filter = isolated();
    const pages = pageCount(FIXTURE_COUNT);
    expect(pages).toBe(2);

    const seen: string[] = [];
    for (let p = 1; p <= pages; p++) {
      const { rows } = await page({ ...filter, page: p });
      seen.push(...rows.map((r) => r.id!));
    }

    // No duplicates and no gaps. Both failure modes come from a non-total sort
    // order, and both look like missing or doubled data rather than like an
    // ordering fault.
    expect(seen).toHaveLength(FIXTURE_COUNT);
    expect(new Set(seen).size).toBe(FIXTURE_COUNT);
    expect([...seen].sort()).toEqual([...createdIds].sort());
  });

  it("keeps the page split stable across repeated reads", async () => {
    // Every fixture member has zero points and most share a joined_at, so the
    // sort column is tied across the whole set. Without the id tie-break in
    // applyMemberFilter the same request can return a different split each
    // time — which is how a member silently vanishes between page 1 and page 2.
    const filter = { ...isolated(), sort: "total_points" as const };
    const first = await page({ ...filter, page: 1 });
    const again = await page({ ...filter, page: 1 });
    expect(again.rows.map((r) => r.id)).toEqual(first.rows.map((r) => r.id));
  });

  it("splits the roster on state, with the two halves accounting for everyone", async () => {
    const all = await page(isolated());
    const active = await page({ ...isolated(), state: "active" });
    const inactive = await page({ ...isolated(), state: "inactive" });

    expect(inactive.count).toBe(Math.ceil(FIXTURE_COUNT / INACTIVE_EVERY));
    expect(inactive.rows.every((r) => r.active === false)).toBe(true);
    expect(active.rows.every((r) => r.active === true)).toBe(true);
    expect(active.count + inactive.count).toBe(all.count);
  });

  it("narrows on source, which is the roster-cleanup query", async () => {
    // §4.2: members.source = 'self_checkin' is how an officer finds the rows
    // the check-in form created.
    const selfRegistered = await page({
      ...isolated(),
      source: "self_checkin",
    });

    expect(selfRegistered.count).toBe(
      Math.ceil(FIXTURE_COUNT / SELF_CHECKIN_EVERY)
    );
    expect(selfRegistered.rows.every((r) => r.source === "self_checkin")).toBe(
      true
    );
  });

  it("includes a member who joined late on the last Central day of the range", async () => {
    // 2035-06-15 22:00 Central is 2035-06-16 03:00 UTC. A bare
    // .lte("joined_at", "2035-06-15") is a UTC-midnight cut and drops them.
    const identity = testIdentity();
    const lateId = await createTestMember(db, track, identity, {
      joinedAt: new Date(Date.UTC(2035, 5, 16, 3, 0, 0)),
    });

    const seen: string[] = [];
    for (let p = 1; p <= pageCount(FIXTURE_COUNT + 1); p++) {
      const { rows } = await page({ ...isolated(), page: p });
      seen.push(...rows.map((r) => r.id!));
    }

    expect(seen).toContain(lateId);
  });
});

describe("attendance_rate", () => {
  it("is the term-scoped ratio of events attended to events completed", async () => {
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity, {
      joinedAt: joinedAt(2),
    });
    await createTestAttendance(db, track, {
      eventId: sharedEventId,
      memberId,
      submittedName: identity.fullName,
      submittedStudentId: identity.studentId,
      submittedEmail: identity.email,
      submittedAt: new Date(),
      status: "present",
    });

    const { data, error } = await db
      .from("member_directory")
      .select("events_attended, events_possible, attendance_rate, attendance_points")
      .eq("id", memberId)
      .single();
    if (error) throw new Error(error.message);

    expect(data.events_attended).toBe(1);
    expect(data.attendance_points).toBe(2);
    expect(data.events_possible).toBeGreaterThan(0);

    // A fraction, not a percentage, and it agrees with the two counts beside
    // it — the three cannot drift, because the view computes the denominator
    // once and both the count column and the rate read that one value.
    expect(data.attendance_rate).toBeCloseTo(
      data.events_attended! / data.events_possible!,
      4
    );
  });

  it("is a real zero, not null, for a member who attended nothing", async () => {
    // Null is reserved for a zero *denominator* — a term with no completed
    // events at all, which cannot be produced here because the fixture event
    // above is one. A member who simply attended nothing has a genuine 0, and
    // must not be confused with "no rate": one sorts at the bottom, the other
    // is excluded from a threshold filter entirely.
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity, {
      joinedAt: joinedAt(3),
    });

    const { data, error } = await db
      .from("member_directory")
      .select("events_attended, events_possible, attendance_rate")
      .eq("id", memberId)
      .single();
    if (error) throw new Error(error.message);

    expect(data.events_attended).toBe(0);
    expect(data.events_possible).toBeGreaterThan(0);
    expect(data.attendance_rate).toBe(0);
  });

  it("converts a whole-percent threshold into the view's fraction", async () => {
    const all = await page(isolated());
    const atLeastOne = await page({ ...isolated(), minRate: 1 });
    const perfect = await page({ ...isolated(), minRate: 100 });

    // Only the member who attended clears any threshold above zero; everyone
    // else sits at a real 0.
    expect(atLeastOne.count).toBeLessThan(all.count);
    expect(atLeastOne.count).toBeGreaterThan(0);
    expect(atLeastOne.rows.every((r) => (r.attendance_rate ?? 0) >= 0.01)).toBe(
      true
    );
    // 100 in the URL must mean 1.0 in the query, not 100.0 — which would match
    // nobody and look like an empty result rather than a unit error.
    expect(perfect.rows.every((r) => (r.attendance_rate ?? 0) >= 1)).toBe(true);
  });
});

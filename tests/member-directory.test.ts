import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  applyMemberFilter,
  pageCount,
  pageRange,
  parseMemberFilter,
  PAGE_SIZE,
  type SortableField,
} from "@/lib/filters";
import { classifyTermEvents, customSortKey } from "@/lib/members";

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

// Integration tests for the directory query (§7 Stage 6, phases 1 and 3) against
// the local stack — real PostgREST, real view, real ordering. The pure
// translation is covered in filters.test.ts; what can only be checked here is
// that the filter, the count, and the pages agree with each other on live data.
//
// Fixture members are isolated by the free-text search on `t3q`, the marker
// every testIdentity() EID carries (helpers.ts) and no seed EID does. Phase 1
// isolated on a `joined_at` in 2035 instead; that filter left MemberFilter with
// the phase-3 trim, and the marker is the better handle anyway — it selects the
// fixtures by something deliberately put there rather than by a date they
// happen to hold, and it puts the new `.or()` in front of real PostgREST, which
// is the only place a quoting bug can surface.
//
// ⚠️ `tests/global-setup.ts` unpins `app_settings.current_term` for the run, so
// `current_term()` is whatever today's date derives. The seed's 2026 events
// therefore fall out of scope and `events_possible` counts only the fixture
// events this file creates. That makes the denominator small and knowable,
// which is useful — but it also means a fixture member who attends one event
// can legitimately sit at 100%.
//
// Coverage that left with the phase-3 trim, so it is not quietly forgotten: the
// `source` narrowing (§4.2's roster-cleanup query) and the Central-anchored
// half-open joined-date range. The date-range shape returns in phase 6 with
// "not seen since"; the pure half of it is still asserted for the points
// ledger's awarded-date range.

const db = testClient();
const track: Tracker = newTracker();

/** The marker every testIdentity() EID carries. No seed EID contains it, and no
 * real UT EID could. */
const FIXTURE_MARKER = "t3q";

/** Every fixture row in this file, active and inactive alike. Individual tests
 * narrow from here; the default `state: "active"` would silently exclude the
 * deactivated fixtures and make every count assertion off by three. */
const isolated = () =>
  parseMemberFilter({ q: FIXTURE_MARKER, state: "all" });

const ROW_COLUMNS =
  "id, full_name, email, eid, active, source, events_attended, events_possible, attendance_rate, total_points, notes, custom_fields" as const;

async function page(
  filter: ReturnType<typeof parseMemberFilter>,
  fields: SortableField[] = []
) {
  const { from, to } = pageRange(filter.page);
  const { data, error, count } = await applyMemberFilter(
    db.from("member_directory").select(ROW_COLUMNS, { count: "exact" }),
    filter,
    fields
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
      // Every fixture sits at zero points, so the sort column is tied across the
      // whole set — which is what makes the page-stability test meaningful.
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
    // Every fixture member has zero points, so the
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

});

// The whole isolation scheme above already proves the or-group works — every
// test in this file selects its 31 fixtures with it. These pin the parts of it
// that a pure test cannot reach, because they depend on how PostgREST actually
// parses the filter string rather than on how we build it.
describe("free-text search against real PostgREST", () => {
  it("matches on each of the three columns it claims to search", async () => {
    const identity = testIdentity();
    const id = await createTestMember(db, track, identity);

    for (const term of [identity.fullName, identity.email, identity.eid]) {
      const { rows } = await page(parseMemberFilter({ q: term, state: "all" }));
      expect(rows.map((r) => r.id)).toContain(id);
    }
  });

  it("survives the dots in an email, which are PostgREST filter syntax", async () => {
    // ⚠️ This is the assertion the quoting in applyMemberFilter exists for.
    // Unquoted, `email.ilike.*test.person.123@example.edu*` is read as a column
    // and an operator rather than as a value — the request fails or, worse,
    // matches something else. Every fixture email carries dots, so an unquoted
    // build breaks here and nowhere in the pure tests.
    const identity = testIdentity();
    const id = await createTestMember(db, track, identity);

    const local = identity.email.split("@")[0];
    expect(local).toContain(".");

    const { rows } = await page(parseMemberFilter({ q: local, state: "all" }));
    expect(rows.map((r) => r.id)).toContain(id);
  });

  it("does not treat a comma as a second condition", async () => {
    // A comma separates conditions inside an or-group. Unquoted, a searched
    // comma would split one predicate into two and silently widen the result —
    // the partial/over-broad list failure this screen is prone to.
    const { count } = await page(
      parseMemberFilter({ q: `${FIXTURE_MARKER}, nobody`, state: "all" })
    );
    expect(count).toBe(0);
  });

  it("is case-insensitive, which is what ilike buys over like", async () => {
    // Compared against the lower-case run rather than against FIXTURE_COUNT:
    // earlier tests in this file add members carrying the same marker, so the
    // absolute number is not stable across the file. The property under test is
    // that case makes no difference, and that is what this asserts.
    const lower = await page(isolated());
    const upper = await page(
      parseMemberFilter({ q: FIXTURE_MARKER.toUpperCase(), state: "all" })
    );
    expect(upper.count).toBe(lower.count);
    expect(upper.count).toBeGreaterThanOrEqual(FIXTURE_COUNT);
  });

  it("composes with the roster scope rather than replacing it", async () => {
    // An `or` group and an `eq` are ANDed. If the search ever escaped its group,
    // "inactive only" plus a search would return active members too.
    const inactive = await page(
      parseMemberFilter({ q: FIXTURE_MARKER, state: "inactive" })
    );
    expect(inactive.count).toBe(Math.ceil(FIXTURE_COUNT / INACTIVE_EVERY));
    expect(inactive.rows.every((r) => r.active === false)).toBe(true);
  });
});

// The member detail page renders two things that come from different queries
// and must agree: the view's "N of M completed" and the events grid beneath it.
// Nothing forces them to — the grid is a left join from events, the view is an
// aggregate over attendance — so this is the assertion that catches them
// drifting. The classification itself is covered purely in members.test.ts.
describe("the detail page's events grid agrees with the view", () => {
  it("classifies the term's published events into exactly events_possible completed", async () => {
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);
    await createTestAttendance(db, track, {
      eventId: sharedEventId,
      memberId,
      submittedName: identity.fullName,
      submittedEid: identity.eid,
      submittedEmail: identity.email,
      submittedAt: new Date(),
      status: "present",
    });

    const { data: currentTerm, error: termError } = await db.rpc("current_term");
    if (termError) throw new Error(termError.message);

    // Exactly the two queries the page runs.
    const { data: termEvents, error: eventsError } = await db
      .from("events")
      .select("id, ends_at")
      .eq("term", currentTerm)
      .eq("status", "published");
    if (eventsError) throw new Error(eventsError.message);

    const { data: rows, error: attendanceError } = await db
      .from("attendance")
      .select("event_id, status")
      .eq("member_id", memberId);
    if (attendanceError) throw new Error(attendanceError.message);

    const attended = new Set(
      rows
        .filter((r) => r.status === "present" && r.event_id)
        .map((r) => r.event_id as string)
    );
    const grid = classifyTermEvents(termEvents, attended, new Date());

    const { data: directory, error } = await db
      .from("member_directory")
      .select("events_attended, events_possible")
      .eq("id", memberId)
      .single();
    if (error) throw new Error(error.message);

    // The grid's completed events are the view's denominator. An upcoming event
    // belongs to neither, which is the whole point of the third state.
    expect(grid.attended + grid.missed).toBe(directory.events_possible);
    expect(grid.attended).toBe(directory.events_attended);
  });
});

describe("attendance_rate", () => {
  it("is the term-scoped ratio of events attended to events completed", async () => {
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);
    await createTestAttendance(db, track, {
      eventId: sharedEventId,
      memberId,
      submittedName: identity.fullName,
      submittedEid: identity.eid,
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
    // would be excluded by a threshold filter entirely (phase 6's, now).
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);

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

});

// ---------------------------------------------------------------------------
// Custom fields (phase 4)
// ---------------------------------------------------------------------------
//
// ⚠️ These belong here, in front of real PostgREST, and not in the pure suite.
// A recording fake proves applyMemberFilter *emits* `custom_fields->>key`; only
// the real gateway proves PostgREST accepts it, orders by it through a VIEW,
// and keeps that order across .range() boundaries. That is exactly the property
// the phase-4 spike went looking for, and the same class of thing as the search
// quoting a pure test cannot catch.

const FIELD_KEY = "t3q_dues";
const FIELD_OPTIONS = ["Paid", "Unpaid", "Waived"];

/**
 * This block's own marker, and its own fixtures.
 *
 * It cannot share the file's: `t3q` matches every member the earlier describes
 * created, several of which add rows of their own as they run, so a count
 * asserted here against FIXTURE_COUNT is a count of somebody else's fixtures
 * plus mine. `t3qcf` is a strict narrowing of `t3q`, so those blocks keep
 * seeing everything they expect and this one sees only what it made.
 */
const CF_MARKER = "t3qcf";
const CF_COUNT = PAGE_SIZE + 6;

describe("custom-field sorting through the view", () => {
  const fields: SortableField[] = [
    { key: FIELD_KEY, showInDirectory: true },
  ];
  let fieldId = "";
  const cfIds: string[] = [];
  /** Which fixtures got an answer, and what. The rest hold none, which is the
   * sparse case a dropdown always produces. */
  const answers = new Map<string, string>();

  beforeAll(async () => {
    const { data, error } = await db
      .from("member_field_definitions")
      .insert({
        key: FIELD_KEY,
        label: "Dues (test fixture)",
        kind: "select",
        options: FIELD_OPTIONS,
      })
      .select("id")
      .single();
    if (error) throw new Error(`field definition insert failed: ${error.message}`);
    fieldId = data.id;

    for (let i = 0; i < CF_COUNT; i++) {
      const base = testIdentity();
      const id = await createTestMember(db, track, {
        ...base,
        eid: base.eid.replace("t3q", CF_MARKER),
      });
      cfIds.push(id);

      // Two thirds answered, one third left blank, so nulls-last is observable.
      if (i % 3 === 2) continue;
      const value = FIELD_OPTIONS[i % FIELD_OPTIONS.length];
      answers.set(id, value);
      const { error: updateError } = await db
        .from("members")
        .update({ custom_fields: { [FIELD_KEY]: value } })
        .eq("id", id);
      if (updateError) {
        throw new Error(`value write failed: ${updateError.message}`);
      }
    }
  }, 60_000);

  afterAll(async () => {
    // The members go with the tracker's cleanup; the definition is not a
    // tracked entity and has to be removed by hand or it collides with the next
    // run's insert on the unique key.
    if (fieldId) {
      await db.from("member_field_definitions").delete().eq("id", fieldId);
    }
  });

  const sorted = (dir: "asc" | "desc") =>
    parseMemberFilter(
      { q: CF_MARKER, state: "all", sort: customSortKey(FIELD_KEY), dir },
      fields
    );

  it("orders by the JSON path, with unanswered members last either way", async () => {
    for (const dir of ["asc", "desc"] as const) {
      const seen: (string | null)[] = [];
      for (let p = 1; p <= pageCount(CF_COUNT); p++) {
        const { rows } = await page({ ...sorted(dir), page: p }, fields);
        for (const row of rows) {
          const cf = row.custom_fields as Record<string, string> | null;
          seen.push(cf?.[FIELD_KEY] ?? null);
        }
      }

      expect(seen).toHaveLength(CF_COUNT);

      // Nulls last in BOTH directions, which is not what Postgres does unless
      // asked: a descending sort puts them first by default, burying everyone
      // who actually has an answer.
      const firstNull = seen.indexOf(null);
      expect(firstNull).toBeGreaterThan(-1);
      expect(seen.slice(firstNull).every((v) => v === null)).toBe(true);

      // And the answered run is genuinely ordered — across page boundaries,
      // which is the half a single-page assertion would miss.
      const answered = seen.slice(0, firstNull) as string[];
      const expected = [...answered].sort();
      if (dir === "desc") expected.reverse();
      expect(answered).toEqual(expected);
    }
  });

  it("covers every member exactly once when the sort column is mostly ties", async () => {
    // Three options over 31 members: ties are the rule here, not the exception.
    // Without the id tie-break applyMemberFilter appends, pages drop and repeat
    // rows — the spike reproduced precisely this, losing one row in thirty.
    const seen: string[] = [];
    for (let p = 1; p <= pageCount(CF_COUNT); p++) {
      const { rows } = await page({ ...sorted("asc"), page: p }, fields);
      seen.push(...rows.map((r) => r.id!));
    }

    expect(seen).toHaveLength(CF_COUNT);
    expect(new Set(seen).size).toBe(CF_COUNT);
    expect([...seen].sort()).toEqual([...cfIds].sort());
  });

  it("counts the same rows the sort returns", async () => {
    const { rows, count } = await page(sorted("asc"), fields);
    expect(count).toBe(CF_COUNT);
    expect(rows).toHaveLength(PAGE_SIZE);
  });

  it("surfaces the stored value on the view", async () => {
    const [memberId, value] = [...answers.entries()][0];
    const { data, error } = await db
      .from("member_directory")
      .select("custom_fields, notes")
      .eq("id", memberId)
      .single();
    if (error) throw new Error(error.message);

    expect((data.custom_fields as Record<string, string>)[FIELD_KEY]).toBe(value);
    // notes is appended by the same migration and was previously reachable only
    // by a second read against members.
    expect(data).toHaveProperty("notes");
  });
});

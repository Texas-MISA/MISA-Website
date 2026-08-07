import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  applyMemberFilter,
  parseMemberFilter,
  type SortableField,
} from "@/lib/filters";
import { termAtIndex, termIndex } from "@/lib/dues";
import { classifyTermEvents, customFieldKey } from "@/lib/members";

import {
  cleanup,
  createCurrentTermEvent,
  createTestAttendance,
  createTestMember,
  getTestOfficer,
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

/**
 * A deliberately tiny chunk, so a fixture set of thirty-odd rows spans several
 * reads.
 *
 * ⚠️ NOT lib/filters.ts's READ_CHUNK, which is 1000 — proving the tie-break
 * against that would need a thousand fixtures. The property under test is a
 * property of chunked reading itself and does not care about the size, so the
 * tests use a size that exposes it cheaply. It is the same reason the directory's
 * old PAGE_SIZE was 25: a read window that fits the whole fixture set hides every
 * bug this screen is prone to.
 */
const CHUNK = 7;

/** One chunk of the directory query, zero-based. */
async function chunk(
  filter: ReturnType<typeof parseMemberFilter>,
  index = 0,
  fields: SortableField[] = []
) {
  const from = index * CHUNK;
  const { data, error, count } = await applyMemberFilter(
    db.from("member_directory").select(ROW_COLUMNS, { count: "exact" }),
    filter,
    fields
  ).range(from, from + CHUNK - 1);
  if (error) throw new Error(`directory query failed: ${error.message}`);
  return { rows: data, count: count ?? 0 };
}

/**
 * Every matching row, read the way the directory page and the export route
 * both read: loop `.range()` until a short chunk comes back.
 */
async function readAll(
  filter: ReturnType<typeof parseMemberFilter>,
  fields: SortableField[] = []
) {
  const rows: Awaited<ReturnType<typeof chunk>>["rows"] = [];
  let count = 0;
  for (let index = 0; ; index++) {
    const page = await chunk(filter, index, fields);
    if (index === 0) count = page.count;
    rows.push(...page.rows);
    if (page.rows.length < CHUNK || rows.length >= count) break;
  }
  return { rows, count };
}

// Several chunks' worth, so the fixture set genuinely spans chunk boundaries.
// The seeded roster of 32 could never prove this on its own — a read window that
// swallows the whole fixture set hides every bug this screen is prone to, which
// is exactly why these rows exist.
const FIXTURE_COUNT = CHUNK * 4 + 3;
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
  it("reports the full count from the very first chunk", async () => {
    // The directory renders every matching member, so the count and the rows
    // agree once the loop finishes — but the count has to be right from chunk
    // ZERO, because that is where the loop decides how much more to read. A
    // count that only became correct later would end the read early.
    const { rows, count } = await chunk(isolated());

    expect(count).toBe(FIXTURE_COUNT);
    expect(rows).toHaveLength(CHUNK);
    expect(count).toBeGreaterThan(rows.length);
  });

  it("chunks cover every matching member exactly once", async () => {
    const { rows, count } = await readAll(isolated());
    expect(count).toBe(FIXTURE_COUNT);

    // No duplicates and no gaps. Both failure modes come from a non-total sort
    // order, and both look like missing or doubled data rather than like an
    // ordering fault. This is what the directory and the export both depend on
    // now that neither paginates and both read in chunks.
    const seen = rows.map((r) => r.id!);
    expect(seen).toHaveLength(FIXTURE_COUNT);
    expect(new Set(seen).size).toBe(FIXTURE_COUNT);
    expect([...seen].sort()).toEqual([...createdIds].sort());
  });

  it("keeps the chunk split stable across repeated reads", async () => {
    // Every fixture member has zero points, so the sort column is tied across
    // the whole set. Without the id tie-break in applyMemberFilter the same
    // request can return a different split each time — which is how a member
    // silently vanishes between one chunk and the next.
    const filter = { ...isolated(), sort: "total_points" as const };
    const first = await chunk(filter);
    const again = await chunk(filter);
    expect(again.rows.map((r) => r.id)).toEqual(first.rows.map((r) => r.id));
  });

  it("splits the roster on state, with the two halves accounting for everyone", async () => {
    const all = await readAll(isolated());
    const active = await readAll({ ...isolated(), state: "active" });
    const inactive = await readAll({ ...isolated(), state: "inactive" });

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
      const { rows } = await readAll(parseMemberFilter({ q: term, state: "all" }));
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

    const { rows } = await readAll(parseMemberFilter({ q: local, state: "all" }));
    expect(rows.map((r) => r.id)).toContain(id);
  });

  it("does not treat a comma as a second condition", async () => {
    // A comma separates conditions inside an or-group. Unquoted, a searched
    // comma would split one predicate into two and silently widen the result —
    // the partial/over-broad list failure this screen is prone to.
    const { count } = await readAll(
      parseMemberFilter({ q: `${FIXTURE_MARKER}, nobody`, state: "all" })
    );
    expect(count).toBe(0);
  });

  it("is case-insensitive, which is what ilike buys over like", async () => {
    // Compared against the lower-case run rather than against FIXTURE_COUNT:
    // earlier tests in this file add members carrying the same marker, so the
    // absolute number is not stable across the file. The property under test is
    // that case makes no difference, and that is what this asserts.
    const lower = await readAll(isolated());
    const upper = await readAll(
      parseMemberFilter({ q: FIXTURE_MARKER.toUpperCase(), state: "all" })
    );
    expect(upper.count).toBe(lower.count);
    expect(upper.count).toBeGreaterThanOrEqual(FIXTURE_COUNT);
  });

  it("composes with the roster scope rather than replacing it", async () => {
    // An `or` group and an `eq` are ANDed. If the search ever escaped its group,
    // "inactive only" plus a search would return active members too.
    const inactive = await readAll(
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
const CF_COUNT = CHUNK * 4 + 3;

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
      { q: CF_MARKER, state: "all", sort: customFieldKey(FIELD_KEY), dir },
      fields
    );

  it("orders by the JSON path, with unanswered members last either way", async () => {
    for (const dir of ["asc", "desc"] as const) {
      const { rows } = await readAll(sorted(dir), fields);
      const seen: (string | null)[] = [];
      for (const row of rows) {
        const cf = row.custom_fields as Record<string, string> | null;
        seen.push(cf?.[FIELD_KEY] ?? null);
      }

      expect(seen).toHaveLength(CF_COUNT);

      // Nulls last in BOTH directions, which is not what Postgres does unless
      // asked: a descending sort puts them first by default, burying everyone
      // who actually has an answer.
      const firstNull = seen.indexOf(null);
      expect(firstNull).toBeGreaterThan(-1);
      expect(seen.slice(firstNull).every((v) => v === null)).toBe(true);

      // And the answered run is genuinely ordered — across chunk boundaries,
      // which is the half a single-chunk assertion would miss.
      const answered = seen.slice(0, firstNull) as string[];
      const expected = [...answered].sort();
      if (dir === "desc") expected.reverse();
      expect(answered).toEqual(expected);
    }
  });

  it("covers every member exactly once when the sort column is mostly ties", async () => {
    // Three options over 31 members: ties are the rule here, not the exception.
    // Without the id tie-break applyMemberFilter appends, chunked reads drop and
    // repeat rows — the spike reproduced precisely this, losing one row in
    // thirty.
    const { rows } = await readAll(sorted("asc"), fields);
    const seen = rows.map((r) => r.id!);

    expect(seen).toHaveLength(CF_COUNT);
    expect(new Set(seen).size).toBe(CF_COUNT);
    expect([...seen].sort()).toEqual([...cfIds].sort());
  });

  it("counts the same rows the sort returns", async () => {
    const { rows, count } = await readAll(sorted("asc"), fields);
    expect(count).toBe(CF_COUNT);
    // Reading to the end returns exactly the count — which is the property the
    // directory now renders directly, since it shows every matching member.
    expect(rows).toHaveLength(CF_COUNT);
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

// ---------------------------------------------------------------------------
// The export query (§7 Stage 6 phase 5)
// ---------------------------------------------------------------------------
//
// 🪤 This is the block the whole phase exists for, and it can only live here.
// "Select all N matching this filter" versus "the 25 rows on this page" is a
// distinction no pure test can settle — it depends on PostgREST actually
// returning what the unpaginated filter claims. It is also invisible against the
// seed: 32 members at a page size of 25 means a broken export looks correct on
// every screen an officer would think to check.
//
// ⚠️ Its own marker, for the reason recorded above CF_MARKER: `t3q` matches
// every fixture the earlier describes created, and several of them add members
// as they run — asserting a count against `t3q` here counts somebody else's
// rows. `t3qex` is a strict narrowing, so the earlier blocks still see
// everything they expect and this one sees only what it made. Getting this wrong
// is not subtle when it fails (31 expected, 67 received) but it would be
// invisible if the assertion were an inequality.
//
// The export mirrors the route handler rather than importing it, because a Route
// Handler needs a request context this suite cannot build. What is pinned is the
// query shape: the same applyMemberFilter, read through explicit chunked
// ranges — which is now how the directory reads too.
const EX_MARKER = "t3qex";
const EX_COUNT = CHUNK * 4 + 3;
const EX_INACTIVE_EVERY = 5;

describe("the export query returns every matching member", () => {
  // Deliberately far below EX_COUNT, so the loop genuinely goes round four
  // times. A chunk larger than the fixture set would pass while testing nothing.
  const CHUNK = 8;

  const exIds: string[] = [];

  beforeAll(async () => {
    for (let i = 0; i < EX_COUNT; i++) {
      const base = testIdentity();
      const id = await createTestMember(
        db,
        track,
        { ...base, eid: base.eid.replace("t3q", EX_MARKER) },
        { active: i % EX_INACTIVE_EVERY !== 0 }
      );
      exIds.push(id);
    }
  }, 60_000);

  const everyone = () => parseMemberFilter({ q: EX_MARKER, state: "all" });

  async function exportAll(
    filter: ReturnType<typeof parseMemberFilter>,
    ids: string[] = []
  ) {
    const base = applyMemberFilter(
      db.from("member_directory").select(ROW_COLUMNS, { count: "exact" }),
      filter,
      []
    );
    const query = ids.length > 0 ? base.in("id", ids) : base;

    const rows: { id: string | null }[] = [];
    let total = 0;

    for (let offset = 0; ; offset += CHUNK) {
      const { data, error, count } = await query.range(
        offset,
        offset + CHUNK - 1
      );
      if (error) throw new Error(`export query failed: ${error.message}`);
      if (offset === 0) total = count ?? data.length;
      rows.push(...data);
      if (data.length < CHUNK || rows.length >= total) break;
    }

    return { rows, total };
  }

  it("returns all N, not the page size", async () => {
    const { rows, total } = await exportAll(everyone());

    expect(total).toBe(EX_COUNT);
    expect(rows).toHaveLength(EX_COUNT);
    // The assertion that would have caught the classic bug: the export is
    // strictly larger than a single read window.
    expect(rows.length).toBeGreaterThan(CHUNK);
  });

  it("agrees exactly with what the directory renders beside it", async () => {
    const { count, rows: shown } = await readAll(everyone());
    const { rows } = await exportAll(everyone());

    // §4.5's one-translation rule asserted end to end: the file and the number
    // printed above it come from the same filter, so they cannot drift.
    expect(rows).toHaveLength(count);

    // 📌 This used to assert the directory showed strictly FEWER rows than the
    // export — the gap between "25 on this page" and "all 31 matching" was the
    // bug the whole screen was built to survive. Since the directory stopped
    // paginating on 2026-08-07 the two are the same set, so the assertion
    // inverts: same length, same ids, same order. That is a stronger property
    // than the old one, not a weaker one — it now catches the export and the
    // screen disagreeing about *which* members, not merely how many.
    expect(shown).toHaveLength(rows.length);
    expect(shown.map((r) => r.id)).toEqual(rows.map((r) => r.id));
  });

  it("returns every fixture exactly once, with no duplicates across chunks", async () => {
    const { rows } = await exportAll(everyone());
    const seen = rows.map((row) => row.id ?? "");

    expect(new Set(seen).size).toBe(EX_COUNT);
    expect([...seen].sort()).toEqual([...exIds].sort());
  });

  it("narrows to explicitly selected ids", async () => {
    const chosen = exIds.slice(0, 3);
    const { rows } = await exportAll(everyone(), chosen);

    expect(rows.map((row) => row.id ?? "").sort()).toEqual([...chosen].sort());
  });

  it("⚠️ an id outside the filter cannot be pulled back in by selecting it", async () => {
    // The ids narrow the filtered query rather than replacing it, so a stale
    // checkbox left over from a wider filter contributes nothing instead of
    // smuggling a row the officer can no longer see into the file.
    const active = parseMemberFilter({ q: EX_MARKER, state: "active" });
    const { rows: activeRows } = await exportAll(active);
    const activeIds = new Set(activeRows.map((row) => row.id ?? ""));

    const excluded = exIds.filter((id) => !activeIds.has(id));
    expect(excluded.length).toBeGreaterThan(0);

    const { rows } = await exportAll(active, [excluded[0]]);
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Stage 6.5 phase 4 — the dues filter against the real view.
//
// The pure translation is pinned in filters.test.ts; what only real PostgREST
// can answer is whether `dues_paid_current_term` actually flips when a payment
// is recorded, voided, or left undecided — because that column is an
// `exists (…)` over a generated array, scoped to current_term(), and every one
// of those three parts is somewhere the filter could silently agree with itself
// while disagreeing with the money.
//
// `t3qd` is a strict narrowing of `t3q`, so the blocks above still see
// everything they created and this one sees only its own rows.
// ---------------------------------------------------------------------------
const DUES_MARKER = "t3qd";

describe("the dues filter against real payments", () => {
  const paidIds: string[] = [];
  const unpaidIds: string[] = [];
  const duesTxnIds: string[] = [];
  const duesBatch = crypto.randomUUID();

  let officerId = "";
  let term = "";

  async function pay(
    memberId: string,
    overrides: Record<string, unknown> = {}
  ): Promise<string> {
    const txn = `${DUES_MARKER}-${duesBatch.slice(0, 8)}-${duesTxnIds.length}`;
    duesTxnIds.push(txn);

    const { error } = await db.from("dues_payments").insert({
      venmo_txn_id: txn,
      member_id: memberId,
      paid_at: new Date().toISOString(),
      amount_cents: 3000,
      // Never a literal term string (§4.7) — the database is asked.
      start_term: term,
      terms_covered: 1,
      import_batch_id: duesBatch,
      imported_by: officerId,
      ...overrides,
    });
    if (error) throw new Error(`payment insert failed: ${error.message}`);
    return txn;
  }

  beforeAll(async () => {
    officerId = await getTestOfficer(db);
    const { data, error } = await db.rpc("current_term");
    if (error) throw new Error(error.message);
    term = data as unknown as string;

    for (let i = 0; i < 6; i++) {
      const base = testIdentity();
      const id = await createTestMember(db, track, {
        ...base,
        eid: base.eid.replace("t3q", DUES_MARKER),
      });
      if (i % 2 === 0) paidIds.push(id);
      else unpaidIds.push(id);
    }

    for (const id of paidIds) await pay(id);
  }, 60_000);

  afterAll(async () => {
    // ON DELETE RESTRICT, so the payments go before the members cleanup() will
    // remove — which is the FK doing exactly what it was chosen to do.
    if (duesTxnIds.length > 0) {
      await db.from("dues_payments").delete().in("venmo_txn_id", duesTxnIds);
    }
  });

  const mine = (dues: string) =>
    parseMemberFilter({ q: DUES_MARKER, state: "all", dues });

  async function idsFor(dues: string) {
    const { data, error, count } = await applyMemberFilter(
      db.from("member_directory").select("id", { count: "exact" }),
      mine(dues),
      []
    );
    if (error) throw new Error(`dues query failed: ${error.message}`);
    return { ids: (data ?? []).map((row) => row.id ?? ""), count: count ?? 0 };
  }

  it("splits the roster into exactly the two halves", async () => {
    const paid = await idsFor("paid");
    const unpaid = await idsFor("unpaid");
    const all = await idsFor("all");

    expect(paid.ids.sort()).toEqual([...paidIds].sort());
    expect(unpaid.ids.sort()).toEqual([...unpaidIds].sort());
    expect(all.ids).toHaveLength(paidIds.length + unpaidIds.length);
  });

  it("returns a count that matches the rows it returned", async () => {
    // §4.5's one-translation rule on the new predicate: the number printed above
    // the table and the rows in it come from one query, so "copy all N unpaid"
    // cannot quietly mean something else.
    for (const dues of ["paid", "unpaid", "all"]) {
      const { ids, count } = await idsFor(dues);
      expect(count, dues).toBe(ids.length);
    }
  });

  it("⚠️ counts an undecided amount as NOT paid", async () => {
    // terms_covered null → covered_terms null → covers nothing. The failure
    // direction is under-reporting membership, which the review queue makes
    // visible, rather than over-reporting it, which nothing would.
    const [member] = unpaidIds;
    const txn = await pay(member, { terms_covered: null, amount_cents: 4200 });

    const unpaid = await idsFor("unpaid");
    expect(unpaid.ids).toContain(member);
    expect((await idsFor("paid")).ids).not.toContain(member);

    await db.from("dues_payments").delete().eq("venmo_txn_id", txn);
  });

  it("takes membership away again when a payment is voided", async () => {
    const [member] = paidIds;
    expect((await idsFor("paid")).ids).toContain(member);

    await db
      .from("dues_payments")
      .update({
        voided_at: new Date().toISOString(),
        voided_by: officerId,
        void_reason: "Refunded at the member's request",
      })
      .eq("member_id", member);

    expect((await idsFor("paid")).ids).not.toContain(member);
    expect((await idsFor("unpaid")).ids).toContain(member);
  });

  it("🪤 ignores a payment covering only a term that is not the current one", async () => {
    // member_directory is scoped to current_term() like every other aggregate
    // here, so a live payment for a past term counts for nothing. Stepped off
    // the index rather than typed, because 'Fall 2026' < 'Spring 2026' is true
    // as a string and false as a calendar fact.
    const [member] = unpaidIds;
    const previous = termAtIndex(termIndex(term)! - 1);
    const txn = await pay(member, { start_term: previous, terms_covered: 1 });

    expect((await idsFor("paid")).ids).not.toContain(member);
    expect((await idsFor("unpaid")).ids).toContain(member);

    await db.from("dues_payments").delete().eq("venmo_txn_id", txn);
  });
});

// ---------------------------------------------------------------------------
// Stage 6 phase 5c — the categorical filters against real PostgREST.
//
// The pure translation is pinned in filters.test.ts. What only a real database
// can answer is whether `.eq("custom_fields->>key", value)` actually filters
// through the view — the sort proved the JSON path ORDERS, which is a different
// clause — and whether a value carrying PostgREST's own punctuation survives
// the trip. `.` and `,` are filter syntax inside an `or` group and are what
// forced the search term to be double-quoted; an `eq` operand is a different
// position and the difference is exactly the kind of thing a pure test cannot
// see.
//
// `t3qcat` is a strict narrowing of `t3q`, like every other block's marker.
// ---------------------------------------------------------------------------
const CAT_KEY = "t3q_shirt";
/** ⚠️ Two of these carry punctuation on purpose — a comma and a slash — because
 * a real option list is written by an officer, not by a test. */
const CAT_OPTIONS = ["M", "S/M", "Yes, with notes"];
const CAT_MARKER = "t3qcat";

describe("categorical filters against the view", () => {
  const fields: SortableField[] = [{ key: CAT_KEY, showInDirectory: true }];
  let fieldId = "";
  const answered = new Map<string, string>();
  const selfIds: string[] = [];
  let unansweredId = "";

  beforeAll(async () => {
    const { data, error } = await db
      .from("member_field_definitions")
      .insert({
        key: CAT_KEY,
        label: "Shirt (test fixture)",
        kind: "select",
        options: CAT_OPTIONS,
      })
      .select("id")
      .single();
    if (error) throw new Error(`definition insert failed: ${error.message}`);
    fieldId = data.id;

    // One member per option, plus two self-registered, plus one holding no
    // answer at all — the sparse case a dropdown always produces.
    for (const value of CAT_OPTIONS) {
      const base = testIdentity();
      const id = await createTestMember(db, track, {
        ...base,
        eid: base.eid.replace("t3q", CAT_MARKER),
      });
      answered.set(id, value);
      const { error: writeError } = await db
        .from("members")
        .update({ custom_fields: { [CAT_KEY]: value } })
        .eq("id", id);
      if (writeError) throw new Error(`value write failed: ${writeError.message}`);
    }

    for (let i = 0; i < 2; i++) {
      const base = testIdentity();
      const id = await createTestMember(
        db,
        track,
        { ...base, eid: base.eid.replace("t3q", CAT_MARKER) },
        { source: "self_checkin" }
      );
      selfIds.push(id);
    }

    const base = testIdentity();
    unansweredId = await createTestMember(db, track, {
      ...base,
      eid: base.eid.replace("t3q", CAT_MARKER),
    });
  }, 60_000);

  afterAll(async () => {
    if (fieldId) {
      await db.from("member_field_definitions").delete().eq("id", fieldId);
    }
  });

  const mine = (params: Record<string, string>) =>
    parseMemberFilter({ q: CAT_MARKER, state: "all", ...params }, fields);

  it("filters on the JSON path, not just orders by it", async () => {
    const { rows, count } = await readAll(mine({ [`cf:${CAT_KEY}`]: "M" }), fields);

    const expected = [...answered.entries()]
      .filter(([, value]) => value === "M")
      .map(([id]) => id);

    expect(rows.map((r) => r.id)).toEqual(expected);
    expect(count).toBe(expected.length);
  });

  it("🪤 survives a value carrying PostgREST's own punctuation", async () => {
    // A comma and a slash. Inside an `or` group a bare comma ends the operand,
    // which is why searchTerm's value has to be double-quoted; an `eq` operand
    // is a different position and this asserts it, rather than assuming the two
    // behave alike.
    for (const value of ["S/M", "Yes, with notes"]) {
      const { rows, count } = await readAll(
        mine({ [`cf:${CAT_KEY}`]: value }),
        fields
      );
      const expected = [...answered.entries()]
        .filter(([, v]) => v === value)
        .map(([id]) => id);

      expect(rows.map((r) => r.id), value).toEqual(expected);
      expect(count, value).toBe(1);
    }
  });

  it("excludes a member holding no answer", async () => {
    // A missing key is SQL NULL through `->>`, and NULL = 'M' is not true. The
    // member must simply not match, rather than matching everything or
    // erroring.
    for (const value of CAT_OPTIONS) {
      const { rows } = await readAll(mine({ [`cf:${CAT_KEY}`]: value }), fields);
      expect(rows.map((r) => r.id)).not.toContain(unansweredId);
    }
  });

  it("returns nothing, and no error, for an option no member holds", async () => {
    const { rows, count } = await readAll(
      mine({ [`cf:${CAT_KEY}`]: "XXL" }),
      fields
    );
    expect(rows).toHaveLength(0);
    expect(count).toBe(0);
  });

  it("narrows on source — §4.2's roster-cleanup query", async () => {
    const self = await readAll(mine({ source: "self_checkin" }), fields);
    expect(self.rows.map((r) => r.id).sort()).toEqual([...selfIds].sort());
    expect(self.rows.every((r) => r.source === "self_checkin")).toBe(true);

    const admin = await readAll(mine({ source: "admin" }), fields);
    expect(admin.rows.every((r) => r.source === "admin")).toBe(true);
    expect(self.count + admin.count).toBe(await readAll(mine({}), fields).then((r) => r.count));
  });

  it("composes source with a custom field as a conjunction", async () => {
    // An admin-created member holding "M" exists; a self-registered one does
    // not. Two predicates that each match something, together matching nothing,
    // is the property that proves they AND rather than OR.
    const both = await readAll(
      mine({ source: "self_checkin", [`cf:${CAT_KEY}`]: "M" }),
      fields
    );
    expect(both.rows).toHaveLength(0);
    expect(both.count).toBe(0);
  });

  it("✅ the filtered count is what an export of the same filter returns", async () => {
    // §4.5's one-translation rule on the new predicates, end to end: "filter to
    // M, then export" has to be provably the same query as the number rendered
    // beside the button. The export mirrors the route handler's chunked read
    // rather than importing it, since a Route Handler needs a request context
    // this suite cannot build.
    const filter = mine({ [`cf:${CAT_KEY}`]: "M" });
    const { count } = await readAll(filter, fields);

    const query = applyMemberFilter(
      db.from("member_directory").select(ROW_COLUMNS, { count: "exact" }),
      filter,
      fields
    );

    const exported: { id: string | null }[] = [];
    let total = 0;
    for (let offset = 0; ; offset += CHUNK) {
      const { data, error, count: c } = await query.range(offset, offset + CHUNK - 1);
      if (error) throw new Error(`export query failed: ${error.message}`);
      if (offset === 0) total = c ?? data.length;
      exported.push(...data);
      if (data.length < CHUNK || exported.length >= total) break;
    }

    expect(total).toBe(count);
    expect(exported).toHaveLength(count);
  });
});

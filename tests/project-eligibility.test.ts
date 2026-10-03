import { readFileSync } from "node:fs";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  addCivilDays,
  centralWallTimeToInstant,
  toCentralFields,
} from "@/lib/events";
import { requiresProjectEligibility } from "@/lib/member-types";
import { fetchProjectRequirements } from "@/lib/project-requirements";

import {
  anonClient,
  cleanup,
  createCurrentTermEvent,
  createTestAttendance,
  createTestEvent,
  createTestMember,
  newTracker,
  pickEmptyFall,
  termOfEvent,
  testClient,
  testIdentity,
} from "./helpers";

// Project eligibility against real Postgres (migration 30): the two views that
// carry the rule, member_directory's verdict over them, and the read the member
// page makes. The pure vocabulary is tests/member-types.test.ts.
//
// 📌 Fixtures are placed in two terms nobody else uses, so every month is in a
// known state whatever today's date is:
//   * a FAR-PAST Fall, chosen at random among the years whose 30 September is
//     a Thursday — every month long over, every verdict final;
//   * a FAR-FUTURE Fall (2060–2099, beyond claimSlot's 2030s), where every
//     month is still running and every meeting is still ahead.
// Each is re-picked if its Fall already holds events (a crashed earlier run).
// The current term gets exactly one fixture: a Projects meeting that ended a
// couple of hours ago, asserted in the one direction that cannot depend on the
// date.
//
// 🪤 Every instant is built with centralWallTimeToInstant and every weekday is
// checked with toCentralFields — the fixtures are ABOUT the gap between Central
// and UTC, so a hand-written ISO string would test the arithmetic of whoever
// wrote it. Terms are read back from an inserted event, never typed (§4.7).

const db = testClient();
const track = newTracker();

afterAll(async () => {
  await cleanup(db, track);
});

const MONTH_COLUMNS =
  "month, meetings_scheduled, meetings_held, meetings_attended, meetings_required, month_complete, status" as const;
const MEETING_COLUMNS = "event_id, status, attended, held" as const;

async function monthsOf(memberId: string, term: string) {
  const { data, error } = await db
    .from("member_general_meeting_months")
    .select(MONTH_COLUMNS)
    .eq("member_id", memberId)
    .eq("term", term)
    .order("month");
  if (error) throw new Error(`months read failed: ${error.message}`);
  return data;
}

async function meetingsOf(memberId: string, term: string) {
  const { data, error } = await db
    .from("member_project_meetings")
    .select(MEETING_COLUMNS)
    .eq("member_id", memberId)
    .eq("term", term)
    .order("starts_at");
  if (error) throw new Error(`project meetings read failed: ${error.message}`);
  return data;
}

async function verdictOf(memberId: string, term: string) {
  const { data, error } = await db
    .from("member_directory")
    .select("project_eligibility")
    .eq("id", memberId)
    .eq("term", term)
    .single();
  if (error) throw new Error(`directory read failed: ${error.message}`);
  return data.project_eligibility;
}

// The year picker and the term read-back are pickEmptyFall and termOfEvent in
// tests/helpers.ts, shared with member-directory.test.ts's type-filter block.
const pickYear = (candidates: number[]) => pickEmptyFall(db, candidates);
const termOf = (eventId: string) => termOfEvent(db, eventId);

/** A published event at a Central wall time on a civil date. */
async function meeting(
  date: string,
  time: string,
  opts: { minutes?: number; category?: string; status?: string; title: string }
) {
  const starts = centralWallTimeToInstant(date, time);
  const ends = new Date(starts.getTime() + (opts.minutes ?? 60) * 60_000);
  const event = await createTestEvent(db, track, {
    starts,
    ends,
    title: `TEST ${opts.title}`,
    category: opts.category,
    status: opts.status,
  });
  return { ...event, starts, date };
}

type Fixture = Awaited<ReturnType<typeof meeting>>;

async function member(memberType: string, joinedOn: string) {
  const identity = testIdentity();
  const id = await createTestMember(db, track, identity, {
    memberType,
    joinedAt: centralWallTimeToInstant(joinedOn, "12:00"),
  });
  return { id, identity, memberType };
}

type Member = Awaited<ReturnType<typeof member>>;

async function present(event: Fixture, who: Member, eid = who.identity.eid) {
  await createTestAttendance(db, track, {
    eventId: event.id,
    memberId: who.id,
    submittedName: who.identity.fullName,
    submittedEid: eid,
    submittedEmail: who.identity.email,
    submittedAt: event.starts,
    status: "present",
  });
}

// ---------------------------------------------------------------------------
// A finished Fall: every month judged
// ---------------------------------------------------------------------------

describe("a finished term, judged month by month", () => {
  let year = 0;
  let term = "";
  const ev: Record<string, Fixture> = {};
  const m: Record<string, Member> = {};

  beforeAll(async () => {
    // Years whose 30 September is a Thursday, Central — so the month-boundary
    // meeting below is a Thursday by construction.
    const candidates: number[] = [];
    for (let y = 1971; y <= 2015; y++) {
      if (toCentralFields(centralWallTimeToInstant(`${y}-09-30`, "12:00")).weekday === 4) {
        candidates.push(y);
      }
    }
    year = await pickYear(candidates);

    const sep30 = `${year}-09-30`;
    const day = (offset: number) => addCivilDays(sep30, offset);

    // September: three general meetings, one of them at 7:30pm on the 30th —
    // 00:30 UTC on 1 October. Around them, three Thursday-ish events that must
    // NOT count: a Wednesday at 8pm (Thursday in UTC), a Thursday Projects
    // meeting, and a cancelled Thursday.
    ev.g1 = await meeting(day(-21), "19:00", { title: "general Sep A" });
    ev.g2 = await meeting(day(-14), "19:00", {
      title: "Thursday social",
      category: "social",
    });
    ev.g3 = await meeting(sep30, "19:30", { title: "general Sep 30" });
    ev.w1 = await meeting(day(-8), "20:00", { title: "Wednesday night" });
    ev.p1 = await meeting(day(-7), "19:00", {
      title: "Thursday project meeting",
      category: "projects",
    });
    ev.c1 = await meeting(day(-28), "19:00", {
      title: "cancelled Thursday",
      status: "cancelled",
    });

    // October: two general meetings and a draft Thursday; one published
    // project meeting on a Tuesday, plus a draft and a cancelled one.
    ev.g4 = await meeting(day(7), "19:00", { title: "general Oct A" });
    ev.g5 = await meeting(day(14), "19:00", { title: "general Oct B" });
    ev.d1 = await meeting(day(21), "19:00", {
      title: "draft Thursday",
      status: "draft",
    });
    ev.p2 = await meeting(day(19), "18:00", {
      title: "Tuesday project meeting",
      category: "projects",
    });
    ev.pd = await meeting(day(12), "18:00", {
      title: "draft project meeting",
      category: "projects",
      status: "draft",
    });
    ev.pc = await meeting(day(26), "18:00", {
      title: "cancelled project meeting",
      category: "projects",
      status: "cancelled",
    });

    // November: one general meeting. December: only a cancelled Thursday, so
    // no row at all.
    ev.g6 = await meeting(day(35), "19:00", { title: "general Nov" });
    ev.c2 = await meeting(day(63), "19:00", {
      title: "cancelled December",
      status: "cancelled",
    });

    term = await termOf(ev.g1.id);

    const joined = `${year}-08-15`;
    m.allIn = await member("data_project", joined);
    m.missedProject = await member("data_project", joined);
    m.oneInSeptember = await member("client_project", joined);
    m.twoInSeptember = await member("client_project", joined);
    m.general = await member("general", joined);
    m.junior = await member("junior_director", joined);
    m.doubleRow = await member("data_project", joined);

    for (const key of ["g1", "g2", "g3", "g4", "g5", "g6", "p1", "p2"]) {
      await present(ev[key], m.allIn);
    }
    for (const key of ["g1", "g2", "g3", "g4", "g5", "g6", "p1"]) {
      await present(ev[key], m.missedProject);
    }
    // The Wednesday counts for nothing, so this is ONE general meeting in
    // September.
    for (const key of ["g1", "w1", "g4", "g5", "g6", "p1", "p2"]) {
      await present(ev[key], m.oneInSeptember);
    }
    // Two of September's three — one of them the 30th, 7:30pm. Met only if
    // that meeting is filed under September.
    for (const key of ["g1", "g3", "g4", "g5", "g6", "p1", "p2"]) {
      await present(ev[key], m.twoInSeptember);
    }
    await present(ev.g1, m.junior);
    // Two PRESENT rows for one meeting — the shape a merge leaves (lib/merge.ts)
    // — under two submitted EIDs, which is what the partial unique index allows.
    await present(ev.g1, m.doubleRow);
    await present(ev.g1, m.doubleRow, `${m.doubleRow.identity.eid}dup`);
    for (const key of ["g4", "g5", "g6", "p1", "p2"]) {
      await present(ev[key], m.doubleRow);
    }
  }, 120_000);

  it("places every fixture where it claims, in Central and in UTC", () => {
    for (const key of ["g1", "g2", "g3", "p1", "c1", "g4", "g5", "d1", "g6", "c2"]) {
      expect(toCentralFields(ev[key].starts).weekday, key).toBe(4);
    }
    // Thursday 7pm CDT is FRIDAY in UTC…
    expect(ev.g1.starts.getUTCDay()).toBe(5);
    // …Wednesday 8pm CDT is THURSDAY in UTC…
    expect(toCentralFields(ev.w1.starts).weekday).toBe(3);
    expect(ev.w1.starts.getUTCDay()).toBe(4);
    // …and 7:30pm on 30 September is 1 October in UTC.
    expect(toCentralFields(ev.g3.starts).date).toBe(`${year}-09-30`);
    expect(ev.g3.starts.toISOString().slice(0, 10)).toBe(`${year}-10-01`);
    expect(toCentralFields(ev.p2.starts).weekday).toBe(2);
    // The term was read back, and it is the year's Fall.
    expect(term.endsWith(String(year))).toBe(true);
  });

  it("counts a meeting by its CENTRAL weekday and month, never UTC's", async () => {
    // Any member will do: the meetings a month holds are the same for all.
    const months = await monthsOf(m.general.id, term);
    expect(months.map((row) => row.month)).toEqual([
      `${year}-09-01`,
      `${year}-10-01`,
      `${year}-11-01`,
    ]);
    // September: the 9th, 16th and 30th. Not the Wednesday (a Thursday in
    // UTC), not the Thursday Projects meeting, not the cancelled Thursday.
    expect(months[0].meetings_scheduled).toBe(3);
    // October: two — the draft Thursday is not a meeting, and the 30
    // September meeting did not leak in.
    expect(months[1].meetings_scheduled).toBe(2);
    expect(months[2].meetings_scheduled).toBe(1);
  });

  it("has no row for a month whose only Thursday event was cancelled", async () => {
    const months = await monthsOf(m.general.id, term);
    expect(months.map((row) => row.month)).not.toContain(`${year}-12-01`);
  });

  it("needs 2 a month, or every meeting when fewer than 2 were held", async () => {
    const months = await monthsOf(m.allIn.id, term);
    expect(
      months.map((row) => [row.meetings_held, row.meetings_required])
    ).toEqual([
      [3, 2],
      [2, 2],
      [1, 1],
    ]);
    // Every one of these months is over, and so is every meeting in it.
    expect(months.every((row) => row.month_complete)).toBe(true);
    expect(months.map((row) => row.status)).toEqual(["met", "met", "met"]);
  });

  it("treats a Thursday Projects event as a project meeting only", async () => {
    // P1 is in the project list and was never in September's count (above).
    // The draft and the cancelled project meetings are in neither.
    const meetings = await meetingsOf(m.allIn.id, term);
    expect(meetings.map((row) => row.event_id)).toEqual([ev.p1.id, ev.p2.id]);
    expect(meetings.map((row) => row.status)).toEqual(["attended", "attended"]);
  });

  it("calls a project meeting that ended unattended a miss, and the verdict No", async () => {
    const meetings = await meetingsOf(m.missedProject.id, term);
    expect(meetings.map((row) => row.status)).toEqual(["attended", "missed"]);
    // Every general month met — the one miss is the whole verdict.
    expect(
      (await monthsOf(m.missedProject.id, term)).every((row) => row.status === "met")
    ).toBe(true);
    expect(await verdictOf(m.missedProject.id, term)).toBe("no");
  });

  it("calls a finished month short of its meetings not met, and the verdict No", async () => {
    const [september] = await monthsOf(m.oneInSeptember.id, term);
    expect(september).toMatchObject({
      meetings_attended: 1,
      meetings_required: 2,
      month_complete: true,
      status: "not_met",
    });
    expect(await verdictOf(m.oneInSeptember.id, term)).toBe("no");
  });

  it("files the 30 September meeting under September, which is what makes this Yes", async () => {
    const [september, october] = await monthsOf(m.twoInSeptember.id, term);
    expect(september).toMatchObject({ meetings_attended: 2, status: "met" });
    expect(october).toMatchObject({ meetings_attended: 2, status: "met" });
    expect(await verdictOf(m.twoInSeptember.id, term)).toBe("yes");
  });

  it("gives Yes when everything was attended", async () => {
    expect(await verdictOf(m.allIn.id, term)).toBe("yes");
  });

  it("gives N/A to General and Junior director, whatever they attended", async () => {
    expect(await verdictOf(m.general.id, term)).toBe("not_applicable");
    expect(await verdictOf(m.junior.id, term)).toBe("not_applicable");
  });

  it("counts two present rows for one meeting ONCE", async () => {
    const [september] = await monthsOf(m.doubleRow.id, term);
    expect(september.meetings_attended).toBe(1);
    expect(september.status).toBe("not_met");
    expect(await verdictOf(m.doubleRow.id, term)).toBe("no");
  });

  it("accepted all four types", () => {
    expect(new Set(Object.values(m).map((who) => who.memberType))).toEqual(
      new Set(["general", "data_project", "client_project", "junior_director"])
    );
  });

  it("✅ agrees with member_directory's column for every fixture", async () => {
    // The rule, re-derived here from the two views, against the view that is
    // meant to apply it — so the directory's CASE and the views cannot drift.
    for (const [name, who] of Object.entries(m)) {
      const meetings = await meetingsOf(who.id, term);
      const months = await monthsOf(who.id, term);
      const expected = requiresProjectEligibility(who.memberType)
        ? meetings.some((row) => row.status === "missed") ||
          months.some((row) => row.status === "not_met")
          ? "no"
          : "yes"
        : "not_applicable";
      expect(await verdictOf(who.id, term), name).toBe(expected);
    }
  });

  it("is what fetchProjectRequirements hands the member page, in order", async () => {
    const requirements = await fetchProjectRequirements(db, m.allIn.id, term);
    expect(requirements.months.kind).toBe("ok");
    expect(requirements.meetings.kind).toBe("ok");
    if (requirements.months.kind !== "ok" || requirements.meetings.kind !== "ok") {
      return;
    }

    expect(requirements.months.rows.map((row) => row.month)).toEqual([
      `${year}-09-01`,
      `${year}-10-01`,
      `${year}-11-01`,
    ]);
    expect(requirements.months.rows[0]).toEqual({
      month: `${year}-09-01`,
      meetingsScheduled: 3,
      meetingsHeld: 3,
      meetingsAttended: 3,
      meetingsRequired: 2,
      complete: true,
      status: "met",
    });

    expect(requirements.meetings.rows.map((row) => row.eventId)).toEqual([
      ev.p1.id,
      ev.p2.id,
    ]);
    expect(requirements.meetings.rows[0]).toMatchObject({
      title: "TEST Thursday project meeting",
      status: "attended",
    });
  });

  it("🔓 gives anon an error for both lists — never an empty one", async () => {
    // Both views are revoked from anon. An empty list here would read as "this
    // member has nothing to meet"; the discriminated result says the read
    // failed instead.
    const requirements = await fetchProjectRequirements(
      anonClient(),
      m.allIn.id,
      term
    );
    expect(requirements.months).toEqual({ kind: "error" });
    expect(requirements.meetings).toEqual({ kind: "error" });
  });
});

// ---------------------------------------------------------------------------
// A term still running: nothing judged yet
// ---------------------------------------------------------------------------

describe("a term whose months are still running", () => {
  let term = "";
  const ev: Record<string, Fixture> = {};
  const m: Record<string, Member> = {};

  beforeAll(async () => {
    const candidates = Array.from({ length: 40 }, (_, i) => 2060 + i);
    const year = await pickYear(candidates);

    // The first three Thursdays of October, and a Tuesday project meeting.
    let first = `${year}-10-01`;
    while (toCentralFields(centralWallTimeToInstant(first, "12:00")).weekday !== 4) {
      first = addCivilDays(first, 1);
    }
    ev.t1 = await meeting(first, "19:00", { title: "future Thursday A" });
    ev.t2 = await meeting(addCivilDays(first, 7), "19:00", {
      title: "future Thursday B",
    });
    ev.t3 = await meeting(addCivilDays(first, 14), "19:00", {
      title: "future Thursday C",
    });
    ev.p3 = await meeting(addCivilDays(first, 5), "18:00", {
      title: "future project meeting",
      category: "projects",
    });
    term = await termOf(ev.t1.id);

    const joined = `${year}-08-15`;
    m.none = await member("data_project", joined);
    m.one = await member("data_project", joined);
    m.two = await member("client_project", joined);

    // Present rows ahead of the meeting — an officer's manual entry can do
    // that, and the view must not treat the month as judged because of it.
    await present(ev.t1, m.one);
    await present(ev.t1, m.two);
    await present(ev.t2, m.two);
  }, 60_000);

  it("is in progress with 0 or 1 attended — never not met — and the verdict Yes", async () => {
    for (const [who, attended] of [
      [m.none, 0],
      [m.one, 1],
    ] as const) {
      const [october] = await monthsOf(who.id, term);
      expect(october).toMatchObject({
        meetings_scheduled: 3,
        meetings_held: 0,
        meetings_attended: attended,
        meetings_required: 2,
        month_complete: false,
        status: "in_progress",
      });
      expect(await verdictOf(who.id, term)).toBe("yes");
    }
  });

  it("is met once 2 are attended, before the month is over", async () => {
    const [october] = await monthsOf(m.two.id, term);
    expect(october).toMatchObject({
      meetings_attended: 2,
      month_complete: false,
      status: "met",
    });
    expect(await verdictOf(m.two.id, term)).toBe("yes");
  });

  it("calls a project meeting that has not happened yet upcoming, not missed", async () => {
    for (const who of Object.values(m)) {
      const meetings = await meetingsOf(who.id, term);
      expect(meetings).toEqual([
        { event_id: ev.p3.id, status: "upcoming", attended: false, held: false },
      ]);
    }
  });
});

// ---------------------------------------------------------------------------
// The current term
// ---------------------------------------------------------------------------

describe("the current term", () => {
  it("counts a Projects meeting that ended unattended as a miss, and the verdict No", async () => {
    // Only this direction is asserted. Whether any month of the current term is
    // judged yet depends on today's date; a miss is a miss on any date.
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity, {
      memberType: "data_project",
    });
    const event = await createCurrentTermEvent(db, track, {
      points: 1,
      category: "projects",
    });

    const meetings = await meetingsOf(memberId, event.term);
    expect(meetings.find((row) => row.event_id === event.id)).toMatchObject({
      status: "missed",
      held: true,
      attended: false,
    });
    expect(await verdictOf(memberId, event.term)).toBe("no");
  });
});

// ---------------------------------------------------------------------------
// The member page never shows another term's verdict
// ---------------------------------------------------------------------------

describe("the member page's off-roster row", () => {
  it("🔓 sets project_eligibility to null rather than inheriting another term's", () => {
    // A member with no row this term gets a synthesized one built from
    // `identity` — whichever term row came back first. The verdict is per
    // (member, term), so spreading identity's through would print another
    // term's verdict under this term's heading.
    const page = readFileSync("app/admin/(shell)/members/[id]/page.tsx", "utf8");
    const start = page.indexOf("const member = scoped ?? {");
    expect(start).toBeGreaterThan(-1);
    const synthesized = page.slice(start, page.indexOf("\n  };", start));
    expect(synthesized).toContain("...identity");
    expect(synthesized).toMatch(/^\s*project_eligibility: null,$/m);
  });
});

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
  GENERAL_MEETINGS_FROM,
  newTracker,
  pickEmptyFall,
  setGeneralMeetingsFrom,
  termOfEvent,
  testClient,
  testIdentity,
} from "./helpers";

// Project eligibility against real Postgres (migrations 30 and 31): the two
// views that carry the rule, member_directory's verdict over them, and the read
// the member page makes. The pure vocabulary is tests/member-types.test.ts.
//
// 📌 THE RULE SINCE MIGRATION 31 (officer, 2026-10-04). A general meeting is a
// PUBLISHED event with "Count as general meeting" ticked, in ANY category — a
// ticked Projects event is a project meeting and a general meeting — in a
// Central month on or after app_settings.general_meetings_from. The weekday
// decides nothing. Project meetings have no start month.
//
// 📌 That start is 2026-10-01, and no month after it has ended yet, so a judged
// month exists only on a far-past term judged from an EARLIER start. The
// finished term below pins one for its own run and puts it back: in its
// afterAll, in a `finally` around each case that moves it further, and in this
// file's afterAll. It is global state — tests/helpers.ts says why and how.
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
  // The start first, so a failed cleanup cannot leave it pinned on a far-past
  // month for every file that runs after this one.
  try {
    await setGeneralMeetingsFrom(db, GENERAL_MEETINGS_FROM);
  } finally {
    await cleanup(db, track);
  }
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

/**
 * A published event at a Central wall time on a civil date. `general` ticks
 * "Count as general meeting"; omitted, the event takes the column default and
 * starts unticked, as every real event does.
 */
async function meeting(
  date: string,
  time: string,
  opts: {
    minutes?: number;
    category?: string;
    status?: string;
    general?: boolean;
    title: string;
  }
) {
  const starts = centralWallTimeToInstant(date, time);
  const ends = new Date(starts.getTime() + (opts.minutes ?? 60) * 60_000);
  const event = await createTestEvent(db, track, {
    starts,
    ends,
    title: `TEST ${opts.title}`,
    category: opts.category,
    status: opts.status,
    countsAsGeneralMeeting: opts.general,
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

/** The first Central Thursday on or after a civil date. */
function firstThursdayFrom(date: string): string {
  let day = date;
  while (toCentralFields(centralWallTimeToInstant(day, "12:00")).weekday !== 4) {
    day = addCivilDays(day, 1);
  }
  return day;
}

// ---------------------------------------------------------------------------
// A finished Fall: every month judged
// ---------------------------------------------------------------------------

describe("a finished term, judged month by month", () => {
  let year = 0;
  let term = "";
  /** This block's start: its own August, so September is judged at all. */
  let pinnedStart = "";
  const ev: Record<string, Fixture> = {};
  const m: Record<string, Member> = {};

  /**
   * Run `body` with the start moved, putting this block's own pin back after —
   * in a `finally`, so a failed assertion cannot leave it moved.
   */
  async function withStart(month: string, body: () => Promise<void>) {
    await setGeneralMeetingsFrom(db, month);
    try {
      await body();
    } finally {
      await setGeneralMeetingsFrom(db, pinnedStart);
    }
  }

  beforeAll(async () => {
    // Years whose 30 September is a Thursday, Central. The weekday decides
    // nothing since migration 31 — the tick does — but a known calendar lets
    // the fixtures put an UNTICKED Thursday and a TICKED Wednesday at fixed
    // dates, and keeps 7:30pm on the 30th as the month-boundary case.
    const candidates: number[] = [];
    for (let y = 1971; y <= 2015; y++) {
      if (toCentralFields(centralWallTimeToInstant(`${y}-09-30`, "12:00")).weekday === 4) {
        candidates.push(y);
      }
    }
    year = await pickYear(candidates);

    // Every month of this Fall is decades before the real start, so under it
    // nothing here would be judged. Judge it from its own August instead; the
    // afterAll below restores the real start.
    pinnedStart = `${year}-08-01`;
    await setGeneralMeetingsFrom(db, pinnedStart);

    const sep30 = `${year}-09-30`;
    const day = (offset: number) => addCivilDays(sep30, offset);

    // September: four general meetings — the 9th, the 16th (a social), a
    // TICKED Wednesday, and 7:30pm on the 30th, which is 00:30 UTC on
    // 1 October. Around them, three that must NOT count: an UNTICKED Thursday
    // at noon on the 9th, an unticked Thursday Projects meeting (a project
    // meeting and nothing else), and a cancelled ticked Thursday.
    ev.c1 = await meeting(day(-28), "19:00", {
      title: "cancelled ticked Thursday",
      status: "cancelled",
      general: true,
    });
    ev.g1 = await meeting(day(-21), "19:00", {
      title: "general Sep A",
      general: true,
    });
    ev.u1 = await meeting(day(-21), "12:00", { title: "unticked Thursday" });
    ev.g2 = await meeting(day(-14), "19:00", {
      title: "ticked Thursday social",
      category: "social",
      general: true,
    });
    ev.w1 = await meeting(day(-8), "20:00", {
      title: "ticked Wednesday night",
      general: true,
    });
    ev.p1 = await meeting(day(-7), "19:00", {
      title: "Thursday project meeting",
      category: "projects",
    });
    ev.g3 = await meeting(sep30, "19:30", {
      title: "general Sep 30",
      general: true,
    });

    // October: two general meetings and a TICKED Projects meeting, which is
    // both kinds; an unticked project meeting; and three ticked events that are
    // no meeting at all — a draft, a draft project meeting and a cancelled one.
    ev.pg = await meeting(day(5), "18:00", {
      title: "ticked project meeting",
      category: "projects",
      general: true,
    });
    ev.g4 = await meeting(day(7), "19:00", {
      title: "general Oct A",
      general: true,
    });
    ev.pd = await meeting(day(12), "18:00", {
      title: "draft project meeting",
      category: "projects",
      status: "draft",
      general: true,
    });
    ev.g5 = await meeting(day(14), "19:00", {
      title: "general Oct B",
      general: true,
    });
    ev.p2 = await meeting(day(19), "18:00", {
      title: "Tuesday project meeting",
      category: "projects",
    });
    ev.d1 = await meeting(day(21), "19:00", {
      title: "draft ticked Thursday",
      status: "draft",
      general: true,
    });
    ev.pc = await meeting(day(26), "18:00", {
      title: "cancelled project meeting",
      category: "projects",
      status: "cancelled",
      general: true,
    });

    // November: one general meeting. December: only a cancelled ticked one, so
    // no row at all.
    ev.g6 = await meeting(day(35), "19:00", {
      title: "general Nov",
      general: true,
    });
    ev.c2 = await meeting(day(63), "19:00", {
      title: "cancelled December",
      status: "cancelled",
      general: true,
    });

    term = await termOf(ev.g1.id);

    const joined = `${year}-08-15`;
    m.allIn = await member("data_project", joined);
    m.missedProject = await member("data_project", joined);
    m.missedSeptemberProject = await member("client_project", joined);
    m.oneInSeptember = await member("client_project", joined);
    m.twoInSeptember = await member("client_project", joined);
    m.tickedWednesday = await member("data_project", joined);
    m.projectAsGeneral = await member("client_project", joined);
    m.general = await member("general", joined);
    m.junior = await member("junior_director", joined);
    m.doubleRow = await member("data_project", joined);

    // Everything that counts for anything: four general meetings in September,
    // three in October (pg among them), one in November, and the three project
    // meetings p1, pg and p2.
    const everything = ["g1", "g2", "w1", "g3", "p1", "pg", "g4", "g5", "p2", "g6"];
    for (const key of everything) await present(ev[key], m.allIn);
    for (const key of everything.filter((key) => key !== "p2")) {
      await present(ev[key], m.missedProject);
    }
    // Every general meeting, and misses only September's project meeting —
    // which counts whatever the start, because project meetings have none.
    for (const key of everything.filter((key) => key !== "p1")) {
      await present(ev[key], m.missedSeptemberProject);
    }
    // The unticked Thursday counts for nothing, so this is ONE general meeting
    // in September.
    for (const key of ["g1", "u1", "p1", "pg", "g4", "g5", "p2", "g6"]) {
      await present(ev[key], m.oneInSeptember);
    }
    // Two of September's four — one of them the 30th, 7:30pm. Met only if that
    // meeting is filed under September.
    for (const key of ["g1", "g3", "p1", "pg", "g4", "g5", "p2", "g6"]) {
      await present(ev[key], m.twoInSeptember);
    }
    // Two in September only if the ticked WEDNESDAY counts.
    for (const key of ["g1", "w1", "p1", "pg", "g4", "g5", "p2", "g6"]) {
      await present(ev[key], m.tickedWednesday);
    }
    // October reaches 2 only if the ticked Projects meeting counts as a
    // general meeting too.
    for (const key of ["g1", "g2", "g4", "g6", "p1", "pg", "p2"]) {
      await present(ev[key], m.projectAsGeneral);
    }
    await present(ev.g1, m.junior);
    // Two PRESENT rows for one meeting — the shape a merge leaves (lib/merge.ts)
    // — under two submitted EIDs, which is what the partial unique index allows.
    await present(ev.g1, m.doubleRow);
    await present(ev.g1, m.doubleRow, `${m.doubleRow.identity.eid}dup`);
    for (const key of ["g4", "g5", "g6", "p1", "pg", "p2"]) {
      await present(ev[key], m.doubleRow);
    }
  }, 120_000);

  afterAll(async () => {
    // Always to the constant, never to what was read first (tests/helpers.ts).
    await setGeneralMeetingsFrom(db, GENERAL_MEETINGS_FROM);
  });

  it("places every fixture where it claims, in Central and in UTC, ticked or not", async () => {
    for (const key of ["c1", "g1", "u1", "g2", "p1", "g3", "g4", "g5", "d1", "g6", "c2"]) {
      expect(toCentralFields(ev[key].starts).weekday, key).toBe(4);
    }
    for (const key of ["pg", "pd", "p2", "pc"]) {
      expect(toCentralFields(ev[key].starts).weekday, key).toBe(2);
    }
    // The unticked Thursday shares a Central day with g1.
    expect(toCentralFields(ev.u1.starts).date).toBe(
      toCentralFields(ev.g1.starts).date
    );
    // Thursday 7pm CDT is FRIDAY in UTC…
    expect(ev.g1.starts.getUTCDay()).toBe(5);
    // …Wednesday 8pm CDT is THURSDAY in UTC…
    expect(toCentralFields(ev.w1.starts).weekday).toBe(3);
    expect(ev.w1.starts.getUTCDay()).toBe(4);
    // …and 7:30pm on 30 September is 1 October in UTC.
    expect(toCentralFields(ev.g3.starts).date).toBe(`${year}-09-30`);
    expect(ev.g3.starts.toISOString().slice(0, 10)).toBe(`${year}-10-01`);
    // The term was read back, and it is the year's Fall.
    expect(term.endsWith(String(year))).toBe(true);

    // The ticks were stored as the fixtures claim — u1, p1 and p2 took the
    // column default.
    const { data, error } = await db
      .from("events")
      .select("id, counts_as_general_meeting")
      .in(
        "id",
        Object.values(ev).map((event) => event.id)
      );
    expect(error).toBeNull();
    const ticked = new Set(
      (data ?? [])
        .filter((row) => row.counts_as_general_meeting)
        .map((row) => row.id)
    );
    expect(
      Object.keys(ev)
        .filter((key) => ticked.has(ev[key].id))
        .sort()
    ).toEqual(
      ["c1", "c2", "d1", "g1", "g2", "g3", "g4", "g5", "g6", "pc", "pd", "pg", "w1"].sort()
    );
  });

  it("files a meeting under its CENTRAL month, never UTC's", async () => {
    // Any member will do: the meetings a month holds are the same for all.
    const months = await monthsOf(m.general.id, term);
    expect(months.map((row) => row.month)).toEqual([
      `${year}-09-01`,
      `${year}-10-01`,
      `${year}-11-01`,
    ]);
    // September: the 9th, the 16th, the Wednesday and the 30th.
    expect(months[0].meetings_scheduled).toBe(4);
    // October: g4, g5 and the ticked project meeting — and the 30 September
    // meeting did not leak in.
    expect(months[1].meetings_scheduled).toBe(3);
    expect(months[2].meetings_scheduled).toBe(1);
  });

  it("has no row for a month whose only ticked event was cancelled", async () => {
    const months = await monthsOf(m.general.id, term);
    expect(months.map((row) => row.month)).not.toContain(`${year}-12-01`);
  });

  it("needs 2 a month, or every meeting when fewer than 2 were held", async () => {
    const months = await monthsOf(m.allIn.id, term);
    expect(
      months.map((row) => [row.meetings_held, row.meetings_required])
    ).toEqual([
      [4, 2],
      [3, 2],
      [1, 1],
    ]);
    // Every one of these months is over, and so is every meeting in it.
    expect(months.every((row) => row.month_complete)).toBe(true);
    expect(months.map((row) => row.status)).toEqual(["met", "met", "met"]);
  });

  it("counts a ticked Wednesday, and never an unticked Thursday", async () => {
    // Present at g1 and at the unticked Thursday the same day: one counts.
    const [oneSeptember] = await monthsOf(m.oneInSeptember.id, term);
    expect(oneSeptember.meetings_attended).toBe(1);
    // Present at g1 and the ticked Wednesday: two count.
    const [wednesday] = await monthsOf(m.tickedWednesday.id, term);
    expect(wednesday).toMatchObject({ meetings_attended: 2, status: "met" });
    expect(await verdictOf(m.tickedWednesday.id, term)).toBe("yes");
  });

  it("counts a ticked Projects event as a project meeting AND a general meeting", async () => {
    const meetings = await meetingsOf(m.projectAsGeneral.id, term);
    expect(meetings.map((row) => row.event_id)).toEqual([
      ev.p1.id,
      ev.pg.id,
      ev.p2.id,
    ]);
    expect(meetings.every((row) => row.status === "attended")).toBe(true);
    // g4 and pg: two only because pg counts here as well.
    const october = (await monthsOf(m.projectAsGeneral.id, term)).find(
      (row) => row.month === `${year}-10-01`
    );
    expect(october).toMatchObject({
      meetings_attended: 2,
      meetings_required: 2,
      status: "met",
    });
    expect(await verdictOf(m.projectAsGeneral.id, term)).toBe("yes");
  });

  it("lists every published Projects event as a project meeting, ticked or not", async () => {
    // P1 is unticked and so a project meeting and nothing else — it was never
    // in September's count (above).
    const meetings = await meetingsOf(m.allIn.id, term);
    expect(meetings.map((row) => row.event_id)).toEqual([
      ev.p1.id,
      ev.pg.id,
      ev.p2.id,
    ]);
    expect(meetings.map((row) => row.status)).toEqual([
      "attended",
      "attended",
      "attended",
    ]);
  });

  it("counts a ticked draft or cancelled event as neither kind of meeting", async () => {
    // pd (a draft) and pc (cancelled) are ticked Projects events; d1, c1 and
    // c2 are ticked general ones. None is in the project list…
    const ids = (await meetingsOf(m.allIn.id, term)).map((row) => row.event_id);
    for (const key of ["pd", "pc", "d1", "c1", "c2"]) {
      expect(ids, key).not.toContain(ev[key].id);
    }
    // …and none is in a month: October's three are pg, g4 and g5, and
    // December, holding only c2, has no row.
    const months = await monthsOf(m.allIn.id, term);
    expect(months.map((row) => [row.month, row.meetings_scheduled])).toEqual([
      [`${year}-09-01`, 4],
      [`${year}-10-01`, 3],
      [`${year}-11-01`, 1],
    ]);
  });

  it("calls a project meeting that ended unattended a miss, and the verdict No", async () => {
    const meetings = await meetingsOf(m.missedProject.id, term);
    expect(meetings.map((row) => row.status)).toEqual([
      "attended",
      "attended",
      "missed",
    ]);
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
    // pg, g4 and g5. Four, had the 30 September meeting crossed into October.
    expect(october).toMatchObject({ meetings_attended: 3, status: "met" });
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
      meetingsScheduled: 4,
      meetingsHeld: 4,
      meetingsAttended: 4,
      meetingsRequired: 2,
      complete: true,
      status: "met",
    });

    expect(requirements.meetings.rows.map((row) => row.eventId)).toEqual([
      ev.p1.id,
      ev.pg.id,
      ev.p2.id,
    ]);
    expect(requirements.meetings.rows[0]).toMatchObject({
      title: "TEST Thursday project meeting",
      status: "attended",
    });

    // The month the page says general meetings count from: whatever the
    // months view is filtering on right now, which here is this block's pin.
    expect(requirements.generalMeetingsFrom).toEqual({
      kind: "ok",
      month: pinnedStart,
    });
  });

  it("judges nothing before the start month — but a project meeting has no start", async () => {
    await withStart(`${year}-10-01`, async () => {
      const months = await monthsOf(m.general.id, term);
      expect(months.map((row) => row.month)).toEqual([
        `${year}-10-01`,
        `${year}-11-01`,
      ]);
      // Still three: the 30 September meeting is a SEPTEMBER meeting, so the
      // cutoff drops it with its month rather than letting it cross into
      // October. The cutoff and the filing are one expression.
      expect(months[0].meetings_scheduled).toBe(3);

      // September no longer counts against anybody…
      expect(await verdictOf(m.oneInSeptember.id, term)).toBe("yes");
      expect(await verdictOf(m.doubleRow.id, term)).toBe("yes");
      // …but September's project meeting still does, and so does October's.
      expect(await verdictOf(m.missedSeptemberProject.id, term)).toBe("no");
      expect(await verdictOf(m.missedProject.id, term)).toBe("no");
      expect(
        (await meetingsOf(m.allIn.id, term)).map((row) => row.event_id)
      ).toEqual([ev.p1.id, ev.pg.id, ev.p2.id]);

      expect(
        (await fetchProjectRequirements(db, m.allIn.id, term)).generalMeetingsFrom
      ).toEqual({ kind: "ok", month: `${year}-10-01` });
    });
  });

  it("judges no month of a far-past term from the real start, and still every project meeting", async () => {
    await withStart(GENERAL_MEETINGS_FROM, async () => {
      for (const [name, who] of Object.entries(m)) {
        expect(await monthsOf(who.id, term), name).toEqual([]);
      }
      const meetings = await meetingsOf(m.missedProject.id, term);
      expect(meetings.map((row) => row.status)).toEqual([
        "attended",
        "attended",
        "missed",
      ]);
      expect(await verdictOf(m.missedProject.id, term)).toBe("no");
      expect(await verdictOf(m.missedSeptemberProject.id, term)).toBe("no");
      expect(await verdictOf(m.oneInSeptember.id, term)).toBe("yes");
      expect(
        (await fetchProjectRequirements(db, m.allIn.id, term)).generalMeetingsFrom
      ).toEqual({ kind: "ok", month: GENERAL_MEETINGS_FROM });
    });
  });

  it("🔓 gives anon an error for all three reads — never an empty answer", async () => {
    // Both views are revoked from anon, and app_settings is deny-all: anon
    // gets ZERO rows there rather than an error, which the read must still call
    // a failure. An empty list would read as "this member has nothing to
    // meet", and a missing start as "every month is judged".
    const requirements = await fetchProjectRequirements(
      anonClient(),
      m.allIn.id,
      term
    );
    expect(requirements.months).toEqual({ kind: "error" });
    expect(requirements.meetings).toEqual({ kind: "error" });
    expect(requirements.generalMeetingsFrom).toEqual({ kind: "error" });
  });
});

// ---------------------------------------------------------------------------
// A term still running: nothing judged yet
// ---------------------------------------------------------------------------

describe("a term whose months are still running", () => {
  let year = 0;
  let term = "";
  const ev: Record<string, Fixture> = {};
  const m: Record<string, Member> = {};

  /** One member's October row, found by month — September has a row too. */
  async function octoberOf(who: Member) {
    return (await monthsOf(who.id, term)).find(
      (row) => row.month === `${year}-10-01`
    );
  }

  beforeAll(async () => {
    // The REAL start. Nothing in this block moves it; setting it here only
    // heals a value a killed run might have left behind.
    await setGeneralMeetingsFrom(db, GENERAL_MEETINGS_FROM);

    const candidates = Array.from({ length: 40 }, (_, i) => 2060 + i);
    year = await pickYear(candidates);

    // September's first Thursday, then the first three of October — all
    // ticked — and an unticked Tuesday project meeting.
    ev.s1 = await meeting(firstThursdayFrom(`${year}-09-01`), "19:00", {
      title: "future September meeting",
      general: true,
    });
    const first = firstThursdayFrom(`${year}-10-01`);
    ev.t1 = await meeting(first, "19:00", {
      title: "future Thursday A",
      general: true,
    });
    ev.t2 = await meeting(addCivilDays(first, 7), "19:00", {
      title: "future Thursday B",
      general: true,
    });
    ev.t3 = await meeting(addCivilDays(first, 14), "19:00", {
      title: "future Thursday C",
      general: true,
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

  it("judges its September too — the start is one fixed month, not one per term", async () => {
    // Decades after 2026-10-01, so this Fall's September has a row. A start
    // read as "each term's October" would have dropped it.
    const months = await monthsOf(m.none.id, term);
    expect(months.map((row) => row.month)).toEqual([
      `${year}-09-01`,
      `${year}-10-01`,
    ]);
    expect(months[0]).toMatchObject({
      meetings_scheduled: 1,
      meetings_held: 0,
      meetings_required: 1,
      month_complete: false,
      status: "in_progress",
    });
  });

  it("is in progress with 0 or 1 attended — never not met — and the verdict Yes", async () => {
    for (const [who, attended] of [
      [m.none, 0],
      [m.one, 1],
    ] as const) {
      expect(await octoberOf(who)).toMatchObject({
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
    expect(await octoberOf(m.two)).toMatchObject({
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

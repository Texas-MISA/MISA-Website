import { describe, expect, it } from "vitest";

import {
  addCivilDays,
  centralWallTimeToInstant,
  countOutsideWindow,
  deriveCheckinWindow,
  duplicateDraft,
  effectiveWindow,
  expandSeries,
  findWindowConflicts,
  impactToken,
  MAX_SERIES_EVENTS,
  previewEventEdit,
  toCentralFields,
  windowOffsetsOf,
  windowsOverlap,
  type SeriesSpec,
} from "@/lib/events";

// Pure unit tests — no database, no clock mocking, no fixtures. These cover
// the arithmetic that is cheap to test here and expensive to debug through a
// form: DST, the half-open window contract, and the §4.6 impact counts.
//
// The integration counterpart is tests/event-actions.test.ts.

// Central switches to CDT (UTC-5) on 2026-03-08 and back to CST (UTC-6) on
// 2026-11-01. Every fixture below is anchored to those two dates.
const SERIES_BASE: Omit<SeriesSpec, "firstDate" | "untilDate" | "weekdays"> = {
  startTime: "18:00",
  durationMinutes: 60,
  openEarlyMinutes: 15,
  closeLateMinutes: 15,
  title: "General Meeting",
  description: null,
  location: "UTC 3.102",
  points: 1,
  category: "general_and_other",
  seriesId: "00000000-0000-4000-8000-000000000001",
};

describe("centralWallTimeToInstant", () => {
  it("resolves a CDT wall time at UTC-5", () => {
    expect(centralWallTimeToInstant("2026-10-27", "18:00").toISOString()).toBe(
      "2026-10-27T23:00:00.000Z"
    );
  });

  it("resolves a CST wall time at UTC-6", () => {
    expect(centralWallTimeToInstant("2026-11-03", "18:00").toISOString()).toBe(
      "2026-11-04T00:00:00.000Z"
    );
  });

  it("puts a full week between consecutive Tuesdays across the DST change", () => {
    // The bug this exists to catch: naively adding 7 x 24h to the Oct 27
    // instant gives 2026-11-03T23:00Z, which is 5pm Central — the meeting an
    // hour early for the rest of the semester.
    const before = centralWallTimeToInstant("2026-10-27", "18:00");
    const after = centralWallTimeToInstant("2026-11-03", "18:00");
    const naive = new Date(before.getTime() + 7 * 24 * 60 * 60 * 1000);

    expect(after.getTime() - before.getTime()).toBe(
      (7 * 24 + 1) * 60 * 60 * 1000
    );
    expect(naive.toISOString()).not.toBe(after.toISOString());
  });

  it("handles midnight without rolling the date (the hourCycle trap)", () => {
    // hour12:false renders midnight as hour 24 in some ICU builds, which would
    // silently shift this a whole day.
    expect(centralWallTimeToInstant("2026-06-15", "00:00").toISOString()).toBe(
      "2026-06-15T05:00:00.000Z"
    );
  });

  it("keeps real wall times either side of the spring-forward gap exact", () => {
    // These are the cases that decide the algorithm. Resolving the gap
    // "forward" would push 03:30 to 04:30, which is far worse than an odd
    // answer for a time that does not exist.
    expect(toCentralFields(centralWallTimeToInstant("2026-03-08", "01:00")).time).toBe("01:00");
    expect(toCentralFields(centralWallTimeToInstant("2026-03-08", "03:30")).time).toBe("03:30");
    expect(toCentralFields(centralWallTimeToInstant("2026-11-01", "06:00")).time).toBe("06:00");
  });

  it("resolves a nonexistent spring-forward wall time to the hour before", () => {
    // 2026-03-08 02:30 Central never happens; clocks jump 02:00 -> 03:00.
    // Documented consequence of applying the post-transition offset.
    const at = centralWallTimeToInstant("2026-03-08", "02:30");
    expect(toCentralFields(at).time).toBe("01:30");
  });

  it("resolves an ambiguous fall-back wall time to the first occurrence", () => {
    // 2026-11-01 01:30 Central happens twice; take the CDT one (UTC-5).
    expect(centralWallTimeToInstant("2026-11-01", "01:30").toISOString()).toBe(
      "2026-11-01T06:30:00.000Z"
    );
  });

  it("round-trips through toCentralFields", () => {
    const at = centralWallTimeToInstant("2026-09-01", "18:00");
    const fields = toCentralFields(at);
    expect(fields.date).toBe("2026-09-01");
    expect(fields.time).toBe("18:00");
    expect(fields.weekday).toBe(2); // Tuesday
  });
});

describe("addCivilDays", () => {
  it("advances across the DST change without drifting", () => {
    expect(addCivilDays("2026-10-27", 7)).toBe("2026-11-03");
  });

  it("advances across a month boundary", () => {
    expect(addCivilDays("2026-01-31", 1)).toBe("2026-02-01");
  });
});

describe("expandSeries", () => {
  it("generates one draft per matching weekday, until-date inclusive", () => {
    const drafts = expandSeries({
      ...SERIES_BASE,
      firstDate: "2026-09-01",
      untilDate: "2026-09-29",
      weekdays: [2], // Tuesday
    });

    expect(drafts).toHaveLength(5);
    expect(drafts.every((d) => d.series_id === SERIES_BASE.seriesId)).toBe(true);
    expect(drafts.every((d) => d.status === "draft")).toBe(true);
    expect(toCentralFields(drafts.at(-1)!.starts_at).date).toBe("2026-09-29");
  });

  it("keeps every occurrence at 6pm Central across the November DST change", () => {
    const drafts = expandSeries({
      ...SERIES_BASE,
      firstDate: "2026-10-06",
      untilDate: "2026-12-01",
      weekdays: [2],
    });

    expect(drafts.length).toBeGreaterThan(7);
    for (const draft of drafts) {
      const fields = toCentralFields(draft.starts_at);
      expect(fields.time).toBe("18:00");
      expect(fields.weekday).toBe(2);
    }
    // The UTC offset genuinely changes mid-series — that is the point.
    const offsets = new Set(
      drafts.map((d) => new Date(d.starts_at).getUTCHours())
    );
    expect(offsets.size).toBe(2);
  });

  it("supports multiple weekdays", () => {
    const drafts = expandSeries({
      ...SERIES_BASE,
      firstDate: "2026-09-01",
      untilDate: "2026-09-14",
      weekdays: [1, 3], // Monday and Wednesday
    });

    const weekdays = drafts.map((d) => toCentralFields(d.starts_at).weekday);
    expect(weekdays).toEqual([3, 1, 3, 1]); // Wed 2, Mon 7, Wed 9, Mon 14
  });

  it("always ends after it starts, so valid_window cannot be violated", () => {
    const drafts = expandSeries({
      ...SERIES_BASE,
      firstDate: "2026-10-25",
      untilDate: "2026-11-08",
      weekdays: [0], // Sunday, so the fall-back day is included
    });

    expect(drafts.length).toBeGreaterThan(0);
    for (const draft of drafts) {
      expect(new Date(draft.ends_at).getTime()).toBeGreaterThan(
        new Date(draft.starts_at).getTime()
      );
    }
  });

  it("caps runaway expansions", () => {
    const drafts = expandSeries({
      ...SERIES_BASE,
      firstDate: "2026-01-01",
      untilDate: "2030-01-01", // a plausible typo
      weekdays: [2],
    });
    expect(drafts).toHaveLength(MAX_SERIES_EVENTS);
  });

  it("returns nothing when no weekday is selected", () => {
    expect(
      expandSeries({
        ...SERIES_BASE,
        firstDate: "2026-09-01",
        untilDate: "2026-09-29",
        weekdays: [],
      })
    ).toEqual([]);
  });
});

describe("check-in windows", () => {
  const startsAt = new Date("2026-09-01T23:00:00.000Z");
  const endsAt = new Date("2026-09-02T00:00:00.000Z");

  it("stores null for zero offsets so the fallback stays live", () => {
    expect(
      deriveCheckinWindow({
        startsAt,
        endsAt,
        openEarlyMinutes: 0,
        closeLateMinutes: 0,
      })
    ).toEqual({ checkinOpensAt: null, checkinClosesAt: null });
  });

  it("round-trips the 15/15 preset", () => {
    const window = deriveCheckinWindow({
      startsAt,
      endsAt,
      openEarlyMinutes: 15,
      closeLateMinutes: 15,
    });

    expect(
      windowOffsetsOf({
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        checkin_opens_at: window.checkinOpensAt,
        checkin_closes_at: window.checkinClosesAt,
      })
    ).toEqual({ openEarlyMinutes: 15, closeLateMinutes: 15 });
  });

  it("reports zero offsets for a row with no explicit window", () => {
    expect(
      windowOffsetsOf({
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        checkin_opens_at: null,
        checkin_closes_at: null,
      })
    ).toEqual({ openEarlyMinutes: 0, closeLateMinutes: 0 });
  });

  it("falls back to the event's own times", () => {
    const window = effectiveWindow({
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      checkin_opens_at: null,
      checkin_closes_at: null,
    });
    expect(window.opens).toEqual(startsAt);
    expect(window.closes).toEqual(endsAt);
  });
});

describe("windowsOverlap", () => {
  // The half-open contract, which must agree with the exclusion constraint and
  // open_event_at(). Making this inclusive would stop back-to-back events from
  // being published.
  const workshop = {
    opens: new Date("2026-09-01T23:00:00Z"),
    closes: new Date("2026-09-02T00:00:00Z"),
  };

  it("treats back-to-back windows as not overlapping", () => {
    const social = {
      opens: new Date("2026-09-02T00:00:00Z"),
      closes: new Date("2026-09-02T01:00:00Z"),
    };
    expect(windowsOverlap(workshop, social)).toBe(false);
    expect(windowsOverlap(social, workshop)).toBe(false);
  });

  it("detects a one-minute overlap", () => {
    const social = {
      opens: new Date("2026-09-01T23:59:00Z"),
      closes: new Date("2026-09-02T01:00:00Z"),
    };
    expect(windowsOverlap(workshop, social)).toBe(true);
  });

  it("detects full containment", () => {
    const all_day = {
      opens: new Date("2026-09-01T12:00:00Z"),
      closes: new Date("2026-09-02T12:00:00Z"),
    };
    expect(windowsOverlap(workshop, all_day)).toBe(true);
  });
});

describe("countOutsideWindow", () => {
  const window = {
    opens: new Date("2026-09-01T23:00:00Z"),
    closes: new Date("2026-09-02T00:00:00Z"),
  };

  it("counts a submission exactly at opens as inside", () => {
    expect(
      countOutsideWindow([{ submitted_at: "2026-09-01T23:00:00.000Z" }], window)
    ).toBe(0);
  });

  it("counts a submission exactly at closes as outside", () => {
    expect(
      countOutsideWindow([{ submitted_at: "2026-09-02T00:00:00.000Z" }], window)
    ).toBe(1);
  });

  it("counts submissions on both sides", () => {
    expect(
      countOutsideWindow(
        [
          { submitted_at: "2026-09-01T22:59:59.000Z" }, // before
          { submitted_at: "2026-09-01T23:30:00.000Z" }, // inside
          { submitted_at: "2026-09-02T00:30:00.000Z" }, // after
        ],
        window
      )
    ).toBe(2);
  });
});

describe("previewEventEdit", () => {
  const current = {
    points: 1,
    term: "Fall 2026",
    starts_at: "2026-09-01T23:00:00.000Z",
    ends_at: "2026-09-02T00:00:00.000Z",
    checkin_opens_at: null,
    checkin_closes_at: null,
  };
  const presentRows = [
    { member_id: "m1", submitted_at: "2026-09-01T23:10:00.000Z" },
    { member_id: "m2", submitted_at: "2026-09-01T23:20:00.000Z" },
    { member_id: "m3", submitted_at: "2026-09-01T23:30:00.000Z" },
  ];

  it("reports nothing when nothing meaningful changed", () => {
    expect(
      previewEventEdit({
        current,
        proposed: { ...current },
        newTerm: "Fall 2026",
        presentRows,
      })
    ).toEqual([]);
  });

  it("reports a points change with the members affected and the total delta", () => {
    const warnings = previewEventEdit({
      current,
      proposed: { ...current, points: 3 },
      newTerm: "Fall 2026",
      presentRows,
    });

    expect(warnings).toEqual([
      {
        kind: "points_changed",
        from: 1,
        to: 3,
        membersAffected: 3,
        totalPointDelta: 6,
      },
    ]);
  });

  it("counts distinct members, not attendance rows", () => {
    // Two rows can share a member: the unique index is on
    // (event_id, normalized_eid), not member_id.
    const warnings = previewEventEdit({
      current,
      proposed: { ...current, points: 2 },
      newTerm: "Fall 2026",
      presentRows: [
        { member_id: "m1", submitted_at: "2026-09-01T23:10:00.000Z" },
        { member_id: "m1", submitted_at: "2026-09-01T23:11:00.000Z" },
        { member_id: null, submitted_at: "2026-09-01T23:12:00.000Z" },
      ],
    });

    expect(warnings[0]).toMatchObject({
      kind: "points_changed",
      membersAffected: 1,
      totalPointDelta: 1,
    });
  });

  it("warns when the window narrows, counting the check-ins now outside it", () => {
    const warnings = previewEventEdit({
      current,
      proposed: {
        ...current,
        // Close 25 minutes after opening: the 23:30 check-in falls outside.
        checkin_closes_at: "2026-09-01T23:25:00.000Z",
      },
      newTerm: "Fall 2026",
      presentRows,
    });

    expect(warnings).toEqual([
      { kind: "window_narrowed", checkinsNowOutside: 1 },
    ]);
  });

  it("reports a move as a move, not as a narrowing", () => {
    // Moving an event forward drags its window forward too, which trips the
    // narrowed test. Reporting both would read as "your window is shrinking"
    // when it is only following the event.
    const warnings = previewEventEdit({
      current,
      proposed: {
        ...current,
        starts_at: "2026-09-08T23:00:00.000Z",
        ends_at: "2026-09-09T00:00:00.000Z",
      },
      newTerm: "Fall 2026",
      presentRows,
    });

    expect(warnings.map((w) => w.kind)).toEqual(["times_moved"]);
    expect(warnings[0]).toMatchObject({ checkinsNowOutside: 3 });
  });

  it("does not warn when the window only widens", () => {
    expect(
      previewEventEdit({
        current,
        proposed: { ...current, checkin_closes_at: "2026-09-02T01:00:00.000Z" },
        newTerm: "Fall 2026",
        presentRows,
      })
    ).toEqual([]);
  });

  it("warns when the event moves, and separately when that crosses a term", () => {
    const warnings = previewEventEdit({
      current: { ...current, term: "Spring 2026", starts_at: "2026-07-28T23:00:00.000Z", ends_at: "2026-07-29T00:00:00.000Z" },
      proposed: {
        ...current,
        starts_at: "2026-08-04T23:00:00.000Z",
        ends_at: "2026-08-05T00:00:00.000Z",
      },
      // Supplied by the term_of RPC — never computed here (§4.7).
      newTerm: "Fall 2026",
      presentRows,
    });

    const kinds = warnings.map((w) => w.kind);
    expect(kinds).toContain("times_moved");
    expect(kinds).toContain("term_changed");
    expect(warnings.find((w) => w.kind === "term_changed")).toMatchObject({
      fromTerm: "Spring 2026",
      toTerm: "Fall 2026",
      membersAffected: 3,
    });
  });
});

describe("impactToken", () => {
  const proposed = { points: 2, starts_at: "2026-09-01T23:00:00.000Z" };

  it("is stable for identical input", () => {
    expect(impactToken("e1", "2026-07-30T12:00:00.123456+00:00", proposed)).toBe(
      impactToken("e1", "2026-07-30T12:00:00.123456+00:00", proposed)
    );
  });

  it("ignores key order", () => {
    expect(impactToken("e1", "t", { a: 1, b: 2 })).toBe(
      impactToken("e1", "t", { b: 2, a: 1 })
    );
  });

  it("changes when a proposed value changes", () => {
    expect(impactToken("e1", "t", proposed)).not.toBe(
      impactToken("e1", "t", { ...proposed, points: 3 })
    );
  });

  it("changes when updated_at changes, which is what makes it a CAS", () => {
    expect(impactToken("e1", "t1", proposed)).not.toBe(
      impactToken("e1", "t2", proposed)
    );
  });

  it("distinguishes microsecond-precision timestamps", () => {
    // PostgREST returns microseconds; a Date round-trip would collapse these
    // two into one and make every save report a phantom conflict.
    expect(
      impactToken("e1", "2026-07-30T12:00:00.123456+00:00", proposed)
    ).not.toBe(impactToken("e1", "2026-07-30T12:00:00.123999+00:00", proposed));
  });
});

describe("duplicateDraft", () => {
  const source = {
    title: "General Meeting",
    description: "Weekly",
    location: "UTC 3.102",
    starts_at: "2026-10-27T23:00:00.000Z", // Tue 6pm CDT
    ends_at: "2026-10-28T00:00:00.000Z",
    checkin_opens_at: "2026-10-27T22:45:00.000Z",
    checkin_closes_at: "2026-10-28T00:15:00.000Z",
    points: 2,
    category: "general_and_other",
  };

  it("defaults to the same wall time seven civil days later, across DST", () => {
    const draft = duplicateDraft(source);
    const fields = toCentralFields(draft.starts_at);

    expect(fields.date).toBe("2026-11-03");
    expect(fields.time).toBe("18:00");
    // Same wall clock, different UTC instant — the whole point.
    expect(draft.starts_at).toBe("2026-11-04T00:00:00.000Z");
  });

  it("preserves duration, window offsets, points, and category", () => {
    const draft = duplicateDraft(source);

    expect(
      new Date(draft.ends_at).getTime() - new Date(draft.starts_at).getTime()
    ).toBe(60 * 60 * 1000);
    expect(windowOffsetsOf(draft)).toEqual({
      openEarlyMinutes: 15,
      closeLateMinutes: 15,
    });
    expect(draft.points).toBe(2);
    expect(draft.category).toBe("general_and_other");
    expect(draft.title).toBe("General Meeting");
  });

  it("is always a draft and never joins the source's series", () => {
    const draft = duplicateDraft(source, { date: "2026-12-01" });
    expect(draft.status).toBe("draft");
    expect(draft.series_id).toBeNull();
  });
});

describe("findWindowConflicts", () => {
  const published = [
    {
      id: "career-fair",
      title: "Fall Career Fair",
      starts_at: "2026-10-13T22:00:00.000Z",
      ends_at: "2026-10-14T01:00:00.000Z",
      checkin_opens_at: null,
      checkin_closes_at: null,
    },
  ];

  it("finds a candidate colliding with an already-published event", () => {
    const conflicts = findWindowConflicts(
      [
        {
          title: "General Meeting",
          starts_at: "2026-10-13T23:00:00.000Z",
          ends_at: "2026-10-14T00:00:00.000Z",
          checkin_opens_at: null,
          checkin_closes_at: null,
        },
      ],
      published
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      withEventId: "career-fair",
      withTitle: "Fall Career Fair",
    });
  });

  it("passes a candidate that only abuts the published window", () => {
    expect(
      findWindowConflicts(
        [
          {
            title: "General Meeting",
            starts_at: "2026-10-14T01:00:00.000Z",
            ends_at: "2026-10-14T02:00:00.000Z",
            checkin_opens_at: null,
            checkin_closes_at: null,
          },
        ],
        published
      )
    ).toEqual([]);
  });

  it("finds candidates colliding with each other, reporting each pair once", () => {
    const conflicts = findWindowConflicts(
      [
        {
          title: "Monday Meeting",
          starts_at: "2026-10-05T23:00:00.000Z",
          ends_at: "2026-10-06T00:00:00.000Z",
          checkin_opens_at: null,
          // A 26-hour window, which reaches into Tuesday's meeting.
          checkin_closes_at: "2026-10-07T01:00:00.000Z",
        },
        {
          title: "Tuesday Meeting",
          starts_at: "2026-10-06T23:00:00.000Z",
          ends_at: "2026-10-07T00:00:00.000Z",
          checkin_opens_at: null,
          checkin_closes_at: null,
        },
      ],
      []
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      withEventId: null,
      withTitle: "Tuesday Meeting",
    });
  });
});

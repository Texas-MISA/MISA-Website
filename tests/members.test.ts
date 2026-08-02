import { describe, expect, it } from "vitest";

import {
  classifyTermEvents,
  formatAttendanceRate,
  type TermEventInput,
} from "@/lib/members";

// Pure tests for the member detail page's core (§7 Stage 6 phase 3). No
// database and no clock: `now` is injected, so an event can be placed either
// side of it without mocking time.

const NOW = new Date("2026-03-15T18:00:00.000Z");

function event(id: string, endsAt: string): TermEventInput {
  return { id, ends_at: endsAt };
}

describe("classifyTermEvents", () => {
  it("distinguishes attended, missed, and upcoming", () => {
    const summary = classifyTermEvents(
      [
        event("went", "2026-03-01T02:00:00.000Z"),
        event("skipped", "2026-03-08T02:00:00.000Z"),
        event("later", "2026-04-01T02:00:00.000Z"),
      ],
      new Set(["went"]),
      NOW
    );

    expect(summary.events).toEqual([
      { eventId: "went", state: "attended" },
      { eventId: "skipped", state: "missed" },
      { eventId: "later", state: "upcoming" },
    ]);
    expect(summary).toMatchObject({ attended: 1, missed: 1, upcoming: 1 });
  });

  it("never counts a future event as a miss", () => {
    // ⚠️ The whole reason this is three states rather than two.
    // member_directory.events_possible counts only events that have ended, so
    // painting a future event as missed would contradict the rate printed above
    // it and make every member look worse at the start of a term.
    const summary = classifyTermEvents(
      [
        event("a", "2026-05-01T02:00:00.000Z"),
        event("b", "2026-06-01T02:00:00.000Z"),
      ],
      new Set(),
      NOW
    );

    expect(summary.missed).toBe(0);
    expect(summary.upcoming).toBe(2);
    expect(summary.events.every((e) => e.state === "upcoming")).toBe(true);
  });

  it("treats an event ending exactly now as ended", () => {
    // The same half-open boundary the view uses on the other side of the
    // comparison (`ends_at < now()`), so the grid's attended+missed and the
    // view's events_possible cannot disagree by one at the boundary.
    const summary = classifyTermEvents(
      [event("edge", NOW.toISOString())],
      new Set(),
      NOW
    );
    expect(summary.missed).toBe(1);
    expect(summary.upcoming).toBe(0);
  });

  it("lets attendance outrank the clock", () => {
    // A member marked present at an event that has not ended is attended, not
    // upcoming — attendance is a fact, and the check-in window can legitimately
    // open before the event does.
    const summary = classifyTermEvents(
      [event("running", "2026-04-01T02:00:00.000Z")],
      new Set(["running"]),
      NOW
    );
    expect(summary.events[0].state).toBe("attended");
    expect(summary.attended).toBe(1);
    expect(summary.upcoming).toBe(0);
  });

  it("ignores attendance for events outside the term", () => {
    // The attended set is this member's whole history; the event list is one
    // term. A stale id in the set must not invent a row or a count.
    const summary = classifyTermEvents(
      [event("in-term", "2026-03-01T02:00:00.000Z")],
      new Set(["in-term", "last-term", "next-term"]),
      NOW
    );
    expect(summary.events).toHaveLength(1);
    expect(summary.attended).toBe(1);
  });

  it("handles an empty term without dividing by anything", () => {
    const summary = classifyTermEvents([], new Set(), NOW);
    expect(summary).toEqual({
      events: [],
      attended: 0,
      missed: 0,
      upcoming: 0,
    });
  });
});

describe("formatAttendanceRate", () => {
  it("renders no rate as an em dash, never as 0%", () => {
    // Null means the term has no completed events, which is not "attended
    // nothing" — and 0% would sort below a real 5% at the start of a semester.
    expect(formatAttendanceRate(null)).toBe("—");
  });

  it("renders a real zero as 0%", () => {
    expect(formatAttendanceRate(0)).toBe("0%");
  });

  it("turns the view's fraction into whole percent", () => {
    expect(formatAttendanceRate(0.5)).toBe("50%");
    expect(formatAttendanceRate(1)).toBe("100%");
    expect(formatAttendanceRate(0.6667)).toBe("67%");
  });
});

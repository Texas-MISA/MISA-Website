// Member domain core (§7 Stage 6). Pure — no next/* imports, no supabase-js —
// so Vitest exercises it directly, the same contract as lib/events.ts,
// lib/attendance.ts and lib/filters.ts. Anything with a decision in it belongs
// here rather than inside the page.
//
// Phase 3 puts one thing in here: how a term's events are classified against a
// member's attendance for the detail page's grid. Phase 4 adds the custom-field
// definitions, option validation, and AUDITED_MEMBER_COLUMNS.

/** The events grid's three states. */
export type TermEventState = "attended" | "missed" | "upcoming";

/** The subset of an event this classification needs. */
export type TermEventInput = {
  id: string;
  /** Raw PostgREST timestamptz string. */
  ends_at: string;
};

export type ClassifiedTermEvent = {
  eventId: string;
  state: TermEventState;
};

export type TermEventSummary = {
  events: ClassifiedTermEvent[];
  attended: number;
  missed: number;
  upcoming: number;
};

/**
 * Classify each of the term's events for one member.
 *
 * ⚠️ **Three states, not two.** An event that has not ended yet is `upcoming`,
 * never a miss. `member_directory.events_possible` counts only published events
 * with `ends_at < now()`, precisely so the denominator does not include events
 * nobody could have attended — and a grid that painted future events red would
 * contradict the rate printed above it and make every member look worse at the
 * start of a term.
 *
 * The boundary is the same half-open one the rest of the app uses: an event
 * whose `ends_at` is exactly `now` has ended, matching the view's `<` on the
 * other side of the comparison.
 *
 * `now` is injected rather than read, so a test can place an event on either
 * side of it without touching the clock.
 */
export function classifyTermEvents(
  events: readonly TermEventInput[],
  attendedEventIds: ReadonlySet<string>,
  now: Date
): TermEventSummary {
  const nowMs = now.getTime();
  const classified: ClassifiedTermEvent[] = events.map((event) => {
    if (attendedEventIds.has(event.id)) {
      return { eventId: event.id, state: "attended" };
    }
    // Attendance is a fact and outranks the clock: a member marked present at
    // an event that has somehow not ended is still attended, not upcoming.
    const ended = new Date(event.ends_at).getTime() <= nowMs;
    return { eventId: event.id, state: ended ? "missed" : "upcoming" };
  });

  return {
    events: classified,
    attended: classified.filter((e) => e.state === "attended").length,
    missed: classified.filter((e) => e.state === "missed").length,
    upcoming: classified.filter((e) => e.state === "upcoming").length,
  };
}

/** How a rate from `member_directory` is displayed.
 *
 * Null is not zero: a term with no completed events has no rate at all, and
 * rendering that as 0% would read as "attended nothing" and sort below a real
 * 5% (§4.5, migration 14). A member who genuinely attended nothing is a real 0
 * and must stay distinguishable from it. */
export function formatAttendanceRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

// Event domain core (§4.3, §4.6, §4.7).
//
// No next/* imports and no server-only guard, so Vitest can call every export
// directly with injected values — same contract as lib/checkin.ts. Anything
// request-shaped belongs in app/actions/events.ts instead.

/**
 * Every wall clock in this system is Central, matching term_of()'s
 * America/Chicago anchor (§4.7). The server runs in UTC, so a timestamp
 * formatted or constructed without an explicit zone is a bug, not a detail.
 */
export const CENTRAL = "America/Chicago";

/** The vocabulary the admin UI offers. `events.category` stays free text in
 * the database (§4.1) — this is the app's list, not a constraint. */
export const EVENT_CATEGORIES = [
  "general_meeting",
  "workshop",
  "social",
  "flagship",
  "other",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const EVENT_STATUSES = ["draft", "published", "cancelled"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** A calendar date with no zone attached: "2026-09-01". */
export type CivilDate = string;
/** A wall-clock time with no zone attached: "18:00". */
export type CivilTime = string;

// ---------------------------------------------------------------------------
// Zone conversion
// ---------------------------------------------------------------------------

/**
 * How far `timeZone` is ahead of UTC at a given instant, in milliseconds.
 *
 * `hourCycle: "h23"` rather than `hour12: false`: the latter renders midnight
 * as hour 24 in some ICU builds, which silently shifts the result a whole day.
 */
export function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const field: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") field[part.type] = Number(part.value);
  }

  const asUtc = Date.UTC(
    field.year,
    field.month - 1,
    field.day,
    field.hour,
    field.minute,
    field.second
  );
  // Milliseconds are not in the formatted parts, so compare on whole seconds.
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The instant at which the Central wall clock reads `date` `time`.
 *
 * Two passes, because the offset to apply depends on the instant we are
 * trying to find. The first guess is usually right; the correction only
 * matters within an hour of a DST transition.
 *
 * Behaviour at the two odd wall times, neither of which an evening meeting can
 * reach but a Sunday-morning series would:
 *   - Ambiguous (1:30am on fall-back Sunday, which happens twice) resolves to
 *     the first, CDT, occurrence.
 *   - Nonexistent (2:30am on spring-forward Sunday, which never happens)
 *     resolves to 1:30am CST — one hour *before* the requested reading.
 *
 * That second case is a consequence of the rule, not a preference: applying
 * the post-transition offset is what makes every *real* wall time come out
 * right, including 3:30am CDT on the same morning. The alternative — taking
 * the first-pass candidate, which would map the gap forward to 3:30am — gets
 * 3:30am CDT and 6:00am CST wrong by an hour. Correct real times matter more
 * than a tidy answer for a time that does not exist.
 */
export function centralWallTimeToInstant(date: CivilDate, time: CivilTime): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset1 = zoneOffsetMs(new Date(guess), CENTRAL);
  const candidate = guess - offset1;
  const offset2 = zoneOffsetMs(new Date(candidate), CENTRAL);

  return new Date(offset1 === offset2 ? candidate : guess - offset2);
}

/** The Central calendar date, wall time, and weekday of an instant. */
export function toCentralFields(instant: string | Date): {
  date: CivilDate;
  time: CivilTime;
  weekday: number;
} {
  const at = typeof instant === "string" ? new Date(instant) : instant;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CENTRAL,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).formatToParts(at);

  const field: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") field[part.type] = part.value;
  }

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    date: `${field.year}-${field.month}-${field.day}`,
    time: `${field.hour}:${field.minute}`,
    weekday: weekdays.indexOf(field.weekday),
  };
}

/** Advance a civil date by whole days. UTC is used purely as a calendar
 * cursor — it has no DST, so a day is always exactly 86,400,000ms there. */
export function addCivilDays(date: CivilDate, days: number): CivilDate {
  const [year, month, day] = date.split("-").map(Number);
  const moved = new Date(Date.UTC(year, month - 1, day) + days * 86_400_000);
  return moved.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/** "Tue, Sep 1, 6:00 – 7:00 PM" — collapsed when both ends share a date. */
export function formatEventRange(startsAt: string, endsAt: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CENTRAL,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).formatRange(new Date(startsAt), new Date(endsAt));
}

/** "Sep 1, 6:03 PM" — for a single timestamp such as a check-in. */
export function formatInstant(at: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CENTRAL,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(at));
}

/** "Jan 28, 2026" — a date with no time, for things like a join date where the
 * clock time is noise and the year is not. formatInstant deliberately omits the
 * year, which is right for a check-in and wrong for a roster column. */
export function formatDay(at: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CENTRAL,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(at));
}

/** "general_meeting" -> "General meeting". */
export function formatCategory(category: string | null): string {
  if (!category) return "—";
  const spaced = category.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// ---------------------------------------------------------------------------
// Check-in windows (§4.3)
// ---------------------------------------------------------------------------

export type EventWindowRow = {
  starts_at: string;
  ends_at: string;
  checkin_opens_at: string | null;
  checkin_closes_at: string | null;
};

/**
 * The window actually used to resolve a check-in: the explicit columns when
 * set, otherwise the event's own start and end.
 *
 * This is the JS mirror of the `coalesce(...)` in both `open_event_at()` and
 * the `events_no_overlapping_checkin` exclusion constraint. All three must
 * agree; see windowsOverlap for the half-open half of that contract.
 */
export function effectiveWindow(row: EventWindowRow): {
  opens: Date;
  closes: Date;
} {
  return {
    opens: new Date(row.checkin_opens_at ?? row.starts_at),
    closes: new Date(row.checkin_closes_at ?? row.ends_at),
  };
}

/**
 * Do two check-in windows collide?
 *
 * **Half-open `[opens, closes)`** — the third of the three places CLAUDE.md
 * names as needing to agree (with the exclusion constraint and
 * `open_event_at()`). A workshop closing at 19:00 and a social opening at
 * 19:00 do NOT overlap; making this inclusive would either stop back-to-back
 * events from being published or let one instant match two events.
 */
export function windowsOverlap(
  a: { opens: Date; closes: Date },
  b: { opens: Date; closes: Date }
): boolean {
  return a.opens < b.closes && b.opens < a.closes;
}

/**
 * Turn "open 15 minutes early, close 15 minutes late" into the stored
 * columns.
 *
 * Zero offsets store NULL rather than a copy of starts_at/ends_at, so the
 * fallback stays live: later moving the event time carries its window along
 * instead of stranding it. This is also why no `checkin_offsets` column
 * exists — the offsets are always derivable (see windowOffsetsOf).
 */
export function deriveCheckinWindow(input: {
  startsAt: Date;
  endsAt: Date;
  openEarlyMinutes: number;
  closeLateMinutes: number;
}): { checkinOpensAt: string | null; checkinClosesAt: string | null } {
  return {
    checkinOpensAt:
      input.openEarlyMinutes > 0
        ? new Date(
            input.startsAt.getTime() - input.openEarlyMinutes * 60_000
          ).toISOString()
        : null,
    checkinClosesAt:
      input.closeLateMinutes > 0
        ? new Date(
            input.endsAt.getTime() + input.closeLateMinutes * 60_000
          ).toISOString()
        : null,
  };
}

/** The inverse of deriveCheckinWindow: recover the offsets from a stored row. */
export function windowOffsetsOf(row: EventWindowRow): {
  openEarlyMinutes: number;
  closeLateMinutes: number;
} {
  const startsAt = new Date(row.starts_at).getTime();
  const endsAt = new Date(row.ends_at).getTime();

  return {
    openEarlyMinutes: row.checkin_opens_at
      ? Math.round((startsAt - new Date(row.checkin_opens_at).getTime()) / 60_000)
      : 0,
    closeLateMinutes: row.checkin_closes_at
      ? Math.round((new Date(row.checkin_closes_at).getTime() - endsAt) / 60_000)
      : 0,
  };
}

// ---------------------------------------------------------------------------
// Recurring series
// ---------------------------------------------------------------------------

/** Above this, a typo'd until-date stops being a mistake and starts being an
 * outage. Twelve weeks is a semester; sixty is generous headroom. */
export const MAX_SERIES_EVENTS = 60;

export type EventDraft = {
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  checkin_opens_at: string | null;
  checkin_closes_at: string | null;
  points: number;
  category: string | null;
  status: EventStatus;
  series_id: string | null;
};

export type SeriesSpec = {
  firstDate: CivilDate;
  untilDate: CivilDate; // inclusive
  weekdays: number[]; // 0 = Sunday … 6 = Saturday, in Central
  startTime: CivilTime;
  durationMinutes: number;
  openEarlyMinutes: number;
  closeLateMinutes: number;
  title: string;
  description: string | null;
  location: string | null;
  points: number;
  category: string | null;
  /** Caller-generated so expandSeries stays pure and deterministic. */
  seriesId: string;
};

/**
 * "Every Tuesday 6–7pm until Dec 4" as a batch of draft rows sharing one
 * series_id.
 *
 * Iterates *Central civil dates* and attaches the wall time at the last
 * moment. Adding 7 × 24h to a UTC instant would be wrong: a Tuesday 6pm
 * series crossing the November DST change would silently become a 5pm series
 * for the rest of the semester.
 *
 * `ends_at` comes from a duration, not a wall-clock end time — "6–7pm" is one
 * hour of real time. It also means ends_at > starts_at always holds, so the
 * expansion can never violate the `valid_window` check.
 *
 * Everything is produced as a draft: the overlap exclusion constraint only
 * applies to published rows, so generating a series can never fail on it.
 * Publishing is where conflicts surface — see findWindowConflicts.
 */
export function expandSeries(spec: SeriesSpec): EventDraft[] {
  if (spec.weekdays.length === 0) return [];

  const wanted = new Set(spec.weekdays);
  const drafts: EventDraft[] = [];

  let date = spec.firstDate;
  while (date <= spec.untilDate && drafts.length < MAX_SERIES_EVENTS) {
    const [year, month, day] = date.split("-").map(Number);
    // getUTCDay on a UTC-midnight cursor is the civil weekday, with no zone
    // arithmetic to get wrong.
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

    if (wanted.has(weekday)) {
      const startsAt = centralWallTimeToInstant(date, spec.startTime);
      const endsAt = new Date(
        startsAt.getTime() + spec.durationMinutes * 60_000
      );
      const window = deriveCheckinWindow({
        startsAt,
        endsAt,
        openEarlyMinutes: spec.openEarlyMinutes,
        closeLateMinutes: spec.closeLateMinutes,
      });

      drafts.push({
        title: spec.title,
        description: spec.description,
        location: spec.location,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        checkin_opens_at: window.checkinOpensAt,
        checkin_closes_at: window.checkinClosesAt,
        points: spec.points,
        category: spec.category,
        status: "draft",
        series_id: spec.seriesId,
      });
    }

    date = addCivilDays(date, 1);
  }

  return drafts;
}

// ---------------------------------------------------------------------------
// Duplication
// ---------------------------------------------------------------------------

export type EventSourceRow = EventWindowRow & {
  title: string;
  description: string | null;
  location: string | null;
  points: number;
  category: string | null;
};

/**
 * Clone an event as a draft (§7 Stage 4 — the highest-leverage admin feature
 * for an org with a weekly general meeting).
 *
 * The default date is the source's Central civil date plus seven days, not
 * plus 7 × 24h, so the weekly meeting keeps its 6pm slot across November.
 * Always a draft, and never a member of the source's series.
 */
export function duplicateDraft(
  source: EventSourceRow,
  opts: { date?: CivilDate } = {}
): EventDraft {
  const sourceFields = toCentralFields(source.starts_at);
  const date = opts.date ?? addCivilDays(sourceFields.date, 7);

  const durationMinutes = Math.round(
    (new Date(source.ends_at).getTime() -
      new Date(source.starts_at).getTime()) /
      60_000
  );
  const offsets = windowOffsetsOf(source);

  const startsAt = centralWallTimeToInstant(date, sourceFields.time);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const window = deriveCheckinWindow({
    startsAt,
    endsAt,
    openEarlyMinutes: offsets.openEarlyMinutes,
    closeLateMinutes: offsets.closeLateMinutes,
  });

  return {
    title: source.title,
    description: source.description,
    location: source.location,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    checkin_opens_at: window.checkinOpensAt,
    checkin_closes_at: window.checkinClosesAt,
    points: source.points,
    category: source.category,
    status: "draft",
    series_id: null,
  };
}

// ---------------------------------------------------------------------------
// Overlap pre-flight
// ---------------------------------------------------------------------------

export type Conflict = {
  candidateStartsAt: string;
  /** null when the collision is between two candidates in the same batch. */
  withEventId: string | null;
  withTitle: string;
  withStartsAt: string;
};

/**
 * Which candidates would be rejected by `events_no_overlapping_checkin`.
 *
 * **This is a UX affordance, not the guarantee.** The exclusion constraint is
 * what actually prevents two published events being open at once; this exists
 * so an officer sees "week 6 collides with Fall Career Fair" instead of
 * SQLSTATE 23P01. Never remove the constraint on the strength of this check.
 *
 * Candidates are compared against already-published events *and against each
 * other* — selecting both Monday and Tuesday with a 26-hour window is a real
 * input that the database would reject.
 */
export function findWindowConflicts(
  candidates: (EventWindowRow & { title: string })[],
  published: (EventWindowRow & { id: string; title: string })[]
): Conflict[] {
  const conflicts: Conflict[] = [];

  candidates.forEach((candidate, index) => {
    const window = effectiveWindow(candidate);

    for (const existing of published) {
      if (windowsOverlap(window, effectiveWindow(existing))) {
        conflicts.push({
          candidateStartsAt: candidate.starts_at,
          withEventId: existing.id,
          withTitle: existing.title,
          withStartsAt: existing.starts_at,
        });
      }
    }

    // Only look forward, so a colliding pair is reported once rather than twice.
    for (let other = index + 1; other < candidates.length; other++) {
      if (windowsOverlap(window, effectiveWindow(candidates[other]))) {
        conflicts.push({
          candidateStartsAt: candidate.starts_at,
          withEventId: null,
          withTitle: candidates[other].title,
          withStartsAt: candidates[other].starts_at,
        });
      }
    }
  });

  return conflicts;
}

// ---------------------------------------------------------------------------
// Edit impact (§4.6)
// ---------------------------------------------------------------------------

/**
 * How many recorded check-ins fall outside a window.
 *
 * Half-open, matching effectiveWindow's contract: a submission exactly at
 * `opens` is inside, one exactly at `closes` is outside.
 */
export function countOutsideWindow(
  rows: { submitted_at: string }[],
  window: { opens: Date; closes: Date }
): number {
  return rows.filter((row) => {
    const at = new Date(row.submitted_at);
    return at < window.opens || at >= window.closes;
  }).length;
}

export type EventWarning =
  | {
      kind: "points_changed";
      from: number;
      to: number;
      membersAffected: number;
      totalPointDelta: number;
    }
  | { kind: "window_narrowed"; checkinsNowOutside: number }
  | {
      kind: "times_moved";
      fromStart: string;
      toStart: string;
      checkinsNowOutside: number;
    }
  | {
      kind: "term_changed";
      fromTerm: string;
      toTerm: string;
      membersAffected: number;
    };

export type PreviewInput = {
  current: {
    points: number;
    /**
     * Nullable only because `term` is a generated column and Postgres reports
     * generated columns as nullable, so the generated types do too. It cannot
     * actually be null: it derives from `starts_at`, which is NOT NULL (§4.7).
     * Accepting null here beats asserting it away at every call site.
     */
    term: string | null;
    starts_at: string;
    ends_at: string;
    checkin_opens_at: string | null;
    checkin_closes_at: string | null;
  };
  proposed: {
    points: number;
    starts_at: string;
    ends_at: string;
    checkin_opens_at: string | null;
    checkin_closes_at: string | null;
  };
  /** From the `term_of` RPC — never computed in JS (§4.7). */
  newTerm: string;
  /** The event's `present` attendance rows. */
  presentRows: { member_id: string | null; submitted_at: string }[];
};

/**
 * The §4.6 warnings an officer must see before saving an edit.
 *
 * Every one of these edits is *allowed*. None of them revoke anything:
 * recorded attendance is a fact, and the check-in window is consulted only at
 * resolution time. The point is that the officer knows what they are about to
 * change before they change it.
 */
export function previewEventEdit(input: PreviewInput): EventWarning[] {
  const warnings: EventWarning[] = [];

  // Distinct members, not row count. PostgREST cannot count(distinct), and
  // the unique index is on (event_id, normalized_student_id) rather than
  // member_id — so two rows can legitimately share one member.
  const members = new Set(
    input.presentRows
      .map((row) => row.member_id)
      .filter((id): id is string => id !== null)
  );
  const membersAffected = members.size;

  if (input.proposed.points !== input.current.points) {
    warnings.push({
      kind: "points_changed",
      from: input.current.points,
      to: input.proposed.points,
      membersAffected,
      totalPointDelta:
        (input.proposed.points - input.current.points) * membersAffected,
    });
  }

  const currentWindow = effectiveWindow(input.current);
  const proposedWindow = effectiveWindow(input.proposed);
  const nowOutside = countOutsideWindow(input.presentRows, proposedWindow);

  const narrowed =
    proposedWindow.opens > currentWindow.opens ||
    proposedWindow.closes < currentWindow.closes;
  const moved =
    input.proposed.starts_at !== input.current.starts_at ||
    input.proposed.ends_at !== input.current.ends_at;

  // Only when the window changed *on its own*. Moving an event forward also
  // moves its window forward, which trips the "narrowed" test — reporting both
  // would tell the officer their window is shrinking when it is really just
  // following the event. times_moved already carries the same count.
  if (narrowed && !moved) {
    warnings.push({ kind: "window_narrowed", checkinsNowOutside: nowOutside });
  }
  if (moved) {
    warnings.push({
      kind: "times_moved",
      fromStart: input.current.starts_at,
      toStart: input.proposed.starts_at,
      checkinsNowOutside: nowOutside,
    });
  }

  // `term` is generated from starts_at, so this happens silently unless the
  // officer is told: rescheduling a July meeting into August moves every
  // attendee's points to the other semester's leaderboard (§4.7).
  if (input.current.term !== null && input.newTerm !== input.current.term) {
    warnings.push({
      kind: "term_changed",
      fromTerm: input.current.term,
      toTerm: input.newTerm,
      membersAffected,
    });
  }

  return warnings;
}

/**
 * Binds a confirmed edit to the exact preview the officer was shown.
 *
 * Two things are folded in, and both are load-bearing:
 *
 *   1. The **proposed values**, so an officer who tweaks a field after seeing
 *      the warnings gets a fresh preview instead of confirming numbers that no
 *      longer apply.
 *   2. The row's **`updated_at`**, which makes this optimistic concurrency:
 *      if another officer edited the event in between, the token stops
 *      matching and the warnings are recomputed against the new reality. The
 *      same `updated_at` also backs the write itself as a compare-and-set.
 *
 * ⚠️ `updated_at` must be carried as the **raw PostgREST string**. It has
 * microsecond precision; parsing it through a JS Date truncates to
 * milliseconds, and then the compare-and-set never matches and every save
 * reports a phantom conflict.
 *
 * This is deliberately the canonical serialization rather than a hash: it is
 * not a security boundary (authorization is enforced separately, and the
 * contents are values the officer just typed), so there is no secret to keep
 * and nothing to sign. Comparing the exact string also removes any chance of
 * a collision letting a stale confirmation through. Don't "harden" this into
 * a keyed digest — that only adds a secret that must stay stable across
 * deploys.
 */
export function impactToken(
  eventId: string,
  updatedAt: string,
  proposed: Record<string, unknown>
): string {
  const canonical = Object.keys(proposed)
    .sort()
    .map((key) => `${key}=${String(proposed[key] ?? "")}`)
    .join("&");
  return `${eventId}|${updatedAt}|${canonical}`;
}


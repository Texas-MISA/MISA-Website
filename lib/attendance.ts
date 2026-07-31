import { normalizeStudentId } from "@/lib/checkin";
import { effectiveWindow, type EventWindowRow } from "@/lib/events";

// Attendance-resolution core (§4.2, §4.3, §7 Stage 5). Like lib/events.ts and
// lib/checkin.ts this file has no next/* imports and no server-only guard, so
// Vitest calls every export directly with injected values. Anything
// request-shaped belongs in app/actions/attendance-review.ts instead.
//
// The rule this whole module serves: suggestions are ranked and described, and
// an officer applies them. Nothing here decides anything. A submission five
// minutes past the window is probably legitimate, but auto-approving it just
// moves the boundary (§7 design note).

/** The DB columns are plain `text` with CHECK constraints, and the generated
 * types surface them as bare `string`, so the unions live here. */
export const ATTENDANCE_STATUSES = ["pending", "present", "rejected"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_SOURCES = ["self_checkin", "admin_manual"] as const;
export type AttendanceSource = (typeof ATTENDANCE_SOURCES)[number];

/**
 * Above this many active members the detail page stops scanning the roster and
 * falls back to bounded ILIKE probes.
 *
 * Scanning is deliberate below it: the canonical near-miss is `Jon` vs `John`,
 * and `ilike '%jon%'` cannot match `John` — a probe-based candidate set
 * structurally excludes the row the officer is looking for. At 400 rows the
 * payload is tens of kilobytes on an officer-only page, and the ranking stays
 * unit-testable. If the roster outgrows this, pg_trgm is the growth path.
 */
export const MEMBER_SCAN_LIMIT = 400;
export const MAX_SUGGESTED_MEMBERS = 5;
/** Below this, a candidate is noise. An empty list is a valid answer. */
export const MIN_SUGGESTION_SCORE = 25;
export const MAX_BULK_ASSIGN = 200;

// --- Postgres interval parsing ---------------------------------------------

/**
 * Seconds from a Postgres interval as PostgREST serializes it.
 *
 * nearby_events().gap is a difference of two timestamptz values, so it can
 * only ever carry days and a time — never months or years, which is what makes
 * a fixed-shape parser safe here:
 *
 *   "00:41:00"  "1 day 02:03:04"  "2 days 00:00:00"  "00:00:00.5"
 *
 * Returns null rather than throwing or guessing on anything unrecognized; the
 * caller degrades to the raw event timestamps.
 */
export function parseInterval(raw: string): number | null {
  const text = raw.trim();
  if (text === "") return null;

  const match = text.match(
    /^(?:(-?\d+)\s+days?)?\s*(?:(-?)(\d+):(\d{2}):(\d{2}(?:\.\d+)?))?$/
  );
  if (!match) return null;

  const [, daysRaw, timeSign, hoursRaw, minutesRaw, secondsRaw] = match;
  if (daysRaw === undefined && hoursRaw === undefined) return null;

  const days = daysRaw === undefined ? 0 : Number(daysRaw);
  let time = 0;
  if (hoursRaw !== undefined) {
    time =
      Number(hoursRaw) * 3600 + Number(minutesRaw) * 60 + Number(secondsRaw);
    // Postgres signs each field independently: "-1 day -02:03:04".
    if (timeSign === "-") time = -time;
  }
  return days * 86_400 + time;
}

/** "41 minutes", "1 hour 30 minutes", "2 days 3 hours". Never "0 minutes". */
export function formatDuration(seconds: number): string {
  const total = Math.round(Math.abs(seconds));
  if (total < 60) return "less than a minute";

  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (days > 0) return join(unit(days, "day"), hours > 0 && unit(hours, "hour"));
  if (hours > 0) {
    return join(unit(hours, "hour"), minutes > 0 && unit(minutes, "minute"));
  }
  return unit(minutes, "minute");
}

function unit(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}

function join(first: string, second: string | false): string {
  return second ? `${first} ${second}` : first;
}

// --- gap description --------------------------------------------------------

export type GapDirection = "before" | "after" | "during";

/** Where an instant sits relative to a half-open `[from, to)` span. */
function directionOf(instant: number, from: number, to: number): GapDirection {
  if (instant < from) return "before";
  if (instant >= to) return "after";
  return "during";
}

export type GapDescription = {
  /** Relative to the check-in window — the thing that actually rejected it. */
  direction: GapDirection;
  /** Seconds outside the check-in window; 0 while inside it. */
  secondsOutsideWindow: number;
  /** "check-in closed 26 minutes before this submission" */
  headline: string;
  /** "event ended 41 minutes before" — the basis nearby_events ranked on. */
  eventRelative: string;
};

/**
 * Describe why a submission did or didn't land on an event.
 *
 * Two different numbers are in play and conflating them misleads the officer.
 * nearby_events() measures `gap` against starts_at/ends_at (§4.3), which is
 * what the ranking is built on — but the window is what accepts or refuses a
 * check-in, and an event with a 15-minute late close refuses a submission that
 * is 41 minutes past its end only 26 minutes past its window. The headline
 * therefore leads with the window number and keeps the event number beside it.
 *
 * `gap` is only used for the event-relative sentence, and only when it parses;
 * everything else is computed from the timestamps, so a serialization surprise
 * degrades one clause rather than the whole page.
 */
export function describeGap(input: {
  gap: string | null;
  submittedAt: string;
  event: EventWindowRow;
}): GapDescription {
  const at = Date.parse(input.submittedAt);
  const { opens, closes } = effectiveWindow(input.event);
  const starts = Date.parse(input.event.starts_at);
  const ends = Date.parse(input.event.ends_at);

  const direction = directionOf(at, opens.getTime(), closes.getTime());
  const secondsOutsideWindow =
    direction === "before"
      ? (opens.getTime() - at) / 1000
      : direction === "after"
        ? (at - closes.getTime()) / 1000
        : 0;

  const headline =
    direction === "during"
      ? "check-in was open when this was submitted"
      : direction === "after"
        ? `check-in closed ${formatDuration(secondsOutsideWindow)} before this submission`
        : `check-in opens ${formatDuration(secondsOutsideWindow)} after this submission`;

  const parsed = input.gap === null ? null : parseInterval(input.gap);
  const eventDirection = directionOf(at, starts, ends);
  const eventSeconds =
    parsed !== null
      ? Math.abs(parsed)
      : eventDirection === "before"
        ? (starts - at) / 1000
        : eventDirection === "after"
          ? (at - ends) / 1000
          : 0;

  const eventRelative =
    eventDirection === "during"
      ? "event was running"
      : eventDirection === "after"
        ? `event ended ${formatDuration(eventSeconds)} before`
        : `event starts ${formatDuration(eventSeconds)} after`;

  return { direction, secondsOutsideWindow, headline, eventRelative };
}

// --- member matching --------------------------------------------------------

export type MemberCandidate = {
  id: string;
  fullName: string;
  email: string;
  studentId: string;
  normalizedStudentId: string;
  active: boolean;
};

export type SubmissionIdentity = {
  fullName: string;
  email: string;
  studentId: string;
  normalizedStudentId: string;
};

export type MatchReason =
  | { kind: "email_exact" }
  | { kind: "email_local" }
  | { kind: "id_exact" }
  | { kind: "id_near_miss"; distance: number }
  | { kind: "id_contains" }
  | { kind: "name_exact" }
  | { kind: "name_tokens"; shared: string[] }
  | { kind: "name_near"; distance: number }
  | { kind: "inactive" };

export type MemberSuggestion = {
  member: MemberCandidate;
  score: number;
  reasons: MatchReason[];
};

/** Lowercased, punctuation-stripped name tokens. Single characters are dropped
 * so a middle initial doesn't match every other member who has one. */
export function nameTokens(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function emailLocal(raw: string): string {
  return raw.toLowerCase().split("@")[0] ?? "";
}

/**
 * Damerau-Levenshtein distance, bounded.
 *
 * Transposition counts as one edit rather than two, which matters because the
 * commonest student-ID typo is a swapped pair. Returns `cap` as soon as the
 * true distance is known to exceed it, so scoring a 400-row roster stays cheap.
 */
export function editDistance(a: string, b: string, cap = 4): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap;

  let prev2: number[] = [];
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  let row: number[] = [];

  for (let i = 1; i <= a.length; i++) {
    row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1] &&
        prev2[j - 2] + cost < value
      ) {
        value = prev2[j - 2] + cost;
      }
      row[j] = value;
      if (value < best) best = value;
    }
    // Every remaining row can only grow this minimum, so we can stop.
    if (best >= cap) return cap;
    prev2 = prev;
    prev = row;
  }
  return Math.min(prev[b.length], cap);
}

/**
 * Score one roster candidate against one submission.
 *
 * The weights encode §4.2's resolution order — email and student ID are the
 * decisive keys, names are corroboration — and every contribution is recorded
 * as a reason so the UI can explain the ranking rather than assert it.
 */
export function scoreMemberMatch(
  submission: SubmissionIdentity,
  candidate: MemberCandidate
): { score: number; reasons: MatchReason[] } {
  const reasons: MatchReason[] = [];
  let score = 0;

  const subEmail = submission.email.trim().toLowerCase();
  const candEmail = candidate.email.trim().toLowerCase();
  if (subEmail !== "" && subEmail === candEmail) {
    score += 100;
    reasons.push({ kind: "email_exact" });
  } else if (subEmail !== "" && emailLocal(subEmail) === emailLocal(candEmail)) {
    score += 60;
    reasons.push({ kind: "email_local" });
  }

  const subId = submission.normalizedStudentId;
  const candId = candidate.normalizedStudentId;
  if (subId !== "" && subId === candId) {
    score += 100;
    reasons.push({ kind: "id_exact" });
  } else if (subId !== "" && candId !== "") {
    const distance = editDistance(subId, candId, 3);
    if (distance === 1) {
      score += 45;
      reasons.push({ kind: "id_near_miss", distance });
    } else if (distance === 2) {
      score += 25;
      reasons.push({ kind: "id_near_miss", distance });
    }
    // A missing "UT" prefix is a containment, not an edit-distance, match.
    if (subId.includes(candId) || candId.includes(subId)) {
      score += 35;
      reasons.push({ kind: "id_contains" });
    }
  }

  const subTokens = nameTokens(submission.fullName);
  const candTokens = nameTokens(candidate.fullName);
  const subName = subTokens.join(" ");
  const candName = candTokens.join(" ");

  if (subName !== "" && subName === candName) {
    score += 50;
    reasons.push({ kind: "name_exact" });
  } else if (subName !== "" && candName !== "") {
    const shared = subTokens.filter((token) => candTokens.includes(token));
    if (shared.length > 0) {
      score += 15 * shared.length;
      reasons.push({ kind: "name_tokens", shared });
    }
    // Surnames carry more signal than given names.
    const subLast = subTokens[subTokens.length - 1];
    const candLast = candTokens[candTokens.length - 1];
    if (subLast && subLast === candLast) score += 20;

    // The Jon/John case: no shared token, but one edit apart.
    const distance = editDistance(subName, candName, 3);
    if (distance <= 2) {
      score += 30;
      reasons.push({ kind: "name_near", distance });
    }
  }

  if (score > 0 && !candidate.active) {
    score -= 20;
    reasons.push({ kind: "inactive" });
  }

  return { score, reasons };
}

/**
 * Rank roster candidates for one submission.
 *
 * Returns an empty list when nothing clears MIN_SUGGESTION_SCORE. That is the
 * point: a weak guess presented as a suggestion is worse than no suggestion,
 * because the officer's job is to be right, not fast.
 */
export function rankMemberSuggestions(
  submission: SubmissionIdentity,
  candidates: MemberCandidate[],
  limit = MAX_SUGGESTED_MEMBERS
): MemberSuggestion[] {
  return candidates
    .map((member) => ({ member, ...scoreMemberMatch(submission, member) }))
    .filter((entry) => entry.score >= MIN_SUGGESTION_SCORE)
    .sort(
      (a, b) =>
        b.score - a.score || a.member.fullName.localeCompare(b.member.fullName)
    )
    .slice(0, limit);
}

/**
 * Where two student IDs first diverge, so the UI can highlight the character
 * instead of leaving the officer to compare them by eye — the "near-miss ID
 * shown for comparison" the review screen calls for.
 *
 * Compared on the **normalized** forms, for the same reason everything else in
 * §4.2 is: `ut 100998` and `UT100028` differ at index 0 as raw strings — the
 * case of the `u` — and highlighting that tells the officer nothing. The index
 * returned is mapped back onto the raw `member` string, because the raw string
 * is what's on screen.
 *
 * `firstDifferenceAt` is null when the two ids are the same person's (any
 * formatting), and also when `member` is the shorter of the two and has no
 * character at the divergence point. Both mean "nothing to highlight".
 */
export function diffStudentId(
  submitted: string,
  member: string
): { submitted: string; member: string; firstDifferenceAt: number | null } {
  const submittedNormalized = normalizeStudentId(submitted);
  const memberNormalized = normalizeStudentId(member);
  if (submittedNormalized === memberNormalized) {
    return { submitted, member, firstDifferenceAt: null };
  }

  const shortest = Math.min(
    submittedNormalized.length,
    memberNormalized.length
  );
  let index = 0;
  while (
    index < shortest &&
    submittedNormalized[index] === memberNormalized[index]
  ) {
    index++;
  }
  return { submitted, member, firstDifferenceAt: rawIndexOf(member, index) };
}

/**
 * Translate an index into `normalizeStudentId(raw)` back into an index into
 * `raw`. Normalization only ever uppercases and deletes, never reorders or
 * inserts, so the normalized string is a subsequence of the raw one and the
 * mapping is a single walk skipping the dropped characters.
 */
function rawIndexOf(raw: string, normalizedIndex: number): number | null {
  let kept = 0;
  for (let i = 0; i < raw.length; i++) {
    // The characters normalizeStudentId strips.
    if (/[\s-]/.test(raw[i])) continue;
    if (kept === normalizedIndex) return i;
    kept++;
  }
  return null;
}

// --- resolution warnings ----------------------------------------------------

export type ResolutionWarning =
  | { kind: "event_cancelled" }
  | { kind: "event_draft" }
  | { kind: "outside_window"; secondsOutside: number; side: "before" | "after" }
  | { kind: "member_inactive" };

/**
 * What an officer should know before approving — the §4.6 edit-impact idea
 * applied to resolution. None of these block the approval; a submission
 * outside the window is the normal case for the whole queue, and the officer
 * is the one deciding it happened.
 *
 * Two of these are surprising enough that leaving them silent would be a bug:
 *
 *   - `event_draft`: the leaderboard view excludes only `cancelled`, so
 *     attendance on an unpublished event still moves public standings.
 *   - `member_inactive`: the leaderboard filters on `members.active`, so
 *     approving for an inactive member changes the officer directory and
 *     produces no public change at all.
 *
 * There is deliberately no term warning. Attendance points come from
 * events.term, so the submission's own date is irrelevant — and deriving a
 * term in JavaScript would break the never-type-a-term rule (§4.7).
 */
export function previewResolution(input: {
  event: (EventWindowRow & { status: string }) | null;
  memberActive: boolean | null;
  submittedAt: string;
}): ResolutionWarning[] {
  const warnings: ResolutionWarning[] = [];

  if (input.event) {
    if (input.event.status === "cancelled") {
      warnings.push({ kind: "event_cancelled" });
    } else if (input.event.status === "draft") {
      warnings.push({ kind: "event_draft" });
    }

    const at = Date.parse(input.submittedAt);
    const { opens, closes } = effectiveWindow(input.event);
    if (at < opens.getTime()) {
      warnings.push({
        kind: "outside_window",
        secondsOutside: (opens.getTime() - at) / 1000,
        side: "before",
      });
    } else if (at >= closes.getTime()) {
      warnings.push({
        kind: "outside_window",
        secondsOutside: (at - closes.getTime()) / 1000,
        side: "after",
      });
    }
  }

  if (input.memberActive === false) warnings.push({ kind: "member_inactive" });

  return warnings;
}

/**
 * JS mirror of the present_requires_resolution constraint, so the UI can
 * disable approve with an explanation instead of letting the officer click
 * into a 23514. The constraint remains the actual guarantee (§4.1).
 */
export function canApprove(row: {
  event_id: string | null;
  member_id: string | null;
}): boolean {
  return row.event_id !== null && row.member_id !== null;
}

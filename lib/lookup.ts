import type { SupabaseClient } from "@supabase/supabase-js";

import { escapeIlike, normalizeEid } from "@/lib/checkin";
import { paidThroughTerm } from "@/lib/dues";
import { formatCategory, formatDay, formatInstant } from "@/lib/events";
import {
  classifyTermEvents,
  formatAttendanceRate,
  type TermEventState,
} from "@/lib/members";
import { formatPointCategory, signedPoints } from "@/lib/points";

import type { Database } from "@/lib/types/database";

// The member self-service core (§7 Stage 7 phase 2). Same contract as
// lib/checkin.ts and lib/attendance.ts: the client and the clock are injected,
// nothing imports next/*, and every decision lives here rather than in the
// action — a "use server" export cannot be called from a test without a
// request context.
//
// Reads only. The single write anywhere on this path is the throttle row, and
// that belongs to checkRateLimit.

type Client = SupabaseClient<Database>;

/**
 * Per-IP ceiling for lookups, in lookups per RATE_LIMIT_WINDOW_MINUTES.
 *
 * 🔓 Its own number against its own bucket (see `hashClientIp`), not a share of
 * RATE_LIMIT_MAX. Two reasons, and the second is the one that matters:
 *
 *  - A lookup is a read of a member's own record, so it does not need the
 *    check-in ceiling's headroom for a room full of first-timers.
 *  - RATE_LIMIT_MAX is a **room capacity**. Sharing a budget would mean people
 *    checking their standing at a meeting could exhaust the slots the people
 *    behind them need to check in with, and the check-in is the one that must
 *    not fail.
 *
 * ⚠️ It is still a room number, not a security tuning knob. A venue's NAT puts
 * everyone on one address, so size it against the largest room the org books —
 * do not talk it down on abuse grounds. The gate itself (EID **and** matching
 * email) is what makes guessing expensive; this only stops scripted floods.
 */
export const LOOKUP_RATE_LIMIT_MAX = 30;

export type LookupInput = {
  eid: string;
  email: string;
};

/**
 * Explicit tri-state, mirroring `MemberLookup` in lib/checkin.ts and for the
 * same reason: a bare `id | null` invites `if (!id)`, and one such slip would
 * report a transient database fault as "we don't recognise those details" —
 * telling a member who *is* on the roster that they are not.
 */
type MemberMatch =
  | { kind: "found"; id: string }
  | { kind: "missing" }
  | { kind: "error" };

/** One event in the member's term grid, already formatted for display. */
export type LookupEvent = {
  id: string;
  title: string;
  when: string;
  category: string;
  points: number;
  state: TermEventState;
};

/** A submission that has been received but not yet reviewed. */
export type LookupPending = {
  id: string;
  submitted: string;
  /** Null when the check-in matched no event and an officer must file it. */
  eventTitle: string | null;
};

export type LookupAdjustment = {
  id: string;
  awarded: string;
  points: string;
  category: string;
  reason: string;
};

/**
 * Everything /lookup shows, already rendered to strings.
 *
 * 🔓 It carries the member's NAME and their own aggregates, and deliberately
 * **no identifier the caller did not already supply** — not the stored email,
 * not the stored EID. §6's rule is "emails and EIDs never returned to
 * unauthenticated clients under any route", and echoing back the two values
 * that were just typed in would keep that true only by argument. Keeping them
 * out keeps it true by construction.
 *
 * ⚠️ Every date is a formatted STRING, not a Date or a raw timestamp. This
 * object crosses into a Client Component as action state, and
 * `Intl.DateTimeFormat` running on both sides of hydration is the invariant
 * that bites here — Node and Chrome ship different ICU data for the space
 * before "PM", and the resulting React diff shows two strings that look
 * character-for-character identical.
 */
export type LookupProfile = {
  fullName: string;
  term: string | null;
  totalPoints: number;
  attendancePoints: number;
  bonusPoints: number;
  eventsAttended: number;
  eventsPossible: number;
  attendanceRate: string;
  /** True when the term has no completed events, so the rate is "—" not 0%. */
  rateUnavailable: boolean;
  events: LookupEvent[];
  attended: number;
  missed: number;
  upcoming: number;
  pending: LookupPending[];
  adjustments: LookupAdjustment[];
  duesPaidCurrentTerm: boolean;
  paidThrough: string | null;
};

export type LookupResult =
  | { status: "found"; profile: LookupProfile }
  // 🔓 ONE outcome for every miss. Never split into "no such EID" and "that
  // email does not match": §6 accepts that check-in makes roster membership
  // probeable with an EID alone, and the whole justification for /lookup
  // showing dues status is that its gate is strictly narrower than that. Two
  // distinguishable failures here would hand back a *stronger* oracle than
  // /attend's — you could confirm an EID, then walk the email — while claiming
  // the opposite.
  | { status: "unmatched" }
  | { status: "error" };

const DIRECTORY_COLUMNS =
  "id, full_name, events_attended, attendance_points, bonus_points, total_points, pending_count, events_possible, attendance_rate, dues_paid_current_term" as const;

const TERM_EVENT_COLUMNS = "id, title, starts_at, ends_at, points, category" as const;

const ATTENDANCE_COLUMNS = "id, event_id, status, submitted_at" as const;

const ADJUSTMENT_COLUMNS =
  "id, points, reason, category, awarded_at, voided_at" as const;

const DUES_COLUMNS = "covered_terms, voided_at" as const;

/**
 * Resolve the EID + email pair to exactly one member.
 *
 * 🔓 **ONE query carrying BOTH predicates, and that is the security control.**
 *
 * `findMember` in lib/checkin.ts is an ordered *fallback* — normalized_eid,
 * then lower(email) — because a check-in must recognise someone who fat-fingers
 * one of the two. That is right there and catastrophic here: reproducing the
 * shape would mean an EID alone opens the page, and the EID-alone gate is
 * exactly the one §6 says is **not** sufficient to reveal dues status. The
 * double gate is the entire reason this route is allowed to show it.
 *
 * So: never two lookups, never an `.or()`. Both predicates, one row, or nothing.
 *
 * The email comparison is `.ilike(escapeIlike(...))`, which is a
 * case-insensitive *equality* test matching the `lower(email)` unique index's
 * semantics — the escape is what stops a `%` in the input turning it into a
 * pattern match, which would be a wildcard past half the gate.
 */
async function findMemberByBoth(
  db: Client,
  input: LookupInput
): Promise<MemberMatch> {
  const { data, error } = await db
    .from("members")
    .select("id")
    .eq("normalized_eid", normalizeEid(input.eid))
    .ilike("email", escapeIlike(input.email))
    .maybeSingle();

  if (error) {
    console.error("lookup member query failed:", error.message);
    return { kind: "error" };
  }
  return data ? { kind: "found", id: data.id } : { kind: "missing" };
}

/**
 * Assemble one member's own view of the term.
 *
 * Reads with the service-role client, because anon can reach none of this —
 * `member_directory` is revoked from anon (migration 15) and every base table
 * is deny-all. The gate above is what stands in for authorization; there is no
 * session to check.
 */
async function buildProfile(
  db: Client,
  memberId: string,
  now: Date
): Promise<LookupProfile | null> {
  const [directory, currentTerm, attendance, adjustments, payments] =
    await Promise.all([
      db
        .from("member_directory")
        .select(DIRECTORY_COLUMNS)
        .eq("id", memberId)
        .maybeSingle(),
      // Never type a term string (§4.7). Since migration 21 this honours an
      // officer's pin for every role, not only the service one.
      db.rpc("current_term"),
      db.from("attendance").select(ATTENDANCE_COLUMNS).eq("member_id", memberId),
      db
        .from("point_adjustments")
        .select(ADJUSTMENT_COLUMNS)
        .eq("member_id", memberId)
        .order("awarded_at", { ascending: false }),
      // Voided rows come back too and are filtered by paidThroughTerm, which is
      // where that rule belongs. Ordered by paid_at rather than by term —
      // `order by term` is the lexicographic trap.
      db
        .from("dues_payments")
        .select(DUES_COLUMNS)
        .eq("member_id", memberId)
        .order("paid_at", { ascending: false }),
    ]);

  if (directory.error) {
    console.error("lookup directory query failed:", directory.error.message);
    return null;
  }
  const member = directory.data;
  // The member row exists (we just matched it) but the view does not have it.
  // member_directory has no `active` filter, so this is a genuine fault rather
  // than a deactivated member, and reporting it as "not found" would tell
  // someone on the roster that they are not on it.
  if (!member) return null;

  const term = currentTerm.error ? null : currentTerm.data;

  // Published only: a cancelled event credits nobody, and a draft is not
  // something a member could have been asked to attend.
  const termEvents = term
    ? await db
        .from("events")
        .select(TERM_EVENT_COLUMNS)
        .eq("term", term)
        .eq("status", "published")
        .order("starts_at", { ascending: true })
    : null;

  const attendanceRows = attendance.error ? [] : (attendance.data ?? []);
  const adjustmentRows = adjustments.error ? [] : (adjustments.data ?? []);
  const paymentRows = payments.error ? [] : (payments.data ?? []);
  const eventRows = termEvents?.error ? [] : (termEvents?.data ?? []);

  const attendedEventIds = new Set(
    attendanceRows
      .filter((row) => row.status === "present" && row.event_id)
      .map((row) => row.event_id as string)
  );
  const grid = classifyTermEvents(eventRows, attendedEventIds, now);
  const gridState = new Map<string, TermEventState>(
    grid.events.map((e) => [e.eventId, e.state])
  );

  const eventTitles = new Map(eventRows.map((e) => [e.id, e.title]));

  return {
    fullName: member.full_name ?? "",
    term,
    totalPoints: member.total_points ?? 0,
    attendancePoints: member.attendance_points ?? 0,
    bonusPoints: member.bonus_points ?? 0,
    eventsAttended: member.events_attended ?? 0,
    eventsPossible: member.events_possible ?? 0,
    // "—" when the term has no completed events, never 0% — a member who has
    // attended nothing is a real zero and the two must not render alike.
    attendanceRate: formatAttendanceRate(member.attendance_rate),
    rateUnavailable: member.attendance_rate === null,
    events: eventRows.map((event) => ({
      id: event.id,
      title: event.title,
      when: formatDay(event.starts_at),
      category: formatCategory(event.category),
      points: event.points,
      state: gridState.get(event.id) ?? "upcoming",
    })),
    attended: grid.attended,
    missed: grid.missed,
    upcoming: grid.upcoming,
    // ⚠️ Pending rows are NOT term-scoped, matching member_directory's
    // pending_count. "Is anything of mine still waiting?" is an all-time
    // question, and a submission from last term still needs an officer.
    pending: attendanceRows
      .filter((row) => row.status === "pending")
      .sort((a, b) => a.submitted_at.localeCompare(b.submitted_at))
      .map((row) => ({
        id: row.id,
        submitted: `${formatInstant(row.submitted_at)} CT`,
        // ⚠️ An orphan carries no event_id and must still be shown. It is the
        // exact case a member worries about — they checked in and nothing
        // happened — and silence here is what §4.2 exists to prevent.
        eventTitle: row.event_id ? (eventTitles.get(row.event_id) ?? null) : null,
      })),
    // Live adjustments only. A voided grant contributes nothing (§4.2), and
    // showing a member a struck-through line they cannot act on invites a
    // question an officer then has to answer — the opposite of this page's job.
    // The officer-facing ledger keeps the full record.
    //
    // 🔓 No `awarded_by`. The reason is the member's business; which officer
    // granted it is not, and an officer's uuid has no place in an
    // unauthenticated response.
    adjustments: adjustmentRows
      .filter((row) => row.voided_at === null)
      .map((row) => ({
        id: row.id,
        awarded: formatDay(row.awarded_at),
        points: signedPoints(row.points),
        category: formatPointCategory(row.category),
        reason: row.reason,
      })),
    duesPaidCurrentTerm: member.dues_paid_current_term ?? false,
    // 🪤 Through the term index, never max(term) or order by term.
    paidThrough: paidThroughTerm(
      paymentRows.map((row) => ({
        coveredTerms: row.covered_terms,
        voided: row.voided_at !== null,
      }))
    ),
  };
}

/**
 * The whole lookup: gate, then assemble.
 *
 * Writes nothing. `now` is injected so a test can place an event on either side
 * of it without touching the clock.
 */
export async function lookupMemberHistory(
  db: Client,
  input: LookupInput,
  now: Date
): Promise<LookupResult> {
  const match = await findMemberByBoth(db, input);
  // A transient fault is reported as an error, never as `unmatched` — the
  // discriminated tri-state exists precisely so this branch cannot collapse
  // into the miss.
  if (match.kind === "error") return { status: "error" };
  if (match.kind === "missing") return { status: "unmatched" };

  const profile = await buildProfile(db, match.id, now);
  if (!profile) return { status: "error" };
  return { status: "found", profile };
}

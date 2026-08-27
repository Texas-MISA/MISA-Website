import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeEid } from "@/lib/checkin";
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
 * do not talk it down on abuse grounds.
 *
 * 🔴 **This throttle now carries more weight than it was sized for.** It used to
 * be backed by a gate that was expensive to guess — EID *and* matching email.
 * The email half was removed on 2026-08-25 (officer's decision), so an EID
 * alone opens this page, and a UT EID is derived from a person's initials
 * rather than issued at random. The throttle is what is left between a script
 * and the roster. It is still a room number and still must not be talked down;
 * it is simply no longer a second line of defence behind a strong first one.
 */
export const LOOKUP_RATE_LIMIT_MAX = 30;

export type LookupInput = {
  eid: string;
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
  "id, full_name, term, events_attended, attendance_points, bonus_points, total_points, pending_count, events_possible, attendance_rate, dues_paid_term" as const;

const TERM_EVENT_COLUMNS = "id, title, starts_at, ends_at, points, category" as const;

const ATTENDANCE_COLUMNS = "id, event_id, status, submitted_at" as const;

const ADJUSTMENT_COLUMNS =
  "id, points, reason, category, awarded_at, voided_at" as const;

const DUES_COLUMNS = "covered_terms, voided_at" as const;

/**
 * Resolve the EID to exactly one member.
 *
 * 🔴 **THIS GATE WAS DELIBERATELY WEAKENED ON 2026-08-25, and the reversal is
 * recorded here rather than quietly applied.**
 *
 * It used to be one query carrying BOTH `normalized_eid` and `lower(email)`,
 * and that conjunction was described in §6 as the security control — the entire
 * reason this route was allowed to show dues status, since §6 holds that an EID
 * alone is *not* a sufficient gate for that. The officer asked for a one-field
 * lookup on 2026-08-25 and, told what it meant, chose to keep the page
 * unchanged. So:
 *
 *   * A UT EID is derived from a person's initials, not issued at random, which
 *     is the same property `lib/attendance.ts` relies on when it refuses to
 *     corroborate a near-miss at edit distance 2. Guessing one is cheap.
 *   * Anyone holding a guessed EID now sees that member's name, point total,
 *     attendance history and whether they have paid dues.
 *   * `LOOKUP_RATE_LIMIT_MAX` is the only remaining cost, and it is a room
 *     number rather than a security parameter.
 *
 * What did NOT change, and must not: still ONE query, still one `unmatched`
 * outcome for every miss. Splitting the failures would hand back an oracle on
 * top of an already-cheap gate.
 *
 * 📌 Still not `findMember` from lib/checkin.ts. That one is an ordered
 * *fallback* — EID, then email — so it can recognise somebody who fat-fingers
 * one of the two. Here there is one identifier and one predicate; borrowing the
 * fallback would silently let an email address open somebody else's page.
 */
async function findMemberByEid(
  db: Client,
  input: LookupInput
): Promise<MemberMatch> {
  const { data, error } = await db
    .from("members")
    .select("id")
    .eq("normalized_eid", normalizeEid(input.eid))
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
      // 🪤 Every term row, not `.maybeSingle()`: the view is one row per
      // (member, term) since migration 29, so a member in their second semester
      // would answer PGRST116 and the whole lookup would report an error to
      // somebody whose record is fine. The current term's row is picked below.
      db.from("member_directory").select(DIRECTORY_COLUMNS).eq("id", memberId),
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
  // The member row exists — we just matched it — so an EMPTY result is a
  // genuine fault rather than an absence, and reporting it as "not found" would
  // tell somebody on the roster that they are not on it. Every member has at
  // least one row (the term they joined in).
  if (directory.data.length === 0) return null;

  // ⚠️ A failed term read is NOT "no term". It skips the events query below
  // entirely, so the grid empties and the page claims the org has held no
  // events — see the block after the reads.
  if (currentTerm.error) {
    console.error("lookup current_term failed:", currentTerm.error.message);
    return null;
  }
  const term = currentTerm.data;

  // The current term's row, or zeros. ⚠️ A member with no row this term is a
  // NORMAL state, not an error: they joined an earlier semester and have not
  // attended, been granted points, or paid dues covering this one. Their own
  // page should say zero for this term, which is true — the alternative,
  // treating it as "not found", would tell somebody on the roster that they are
  // not on it, and that is the failure this whole module is shaped around.
  const scoped = directory.data.find((row) => row.term === term) ?? null;
  const member = scoped ?? {
    ...directory.data[0],
    term,
    events_attended: 0,
    attendance_points: 0,
    bonus_points: 0,
    total_points: 0,
    // Null, never 0: with no row for the term nothing here knows how many
    // events it held, and formatAttendanceRate renders null as "—".
    events_possible: null,
    attendance_rate: null,
    dues_paid_term: false,
  };

  // Published only: a cancelled event credits nobody, and a draft is not
  // something a member could have been asked to attend.
  const termEvents = await db
    .from("events")
    .select(TERM_EVENT_COLUMNS)
    .eq("term", term)
    .eq("status", "published")
    .order("starts_at", { ascending: true });

  // 🔓 Every one of these used to be `x.error ? [] : x.data`, and each turned a
  // read failure into an affirmative lie on a MEMBER'S OWN page (Stage 7 phase
  // 2's defect, found by Stage 8 phase 1's audit):
  //
  //   attendance  → the grid painted EVERY event missed, and the "Waiting on an
  //                 officer" section vanished — the section this page exists
  //                 for. Meanwhile the header stats come from member_directory,
  //                 a different query, so the page showed "75% attendance"
  //                 above a grid claiming nothing was attended.
  //   adjustments → the "Points granted separately" section disappeared while a
  //                 non-zero bonus figure stayed on screen, unexplained.
  //   payments    → "No payment of yours covers a term yet" — printable
  //                 directly beneath "You're an official member for Fall 2026",
  //                 because dues status also comes from the view.
  //   termEvents  → "No published events in Fall 2026 yet."
  //
  // 📌 Fail the WHOLE lookup rather than degrading section by section. These
  // five numbers interlock — total, attendance points, bonus, rate, dues — and
  // a member reads the screen as one answer, so a partial view invites exactly
  // the wrong conclusion. The action already carries a `status: "error"` state
  // whose copy says the honest thing: "This isn't a statement about your
  // records; we just couldn't read them."
  const reads = [
    ["attendance", attendance.error],
    ["adjustments", adjustments.error],
    ["payments", payments.error],
    ["term events", termEvents?.error],
  ] as const;
  for (const [label, failure] of reads) {
    if (failure) {
      console.error(`lookup ${label} read failed:`, failure.message);
      return null;
    }
  }

  const attendanceRows = attendance.data ?? [];
  const adjustmentRows = adjustments.data ?? [];
  const paymentRows = payments.data ?? [];
  const eventRows = termEvents?.data ?? [];

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
    duesPaidCurrentTerm: member.dues_paid_term ?? false,
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
  const match = await findMemberByEid(db, input);
  // A transient fault is reported as an error, never as `unmatched` — the
  // discriminated tri-state exists precisely so this branch cannot collapse
  // into the miss.
  if (match.kind === "error") return { status: "error" };
  if (match.kind === "missing") return { status: "unmatched" };

  const profile = await buildProfile(db, match.id, now);
  if (!profile) return { status: "error" };
  return { status: "found", profile };
}

import { createHash } from "node:crypto";

import {
  classifyNetwork,
  normalizeOrigin,
  type OriginRecord,
} from "@/lib/network-classify";

// Re-exported so callers have one import for the whole feature. The type lives
// in network-classify.ts for bundle-safety reasons documented there.
export type { OriginRecord };

// Check-in location verification: the digest, the venue mode, and the flag
// derivation (§6). Plan and threat model, including everything this cannot
// catch: docs/checkin-location-verification.md.
//
// ⚠️ Imports node:crypto, so like lib/officer-invites.ts this module must NEVER
// be reached from a Client Component. The pieces a browser could need live in
// lib/network-classify.ts, which is dependency-free on purpose.
//
// 📌 ADVISORY ONLY. Nothing here rejects a check-in, moves a row to pending,
// withholds points, or writes an admin_audit row. It produces a label for the
// officer's review screen and stops.

/**
 * The per-event secret that makes a stored digest irreversible.
 *
 * 🔓 A SERVER-ONLY ENVIRONMENT SECRET, NEVER A REPO LITERAL. IPv4 is 4.3
 * billion addresses, so an unpeppered SHA-256 of one is reversible on a laptop
 * in seconds — and this repository is public. lib/request-ip.ts gets away with
 * a known scope string because its hashes key a bucket that expires in ten
 * minutes and link to nobody; these sit next to a member's identity.
 *
 * 🪤 A MISSING PEPPER MUST NOT PRODUCE A DIGEST. Hashing with `undefined`
 * would give every deployment the same reversible function and would survive a
 * later rotation, so originDigest() returns null instead and the check-in
 * still succeeds — the fail-open doctrine checkRateLimit already follows.
 *
 * ⚠️ The officer-visible symptom of a missing pepper is that EVERY row reads
 * "origin unknown" and no event ever establishes a venue. That is the intended
 * failure: silent about people, obvious about itself.
 */
const PEPPER = process.env.CHECKIN_ORIGIN_PEPPER;

if (!PEPPER) {
  console.error(
    "CHECKIN_ORIGIN_PEPPER is not set — check-in origins will not be recorded. " +
      "Every review row will read 'origin unknown' until it is."
  );
}

/** Whether origins can be captured at all. Surfaced so a screen can say so. */
export const ORIGIN_CAPTURE_ENABLED = Boolean(PEPPER);

/**
 * How many check-ins a candidate origin needs before it counts as the venue,
 * and what share of the non-cellular ones it must hold.
 *
 * 📌 JUDGEMENT CALLS ABOUT A ROOM, NOT SECURITY TUNING — the same category as
 * RATE_LIMIT_MAX, and to be re-read rather than nudged. Below either threshold
 * an event has NO established origin and nothing is flagged, which is the same
 * direction as attendance_rate being null rather than zero: the mechanism
 * fails to "no signal", never to "everyone is suspect".
 *
 * Expect to move these after one real event. Raising MIN_SHARE makes the
 * feature quieter and more certain; lowering it flags more people on thinner
 * evidence, which is the direction that produces an accusation nobody can
 * defend.
 */
export const VENUE_MIN_COUNT = 5;
export const VENUE_MIN_SHARE = 0.5;

/**
 * Build the row to store for one check-in.
 *
 * 🔓 The raw address is a LOCAL HERE AND NOWHERE ELSE. It is classified, it is
 * hashed, and it is discarded — never stored, never logged, never returned.
 *
 * 🪤 An `unknown` kind is forced to a null digest even when the address parsed
 * fine, and this is not belt-and-braces. classifyNetwork returns `unknown` for
 * an IPv6 address today because UT announces no IPv6 and the campus table
 * cannot speak to it — the address is perfectly hashable, but storing a digest
 * beside an `unknown` kind would let the review screen fall through to
 * "off-network" and flag someone on the strength of a gap in a table. The
 * migration's checkin_origin_unknown_has_no_digest constraint enforces the
 * same rule one layer down.
 */
export function buildOriginRecord(
  eventId: string | null,
  ip: string | null | undefined
): OriginRecord {
  const networkType = classifyNetwork(ip);
  if (networkType === "unknown" || eventId === null) {
    return { originHash: null, networkType };
  }
  return { originHash: originDigest(eventId, ip), networkType };
}

/**
 * sha256( PEPPER || event_id || normalize(ip) ), or null if there is nothing
 * hashable.
 *
 * 🔓 event_id IS INSIDE THE HASH, and that is the property that makes this
 * table acceptable to keep at all: the same address at two events produces two
 * unrelated digests, so nothing here can trace where a member was over a
 * semester. Do not "optimise" it out to make digests joinable — being
 * unjoinable is the feature.
 */
export function originDigest(
  eventId: string,
  ip: string | null | undefined
): string | null {
  if (!PEPPER) return null;
  const normalized = normalizeOrigin(ip);
  if (normalized === null) return null;
  return createHash("sha256").update(`${PEPPER}:${eventId}:${normalized}`).digest("hex");
}

/**
 * Is a submission inside the event's check-in window? Half-open `[opens, closes)`,
 * per the invariant that the three window comparisons must agree.
 *
 * 🪤 **Here, and not inline in the page, because comparing these as STRINGS is
 * a trap that happens to work.** PostgREST renders `submitted_at` with
 * microseconds (`…23:12:32.506781+00:00`) and a whole-second `starts_at`
 * without any (`…23:00:00+00:00`), so a string compare is comparing two
 * different shapes — and it gets the right answer only because `.` (0x2E)
 * sorts after `+` (0x2B) in ASCII. Nothing declares that; it would break
 * silently the day a value came back with a non-UTC offset.
 *
 * 📌 `Date.parse` truncates to milliseconds, which is the right trade here.
 * The case this filter exists for is an orphan an officer approved onto the
 * event hours outside its window — the precision needed is hours, not
 * microseconds. A submission within 1ms of a boundary can be misplaced, and
 * the consequence is that it leaves the venue mode's denominator: less signal,
 * never a false flag.
 *
 * An unparseable value yields NaN, every comparison is false, and the row is
 * excluded — the same safe direction.
 */
export function withinCheckinWindow(
  submittedAt: string,
  opensAt: string,
  closesAt: string
): boolean {
  const at = Date.parse(submittedAt);
  return at >= Date.parse(opensAt) && at < Date.parse(closesAt);
}

/** The outcome of looking for an event's venue origin. */
export type VenueOrigin =
  | { status: "established"; originHash: string; count: number; considered: number }
  | { status: "no_quorum"; considered: number; topCount: number }
  | { status: "ambiguous"; considered: number; topCount: number };

/**
 * Find the event's venue origin, or decline to.
 *
 * Computed AT REVIEW TIME, never at check-in time: during an event the mode is
 * still forming, so an early arrival would be flagged for being early. The
 * officer opening the queue is the moment every relevant row exists.
 *
 * 🪤 Cellular rows are dropped from BOTH the groups and the denominator. Out of
 * the groups because a tethered hotspot must never become the venue; out of the
 * denominator because otherwise a heavily-cellular event dilutes its own share
 * below quorum and loses a venue it actually had.
 *
 * 🪤 A TIE IS NOT A WINNER. Two origins with the same top count both clear
 * VENUE_MIN_SHARE at 0.5, and picking either would make the answer depend on
 * iteration order rather than on the room. `ambiguous` is the honest result and
 * flags nobody.
 */
export function establishVenueOrigin(rows: readonly OriginRecord[]): VenueOrigin {
  const hashes = rows
    .filter((row) => row.networkType !== "cellular" && row.originHash !== null)
    .map((row) => row.originHash as string);

  const considered = hashes.length;
  const counts = new Map<string, number>();
  for (const hash of hashes) counts.set(hash, (counts.get(hash) ?? 0) + 1);

  let topCount = 0;
  let topHash: string | null = null;
  let topTies = 0;
  for (const [hash, count] of counts) {
    if (count > topCount) {
      topCount = count;
      topHash = hash;
      topTies = 1;
    } else if (count === topCount) {
      topTies += 1;
    }
  }

  if (topHash === null || topCount < VENUE_MIN_COUNT) {
    return { status: "no_quorum", considered, topCount };
  }
  if (topCount / considered < VENUE_MIN_SHARE) {
    return { status: "no_quorum", considered, topCount };
  }
  if (topTies > 1) {
    return { status: "ambiguous", considered, topCount };
  }
  return { status: "established", originHash: topHash, count: topCount, considered };
}

/**
 * What the officer sees against one check-in.
 *
 * `off`         — the event's verify_origin is false. Nobody looked.
 * `no_venue`    — the event never established an origin. Nothing to compare to.
 * `unknown`     — no origin recorded, or one that could not be classified.
 * `cellular`    — on a mobile carrier. NEVER flagged.
 * `at_venue`    — matches the event's origin.
 * `on_campus`   — university space, but not the event's origin.
 * `off_network` — neither. The strongest thing this mechanism can say.
 */
export type OriginFlag =
  | "off"
  | "not_applicable"
  | "no_venue"
  | "unknown"
  | "cellular"
  | "at_venue"
  | "on_campus"
  | "off_network";

export type OriginFlagInput = {
  record: OriginRecord | null | undefined;
  venue: VenueOrigin;
  /** The event's `verify_origin`. False means nobody looked. */
  verifyOrigin: boolean;
  /** `attendance.source === "self_checkin"`. */
  isSelfCheckin: boolean;
};

/**
 * Classify one check-in, in precedence order.
 *
 * 📌 An OPTIONS OBJECT rather than four positional arguments, two of which are
 * bare booleans. `deriveOriginFlag(row, venue, true, false)` is unreadable at
 * the call site and silently wrong if the two are transposed.
 *
 * 🪤 `not_applicable` comes BEFORE the missing-record check, and that ordering
 * is the whole reason it exists. An officer-entered row has no origin — by
 * design, since capture never runs for `admin_manual` — so without this it fell
 * through to `unknown` and rendered "Origin unknown" against every walk-in an
 * officer typed in. That badge claims the system tried to determine an origin
 * and could not, when in fact the concept does not apply to the row at all.
 *
 * ⚠️ Cellular OUTRANKS both flagged states unconditionally (officer's
 * decision, 2026-08-22). It removes the largest class of false positives —
 * real attendees whose phone had not joined the wifi — and it means a member
 * who tethers from their dorm is never flagged. That hole is accepted
 * knowingly, and it is the first thing to reopen if this ever gates anything.
 */
export function deriveOriginFlag({
  record,
  venue,
  verifyOrigin,
  isSelfCheckin,
}: OriginFlagInput): OriginFlag {
  if (!verifyOrigin) return "off";
  if (!isSelfCheckin) return "not_applicable";
  if (!record) return "unknown";
  if (record.networkType === "cellular") return "cellular";
  if (record.originHash === null) return "unknown";
  if (venue.status !== "established") return "no_venue";
  if (record.originHash === venue.originHash) return "at_venue";
  if (record.networkType === "campus") return "on_campus";
  return "off_network";
}

/**
 * Whether a flag is one an officer should look at.
 *
 * 📌 Two states are flagged and they are not equivalent: `off_network` is the
 * strongest claim available, `on_campus` is a soft one that only means anything
 * if the university NATs per building rather than campus-wide. Callers that
 * sort or colour should use the flag itself, not just this boolean.
 */
export function isFlaggedOrigin(flag: OriginFlag): boolean {
  return flag === "off_network" || flag === "on_campus";
}

/**
 * ONE status language for the whole app, in the spirit of banner.tsx.
 *
 * 🔓 THE WORDING IS A DESIGN CONSTRAINT, NOT COPY. None of these may assert
 * fraud. The mechanism detects "submitted from a different network than most
 * attendees, and not from a phone", which is a proxy for "not in the room" only
 * when the venue's network is distinctive — and on a campus it is not. A flag
 * is worth a glance at a list, never evidence about a person.
 */
export const ORIGIN_FLAG_LABEL: Record<OriginFlag, string> = {
  off: "Not checked",
  not_applicable: "Officer entry",
  no_venue: "No established origin",
  unknown: "Origin unknown",
  cellular: "Cellular — unverifiable",
  at_venue: "At venue",
  on_campus: "Elsewhere on campus",
  off_network: "Off-network",
};

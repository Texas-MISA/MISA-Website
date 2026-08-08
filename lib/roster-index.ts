import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

// The identity index every bulk operation matches against (§7 Stage 6.5, §7
// Stage 6 phase 7b). Takes the client as a parameter, matching
// lib/member-options.ts and lib/member-fields.ts, so it stays testable and
// carries no server-only guard.
//
// Was lib/dues-roster.ts, generalised in phase 7b when the roster import became
// the second caller. One reader rather than two, and not merely for tidiness:
// the paging below is load-bearing (see CHUNK) and a second copy is a second
// chance to write `.select()` without it.
//
// ⚠️ Deliberately NOT fetchMemberOptions, and the reasons are worth keeping
// because reusing it would look like the obvious economy:
//
//   1. It is capped at MEMBER_SCAN_LIMIT (400), a bound sized for the payload of
//      a human picker. Matching against a truncated roster reports "not on the
//      roster" for somebody who IS — silent truncation landing on money for the
//      dues import, and on a duplicate member row for the roster import.
//   2. It filters `active.eq.true`. A deactivated member can still have paid
//      dues, and — the sharper case for phase 7b — a deactivated member still
//      holds the unique EID and email that an insert would collide with.
//   3. It returns a formatted display label and selects neither
//      `normalized_eid` nor the email, which are the only columns a match may
//      key on.
//
// The precedent for an uncapped fetcher is lib/member-fields.ts, which says the
// same thing about definitions.

type Client = SupabaseClient<Database>;

/**
 * Rows per request while paging through the roster.
 *
 * 🪤 "Uncapped" is not the same as "one unbounded request". `config.toml` sets
 * no `max_rows` locally, but the hosted project applies its own — so a single
 * `.select()` comes back complete in development and silently short in
 * production. That is the same trap the roster export hit, and here it is
 * worse: a short roster does not look wrong, it just quietly stops matching
 * people. Page explicitly and use the exact count to know when to stop.
 */
const CHUNK = 1000;

/**
 * One member, as the two things an identity can be matched on.
 *
 * ⚠️ **Both, not either.** `members` carries TWO unique indexes —
 * `members_normalized_eid` and `members_email_lower` — so a row is a duplicate
 * if it collides on *either*. An importer checking only the EID would present a
 * clean preview and then take a 23505 on the insert, which is the partial-write
 * failure arriving through the one axis nobody checked.
 */
export type RosterIdentity = {
  memberId: string;
  /** Never empty — rows with no usable EID are dropped, see below. */
  normalizedEid: string;
  /** `lower(trim(email))`, mirroring the `members_email_lower` index. Empty
   * string when the member somehow has none, which matches nothing. */
  emailLower: string;
};

export type RosterResult =
  | { kind: "ok"; roster: RosterIdentity[] }
  | { kind: "error" };

/**
 * Every member's id, normalized EID and folded email — active or not, no cap.
 *
 * Three columns, so even a 500-member roster (§2.2's worst case) is tens of
 * kilobytes on an officer-only path. Returns a discriminated result rather than
 * an empty array on failure, deliberately: an empty roster and a failed read
 * are indistinguishable to a caller that gets `[]`, and the difference matters
 * enormously — matching against an empty roster would mark an entire statement
 * `unmatched`, or report every row of an import as new and then collide on all
 * of them.
 */
export async function fetchRosterIndex(db: Client): Promise<RosterResult> {
  const roster: RosterIdentity[] = [];
  // Counted separately from roster.length, which is smaller whenever a member
  // has no usable EID. Terminating on roster.length would keep requesting pages
  // that do not exist.
  let fetched = 0;
  let total = 0;

  for (let offset = 0; ; offset += CHUNK) {
    const { data, error, count } = await db
      .from("members")
      .select("id, normalized_eid, email", { count: "exact" })
      .order("id")
      .range(offset, offset + CHUNK - 1);

    if (error) {
      console.error("roster index query failed:", error.message);
      return { kind: "error" };
    }

    if (offset === 0) total = count ?? data.length;
    fetched += data.length;

    for (const row of data) {
      // A null or empty normalized_eid can never equal a note token or an
      // imported EID, and including it would let a member with no EID match a
      // row that had none either. Dropped here rather than guarded at every
      // call site.
      if (row.normalized_eid) {
        roster.push({
          memberId: row.id,
          normalizedEid: row.normalized_eid,
          emailLower: (row.email ?? "").trim().toLowerCase(),
        });
      }
    }

    if (data.length < CHUNK || fetched >= total) break;
  }

  return { kind: "ok", roster };
}

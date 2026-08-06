import type { SupabaseClient } from "@supabase/supabase-js";

import type { RosterEntry } from "@/lib/dues";
import type { Database } from "@/lib/types/database";

// The roster a payment note is matched against (§7 Stage 6.5). Takes the client
// as a parameter, matching lib/member-options.ts and lib/member-fields.ts, so it
// stays testable and carries no server-only guard.
//
// ⚠️ Deliberately NOT fetchMemberOptions, and the reasons are worth writing down
// because reusing it would look like the obvious economy:
//
//   1. It is capped at MEMBER_SCAN_LIMIT (400), a bound sized for the payload of
//      a human picker. Matching a payment against a truncated roster reports
//      `unmatched` for a member who IS on the roster — that is the
//      silent-truncation failure landing on money, and §4.2's "nothing that
//      arrived as money is dropped on the floor" is the rule it would break.
//   2. It filters `active.eq.true`. A deactivated member can still have paid
//      dues, and the payment has to attach to them.
//   3. It returns a formatted display label and does not select
//      `normalized_eid` at all — which is the only column the match may key on.
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

export type RosterResult =
  | { kind: "ok"; roster: RosterEntry[] }
  | { kind: "error" };

/**
 * Every member's id and normalized EID — active or not, no cap.
 *
 * Two columns, so even a 500-member roster (§2.2's worst case) is tens of
 * kilobytes on an officer-only path. Returns a discriminated result rather than
 * an empty array on failure, deliberately: an empty roster and a failed read
 * are indistinguishable to a caller that gets `[]`, and the difference matters
 * enormously — matching against an empty roster would mark an entire statement
 * `unmatched` and look like a legitimate outcome.
 */
export async function fetchDuesRoster(db: Client): Promise<RosterResult> {
  const roster: RosterEntry[] = [];
  // Counted separately from roster.length, which is smaller whenever a member
  // has no usable EID. Terminating on roster.length would keep requesting pages
  // that do not exist.
  let fetched = 0;
  let total = 0;

  for (let offset = 0; ; offset += CHUNK) {
    const { data, error, count } = await db
      .from("members")
      .select("id, normalized_eid", { count: "exact" })
      .order("id")
      .range(offset, offset + CHUNK - 1);

    if (error) {
      console.error("dues roster query failed:", error.message);
      return { kind: "error" };
    }

    if (offset === 0) total = count ?? data.length;
    fetched += data.length;

    for (const row of data) {
      // A null or empty normalized_eid can never equal a note token, and
      // including it would let a member with no EID match a note that had none
      // either. Dropped here rather than guarded at every call site.
      if (row.normalized_eid) {
        roster.push({ memberId: row.id, normalizedEid: row.normalized_eid });
      }
    }

    if (data.length < CHUNK || fetched >= total) break;
  }

  return { kind: "ok", roster };
}

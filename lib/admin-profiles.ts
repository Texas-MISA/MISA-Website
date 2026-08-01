import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

// Officer display names for the audit trail and the points ledger.
//
// This exists because there is no join to make. admin_audit.actor_id,
// point_adjustments.awarded_by, and attendance.resolved_by all reference
// auth.users, which PostgREST cannot embed and which has no relationship to
// admin_profiles — so "who did this" is a second query, keyed on the ids the
// first query returned.
//
// Takes the client as a parameter, matching lib/checkin.ts, so it stays
// testable and carries no server-only guard.

type Client = SupabaseClient<Database>;

/**
 * Map officer user ids to a display name.
 *
 * **Absence and a null value mean different things, and conflating them is a
 * bug the audit trail cannot afford.**
 *
 *   - *absent* — no `admin_profiles` row. A revoked officer keeps their auth
 *     user but loses the profile (`create-officer.mjs --revoke`), and their
 *     past actions must still render.
 *   - *present, value null* — a current officer who simply has no display name
 *     set. `create-officer.mjs` leaves it null unless `--display-name` is
 *     passed, so this is the common case, not an edge one.
 *
 * Filtering the nameless out used to collapse the second case into the first,
 * which made the review screen credit every ordinary officer's work to "a
 * former officer" — precisely inverting the accountability the log exists for
 * (§6). Callers decide how each case reads.
 */
export async function fetchOfficerNames(
  db: Client,
  userIds: string[]
): Promise<Map<string, string | null>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const { data, error } = await db
    .from("admin_profiles")
    .select("user_id, display_name")
    .in("user_id", unique);

  if (error) {
    // A missing name is a cosmetic loss; the action, timestamp, and diff are
    // what the log is for. Degrade rather than fail the page.
    console.error("officer name lookup failed:", error.message);
    return new Map();
  }

  return new Map(data.map((row) => [row.user_id, row.display_name]));
}

/**
 * How one officer id reads on screen.
 *
 * The three cases fetchOfficerNames distinguishes, phrased. Lives here rather
 * than beside any one caller because the audit trail, the points ledger, and
 * the adjustment detail page must phrase them identically — three copies is
 * three chances for one of them to collapse the middle case back into "a former
 * officer", which is the exact regression phase 3 fixed.
 */
export function describeOfficer(
  names: Map<string, string | null>,
  userId: string
): string {
  if (!names.has(userId)) return "a former officer";
  return names.get(userId) ?? "an officer";
}

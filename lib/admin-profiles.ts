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
export type OfficerNames =
  | { kind: "ok"; names: Map<string, string | null> }
  | { kind: "error" };

export async function fetchOfficerNames(
  db: Client,
  userIds: string[]
): Promise<OfficerNames> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return { kind: "ok", names: new Map() };

  const { data, error } = await db
    .from("admin_profiles")
    .select("user_id, display_name")
    .in("user_id", unique);

  if (error) {
    // 🔓 This used to `return new Map()` under a comment calling a missing name
    // "a cosmetic loss". It is not, and Stage 8 phase 3 changed it.
    //
    // `describeOfficer` reads absence from the map as "no admin_profiles row",
    // i.e. a REVOKED officer. An empty map makes that true of every id at once,
    // so a single failed read silently relabels **every officer on every
    // screen** — the ledger, both dues surfaces, the member detail, the audit
    // trail — as "a former officer". That is not a cosmetic degradation; it is
    // the exact regression the doc comment above records as having been fixed,
    // reintroduced through the error path, on the log whose whole purpose is
    // saying who did what.
    //
    // A fourth state instead: the lookup failed, and nobody is described.
    console.error("officer name lookup failed:", error.message);
    return { kind: "error" };
  }

  return {
    kind: "ok",
    names: new Map(data.map((row) => [row.user_id, row.display_name])),
  };
}

/**
 * How one officer id reads on screen.
 *
 * The cases fetchOfficerNames distinguishes, phrased. Lives here rather than
 * beside any one caller because the audit trail, the points ledger, and the
 * adjustment detail page must phrase them identically — three copies is three
 * chances for one of them to collapse a case back into "a former officer",
 * which is the exact regression Stage 5 phase 3 fixed and the Stage 8 error
 * path reintroduced.
 *
 * ⚠️ **FOUR cases now.** The failure has its own words, and it must: saying "a
 * former officer" when the lookup simply did not run is a claim about a person
 * rather than a gap in the page.
 */
export function describeOfficer(
  result: OfficerNames,
  userId: string
): string {
  if (result.kind === "error") return "an officer (name unavailable)";
  if (!result.names.has(userId)) return "a former officer";
  return result.names.get(userId) ?? "an officer";
}

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
 * Ids with no `admin_profiles` row are simply absent from the map rather than
 * mapped to a placeholder: a revoked officer keeps their auth user but loses
 * the profile (`create-officer.mjs --revoke`), and their past actions must
 * still render. Callers decide what an unknown actor looks like.
 */
export async function fetchOfficerNames(
  db: Client,
  userIds: string[]
): Promise<Map<string, string>> {
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

  return new Map(
    data
      .filter((row) => row.display_name)
      .map((row) => [row.user_id, row.display_name as string])
  );
}

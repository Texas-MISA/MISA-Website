import type { SupabaseClient } from "@supabase/supabase-js";

import { MEMBER_SCAN_LIMIT } from "@/lib/attendance";
import type { Database } from "@/lib/types/database";

// Member choices for the admin pickers — the resolution form, manual entry, and
// the points grant form all offer the same list, so it is built once here.
//
// Takes the client as a parameter, matching lib/event-options.ts and
// lib/admin-profiles.ts, so it stays testable and carries no server-only guard.
//
// Active members only, bounded by MEMBER_SCAN_LIMIT: this is a scan rather than
// a search, for the reason recorded on that constant — `ilike '%jon%'` cannot
// match `John`, so a probe-based candidate set structurally excludes the row the
// officer is looking for. Callers that need to filter do it over the returned
// list; pg_trgm is the growth path if the roster ever outgrows the limit.

type Client = SupabaseClient<Database>;

export type MemberOption = {
  id: string;
  label: string;
  active: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchMemberOptions(
  db: Client,
  opts: { includeId?: string | null; limit?: number } = {}
): Promise<MemberOption[]> {
  const { includeId = null, limit = MEMBER_SCAN_LIMIT } = opts;

  // `id.eq.${…}` splices a string into a PostgREST filter expression, so this
  // has to be a uuid before it goes anywhere near the query. Today every caller
  // passes a value read back out of the database, but the guard is what keeps
  // that true once one of them starts passing a searchParam.
  const linkedId = includeId && UUID_RE.test(includeId) ? includeId : null;

  const { data, error } = await db
    .from("members")
    .select("id, full_name, student_id, active")
    // With no linked id this collapses to `active.eq.true`, which is exactly
    // what a picker with nothing preselected wants. With one, it keeps whoever
    // is currently linked even if they have been deactivated since — dropping
    // them from the list would silently unlink them on the next save.
    .or(linkedId ? `active.eq.true,id.eq.${linkedId}` : "active.eq.true")
    .order("full_name")
    .limit(limit);

  if (error) {
    console.error("member options query failed:", error.message);
    return [];
  }

  return data.map((member) => ({
    id: member.id,
    label: `${member.full_name} (${member.student_id})${member.active ? "" : " — inactive"}`,
    active: member.active,
  }));
}

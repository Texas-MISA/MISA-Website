import type { SupabaseClient } from "@supabase/supabase-js";

import { MEMBER_SCAN_LIMIT, type MemberCandidate } from "@/lib/attendance";
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
// list.
//
// ⚠️ The limit truncates silently — no error, no marker in the list. Past
// MEMBER_SCAN_LIMIT active members, names sorting after the cut simply are not
// offered by any picker, which reads to an officer as "that member doesn't
// exist". pg_trgm is the growth path and it is due before the roster gets
// there; §2.2's capacity check has the numbers.

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
    .select("id, full_name, eid, active")
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
    label: `${member.full_name} (${member.eid})${member.active ? "" : " — inactive"}`,
    active: member.active,
  }));
}

/**
 * The merge screen's candidates (§7 Stage 6 phase 8) — **including inactive
 * members**, and in the ranker's own shape.
 *
 * ⚠️ Deliberately not `fetchMemberOptions`, and the difference is the whole
 * point: that one is active-only, which is exactly wrong here. A duplicate is
 * very often the deactivated half of a pair — an officer who noticed a ghost
 * and switched it off rather than merging it, which is the only thing they
 * could do before this phase existed. Filtering to active would hide precisely
 * the rows the merge tool was built to clean up.
 *
 * `includeId` cannot cover that case either: it keeps the *currently linked*
 * member, and a merge has no linked member — it is looking for one.
 *
 * Returns `MemberCandidate` rather than a label, so one read serves both the
 * picker and `rankDuplicateCandidates`. Two reads could disagree about who is
 * offerable, which would let the ranker suggest somebody the picker cannot
 * select.
 *
 * ⚠️ Still bounded by MEMBER_SCAN_LIMIT, and here the truncation is sharper than
 * usual: past the cap a duplicate is neither suggested nor pickable, with
 * nothing on screen to say so. Unordered for the same reason the resolution
 * form is — an order would make the truncation deterministic, not correct. The
 * fix is pg_trgm and it is on the Capacity list in tasks.md.
 */
export async function fetchMergeCandidates(
  db: Client,
  opts: { excludeId?: string | null; limit?: number } = {}
): Promise<MemberCandidate[]> {
  const { excludeId = null, limit = MEMBER_SCAN_LIMIT } = opts;

  const { data, error } = await db
    .from("members")
    .select("id, full_name, email, eid, normalized_eid, active")
    .limit(limit);

  if (error) {
    console.error("merge candidate query failed:", error.message);
    return [];
  }

  return data
    .filter((row) => row.id !== excludeId)
    .map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      eid: row.eid,
      normalizedEid: row.normalized_eid ?? "",
      active: row.active,
    }));
}

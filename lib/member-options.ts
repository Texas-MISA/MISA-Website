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
// MEMBER_SCAN_LIMIT members, names sorting after the cut simply are not
// offered by any picker, which reads to an officer as "that member doesn't
// exist". pg_trgm is the growth path and it is due before the roster gets
// there; §2.2's capacity check has the numbers.

type Client = SupabaseClient<Database>;

export type MemberOptionsResult =
  | { kind: "ok"; options: MemberOption[] }
  | { kind: "error" };

export type MergeCandidatesResult =
  | { kind: "ok"; candidates: MemberCandidate[] }
  | { kind: "error" };

export type MemberOption = {
  id: string;
  label: string;
};

// ✂️ `includeId` left with `members.active` on 2026-08-25, and so did the whole
// `.or()` this function used to build. Its only job was keeping a member who
// had been DEACTIVATED since being linked in the list, so that reopening the
// payment editor did not silently unlink them on the next save. With no flag
// there is nobody to exclude and nothing to make an exception for.
//
// ⚠️ It never protected against the OTHER way a linked member can be missing —
// `limit` applies after filtering, so somebody sorting past MEMBER_SCAN_LIMIT
// dropped out then and drops out now. That is the cap's problem, tracked with
// the cap.
export async function fetchMemberOptions(
  db: Client,
  opts: { limit?: number } = {}
): Promise<MemberOptionsResult> {
  const { limit = MEMBER_SCAN_LIMIT } = opts;

  const { data, error } = await db
    .from("members")
    .select("id, full_name, eid")
    .order("full_name")
    .limit(limit);

  // 🔓 A discriminated result, not `[]` (Stage 8 phase 3). The sharpest caller
  // is the payment editor on dues/[id]: an empty picker there means the officer
  // cannot credit a payment to anybody, on the screen built for exactly that,
  // with money on the other end and nothing on screen saying why.
  //
  // ⚠️ This list ALREADY truncates silently at MEMBER_SCAN_LIMIT, so the cap
  // path and the error path used to produce an identical screen. They no longer
  // do; the cap remains a separate, tracked problem.
  if (error) {
    console.error("member options query failed:", error.message);
    return { kind: "error" };
  }

  return {
    kind: "ok",
    options: data.map((member) => ({
      id: member.id,
      label: `${member.full_name} (${member.eid})`,
    })),
  };
}

/**
 * The merge screen's candidates (§7 Stage 6 phase 8), in the ranker's own shape.
 *
 * ⚠️ Deliberately not `fetchMemberOptions`. The difference used to be that one
 * was active-only — exactly wrong here, since a duplicate is very often the
 * deactivated half of a pair. `members.active` is gone as of 2026-08-25, so the
 * two now differ only in SHAPE: this returns MemberCandidate for the ranker,
 * with the normalized EID it scores on.
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
): Promise<MergeCandidatesResult> {
  const { excludeId = null, limit = MEMBER_SCAN_LIMIT } = opts;

  const { data, error } = await db
    .from("members")
    .select("id, full_name, email, eid, normalized_eid")
    .limit(limit);

  // A failed read here left the merge picker empty AND the duplicate
  // suggestions absent — i.e. "this member has no duplicates", a confident
  // claim about the roster produced by never reading it.
  if (error) {
    console.error("merge candidate query failed:", error.message);
    return { kind: "error" };
  }

  return {
    kind: "ok",
    candidates: data
    .filter((row) => row.id !== excludeId)
    .map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      eid: row.eid,
      normalizedEid: row.normalized_eid ?? "",
    })),
  };
}

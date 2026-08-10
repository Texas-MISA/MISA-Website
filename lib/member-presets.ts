import type { SupabaseClient } from "@supabase/supabase-js";

import type { Preset } from "@/lib/presets";
import type { Database } from "@/lib/types/database";

// The saved directory filters (§7 Stage 6 phase 7a), read once per request and
// shared by the directory's preset bar and the manage screen.
//
// Takes the client as a parameter, matching lib/member-fields.ts,
// lib/member-options.ts and lib/event-options.ts, so it stays testable and
// carries no server-only guard. The pure half — canonicalisation and the
// summary — lives in lib/presets.ts and is what Vitest exercises directly.
//
// No cap, and deliberately, for the same reason lib/member-fields.ts gives:
// a cap that silently truncates is the failure mode CLAUDE.md names, and presets
// are officer-created one at a time. Nobody hand-saves 500 filters. If a
// pathological number ever appeared it would be visible as a wall of chips
// rather than as missing data, which is the difference that matters.

type Client = SupabaseClient<Database>;

/** One unbroken string literal with `as const`: PostgREST types the returned
 * row off the literal, and a wrapped or concatenated column list widens to
 * plain `string` and collapses the result to `GenericStringError`. */
const PRESET_COLUMNS = "id, name, query, created_by" as const;

/**
 * Every saved preset, alphabetically.
 *
 * `name` then `id`, because a total order is not optional even here: names are
 * unique case-insensitively but PostgREST orders by the raw column, so `Award`
 * and `award` are a legitimate tie and would otherwise arrange themselves
 * differently per request. The list is short enough to read in one request, so
 * this is about a stable render rather than about chunk boundaries.
 */
export type PresetsResult =
  | { kind: "ok"; presets: Preset[] }
  | { kind: "error" };

export async function fetchPresets(db: Client): Promise<PresetsResult> {
  const { data, error } = await db
    .from("member_filter_presets")
    .select(PRESET_COLUMNS)
    .order("name")
    .order("id");

  if (error) {
    console.error("preset query failed:", error.message);
    // 🔓 A discriminated result, not `[]` (Stage 8 phase 3). The old comment
    // argued the right half and drew the wrong conclusion: a failed read must
    // indeed not take the roster down, and the fix for that is that the CALLER
    // keeps rendering — not that the failure becomes invisible. Returning []
    // made /admin/members/presets print "No saved views yet. Filter the
    // directory, then use Save this view…" — onboarding copy for a first-time
    // user, shown to someone whose saved views exist and could not be read.
    // "The cost is a missing chip row, which is visible" was the mistake: an
    // absent chip row looks exactly like having no presets.
    return { kind: "error" };
  }

  return {
    kind: "ok",
    presets: data.map((row) => ({
      id: row.id,
      name: row.name,
      query: row.query,
      createdBy: row.created_by,
    })),
  };
}

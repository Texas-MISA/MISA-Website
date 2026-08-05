import type { SupabaseClient } from "@supabase/supabase-js";

import type { FieldDefinition } from "@/lib/members";
import type { Database } from "@/lib/types/database";

// The custom-field definitions (§7 Stage 6 phase 4), read once per request and
// shared by everything that needs to know what fields exist: the directory's
// columns and sort keys, the detail page's editor, the fields admin screen, and
// phase 5's export field catalogue.
//
// Takes the client as a parameter, matching lib/member-options.ts,
// lib/event-options.ts and lib/admin-profiles.ts, so it stays testable and
// carries no server-only guard. The pure half — the key format, the `cf:`
// namespace, value get/set — lives in lib/members.ts and is what Vitest
// exercises directly; this file is only the read.
//
// No MEMBER_SCAN_LIMIT-style cap here, and that is deliberate rather than an
// oversight. A cap that silently truncates is the failure mode CLAUDE.md names,
// and definitions are officer-created one at a time: a roster can plausibly
// reach 500 members, but nobody hand-creates 500 dropdowns. The bound that
// matters is on how many become directory COLUMNS, and show_in_directory is
// what officers set for that.

type Client = SupabaseClient<Database>;

/** One unbroken string literal with `as const`: PostgREST types the returned
 * row off the literal, and a wrapped or concatenated column list widens to
 * plain `string` and collapses the result to `GenericStringError`. */
const FIELD_COLUMNS =
  "id, key, label, kind, options, editable_inline, show_in_directory, sort_order, archived_at" as const;

/**
 * Every live definition, in the order officers arranged them.
 *
 * Archived definitions are excluded here rather than filtered by callers.
 * Archiving means "stop offering this", and a screen that forgot the predicate
 * would quietly resurrect a retired field as a column — while the values stay
 * in `members.custom_fields`, which is the whole point of archiving over
 * deleting. The fields admin screen wants archived rows too and passes
 * `includeArchived`.
 *
 * `(sort_order, key)` is the order, with key as the tie-break: sort_order is an
 * officer-set integer with no uniqueness, and two fields sharing one would
 * otherwise arrange themselves differently per request — the same
 * total-order-not-merely-a-sort rule the directory rows follow.
 */
export async function fetchFieldDefinitions(
  db: Client,
  opts: { includeArchived?: boolean } = {}
): Promise<FieldDefinition[]> {
  const { includeArchived = false } = opts;

  let query = db.from("member_field_definitions").select(FIELD_COLUMNS);
  if (!includeArchived) query = query.is("archived_at", null);

  const { data, error } = await query.order("sort_order").order("key");

  if (error) {
    console.error("field definitions query failed:", error.message);
    // An empty list, not a throw. A failed read here must not take the whole
    // directory down with it: the four built-in columns are the screen's job
    // and they do not depend on this. The cost is a directory that silently
    // loses its custom columns for one request, which is visible; the
    // alternative is an error page in place of the roster.
    return [];
  }

  return data.map(toDefinition);
}

function toDefinition(row: {
  id: string;
  key: string;
  label: string;
  kind: string;
  options: string[];
  editable_inline: boolean;
  show_in_directory: boolean;
  sort_order: number;
  archived_at: string | null;
}): FieldDefinition {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    // `kind` is `text` with a one-value CHECK in SQL and a union in TypeScript,
    // the same asymmetry admin_audit.action carries. Only 'select' is storable
    // today, so this cast is currently exact; widening the CHECK means widening
    // FieldKind in the same commit.
    kind: "select",
    options: row.options,
    editableInline: row.editable_inline,
    showInDirectory: row.show_in_directory,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
  };
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/types/database";

// The shared admin_audit writer (§4.2, §6). Every officer mutation writes a
// row through here; no other module inserts into admin_audit directly.
//
// ⚠️ This file has NO "use server" directive, and that is deliberate.
//
// In Next 16 every export of a "use server" module becomes a publicly callable
// endpoint. A client-reachable writeAudit(actorId, ...) would let anyone forge
// audit rows under any officer's name — exactly inverting the control §6
// relies on, since the audit log is what makes officer overrides accountable.
// Keeping it a plain module guarded by `server-only` means it can only ever be
// called from other server code. It still lives in app/actions/ because that
// is where CLAUDE.md puts it.

type Client = SupabaseClient<Database>;

/**
 * The entities an officer action can be filed against.
 *
 * ⚠️ This union is the only thing enforcing entity types on the TypeScript
 * side, and it has drifted from the SQL check once already: `'roster'` was
 * added to the constraint by migration 14 and never added here, so the export
 * receipt phase 5 is built on could not have been written without a cast. Keep
 * this list and `admin_audit_entity_type_check` in step — and because
 * admin_audit is append-only (P0001 on UPDATE and DELETE alike), a row filed
 * under the wrong type can never be corrected.
 *
 * `roster` is not an entity at all: an export spans N members, so each one
 * generates a receipt uuid that nothing else references (migration 14).
 * `member_field` is a custom-field definition (migration 18) — its own type
 * rather than `member`, because "someone renamed the dues column" is not an
 * event in any individual member's history.
 */
export type AuditEntityType =
  | "attendance"
  | "event"
  | "member"
  | "member_field"
  | "point_adjustment"
  | "roster";

/**
 * The action vocabulary. Fixed here rather than passed as free text because
 * /admin/audit filters on it — a typo'd action silently disappears from the
 * one screen that exists to answer "who changed this".
 *
 * Series operations write one row per event: admin_audit.entity_type has no
 * 'series' value and entity_id is a uuid, so the series id goes in `note`.
 *
 * Granularity follows officer intent, not columns. Assigning an event and
 * linking a member happen in one click and write one `attendance.updated` row;
 * `before`/`after` already say precisely which columns moved, so splitting
 * them into two actions would add rows without adding information. Bulk
 * operations reuse the single-row verbs and carry their batch context in
 * `note`, so a row's history reads the same whether the change came from the
 * detail page or the queue.
 *
 * ⚠️ Readers must tolerate values outside this union. The column is `text` in
 * SQL, this union constrains only what *we* write, and two pre-Stage-5 rows on
 * the production database carry the older bare verbs `reject` and `void`. They
 * can never be corrected: the append-only trigger raises P0001 on UPDATE and
 * DELETE alike, which is the property that makes the log worth having.
 */
export type AuditAction =
  | "event.created"
  | "event.updated"
  | "event.published"
  | "event.cancelled"
  | "event.reopened"
  | "event.deleted"
  | "series.created"
  | "series.published"
  | "series.cancelled"
  | "attendance.created"
  | "attendance.updated"
  | "attendance.approved"
  | "attendance.rejected"
  | "attendance.reopened"
  // No points.updated: an adjustment is immutable except for voiding.
  | "points.granted"
  | "points.voided"
  // Stage 6 phase 4. member.updated covers every edit to a member row —
  // a custom-field value, the officer notes, or both at once — for the same
  // reason attendance.updated is one verb: before/after already say which
  // columns moved, and splitting by column adds rows without adding meaning.
  // A field DEFINITION is a different entity and gets its own three.
  | "member.updated"
  | "member_field.created"
  | "member_field.updated"
  // Archived, never deleted: stored values stay keyed to the definition, and a
  // hard delete would rewrite what the roster said at the time.
  | "member_field.archived";

export type AuditEntry = {
  entityType: AuditEntityType;
  entityId: string;
  actorId: string;
  action: AuditAction;
  before?: Json | null;
  after?: Json | null;
  note?: string | null;
};

/**
 * Record one officer action.
 *
 * Takes the client as a parameter, matching lib/checkin.ts, so tests can call
 * it directly with an injected client.
 *
 * **Never throws.** PostgREST cannot transact across statements, so the
 * mutation and this insert are two round trips: by the time we get here the
 * change has already happened. Failing the caller would report an error for a
 * write that actually succeeded and invite the officer to retry it — a
 * duplicate event is worse than a missing audit row. So this logs loudly and
 * returns. The gap is recorded in §8's risk register; the eventual fix is one
 * plpgsql RPC per mutation doing both in a single transaction.
 */
export async function writeAudit(db: Client, entry: AuditEntry): Promise<void> {
  const { error } = await db.from("admin_audit").insert(toRow(entry));
  if (error) {
    console.error(
      `audit write failed (${entry.action} on ${entry.entityType} ${entry.entityId}):`,
      error.message
    );
  }
}

/** One insert for a batch — used by the series operations, where a 12-week
 * schedule would otherwise mean 12 round trips. Same never-throws contract. */
export async function writeAuditBatch(
  db: Client,
  entries: AuditEntry[]
): Promise<void> {
  if (entries.length === 0) return;

  const { error } = await db.from("admin_audit").insert(entries.map(toRow));
  if (error) {
    console.error(
      `audit batch write failed (${entries.length} rows, ${entries[0].action}):`,
      error.message
    );
  }
}

function toRow(entry: AuditEntry) {
  return {
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    actor_id: entry.actorId,
    action: entry.action,
    before: entry.before ?? null,
    after: entry.after ?? null,
    note: entry.note ?? null,
  };
}

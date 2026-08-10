import {
  describeOfficer,
  fetchOfficerNames,
  type OfficerNames,
} from "@/lib/admin-profiles";
import { formatInstant } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/types/database";

// Per-entity activity log (§4.2, §6). Shared by the submission detail page and
// the points ledger; the global /admin/audit route in §5 is a later stage.
//
// Service-role read: admin_audit is deny-all under RLS until Stage 8.

const LIMIT = 50;

type AuditRow = {
  id: number;
  action: string;
  actor_id: string;
  acted_at: string;
  before: Json | null;
  after: Json | null;
  note: string | null;
};

/**
 * Human-readable action label.
 *
 * Falls back to the raw string on purpose. `admin_audit.action` is `text` in
 * SQL and a closed union only in TypeScript, and two pre-Stage-5 rows on the
 * production database carry the bare verbs `reject` and `void`. They can never
 * be corrected — the append-only trigger raises P0001 on UPDATE and DELETE
 * alike, which is the property that makes the log worth keeping — so a reader
 * that hid unknown actions would hide real history.
 */
function formatAuditAction(action: string): string {
  const LABELS: Record<string, string> = {
    "attendance.created": "Created",
    "attendance.updated": "Updated",
    "attendance.approved": "Approved",
    "attendance.rejected": "Rejected",
    "attendance.reopened": "Reopened",
    "points.granted": "Granted",
    "points.voided": "Voided",
    "event.created": "Created",
    "event.updated": "Updated",
    "event.published": "Published",
    "event.cancelled": "Cancelled",
    "event.reopened": "Reopened",
    "event.deleted": "Deleted",
    // Series operations write one row per event (admin_audit has no 'series'
    // entity type), so these appear in an ordinary event's trail and were
    // rendering as the raw verb.
    "series.created": "Created with a series",
    "series.published": "Published with a series",
    "series.cancelled": "Cancelled with a series",
    // Stage 6 phase 4.
    "member.updated": "Updated",
    // Stage 6 phase 7b. Unlike the preset verbs this one DOES appear in a
    // trail — it is filed against the member, so it is the first line of the
    // history on /admin/members/[id] for anyone who arrived by CSV.
    "member.imported": "Imported",
    // Stage 6 phase 8. Reads on the SURVIVOR's trail, and the note beside it is
    // the only remaining record of who was merged away.
    "member.merged": "Merged",
    "member_field.created": "Field created",
    "member_field.updated": "Field updated",
    "member_field.archived": "Field archived",
    // Stage 6 phase 5. Appears in no entity's trail today — a roster receipt
    // names a uuid nothing else references, so it is reachable only from an
    // audit browser (phase 9's /admin/audit). The label lands with the verb
    // regardless, because a row written now is uncorrectable later.
    "roster.exported": "Exported",
    // Stage 6.5. "Imported" rather than "Created": a payment row is a record of
    // money that already arrived, not something an officer brought into being.
    "dues.imported": "Imported",
    "dues.assigned": "Assigned to a member",
    "dues.updated": "Updated",
    "dues.voided": "Voided",
    // Stage 6 phase 7a. Like roster.exported these appear in no entity's trail
    // today — a preset has no detail page with an AuditTrail on it — and the
    // labels land with the verbs regardless, because a row written now can never
    // be corrected later.
    "preset.created": "Saved",
    "preset.updated": "Updated",
    "preset.deleted": "Deleted",
  };
  return LABELS[action] ?? action;
}

async function fetchTrail(
  entityType: string,
  entityId: string
): Promise<
  | { kind: "ok"; rows: AuditRow[]; names: OfficerNames }
  | { kind: "error" }
> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_audit")
    .select("id, action, actor_id, acted_at, before, after, note")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("acted_at", { ascending: false })
    .limit(LIMIT);

  if (error) {
    console.error("audit trail query failed:", error.message);
    return { kind: "error" };
  }

  const names = await fetchOfficerNames(
    db,
    data.map((row) => row.actor_id)
  );
  return { kind: "ok", rows: data, names };
}

export async function AuditTrail({
  entityType,
  entityId,
}: {
  // Mirrors AuditEntityType in app/actions/audit.ts, minus 'roster' — an export
  // receipt is not an entity anyone can open a page for.
  entityType:
    | "attendance"
    | "dues_payment"
    | "event"
    | "member"
    | "member_field"
    | "point_adjustment";
  entityId: string;
}) {
  const result = await fetchTrail(entityType, entityId);

  if (result.kind === "error") {
    return (
      <p className="border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm">
        Couldn&apos;t load the history for this record.
      </p>
    );
  }

  if (result.rows.length === 0) {
    return (
      <p className="border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm">
        No officer has changed this record yet. Check-ins submitted through the
        public form write no audit row — there is no acting officer to record.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-4">
      {result.rows.map((row) => (
        <li key={row.id} className="border-l-4 border-black/20 pl-4">
          <p className="text-sm">
            <strong>{formatAuditAction(row.action)}</strong>{" "}
            <span className="text-foreground/70">
              by {describeOfficer(result.names, row.actor_id)} on{" "}
              {formatInstant(row.acted_at)} CT
            </span>
          </p>
          {row.note && (
            <p className="mt-1 text-sm text-foreground/80">{row.note}</p>
          )}
          <Diff before={row.before} after={row.after} />
        </li>
      ))}
    </ol>
  );
}

/**
 * The columns that actually moved.
 *
 * Audit granularity follows officer intent rather than columns — assigning an
 * event and linking a member is one `attendance.updated` row — so this diff is
 * what makes the row specific. Without it the log says something changed but
 * not what.
 */
function Diff({ before, after }: { before: Json | null; after: Json | null }) {
  const from = asRecord(before);
  const to = asRecord(after);
  if (!from && !to) return null;

  const keys = [
    ...new Set([...Object.keys(from ?? {}), ...Object.keys(to ?? {})]),
  ].filter((key) => render(from?.[key]) !== render(to?.[key]));

  if (keys.length === 0) return null;

  return (
    <dl className="mt-2 flex flex-col gap-0.5 text-xs">
      {keys.map((key) => (
        <div key={key} className="flex flex-wrap gap-x-2">
          <dt className="font-mono text-foreground/60">{key}</dt>
          <dd className="font-mono">
            <span className="text-foreground/60 line-through">
              {render(from?.[key])}
            </span>{" "}
            → <span>{render(to?.[key])}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function asRecord(value: Json | null): Record<string, Json> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, Json>;
}

function render(value: Json | undefined): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "string") return value === "" ? '""' : value;
  return JSON.stringify(value);
}

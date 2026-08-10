import { describeOfficer } from "@/lib/admin-profiles";
import { toCentralFields } from "@/lib/events";
import { formatPointCategory } from "@/lib/points";
import { formatAttendanceSource, formatAttendanceStatus } from "@/lib/attendance";

import type { ExportCell, ExportField } from "@/lib/export";

// The archival export cores for the two ledgers (Stage 8 phase 2). Pure, like
// lib/export.ts, and deliberately a sibling of it rather than an extension:
// that file's BUILTIN_FIELDS / exportCatalogue / builtinCell are member-shaped
// all the way down, while everything that actually writes a file —
// toCsv/toTsv/toXlsx, guardFormula, the ExportCell union — is domain-agnostic
// and consumes exactly `(ExportField[], ExportCell[][])`. That is the seam.
//
// 📌 Archival means MORE than the screens show. The queue hides the resolution
// columns and the ledger hides the void columns, because an officer working
// through them does not need either. A file that outlives the officer does.

/** The formats a ledger archive serves. */
export const LEDGER_EXPORT_FORMATS = ["xlsx", "csv", "tsv"] as const;
export type LedgerExportFormat = (typeof LEDGER_EXPORT_FORMATS)[number];

/**
 * ⚠️ NOT `isExportFormat`. That accepts `emails` and `names`, which are
 * member-shaped clipboard formats — `exportedFields` collapses them to a single
 * `email` or `name` column, and neither exists in these catalogues. Accepting
 * one here would emit a file with a header and no cells.
 */
export function isLedgerExportFormat(value: string): value is LedgerExportFormat {
  return (LEDGER_EXPORT_FORMATS as readonly string[]).includes(value);
}

function text(value: string | null | undefined): ExportCell {
  if (value === null || value === undefined || value === "") {
    return { kind: "empty" };
  }
  return { kind: "text", value };
}

function num(value: number | null | undefined): ExportCell {
  return value === null || value === undefined
    ? { kind: "empty" }
    : { kind: "number", value };
}

function date(at: string | null | undefined): ExportCell {
  return at ? { kind: "date", value: at } : { kind: "empty" };
}

/**
 * The Central wall-clock time of an instant, as `HH:MM`.
 *
 * 🪤 Timestamps go out as TWO columns — a `date` cell and this — rather than one
 * combined value, and that is a deliberate trade rather than an oversight.
 *
 * `formatInstant` is what both screens use and it omits the year (lib/events.ts
 * notes this is right for a check-in banner), which is wrong for a file opened
 * in two years. A single ISO `YYYY-MM-DD HH:MM` string would fix that but lands
 * as *text*, so Excel will not sort or filter it as a date. And a real datetime
 * cell would need an Excel serial carrying a fractional day plus a numFmt —
 * tests/xlsx.test.ts documents four separate ways that produces Excel's "we
 * found a problem with some content" repair prompt, and none of them is worth
 * risking for a time column.
 *
 * So: a real date cell that sorts, plus the time beside it. The field picker is
 * what makes two columns acceptable — an officer who does not want the time
 * unticks it.
 */
function centralTime(at: string | null | undefined): ExportCell {
  return at ? text(toCentralFields(at).time) : { kind: "empty" };
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

/** One attendance row as the archive reads it. */
export type AttendanceExportRow = {
  id: string;
  submitted_name: string;
  submitted_eid: string;
  submitted_email: string;
  submitted_at: string;
  status: string;
  source: string;
  event_id: string | null;
  member_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  events: { id: string; title: string } | null;
  members: { id: string; full_name: string } | null;
};

export const ATTENDANCE_EXPORT_FIELDS: readonly ExportField[] = [
  { key: "submitted_date", label: "Submitted", kind: "date", source: "builtin" },
  { key: "submitted_time", label: "Time (CT)", kind: "text", source: "builtin" },
  { key: "name", label: "Name submitted", kind: "text", source: "builtin" },
  { key: "eid", label: "EID submitted", kind: "text", source: "builtin" },
  { key: "email", label: "Email submitted", kind: "text", source: "builtin" },
  { key: "status", label: "Status", kind: "text", source: "builtin" },
  { key: "event", label: "Event", kind: "text", source: "builtin" },
  { key: "member", label: "Linked member", kind: "text", source: "builtin" },
  { key: "source", label: "Source", kind: "text", source: "builtin" },
  // Not on the queue screen; the point of an archive.
  { key: "resolved_date", label: "Resolved", kind: "date", source: "builtin" },
  { key: "resolved_by", label: "Resolved by", kind: "text", source: "builtin" },
  { key: "resolution_note", label: "Resolution note", kind: "text", source: "builtin" },
  { key: "id", label: "Submission id", kind: "text", source: "builtin" },
];

export const ATTENDANCE_DEFAULT_FIELDS: readonly string[] = [
  "submitted_date",
  "submitted_time",
  "name",
  "eid",
  "email",
  "status",
  "event",
];

export function projectAttendanceRow(
  row: AttendanceExportRow,
  fields: readonly ExportField[],
  officers: Map<string, string | null>
): ExportCell[] {
  return fields.map((field): ExportCell => {
    switch (field.key) {
      case "submitted_date":
        return date(row.submitted_at);
      case "submitted_time":
        return centralTime(row.submitted_at);
      case "name":
        return text(row.submitted_name);
      case "eid":
        return text(row.submitted_eid);
      case "email":
        return text(row.submitted_email);
      case "status":
        return text(formatAttendanceStatus(row.status));
      case "event":
        // The title, not the id — an archive is read by a human. An orphan has
        // no event and must read as blank rather than as a missing lookup.
        return text(row.events?.title ?? null);
      case "member":
        return text(row.members?.full_name ?? null);
      case "source":
        return text(formatAttendanceSource(row.source));
      case "resolved_date":
        return date(row.resolved_at);
      case "resolved_by":
        // ⚠️ Three cases, not two: absent means the officer's profile is gone
        // (revoked), null means a current officer with no display name.
        // Collapsing them credits every ordinary officer to "a former officer".
        return row.resolved_by
          ? text(describeOfficer(officers, row.resolved_by))
          : { kind: "empty" };
      case "resolution_note":
        return text(row.resolution_note);
      case "id":
        return text(row.id);
      default:
        return { kind: "empty" };
    }
  });
}

// ---------------------------------------------------------------------------
// Point adjustments
// ---------------------------------------------------------------------------

export type AdjustmentExportRow = {
  id: string;
  member_id: string;
  points: number;
  reason: string;
  category: string;
  event_id: string | null;
  term: string;
  awarded_by: string;
  awarded_at: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  members: { id: string; full_name: string } | null;
  events: { id: string; title: string } | null;
};

export const ADJUSTMENT_EXPORT_FIELDS: readonly ExportField[] = [
  { key: "awarded_date", label: "Awarded", kind: "date", source: "builtin" },
  { key: "awarded_time", label: "Time (CT)", kind: "text", source: "builtin" },
  { key: "member", label: "Member", kind: "text", source: "builtin" },
  { key: "points", label: "Points", kind: "number", source: "builtin" },
  { key: "category", label: "Category", kind: "text", source: "builtin" },
  { key: "reason", label: "Reason", kind: "text", source: "builtin" },
  { key: "term", label: "Term", kind: "text", source: "builtin" },
  { key: "officer", label: "Awarded by", kind: "text", source: "builtin" },
  { key: "event", label: "Event", kind: "text", source: "builtin" },
  // Not on the ledger screen as columns; a void is a fact an archive must keep.
  { key: "voided_date", label: "Voided", kind: "date", source: "builtin" },
  { key: "voided_by", label: "Voided by", kind: "text", source: "builtin" },
  { key: "void_reason", label: "Void reason", kind: "text", source: "builtin" },
  { key: "id", label: "Adjustment id", kind: "text", source: "builtin" },
];

/**
 * ⚠️ `voided_date` is in the DEFAULT set, and it has to be.
 *
 * The ledger's `state` filter defaults to `all`, so a default archive contains
 * voided adjustments — and without this column a voided +8 grant is
 * byte-identical to a live one. The screen distinguishes them with a
 * strikethrough; a file has no strikethrough, so the only honest options are
 * carrying the column or excluding voided rows, and excluding them would make
 * the archive disagree with the ledger it was exported from.
 *
 * Found by reading the first real export rather than by reasoning: the seed's
 * one voided grant came out looking exactly like the five live ones. The cost
 * is a column that is empty on most rows, which is the cheap side of this
 * trade — the same reasoning as `attendance_rate` rendering "—" rather than 0.
 */
export const ADJUSTMENT_DEFAULT_FIELDS: readonly string[] = [
  "awarded_date",
  "member",
  "points",
  "category",
  "reason",
  "term",
  "officer",
  "voided_date",
];

export function projectAdjustmentRow(
  row: AdjustmentExportRow,
  fields: readonly ExportField[],
  officers: Map<string, string | null>
): ExportCell[] {
  return fields.map((field): ExportCell => {
    switch (field.key) {
      case "awarded_date":
        return date(row.awarded_at);
      case "awarded_time":
        return centralTime(row.awarded_at);
      case "member":
        return text(row.members?.full_name ?? null);
      case "points":
        // 🪤 A raw NUMBER, never signedPoints(). That renders U+2212 MINUS
        // rather than ASCII hyphen — so `guardFormula` correctly ignores it
        // (it is not a formula lead) and Excel equally correctly refuses to
        // parse it as a number, leaving the whole column inert text that will
        // not sum. The typed ExportCell union exists precisely so a negative
        // adjustment stays a negative number here while a `-`-leading NAME
        // still gets escaped in CSV.
        return num(row.points);
      case "category":
        return text(formatPointCategory(row.category));
      case "reason":
        return text(row.reason);
      case "term":
        return text(row.term);
      case "officer":
        return text(describeOfficer(officers, row.awarded_by));
      case "event":
        return text(row.events?.title ?? null);
      case "voided_date":
        return date(row.voided_at);
      case "voided_by":
        return row.voided_by
          ? text(describeOfficer(officers, row.voided_by))
          : { kind: "empty" };
      case "void_reason":
        return text(row.void_reason);
      case "id":
        return text(row.id);
      default:
        return { kind: "empty" };
    }
  });
}

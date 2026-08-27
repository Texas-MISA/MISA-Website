// Roster export core (§7 Stage 6 phase 5). Pure — no next/* imports and no
// supabase-js — so Vitest drives it directly, the same contract as
// lib/filters.ts, lib/events.ts and lib/attendance.ts. Rows and a chosen field
// list in, a string out; the audit write and the response headers belong to the
// route handler, not here.
//
// ⚠️ There is no role check in this module, and none in the route handler that
// calls it. That is a decision (phase 5, 2026-08-05), not an omission, and it is
// written down so nobody re-adds a gate as an oversight. §9 settled four
// adjacent questions the same way — #6 any officer may approve, #9 no
// restriction on grant authority, #10 self-grants allowed and visible — on one
// shared premise: the audit log is the control, not a gate. Every export writes
// a receipt under entity type 'roster' carrying the filter, the chosen fields,
// the format and the row count, and that receipt IS the control. §6's "consider
// restricting it" was weighed, along with the one argument that genuinely does
// not apply to approving — a downloaded file outlives the session. It did not
// win: nothing in this codebase branches on admin_profiles.role, and this is not
// the thing to make it start. Changing that means changing §9, not this file.

import { toCentralFields } from "@/lib/events";
import { fieldValue, type FieldDefinition } from "@/lib/members";

/**
 * A projected cell, typed rather than stringified.
 *
 * 🔓 The reason this is a union and not `string` is the CSV formula guard. A
 * cell beginning `=`, `+`, `-` or `@` executes when an officer opens the file,
 * and member names are attacker-supplied — anyone who can check in during an
 * open window picks their own (§6). The guard therefore has to fire on text and
 * NOT on numbers, because `bonus_points` of `-5` is legitimately negative and
 * prefixing it would turn a number into the text `'-5`. Carrying the type this
 * far is what lets each writer make that distinction; a `string[][]` here would
 * have thrown it away one step too early.
 *
 * It is also what keeps xlsx honest — numbers land as numbers and dates as
 * dates, which is the entire reason to ship a workbook rather than a renamed
 * CSV (phase 5b).
 */
export type ExportCell =
  | { kind: "text"; value: string }
  | { kind: "number"; value: number }
  /** A fraction in 0..1 as `member_directory` stores it; writers scale it. */
  | { kind: "percent"; value: number }
  /** The raw PostgREST timestamp; writers convert to a Central civil date. */
  | { kind: "date"; value: string }
  | { kind: "empty" };

export type ExportCellKind = ExportCell["kind"];

export type ExportField = {
  /** The key as it appears in the URL and in the audit receipt. */
  key: string;
  /** The column header. */
  label: string;
  kind: ExportCellKind;
  source: "builtin" | "custom";
};

/**
 * The rows this module knows how to project — structurally typed, so the module
 * never imports the generated database types and a test can hand it a literal.
 * Every field is nullable because `member_directory` is a view and the generated
 * Row types every column as nullable.
 */
export type ExportSourceRow = {
  id: string | null;
  full_name: string | null;
  email: string | null;
  eid: string | null;
  term: string | null;
  source: string | null;
  joined_at: string | null;
  notes: string | null;
  total_points: number | null;
  attendance_points: number | null;
  bonus_points: number | null;
  events_attended: number | null;
  events_possible: number | null;
  attendance_rate: number | null;
  pending_count: number | null;
  last_seen_at: string | null;
  dues_paid_term: boolean | null;
  custom_fields: unknown;
};

/**
 * A hard ceiling on how many rows one export may carry.
 *
 * ⚠️ It REFUSES; it never truncates. That is the `grantPoints` rule ("an
 * oversized selection must be refused, never truncated to the cap, which is the
 * same bug wearing a different hat") and the reverse of the silent-cap class
 * this codebase already carries two of. A truncated export is a partial email
 * list that looks complete, which is the exact failure §7 asks this screen to
 * make impossible.
 *
 * Sized against §2.2's 500-member worst case with an order of magnitude spare.
 * The real ceiling above it is Vercel's 4.5 MB non-streaming response limit
 * (checked 2026-08-05, not assumed) — an xlsx is a zip buffered whole, so there
 * is no streaming path worth having, and 5,000 rows of ~15 columns stays far
 * under it. Re-read both numbers together before raising either.
 */
export const MAX_EXPORT_ROWS = 5000;

/**
 * The built-in half of the field catalogue.
 *
 * Every key here is in `RESERVED_FIELD_KEYS` (lib/members.ts) and in migration
 * 18's `member_field_definitions_key_not_builtin` CHECK, which is what makes the
 * catalogue ONE namespace: a custom field structurally cannot claim `email`, so
 * the picker, the CSV header and the xlsx header can never have two columns
 * competing for a name. That is a different guard from the `cf:` sort prefix,
 * which exists so a custom field cannot shadow a built-in *sort* — and the
 * prefix deliberately does NOT appear here. A catalogue key is bare.
 *
 * Order is the order columns come out in, so the header row is stable no matter
 * what order the officer ticked the boxes in.
 */
const BUILTIN_FIELDS: readonly ExportField[] = [
  { key: "name", label: "Name", kind: "text", source: "builtin" },
  { key: "email", label: "Email", kind: "text", source: "builtin" },
  { key: "eid", label: "EID", kind: "text", source: "builtin" },
  { key: "total_points", label: "Total points", kind: "number", source: "builtin" },
  { key: "attendance_points", label: "Attendance points", kind: "number", source: "builtin" },
  { key: "bonus_points", label: "Bonus points", kind: "number", source: "builtin" },
  { key: "events_attended", label: "Events attended", kind: "number", source: "builtin" },
  { key: "events_possible", label: "Events possible", kind: "number", source: "builtin" },
  // Labelled "(%)" because both writers emit the scaled integer rather than the
  // stored fraction — see percentCell() below for why the two agree.
  { key: "attendance_rate", label: "Attendance rate (%)", kind: "percent", source: "builtin" },
  { key: "pending_count", label: "Pending submissions", kind: "number", source: "builtin" },
  { key: "last_seen_at", label: "Last seen", kind: "date", source: "builtin" },
  { key: "joined_at", label: "Joined", kind: "date", source: "builtin" },
  // ⚠️ Replaced "Active" on 2026-08-25, when members.active was dropped. It is
  // not a like-for-like swap: this names the SEMESTER the row's points,
  // attendance, rate and dues belong to, so a saved file can still be read a
  // year later. Every export carries it whether or not the officer ticked it —
  // see exportedFields, which records what actually left.
  { key: "term", label: "Term", kind: "text", source: "builtin" },
  { key: "source", label: "Source", kind: "text", source: "builtin" },
  // Stage 6.5 phase 4 — ONE catalogue entry, not a new mechanism. `dues` is
  // already reserved (RESERVED_FIELD_KEYS, and migration 19's
  // member_field_definitions_key_not_builtin CHECK), so a custom field
  // structurally cannot claim the name and the catalogue stays one namespace.
  // It is also how the filter param and the sort key spell it, so all three
  // agree.
  { key: "dues", label: "Dues", kind: "text", source: "builtin" },
  { key: "notes", label: "Officer notes", kind: "text", source: "builtin" },
];

/**
 * What an export selects when the officer has not chosen.
 *
 * The four displayed columns plus email. Deliberately not "everything": the
 * picker exists for the officer who wants names and shirt sizes and nothing
 * else, and defaulting narrow is a §6 PII mitigation rather than only a
 * convenience — notes and EIDs leave the building only when asked for.
 */
export const DEFAULT_EXPORT_FIELDS: readonly string[] = [
  "name",
  "email",
  "eid",
  "total_points",
];

/**
 * The formats the export serves.
 *
 * Lives here rather than in the route because which columns a format actually
 * emits is a domain fact, and `exportedFields` below turns on it. `xlsx` is
 * first because it is the default the toolbar offers — CSV stays beside it as
 * the format that keeps working if the xlsx writer is ever pulled.
 */
export const EXPORT_FORMATS = ["xlsx", "csv", "tsv", "emails", "names"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export function isExportFormat(value: string): value is ExportFormat {
  return (EXPORT_FORMATS as readonly string[]).includes(value);
}

/**
 * The fields a format actually emits, which is not always what was ticked.
 *
 * The clipboard's `emails` and `names` formats emit exactly one column each
 * regardless of the picker. The audit receipt has to record THIS, not the
 * picker's selection: logging four fields for an email copy answers §6's "what
 * left the building?" with a superset, and a receipt that over-reports is one
 * nobody can reason from later. Erring wide is still erring.
 *
 * A decision, so it lives in the pure core and is tested here rather than
 * inferred from the route — the same reason planBulkAssign is not inside
 * bulkAssignEvent.
 */
export function exportedFields(
  format: ExportFormat,
  chosen: readonly ExportField[]
): string[] {
  if (format === "emails") return ["email"];
  if (format === "names") return ["name"];
  return chosen.map((field) => field.key);
}

/**
 * The full catalogue: built-ins, then every live custom field.
 *
 * Archived definitions are excluded because a column nobody can see in the
 * directory is a column nobody can audit in a file either — the same reasoning
 * that keeps an archived field out of `sortColumn`. Callers pass the list from
 * `fetchFieldDefinitions(db)`, which already filters archived by default; the
 * belt-and-braces filter here means a caller passing `includeArchived` cannot
 * widen the export by accident.
 */
export function exportCatalogue(
  definitions: readonly FieldDefinition[]
): ExportField[] {
  const custom = definitions
    .filter((definition) => definition.archivedAt === null)
    .map(
      (definition): ExportField => ({
        key: definition.key,
        label: definition.label,
        kind: "text",
        source: "custom",
      })
    );
  return [...BUILTIN_FIELDS, ...custom];
}

/**
 * Turn whatever the URL carried into a field list.
 *
 * Total, like `parseMemberFilter`: an unknown key is ignored rather than an
 * error, an empty or absent selection falls back to the defaults, and duplicates
 * collapse. Accepts a comma-separated value or repeated params, because a URL
 * built by hand and one built by the toolbar should mean the same thing.
 *
 * Output is in CATALOGUE order, never in the order the keys arrived. The header
 * row is then a function of the catalogue alone, so two officers exporting the
 * same fields get byte-identical headers and a saved preset (phase 7) cannot
 * scramble them.
 */
export function parseFieldSelection(
  raw: string | string[] | undefined | null,
  catalogue: readonly ExportField[],
  // 📌 Parameterized in Stage 8 phase 2, when the attendance and adjustment
  // archives became a second and third caller with their own catalogues. It
  // defaults to the member list so no existing caller changes, but a ledger
  // export passing the member defaults would fall back to a set of keys its
  // catalogue does not contain — and `chosen.length > 0` would then be false
  // for a request that named nothing, yielding an empty file rather than a
  // sensible default.
  defaults: readonly string[] = DEFAULT_EXPORT_FIELDS
): ExportField[] {
  const requested = new Set(
    (Array.isArray(raw) ? raw : [raw ?? ""])
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
  );

  const chosen = catalogue.filter((field) => requested.has(field.key));
  if (chosen.length > 0) return chosen;

  return catalogue.filter((field) => defaults.includes(field.key));
}

/**
 * One database row and a chosen field list → the cells for that row.
 *
 * The single place a stored value becomes a cell, so CSV and xlsx cannot
 * disagree about what a row contains — only about how to write it.
 */
export function projectRow(
  row: ExportSourceRow,
  fields: readonly ExportField[]
): ExportCell[] {
  return fields.map((field) =>
    field.source === "custom"
      ? textCell(fieldValue(row.custom_fields, field.key))
      : builtinCell(row, field.key)
  );
}

function builtinCell(row: ExportSourceRow, key: string): ExportCell {
  switch (key) {
    case "name":
      return textCell(row.full_name);
    case "email":
      return textCell(row.email);
    case "eid":
      return textCell(row.eid);
    case "total_points":
      return numberCell(row.total_points);
    case "attendance_points":
      return numberCell(row.attendance_points);
    case "bonus_points":
      return numberCell(row.bonus_points);
    case "events_attended":
      return numberCell(row.events_attended);
    case "events_possible":
      return numberCell(row.events_possible);
    case "attendance_rate":
      return percentCell(row.attendance_rate);
    case "pending_count":
      return numberCell(row.pending_count);
    case "last_seen_at":
      return dateCell(row.last_seen_at);
    case "joined_at":
      return dateCell(row.joined_at);
    case "term":
      return textCell(row.term);
    case "source":
      return textCell(row.source);
    case "dues":
      // ⚠️ Text, and the same two words the directory prints — so a spreadsheet
      // and the screen cannot be read as saying different things. Not a number
      // and not a bare boolean: the CSV formula guard fires on text and must
      // never fire on numbers, and "Paid" / "Not Paid" trip none of `= + - @`.
      return row.dues_paid_term === null
        ? { kind: "empty" }
        : {
            kind: "text",
            value: row.dues_paid_term ? "Paid" : "Not Paid",
          };
    case "notes":
      return textCell(row.notes);
    default:
      // Unreachable while the catalogue and this switch agree. An empty cell is
      // the safe wrong answer: a missing column beats an invented value.
      return { kind: "empty" };
  }
}

function textCell(value: string | null | undefined): ExportCell {
  if (value === null || value === undefined || value === "") {
    return { kind: "empty" };
  }
  return { kind: "text", value };
}

function numberCell(value: number | null): ExportCell {
  return value === null ? { kind: "empty" } : { kind: "number", value };
}

/**
 * ⚠️ A null `attendance_rate` is an EMPTY cell and never `0`.
 *
 * §4.5's rule does not stop at the screen. The view leaves the rate null when
 * the term has no completed events, and a member who attended nothing is a real
 * `0` — collapsing the two puts every member at the bottom of the officer's
 * sorted spreadsheet at the start of every semester, which is the same defect
 * `formatAttendanceRate` renders as "—".
 */
function percentCell(rate: number | null): ExportCell {
  return rate === null ? { kind: "empty" } : { kind: "percent", value: rate };
}

function dateCell(at: string | null): ExportCell {
  return at === null ? { kind: "empty" } : { kind: "date", value: at };
}

/**
 * A date cell as a Central civil date.
 *
 * ⚠️ Not `iso.slice(0, 10)`. These are `timestamptz`, the server runs in UTC,
 * and a member who joined at 8pm Central shows up on the following day under a
 * naive slice — the same class of plausible-but-wrong result as
 * `new Date("2026-09-01T18:00")`, and it would be wrong for exactly the members
 * who signed up at an evening event. `toCentralFields` is the existing answer
 * and is shared with every other date in the app.
 */
export function exportDate(iso: string): string {
  return toCentralFields(iso).date;
}

/** A percent cell as the integer both writers emit. */
export function exportPercent(rate: number): number {
  return Math.round(rate * 100);
}

/**
 * 🔓 Characters that make a spreadsheet treat a cell as a formula.
 *
 * Tab and carriage return are in here alongside the obvious four because Excel
 * strips leading whitespace before deciding, so `\t=cmd` is still a formula.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * 🔓 Neutralise a text cell that would otherwise execute.
 *
 * Exported for the tests, which assert both halves of the rule: that a name
 * beginning `=` IS guarded, and that a negative NUMBER is not — the guard is
 * applied per cell kind by `csvCell` below and must never be moved to a single
 * "escape everything" pass. The victim here is the officer's machine, not the
 * server (§6).
 */
export function guardFormula(value: string): string {
  return FORMULA_LEAD.test(value) ? `'${value}` : value;
}

/** RFC 4180 quoting, applied after the formula guard. */
function quoteCsv(value: string): string {
  return /["\r\n,]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** One cell as CSV text. The formula guard fires on `text` only. */
function csvCell(cell: ExportCell): string {
  switch (cell.kind) {
    case "empty":
      return "";
    case "number":
      return String(cell.value);
    case "percent":
      return String(exportPercent(cell.value));
    case "date":
      return exportDate(cell.value);
    case "text":
      return quoteCsv(guardFormula(cell.value));
  }
}

/**
 * The CSV file.
 *
 * CRLF line endings per RFC 4180, which is also what Excel expects. The writer
 * is pure string formatting with no dependency, deliberately: this is the format
 * that keeps working if the xlsx writer is ever pulled.
 */
export function toCsv(
  fields: readonly ExportField[],
  rows: readonly ExportCell[][]
): string {
  const header = fields.map((field) => quoteCsv(field.label)).join(",");
  const body = rows.map((cells) => cells.map(csvCell).join(","));
  return [header, ...body].join("\r\n");
}

/**
 * The clipboard's tab-separated form, for pasting straight into a spreadsheet.
 *
 * The formula guard is deliberately NOT applied: this lands in a cell the
 * officer is already looking at, in a sheet they already control, and a paste
 * that silently gains apostrophes would be the surprising outcome. Tabs and
 * newlines inside a value are stripped, because TSV has no quoting to escape
 * them with and a stray tab would silently shift every later column.
 */
export function toTsv(
  fields: readonly ExportField[],
  rows: readonly ExportCell[][]
): string {
  const flatten = (cell: ExportCell): string => {
    switch (cell.kind) {
      case "empty":
        return "";
      case "number":
        return String(cell.value);
      case "percent":
        return String(exportPercent(cell.value));
      case "date":
        return exportDate(cell.value);
      case "text":
        return cell.value.replace(/[\t\r\n]+/g, " ");
    }
  };
  const header = fields.map((field) => field.label).join("\t");
  const body = rows.map((cells) => cells.map(flatten).join("\t"));
  return [header, ...body].join("\n");
}

/**
 * Emails, comma-separated and ready for a To: field.
 *
 * Members with no email on file are skipped rather than emitted as blanks — an
 * empty address in a To: field is a bounce. The count the officer is shown must
 * therefore be the length of THIS list, not the number of rows selected, which
 * is why the caller counts what came back instead of what it asked for.
 */
export function toEmailList(rows: readonly ExportSourceRow[]): string {
  return rows
    .map((row) => row.email)
    .filter((email): email is string => typeof email === "string" && email !== "")
    .join(", ");
}

/** Names, one per line. Same skip-the-blanks rule as toEmailList. */
export function toNameList(rows: readonly ExportSourceRow[]): string {
  return rows
    .map((row) => row.full_name)
    .filter((name): name is string => typeof name === "string" && name !== "")
    .join("\n");
}

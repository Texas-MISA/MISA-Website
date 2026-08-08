// Roster CSV import (§7 Stage 6 phase 7b). Pure — no next/* imports, no
// supabase-js, no clock reads — so Vitest calls every export directly, the same
// contract as lib/events.ts, lib/attendance.ts, lib/dues.ts and lib/members.ts.
// Anything request-shaped belongs in app/actions/member-import.ts.
//
// The job: turn a spreadsheet into rows the roster can accept, and decide as
// little as possible on the way. Three rules, each carried over from an existing
// importer rather than invented here:
//
//   * It CREATES ONLY. A row matching somebody already on the roster is counted,
//     shown, and never written. A stale spreadsheet must not be able to
//     overwrite a name or an email an officer has corrected, and create-only is
//     what makes re-importing the same file a no-op.
//   * It never guesses. An `active` cell that is not recognisably yes or no
//     makes the row invalid rather than defaulting; a custom-field value that is
//     not one of the definition's options does the same.
//   * It never drops anything silently. Every row of the file comes back with an
//     outcome, and every column the importer ignored is named — so the numbers
//     on the preview add up to the file the officer uploaded.

import { normalizeEid } from "@/lib/checkin";
import { parseCsv } from "@/lib/csv";
import { exportCatalogue, type ExportField } from "@/lib/export";
import { isAllowedFieldValue, type FieldDefinition } from "@/lib/members";

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

/**
 * How much CSV text one import may carry.
 *
 * ⚠️ Deliberately BELOW Next's own 1MB Server Action body cap, so an officer who
 * overshoots gets a sentence naming the limit rather than an opaque framework
 * error. Sized and justified exactly as `MAX_IMPORT_BYTES` in lib/dues.ts, and
 * kept as its own constant rather than shared: the two limits answer to
 * different files and coupling them would make a change to one silently move the
 * other.
 *
 * Refuses; never truncates. Importing the first N bytes of a roster would cut a
 * row in half and silently drop everyone after it.
 */
export const MAX_ROSTER_IMPORT_BYTES = 512 * 1024;

/**
 * How many rows one import may carry.
 *
 * Four times §2.2's 500-member worst case. Same rule as `MAX_EXPORT_ROWS` and
 * `MAX_IMPORT_ROWS`: it refuses loudly, because a partial import reported as
 * success is a person who is not on the roster and nobody knows it.
 */
export const MAX_ROSTER_IMPORT_ROWS = 2000;

/** Mirrors the `members_email_not_blank` check and the column's real ceiling. */
const MAX_EMAIL_LENGTH = 254;
/** Mirrors `checkinSchema`'s bound. */
const MAX_EID_LENGTH = 32;
const MAX_NAME_LENGTH = 120;

/**
 * The shortest EID that may be imported, in normalized characters.
 *
 * The same floor `lib/validation.ts` applies to a check-in, and for the same
 * reason: a value of punctuation alone normalizes to nothing, which would
 * collide every such row into one phantom identity.
 */
const MIN_EID_LENGTH = 3;

// ---------------------------------------------------------------------------
// Which columns an import understands
// ---------------------------------------------------------------------------

/**
 * The importable subset of the export's field catalogue.
 *
 * 📌 Built FROM `exportCatalogue` rather than listed here, and that is the most
 * load-bearing reuse in the phase. The export writes each field's **label** as
 * its header, so an officer can download the roster, edit it in Excel, and
 * import it back — and because migration 18's `key_not_builtin` CHECK already
 * guarantees the catalogue is one namespace, a custom field structurally cannot
 * claim `Email` and produce two columns competing for one header.
 *
 * Everything else in the catalogue is a CALCULATED column — total points,
 * attendance rate, dues, joined, last seen — which an import must not pretend to
 * set. Those are ignored rather than rejected, because a round-tripped export
 * legitimately contains them; `planRosterImport` names them so the officer can
 * see they were skipped.
 *
 * `notes` is deliberately absent too, though it is storable: it is free text
 * with no validation, and bulk-overwriting officer notes from a spreadsheet is
 * the create-only rule's spirit broken through a side door.
 */
const IMPORTABLE_BUILTINS = ["name", "email", "eid", "active"] as const;

export type ImportColumn = ExportField & {
  /** A row missing this cannot be imported at all. */
  required: boolean;
};

export function importColumns(
  definitions: readonly FieldDefinition[]
): ImportColumn[] {
  return exportCatalogue(definitions)
    .filter(
      (field) =>
        field.source === "custom" ||
        (IMPORTABLE_BUILTINS as readonly string[]).includes(field.key)
    )
    .map((field) => ({
      ...field,
      // The three NOT NULL columns on `members`. `active` has a default and
      // every custom field is optional by nature.
      required: field.key === "name" || field.key === "email" || field.key === "eid",
    }));
}

/**
 * Fold a header cell for comparison: trim, collapse runs of whitespace, lower.
 *
 * Not a strict equality, because a header survives a round trip through Excel
 * and a human. What it does NOT do is guess at near-misses — "Emails" is not
 * "Email", and silently accepting it would put addresses in whatever column
 * happened to be closest.
 */
function foldHeader(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

export type HeaderMatch = {
  /** Column key → index in the row. */
  mapped: Map<string, number>;
  /** Headers the importer does not set, in file order — calculated columns from
   * a round-tripped export, or anything else the officer left in. */
  ignored: string[];
  /** Required columns with no header. Non-empty means the file is unusable. */
  missing: string[];
};

/**
 * Locate each importable column in the header row.
 *
 * ⚠️ **By name, never by position.** The same rule the Venmo parser follows and
 * for the same reason: a reordered export must not silently shift every value
 * one column to the left, which produces a roster of plausible-looking rows with
 * the wrong data in every field. A column the importer cannot find is missing,
 * not assumed.
 *
 * Both the label and the bare key are accepted. The label is what the export
 * writes; the key is what somebody building a file by hand from the docs would
 * reach for, and the two cannot collide because a catalogue key is a lowercase
 * identifier and a label is officer-written prose.
 */
export function matchHeaders(
  header: readonly string[],
  columns: readonly ImportColumn[]
): HeaderMatch {
  const byName = new Map<string, string>();
  for (const column of columns) {
    byName.set(foldHeader(column.label), column.key);
    byName.set(foldHeader(column.key), column.key);
  }

  const mapped = new Map<string, number>();
  const ignored: string[] = [];

  header.forEach((cell, index) => {
    const trimmed = cell.trim();
    // A leading empty column is what a real Venmo export has; a trailing one is
    // what a spreadsheet leaves behind. Neither is a column anybody named.
    if (trimmed === "") return;

    const key = byName.get(foldHeader(cell));
    // First wins. A file with two "Email" columns is ambiguous, and taking the
    // first is at least deterministic — the second is reported as ignored, so
    // the duplication is visible rather than silent.
    if (key !== undefined && !mapped.has(key)) {
      mapped.set(key, index);
    } else {
      ignored.push(trimmed);
    }
  });

  const missing = columns
    .filter((column) => column.required && !mapped.has(column.key))
    .map((column) => column.label);

  return { mapped, ignored, missing };
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

/** Why a row cannot be imported. One reason per row — the first found, because
 * a list of six complaints about one line is not more actionable than one. */
export type InvalidReason =
  | { kind: "missing"; column: string }
  | { kind: "eid_too_short" }
  | { kind: "too_long"; column: string }
  | { kind: "bad_active"; value: string }
  | { kind: "not_an_option"; column: string; value: string };

export type RowOutcome =
  /** Will be inserted. The only outcome that writes. */
  | { kind: "new" }
  /**
   * Already on the roster. Carries WHICH axis matched, because "your new person
   * is already here under a different EID" is the case an officer needs to see —
   * it is usually a typo in the spreadsheet, not a duplicate row.
   */
  | { kind: "existing"; on: "eid" | "email" }
  /** Collides with an earlier row of the SAME file, on either axis. */
  | { kind: "duplicate_in_file"; on: "eid" | "email"; firstLine: number }
  | { kind: "invalid"; reason: InvalidReason };

export type PlannedMember = {
  /** 1-based line in the file, for an officer reading it beside a spreadsheet.
   * Counts the header, so it matches what Excel shows in the row gutter. */
  line: number;
  eid: string;
  fullName: string;
  email: string;
  active: boolean;
  /** Keyed by definition key. A key is ABSENT when the cell was empty — never
   * `""`, so "cleared" and "never answered" stay one state (the setFieldValue
   * rule, and §4.5's null-is-not-zero in a new place). */
  customFields: Record<string, string>;
  outcome: RowOutcome;
};

export type ImportCounts = {
  /** Rows that would be inserted. */
  fresh: number;
  /** Rows whose person is already on the roster. */
  existing: number;
  /** Rows duplicating an earlier row of the same file. */
  duplicate: number;
  /** Rows that cannot be imported as written. */
  invalid: number;
};

export type RosterPlan =
  | { kind: "empty" }
  | { kind: "too_many"; rows: number }
  | { kind: "no_header"; missing: string[] }
  | {
      kind: "ok";
      rows: PlannedMember[];
      counts: ImportCounts;
      ignoredColumns: string[];
    };

/** One roster member as the matcher needs them — structurally typed so this
 * module never imports supabase-js, matching FilterableQuery in lib/filters.ts.
 * `RosterIdentity` from lib/roster-index.ts is assignable to it. */
export type ExistingMember = {
  normalizedEid: string;
  emailLower: string;
};

/**
 * Parse, validate and classify — the work the preview and the commit share.
 *
 * Returns the planned rows rather than writing them, so `commitRosterImport`
 * runs the identical code path the preview did and cannot diverge from what the
 * officer was shown. Same shape, and the same reason, as `planImport` in
 * app/actions/dues.ts.
 */
export function planRosterImport({
  csv,
  definitions,
  roster,
}: {
  csv: string;
  definitions: readonly FieldDefinition[];
  roster: readonly ExistingMember[];
}): RosterPlan {
  const columns = importColumns(definitions);
  const table = parseCsv(csv).filter((row) =>
    row.some((cell) => cell.trim() !== "")
  );

  if (table.length < 2) return { kind: "empty" };

  const [header, ...body] = table;
  const headers = matchHeaders(header, columns);
  if (headers.missing.length > 0) {
    return { kind: "no_header", missing: headers.missing };
  }

  // Refuses; never truncates. Importing the first N of a roster would be a
  // partial write reported as success.
  if (body.length > MAX_ROSTER_IMPORT_ROWS) {
    return { kind: "too_many", rows: body.length };
  }

  const byEid = new Map<string, "roster" | number>();
  const byEmail = new Map<string, "roster" | number>();
  for (const member of roster) {
    byEid.set(member.normalizedEid, "roster");
    if (member.emailLower) byEmail.set(member.emailLower, "roster");
  }

  const customColumns = columns.filter((column) => column.source === "custom");
  const rows: PlannedMember[] = [];

  body.forEach((cells, index) => {
    // +2: one for the header, one because spreadsheets are 1-based.
    const line = index + 2;
    const cell = (key: string) => {
      const at = headers.mapped.get(key);
      return at === undefined ? "" : (cells[at] ?? "").trim();
    };

    const eid = cell("eid").slice(0, MAX_EID_LENGTH * 2);
    const fullName = cell("name");
    const email = cell("email");

    const planned = {
      line,
      eid,
      fullName,
      email,
      active: true,
      customFields: {} as Record<string, string>,
    };

    const invalid = (reason: InvalidReason): void => {
      rows.push({ ...planned, outcome: { kind: "invalid", reason } });
    };

    if (fullName === "") return invalid({ kind: "missing", column: "Name" });
    if (email === "") return invalid({ kind: "missing", column: "Email" });
    if (eid === "") return invalid({ kind: "missing", column: "EID" });

    if (fullName.length > MAX_NAME_LENGTH) {
      return invalid({ kind: "too_long", column: "Name" });
    }
    if (email.length > MAX_EMAIL_LENGTH) {
      return invalid({ kind: "too_long", column: "Email" });
    }
    if (eid.length > MAX_EID_LENGTH) {
      return invalid({ kind: "too_long", column: "EID" });
    }

    const normalizedEid = normalizeEid(eid);
    if (normalizedEid.length < MIN_EID_LENGTH) {
      return invalid({ kind: "eid_too_short" });
    }

    const rawActive = cell("active");
    const active = parseActive(rawActive);
    if (active === null) {
      return invalid({ kind: "bad_active", value: rawActive });
    }
    planned.active = active;

    for (const column of customColumns) {
      const value = cell(column.key);
      // ⚠️ An empty cell means the key is ABSENT, never `""`. An empty string
      // would make "cleared" and "never answered" two states that render
      // identically and sort differently.
      if (value === "") continue;

      const definition = definitions.find((d) => d.key === column.key);
      // ⚠️ A value the definition does not offer makes the ROW invalid rather
      // than importing the member with the field blank. Silently dropping it
      // would discard data the officer's file plainly specified, and nobody
      // would notice — the preview is where a typo'd size gets fixed.
      if (!definition || !isAllowedFieldValue(definition, value)) {
        return invalid({
          kind: "not_an_option",
          column: column.label,
          value,
        });
      }
      planned.customFields[column.key] = value;
    }

    const emailLower = email.toLowerCase();

    // ⚠️ Both axes, and the file checked against ITSELF as well as the roster.
    // `members` carries two unique indexes, so a row is a duplicate if it
    // collides on either — and the "a pre-flight must dedupe within the
    // selection too" invariant applies just as hard to a file naming the same
    // person twice as it does to a bulk action over existing rows.
    const eidHit = byEid.get(normalizedEid);
    const emailHit = byEmail.get(emailLower);

    if (eidHit === "roster") {
      rows.push({ ...planned, outcome: { kind: "existing", on: "eid" } });
      return;
    }
    if (emailHit === "roster") {
      rows.push({ ...planned, outcome: { kind: "existing", on: "email" } });
      return;
    }
    if (typeof eidHit === "number") {
      rows.push({
        ...planned,
        outcome: { kind: "duplicate_in_file", on: "eid", firstLine: eidHit },
      });
      return;
    }
    if (typeof emailHit === "number") {
      rows.push({
        ...planned,
        outcome: { kind: "duplicate_in_file", on: "email", firstLine: emailHit },
      });
      return;
    }

    // Only a row that will actually be written claims its identity, so a second
    // copy of an invalid row is reported as invalid too rather than as its
    // duplicate — the officer fixes one problem, not a cascade.
    byEid.set(normalizedEid, line);
    byEmail.set(emailLower, line);
    rows.push({ ...planned, outcome: { kind: "new" } });
  });

  return {
    kind: "ok",
    rows,
    counts: countOutcomes(rows),
    ignoredColumns: headers.ignored,
  };
}

export function countOutcomes(rows: readonly PlannedMember[]): ImportCounts {
  const counts: ImportCounts = { fresh: 0, existing: 0, duplicate: 0, invalid: 0 };
  for (const row of rows) {
    if (row.outcome.kind === "new") counts.fresh++;
    else if (row.outcome.kind === "existing") counts.existing++;
    else if (row.outcome.kind === "duplicate_in_file") counts.duplicate++;
    else counts.invalid++;
  }
  return counts;
}

/**
 * An `active` cell as a boolean, or null for "not recognisable".
 *
 * Lenient about spelling because officers type what they like into a
 * spreadsheet, and strict about everything else: an unrecognised value returns
 * null and invalidates the row rather than defaulting to active. Guessing here
 * would silently reinstate somebody the officer meant to archive, and a wrongly
 * active member shows up on the roster and in every count.
 *
 * Empty means "not stated", which is the column default.
 */
export function parseActive(raw: string): boolean | null {
  const value = raw.trim().toLowerCase();
  if (value === "") return true;
  if (["yes", "y", "true", "t", "1", "active"].includes(value)) return true;
  if (["no", "n", "false", "f", "0", "inactive"].includes(value)) return false;
  return null;
}

/** A one-line explanation of an outcome, for the preview table. Here rather
 * than in the component so it is testable and so the two never disagree. */
export function describeOutcome(outcome: RowOutcome): string {
  switch (outcome.kind) {
    case "new":
      return "Will be added";
    case "existing":
      return outcome.on === "eid"
        ? "Already on the roster (same EID)"
        : "Already on the roster (same email)";
    case "duplicate_in_file":
      return outcome.on === "eid"
        ? `Same EID as line ${outcome.firstLine}`
        : `Same email as line ${outcome.firstLine}`;
    case "invalid":
      return describeInvalid(outcome.reason);
  }
}

function describeInvalid(reason: InvalidReason): string {
  switch (reason.kind) {
    case "missing":
      return `${reason.column} is empty`;
    case "eid_too_short":
      return "That EID is too short to be real";
    case "too_long":
      return `${reason.column} is too long`;
    case "bad_active":
      return `“${reason.value}” is not yes or no`;
    case "not_an_option":
      return `“${reason.value}” is not an option for ${reason.column}`;
  }
}

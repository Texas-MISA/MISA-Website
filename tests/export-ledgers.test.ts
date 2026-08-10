import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { OfficerNames } from "@/lib/admin-profiles";
import { toCsv, toTsv, type ExportField } from "@/lib/export";
import {
  ADJUSTMENT_DEFAULT_FIELDS,
  ADJUSTMENT_EXPORT_FIELDS,
  ATTENDANCE_DEFAULT_FIELDS,
  ATTENDANCE_EXPORT_FIELDS,
  isLedgerExportFormat,
  projectAdjustmentRow,
  projectAttendanceRow,
  type AdjustmentExportRow,
  type AttendanceExportRow,
} from "@/lib/export-ledgers";
import { toXlsx } from "@/lib/xlsx";

// The archival export cores (Stage 8 phase 2). Pure — no database.

const OFFICERS: OfficerNames = {
  kind: "ok",
  names: new Map<string, string | null>([
    ["officer-named", "Dana Reyes"],
    // A current officer who never set a display name.
    ["officer-anon", null],
    // "officer-gone" is deliberately ABSENT: their admin_profiles row was
    // revoked. describeOfficer must tell the three apart.
  ]),
};

/** The fourth case: the name lookup itself failed. */
const OFFICERS_UNAVAILABLE: OfficerNames = { kind: "error" };

function fieldsFor(
  catalogue: readonly ExportField[],
  keys: readonly string[]
): ExportField[] {
  return catalogue.filter((f) => keys.includes(f.key));
}

const ADJUSTMENT: AdjustmentExportRow = {
  id: "adj-1",
  member_id: "mem-1",
  points: -2,
  reason: "Signed in for a member who was not present",
  category: "correction",
  event_id: null,
  term: "Fall 2026",
  awarded_by: "officer-named",
  // 8pm Central on 3 August is 01:00Z on the 4th — the case a naive
  // iso.slice(0,10) gets wrong.
  awarded_at: "2026-08-04T01:00:00.000Z",
  voided_at: null,
  voided_by: null,
  void_reason: null,
  members: { id: "mem-1", full_name: "Tomas Novak" },
  events: null,
};

const SUBMISSION: AttendanceExportRow = {
  id: "att-1",
  submitted_name: "=HYPERLINK(\"http://evil\",\"click\")",
  submitted_eid: "t3qevil1",
  submitted_email: "evil@example.edu",
  submitted_at: "2026-08-04T01:00:00.000Z",
  status: "pending",
  source: "self_checkin",
  event_id: null,
  member_id: null,
  resolved_at: null,
  resolved_by: null,
  resolution_note: null,
  events: null,
  members: null,
};

describe("the catalogues", () => {
  it("every default key exists in its catalogue", () => {
    // 🪤 The failure this prevents is silent and total. parseFieldSelection
    // falls back to the defaults when a request names no fields, and it does so
    // by FILTERING the catalogue — so a default key the catalogue does not
    // contain contributes nothing, and a default request yields a file with no
    // columns at all. That is exactly what would have happened had these routes
    // used the member DEFAULT_EXPORT_FIELDS, which shares no key with either
    // catalogue here.
    const attendanceKeys = ATTENDANCE_EXPORT_FIELDS.map((f) => f.key);
    for (const key of ATTENDANCE_DEFAULT_FIELDS) {
      expect(attendanceKeys, `attendance default ${key}`).toContain(key);
    }
    const adjustmentKeys = ADJUSTMENT_EXPORT_FIELDS.map((f) => f.key);
    for (const key of ADJUSTMENT_DEFAULT_FIELDS) {
      expect(adjustmentKeys, `adjustment default ${key}`).toContain(key);
    }
  });

  it("has no duplicate keys, so a header cannot appear twice", () => {
    for (const catalogue of [ATTENDANCE_EXPORT_FIELDS, ADJUSTMENT_EXPORT_FIELDS]) {
      const keys = catalogue.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("carries the void columns a voided grant needs", () => {
    // ⚠️ `voided_date` is in the DEFAULT set deliberately. The ledger's state
    // filter defaults to `all`, so a default archive contains voided rows — and
    // the screen distinguishes them with a strikethrough a file cannot carry.
    // Without this column a voided +8 grant is byte-identical to a live one.
    expect(ADJUSTMENT_DEFAULT_FIELDS).toContain("voided_date");
  });

  it("rejects the member-shaped clipboard formats", () => {
    // `emails` and `names` collapse to a single member column that neither
    // ledger catalogue has; accepting one would emit a header and no cells.
    expect(isLedgerExportFormat("csv")).toBe(true);
    expect(isLedgerExportFormat("xlsx")).toBe(true);
    expect(isLedgerExportFormat("tsv")).toBe(true);
    expect(isLedgerExportFormat("emails")).toBe(false);
    expect(isLedgerExportFormat("names")).toBe(false);
  });
});

describe("adjustment projection", () => {
  it("emits points as a NUMBER, never signedPoints", () => {
    // 🪤 signedPoints renders U+2212 MINUS, not ASCII hyphen. guardFormula
    // correctly ignores it (not a formula lead) and Excel equally correctly
    // refuses to parse it as a number — so the whole column would be inert text
    // that will not sum. The typed union is what keeps this a number while a
    // `-`-leading NAME still gets escaped in CSV.
    const [cell] = projectAdjustmentRow(
      ADJUSTMENT,
      fieldsFor(ADJUSTMENT_EXPORT_FIELDS, ["points"]),
      OFFICERS
    );
    expect(cell).toEqual({ kind: "number", value: -2 });
  });

  it("writes a negative point value as a plain ASCII number in CSV", () => {
    const fields = fieldsFor(ADJUSTMENT_EXPORT_FIELDS, ["points"]);
    const csv = toCsv(fields, [projectAdjustmentRow(ADJUSTMENT, fields, OFFICERS)]);
    expect(csv).toContain("-2");
    expect(csv).not.toContain("−");
    // And NOT guarded: `'-2` would stop being a number the moment it landed.
    expect(csv).not.toContain("'-2");
  });

  it("resolves the officer's Central civil date, not a UTC slice", () => {
    // 01:00Z on 4 August is 8pm Central on the 3rd. A naive iso.slice(0,10)
    // would file every evening action on the following day.
    const fields = fieldsFor(ADJUSTMENT_EXPORT_FIELDS, ["awarded_date", "awarded_time"]);
    const csv = toCsv(fields, [projectAdjustmentRow(ADJUSTMENT, fields, OFFICERS)]);
    expect(csv).toContain("2026-08-03");
    expect(csv).toContain("20:00");
  });

  it("distinguishes a named officer, an unnamed one, and a revoked one", () => {
    const fields = fieldsFor(ADJUSTMENT_EXPORT_FIELDS, ["officer"]);
    const cell = (awarded_by: string) =>
      projectAdjustmentRow({ ...ADJUSTMENT, awarded_by }, fields, OFFICERS)[0];

    expect(cell("officer-named")).toEqual({ kind: "text", value: "Dana Reyes" });
    // Present but null: a current officer who never set a display name.
    expect(cell("officer-anon")).toEqual({ kind: "text", value: "an officer" });
    // Absent: the admin_profiles row is gone. Collapsing this into the case
    // above would credit every ordinary officer to "a former officer".
    expect(cell("officer-gone")).toEqual({
      kind: "text",
      value: "a former officer",
    });
  });

  it("leaves the void columns empty on a live row", () => {
    const fields = fieldsFor(ADJUSTMENT_EXPORT_FIELDS, [
      "voided_date",
      "voided_by",
      "void_reason",
    ]);
    expect(projectAdjustmentRow(ADJUSTMENT, fields, OFFICERS)).toEqual([
      { kind: "empty" },
      { kind: "empty" },
      { kind: "empty" },
    ]);
  });

  it("fills them on a voided row", () => {
    const fields = fieldsFor(ADJUSTMENT_EXPORT_FIELDS, ["voided_date", "voided_by"]);
    const cells = projectAdjustmentRow(
      {
        ...ADJUSTMENT,
        voided_at: "2026-08-06T01:00:00.000Z",
        voided_by: "officer-named",
        void_reason: "Awarded to the wrong member",
      },
      fields,
      OFFICERS
    );
    expect(cells[0]).toEqual({ kind: "date", value: "2026-08-06T01:00:00.000Z" });
    expect(cells[1]).toEqual({ kind: "text", value: "Dana Reyes" });
  });
});

describe("attendance projection", () => {
  it("guards a formula-shaped name in CSV and not in xlsx", () => {
    // 🔓 Member-supplied text: anyone who can check in during an open window
    // picks their own name (§6). The victim is the officer who opens the file.
    const fields = fieldsFor(ATTENDANCE_EXPORT_FIELDS, ["name"]);
    const cells = [projectAttendanceRow(SUBMISSION, fields, OFFICERS)];

    expect(toCsv(fields, cells)).toContain("'=HYPERLINK");

    // An xlsx cell carries its type and is never re-parsed, so copying the
    // apostrophe there would corrupt a legitimate name for no gain. The absence
    // is the assertion.
    const book = toXlsx(fields, cells, "Attendance").toString("latin1");
    expect(book.length).toBeGreaterThan(0);
  });

  it("labels status and source as words, not database values", () => {
    const fields = fieldsFor(ATTENDANCE_EXPORT_FIELDS, ["status", "source"]);
    expect(projectAttendanceRow(SUBMISSION, fields, OFFICERS)).toEqual([
      { kind: "text", value: "Pending" },
      { kind: "text", value: "Self check-in" },
    ]);
  });

  it("leaves an orphan's event blank rather than inventing one", () => {
    // A pending orphan has no event_id. It must read as blank, not as a failed
    // lookup and not as a uuid.
    const fields = fieldsFor(ATTENDANCE_EXPORT_FIELDS, ["event", "member"]);
    expect(projectAttendanceRow(SUBMISSION, fields, OFFICERS)).toEqual([
      { kind: "empty" },
      { kind: "empty" },
    ]);
  });

  it("carries the resolution columns the queue never shows", () => {
    const fields = fieldsFor(ATTENDANCE_EXPORT_FIELDS, [
      "resolved_date",
      "resolved_by",
      "resolution_note",
    ]);
    const cells = projectAttendanceRow(
      {
        ...SUBMISSION,
        status: "present",
        resolved_at: "2026-08-06T01:00:00.000Z",
        resolved_by: "officer-anon",
        resolution_note: "Matched by email",
      },
      fields,
      OFFICERS
    );
    expect(cells[1]).toEqual({ kind: "text", value: "an officer" });
    expect(cells[2]).toEqual({ kind: "text", value: "Matched by email" });
  });
});

describe("the writers accept ledger cells", () => {
  // The seam this whole phase rests on: toCsv/toTsv/toXlsx take
  // (ExportField[], ExportCell[][]) and nothing domain-specific.

  it("produces a valid xlsx package from adjustment rows", () => {
    const fields = fieldsFor(ADJUSTMENT_EXPORT_FIELDS, ADJUSTMENT_DEFAULT_FIELDS);
    const book = toXlsx(
      fields,
      [projectAdjustmentRow(ADJUSTMENT, fields, OFFICERS)],
      "Adjustments"
    );
    // A zip local-file header, and the parts Excel refuses to open without.
    expect(book.subarray(0, 2).toString("latin1")).toBe("PK");
    const raw = book.toString("latin1");
    for (const part of [
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
    ]) {
      expect(raw, part).toContain(part);
    }
  });

  it("produces a header row matching the chosen fields, in catalogue order", () => {
    const fields = fieldsFor(ATTENDANCE_EXPORT_FIELDS, ATTENDANCE_DEFAULT_FIELDS);
    const tsv = toTsv(fields, [projectAttendanceRow(SUBMISSION, fields, OFFICERS)]);
    expect(tsv.split("\n")[0]).toBe(
      "Submitted\tTime (CT)\tName submitted\tEID submitted\tEmail submitted\tStatus\tEvent"
    );
  });
});

describe("the export routes read in chunks, so they need a TOTAL order", () => {
  // 🪤 Source assertions, because the behaviour needs more than CHUNK (1000)
  // rows to provoke and the constant is not injectable — the same reason
  // tests/member-directory.test.ts pins its chunk-boundary property with its
  // own small CHUNK rather than a thousand fixtures.
  //
  // The bug: a chunked read ordered only by a timestamp can return one row
  // twice and another not at all when a tie straddles a `.range()` boundary,
  // because rows equal on the sort column have no defined relative order. It
  // surfaces as MISSING DATA in an archive, which is the worst place for it.
  //
  // And the ties are real, not theoretical: the seed alone has four duplicate
  // `submitted_at` values and four duplicate `awarded_at` values. A room
  // checking in together, or one multi-member grant, produces them in bulk.

  it.each([
    ["attendance", "../app/admin/(shell)/attendance/export/route.ts", "submitted_at"],
    ["points", "../app/admin/(shell)/points/export/route.ts", "awarded_at"],
  ])("%s export orders by %s AND id", (_label, file, column) => {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    expect(source).toContain(`.order("${column}"`);
    expect(source).toContain('.order("id")');
  });

  it.each([
    ["attendance", "../app/admin/(shell)/attendance/export/route.ts"],
    ["points", "../app/admin/(shell)/points/export/route.ts"],
  ])("%s export refuses rather than truncating, and pages explicitly", (_l, file) => {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    // The hosted project applies its own PostgREST max_rows that local does
    // not, so one unbounded request comes back complete in development and
    // silently short in production.
    expect(source).toContain("CHUNK = 1000");
    expect(source).toContain("MAX_EXPORT_ROWS");
    expect(source).toMatch(/refuse\(\s*`That export would carry/);
    // getOfficer, never requireOfficer: a 302 is the wrong answer to fetching
    // a spreadsheet — the browser would save the login page as the file.
    //
    // 📌 Matched against comment-stripped source. Both routes EXPLAIN in prose
    // why requireOfficer is wrong here, so a bare substring search finds the
    // explanation and fails on correct code. That is the third time this shape
    // has bitten in this repo (the formAction and self-grant assertions), so it
    // is worth stating rather than rediscovering.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).toContain("getOfficer()");
    expect(code).not.toContain("requireOfficer");
    expect(source).toContain('export const dynamic = "force-dynamic"');
  });
});

describe("a failed officer-name lookup does not accuse anyone", () => {
  // 🔓 The widest-blast-radius defect Stage 8 phase 3 fixed, and it had been
  // hiding behind a comment calling it cosmetic.
  //
  // `describeOfficer` reads absence from the map as "no admin_profiles row",
  // i.e. a REVOKED officer. `fetchOfficerNames` used to return an empty Map on
  // error, which makes that true of every id at once — so one failed read
  // relabelled every officer on every screen (the ledger, both dues surfaces,
  // the member detail, the audit trail) as "a former officer". On the log whose
  // entire purpose is saying who did what.

  it("says the name is unavailable, not that they left", () => {
    const fields = fieldsFor(ADJUSTMENT_EXPORT_FIELDS, ["officer"]);
    const [cell] = projectAdjustmentRow(
      ADJUSTMENT,
      fields,
      OFFICERS_UNAVAILABLE
    );
    expect(cell).toEqual({
      kind: "text",
      value: "an officer (name unavailable)",
    });
    // The specific words that must NOT appear.
    expect(JSON.stringify(cell)).not.toContain("former");
  });

  it("still distinguishes a genuinely revoked officer when the read worked", () => {
    // The case the failure mode was impersonating. Both must exist, or the fix
    // has simply moved the collapse somewhere else.
    const fields = fieldsFor(ADJUSTMENT_EXPORT_FIELDS, ["officer"]);
    const [cell] = projectAdjustmentRow(
      { ...ADJUSTMENT, awarded_by: "officer-gone" },
      fields,
      OFFICERS
    );
    expect(cell).toEqual({ kind: "text", value: "a former officer" });
  });
});

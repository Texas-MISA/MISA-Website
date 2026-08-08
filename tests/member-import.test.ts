import { describe, expect, it } from "vitest";

import {
  countOutcomes,
  describeOutcome,
  importColumns,
  matchHeaders,
  MAX_ROSTER_IMPORT_ROWS,
  parseActive,
  planRosterImport,
  type ExistingMember,
  type PlannedMember,
} from "@/lib/member-import";
import type { FieldDefinition } from "@/lib/members";

// Roster CSV import, pure half (§7 Stage 6 phase 7b). No database and no clock:
// the roster is injected, so "already a member" is a fixture rather than a
// fetch. The integration half lives in tests/member-import-actions.test.ts.

const SHIRT: FieldDefinition = {
  id: "00000000-0000-4000-8000-000000000001",
  key: "shirt_size",
  label: "Shirt Size",
  kind: "select",
  options: ["S", "M", "L"],
  editableInline: true,
  showInDirectory: true,
  sortOrder: 0,
  archivedAt: null,
};

const NO_FIELDS: FieldDefinition[] = [];
const NO_ROSTER: ExistingMember[] = [];

function plan(
  csv: string,
  {
    definitions = NO_FIELDS,
    roster = NO_ROSTER,
  }: { definitions?: FieldDefinition[]; roster?: ExistingMember[] } = {}
) {
  return planRosterImport({ csv, definitions, roster });
}

/** The rows of an "ok" plan, or a failure if it was not one. */
function rowsOf(result: ReturnType<typeof plan>): PlannedMember[] {
  if (result.kind !== "ok") {
    throw new Error(`expected an ok plan, got ${result.kind}`);
  }
  return result.rows;
}

const HEADER = "Name,Email,EID";

describe("importColumns", () => {
  it("offers the three required identity columns plus active", () => {
    const keys = importColumns(NO_FIELDS).map((c) => c.key);
    expect(keys).toEqual(["name", "email", "eid", "active"]);
    expect(
      importColumns(NO_FIELDS)
        .filter((c) => c.required)
        .map((c) => c.key)
    ).toEqual(["name", "email", "eid"]);
  });

  it("adds every live custom field, and none of the calculated columns", () => {
    const keys = importColumns([SHIRT]).map((c) => c.key);
    expect(keys).toContain("shirt_size");
    // The catalogue carries these; an import must not pretend to set them.
    for (const calculated of [
      "total_points",
      "attendance_rate",
      "dues",
      "joined_at",
      "last_seen_at",
      "events_attended",
      "source",
      "notes",
    ]) {
      expect(keys).not.toContain(calculated);
    }
  });

  it("uses the export's own labels, so a downloaded file imports back", () => {
    const labels = importColumns([SHIRT]).map((c) => c.label);
    expect(labels).toEqual(["Name", "Email", "EID", "Active", "Shirt Size"]);
  });
});

describe("matchHeaders", () => {
  const columns = importColumns([SHIRT]);

  it("locates columns by name, not by position", () => {
    // ⚠️ The whole rule. A reordered export must not shift every value one
    // column to the left, which produces plausible rows with the wrong data in
    // every field.
    const match = matchHeaders(["EID", "Shirt Size", "Email", "Name"], columns);
    expect(match.mapped.get("eid")).toBe(0);
    expect(match.mapped.get("shirt_size")).toBe(1);
    expect(match.mapped.get("email")).toBe(2);
    expect(match.mapped.get("name")).toBe(3);
    expect(match.missing).toEqual([]);
  });

  it("is forgiving about case and spacing, and nothing else", () => {
    const match = matchHeaders(["  name ", "E-MAIL", "EMAIL", "eid"], columns);
    expect(match.mapped.get("name")).toBe(0);
    // "E-MAIL" is not "Email" — accepting a near-miss would put addresses in
    // whatever column happened to be closest.
    expect(match.mapped.get("email")).toBe(2);
    expect(match.ignored).toContain("E-MAIL");
  });

  it("accepts the bare key as an alias for the label", () => {
    const match = matchHeaders(["name", "email", "eid", "shirt_size"], columns);
    expect(match.mapped.size).toBe(4);
  });

  it("ignores a leading empty column and reports the rest", () => {
    const match = matchHeaders(
      ["", "Name", "Email", "EID", "Total points", "Attendance rate (%)"],
      columns
    );
    expect(match.missing).toEqual([]);
    expect(match.ignored).toEqual(["Total points", "Attendance rate (%)"]);
  });

  it("takes the first of two same-named columns and reports the second", () => {
    const match = matchHeaders(["Name", "Email", "EID", "Email"], columns);
    expect(match.mapped.get("email")).toBe(1);
    expect(match.ignored).toEqual(["Email"]);
  });

  it("names every missing required column", () => {
    const match = matchHeaders(["Name"], columns);
    expect(match.missing).toEqual(["Email", "EID"]);
  });
});

describe("parseActive", () => {
  it("defaults an empty cell to active", () => {
    expect(parseActive("")).toBe(true);
    expect(parseActive("   ")).toBe(true);
  });

  it("accepts the spellings officers actually type", () => {
    for (const yes of ["yes", "Y", "TRUE", "t", "1", "Active"]) {
      expect(parseActive(yes)).toBe(true);
    }
    for (const no of ["no", "N", "FALSE", "f", "0", "Inactive"]) {
      expect(parseActive(no)).toBe(false);
    }
  });

  it("refuses to guess at anything else", () => {
    // Guessing would silently reinstate somebody the officer meant to archive,
    // and a wrongly-active member shows up on the roster and in every count.
    expect(parseActive("maybe")).toBeNull();
    expect(parseActive("2")).toBeNull();
  });
});

describe("planRosterImport", () => {
  it("refuses a file with no rows under the header", () => {
    expect(plan(HEADER).kind).toBe("empty");
    expect(plan("").kind).toBe("empty");
  });

  it("refuses a file missing a required column, naming it", () => {
    const result = plan("Name,EID\nAda,ab1234");
    expect(result.kind).toBe("no_header");
    if (result.kind === "no_header") expect(result.missing).toEqual(["Email"]);
  });

  it("refuses rather than truncates past the row cap", () => {
    const body = Array.from(
      { length: MAX_ROSTER_IMPORT_ROWS + 1 },
      (_, i) => `Person ${i},p${i}@example.edu,ab${1000 + i}`
    ).join("\n");
    const result = plan(`${HEADER}\n${body}`);
    expect(result.kind).toBe("too_many");
    if (result.kind === "too_many") {
      expect(result.rows).toBe(MAX_ROSTER_IMPORT_ROWS + 1);
    }
  });

  it("plans a clean file as all new", () => {
    const rows = rowsOf(
      plan(`${HEADER}\nAda Lovelace,ada@example.edu,al1234\nAlan T,alan@example.edu,at5678`)
    );
    expect(rows.map((r) => r.outcome.kind)).toEqual(["new", "new"]);
    expect(rows[0]).toMatchObject({
      line: 2,
      fullName: "Ada Lovelace",
      email: "ada@example.edu",
      eid: "al1234",
      active: true,
      customFields: {},
    });
    // 1-based and counting the header, so it matches Excel's row gutter.
    expect(rows[1].line).toBe(3);
  });

  it("survives a quoted field containing a comma and a newline", () => {
    // The lesson a real Venmo statement taught, arriving in a roster the moment
    // one cell holds a line break.
    const rows = rowsOf(
      plan(`${HEADER}\n"Lovelace, Ada","ada@example.edu",al1234\n"Multi\nline",m@example.edu,ml9999`)
    );
    expect(rows[0].fullName).toBe("Lovelace, Ada");
    expect(rows[1].fullName).toBe("Multi\nline");
    expect(rows.map((r) => r.outcome.kind)).toEqual(["new", "new"]);
  });

  it("round-trips a file shaped like the export, ignoring calculated columns", () => {
    const csv = [
      "Name,Email,EID,Total points,Dues,Attendance rate (%),Shirt Size",
      "Ada Lovelace,ada@example.edu,al1234,27,Paid,86,M",
    ].join("\n");
    const result = plan(csv, { definitions: [SHIRT] });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.ignoredColumns).toEqual([
      "Total points",
      "Dues",
      "Attendance rate (%)",
    ]);
    expect(result.rows[0].customFields).toEqual({ shirt_size: "M" });
    expect(result.rows[0].outcome.kind).toBe("new");
  });

  describe("already on the roster", () => {
    const roster: ExistingMember[] = [
      { normalizedEid: "al1234", emailLower: "ada@example.edu" },
    ];

    it("skips a row matching on EID", () => {
      const rows = rowsOf(
        plan(`${HEADER}\nAda L,different@example.edu,AL-1234`, { roster })
      );
      // Matched through the generated column's fold: case and punctuation are
      // stripped, so `AL-1234` is `al1234`.
      expect(rows[0].outcome).toEqual({ kind: "existing", on: "eid" });
    });

    it("skips a row matching on EMAIL alone", () => {
      // ⚠️ The axis a single-index check would miss. `members` carries two
      // unique indexes, so this row would 23505 on insert with a clean preview.
      const rows = rowsOf(
        plan(`${HEADER}\nAda L,ADA@Example.edu,zz9999`, { roster })
      );
      expect(rows[0].outcome).toEqual({ kind: "existing", on: "email" });
    });

    it("never rewrites an existing member's details", () => {
      // Create-only. The planned row still carries the file's values — they are
      // shown in the preview — but the outcome is what decides the write, and
      // only `new` is written.
      const rows = rowsOf(
        plan(`${HEADER}\nWrong Name,ada@example.edu,al1234`, { roster })
      );
      expect(rows[0].outcome.kind).toBe("existing");
      expect(countOutcomes(rows).fresh).toBe(0);
    });
  });

  describe("duplicated within the file", () => {
    it("catches a repeat on the EID and names the first line", () => {
      const rows = rowsOf(
        plan(
          `${HEADER}\nAda,ada@example.edu,al1234\nAda Again,other@example.edu,AL 1234`
        )
      );
      expect(rows[0].outcome.kind).toBe("new");
      expect(rows[1].outcome).toEqual({
        kind: "duplicate_in_file",
        on: "eid",
        firstLine: 2,
      });
    });

    it("catches a repeat on the email too", () => {
      const rows = rowsOf(
        plan(`${HEADER}\nAda,ada@example.edu,al1234\nAda Again,ADA@example.edu,zz9999`)
      ).map((r) => r.outcome);
      expect(rows[1]).toEqual({
        kind: "duplicate_in_file",
        on: "email",
        firstLine: 2,
      });
    });

    it("does not let an INVALID row claim an identity", () => {
      // The second row is the real one; the first is unusable. Reporting the
      // second as a duplicate of a row that will never be written would make the
      // officer fix a cascade instead of one problem.
      const rows = rowsOf(
        plan(`${HEADER}\n,ada@example.edu,al1234\nAda,ada@example.edu,al1234`)
      );
      expect(rows[0].outcome.kind).toBe("invalid");
      expect(rows[1].outcome.kind).toBe("new");
    });
  });

  describe("invalid rows", () => {
    it("names the empty required column", () => {
      const rows = rowsOf(plan(`${HEADER}\n,a@example.edu,ab1234`));
      expect(rows[0].outcome).toEqual({
        kind: "invalid",
        reason: { kind: "missing", column: "Name" },
      });
    });

    it("refuses an EID that normalizes below the floor", () => {
      // The same floor lib/validation.ts applies to a check-in: punctuation
      // alone normalizes to nothing and would collide every such row into one
      // phantom identity.
      const rows = rowsOf(plan(`${HEADER}\nAda,a@example.edu,--`));
      expect(rows[0].outcome).toEqual({
        kind: "invalid",
        reason: { kind: "eid_too_short" },
      });
    });

    it("refuses an unrecognisable active cell", () => {
      const rows = rowsOf(
        plan(`Name,Email,EID,Active\nAda,a@example.edu,ab1234,perhaps`)
      );
      expect(rows[0].outcome).toEqual({
        kind: "invalid",
        reason: { kind: "bad_active", value: "perhaps" },
      });
    });

    it("reads a no in the active column", () => {
      const rows = rowsOf(
        plan(`Name,Email,EID,Active\nAda,a@example.edu,ab1234,no`)
      );
      expect(rows[0].outcome.kind).toBe("new");
      expect(rows[0].active).toBe(false);
    });
  });

  describe("custom fields", () => {
    it("stores a value that is one of the definition's options", () => {
      const rows = rowsOf(
        plan(`Name,Email,EID,Shirt Size\nAda,a@example.edu,ab1234,L`, {
          definitions: [SHIRT],
        })
      );
      expect(rows[0].customFields).toEqual({ shirt_size: "L" });
    });

    it("invalidates the row rather than importing the field blank", () => {
      // ⚠️ Silently dropping it would discard data the file plainly specified,
      // and nobody would notice. The preview is where a typo'd size gets fixed.
      const rows = rowsOf(
        plan(`Name,Email,EID,Shirt Size\nAda,a@example.edu,ab1234,Medium`, {
          definitions: [SHIRT],
        })
      );
      expect(rows[0].outcome).toEqual({
        kind: "invalid",
        reason: { kind: "not_an_option", column: "Shirt Size", value: "Medium" },
      });
    });

    it("leaves the KEY ABSENT for an empty cell, never an empty string", () => {
      // The setFieldValue rule: "" would make "cleared" and "never answered"
      // two states that render identically and sort differently.
      const rows = rowsOf(
        plan(`Name,Email,EID,Shirt Size\nAda,a@example.edu,ab1234,`, {
          definitions: [SHIRT],
        })
      );
      expect(rows[0].customFields).toEqual({});
      expect("shirt_size" in rows[0].customFields).toBe(false);
    });

    it("ignores a custom column with no live definition", () => {
      const result = plan(
        `Name,Email,EID,Shirt Size\nAda,a@example.edu,ab1234,M`,
        { definitions: NO_FIELDS }
      );
      expect(result.kind).toBe("ok");
      if (result.kind !== "ok") return;
      expect(result.ignoredColumns).toEqual(["Shirt Size"]);
      expect(result.rows[0].customFields).toEqual({});
      expect(result.rows[0].outcome.kind).toBe("new");
    });
  });

  it("counts every row exactly once", () => {
    const roster: ExistingMember[] = [
      { normalizedEid: "al1234", emailLower: "ada@example.edu" },
    ];
    const rows = rowsOf(
      plan(
        [
          HEADER,
          "Ada,ada@example.edu,al1234",
          "Grace,grace@example.edu,gh5678",
          "Grace Again,other@example.edu,gh5678",
          ",broken@example.edu,zz0001",
        ].join("\n"),
        { roster }
      )
    );
    const counts = countOutcomes(rows);
    expect(counts).toEqual({ fresh: 1, existing: 1, duplicate: 1, invalid: 1 });
    // The numbers on the preview add up to the file the officer uploaded.
    expect(counts.fresh + counts.existing + counts.duplicate + counts.invalid).toBe(
      rows.length
    );
  });
});

describe("describeOutcome", () => {
  it("says something an officer can act on for every outcome", () => {
    expect(describeOutcome({ kind: "new" })).toBe("Will be added");
    expect(describeOutcome({ kind: "existing", on: "eid" })).toContain("same EID");
    expect(describeOutcome({ kind: "existing", on: "email" })).toContain(
      "same email"
    );
    expect(
      describeOutcome({ kind: "duplicate_in_file", on: "eid", firstLine: 7 })
    ).toBe("Same EID as line 7");
    expect(
      describeOutcome({
        kind: "invalid",
        reason: { kind: "not_an_option", column: "Shirt Size", value: "Medium" },
      })
    ).toBe("“Medium” is not an option for Shirt Size");
  });
});

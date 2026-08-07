import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_EXPORT_FIELDS,
  EXPORT_FORMATS,
  MAX_EXPORT_ROWS,
  exportCatalogue,
  exportDate,
  exportedFields,
  guardFormula,
  parseFieldSelection,
  projectRow,
  toCsv,
  toEmailList,
  toNameList,
  toTsv,
  type ExportSourceRow,
} from "@/lib/export";
import { RESERVED_FIELD_KEYS, type FieldDefinition } from "@/lib/members";

// Pure tests for the roster export core (§7 Stage 6 phase 5). No database and
// no route: rows and a chosen field list in, a string out. What can only be
// checked against real PostgREST — that "select all N matching" returns N and
// not one page of 25 — lives in member-directory.test.ts.

function definition(over: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    key: "shirt_size",
    label: "Shirt size",
    kind: "select",
    options: ["S", "M", "L"],
    editableInline: true,
    showInDirectory: true,
    sortOrder: 0,
    archivedAt: null,
    ...over,
  };
}

function row(over: Partial<ExportSourceRow> = {}): ExportSourceRow {
  return {
    id: "00000000-0000-4000-8000-0000000000aa",
    eid: "abc1234",
    full_name: "Rowan Pike",
    email: "rowan@example.edu",
    active: true,
    source: "admin",
    joined_at: "2026-01-15T18:00:00.000Z",
    notes: null,
    total_points: 42,
    attendance_points: 30,
    bonus_points: 12,
    events_attended: 3,
    events_possible: 4,
    attendance_rate: 0.75,
    pending_count: 0,
    last_seen_at: "2026-03-01T02:00:00.000Z",
    custom_fields: {},
    ...over,
  };
}

describe("exportCatalogue", () => {
  it("puts built-ins and custom fields in one namespace", () => {
    const catalogue = exportCatalogue([definition()]);
    const keys = catalogue.map((field) => field.key);

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("email");
    expect(keys).toContain("shirt_size");
  });

  it("cannot collide, because every built-in key is reserved", () => {
    // The guarantee is upstream — RESERVED_FIELD_KEYS and migration 18's
    // key_not_builtin CHECK — but the catalogue is what depends on it, so it is
    // asserted here too. A built-in added without reserving its key would let an
    // officer define a field that competes for the same header.
    for (const field of exportCatalogue([])) {
      expect(RESERVED_FIELD_KEYS.has(field.key)).toBe(true);
    }
  });

  it("excludes archived definitions even when handed one", () => {
    const catalogue = exportCatalogue([
      definition({ key: "live" }),
      definition({
        id: "00000000-0000-4000-8000-000000000002",
        key: "retired",
        archivedAt: "2026-08-01T00:00:00.000Z",
      }),
    ]);

    expect(catalogue.map((field) => field.key)).toContain("live");
    expect(catalogue.map((field) => field.key)).not.toContain("retired");
  });

  it("does not use the cf: sort prefix — a catalogue key is bare", () => {
    const catalogue = exportCatalogue([definition()]);
    for (const field of catalogue) {
      expect(field.key.startsWith("cf:")).toBe(false);
    }
  });
});

describe("parseFieldSelection", () => {
  const catalogue = exportCatalogue([definition()]);

  it("falls back to the defaults when nothing is asked for", () => {
    for (const empty of [undefined, null, "", [], [""]]) {
      const chosen = parseFieldSelection(empty, catalogue);
      expect(chosen.map((field) => field.key)).toEqual([
        ...DEFAULT_EXPORT_FIELDS,
      ]);
    }
  });

  it("accepts a comma-separated value and repeated params alike", () => {
    const commas = parseFieldSelection("email,eid", catalogue);
    const repeated = parseFieldSelection(["email", "eid"], catalogue);
    expect(commas).toEqual(repeated);
    expect(commas.map((field) => field.key)).toEqual(["email", "eid"]);
  });

  it("ignores unknown keys rather than failing", () => {
    const chosen = parseFieldSelection("email,not_a_column", catalogue);
    expect(chosen.map((field) => field.key)).toEqual(["email"]);
  });

  it("returns catalogue order, not the order the keys arrived", () => {
    const chosen = parseFieldSelection("total_points,name,email", catalogue);
    expect(chosen.map((field) => field.key)).toEqual([
      "name",
      "email",
      "total_points",
    ]);
  });

  it("collapses duplicates", () => {
    const chosen = parseFieldSelection("email,email,email", catalogue);
    expect(chosen).toHaveLength(1);
  });

  it("falls back to the defaults when every key is unknown", () => {
    // Not an empty export: an unrecognised selection is the same situation as no
    // selection, and a file with a header and no columns is not a useful answer.
    const chosen = parseFieldSelection("nope,also_nope", catalogue);
    expect(chosen.map((field) => field.key)).toEqual([
      ...DEFAULT_EXPORT_FIELDS,
    ]);
  });
});

describe("exportedFields", () => {
  const catalogue = exportCatalogue([definition()]);
  const chosen = parseFieldSelection("name,email,eid,shirt_size", catalogue);

  it("reports one column for the single-column clipboard formats", () => {
    // ⚠️ The audit receipt records what LEFT, not what was ticked. An email copy
    // emits addresses regardless of the picker, and logging four fields for it
    // answers §6's "what left the building?" with a superset — erring wide is
    // still erring, and a receipt that over-reports is one nobody can reason
    // from a year later.
    expect(exportedFields("emails", chosen)).toEqual(["email"]);
    expect(exportedFields("names", chosen)).toEqual(["name"]);
  });

  it("reports the chosen list for the tabular formats", () => {
    expect(exportedFields("csv", chosen)).toEqual([
      "name",
      "email",
      "eid",
      "shirt_size",
    ]);
    expect(exportedFields("tsv", chosen)).toEqual(exportedFields("csv", chosen));
  });

  it("names a real catalogue key for every format", () => {
    // The receipt is only readable if its keys mean something in the catalogue.
    const keys = new Set(catalogue.map((field) => field.key));
    for (const format of EXPORT_FORMATS) {
      for (const key of exportedFields(format, chosen)) {
        expect(keys.has(key)).toBe(true);
      }
    }
  });
});

describe("projectRow", () => {
  const catalogue = exportCatalogue([definition()]);
  const pick = (...keys: string[]) =>
    parseFieldSelection(keys.join(","), catalogue);

  it("⚠️ leaves a null attendance_rate EMPTY, never zero", () => {
    // §4.5 does not stop at the screen. A term with no completed events has no
    // rate, and a member who attended nothing is a real 0 — collapsing the two
    // sinks every member to the bottom of the officer's sorted sheet.
    const cells = projectRow(row({ attendance_rate: null }), pick("attendance_rate"));
    expect(cells[0]).toEqual({ kind: "empty" });

    const real = projectRow(row({ attendance_rate: 0 }), pick("attendance_rate"));
    expect(real[0]).toEqual({ kind: "percent", value: 0 });
  });

  it("reads custom values, and leaves an unanswered field empty", () => {
    const answered = projectRow(
      row({ custom_fields: { shirt_size: "L" } }),
      pick("shirt_size")
    );
    expect(answered[0]).toEqual({ kind: "text", value: "L" });

    const blank = projectRow(row({ custom_fields: {} }), pick("shirt_size"));
    expect(blank[0]).toEqual({ kind: "empty" });
  });

  it("renders active as Yes/No and nulls as empty", () => {
    expect(projectRow(row({ active: true }), pick("active"))[0]).toEqual({
      kind: "text",
      value: "Yes",
    });
    expect(projectRow(row({ active: false }), pick("active"))[0]).toEqual({
      kind: "text",
      value: "No",
    });
    expect(projectRow(row({ active: null }), pick("active"))[0]).toEqual({
      kind: "empty",
    });
  });

  it("keeps numbers as numbers", () => {
    const cells = projectRow(row({ bonus_points: -5 }), pick("bonus_points"));
    expect(cells[0]).toEqual({ kind: "number", value: -5 });
  });
});

describe("exportDate", () => {
  it("🪤 converts to the CENTRAL civil date, not a UTC slice", () => {
    // 02:00Z on the 15th is 21:00 Central on the 14th. A bare iso.slice(0, 10)
    // would report the 15th and be wrong for exactly the members who joined at
    // an evening event.
    expect(exportDate("2026-03-15T02:00:00.000Z")).toBe("2026-03-14");
    expect("2026-03-15T02:00:00.000Z".slice(0, 10)).toBe("2026-03-15");
  });
});

describe("guardFormula", () => {
  it("🔓 neutralises every leading character a spreadsheet executes", () => {
    for (const lead of ["=", "+", "-", "@", "\t", "\r"]) {
      expect(guardFormula(`${lead}HYPERLINK("http://x")`)).toBe(
        `'${lead}HYPERLINK("http://x")`
      );
    }
  });

  it("leaves an ordinary name alone", () => {
    expect(guardFormula("Rowan Pike")).toBe("Rowan Pike");
  });
});

describe("toCsv", () => {
  const catalogue = exportCatalogue([definition()]);
  const pick = (...keys: string[]) =>
    parseFieldSelection(keys.join(","), catalogue);

  it("writes a header from the catalogue labels", () => {
    const fields = pick("name", "email");
    expect(toCsv(fields, []).split("\r\n")[0]).toBe("Name,Email");
  });

  it("🔓 guards an attacker-supplied name that would execute", () => {
    // Anyone who can check in during an open window picks their own name (§6),
    // so this is reachable by design and the victim is the officer's machine.
    const fields = pick("name");
    const cells = [projectRow(row({ full_name: "=HYPERLINK(\"http://x\")" }), fields)];
    const csv = toCsv(fields, cells);

    expect(csv.split("\r\n")[1]).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
  });

  it("🔓 does NOT guard a negative number", () => {
    // The whole reason ExportCell is typed. `-5` is a legitimate bonus_points
    // and `'-5` would stop being a number the moment it landed in the sheet.
    const fields = pick("bonus_points");
    const csv = toCsv(fields, [projectRow(row({ bonus_points: -5 }), fields)]);

    expect(csv.split("\r\n")[1]).toBe("-5");
  });

  it("quotes commas, quotes and newlines", () => {
    const fields = pick("name");
    const csv = toCsv(fields, [
      projectRow(row({ full_name: 'Pike, Rowan "Ro"' }), fields),
    ]);

    expect(csv.split("\r\n")[1]).toBe('"Pike, Rowan ""Ro"""');
  });

  it("scales a rate to a whole percent and leaves a null one blank", () => {
    const fields = pick("attendance_rate");
    const csv = toCsv(fields, [
      projectRow(row({ attendance_rate: 0.75 }), fields),
      projectRow(row({ attendance_rate: null }), fields),
    ]);
    const lines = csv.split("\r\n");

    expect(lines[1]).toBe("75");
    expect(lines[2]).toBe("");
  });

  it("uses CRLF line endings", () => {
    const fields = pick("name");
    const csv = toCsv(fields, [projectRow(row(), fields)]);
    expect(csv).toContain("\r\n");
  });
});

describe("toTsv", () => {
  const catalogue = exportCatalogue([]);
  const fields = parseFieldSelection("name", catalogue);

  it("strips tabs and newlines, which TSV cannot escape", () => {
    const tsv = toTsv(fields, [
      projectRow(row({ full_name: "Rowan\tPike\nSecond" }), fields),
    ]);
    expect(tsv.split("\n")[1]).toBe("Rowan Pike Second");
  });

  it("does not apply the formula guard", () => {
    // This lands in a sheet the officer already controls, and a paste that
    // silently gained apostrophes would be the surprising outcome.
    const tsv = toTsv(fields, [projectRow(row({ full_name: "=SUM(A1)" }), fields)]);
    expect(tsv.split("\n")[1]).toBe("=SUM(A1)");
  });
});

describe("clipboard lists", () => {
  it("skips members with no email, so the count reported is the count copied", () => {
    const emails = toEmailList([
      row({ email: "a@example.edu" }),
      row({ email: null }),
      row({ email: "b@example.edu" }),
    ]);
    expect(emails).toBe("a@example.edu, b@example.edu");
    expect(emails.split(",")).toHaveLength(2);
  });

  it("returns an empty string rather than a lone separator", () => {
    expect(toEmailList([row({ email: null })])).toBe("");
    expect(toNameList([row({ full_name: null })])).toBe("");
  });

  it("puts one name per line", () => {
    expect(toNameList([row({ full_name: "A" }), row({ full_name: "B" })])).toBe(
      "A\nB"
    );
  });
});

describe("the export row cap", () => {
  it("is sized above §2.2's worst case", () => {
    expect(MAX_EXPORT_ROWS).toBeGreaterThan(500);
  });

  it("⚠️ is enforced by REFUSING in the route, never by slicing", () => {
    // A truncated export is a partial list that looks complete — the same bug
    // as a silent cap, and the exact failure §7 asks this screen to prevent.
    // Pinned as a source assertion because the refusal lives in the route
    // handler, which needs a request context no pure test can build.
    const source = readFileSync(
      "app/admin/(shell)/members/export/route.ts",
      "utf8"
    );

    expect(source).toContain("MAX_EXPORT_ROWS");
    expect(source).not.toMatch(/\.slice\(0,\s*MAX_EXPORT_ROWS/);
    expect(source).not.toMatch(/limit\(MAX_EXPORT_ROWS/);
  });
});

describe("the export route's boundaries", () => {
  const source = readFileSync(
    "app/admin/(shell)/members/export/route.ts",
    "utf8"
  );

  // Assert against code, not prose. The route's comments deliberately NAME the
  // two things it must not do and say why — that reasoning is the most valuable
  // part of the file and a bare substring check would punish it.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("opens with getOfficer() and 403, never requireOfficer()", () => {
    // requireOfficer()'s redirect() would answer a download fetch with a login
    // page, and the browser would save the HTML as members.csv.
    expect(code).toContain("getOfficer()");
    expect(code).toContain("403");
    expect(code).not.toContain("requireOfficer");
  });

  it("⚠️ reads to the end rather than taking one window", () => {
    // The export must never stop at a single bounded read — that would return
    // part of the filter while claiming to be all of it, which is the failure
    // this entire screen is built around.
    //
    // 📌 This used to assert `pageRange` was absent, back when the directory
    // paginated at 25 and the risk was the export borrowing its window. Both
    // now read in chunks, so absence of that name proves nothing (it no longer
    // exists) — the property worth pinning is that the read LOOPS and bounds
    // itself with a range rather than a limit.
    expect(code).toMatch(/for \(let offset = 0/);
    expect(code).toContain(".range(");
    expect(code).not.toContain(".limit(");
  });

  it("writes the audit receipt before the body is built", () => {
    const audited = source.indexOf("writeAudit");
    const responded = source.indexOf("return respond(");
    expect(audited).toBeGreaterThan(-1);
    expect(responded).toBeGreaterThan(audited);
  });

  it("uses a generated receipt uuid, not a member id", () => {
    expect(source).toContain("crypto.randomUUID()");
  });

  it("carries no role check — a §9 consistency decision, not an oversight", () => {
    expect(source).not.toContain('role === "admin"');
    expect(source).not.toContain("officer.role");
  });
});

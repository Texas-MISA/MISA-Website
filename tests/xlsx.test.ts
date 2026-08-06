import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import {
  exportCatalogue,
  parseFieldSelection,
  projectRow,
  type ExportSourceRow,
} from "@/lib/export";
import { columnName, dateSerial, sheetName, toXlsx } from "@/lib/xlsx";

// Pure tests for the hand-rolled xlsx writer (§7 Stage 6 phase 5b).
//
// The workbook is opened from the inside: the ZIP is unpacked here rather than
// by a library, which keeps the zero-dependency property intact and makes the
// container itself part of what is under test — a malformed central directory
// fails these before it ever reaches Excel.
//
// ⚠️ What these CANNOT answer is whether Excel shows its "we found a problem
// with some content" repair prompt, which is the real failure mode of a
// hand-rolled workbook and produces no error anywhere else. Every assertion
// below targets a known cause of that prompt — the reserved fills, the child
// order in styles.xml, the count attributes — but passing them is not proof.
// One manual open in a real spreadsheet app is the missing half.

// ---------------------------------------------------------------------------
// A minimal ZIP reader, so the test needs no dependency either
// ---------------------------------------------------------------------------

function unzip(archive: Buffer): Map<string, string> {
  // The end-of-central-directory record is last, and has no fixed offset
  // because of its trailing comment — scan back for the signature.
  let eocd = -1;
  for (let i = archive.length - 22; i >= 0; i--) {
    if (archive.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("no end-of-central-directory record");

  const count = archive.readUInt16LE(eocd + 10);
  let cursor = archive.readUInt32LE(eocd + 16);

  const parts = new Map<string, string>();

  for (let i = 0; i < count; i++) {
    if (archive.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error(`bad central directory entry at ${cursor}`);
    }
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const name = archive
      .subarray(cursor + 46, cursor + 46 + nameLength)
      .toString("utf8");

    if (archive.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error(`bad local header for ${name}`);
    }
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;

    const data = archive.subarray(start, start + compressedSize);
    parts.set(name, inflateRawSync(data).toString("utf8"));

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return parts;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const catalogue = exportCatalogue([]);
const pick = (...keys: string[]) =>
  parseFieldSelection(keys.join(","), catalogue);

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
    bonus_points: -5,
    events_attended: 3,
    events_possible: 4,
    attendance_rate: 0.75,
    pending_count: 0,
    last_seen_at: "2026-03-01T02:00:00.000Z",
    custom_fields: {},
    ...over,
  };
}

function build(
  keys: string[],
  rows: ExportSourceRow[],
  label = "Members"
): Map<string, string> {
  const fields = pick(...keys);
  return unzip(toXlsx(fields, rows.map((r) => projectRow(r, fields)), label));
}

// ---------------------------------------------------------------------------

describe("the package", () => {
  const parts = build(["name", "email"], [row()]);

  it("carries exactly the six parts a workbook needs", () => {
    expect([...parts.keys()].sort()).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/workbook.xml",
      "xl/worksheets/sheet1.xml",
    ]);
  });

  it("declares a content type for every part that needs an override", () => {
    const types = parts.get("[Content_Types].xml")!;
    for (const part of [
      "/xl/workbook.xml",
      "/xl/worksheets/sheet1.xml",
      "/xl/styles.xml",
    ]) {
      expect(types).toContain(`PartName="${part}"`);
    }
    expect(types).toContain('Extension="rels"');
  });

  it("points the relationships at parts that exist", () => {
    expect(parts.get("_rels/.rels")).toContain('Target="xl/workbook.xml"');
    const rels = parts.get("xl/_rels/workbook.xml.rels")!;
    expect(rels).toContain('Target="worksheets/sheet1.xml"');
    expect(rels).toContain('Target="styles.xml"');
  });

  it("is byte-identical for identical input", () => {
    // The DOS timestamp is fixed rather than "now", so two exports of the same
    // roster diff cleanly and these tests have something stable to assert.
    const fields = pick("name");
    const cells = [projectRow(row(), fields)];
    expect(toXlsx(fields, cells).equals(toXlsx(fields, cells))).toBe(true);
  });
});

describe("styles.xml — the repair-prompt traps", () => {
  const styles = build(["name"], [row()]).get("xl/styles.xml")!;

  it("🪤 keeps fills 0 and 1 reserved as none then gray125", () => {
    // Omitting the gray125 fill is the single most common cause of Excel's
    // repair prompt, and nothing else reports it.
    const fills = styles.match(/<fills[\s\S]*?<\/fills>/)![0];
    expect(fills.indexOf('patternType="none"')).toBeLessThan(
      fills.indexOf('patternType="gray125"')
    );
  });

  it("🪤 puts numFmts first and the rest in schema order", () => {
    const order = [
      "<numFmts",
      "<fonts",
      "<fills",
      "<borders",
      "<cellStyleXfs",
      "<cellXfs",
    ].map((tag) => styles.indexOf(tag));

    expect(order.every((at) => at > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("🪤 has every count attribute matching its real child count", () => {
    // Hand-written counts are hand-wrong by default, so they are derived in the
    // source — this asserts the derivation rather than trusting it.
    for (const [tag, child] of [
      ["numFmts", "numFmt"],
      ["fonts", "font"],
      ["fills", "fill"],
      ["borders", "border"],
      ["cellStyleXfs", "xf"],
      ["cellXfs", "xf"],
    ]) {
      const block = styles.match(new RegExp(`<${tag} count="(\\d+)">([\\s\\S]*?)</${tag}>`))!;
      const declared = Number(block[1]);
      const actual = block[2].match(new RegExp(`<${child}[ />]`, "g"))?.length ?? 0;
      expect(`${tag}=${actual}`).toBe(`${tag}=${declared}`);
    }
  });

  it("🪤 uses a custom numFmtId at or above 164", () => {
    const id = Number(styles.match(/<numFmt numFmtId="(\d+)"/)![1]);
    expect(id).toBeGreaterThanOrEqual(164);
  });
});

describe("cells carry their type", () => {
  it("writes a number as a bare <v>, never as an inline string", () => {
    // The assertion that catches a workbook silently degrading into a CSV with
    // a different extension — which is the only reason to ship this format.
    const sheet = build(["total_points"], [row({ total_points: 42 })]).get(
      "xl/worksheets/sheet1.xml"
    )!;
    const body = sheet.split("</row>")[1];

    expect(body).toContain("<v>42</v>");
    expect(body).not.toContain("inlineStr");
  });

  it("keeps a negative number negative and unguarded", () => {
    // The CSV writer prefixes a leading `-` to defuse formula injection. An
    // xlsx cell is typed and never re-parsed, so that guard must NOT leak here.
    const sheet = build(["bonus_points"], [row({ bonus_points: -5 })]).get(
      "xl/worksheets/sheet1.xml"
    )!;
    expect(sheet).toContain("<v>-5</v>");
    expect(sheet).not.toContain("'-5");
  });

  it("🔓 writes a formula-shaped name as a plain inline string", () => {
    // Reachable by design: anyone who can check in picks their own name (§6).
    // In a workbook it is a string, so no apostrophe is added — and the absence
    // of one is the assertion, because copying the CSV guard here would corrupt
    // a legitimate name for no gain.
    const sheet = build(["name"], [row({ full_name: '=HYPERLINK("http://x")' })]).get(
      "xl/worksheets/sheet1.xml"
    )!;
    expect(sheet).toContain("=HYPERLINK(&quot;http://x&quot;)");
    expect(sheet).not.toContain("'=HYPERLINK");
  });

  it("⚠️ omits the cell entirely for a null attendance_rate", () => {
    // §4.5 does not stop at the screen. No cell at all — never a zero, which
    // would sink every unrated member to the bottom of a sorted sheet.
    const sheet = build(["name", "attendance_rate"], [
      row({ attendance_rate: null }),
    ]).get("xl/worksheets/sheet1.xml")!;
    const body = sheet.split("</row>")[1];

    expect(body).toContain('r="A2"');
    expect(body).not.toContain('r="B2"');
  });

  it("writes a real 0 rate as a 0", () => {
    const sheet = build(["attendance_rate"], [row({ attendance_rate: 0 })]).get(
      "xl/worksheets/sheet1.xml"
    )!;
    expect(sheet.split("</row>")[1]).toContain("<v>0</v>");
  });

  it("scales a rate to a whole percent", () => {
    const sheet = build(["attendance_rate"], [row({ attendance_rate: 0.75 })]).get(
      "xl/worksheets/sheet1.xml"
    )!;
    expect(sheet.split("</row>")[1]).toContain("<v>75</v>");
  });

  it("styles the header row bold and labels it from the catalogue", () => {
    const sheet = build(["name", "email"], [row()]).get(
      "xl/worksheets/sheet1.xml"
    )!;
    const header = sheet.split("</row>")[0];

    expect(header).toContain(">Name<");
    expect(header).toContain(">Email<");
    expect(header).toContain('s="1"');
  });
});

describe("dates", () => {
  it("🪤 anchors on 1899-12-30, absorbing Excel's 1900 leap-year bug", () => {
    // Excel keeps a February 29, 1900 that never existed, for Lotus
    // compatibility. Two known-good anchors: 1900-01-01 is serial 2, and
    // 2026-01-15 is 46037.
    expect(dateSerial("1900-01-01")).toBe(2);
    expect(dateSerial("2026-01-15")).toBe(46037);
  });

  it("🪤 converts to the CENTRAL civil date before taking the serial", () => {
    // 02:00Z on the 15th is 21:00 Central on the 14th. The same UTC-slice trap
    // the CSV writer is pinned against, one format over.
    const sheet = build(["joined_at"], [
      row({ joined_at: "2026-03-15T02:00:00.000Z" }),
    ]).get("xl/worksheets/sheet1.xml")!;

    expect(sheet).toContain(`<v>${dateSerial("2026-03-14")}</v>`);
  });

  it("carries the date style so it renders as a date", () => {
    const sheet = build(["joined_at"], [row()]).get(
      "xl/worksheets/sheet1.xml"
    )!;
    expect(sheet.split("</row>")[1]).toContain('s="2"');
  });
});

describe("the sheet", () => {
  it("freezes the header and filters the used range", () => {
    const sheet = build(["name", "email"], [row(), row()]).get(
      "xl/worksheets/sheet1.xml"
    )!;

    expect(sheet).toContain('state="frozen"');
    // Two data rows plus the header.
    expect(sheet).toContain('<autoFilter ref="A1:B3"/>');
    expect(sheet).toContain('<dimension ref="A1:B3"/>');
  });

  it("puts autoFilter after sheetData, as the schema requires", () => {
    const sheet = build(["name"], [row()]).get("xl/worksheets/sheet1.xml")!;
    expect(sheet.indexOf("</sheetData>")).toBeLessThan(
      sheet.indexOf("<autoFilter")
    );
  });

  it("gives every column a width", () => {
    const sheet = build(["name", "email"], [row()]).get(
      "xl/worksheets/sheet1.xml"
    )!;
    expect(sheet.match(/<col /g)).toHaveLength(2);
  });
});

describe("sheetName", () => {
  it("strips the characters Excel forbids", () => {
    expect(sheetName("Active [2026]: all/any*")).toBe("Active 2026 all any");
  });

  it("truncates at 31 characters", () => {
    expect(sheetName("x".repeat(50))).toHaveLength(31);
  });

  it("never returns an empty name", () => {
    expect(sheetName("")).toBe("Members");
    expect(sheetName("[]:*?/\\")).toBe("Members");
  });
});

describe("columnName", () => {
  it("counts past Z the way a spreadsheet does", () => {
    expect(columnName(0)).toBe("A");
    expect(columnName(25)).toBe("Z");
    expect(columnName(26)).toBe("AA");
    expect(columnName(51)).toBe("AZ");
    expect(columnName(52)).toBe("BA");
  });
});

describe("the writer's dependencies", () => {
  it("imports nothing outside node: builtins and this repo", () => {
    // The zero-dependency property is the whole reason this file exists rather
    // than a package, so it is asserted structurally instead of remembered.
    const source = readFileSync("lib/xlsx.ts", "utf8");
    const imports = [...source.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);

    expect(imports.length).toBeGreaterThan(0);
    for (const specifier of imports) {
      expect(
        specifier.startsWith("node:") || specifier.startsWith("@/")
      ).toBe(true);
    }
  });
});

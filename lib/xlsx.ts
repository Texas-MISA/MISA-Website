// A minimal .xlsx writer (§7 Stage 6 phase 5b). Pure, and dependency-free apart
// from node:zlib — rows and a chosen field list in, workbook bytes out.
//
// ⚠️ Hand-rolled on purpose, decided 2026-08-06 after checking the candidates
// rather than remembering them. SheetJS's npm `xlsx` is stuck at 0.18.5, last
// published around four years ago, because releases moved to the vendor's own
// CDN — adopting it means either a four-year-old build or a CDN tarball URL that
// a plain `npm ci` depends on. `exceljs` has had no meaningful release since
// October 2023 and the community has forked it. This project has no dependencies
// beyond the framework and Supabase, the next officer inherits whatever lands
// here, and an xlsx is a zip of six XML parts. If the shape ever grows past a
// flat table — multiple sheets, formulas, charts — that is the moment to revisit
// `@office-kit/xlsx` rather than to grow this file.
//
// ⚠️ The reason this exists at all is that CSV is a text file. Every number and
// date arrives as text, so the officer's first act is a "convert to number" pass
// on every column and sorting by points sorts lexicographically until they do. A
// workbook of text cells would be a CSV with extra steps, so the typed cells
// below are the entire point.

import { deflateRawSync } from "node:zlib";

import {
  exportDate,
  exportPercent,
  type ExportCell,
  type ExportField,
} from "@/lib/export";

// ---------------------------------------------------------------------------
// The ZIP container
// ---------------------------------------------------------------------------

type ZipEntry = { name: string; data: Buffer };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// A fixed DOS timestamp (1980-01-01 00:00), so the same roster and field list
// produce byte-identical bytes. Determinism is worth more here than a real mtime
// nobody reads: it makes the tests assertable and a diff of two exports
// meaningful. DOS date = ((year-1980) << 9) | (month << 5) | day.
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

/**
 * Pack entries into a ZIP archive.
 *
 * Deliberately minimal: deflate for every entry, no ZIP64, no data descriptors,
 * no directory entries. `MAX_EXPORT_ROWS` keeps the archive orders of magnitude
 * below the 4 GB point where ZIP64 would be needed.
 */
function zip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const compressed = deflateRawSync(entry.data);
    const sum = crc32(entry.data);

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(8, 8); // method: deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(sum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra field length
    name.copy(local, 30);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0); // central directory signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(8, 10); // method
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(sum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk number
    central.writeUInt16LE(0, 36); // internal attributes
    central.writeUInt32LE(0, 38); // external attributes
    central.writeUInt32LE(offset, 42); // local header offset
    name.copy(central, 46);

    locals.push(local, compressed);
    centrals.push(central);
    offset += local.length + compressed.length;
  }

  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  end.writeUInt16LE(0, 4); // this disk
  end.writeUInt16LE(0, 6); // disk with the directory
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...locals, directory, end]);
}

// ---------------------------------------------------------------------------
// XML
// ---------------------------------------------------------------------------

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/**
 * Escape a value for XML text or an attribute.
 *
 * ⚠️ The control-character strip is not decoration. XML 1.0 forbids most C0
 * characters outright, and Excel rejects the whole package — not the cell — when
 * one appears. Officer notes are free text pasted from anywhere, so this is
 * reachable. Tab, newline and carriage return are the three that are legal.
 */
function xml(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    // Legal C0 characters in XML 1.0 are tab, newline and carriage return.
    const control = code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d;
    if (control || code === 0x7f) continue;
    out += ESCAPES[ch] ?? ch;
  }
  return out;
}

const DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

/** 0 → A, 25 → Z, 26 → AA. */
export function columnName(index: number): string {
  let name = "";
  let n = index;
  while (n >= 0) {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  }
  return name;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * ⚠️ The epoch is 1899-12-30, not 1900-01-01, and the off-by-two is deliberate.
 *
 * Excel treats 1900 as a leap year — serial 60 is a February 29 that never
 * existed — inherited from Lotus 1-2-3 in 1985 and kept ever since for
 * compatibility. Anchoring at 1899-12-30 absorbs both that phantom day and the
 * 1-based count, so every date from 1900-03-01 onward is right. That covers
 * every date this application can hold; nothing here predates the org.
 */
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/** A `YYYY-MM-DD` civil date → an Excel serial. */
export function dateSerial(civil: string): number {
  const [year, month, day] = civil.split("-").map(Number);
  return Math.round((Date.UTC(year, month - 1, day) - EXCEL_EPOCH) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

/**
 * Style indexes, as positions in `cellXfs` below. Named rather than inlined
 * because a wrong `s=` is invisible until someone opens the file.
 */
// Index 0 is the general style and is the implicit default — a cell with no `s`
// attribute already uses it, so it is named here only to explain the offsets.
const STYLE_HEADER = 1;
const STYLE_DATE = 2;

/**
 * 🪤 Four things here each produce the same symptom — Excel's "we found a
 * problem with some content" repair prompt — with no hint which one is wrong:
 *
 *  1. Fills 0 and 1 are RESERVED and must be exactly `none` then `gray125`.
 *     Omitting the second is the single most common cause of the prompt.
 *  2. `numFmts` must be the first child, and the order below —
 *     numFmts, fonts, fills, borders, cellStyleXfs, cellXfs — is required.
 *  3. Every `count` must equal the real number of children, which is why they
 *     are derived from the arrays rather than written as literals.
 *  4. A custom `numFmtId` must be >= 164; 0–163 are reserved for built-ins.
 */
function stylesXml(): string {
  const numFmts = [`<numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/>`];
  const fonts = [
    `<font><sz val="11"/><name val="Calibri"/></font>`,
    `<font><b/><sz val="11"/><name val="Calibri"/></font>`,
  ];
  const fills = [
    `<fill><patternFill patternType="none"/></fill>`,
    `<fill><patternFill patternType="gray125"/></fill>`,
  ];
  const borders = [`<border/>`];
  const cellStyleXfs = [`<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>`];
  const cellXfs = [
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`,
    `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>`,
    `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`,
  ];

  const block = (tag: string, items: string[]) =>
    `<${tag} count="${items.length}">${items.join("")}</${tag}>`;

  return (
    `${DECLARATION}<styleSheet xmlns="${MAIN_NS}">` +
    block("numFmts", numFmts) +
    block("fonts", fonts) +
    block("fills", fills) +
    block("borders", borders) +
    block("cellStyleXfs", cellStyleXfs) +
    block("cellXfs", cellXfs) +
    `</styleSheet>`
  );
}

// ---------------------------------------------------------------------------
// The sheet
// ---------------------------------------------------------------------------

/**
 * Excel's rules for a sheet name: at most 31 characters, and none of
 * `[ ] : * ? / \`. A name that breaks either is another silent repair prompt.
 */
export function sheetName(label: string): string {
  const cleaned = label
    .replace(/[[\]:*?/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^'+|'+$/g, "")
    .slice(0, 31)
    .trim();
  return cleaned.length > 0 ? cleaned : "Members";
}

/** What a cell will display, used only for sizing the columns. */
function displayText(cell: ExportCell): string {
  switch (cell.kind) {
    case "empty":
      return "";
    case "text":
      return cell.value;
    case "number":
      return String(cell.value);
    case "percent":
      return String(exportPercent(cell.value));
    case "date":
      return exportDate(cell.value);
  }
}

/**
 * One cell.
 *
 * ⚠️ An `empty` cell emits NOTHING — no `<c>` element at all. A null
 * `attendance_rate` must never arrive as `0`: the view leaves it null when the
 * term has no completed events, and a member who attended nothing is a real
 * zero. §4.5's rule does not stop at the screen, and an absent cell is the only
 * faithful rendering of "no answer".
 *
 * ⚠️ There is NO formula guard here, and that is correct rather than an
 * oversight. An xlsx cell carries its type, so an inline string beginning `=` is
 * a string and is never re-parsed as a formula — the CSV writer's apostrophe
 * would corrupt a legitimate name for no gain. This asymmetry is exactly why the
 * two writers share `projectRow` but not their formatting, and why xlsx must
 * never be implemented as CSV with a different extension.
 */
function cellXml(cell: ExportCell, ref: string): string {
  switch (cell.kind) {
    case "empty":
      return "";
    case "text":
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(
        cell.value
      )}</t></is></c>`;
    case "number":
      return `<c r="${ref}"><v>${cell.value}</v></c>`;
    case "percent":
      return `<c r="${ref}"><v>${exportPercent(cell.value)}</v></c>`;
    case "date":
      return `<c r="${ref}" s="${STYLE_DATE}"><v>${dateSerial(
        exportDate(cell.value)
      )}</v></c>`;
  }
}

const MIN_WIDTH = 10;
const MAX_WIDTH = 60;

function columnWidths(
  fields: readonly ExportField[],
  rows: readonly ExportCell[][]
): number[] {
  return fields.map((field, column) => {
    let widest = field.label.length;
    for (const cells of rows) {
      const cell = cells[column];
      if (cell) widest = Math.max(widest, displayText(cell).length);
    }
    // +2 for the autofilter dropdown arrow, which otherwise covers the last
    // character of the widest value in every column.
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, widest + 2));
  });
}

function sheetXml(
  fields: readonly ExportField[],
  rows: readonly ExportCell[][]
): string {
  const lastColumn = columnName(Math.max(0, fields.length - 1));
  const lastRow = rows.length + 1;
  const dimension = `A1:${lastColumn}${lastRow}`;

  const cols = columnWidths(fields, rows)
    .map(
      (width, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`
    )
    .join("");

  const header = fields
    .map(
      (field, i) =>
        `<c r="${columnName(i)}1" s="${STYLE_HEADER}" t="inlineStr"><is><t xml:space="preserve">${xml(
          field.label
        )}</t></is></c>`
    )
    .join("");

  const body = rows
    .map((cells, r) => {
      const number = r + 2;
      const inner = cells
        .map((cell, c) => cellXml(cell, `${columnName(c)}${number}`))
        .join("");
      return `<row r="${number}">${inner}</row>`;
    })
    .join("");

  // ⚠️ Element order is fixed by the schema: dimension, sheetViews, cols,
  // sheetData, then autoFilter. autoFilter AFTER sheetData, not with the other
  // sheet-level settings where it reads like it belongs.
  return (
    `${DECLARATION}<worksheet xmlns="${MAIN_NS}" xmlns:r="${REL_NS}">` +
    `<dimension ref="${dimension}"/>` +
    // A frozen header row and a filter dropdown on every column. "Opens ready to
    // sort" is the reason this format exists over CSV; this is that, literally.
    `<sheetViews><sheetView workbookViewId="0">` +
    `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>` +
    `</sheetView></sheetViews>` +
    `<cols>${cols}</cols>` +
    `<sheetData><row r="1">${header}</row>${body}</sheetData>` +
    `<autoFilter ref="${dimension}"/>` +
    `</worksheet>`
  );
}

// ---------------------------------------------------------------------------
// The package
// ---------------------------------------------------------------------------

const CONTENT_TYPES =
  `${DECLARATION}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
  `</Types>`;

const ROOT_RELS =
  `${DECLARATION}<Relationships xmlns="${PKG_REL_NS}">` +
  `<Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`;

const WORKBOOK_RELS =
  `${DECLARATION}<Relationships xmlns="${PKG_REL_NS}">` +
  `<Relationship Id="rId1" Type="${REL_NS}/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="${REL_NS}/styles" Target="styles.xml"/>` +
  `</Relationships>`;

function workbookXml(name: string): string {
  return (
    `${DECLARATION}<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}">` +
    `<sheets><sheet name="${xml(name)}" sheetId="1" r:id="rId1"/></sheets>` +
    `</workbook>`
  );
}

/**
 * The workbook, as bytes.
 *
 * Buffered whole rather than streamed, because a zip's central directory is
 * written last and there is no incremental path worth having. That is an
 * argument FOR `MAX_EXPORT_ROWS` rather than against it: the cap is what keeps
 * this comfortably inside Vercel's 4.5 MB non-streaming response limit.
 *
 * Takes the same `projectRow` output the CSV writer takes. Only the formatting
 * differs — that is the whole design.
 */
export function toXlsx(
  fields: readonly ExportField[],
  rows: readonly ExportCell[][],
  label = "Members"
): Buffer {
  const utf8 = (text: string) => Buffer.from(text, "utf8");

  return zip([
    { name: "[Content_Types].xml", data: utf8(CONTENT_TYPES) },
    { name: "_rels/.rels", data: utf8(ROOT_RELS) },
    { name: "xl/workbook.xml", data: utf8(workbookXml(sheetName(label))) },
    { name: "xl/_rels/workbook.xml.rels", data: utf8(WORKBOOK_RELS) },
    { name: "xl/worksheets/sheet1.xml", data: utf8(sheetXml(fields, rows)) },
    { name: "xl/styles.xml", data: utf8(stylesXml()) },
  ]);
}

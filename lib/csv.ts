// The CSV tokenizer, shared by every import in the codebase. Pure — no next/*
// imports, no supabase-js, no clock reads.
//
// Extracted from lib/dues.ts in Stage 6 phase 7b, when the roster import became
// the second caller. It is deliberately ONE implementation rather than a copy
// per importer: the reason it exists at all is a hazard a hand-rolled splitter
// gets wrong (see below), and a second copy is a second chance to get it wrong.
// Moving it out also keeps the roster importer from pulling the whole dues
// domain in behind it.

/**
 * Tokenize CSV text into rows of fields, handling quoted fields that contain
 * commas AND newlines.
 *
 * ⚠️ A `split("\n")` parser is not sufficient, and this is not a hypothetical:
 * a real Venmo export ends with a multi-line quoted legal disclaimer, so a
 * line-splitting parser breaks on the last record of **every** file. Verified
 * against a real statement on 2026-08-06. A roster CSV exported from a
 * spreadsheet has the same shape the moment one cell holds a newline — an
 * officer note, an address — so this applies to both callers.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  // Normalise line endings first so a CRLF file does not leave \r on every
  // last field — which would silently defeat every === comparison downstream.
  const input = text.replace(/\r\n?/g, "\n");

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  // A file not ending in a newline still has a final record.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

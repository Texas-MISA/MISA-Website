// Dues domain core (§4.1, §4.7, §7 Stage 6.5). Pure — no next/* imports, no
// supabase-js, no clock reads — so Vitest calls every export directly with
// injected values, the same contract as lib/events.ts, lib/attendance.ts and
// lib/members.ts. Anything request-shaped belongs in app/actions/dues.ts.
//
// The job: turn a Venmo statement CSV into rows, and decide as little as
// possible while doing it. Three things this module deliberately does NOT do,
// each carried over from check-in resolution (§4.2):
//
//   * It never creates a member. A note that resolves to nobody produces a row
//     with member_id null, queued for an officer.
//   * It never guesses. Two members named in one note is an ambiguous answer,
//     not a coin flip, and an amount matching no configured price returns null
//     rather than a best guess.
//   * It never drops anything. Every non-duplicate statement row becomes a
//     payment row — somebody sent real money and holds a receipt the system
//     would otherwise not have.

import { centralWallTimeToInstant } from "@/lib/events";

// ---------------------------------------------------------------------------
// Term arithmetic — the TypeScript mirror of migration 19
// ---------------------------------------------------------------------------

/**
 * 🪤 Terms do not sort lexicographically.
 *
 * `'Fall 2026' < 'Spring 2026'` is **true** as a string compare and **false**
 * as a calendar fact — the same class of error as `new Date("2026-09-01T18:00")`:
 * plausible output, wrong answer, no error anywhere. This module is the only
 * place term ordering is expressed, and no call site may compare two terms
 * directly.
 *
 * The index is the trick, and it matches `term_index()` in migration 19
 * character for character in behaviour: two terms a year, Spring before Fall.
 * `Spring 2026 → 4052`, `Fall 2026 → 4053`, `Spring 2027 → 4054`. Ordering
 * becomes integer comparison and stepping becomes addition.
 */
export function termIndex(term: string): number | null {
  const match = /^(Spring|Fall) (\d{4})$/.exec(term.trim());
  if (!match) return null;
  return Number(match[2]) * 2 + (match[1] === "Fall" ? 1 : 0);
}

/** The inverse of `termIndex`. */
export function termAtIndex(index: number): string {
  const season = index % 2 === 1 ? "Fall" : "Spring";
  return `${season} ${Math.floor(index / 2)}`;
}

/** The term after this one. `Fall 2026` → `Spring 2027`. */
export function nextTerm(term: string): string | null {
  const index = termIndex(term);
  return index === null ? null : termAtIndex(index + 1);
}

/**
 * The `n` terms a payment covers, starting at `start`.
 *
 * Null in, null out, and that is load-bearing rather than defensive: a payment
 * whose amount matched no configured price waits with `termsCovered` null, and
 * because the SQL column is generated from this, such a row covers **nothing**.
 * The member reads Not Paid until an officer decides. Under-reporting
 * membership is visible in the review queue; over-reporting it is visible
 * nowhere.
 */
export function termsFrom(start: string, n: number | null): string[] | null {
  const index = termIndex(start);
  if (index === null || n === null || n < 1) return null;
  return Array.from({ length: n }, (_, step) => termAtIndex(index + step));
}

/** True when `a` is a later term than `b`. Never use `<` on term strings. */
export function isLaterTerm(a: string, b: string): boolean {
  const left = termIndex(a);
  const right = termIndex(b);
  if (left === null || right === null) return false;
  return left > right;
}

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------

export type DuesPrices = {
  /** `app_settings.dues_one_term_cents`. */
  oneTermCents: number;
  /** `app_settings.dues_two_term_cents`. */
  twoTermCents: number;
};

/**
 * How many terms an amount buys.
 *
 * ⚠️ `null` is the "an officer decides" answer, not an error. Somebody tips,
 * somebody covers a friend, somebody underpays by a dollar — all of those
 * parse, link to their member, and wait in the queue. Returning null rather
 * than throwing is what keeps "nothing that arrived as money is dropped on the
 * floor" true.
 *
 * Exact match on cents. A near-miss is not rounded up: doing so would decide
 * on the member's behalf, which is the thing the review queue exists to avoid.
 */
export function termsForAmount(
  cents: number,
  prices: DuesPrices
): 1 | 2 | null {
  if (cents === prices.twoTermCents) return 2;
  if (cents === prices.oneTermCents) return 1;
  return null;
}

// ---------------------------------------------------------------------------
// Matching a note to a member
// ---------------------------------------------------------------------------

/**
 * The fold `members.normalized_eid` uses, mirrored exactly.
 *
 * If these two ever drift the match silently stops working — the SQL column is
 * `lower(regexp_replace(eid, '\s|-', '', 'g'))`.
 */
export function foldEid(raw: string): string {
  return raw.toLowerCase().replace(/[\s-]/g, "");
}

/**
 * A note token reduced to what could be an EID.
 *
 * Wider than `foldEid` on purpose: that one mirrors the SQL exactly, while this
 * also drops the trailing punctuation people actually write — `bk2856,` and
 * `rp8571.` are EIDs with a comma and a full stop attached. Real EIDs are
 * alphanumeric, so nothing is lost by discarding everything else.
 */
function tokenCandidate(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export type RosterEntry = { memberId: string; normalizedEid: string };

export type NoteMatch =
  | { kind: "matched"; memberId: string; token: string }
  | { kind: "ambiguous"; memberIds: string[] }
  | { kind: "none" };

/**
 * Find the member a payment note names.
 *
 * 🪤 **There is deliberately no EID regex here.** The schema has never
 * constrained EID shape — real ones run `rp8571`, `cag7284`, `mp8570` with no
 * fixed letter or digit count — so a pattern that tried to recognise "an
 * EID-looking token" would either miss real EIDs or match ordinary words like
 * "dues". Tokenizing and testing each token against the roster is exact by
 * construction and needs no maintenance when UT changes its format.
 *
 * **Exact match only.** Stage 5's "don't auto-resolve near-misses" carries over
 * intact: a note reading `rp8571 dues` links when the roster holds `rp8571`; a
 * note reading `rp8517` does not, and goes to the queue. The queue may offer
 * ranked suggestions — reuse `rankMemberSuggestions` from lib/attendance.ts
 * rather than growing a second ranker — with nothing preselected.
 *
 * Two or more DISTINCT members named is `ambiguous`, not a pick. The same
 * member named twice is still one member.
 */
export function matchNote(
  note: string | null,
  roster: readonly RosterEntry[]
): NoteMatch {
  if (!note) return { kind: "none" };

  const byEid = new Map<string, string>();
  for (const entry of roster) {
    if (entry.normalizedEid) byEid.set(entry.normalizedEid, entry.memberId);
  }

  // ⚠️ Split on WHITESPACE only, then strip punctuation inside each token —
  // not the other way round. Splitting on punctuation too would break `rp-8571`
  // into `rp` and `8571`, destroying the very thing the fold exists to repair:
  // `members.normalized_eid` strips `-` precisely so a hyphenated EID still
  // matches. Caught by a test, and it is a quiet failure — the note looks
  // matched to a human reader while the parser reports nothing.
  //
  // The consequence, and it is the right one: `rp 8571` with a real space does
  // NOT match. Two separate words are genuinely ambiguous, and "don't
  // auto-resolve near-misses" says to queue that rather than guess.
  const tokens = note.split(/\s+/).filter(Boolean);

  const hits = new Map<string, string>();
  for (const token of tokens) {
    const memberId = byEid.get(tokenCandidate(token));
    if (memberId) hits.set(memberId, token);
  }

  if (hits.size === 0) return { kind: "none" };
  if (hits.size > 1) return { kind: "ambiguous", memberIds: [...hits.keys()] };

  const [[memberId, token]] = [...hits.entries()];
  return { kind: "matched", memberId, token };
}

// ---------------------------------------------------------------------------
// The statement parser
// ---------------------------------------------------------------------------

/**
 * A CSV tokenizer that handles quoted fields containing commas AND newlines.
 *
 * ⚠️ A `split("\n")` parser is not sufficient here, and this is not a
 * hypothetical: a real Venmo export ends with a multi-line quoted legal
 * disclaimer, so a line-splitting parser breaks on the last record of every
 * file. Verified against a real statement on 2026-08-06.
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

/**
 * The header names a real Venmo export uses, recorded from an actual file on
 * 2026-08-06 rather than remembered.
 *
 * The shape that matters, and every part of it surprised: the header is on the
 * **third** line (lines 1–2 are `Account Statement - (@handle)` and
 * `Account Activity`), there is a **leading empty column**, and the file has 22
 * fields. Columns are located by NAME rather than position so a Venmo reorder
 * does not silently shift every value one to the left.
 */
const HEADER_ID = "ID";
const REQUIRED_HEADERS = [HEADER_ID, "Datetime", "Amount (total)"] as const;

export type ParsedPayment = {
  venmoTxnId: string;
  /** The instant, with Central attached — see the note on parsing. */
  paidAt: Date;
  amountCents: number;
  note: string | null;
  payerName: string | null;
  payerHandle: string | null;
};

export type ParsedStatement = {
  payments: ParsedPayment[];
  /** Rows skipped, with why — surfaced in the import preview, never silent. */
  skipped: { reason: SkipReason; count: number }[];
};

export type SkipReason =
  | "no_transaction_id"
  | "not_a_payment"
  | "not_complete"
  | "not_incoming"
  | "unparseable_amount"
  | "unparseable_datetime";

/**
 * ⚠️ A Venmo amount is `+ $30.00` or `- $18.50` — the sign is a **separate
 * token** before the currency symbol, so `parseFloat` on the raw string returns
 * `NaN`, and stripping non-numerics without reading the sign first silently
 * turns a withdrawal into a payment.
 *
 * On the MISA account **dues are POSITIVE**, because the org is receiving. A
 * negative amount is money leaving — a bank transfer or a refund — and is never
 * a due.
 *
 * Cents, never floats: `parseFloat("30.10") * 100` is `3009.9999...`.
 */
export function parseAmountCents(raw: string): number | null {
  const match = /^\s*([+-])?\s*\$\s*([\d,]+)(?:\.(\d{1,2}))?\s*$/.exec(raw);
  if (!match) return null;

  const sign = match[1] === "-" ? -1 : 1;
  const whole = Number(match[2].replace(/,/g, ""));
  const fraction = Number((match[3] ?? "0").padEnd(2, "0"));
  if (!Number.isFinite(whole) || !Number.isFinite(fraction)) return null;

  return sign * (whole * 100 + fraction);
}

/**
 * ⚠️ Venmo stamps a transaction `2026-09-03T19:22:00` — with **no timezone
 * offset at all**.
 *
 * That string is parsed as *local* time by JS, which on this server is UTC, so
 * `new Date(raw)` reads a 9pm Central payment as 9pm UTC and lands it four to
 * five hours early. It is exactly the `new Date("2026-09-01T18:00")` trap this
 * codebase already carries, arriving through a new door.
 *
 * **Decided 2026-08-06: the stamp is Central wall time**, attached explicitly
 * via the same helper every event uses. Venmo renders statements in the
 * account's own timezone and the org is in Texas. The bounded cost of being
 * wrong is a payment near midnight on a term boundary landing one term out,
 * which is precisely why `start_term` is a default rather than a generated
 * column — an officer can override it.
 */
export function parseVenmoDatetime(raw: string): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(raw.trim());
  if (!match) return null;
  return centralWallTimeToInstant(match[1], match[2]);
}

function indexHeaders(row: string[]): Map<string, number> | null {
  const headers = new Map<string, number>();
  row.forEach((name, i) => {
    const clean = name.trim();
    if (clean && !headers.has(clean)) headers.set(clean, i);
  });
  return REQUIRED_HEADERS.every((h) => headers.has(h)) ? headers : null;
}

/**
 * Parse a Venmo statement into payment rows.
 *
 * Only **completed, incoming payments** are dues. A statement also carries bank
 * withdrawals (`Standard Transfer`), balance rows with no transaction id, and
 * the trailing disclaimer — none of which are money a member sent, and all of
 * which are counted in `skipped` rather than dropped quietly, so the import
 * preview can show an officer that the numbers add up.
 */
export function parseVenmoStatement(csv: string): ParsedStatement {
  const rows = parseCsv(csv);

  // The header is not on line 1, so find it rather than assuming an offset.
  let headers: Map<string, number> | null = null;
  let start = 0;
  for (let i = 0; i < rows.length; i++) {
    const found = indexHeaders(rows[i]);
    if (found) {
      headers = found;
      start = i + 1;
      break;
    }
  }
  if (!headers) return { payments: [], skipped: [] };

  const at = (row: string[], name: string): string => {
    const index = headers.get(name);
    return index === undefined ? "" : (row[index] ?? "").trim();
  };

  const payments: ParsedPayment[] = [];
  const skips = new Map<SkipReason, number>();
  const skip = (reason: SkipReason) =>
    skips.set(reason, (skips.get(reason) ?? 0) + 1);

  for (const row of rows.slice(start)) {
    // Balance rows and the multi-line footer both arrive as rows with no id.
    // Keying on that rather than on line position means a new Venmo preamble
    // row does not break the parser.
    const venmoTxnId = at(row, HEADER_ID);
    if (!venmoTxnId) {
      skip("no_transaction_id");
      continue;
    }

    const type = at(row, "Type");
    if (type && type !== "Payment") {
      skip("not_a_payment");
      continue;
    }

    const status = at(row, "Status");
    if (status && status !== "Complete") {
      skip("not_complete");
      continue;
    }

    const amountCents = parseAmountCents(at(row, "Amount (total)"));
    if (amountCents === null) {
      skip("unparseable_amount");
      continue;
    }
    // Money going out is not dues. A refund is a void with a reason, not a
    // negative payment — amount_cents is positive-only in the schema.
    if (amountCents <= 0) {
      skip("not_incoming");
      continue;
    }

    const paidAt = parseVenmoDatetime(at(row, "Datetime"));
    if (!paidAt) {
      skip("unparseable_datetime");
      continue;
    }

    const payerName = at(row, "From") || null;

    payments.push({
      venmoTxnId,
      paidAt,
      amountCents,
      note: at(row, "Note") || null,
      payerName,
      // Venmo's statement carries a display name rather than a handle in the
      // From column. Kept as its own field because the ledger wants to show
      // whichever it has, and a later export format may separate them.
      payerHandle: null,
    });
  }

  return {
    payments,
    skipped: [...skips.entries()].map(([reason, count]) => ({ reason, count })),
  };
}

// ---------------------------------------------------------------------------
// Putting a parsed row together with the roster
// ---------------------------------------------------------------------------

export type PlannedPayment = ParsedPayment & {
  memberId: string | null;
  submittedEid: string | null;
  termsCovered: 1 | 2 | null;
  /** Why an officer needs to look at this row, or null when none do. */
  review: "unmatched" | "ambiguous" | "undecided_amount" | null;
};

/**
 * Decide what a parsed row becomes, without writing anything.
 *
 * This is the decision table from `docs/dues-and-membership.md` in one place.
 * Every outcome produces a row — there is no "unparseable, skip it" branch,
 * because §4.2's rule is stronger for money than it is for attendance:
 * somebody sent real money and holds a receipt the system would otherwise not
 * have.
 *
 * Note the two independent review reasons. A row can be matched to a member and
 * still need review because the amount bought an unclear number of terms, and
 * `ambiguous` outranks `undecided_amount` because not knowing *who* paid is the
 * bigger problem.
 */
export function planPayment(
  payment: ParsedPayment,
  roster: readonly RosterEntry[],
  prices: DuesPrices
): PlannedPayment {
  const match = matchNote(payment.note, roster);
  const termsCovered = termsForAmount(payment.amountCents, prices);

  if (match.kind === "matched") {
    return {
      ...payment,
      memberId: match.memberId,
      submittedEid: match.token,
      termsCovered,
      review: termsCovered === null ? "undecided_amount" : null,
    };
  }

  return {
    ...payment,
    memberId: null,
    submittedEid: null,
    termsCovered,
    review: match.kind === "ambiguous" ? "ambiguous" : "unmatched",
  };
}

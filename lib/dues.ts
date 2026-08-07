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

import {
  MAX_SUGGESTED_MEMBERS,
  MIN_SUGGESTION_SCORE,
  scoreMemberMatch,
  type MatchReason,
  type MemberCandidate,
  type MemberSuggestion,
} from "@/lib/attendance";
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

/**
 * How many terms one payment may be recorded as covering.
 *
 * Mirrors `check (terms_covered between 1 and 4)` in migration 19. The database
 * is the guarantee; this is what turns a violation into a `<select>` an officer
 * cannot get wrong.
 */
export const MAX_TERMS_COVERED = 4;

/**
 * The terms the editor offers for `start_term`, derived rather than typed.
 *
 * §4.7 forbids a literal term string anywhere in application code, and that
 * applies to a picker's options as much as to a query — so these are stepped off
 * `termOf(paidAt)` by index. The window is one term back and two forward, which
 * covers the two corrections that actually happen: the summer case (a July
 * payment lands in Spring and the payer meant the coming Fall) and a payment
 * made either side of midnight on a term boundary.
 *
 * ⚠️ `include` appends a value that falls outside the window, and it is not
 * optional politeness. A `<select>` whose value matches no `<option>` renders
 * **blank** in every browser, so a row whose `start_term` was written by the
 * pre-fix column default would show as holding nothing and the officer's next
 * save would silently rewrite it. Same defect, same remedy, as the orphaned
 * custom-field option in `fieldOptions()`.
 */
export function startTermOptions(
  paidAt: Date,
  include: string | null = null
): string[] {
  const base = termIndex(termOf(paidAt));
  if (base === null) return include ? [include] : [];

  const indexes = new Set<number>();
  for (let step = -1; step <= 2; step++) indexes.add(base + step);

  const extra = include === null ? null : termIndex(include);
  if (extra !== null) indexes.add(extra);

  return [...indexes].sort((a, b) => a - b).map(termAtIndex);
}

/**
 * 🪤 Does this payment land in the summer, where §4.7 puts May–July in Spring?
 *
 * Pay $30 in July intending to cover the coming Fall and it buys a term with
 * three weeks left in it. The rule is NOT changed — changing it would make
 * `term_of` disagree with itself between events and payments — so the import
 * warns instead, and `start_term` is a default rather than a generated column
 * precisely so an officer can correct it afterwards.
 *
 * Central months, because that is the zone `term_of` anchors to.
 */
export function isSummerTerm(paidAt: Date): boolean {
  const { month } = centralMonthYear(paidAt);
  return month >= 5 && month <= 7;
}

/** The Central month and year of an instant — the anchor `term_of` uses. */
function centralMonthYear(at: Date): { month: number; year: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "numeric",
    year: "numeric",
  }).formatToParts(at);
  const field = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { month: field("month"), year: field("year") };
}

/**
 * The term an instant falls in — the TypeScript mirror of SQL `term_of()`.
 *
 * ⚠️ **The application must set `start_term` explicitly; the column default
 * cannot.** `dues_payments.start_term` defaults to `term_of(now())`, and a
 * Postgres column default is not allowed to reference another column — so the
 * default can only ever ask "what term is it *now*", never "what term was this
 * payment made in". Those differ for every statement uploaded after a term
 * boundary, which is the normal case: import July's statement in August and the
 * default files a Spring payment under Fall.
 *
 * Found in the phase-2 browser walkthrough, where the preview said a June
 * payment counted as Spring and the stored row said Fall — the UI and the
 * database disagreeing about the same payment.
 *
 * This is not "typing a term string" (§4.7): the term is *derived* from the
 * payment date by the same rule the database uses, which is exactly what this
 * module exists to hold.
 */
export function termOf(at: Date): string {
  const { month, year } = centralMonthYear(at);
  return month >= 8 ? `Fall ${year}` : `Spring ${year}`;
}

// ---------------------------------------------------------------------------
// Import bounds
// ---------------------------------------------------------------------------

/**
 * How much CSV text one import may carry.
 *
 * ⚠️ Deliberately BELOW Next's own 1MB Server Action body cap, so an officer
 * who overshoots gets a sentence naming the limit rather than an opaque
 * framework error. A real monthly statement measured about 2 KB, so this is
 * three orders of magnitude of headroom — a guard rail, not a constraint.
 *
 * Refuses; never truncates. Importing the first N bytes of a statement would
 * cut a row in half and silently drop the rest of the month.
 */
export const MAX_IMPORT_BYTES = 512 * 1024;

/**
 * How many payments one import may carry.
 *
 * Sized well above §2.2's worst case (500 members paying twice a year through
 * one account). Same rule as `MAX_EXPORT_ROWS`: it refuses loudly, because a
 * partial import reported as success is somebody's dues going missing.
 */
export const MAX_IMPORT_ROWS = 2000;

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
 * Cents as money — `3000` → `"$30.00"`.
 *
 * Every amount on every dues screen goes through this rather than dividing by
 * 100 at the call site. Amounts are stored in cents precisely because floats
 * round differently in JS and Postgres, and a stray `/ 100` at a render site is
 * how that discipline leaks back out.
 *
 * Not `Intl.NumberFormat`: this runs in Server Components today but the value
 * ends up in Client Component props, and Node and Chrome ship different ICU
 * data — the hydration trap that already cost this codebase a debugging
 * session. Fixed-format arithmetic has no such split.
 */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(cents));
  const whole = String(Math.floor(abs / 100)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ","
  );
  return `${sign}$${whole}.${String(abs % 100).padStart(2, "0")}`;
}

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

/**
 * How many note tokens are considered.
 *
 * A note is member-supplied free text of arbitrary length, and
 * `rankPaymentSuggestions` scores the whole roster once per token. This bounds
 * that product. Unlike `MEMBER_SCAN_LIMIT` it truncates nothing an officer can
 * miss: an EID people actually write sits in the first handful of words, and
 * the exact-match path in `matchNote` is deliberately *not* bounded, so nothing
 * that would have linked is affected.
 */
const MAX_NOTE_TOKENS = 12;

/**
 * The note reduced to EID candidates — the one tokenizer, shared by the exact
 * matcher and the suggestion ranker so the two cannot disagree about what a
 * token is.
 *
 * ⚠️ Split on **whitespace only**, then strip punctuation *within* each token,
 * never the other way round. Splitting on punctuation too would break `rp-8571`
 * into `rp` and `8571` and match neither — destroying the very thing
 * `members.normalized_eid` strips `-` for. A test caught this in phase 1, and it
 * is a quiet failure: the note looks matched to a human reader while the parser
 * reports nothing.
 *
 * The consequence, and it is the right one: `rp 8571` with a real space does NOT
 * match. Two separate words are genuinely ambiguous, and "don't auto-resolve
 * near-misses" says to queue that rather than guess.
 */
export function noteTokens(note: string | null): string[] {
  const seen = new Set<string>();
  for (const { folded } of noteTokenPairs(note)) seen.add(folded);
  return [...seen];
}

/**
 * Each note token as the pair the two consumers need: the **raw** word, which is
 * what gets stored in `submitted_eid` so the audit trail shows what the payer
 * actually wrote, and its fold, which is what an equality against
 * `members.normalized_eid` can be run on.
 */
function noteTokenPairs(
  note: string | null
): { raw: string; folded: string }[] {
  if (!note) return [];
  const pairs: { raw: string; folded: string }[] = [];
  for (const raw of note.split(/\s+/)) {
    const folded = tokenCandidate(raw);
    if (folded) pairs.push({ raw, folded });
  }
  return pairs;
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

  // The shared tokenizer — see noteTokens for why the split is on whitespace
  // only. The RAW word is what gets remembered, so `submitted_eid` records what
  // the payer actually wrote rather than a normalized version of it.
  const hits = new Map<string, string>();
  for (const { raw, folded } of noteTokenPairs(note)) {
    const memberId = byEid.get(folded);
    if (memberId) hits.set(memberId, raw);
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

// ---------------------------------------------------------------------------
// The review queue (§7 Stage 6.5 phase 3)
// ---------------------------------------------------------------------------

/**
 * Why a stored payment still needs an officer.
 *
 * ⚠️ This is derived from the **stored row**, not from `PlannedPayment.review`,
 * and it deliberately says less. `unmatched` and `ambiguous` are two different
 * parse outcomes but only one storage outcome — `member_id` null — because
 * nothing persists which of them happened. A ledger that claimed to distinguish
 * them would be inventing information the row does not carry, so it reports
 * "no member" for both. Recovering the distinction means re-reading the note,
 * which is exactly what the officer is about to do anyway.
 *
 * The two flags are independent: a payment can be credited to the right member
 * and still be waiting on what its amount bought.
 */
export function paymentReviewState(row: {
  member_id: string | null;
  terms_covered: number | null;
  voided_at: string | null;
}): { noMember: boolean; undecidedAmount: boolean; needsReview: boolean } {
  // A voided payment is settled, whatever it is missing. It counts for nothing
  // and no officer action will change that, so it must never sit in the queue.
  const live = row.voided_at === null;
  const noMember = live && row.member_id === null;
  const undecidedAmount = live && row.terms_covered === null;
  return { noMember, undecidedAmount, needsReview: noMember || undecidedAmount };
}

/**
 * Rank roster candidates for a payment whose note named nobody.
 *
 * 🪤 **This is a new *caller* of the Stage 5 ranker, not a second ranker.** The
 * scoring rules, the weights, and `MIN_SUGGESTION_SCORE` all stay in
 * lib/attendance.ts, where the calibration argument lives; growing a parallel
 * set here is how the two would drift into disagreeing about the same roster.
 *
 * A payment carries a weaker identity than a check-in — a Venmo display name
 * and free-text note, no email, and no single field that *is* an EID. So the
 * payment is scored as several identities and each candidate keeps its best:
 * the payer name alone, and the payer name paired with each note token as a
 * candidate EID. That is what catches the case this stage's exit criterion
 * names — a note reading `rp8517` for a roster holding `rp8571` is one edit
 * apart, which stands alone, while the payer's name is corroboration on top.
 *
 * Taking the best rather than the sum matters: summing across tokens would let
 * a long note full of near-misses accumulate its way past the floor, which is
 * precisely the "confident-looking stranger" failure the floor exists to stop.
 *
 * Returns `[]` freely. An empty list is a valid answer, not a gap.
 */
export function rankPaymentSuggestions(
  payment: { payerName: string | null; note: string | null },
  candidates: readonly MemberCandidate[],
  limit = MAX_SUGGESTED_MEMBERS
): MemberSuggestion[] {
  const fullName = payment.payerName ?? "";
  const tokens = noteTokens(payment.note).slice(0, MAX_NOTE_TOKENS);

  const identities = [
    { fullName, email: "", eid: "", normalizedEid: "" },
    ...tokens.map((token) => ({
      fullName,
      email: "",
      // Already folded by noteTokens, and `members.normalized_eid` uses the
      // same fold — so raw and normalized are the same string here.
      eid: token,
      normalizedEid: token,
    })),
  ];

  return candidates
    .map((member) => {
      let best: { score: number; reasons: MatchReason[] } = {
        score: Number.NEGATIVE_INFINITY,
        reasons: [],
      };
      for (const identity of identities) {
        const scored = scoreMemberMatch(identity, member);
        if (scored.score > best.score) best = scored;
      }
      return { member, ...best };
    })
    .filter((entry) => entry.score >= MIN_SUGGESTION_SCORE)
    .sort(
      (a, b) =>
        b.score - a.score || a.member.fullName.localeCompare(b.member.fullName)
    )
    .slice(0, limit);
}

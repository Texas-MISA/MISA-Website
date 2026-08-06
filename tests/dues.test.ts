import { describe, expect, it } from "vitest";

import {
  foldEid,
  isLaterTerm,
  matchNote,
  nextTerm,
  parseAmountCents,
  parseCsv,
  parseVenmoDatetime,
  parseVenmoStatement,
  termOf,
  planPayment,
  termAtIndex,
  termIndex,
  termsForAmount,
  termsFrom,
  type DuesPrices,
  type RosterEntry,
} from "@/lib/dues";

// Pure tests for the dues core (§7 Stage 6.5 phase 1). No database and no
// clock — the parser takes text and the matcher takes a roster.
//
// 🔒 Every fixture here is hand-built and obviously fake. The repo is public,
// and the real statement this parser was written against is somebody's actual
// financial history: its *shape* is reproduced below, none of its data is.

const PRICES: DuesPrices = { oneTermCents: 3000, twoTermCents: 5000 };

const ROSTER: RosterEntry[] = [
  { memberId: "m-rowan", normalizedEid: "rp8571" },
  { memberId: "m-amara", normalizedEid: "ao4471" },
  { memberId: "m-bela", normalizedEid: "bk2856" },
];

// ---------------------------------------------------------------------------
// Term arithmetic
// ---------------------------------------------------------------------------

describe("term arithmetic", () => {
  it("🪤 orders terms correctly where a string compare does not", () => {
    // The trap this module exists to close, asserted from both sides: the
    // string compare is wrong and the index is right.
    expect("Fall 2026" < "Spring 2026").toBe(true);
    expect(isLaterTerm("Fall 2026", "Spring 2026")).toBe(true);
    expect(isLaterTerm("Spring 2026", "Fall 2026")).toBe(false);
  });

  it("indexes two terms a year, Spring before Fall", () => {
    expect(termIndex("Spring 2026")).toBe(4052);
    expect(termIndex("Fall 2026")).toBe(4053);
    expect(termIndex("Spring 2027")).toBe(4054);
  });

  it("round-trips through the index", () => {
    for (const term of ["Spring 2026", "Fall 2026", "Spring 2099"]) {
      expect(termAtIndex(termIndex(term)!)).toBe(term);
    }
  });

  it("steps across the year boundary", () => {
    expect(nextTerm("Spring 2026")).toBe("Fall 2026");
    expect(nextTerm("Fall 2026")).toBe("Spring 2027");
    expect(nextTerm("Fall 2099")).toBe("Spring 2100");
  });

  it("covers the documented spans", () => {
    expect(termsFrom("Fall 2026", 2)).toEqual(["Fall 2026", "Spring 2027"]);
    expect(termsFrom("Fall 2026", 1)).toEqual(["Fall 2026"]);
    expect(termsFrom("Spring 2026", 4)).toEqual([
      "Spring 2026",
      "Fall 2026",
      "Spring 2027",
      "Fall 2027",
    ]);
  });

  it("⚠️ covers NOTHING when nobody has decided how many terms", () => {
    // Generated from this in SQL, so an undecided payment leaves the member
    // reading Not Paid rather than quietly counting as paid.
    expect(termsFrom("Fall 2026", null)).toBeNull();
    expect(termsFrom("Fall 2026", 0)).toBeNull();
  });

  it("rejects a malformed term rather than inventing one", () => {
    for (const bad of ["Summer 2026", "Fall", "2026", "fall 2026", ""]) {
      expect(termIndex(bad), bad).toBeNull();
    }
  });
});

describe("termOf", () => {
  it("mirrors the SQL term_of: August starts Fall, January is Spring", () => {
    // §4.7's half-open boundaries. Aug 1 is Fall, Jan 1 is Spring.
    expect(termOf(new Date("2026-08-01T12:00:00Z"))).toBe("Fall 2026");
    expect(termOf(new Date("2026-07-31T12:00:00Z"))).toBe("Spring 2026");
    expect(termOf(new Date("2026-01-01T12:00:00Z"))).toBe("Spring 2026");
    expect(termOf(new Date("2026-12-31T12:00:00Z"))).toBe("Fall 2026");
  });

  it("🪤 anchors on Central, so a late-evening payment does not roll a term", () => {
    // 2026-07-31 20:00 Central is 2026-08-01 01:00Z. Anchoring on UTC would
    // call it Fall; it is Spring.
    expect(termOf(new Date("2026-08-01T01:00:00Z"))).toBe("Spring 2026");
  });

  it("⚠️ is why the import sets start_term rather than letting SQL default it", () => {
    // The column defaults to term_of(now()) — the IMPORT time — because a
    // Postgres default cannot reference another column. Those differ for every
    // statement uploaded after a term boundary, which is the ordinary case.
    // Found in the phase-2 walkthrough: the preview said a June payment counted
    // as Spring while the stored row said Fall.
    const paidInJune = new Date("2026-06-14T15:00:00Z");
    const importedInSeptember = new Date("2026-09-20T15:00:00Z");

    expect(termOf(paidInJune)).toBe("Spring 2026");
    expect(termOf(importedInSeptember)).toBe("Fall 2026");
    expect(termOf(paidInJune)).not.toBe(termOf(importedInSeptember));
  });
});

// ---------------------------------------------------------------------------
// Amounts
// ---------------------------------------------------------------------------

describe("parseAmountCents", () => {
  it("🪤 reads the sign, which sits before the currency symbol", () => {
    // `- $18.50` — parseFloat on that is NaN, and stripping non-numerics
    // without reading the sign first turns a withdrawal into a payment.
    expect(parseAmountCents("+ $30.00")).toBe(3000);
    expect(parseAmountCents("- $18.50")).toBe(-1850);
    expect(parseAmountCents("$50.00")).toBe(5000);
  });

  it("works in cents, never floats", () => {
    // parseFloat("30.10") * 100 is 3009.9999999999995.
    expect(parseAmountCents("+ $30.10")).toBe(3010);
    expect(parseAmountCents("+ $0.01")).toBe(1);
    expect(parseAmountCents("+ $1,234.56")).toBe(123456);
  });

  it("returns null rather than guessing at junk", () => {
    for (const bad of ["", "thirty dollars", "$", "+ $", "30.00"]) {
      expect(parseAmountCents(bad), bad).toBeNull();
    }
  });
});

describe("termsForAmount", () => {
  it("maps the two configured prices", () => {
    expect(termsForAmount(3000, PRICES)).toBe(1);
    expect(termsForAmount(5000, PRICES)).toBe(2);
  });

  it("⚠️ answers null for anything else — that is 'an officer decides'", () => {
    // Somebody tips, somebody covers a friend, somebody underpays by a dollar.
    // All parse, all link, all wait. Rounding to the nearest price would decide
    // on the member's behalf, which is what the queue exists to avoid.
    for (const odd of [2999, 3001, 4000, 5001, 10000]) {
      expect(termsForAmount(odd, PRICES), String(odd)).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

describe("matchNote", () => {
  it("links a note carrying exactly one member's EID", () => {
    const match = matchNote("rp8571 dues", ROSTER);
    expect(match).toEqual({
      kind: "matched",
      memberId: "m-rowan",
      token: "rp8571",
    });
  });

  it("applies the same fold as members.normalized_eid", () => {
    for (const note of ["RP8571", "rp-8571", "Dues RP8571!", "bk2856,"]) {
      expect(matchNote(note, ROSTER).kind, note).toBe("matched");
    }
    expect(foldEid("RP-85 71")).toBe("rp8571");
  });

  it("⚠️ splits on whitespace only, so a hyphenated EID survives", () => {
    // Tokenizing on punctuation as well would break `rp-8571` into `rp` and
    // `8571` and match neither — destroying the thing the SQL fold strips `-`
    // for. A quiet failure: the note reads as matched to a human.
    expect(matchNote("rp-8571", ROSTER).kind).toBe("matched");
    // The accepted consequence: a real space makes two words, which is
    // genuinely ambiguous, so it queues rather than guesses.
    expect(matchNote("rp 8571", ROSTER).kind).toBe("none");
  });

  it("🪤 is exact-match only — a near miss goes to the queue", () => {
    // Stage 5's "don't auto-resolve near-misses" carried over intact. rp8517 is
    // one transposition from a real member and must NOT link.
    expect(matchNote("rp8517 dues", ROSTER).kind).toBe("none");
  });

  it("reports ambiguity rather than picking", () => {
    const match = matchNote("rp8571 and ao4471 splitting dues", ROSTER);
    expect(match.kind).toBe("ambiguous");
    if (match.kind === "ambiguous") {
      expect(match.memberIds.sort()).toEqual(["m-amara", "m-rowan"]);
    }
  });

  it("treats the same member named twice as one member", () => {
    expect(matchNote("rp8571 rp8571", ROSTER).kind).toBe("matched");
  });

  it("finds nothing in a note with no EID, and does not throw", () => {
    for (const note of ["dues", "", "🎉 for the club", null]) {
      expect(matchNote(note, ROSTER).kind).toBe("none");
    }
  });

  it("🪤 does not try to recognise EID *shape*", () => {
    // There is no EID regex on purpose — the schema has never constrained the
    // format. A token that looks EID-shaped but is on no roster is nothing.
    expect(matchNote("ab1234 dues", ROSTER).kind).toBe("none");
  });
});

// ---------------------------------------------------------------------------
// The CSV tokenizer and the statement parser
// ---------------------------------------------------------------------------

describe("parseCsv", () => {
  it("keeps commas inside quoted fields", () => {
    expect(parseCsv('a,"b,c",d')).toEqual([["a", "b,c", "d"]]);
  });

  it("⚠️ keeps NEWLINES inside quoted fields", () => {
    // Not hypothetical: a real Venmo export ends with a multi-line quoted legal
    // disclaimer, so a split("\n") parser breaks on the last record of every
    // single file.
    expect(parseCsv('a,"line one\nline two",c')).toEqual([
      ["a", "line one\nline two", "c"],
    ]);
  });

  it("unescapes doubled quotes", () => {
    expect(parseCsv('a,"say ""hi""",c')).toEqual([["a", 'say "hi"', "c"]]);
  });

  it("normalises CRLF so no field keeps a trailing \\r", () => {
    expect(parseCsv("a,b\r\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

/**
 * A fixture reproducing the real export's SHAPE, recorded 2026-08-06:
 * two preamble lines, the header on line 3 with a leading empty column, a
 * balance row carrying no id, and a multi-line quoted disclaimer at the end.
 * The data is invented.
 */
const STATEMENT = [
  "Account Statement - (@Fake-Org) ,,,,,,,,,",
  "Account Activity,,,,,,,,,",
  ",ID,Datetime,Type,Status,Note,From,To,Amount (total),Disclaimer",
  ",,,,,,,,,",
  ",1001,2026-09-03T14:05:00,Payment,Complete,rp8571 dues,Rowan Pike,MISA,+ $50.00,",
  ",1002,2026-09-04T09:12:00,Payment,Complete,dues,Anon Person,MISA,+ $30.00,",
  ",1003,2026-09-05T18:30:00,Standard Transfer,Complete,,MISA,Bank,- $80.00,",
  ",1004,2026-09-06T11:00:00,Payment,Pending,ao4471,Amara Osei,MISA,+ $30.00,",
  ',1005,2026-09-07T20:15:00,Payment,Complete,"bk2856, thanks!",Bela Kovacs,MISA,+ $42.00,',
  ',,,,,,,,,"Legal disclaimer',
  'spanning two lines."',
].join("\n");

describe("parseVenmoStatement", () => {
  const parsed = parseVenmoStatement(STATEMENT);

  it("finds the header on line 3, not line 1", () => {
    expect(parsed.payments.length).toBeGreaterThan(0);
  });

  it("keeps only completed incoming payments", () => {
    expect(parsed.payments.map((p) => p.venmoTxnId)).toEqual([
      "1001",
      "1002",
      "1005",
    ]);
  });

  it("counts what it skipped rather than dropping it silently", () => {
    const reasons = Object.fromEntries(
      parsed.skipped.map((s) => [s.reason, s.count])
    );
    // The bank withdrawal, the pending payment, and the id-less rows: the
    // preamble spacer, the balance row and the disclaimer.
    expect(reasons.not_a_payment).toBe(1);
    expect(reasons.not_complete).toBe(1);
    expect(reasons.no_transaction_id).toBeGreaterThanOrEqual(2);
  });

  it("parses amounts to cents", () => {
    expect(parsed.payments.map((p) => p.amountCents)).toEqual([5000, 3000, 4200]);
  });

  it("survives a note containing a comma", () => {
    const row = parsed.payments.find((p) => p.venmoTxnId === "1005");
    expect(row?.note).toBe("bk2856, thanks!");
  });

  it("keeps the payer name, which is the only handle on an unmatched row", () => {
    expect(parsed.payments[0].payerName).toBe("Rowan Pike");
  });

  it("returns nothing rather than throwing on a file with no header", () => {
    expect(parseVenmoStatement("not,a,venmo,file").payments).toEqual([]);
  });
});

describe("parseVenmoDatetime", () => {
  it("🪤 treats the offset-less stamp as CENTRAL, not UTC", () => {
    // Venmo writes `2026-09-03T19:22:00` with no zone. `new Date(raw)` reads
    // that as local — UTC on this server — landing an evening Central payment
    // five hours early. Same class as new Date("2026-09-01T18:00").
    const parsed = parseVenmoDatetime("2026-09-03T19:22:00");
    // 19:22 CDT is 00:22Z the following day.
    expect(parsed?.toISOString()).toBe("2026-09-04T00:22:00.000Z");
    expect(parsed?.toISOString()).not.toBe("2026-09-03T19:22:00.000Z");
  });

  it("handles the winter offset too", () => {
    // 19:22 CST is 01:22Z — an hour later than the summer case, which is what
    // makes attaching the zone (rather than a fixed offset) load-bearing.
    expect(parseVenmoDatetime("2026-01-27T19:22:00")?.toISOString()).toBe(
      "2026-01-28T01:22:00.000Z"
    );
  });

  it("returns null on junk", () => {
    expect(parseVenmoDatetime("yesterday")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The decision table
// ---------------------------------------------------------------------------

describe("planPayment — every row of the decision table", () => {
  const parse = (note: string | null, cents: number) =>
    planPayment(
      {
        venmoTxnId: "t",
        paidAt: new Date("2026-09-03T19:05:00.000Z"),
        amountCents: cents,
        note,
        payerName: "Fake Payer",
        payerHandle: null,
      },
      ROSTER,
      PRICES
    );

  it("one-term price + exactly one member → linked, 1 term, no review", () => {
    const row = parse("rp8571", 3000);
    expect(row.memberId).toBe("m-rowan");
    expect(row.termsCovered).toBe(1);
    expect(row.review).toBeNull();
  });

  it("two-term price + exactly one member → linked, 2 terms, no review", () => {
    const row = parse("rp8571", 5000);
    expect(row.termsCovered).toBe(2);
    expect(row.review).toBeNull();
  });

  it("⚠️ odd amount + one member → linked, terms null, queued", () => {
    // The row an implementation is most likely to get wrong by rejecting it.
    const row = parse("rp8571", 4200);
    expect(row.memberId).toBe("m-rowan");
    expect(row.termsCovered).toBeNull();
    expect(row.review).toBe("undecided_amount");
  });

  it("no member → stored unmatched, and never invents a member", () => {
    const row = parse("dues", 5000);
    expect(row.memberId).toBeNull();
    expect(row.submittedEid).toBeNull();
    expect(row.review).toBe("unmatched");
    // Still a row. Nothing that arrived as money is dropped on the floor.
    expect(row.amountCents).toBe(5000);
  });

  it("two members → stored, queued, tie not broken", () => {
    const row = parse("rp8571 ao4471", 5000);
    expect(row.memberId).toBeNull();
    expect(row.review).toBe("ambiguous");
  });

  it("⚠️ ambiguity outranks an undecided amount", () => {
    // Both problems at once: not knowing WHO paid is the bigger one.
    expect(parse("rp8571 ao4471", 4200).review).toBe("ambiguous");
  });

  it("records the token it matched on, for the audit trail", () => {
    expect(parse("Dues RP-8571", 3000).submittedEid).toBe("RP-8571");
  });
});

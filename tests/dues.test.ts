import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { MemberCandidate } from "@/lib/attendance";
import {
  foldEid,
  formatCents,
  isLaterTerm,
  matchNote,
  nextTerm,
  noteTokens,
  paidThroughTerm,
  parseAmountCents,
  parseCsv,
  parseVenmoDatetime,
  parseVenmoStatement,
  paymentReviewState,
  rankPaymentSuggestions,
  startTermOptions,
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

// Stage 6.5 phase 4. The member detail page's "paid through", which is the one
// place in the app that asks "which of these terms is latest" over a real
// member's payments — and therefore the likeliest place for the lexicographic
// trap to be re-introduced.
describe("paidThroughTerm", () => {
  const live = (...coveredTerms: string[]) => ({
    coveredTerms,
    voided: false,
  });

  it("🪤 answers where max() over the strings would not", () => {
    // The whole trap in one assertion. Sorted as text, "Spring 2027" beats
    // "Fall 2027" and the member appears paid through a term that has not
    // arrived — plausible output, wrong answer, no error anywhere.
    const payments = [live("Spring 2027"), live("Fall 2027")];
    const lexicographic = payments
      .flatMap((p) => p.coveredTerms)
      .sort()
      .at(-1);

    expect(lexicographic).toBe("Spring 2027");
    expect(paidThroughTerm(payments)).toBe("Fall 2027");
  });

  it("takes the latest term across every live payment", () => {
    expect(
      paidThroughTerm([
        live("Fall 2026", "Spring 2027"),
        live("Spring 2026"),
      ])
    ).toBe("Spring 2027");
  });

  it("counts a voided payment for nothing", () => {
    // A void takes coverage away — that is what makes it the reversible record
    // it is, rather than a delete.
    expect(
      paidThroughTerm([
        { coveredTerms: ["Fall 2027"], voided: true },
        live("Fall 2026"),
      ])
    ).toBe("Fall 2026");

    expect(
      paidThroughTerm([{ coveredTerms: ["Fall 2027"], voided: true }])
    ).toBeNull();
  });

  it("counts an undecided amount for nothing", () => {
    // covered_terms is generated from a nullable terms_covered, so a payment
    // nobody has ruled on arrives here as null and buys no term. Under-reporting
    // is the intended direction: the review queue makes it visible.
    expect(paidThroughTerm([{ coveredTerms: null, voided: false }])).toBeNull();
    expect(paidThroughTerm([{ coveredTerms: [], voided: false }])).toBeNull();
  });

  it("returns null for a member with no payments at all", () => {
    expect(paidThroughTerm([])).toBeNull();
  });

  it("skips an unparseable term instead of treating it as zero", () => {
    // Index 0 is a real index and would win a max against nothing, which would
    // print "Spring 0" on an officer's screen.
    expect(paidThroughTerm([{ coveredTerms: ["Summer 2026"], voided: false }]))
      .toBeNull();
    expect(paidThroughTerm([live("Summer 2026", "Fall 2026")])).toBe("Fall 2026");
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

// ---------------------------------------------------------------------------
// The review queue (phase 3)
// ---------------------------------------------------------------------------

describe("formatCents", () => {
  it("renders whole and part dollars", () => {
    expect(formatCents(3000)).toBe("$30.00");
    expect(formatCents(4250)).toBe("$42.50");
    expect(formatCents(5)).toBe("$0.05");
  });

  it("groups thousands", () => {
    expect(formatCents(123456789)).toBe("$1,234,567.89");
  });

  it("never loses a cent to float arithmetic", () => {
    // 3010 / 100 * 100 is 3009.9999… in floating point, which is the whole
    // reason amounts are stored in cents.
    expect(formatCents(3010)).toBe("$30.10");
  });
});

describe("noteTokens", () => {
  it("is empty for no note", () => {
    expect(noteTokens(null)).toEqual([]);
    expect(noteTokens("   ")).toEqual([]);
  });

  it("🪤 keeps a hyphenated EID whole", () => {
    // Splitting on punctuation as well as whitespace would yield ["rp","8571"]
    // and match neither — destroying the very thing normalized_eid strips `-`
    // for. This is the phase-1 trap, pinned from the tokenizer's side now that
    // matchNote and the suggestion ranker share it.
    expect(noteTokens("dues RP-8571")).toEqual(["dues", "rp8571"]);
  });

  it("strips trailing punctuation and folds case", () => {
    expect(noteTokens("Spring dues, BK2856.")).toEqual([
      "spring",
      "dues",
      "bk2856",
    ]);
  });

  it("dedupes", () => {
    expect(noteTokens("rp8571 rp8571")).toEqual(["rp8571"]);
  });
});

describe("paymentReviewState", () => {
  const live = { voided_at: null };

  it("a linked row with a decided amount needs nothing", () => {
    const state = paymentReviewState({
      ...live,
      member_id: "m-rowan",
      terms_covered: 1,
    });
    expect(state).toEqual({
      noMember: false,
      undecidedAmount: false,
      needsReview: false,
    });
  });

  it("the two reasons are independent", () => {
    expect(
      paymentReviewState({ ...live, member_id: "m-rowan", terms_covered: null })
    ).toMatchObject({ noMember: false, undecidedAmount: true });
    expect(
      paymentReviewState({ ...live, member_id: null, terms_covered: 2 })
    ).toMatchObject({ noMember: true, undecidedAmount: false });
  });

  it("⚠️ a voided row never sits in the queue, however incomplete", () => {
    // It counts for nothing and no officer action will change that, so leaving
    // it in the queue would be work that can never be finished.
    const state = paymentReviewState({
      member_id: null,
      terms_covered: null,
      voided_at: "2026-09-04T00:00:00Z",
    });
    expect(state.needsReview).toBe(false);
  });
});

describe("startTermOptions", () => {
  // June 2026, Central — §4.7 puts May–July in Spring.
  const june = new Date("2026-06-15T18:00:00Z");

  it("offers the derived term with a term either side of it", () => {
    expect(startTermOptions(june)).toEqual([
      "Fall 2025",
      "Spring 2026",
      "Fall 2026",
      "Spring 2027",
    ]);
  });

  it("🪤 covers the summer override — the Fall the payer meant is offered", () => {
    expect(startTermOptions(june)).toContain("Fall 2026");
  });

  it("is in calendar order across a year boundary, not alphabetical", () => {
    // A string sort would put every Fall before every Spring.
    const options = startTermOptions(new Date("2026-12-15T18:00:00Z"));
    expect(options).toEqual([
      "Spring 2026",
      "Fall 2026",
      "Spring 2027",
      "Fall 2027",
    ]);
  });

  it("⚠️ appends a stored value that falls outside the window", () => {
    // A <select> whose value matches no <option> renders BLANK, so the row
    // would appear to hold nothing and the next save would rewrite a real
    // value. Same defect and same remedy as an orphaned custom-field option.
    const options = startTermOptions(june, "Fall 2030");
    expect(options).toContain("Fall 2030");
    expect(options).toContain("Spring 2026");
    // Still in calendar order once appended.
    expect(options[options.length - 1]).toBe("Fall 2030");
  });

  it("does not duplicate a stored value already in the window", () => {
    const options = startTermOptions(june, "Spring 2026");
    expect(options.filter((t) => t === "Spring 2026")).toHaveLength(1);
  });
});

describe("rankPaymentSuggestions", () => {
  const candidates: MemberCandidate[] = [
    {
      id: "m-rowan",
      fullName: "Rowan Pike",
      email: "rowan.pike@example.edu",
      eid: "rp8571",
      normalizedEid: "rp8571",
    },
    {
      id: "m-amara",
      fullName: "Amara Osei",
      email: "amara.osei@example.edu",
      eid: "ao4471",
      normalizedEid: "ao4471",
    },
    {
      id: "m-mika",
      fullName: "Mika Petrov",
      email: "mika.petrov@example.edu",
      eid: "mp8570",
      normalizedEid: "mp8570",
    },
  ];

  it("finds the member behind a typo'd EID — the case the stage exists for", () => {
    // rp8517 is a transposition of rp8571: one edit, which stands alone.
    const ranked = rankPaymentSuggestions(
      { payerName: "R Pike", note: "rp8517 dues" },
      candidates
    );
    expect(ranked[0].member.id).toBe("m-rowan");
  });

  it("finds the member from the Venmo display name when the note is useless", () => {
    const ranked = rankPaymentSuggestions(
      { payerName: "Rowan Pike", note: "dues!!" },
      candidates
    );
    expect(ranked[0].member.id).toBe("m-rowan");
  });

  it("⚠️ returns nothing rather than a weak guess", () => {
    // An empty list is a valid answer, not a gap. A dues mis-credit shows the
    // victim as unpaid and the beneficiary as paid, and neither has a reason
    // to check — so the floor matters more here than it does for attendance.
    expect(
      rankPaymentSuggestions(
        { payerName: "Someone Entirely Else", note: "thanks!" },
        candidates
      )
    ).toEqual([]);
  });

  it("scores nothing at all when there is neither a name nor a note", () => {
    expect(
      rankPaymentSuggestions({ payerName: null, note: null }, candidates)
    ).toEqual([]);
  });

  it("🪤 takes each candidate's BEST identity rather than summing them", () => {
    // A long note full of near-misses must not accumulate its way past the
    // floor — that is the "confident-looking stranger" failure the floor
    // exists to stop. Every token below sits at distance 2 from Mika's mp8570,
    // worth 15 each and well under the floor; four of them must still be no
    // suggestion at all, while Rowan's exact rp8571 stands.
    const ranked = rankPaymentSuggestions(
      { payerName: null, note: "rp8571 rp8572 rp8573 rp8574" },
      candidates
    );
    expect(ranked.map((r) => r.member.id)).toEqual(["m-rowan"]);
  });
});

// ---------------------------------------------------------------------------
// Source assertions — wiring invariants a node-environment suite cannot render
// ---------------------------------------------------------------------------
//
// Same reasoning as the block at the end of tests/members.test.ts: these pin
// decisions that live in JSX and in column-list literals, whose failure modes
// are a client-side timing window and a silently widened type. If a file moves,
// update the path rather than deleting the test.

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("the payment editor owns the row's compare-and-set token", () => {
  const editor = read(
    "../app/admin/(shell)/dues/[id]/_components/payment-editor.tsx"
  );

  it("is a Client Component", () => {
    expect(editor.split("\n").find((l) => l.trim() !== "")?.trim()).toBe(
      '"use client";'
    );
  });

  it("âš ï¸ holds the token in state and adopts the one each save returns", () => {
    // dues_payments.updated_at is ROW-level. This is the reason phase 3 ships
    // one savePayment rather than the spec's assignPayment + setPaymentTerms:
    // two forms would each hold their own copy, so the first save would move it
    // and strand the second, and the officer's next edit would report a phantom
    // conflict. The failure is a client-side timing window that no behavioural
    // test in this suite would catch.
    expect(editor).toContain("useState(updatedAt)");
    expect(editor).toContain("state.updatedAt");
  });

  it("has exactly one form posting the row", () => {
    // If a second <form action={…}> appears here, the invariant above is gone.
    expect(editor.match(/<form action=/g) ?? []).toHaveLength(1);
  });

  it("🐛 drives every select from state, never defaultValue", () => {
    // Found in the phase-3 walkthrough, and it is a DATA-LOSS path rather than
    // a cosmetic one. React 19 resets an uncontrolled `<form action>` once the
    // action resolves, and the reset beat the revalidated props: after
    // assigning a member the dropdown snapped back to "Nobody yet" while the
    // database held the new value. The officer reads that as a failed save, and
    // the obvious next move — press SAVE again — posts the empty option and
    // genuinely unassigns the member they had just credited.
    //
    // member-field-cell.tsx already carried this rule in its own header; this
    // component was written with defaultValue anyway, which is why it is pinned
    // as an assertion here rather than left as prose.
    //
    // Matching the ATTRIBUTE form rather than the bare word, so the header can
    // keep explaining the trap in prose — which is how this assertion failed
    // the first time it was written, exactly as the equivalent one in
    // tests/members.test.ts did.
    expect(editor).not.toMatch(/defaultValue=\{/);
    expect(editor.match(/value=\{values\./g) ?? []).toHaveLength(3);
  });
});

describe("the phase-3 client components format no dates", () => {
  // Intl inside a Client Component runs on both sides of hydration, and Node
  // and Chrome ship different ICU data for the space before "PM" — the React
  // diff then shows two strings that look character-for-character identical.
  // None of these renders a date or an amount itself; both arrive as props.
  const files = [
    "../app/admin/(shell)/dues/[id]/_components/payment-editor.tsx",
    "../app/admin/(shell)/dues/[id]/_components/void-payment-form.tsx",
    "../app/admin/(shell)/dues/_components/dues-filters.tsx",
  ];

  for (const path of files) {
    it(`${path.split("/").pop()} calls no locale formatter`, () => {
      // Matching the CALL form, so the headers can keep warning about the trap
      // in prose.
      const source = read(path);
      expect(source).not.toMatch(/Intl\.\w+\(/);
      expect(source).not.toMatch(/toLocale\w*\(/);
    });
  }
});

describe("the audit before/after column lists are symmetric", () => {
  const actions = read("../app/actions/dues.ts");

  const literal = (name: string): string => {
    const match = new RegExp(`const ${name} =\\s*"([^"]+)" as const`).exec(
      actions
    );
    if (!match) throw new Error(`${name} not found as an unbroken literal`);
    return match[1];
  };

  it("âš ï¸ differ by updated_at and nothing else", () => {
    // AuditTrail diffs the union of both sides' keys and renders a key present
    // on one side only as "—", so a narrower select on the update INVENTS
    // changes that never happened: voiding a point adjustment once logged
    // `reason: "Staffed the info booth" → —`, as though the void had erased it.
    // Here the save list carries updated_at so the client can adopt the fresh
    // token, and auditable() strips it from BOTH sides before the write.
    const audited = literal("AUDITED_PAYMENT_COLUMNS").split(", ");
    const saved = literal("PAYMENT_SAVE_COLUMNS").split(", ");
    expect(saved.filter((c) => c !== "updated_at")).toEqual(audited);
    expect(saved).toContain("updated_at");
  });

  it("ðŸª¤ are unbroken string literals, not concatenations", () => {
    // PostgREST types the returned row off the string LITERAL, so "a, b" + "c"
    // widens to plain `string` and collapses the result to GenericStringError —
    // every field access failing at once, which reads as a schema problem. This
    // has bitten twice in this codebase already. The regex above only matches
    // an unbroken literal, so its absence is the failure.
    expect(() => literal("AUDITED_PAYMENT_COLUMNS")).not.toThrow();
    expect(() => literal("PAYMENT_SAVE_COLUMNS")).not.toThrow();
  });
});

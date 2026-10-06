import { describe, expect, it } from "vitest";

import { MAX_BULK_ASSIGN } from "@/lib/attendance";
import {
  MAX_MANUAL_PAYMENT_CENTS,
  MAX_TERMS_COVERED,
  PAYMENT_METHODS,
} from "@/lib/dues";
import { centralWallTimeToInstant, toCentralFields } from "@/lib/events";
import { MAX_FIELD_OPTIONS, MAX_OPTION_LENGTH } from "@/lib/members";
import { MAX_GRANT_MEMBERS, MAX_POINTS_PER_GRANT } from "@/lib/points";
import {
  attendanceEditSchema,
  bulkAssignSchema,
  checkinSchema,
  duesPaymentCreateSchema,
  duesPaymentSaveSchema,
  duesVoidSchema,
  eventSchema,
  fieldDefinitionEditSchema,
  fieldDefinitionSchema,
  memberFieldValueSchema,
  memberNotesSchema,
  memberTypeSchema,
  pointGrantSchema,
  pointVoidSchema,
  seriesSchema,
} from "@/lib/validation";
import { MEMBER_TYPES } from "@/lib/member-types";

// Pure unit tests — no database. The schema is the only email-format check
// in the system, and the normalized-length refinement is what stops IDs like
// "-" (which pass the DB's not-blank check but normalize to nothing) from
// collapsing into one phantom identity.

const VALID = {
  fullName: "  Test Person  ",
  eid: " t3q1234 ",
  email: " test.person@example.edu ",
};

describe("checkinSchema", () => {
  it("accepts a valid submission and trims every field", () => {
    const parsed = checkinSchema.parse(VALID);
    expect(parsed).toEqual({
      fullName: "Test Person",
      eid: "t3q1234",
      email: "test.person@example.edu",
    });
  });

  it.each([
    ["blank name", { ...VALID, fullName: "   " }, "fullName"],
    ["name too long", { ...VALID, fullName: "x".repeat(121) }, "fullName"],
    ["blank EID", { ...VALID, eid: "" }, "eid"],
    ["EID normalizing to nothing", { ...VALID, eid: " - " }, "eid"],
    ["EID normalizing to one char", { ...VALID, eid: "- 7 -" }, "eid"],
    // The floor moved 2 -> 3 with the EID switch: the shortest real UT EIDs
    // are three characters, and a two-character floor is what made the old
    // substring-containment rule in the ranker dangerous.
    ["EID normalizing to two chars", { ...VALID, eid: "a-1" }, "eid"],
    ["ID too long", { ...VALID, eid: "9".repeat(33) }, "eid"],
    ["bad email", { ...VALID, email: "not-an-email" }, "email"],
    ["blank email", { ...VALID, email: "  " }, "email"],
  ])("rejects %s with an error on the right field", (_label, input, field) => {
    const result = checkinSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((issue) => issue.path[0]);
      expect(fields).toContain(field);
    }
  });

  it("keeps mixed-format IDs untouched (normalization happens later)", () => {
    const parsed = checkinSchema.parse({ ...VALID, eid: "ut 100003" });
    expect(parsed.eid).toBe("ut 100003");
  });
});

// --- Stage 5 schemas --------------------------------------------------------
//
// Each of these shadows a database constraint. The tests below assert the
// shadowing is faithful: where the schema is looser than the constraint, the
// officer meets a 23514 instead of a field message.

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

describe("attendanceEditSchema", () => {
  const VALID_EDIT = {
    submittedName: " Rowan Pike ",
    submittedEid: " UT-100999 ",
    submittedEmail: " rowan.pike@example.edu ",
    eventId: UUID_A,
    memberId: UUID_B,
    resolutionNote: "  Matched by email  ",
  };

  it("trims and keeps both links", () => {
    const parsed = attendanceEditSchema.parse(VALID_EDIT);
    expect(parsed.submittedName).toBe("Rowan Pike");
    expect(parsed.eventId).toBe(UUID_A);
    expect(parsed.resolutionNote).toBe("Matched by email");
  });

  it("turns an empty link into null, not an empty string", () => {
    // The FK columns are nullable and a pending row is one that hasn't got
    // them yet; "" would be a 22P02 rather than an unset link.
    const parsed = attendanceEditSchema.parse({
      ...VALID_EDIT,
      eventId: "",
      memberId: "",
      resolutionNote: "",
    });
    expect(parsed.eventId).toBeNull();
    expect(parsed.memberId).toBeNull();
    expect(parsed.resolutionNote).toBeNull();
  });

  it.each([
    ["a malformed event id", { eventId: "not-a-uuid" }, "eventId"],
    ["a blank name", { submittedName: "  " }, "submittedName"],
    ["an ID normalizing to nothing", { submittedEid: " - " }, "submittedEid"],
    ["a bad email", { submittedEmail: "nope" }, "submittedEmail"],
  ])("rejects %s", (_label, over, field) => {
    const result = attendanceEditSchema.safeParse({ ...VALID_EDIT, ...over });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toContain(field);
    }
  });
});

describe("bulkAssignSchema", () => {
  it("accepts an explicit selection", () => {
    const parsed = bulkAssignSchema.parse({
      eventId: UUID_A,
      ids: [UUID_B],
      approve: false,
    });
    expect(parsed.ids).toHaveLength(1);
  });

  it("rejects an empty selection and an oversized one", () => {
    expect(
      bulkAssignSchema.safeParse({ eventId: UUID_A, ids: [], approve: false })
        .success
    ).toBe(false);
    expect(
      bulkAssignSchema.safeParse({
        eventId: UUID_A,
        ids: Array.from({ length: MAX_BULK_ASSIGN + 1 }, () => UUID_B),
        approve: false,
      }).success
    ).toBe(false);
  });
});

describe("pointGrantSchema", () => {
  const VALID_GRANT = {
    memberIds: [UUID_A],
    points: "5",
    reason: "  Staffed the info booth  ",
    category: "recruitment",
    eventId: "",
  };

  it("coerces points and trims the reason", () => {
    const parsed = pointGrantSchema.parse(VALID_GRANT);
    expect(parsed.points).toBe(5);
    expect(parsed.reason).toBe("Staffed the info booth");
    expect(parsed.eventId).toBeNull();
  });

  it("accepts a negative grant", () => {
    // One mechanism for bonuses, penalties, and corrections (§4.2).
    expect(pointGrantSchema.parse({ ...VALID_GRANT, points: "-2" }).points).toBe(
      -2
    );
  });

  it.each([
    ["zero points", { points: "0" }, "points"],
    ["a fractional grant", { points: "1.5" }, "points"],
    ["a blank reason", { reason: "   " }, "reason"],
    ["an unknown category", { category: "vibes" }, "category"],
    ["no members", { memberIds: [] }, "memberIds"],
    [
      "more members than one action allows",
      { memberIds: Array.from({ length: MAX_GRANT_MEMBERS + 1 }, () => UUID_A) },
      "memberIds",
    ],
    ["an implausible magnitude", { points: String(MAX_POINTS_PER_GRANT + 1) }, "points"],
  ])("rejects %s", (_label, over, field) => {
    const result = pointGrantSchema.safeParse({ ...VALID_GRANT, ...over });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toContain(field);
    }
  });

  it("has no term field at all", () => {
    // Regression guard for §4.7: events.term is generated, point_adjustments
    // .term defaults to current_term(), and a literal term string anywhere in
    // application code is a bug. A `term` key here would be the way one gets in.
    const parsed = pointGrantSchema.parse({
      ...VALID_GRANT,
      term: "Fall 2026",
    } as Record<string, unknown>);
    expect(parsed).not.toHaveProperty("term");
  });
});

describe("pointVoidSchema", () => {
  it("requires a reason, mirroring void_requires_reason", () => {
    expect(
      pointVoidSchema.safeParse({ id: UUID_A, voidReason: "   " }).success
    ).toBe(false);
    expect(
      pointVoidSchema.parse({ id: UUID_A, voidReason: " Wrong member " })
        .voidReason
    ).toBe("Wrong member");
  });
});

// ---------------------------------------------------------------------------
// Custom fields (§7 Stage 6 phase 4)
// ---------------------------------------------------------------------------
//
// Every rule below is ALSO a constraint in migration 18, deliberately rather
// than redundantly: these give the officer a sentence explaining what went
// wrong, and the database makes the rule true for anything that skipped them.

const FIELD_BASE = {
  label: "Dues paid",
  kind: "select" as const,
  options: "Paid\nUnpaid\nWaived",
  editableInline: true,
  showInDirectory: true,
  sortOrder: 0,
};

describe("fieldDefinitionSchema", () => {
  it("accepts a well-formed definition and splits the options", () => {
    const parsed = fieldDefinitionSchema.parse({
      ...FIELD_BASE,
      key: "committee_paid",
    });
    expect(parsed.options).toEqual(["Paid", "Unpaid", "Waived"]);
    expect(parsed.key).toBe("committee_paid");
  });

  it("tolerates what a textarea actually submits", () => {
    // A trailing newline is what every textarea gives you, and an officer
    // pasting from a spreadsheet brings blank lines and stray indentation.
    const parsed = fieldDefinitionSchema.parse({
      ...FIELD_BASE,
      key: "committee_paid",
      options: "  Paid  \n\n\tUnpaid\n\n",
    });
    expect(parsed.options).toEqual(["Paid", "Unpaid"]);
  });

  // 🔓 The key refinement is a security control, not a naming rule: the key is
  // interpolated into a PostgREST `order=` term, where a comma is read as a
  // second order column and a space is accepted silently.
  it("refuses a key that could break out of an order term", () => {
    for (const key of [
      "committee,full_name",
      "committee paid",
      'du"es',
      "committee-paid",
      "Dues",
      "1committee",
      "",
    ]) {
      const result = fieldDefinitionSchema.safeParse({ ...FIELD_BASE, key });
      expect(result.success, key).toBe(false);
    }
  });

  it("refuses a key that collides with a built-in column", () => {
    const result = fieldDefinitionSchema.safeParse({
      ...FIELD_BASE,
      key: "email",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/built-in/);
  });

  it("refuses both migration-30 column names, with the built-in message", () => {
    // A "Member type" dropdown is exactly what an officer would have built
    // before the column existed. The same rule is the CHECK in migration 30.
    for (const key of ["member_type", "project_eligibility"]) {
      const result = fieldDefinitionSchema.safeParse({ ...FIELD_BASE, key });
      expect(result.success, key).toBe(false);
      expect(result.error?.issues[0].message, key).toMatch(/built-in/);
    }
  });

  it("refuses two options that differ only in case", () => {
    // The stored value IS the option text, so "Paid" and "paid" would be
    // indistinguishable once written into members.custom_fields — which is
    // exactly what valid_field_options() enforces on the other side.
    const result = fieldDefinitionSchema.safeParse({
      ...FIELD_BASE,
      key: "committee_paid",
      options: "Paid\npaid",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/same/);
  });

  it("refuses an empty, oversized, or over-long option list", () => {
    const cases = [
      "",
      "\n\n  \n",
      Array.from({ length: MAX_FIELD_OPTIONS + 1 }, (_, i) => `o${i}`).join("\n"),
      "x".repeat(MAX_OPTION_LENGTH + 1),
    ];
    for (const options of cases) {
      const result = fieldDefinitionSchema.safeParse({
        ...FIELD_BASE,
        key: "committee_paid",
        options,
      });
      expect(result.success, options.slice(0, 20)).toBe(false);
    }
  });

  it("accepts exactly the maximum option count", () => {
    const options = Array.from(
      { length: MAX_FIELD_OPTIONS },
      (_, i) => `o${i}`
    ).join("\n");
    expect(
      fieldDefinitionSchema.parse({ ...FIELD_BASE, key: "committee_paid", options })
        .options
    ).toHaveLength(MAX_FIELD_OPTIONS);
  });

  it("requires a label", () => {
    const result = fieldDefinitionSchema.safeParse({
      ...FIELD_BASE,
      key: "committee_paid",
      label: "   ",
    });
    expect(result.success).toBe(false);
  });
});

describe("fieldDefinitionEditSchema", () => {
  // The key is omitted rather than optional, and that is the point: renaming a
  // key would orphan every answer stored under it, so the edit form cannot
  // express a rename at all.
  it("produces no key, even when one is submitted", () => {
    const parsed = fieldDefinitionEditSchema.parse({
      ...FIELD_BASE,
      key: "something_else",
    });
    expect(parsed).not.toHaveProperty("key");
  });

  it("still validates everything else", () => {
    expect(
      fieldDefinitionEditSchema.safeParse({ ...FIELD_BASE, options: "" }).success
    ).toBe(false);
  });
});

describe("memberFieldValueSchema", () => {
  const VALUE_BASE = {
    memberId: UUID_A,
    key: "committee_paid",
    value: "Paid",
    expectedUpdatedAt: "2026-08-02T22:34:16.934133+00:00",
  };

  it("accepts a value and an empty clear alike", () => {
    expect(memberFieldValueSchema.parse(VALUE_BASE).value).toBe("Paid");
    // Clearing is always allowed — the action turns "" into a deleted key.
    expect(
      memberFieldValueSchema.parse({ ...VALUE_BASE, value: "" }).value
    ).toBe("");
  });

  it("refuses a key that did not come from a definition", () => {
    for (const key of ["cf:committee_paid", "committee,full_name", "email", ""]) {
      expect(
        memberFieldValueSchema.safeParse({ ...VALUE_BASE, key }).success,
        key
      ).toBe(false);
    }
  });

  it("requires the compare-and-set anchor", () => {
    expect(
      memberFieldValueSchema.safeParse({ ...VALUE_BASE, expectedUpdatedAt: "" })
        .success
    ).toBe(false);
  });

  // Not checked against the option list here, on purpose: the schema does not
  // know the definition. The action loads it and calls isAllowedFieldValue(),
  // so the value is judged against the definition as STORED rather than as the
  // form claimed it to be.
  it("does not judge the value against any option list", () => {
    expect(
      memberFieldValueSchema.safeParse({ ...VALUE_BASE, value: "Banana" })
        .success
    ).toBe(true);
  });
});

describe("memberTypeSchema", () => {
  const TYPE_BASE = {
    memberId: UUID_A,
    memberType: "data_project",
    expectedUpdatedAt: "2026-08-02T22:34:16.934133+00:00",
  };

  it("accepts every member type and nothing else", () => {
    // The list is MEMBER_TYPES, which mirrors members_member_type_valid — so
    // the schema and the CHECK accept exactly the same four values.
    for (const memberType of MEMBER_TYPES) {
      expect(
        memberTypeSchema.parse({ ...TYPE_BASE, memberType }).memberType
      ).toBe(memberType);
    }
    for (const memberType of ["", "officer", "General", "Data project", "data project"]) {
      expect(
        memberTypeSchema.safeParse({ ...TYPE_BASE, memberType }).success,
        memberType
      ).toBe(false);
    }
  });

  it("has no clear: the column is NOT NULL", () => {
    expect(
      memberTypeSchema.safeParse({ ...TYPE_BASE, memberType: null }).success
    ).toBe(false);
  });

  it("requires the compare-and-set anchor, kept as the raw string", () => {
    expect(
      memberTypeSchema.safeParse({ ...TYPE_BASE, expectedUpdatedAt: "" }).success
    ).toBe(false);
    // Microseconds intact — a Date round trip would truncate them.
    expect(memberTypeSchema.parse(TYPE_BASE).expectedUpdatedAt).toBe(
      "2026-08-02T22:34:16.934133+00:00"
    );
  });

  it("requires a real member id", () => {
    expect(
      memberTypeSchema.safeParse({ ...TYPE_BASE, memberId: "not-a-uuid" }).success
    ).toBe(false);
  });
});

describe("memberNotesSchema", () => {
  const NOTES_BASE = {
    memberId: UUID_A,
    expectedUpdatedAt: "2026-08-02T22:34:16.934133+00:00",
  };

  it("turns an empty box into null, never an empty string", () => {
    // members.notes has no not-blank check, so '' would be storable — and would
    // render exactly like "no notes" while behaving differently everywhere else.
    expect(memberNotesSchema.parse({ ...NOTES_BASE, notes: "" }).notes).toBeNull();
    expect(
      memberNotesSchema.parse({ ...NOTES_BASE, notes: "   " }).notes
    ).toBeNull();
  });

  it("trims but otherwise keeps what was written", () => {
    expect(
      memberNotesSchema.parse({ ...NOTES_BASE, notes: "  Transfers in\nspring  " })
        .notes
    ).toBe("Transfers in\nspring");
  });

  it("refuses an essay", () => {
    expect(
      memberNotesSchema.safeParse({ ...NOTES_BASE, notes: "x".repeat(2001) })
        .success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// "Count as general meeting" (migration 31)
// ---------------------------------------------------------------------------
//
// In eventBase, so both schemas read it. Presence is the signal: a ticked box
// posts "on", an unticked one posts nothing — and absent has to mean false,
// the column's default and the officer's "every event starts unticked".

describe("countsAsGeneralMeeting", () => {
  // The raw strings the forms post, as echo() collects them.
  const EVENT_INPUT = {
    title: "General Meeting",
    description: "",
    location: "",
    date: "2026-10-08",
    startTime: "19:00",
    endTime: "20:00",
    openEarlyMinutes: "15",
    closeLateMinutes: "15",
    points: "1",
    category: "general_and_other",
    status: "draft",
  };
  const SERIES_INPUT = {
    ...EVENT_INPUT,
    untilDate: "2026-12-03",
    weekdays: ["4"],
  };

  it("eventSchema reads a ticked box as true, and blank or absent as false", () => {
    expect(
      eventSchema.parse({ ...EVENT_INPUT, countsAsGeneralMeeting: "on" })
        .countsAsGeneralMeeting
    ).toBe(true);
    expect(
      eventSchema.parse({ ...EVENT_INPUT, countsAsGeneralMeeting: "" })
        .countsAsGeneralMeeting
    ).toBe(false);
    expect(eventSchema.parse(EVENT_INPUT).countsAsGeneralMeeting).toBe(false);
  });

  it("seriesSchema reads it the same way — it is in the shared base", () => {
    expect(
      seriesSchema.parse({ ...SERIES_INPUT, countsAsGeneralMeeting: "on" })
        .countsAsGeneralMeeting
    ).toBe(true);
    expect(
      seriesSchema.parse({ ...SERIES_INPUT, countsAsGeneralMeeting: "" })
        .countsAsGeneralMeeting
    ).toBe(false);
    expect(seriesSchema.parse(SERIES_INPUT).countsAsGeneralMeeting).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Dues corrections (§7 Stage 6.5 phase 3)
// ---------------------------------------------------------------------------

describe("duesPaymentSaveSchema", () => {
  const BASE = {
    id: "0f8fad5b-d9cb-469f-a165-70867728950e",
    memberId: "",
    startTerm: "Fall 2026",
    termsCovered: "",
    expectedUpdatedAt: "2026-09-04T01:22:13.123456+00:00",
  };

  it("accepts an unlinked, undecided payment", () => {
    // Both of these are the review axis rather than missing input: a payment
    // credited to nobody, covering nothing, is a legitimate stored state and
    // has to be reachable from the form as well as from the importer.
    const parsed = duesPaymentSaveSchema.parse(BASE);
    expect(parsed.memberId).toBeNull();
    expect(parsed.termsCovered).toBeNull();
  });

  it("coerces the terms count and enforces the column's bounds", () => {
    expect(
      duesPaymentSaveSchema.parse({ ...BASE, termsCovered: "2" }).termsCovered
    ).toBe(2);
    expect(
      duesPaymentSaveSchema.safeParse({ ...BASE, termsCovered: "0" }).success
    ).toBe(false);
    expect(
      duesPaymentSaveSchema.safeParse({
        ...BASE,
        termsCovered: String(MAX_TERMS_COVERED + 1),
      }).success
    ).toBe(false);
  });

  it("refuses a term that is not a term", () => {
    for (const startTerm of ["", "Fall", "Summer 2026", "2026", "Fall 26"]) {
      expect(
        duesPaymentSaveSchema.safeParse({ ...BASE, startTerm }).success
      ).toBe(false);
    }
  });

  it("requires the compare-and-set token", () => {
    expect(
      duesPaymentSaveSchema.safeParse({ ...BASE, expectedUpdatedAt: "" }).success
    ).toBe(false);
  });

  it("⚠️ keeps the token as the raw string it was given", () => {
    // A JS Date round trip truncates the microseconds and the CAS then never
    // matches, reporting a phantom conflict on every save.
    expect(duesPaymentSaveSchema.parse(BASE).expectedUpdatedAt).toBe(
      BASE.expectedUpdatedAt
    );
  });
});

describe("duesVoidSchema", () => {
  const id = "0f8fad5b-d9cb-469f-a165-70867728950e";

  it("requires a reason, mirroring dues_void_requires_reason", () => {
    expect(duesVoidSchema.safeParse({ id, voidReason: "" }).success).toBe(false);
    expect(duesVoidSchema.safeParse({ id, voidReason: "   " }).success).toBe(
      false
    );
    expect(
      duesVoidSchema.parse({ id, voidReason: "  Refunded by request  " })
        .voidReason
    ).toBe("Refunded by request");
  });
});

// ---------------------------------------------------------------------------
// Manual dues entry (migration 32)
// ---------------------------------------------------------------------------

describe("duesPaymentCreateSchema", () => {
  // A past date, so nothing here depends on today except the cases that say so.
  const BASE = {
    memberId: "0f8fad5b-d9cb-469f-a165-70867728950e",
    amount: "40",
    paidDate: "2026-09-03",
    paidTime: "18:30",
    method: "cash",
    startTerm: "Fall 2026",
    termsCovered: "1",
    note: "",
  };

  /** The fields that carry an error, which is what the form shows them on. */
  function failingFields(input: Record<string, unknown>): string[] {
    const result = duesPaymentCreateSchema.safeParse(input);
    if (result.success) return [];
    return [...new Set(result.error.issues.map((i) => String(i.path[0])))].sort();
  }

  /** Today's Central date and wall time, `ms` from now. */
  function centralAt(ms: number) {
    return toCentralFields(new Date(Date.now() + ms));
  }

  it("accepts a cash payment and joins the date and time as Central", () => {
    const parsed = duesPaymentCreateSchema.parse(BASE);
    expect(parsed).toEqual({
      memberId: BASE.memberId,
      amountCents: 4000,
      // Never `new Date("2026-09-03T18:30")`, which the server reads as UTC.
      paidAt: centralWallTimeToInstant("2026-09-03", "18:30"),
      method: "cash",
      startTerm: "Fall 2026",
      termsCovered: 1,
      // "" is no note, which is null, not an empty string.
      note: null,
    });
  });

  it("converts dollars as typed to integer cents", () => {
    const cases: [string, number][] = [
      ["40", 4000],
      ["40.00", 4000],
      ["40.5", 4050],
      ["$70", 7000],
      ["  12.34  ", 1234],
      ["0.01", 1],
      // The float trap: parseFloat("40.10") * 100 is 4009.999…
      ["40.10", 4010],
      ["19.99", 1999],
    ];
    for (const [amount, cents] of cases) {
      expect(
        duesPaymentCreateSchema.parse({ ...BASE, amount }).amountCents,
        amount
      ).toBe(cents);
    }
  });

  it("refuses zero and negative amounts, mirroring amount_cents > 0", () => {
    // A refund is a void with a reason, never a negative payment, and a comped
    // membership (zero) is deliberately out of scope.
    for (const amount of ["0", "0.00", "$0", "-40", "-0.01", "- 40"]) {
      expect(failingFields({ ...BASE, amount }), amount).toEqual(["amount"]);
    }
  });

  it("refuses an amount that is not dollars", () => {
    for (const amount of ["", "forty", "40.123", "4,000", "40.", ".50", "40 dollars"]) {
      expect(failingFields({ ...BASE, amount }), amount).toEqual(["amount"]);
    }
  });

  it("refuses more than one payment allows, and accepts the cap itself", () => {
    const cap = MAX_MANUAL_PAYMENT_CENTS / 100;
    expect(
      duesPaymentCreateSchema.parse({ ...BASE, amount: String(cap) }).amountCents
    ).toBe(MAX_MANUAL_PAYMENT_CENTS);
    expect(failingFields({ ...BASE, amount: String(cap + 1) })).toEqual([
      "amount",
    ]);
    // The slip the cap exists for: cents typed into a dollars field.
    expect(failingFields({ ...BASE, amount: "4000" })).toEqual(["amount"]);
  });

  it("⚠️ requires a note when the method is Other", () => {
    expect(failingFields({ ...BASE, method: "other" })).toEqual(["note"]);
    expect(failingFields({ ...BASE, method: "other", note: "   " })).toEqual([
      "note",
    ]);
    expect(
      duesPaymentCreateSchema.parse({
        ...BASE,
        method: "other",
        note: "  Paid by cheque at the social  ",
      }).note
    ).toBe("Paid by cheque at the social");
  });

  it("reports a missing Other note in the same pass as another error", () => {
    // Otherwise the officer fixes the amount, submits, and only then learns
    // the note was required too.
    expect(
      failingFields({ ...BASE, method: "other", amount: "forty" })
    ).toEqual(["amount", "note"]);
  });

  it("needs no note for cash or Zelle", () => {
    for (const method of ["cash", "zelle"]) {
      expect(duesPaymentCreateSchema.parse({ ...BASE, method }).note).toBeNull();
    }
  });

  it("refuses a method outside the list, venmo included", () => {
    // 📌 No manual venmo: a hand-typed Venmo payment would be counted again
    // when its statement is imported.
    expect(PAYMENT_METHODS).not.toContain("venmo");
    for (const method of ["venmo", "venmo_import", "cheque", "", "CASH"]) {
      expect(failingFields({ ...BASE, method }), method).toEqual(["method"]);
    }
  });

  it("refuses a paid time in the future, on the field that is wrong", () => {
    const twoDaysOn = centralAt(2 * 86_400_000);
    expect(
      failingFields({ ...BASE, paidDate: twoDaysOn.date, paidTime: "09:00" })
    ).toEqual(["paidDate"]);

    // An hour from now is today's date at a later time, unless the hour
    // crosses midnight, in which case the date is what is wrong.
    const today = centralAt(0).date;
    const anHourOn = centralAt(60 * 60_000);
    expect(
      failingFields({ ...BASE, paidDate: anHourOn.date, paidTime: anHourOn.time })
    ).toEqual([anHourOn.date === today ? "paidTime" : "paidDate"]);
  });

  it("allows a time a minute ahead, inside the clock-skew grace", () => {
    const soon = centralAt(60_000);
    expect(
      duesPaymentCreateSchema.safeParse({
        ...BASE,
        paidDate: soon.date,
        paidTime: soon.time,
      }).success
    ).toBe(true);
  });

  it("refuses a date that is not on the calendar, and a mistyped year", () => {
    // The regex alone accepts all of these, and centralWallTimeToInstant would
    // roll 31 February into March without a word.
    for (const paidDate of ["2026-02-31", "2026-13-01", "2026-00-10", "0226-10-01", "0026-10-01", "2026-9-3"]) {
      expect(failingFields({ ...BASE, paidDate }), paidDate).toEqual([
        "paidDate",
      ]);
    }
  });

  it("refuses a time that is not on the clock", () => {
    for (const paidTime of ["25:00", "24:00", "12:60", "9:30", ""]) {
      expect(failingFields({ ...BASE, paidTime }), paidTime).toEqual([
        "paidTime",
      ]);
    }
  });

  it("takes termsCovered as the correction does: '' is null, 1–4 otherwise", () => {
    expect(
      duesPaymentCreateSchema.parse({ ...BASE, termsCovered: "" }).termsCovered
    ).toBeNull();
    expect(
      duesPaymentCreateSchema.parse({ ...BASE, termsCovered: "2" }).termsCovered
    ).toBe(2);
    for (const termsCovered of ["0", String(MAX_TERMS_COVERED + 1), "1.5"]) {
      expect(failingFields({ ...BASE, termsCovered }), termsCovered).toEqual([
        "termsCovered",
      ]);
    }
  });

  it("refuses a term that is not a term, and a member that is not a uuid", () => {
    for (const startTerm of ["", "Summer 2026", "Fall 26"]) {
      expect(failingFields({ ...BASE, startTerm }), startTerm).toEqual([
        "startTerm",
      ]);
    }
    expect(failingFields({ ...BASE, memberId: "" })).toEqual(["memberId"]);
    expect(failingFields({ ...BASE, memberId: "not-a-uuid" })).toEqual([
      "memberId",
    ]);
  });

  it("refuses an over-long note rather than trimming it to fit", () => {
    expect(failingFields({ ...BASE, note: "x".repeat(501) })).toEqual(["note"]);
    expect(
      duesPaymentCreateSchema.parse({ ...BASE, note: "x".repeat(500) }).note
    ).toHaveLength(500);
  });
});

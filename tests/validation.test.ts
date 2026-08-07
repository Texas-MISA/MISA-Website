import { describe, expect, it } from "vitest";

import { MAX_BULK_ASSIGN } from "@/lib/attendance";
import { MAX_TERMS_COVERED } from "@/lib/dues";
import { MAX_FIELD_OPTIONS, MAX_OPTION_LENGTH } from "@/lib/members";
import { MAX_GRANT_MEMBERS, MAX_POINTS_PER_GRANT } from "@/lib/points";
import {
  attendanceEditSchema,
  bulkAssignSchema,
  checkinSchema,
  duesPaymentSaveSchema,
  duesVoidSchema,
  fieldDefinitionEditSchema,
  fieldDefinitionSchema,
  memberFieldValueSchema,
  memberNotesSchema,
  pointGrantSchema,
  pointVoidSchema,
} from "@/lib/validation";

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

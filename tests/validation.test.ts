import { describe, expect, it } from "vitest";

import { MAX_BULK_ASSIGN } from "@/lib/attendance";
import { MAX_GRANT_MEMBERS, MAX_POINTS_PER_GRANT } from "@/lib/points";
import {
  attendanceEditSchema,
  bulkAssignSchema,
  checkinSchema,
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

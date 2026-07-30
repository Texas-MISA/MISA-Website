import { describe, expect, it } from "vitest";

import { checkinSchema } from "@/lib/validation";

// Pure unit tests — no database. The schema is the only email-format check
// in the system, and the normalized-length refinement is what stops IDs like
// "-" (which pass the DB's not-blank check but normalize to nothing) from
// collapsing into one phantom identity.

const VALID = {
  fullName: "  Test Person  ",
  studentId: " T3-123456 ",
  email: " test.person@example.edu ",
};

describe("checkinSchema", () => {
  it("accepts a valid submission and trims every field", () => {
    const parsed = checkinSchema.parse(VALID);
    expect(parsed).toEqual({
      fullName: "Test Person",
      studentId: "T3-123456",
      email: "test.person@example.edu",
    });
  });

  it.each([
    ["blank name", { ...VALID, fullName: "   " }, "fullName"],
    ["name too long", { ...VALID, fullName: "x".repeat(121) }, "fullName"],
    ["blank student ID", { ...VALID, studentId: "" }, "studentId"],
    ["ID normalizing to nothing", { ...VALID, studentId: " - " }, "studentId"],
    ["ID normalizing to one char", { ...VALID, studentId: "- 7 -" }, "studentId"],
    ["ID too long", { ...VALID, studentId: "9".repeat(33) }, "studentId"],
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
    const parsed = checkinSchema.parse({ ...VALID, studentId: "ut 100003" });
    expect(parsed.studentId).toBe("ut 100003");
  });
});

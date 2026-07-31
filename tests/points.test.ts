import { describe, expect, it } from "vitest";

import {
  formatPointCategory,
  POINT_CATEGORIES,
  signedPoints,
  summarizeGrant,
} from "@/lib/points";

// Pure suite — the database half lives in tests/point-actions.test.ts.

describe("POINT_CATEGORIES", () => {
  it("matches the CHECK constraint on point_adjustments.category", () => {
    // Drifting from the constraint means the form offers an option the
    // database rejects with a 23514 after the officer has typed a reason.
    expect([...POINT_CATEGORIES]).toEqual([
      "volunteer",
      "recruitment",
      "competition",
      "leadership",
      "correction",
      "other",
    ]);
  });
});

describe("formatPointCategory", () => {
  it("labels every known category", () => {
    for (const category of POINT_CATEGORIES) {
      expect(formatPointCategory(category)).not.toBe("—");
    }
    expect(formatPointCategory("recruitment")).toBe("Recruitment");
  });

  it("degrades to the raw value rather than hiding it", () => {
    expect(formatPointCategory(null)).toBe("—");
    expect(formatPointCategory("something_new")).toBe("something_new");
  });
});

describe("signedPoints", () => {
  it("always shows the sign", () => {
    expect(signedPoints(5)).toBe("+5");
    expect(signedPoints(1)).toBe("+1");
  });

  it("uses a real minus sign for deductions", () => {
    // A hyphen at the start of a ledger cell reads as a list bullet.
    expect(signedPoints(-2)).toBe("−2");
    expect(signedPoints(-2)).not.toBe("-2");
  });
});

describe("summarizeGrant", () => {
  it("pluralizes points and members independently", () => {
    expect(summarizeGrant(3, 5)).toBe("+5 points to 3 members");
    expect(summarizeGrant(1, 5)).toBe("+5 points to 1 member");
    expect(summarizeGrant(3, 1)).toBe("+1 point to 3 members");
    expect(summarizeGrant(1, 1)).toBe("+1 point to 1 member");
  });

  it("pluralizes on magnitude, not sign", () => {
    expect(summarizeGrant(2, -1)).toBe("−1 point to 2 members");
    expect(summarizeGrant(2, -3)).toBe("−3 points to 2 members");
  });
});

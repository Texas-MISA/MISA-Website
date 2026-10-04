import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_MEMBER_TYPE,
  formatMeetingResult,
  formatMemberType,
  formatMonth,
  formatMonthResult,
  formatProjectEligibility,
  isMemberType,
  isProjectEligibility,
  MEETING_RESULTS,
  MEMBER_TYPES,
  MONTH_RESULTS,
  PROJECT_ELIGIBILITIES,
  PROJECT_MEMBER_TYPES,
  requiresProjectEligibility,
} from "@/lib/member-types";

// Pure tests for the member-type vocabulary (migration 30). No database: the
// SQL half — the CHECK, the two views, the verdict — is
// tests/schema-integrity.test.ts and tests/project-eligibility.test.ts.

const MIGRATION =
  "supabase/migrations/20260730000030_member_type_project_eligibility.sql";

describe("the migration these source assertions read", () => {
  it("is still the latest to define member_directory and the type CHECK", () => {
    // 🪤 The assertions below read migration 30's SOURCE, which stays the truth
    // only while no later migration replaces either thing they quote. Migration
    // 31 replaced a view beside them (member_general_meeting_months) and
    // neither of these. If a later migration ever does, these assertions are
    // checking a stale definition and must move to that file.
    const prefix = (file: string) => /^(\d{14})_/.exec(file)?.[1] ?? "";
    const thirty = prefix(MIGRATION.split("/").at(-1)!);
    expect(thirty).toBe("20260730000030");

    const later = readdirSync("supabase/migrations").filter(
      (file) => file.endsWith(".sql") && prefix(file) > thirty
    );
    // At least migration 31, so this cannot pass by reading no files.
    expect(later.length).toBeGreaterThan(0);
    for (const file of later) {
      const sql = readFileSync(`supabase/migrations/${file}`, "utf8");
      expect(sql, file).not.toMatch(
        /create\s+(or\s+replace\s+)?view\s+public\.member_directory\b/i
      );
      expect(sql, file).not.toMatch(/constraint\s+members_member_type_valid/i);
    }
  });
});

describe("the member types", () => {
  it("are exactly the four the CHECK accepts, in that order", () => {
    expect([...MEMBER_TYPES]).toEqual([
      "general",
      "data_project",
      "client_project",
      "junior_director",
    ]);
    // Mirrored, not merely similar: the CHECK's list is this list.
    const sql = readFileSync(MIGRATION, "utf8");
    expect(sql).toContain(
      "check (member_type in ('general', 'data_project', 'client_project', 'junior_director'))"
    );
  });

  it("default to General, which is the column's default too", () => {
    expect(DEFAULT_MEMBER_TYPE).toBe("general");
    expect(readFileSync(MIGRATION, "utf8")).toContain(
      "add column member_type text not null default 'general'"
    );
  });

  it("have a label each", () => {
    expect(MEMBER_TYPES.map((type) => formatMemberType(type))).toEqual([
      "General",
      "Data project",
      "Client project",
      "Junior director",
    ]);
  });

  it("render null as a dash, and anything unknown as itself", () => {
    expect(formatMemberType(null)).toBe("—");
    expect(formatMemberType("")).toBe("—");
    // A value the CHECK should make impossible is shown legibly, never blank.
    expect(formatMemberType("alumni")).toBe("alumni");
  });

  it("🔓 recognise only real types — never a prototype property", () => {
    for (const type of MEMBER_TYPES) expect(isMemberType(type)).toBe(true);
    for (const junk of [
      "constructor",
      "toString",
      "__proto__",
      "General",
      "",
      null,
      undefined,
      42,
    ]) {
      expect(isMemberType(junk), String(junk)).toBe(false);
    }
    // An index-and-fallback formatter would answer these from Object.prototype.
    expect(formatMemberType("constructor")).toBe("constructor");
    expect(formatMemberType("toString")).toBe("toString");
  });
});

describe("which types have project requirements", () => {
  it("is the two project types, a subset of MEMBER_TYPES", () => {
    expect([...PROJECT_MEMBER_TYPES]).toEqual(["data_project", "client_project"]);
    for (const type of PROJECT_MEMBER_TYPES) {
      expect(MEMBER_TYPES as readonly string[]).toContain(type);
    }
  });

  it("matches the types the view judges", () => {
    // member_directory's `in (...)` and this list must agree, or the page would
    // show a breakdown for somebody the table calls N/A.
    expect(readFileSync(MIGRATION, "utf8")).toContain(
      "when m.member_type in ('data_project', 'client_project') then"
    );
  });

  it("applies to the project types only", () => {
    expect(requiresProjectEligibility("data_project")).toBe(true);
    expect(requiresProjectEligibility("client_project")).toBe(true);
    expect(requiresProjectEligibility("general")).toBe(false);
    expect(requiresProjectEligibility("junior_director")).toBe(false);
    expect(requiresProjectEligibility(null)).toBe(false);
    expect(requiresProjectEligibility("constructor")).toBe(false);
  });
});

describe("project eligibility", () => {
  it("is yes, no or not_applicable, shown as Yes, No and N/A", () => {
    expect([...PROJECT_ELIGIBILITIES]).toEqual(["yes", "no", "not_applicable"]);
    expect(PROJECT_ELIGIBILITIES.map((value) => formatProjectEligibility(value))).toEqual([
      "Yes",
      "No",
      "N/A",
    ]);
  });

  it("renders null as a dash — a missing row, never a fourth verdict", () => {
    expect(formatProjectEligibility(null)).toBe("—");
    expect(formatProjectEligibility("")).toBe("—");
    expect(formatProjectEligibility("maybe")).toBe("maybe");
    expect(isProjectEligibility("maybe")).toBe(false);
    expect(isProjectEligibility("valueOf")).toBe(false);
  });
});

describe("the breakdown's labels", () => {
  it("name each month result", () => {
    expect([...MONTH_RESULTS]).toEqual(["met", "not_met", "in_progress"]);
    expect(MONTH_RESULTS.map((value) => formatMonthResult(value))).toEqual([
      "Met",
      "Not met",
      "In progress",
    ]);
    expect(formatMonthResult(null)).toBe("—");
    expect(formatMonthResult("toString")).toBe("toString");
  });

  it("name each meeting result", () => {
    expect([...MEETING_RESULTS]).toEqual(["attended", "missed", "upcoming"]);
    expect(MEETING_RESULTS.map((value) => formatMeetingResult(value))).toEqual([
      "Attended",
      "Missed",
      "Upcoming",
    ]);
    expect(formatMeetingResult(null)).toBe("—");
  });
});

describe("formatMonth", () => {
  it("names a month from the view's first-of-month date", () => {
    expect(formatMonth("2026-10-01")).toBe("October 2026");
    expect(formatMonth("2026-09-01")).toBe("September 2026");
    expect(formatMonth("2027-01-01")).toBe("January 2027");
    expect(formatMonth("2026-12-01")).toBe("December 2026");
  });

  it("🪤 never shifts a month, as a Date parse in Central would", () => {
    // The trap it avoids: a bare ISO date parses as UTC midnight, which is the
    // previous evening in Central — September, for "2026-10-01".
    const viaDate = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      month: "long",
    }).format(new Date("2026-10-01"));
    expect(viaDate).toBe("September");
    expect(formatMonth("2026-10-01")).toBe("October 2026");
  });

  it("hands back anything malformed unchanged, and null as a dash", () => {
    for (const bad of ["2026-13-01", "2026-00-01", "garbage", "2026-10", "10/01/2026"]) {
      expect(formatMonth(bad), bad).toBe(bad);
    }
    expect(formatMonth(null)).toBe("—");
    expect(formatMonth("")).toBe("—");
  });
});

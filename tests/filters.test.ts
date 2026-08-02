import { describe, expect, it } from "vitest";

import {
  applyMemberFilter,
  defaultDirection,
  isDefaultFilter,
  memberFilterToParams,
  pageCount,
  pageRange,
  parseMemberFilter,
  PAGE_SIZE,
  type FilterableQuery,
  type MemberFilter,
} from "@/lib/filters";

// Pure tests for the directory's filter core (§7 Stage 6 phase 1). No database:
// applyMemberFilter is handed a recording fake in place of a PostgREST builder,
// which is the whole reason lib/filters.ts types the builder structurally
// instead of importing supabase-js.

type Call = [method: string, ...args: unknown[]];

type Recorder = FilterableQuery<Recorder> & { calls: Call[] };

function recorder(): Recorder {
  const calls: Call[] = [];
  const q: Recorder = {
    calls,
    eq(column, value) {
      calls.push(["eq", column, value]);
      return q;
    },
    gte(column, value) {
      calls.push(["gte", column, value]);
      return q;
    },
    lte(column, value) {
      calls.push(["lte", column, value]);
      return q;
    },
    lt(column, value) {
      calls.push(["lt", column, value]);
      return q;
    },
    order(column, options) {
      calls.push(["order", column, options]);
      return q;
    },
  };
  return q;
}

function callsFor(filter: Partial<MemberFilter>): Call[] {
  const full = parseMemberFilter({});
  return applyMemberFilter(recorder(), { ...full, ...filter }).calls;
}

describe("parseMemberFilter", () => {
  it("defaults to the active roster sorted by name", () => {
    const filter = parseMemberFilter({});
    expect(filter.state).toBe("active");
    expect(filter.sort).toBe("name");
    expect(filter.dir).toBe("asc");
    expect(filter.page).toBe(1);
    expect(filter.minPoints).toBeNull();
    expect(isDefaultFilter(filter)).toBe(true);
  });

  it("gives count-like columns a descending default", () => {
    expect(parseMemberFilter({ sort: "total_points" }).dir).toBe("desc");
    expect(parseMemberFilter({ sort: "attendance_rate" }).dir).toBe("desc");
    expect(parseMemberFilter({ sort: "student_id" }).dir).toBe("asc");
    // An explicit direction always wins over the default.
    expect(parseMemberFilter({ sort: "total_points", dir: "asc" }).dir).toBe(
      "asc"
    );
  });

  it("falls back rather than throwing on values a human edited into the URL", () => {
    const filter = parseMemberFilter({
      state: "banana",
      sort: "'; drop table members; --",
      dir: "sideways",
      source: "whatever",
      page: "-4",
    });
    expect(filter.state).toBe("active");
    expect(filter.sort).toBe("name");
    expect(filter.dir).toBe("asc");
    expect(filter.source).toBe("");
    expect(filter.page).toBe(1);
  });

  it("treats an unparseable number as no filter, never as zero", () => {
    // Zero is a real bound — it would hide every member with any points — so
    // "min=abc" collapsing to 0 would silently narrow the roster.
    expect(parseMemberFilter({ minPoints: "abc" }).minPoints).toBeNull();
    expect(parseMemberFilter({ minPoints: "" }).minPoints).toBeNull();
    expect(parseMemberFilter({ minPoints: "-3" }).minPoints).toBeNull();
    expect(parseMemberFilter({ minPoints: "0" }).minPoints).toBe(0);
    expect(parseMemberFilter({ minPoints: "7.9" }).minPoints).toBe(7);
  });

  it("clamps a rate to 0–100", () => {
    expect(parseMemberFilter({ minRate: "150" }).minRate).toBe(100);
    expect(parseMemberFilter({ minRate: "50" }).minRate).toBe(50);
  });

  it("ignores a malformed date rather than passing it to the zone helper", () => {
    expect(parseMemberFilter({ joinedFrom: "2026-4-7" }).joinedFrom).toBe("");
    expect(parseMemberFilter({ joinedFrom: "yesterday" }).joinedFrom).toBe("");
    expect(parseMemberFilter({ joinedFrom: "2026-04-07" }).joinedFrom).toBe(
      "2026-04-07"
    );
  });

  it("takes the first value when a key is repeated", () => {
    expect(parseMemberFilter({ state: ["inactive", "all"] }).state).toBe(
      "inactive"
    );
  });
});

describe("memberFilterToParams", () => {
  it("round-trips through parseMemberFilter", () => {
    const original = parseMemberFilter({
      state: "all",
      source: "self_checkin",
      minPoints: "3",
      maxEvents: "9",
      minRate: "40",
      joinedFrom: "2026-01-01",
      joinedTo: "2026-06-30",
      sort: "total_points",
      dir: "asc",
      page: "3",
    });

    const roundTripped = parseMemberFilter(
      Object.fromEntries(memberFilterToParams(original))
    );
    expect(roundTripped).toEqual(original);
  });

  it("omits everything that matches a default, so the common URL stays clean", () => {
    expect(memberFilterToParams(parseMemberFilter({})).toString()).toBe("");
    // Descending on total_points is that column's default, so only the sort
    // needs saying.
    expect(
      memberFilterToParams(parseMemberFilter({ sort: "total_points" })).toString()
    ).toBe("sort=total_points");
  });

  it("keeps a zero bound, which is a real filter", () => {
    const params = memberFilterToParams(parseMemberFilter({ maxPoints: "0" }));
    expect(params.get("maxPoints")).toBe("0");
  });

  it("ignores an explicitly undefined override instead of blanking the field", () => {
    // A caller writing `{ dir: someCondition ? "asc" : undefined }` must not end
    // up with `dir=undefined` in the URL.
    const filter = parseMemberFilter({ sort: "total_points", dir: "asc" });
    const params = memberFilterToParams(filter, { dir: undefined, page: 2 });
    expect(params.get("dir")).toBe("asc");
    expect(params.get("page")).toBe("2");
  });

  it("defaultDirection agrees with what the parser would have chosen", () => {
    for (const sort of ["name", "total_points", "last_seen_at", "student_id"] as const) {
      expect(defaultDirection(sort)).toBe(parseMemberFilter({ sort }).dir);
    }
  });
});

describe("applyMemberFilter", () => {
  it("scopes to active members by default and drops the clause for 'all'", () => {
    expect(callsFor({ state: "active" })).toContainEqual(["eq", "active", true]);
    expect(callsFor({ state: "inactive" })).toContainEqual([
      "eq",
      "active",
      false,
    ]);
    expect(
      callsFor({ state: "all" }).filter(([m, c]) => m === "eq" && c === "active")
    ).toHaveLength(0);
  });

  it("converts a whole-percent rate into the view's fraction", () => {
    expect(callsFor({ minRate: 50 })).toContainEqual([
      "gte",
      "attendance_rate",
      0.5,
    ]);
  });

  it("anchors the joined range to Central time and leaves it half-open", () => {
    const calls = callsFor({
      joinedFrom: "2026-04-07",
      joinedTo: "2026-04-07",
    });

    const lower = calls.find(([m, c]) => m === "gte" && c === "joined_at");
    const upper = calls.find(([m, c]) => m === "lt" && c === "joined_at");

    // 2026-04-07 00:00 CDT is 05:00 UTC, and the top bound is the *next* day's
    // midnight — so a member who joined at 8:15 PM Central on the 7th, which is
    // 01:15 UTC on the 8th, is inside the range. A bare .lte(date) would drop
    // them, and would look entirely reasonable doing it.
    expect(lower?.[2]).toBe("2026-04-07T05:00:00.000Z");
    expect(upper?.[2]).toBe("2026-04-08T05:00:00.000Z");
    expect(calls.some(([m]) => m === "lte")).toBe(false);
  });

  it("always ends with a deterministic total order", () => {
    // Without a unique final tie-break, rows tied on the sort column can come
    // back in a different arrangement per request, which makes pagination skip
    // and repeat members — and reads as missing data rather than as an
    // ordering fault.
    const orders = callsFor({ sort: "total_points" }).filter(
      ([m]) => m === "order"
    );
    expect(orders.map(([, column]) => column)).toEqual([
      "total_points",
      "full_name",
      "id",
    ]);
  });

  it("does not sort by name twice when name is the sort", () => {
    const orders = callsFor({ sort: "name" }).filter(([m]) => m === "order");
    expect(orders.map(([, column]) => column)).toEqual(["full_name", "id"]);
  });

  it("puts nulls last whichever way it is sorting", () => {
    for (const dir of ["asc", "desc"] as const) {
      const order = callsFor({ sort: "last_seen_at", dir }).find(
        ([m, c]) => m === "order" && c === "last_seen_at"
      );
      expect(order?.[2]).toEqual({ ascending: dir === "asc", nullsFirst: false });
    }
  });

  it("never paginates — that is the caller's job", () => {
    // The export in phase 2 applies this same function and simply does not call
    // pageRange(). If a .range() ever appears in here, "copy all N matching"
    // starts returning one page and reporting success.
    const calls = callsFor({ page: 4 });
    expect(calls.some(([m]) => m === "range" || m === "limit")).toBe(false);
  });
});

describe("pagination arithmetic", () => {
  it("produces inclusive PostgREST bounds", () => {
    expect(pageRange(1)).toEqual({ from: 0, to: PAGE_SIZE - 1 });
    expect(pageRange(2)).toEqual({ from: PAGE_SIZE, to: 2 * PAGE_SIZE - 1 });
    // Page 0 and negatives are clamped rather than producing a negative offset.
    expect(pageRange(0)).toEqual({ from: 0, to: PAGE_SIZE - 1 });
  });

  it("reports at least one page, so an empty result is 'page 1 of 1'", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(1)).toBe(1);
    expect(pageCount(PAGE_SIZE)).toBe(1);
    expect(pageCount(PAGE_SIZE + 1)).toBe(2);
  });
});

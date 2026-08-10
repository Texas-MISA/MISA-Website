import { describe, expect, it } from "vitest";

import {
  adjustmentFilterToParams,
  applyAdjustmentFilter,
  applyAttendanceFilter,
  attendanceFilterToParams,
  parseAdjustmentFilter,
  parseAttendanceFilter,
  UNASSIGNED_EVENT,
  type LedgerQuery,
} from "@/lib/ledger-filters";

// Pure tests for the two ledger filter cores (Stage 8 phase 2), driven through
// a recorder fake. Same approach as tests/filters.test.ts: the builders are
// typed structurally, so nothing here needs a database or supabase-js.

type Call = { op: string; args: unknown[] };

/**
 * Records what a builder asked for.
 *
 * 🔓 The important part is what it does NOT implement: `limit`, `range`,
 * `select` and `order`. If a builder ever reaches for one, this stops
 * compiling — which is the whole reason the query is a structural type. The row
 * window belongs to the caller, and the screens (200 rows) and the archival
 * export (up to MAX_EXPORT_ROWS) want different ones.
 */
class Recorder implements LedgerQuery<Recorder> {
  calls: Call[] = [];
  private push(op: string, args: unknown[]): Recorder {
    this.calls.push({ op, args });
    return this;
  }
  eq(c: string, v: string | number | boolean) { return this.push("eq", [c, v]); }
  gte(c: string, v: string | number) { return this.push("gte", [c, v]); }
  lt(c: string, v: string | number) { return this.push("lt", [c, v]); }
  is(c: string, v: null) { return this.push("is", [c, v]); }
  not(c: string, op: string, v: null) { return this.push("not", [c, op, v]); }

  ops(): string[] {
    return this.calls.map((call) => `${call.op}(${call.args.join(",")})`);
  }
}

describe("adjustment filter", () => {
  it("defaults to everything, and narrows nothing", () => {
    const filter = parseAdjustmentFilter({});
    expect(filter).toEqual({
      officer: "",
      category: "",
      member: "",
      state: "all",
      from: "",
      to: "",
    });
    expect(applyAdjustmentFilter(new Recorder(), filter).ops()).toEqual([]);
  });

  it("keeps voided rows visible by default", () => {
    // The ledger's job is to show what happened, and a void is something that
    // happened. `state=all` must add no predicate at all.
    const filter = parseAdjustmentFilter({ state: "all" });
    expect(applyAdjustmentFilter(new Recorder(), filter).ops()).toEqual([]);
  });

  it("translates live and voided to the two null tests", () => {
    expect(
      applyAdjustmentFilter(
        new Recorder(),
        parseAdjustmentFilter({ state: "live" })
      ).ops()
    ).toEqual(["is(voided_at,)"]);
    expect(
      applyAdjustmentFilter(
        new Recorder(),
        parseAdjustmentFilter({ state: "voided" })
      ).ops()
    ).toEqual(["not(voided_at,is,)"]);
  });

  it("ignores a category that is not a real category", () => {
    expect(parseAdjustmentFilter({ category: "bribery" }).category).toBe("");
    expect(parseAdjustmentFilter({ category: "volunteer" }).category).toBe(
      "volunteer"
    );
  });

  it("ignores an officer or member that is not a uuid", () => {
    // These reach a PostgREST `eq` as-is; anything not a uuid is dropped before
    // the query is built, the same discipline the export route applies to ids.
    expect(parseAdjustmentFilter({ officer: "'; drop table" }).officer).toBe("");
    expect(parseAdjustmentFilter({ member: "42" }).member).toBe("");
    const real = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    expect(parseAdjustmentFilter({ officer: real }).officer).toBe(real);
  });
});

describe("attendance filter", () => {
  it("defaults to pending, oldest first", () => {
    // The queue exists for the unresolved rows, and an officer arriving from
    // the dashboard badge wants those.
    expect(parseAttendanceFilter({})).toEqual({
      status: "pending",
      event: "",
      from: "",
      to: "",
      sort: "oldest",
    });
  });

  it("treats `all` as every status and flips the default sort", () => {
    const filter = parseAttendanceFilter({ status: "all" });
    expect(filter.status).toBe("");
    expect(filter.sort).toBe("newest");
    expect(applyAttendanceFilter(new Recorder(), filter).ops()).toEqual([]);
  });

  it("falls back to the default for a status that is not a status", () => {
    // ⚠️ The behaviour Stage 8 changed. `?status=xyz` used to reach
    // `.eq("status","xyz")` and match nothing — a screen reporting "no matching
    // submissions" for a value with no control behind it. A filter with no
    // control on screen must narrow nothing.
    expect(parseAttendanceFilter({ status: "xyz" }).status).toBe("pending");
    for (const status of ["pending", "present", "rejected"]) {
      expect(parseAttendanceFilter({ status }).status).toBe(status);
    }
  });

  it("keeps the unassigned sentinel but drops a bogus event id", () => {
    expect(parseAttendanceFilter({ event: UNASSIGNED_EVENT }).event).toBe(
      UNASSIGNED_EVENT
    );
    expect(parseAttendanceFilter({ event: "not-an-id" }).event).toBe("");
    expect(
      applyAttendanceFilter(
        new Recorder(),
        parseAttendanceFilter({ event: UNASSIGNED_EVENT, status: "all" })
      ).ops()
    ).toEqual(["is(event_id,)"]);
  });
});

describe("the Central half-open date bound", () => {
  // 🪤 The rule both pages carried their own copy of, and the reason this
  // module exists. A bare `.lte(column, "2026-04-07")` is a UTC-midnight cut
  // that silently drops five or six hours of a Central day.

  it("anchors the lower bound at Central midnight, not UTC", () => {
    const ops = applyAdjustmentFilter(
      new Recorder(),
      parseAdjustmentFilter({ from: "2026-04-07" })
    ).ops();
    // April is CDT, UTC-5, so Central midnight is 05:00Z the same day.
    expect(ops).toEqual(["gte(awarded_at,2026-04-07T05:00:00.000Z)"]);
  });

  it("makes the upper bound the START of the following day", () => {
    const ops = applyAdjustmentFilter(
      new Recorder(),
      parseAdjustmentFilter({ to: "2026-04-07" })
    ).ops();
    expect(ops).toEqual(["lt(awarded_at,2026-04-08T05:00:00.000Z)"]);
  });

  it("uses lt and never lte", () => {
    const calls = applyAttendanceFilter(
      new Recorder(),
      parseAttendanceFilter({ from: "2026-01-01", to: "2026-01-31", status: "all" })
    ).calls;
    expect(calls.map((c) => c.op)).toEqual(["gte", "lt"]);
  });

  it("crosses the DST boundary without shifting", () => {
    // 1 November 2026 is CDT (UTC-5); 30 November is CST (UTC-6). A fixed
    // offset would put one of these an hour out.
    const ops = applyAttendanceFilter(
      new Recorder(),
      parseAttendanceFilter({ from: "2026-11-01", to: "2026-11-30", status: "all" })
    ).ops();
    expect(ops).toEqual([
      "gte(submitted_at,2026-11-01T05:00:00.000Z)",
      "lt(submitted_at,2026-12-01T06:00:00.000Z)",
    ]);
  });

  it("ignores a date that is not a date, rather than throwing", () => {
    // ⚠️ Also new in Stage 8, and this one was a live 500. These went straight
    // into centralWallTimeToInstant, which splits on "-" and maps Number — so
    // `?from=yesterday` gives NaN, and zoneOffsetMs throws at lib/events.ts:99
    // formatting an invalid Date. Confirmed by running it before writing this.
    for (const bad of ["yesterday", "2026-13-01", "2026-02-31", "26-01-01", ""]) {
      expect(parseAdjustmentFilter({ from: bad }).from).toBe("");
    }
    expect(parseAdjustmentFilter({ from: "2026-02-28" }).from).toBe("2026-02-28");
    expect(parseAdjustmentFilter({ from: "2028-02-29" }).from).toBe("2028-02-29");
  });
});

describe("serializing round-trips", () => {
  // The property that lets an export URL be built from a filter rather than
  // from the incoming query string: parse(toParams(f)) === f.

  it("round-trips every adjustment filter", () => {
    const cases = [
      {},
      { state: "live" },
      { state: "voided" },
      { category: "competition" },
      { officer: "3f2504e0-4f89-41d3-9a0c-0305e82c3301" },
      { member: "3f2504e0-4f89-41d3-9a0c-0305e82c3302" },
      { from: "2026-08-01", to: "2026-08-31" },
    ];
    for (const raw of cases) {
      const filter = parseAdjustmentFilter(raw);
      const back = parseAdjustmentFilter(
        Object.fromEntries(adjustmentFilterToParams(filter))
      );
      expect(back, JSON.stringify(raw)).toEqual(filter);
    }
  });

  it("round-trips every attendance filter, defaults included", () => {
    const cases = [
      {},
      { status: "all" },
      { status: "present" },
      { status: "rejected", sort: "oldest" },
      { status: "pending", sort: "newest" },
      { event: UNASSIGNED_EVENT },
      { event: "3f2504e0-4f89-41d3-9a0c-0305e82c3303", status: "all" },
      { from: "2026-08-01", to: "2026-08-31", status: "all" },
    ];
    for (const raw of cases) {
      const filter = parseAttendanceFilter(raw);
      const back = parseAttendanceFilter(
        Object.fromEntries(attendanceFilterToParams(filter))
      );
      expect(back, JSON.stringify(raw)).toEqual(filter);
    }
  });

  it("emits nothing for a default view", () => {
    expect(adjustmentFilterToParams(parseAdjustmentFilter({})).toString()).toBe("");
    expect(attendanceFilterToParams(parseAttendanceFilter({})).toString()).toBe("");
  });

  it("sorts its keys, so the string is a function of the filter", () => {
    // Same property lib/presets.ts leans on: two officers who set the same
    // filters in a different order get the same URL.
    const a = adjustmentFilterToParams(
      parseAdjustmentFilter({ state: "live", category: "volunteer", from: "2026-08-01" })
    ).toString();
    const b = adjustmentFilterToParams(
      parseAdjustmentFilter({ from: "2026-08-01", category: "volunteer", state: "live" })
    ).toString();
    expect(a).toBe(b);
    expect(a).toBe("category=volunteer&from=2026-08-01&state=live");
  });
});

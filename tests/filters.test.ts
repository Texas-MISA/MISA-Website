import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  applyMemberFilter,
  chunkRange,
  defaultDirection,
  hasRelationalFilter,
  isDefaultFilter,
  needsAttendanceEmbed,
  relationalFilterCount,
  memberFilterFields,
  memberFilterToParams,
  memberFilterUrl,
  MAX_FIELD_VALUE_LENGTH,
  MAX_SEARCH_LENGTH,
  MEMBER_SORTS,
  NO_CUSTOM_FIELDS,
  parseMemberFilter,
  READ_CHUNK,
  sortColumn,
  type FilterableQuery,
  type MemberFilter,
  type SortableField,
} from "@/lib/filters";
import { customFieldKey } from "@/lib/members";

// Pure tests for the directory's filter core (§7 Stage 6 phase 1). No database:
// applyMemberFilter is handed a recording fake in place of a PostgREST builder,
// which is the whole reason lib/filters.ts types the builder structurally
// instead of importing supabase-js.

type Call = [method: string, ...args: unknown[]];

// An interface rather than a type alias, and not a style choice: a self-
// referential `type Recorder = FilterableQuery<Recorder> & …` is circular to
// tsc, which then infers `any` for every callback parameter below and silently
// stops type-checking the file. Interfaces resolve lazily and do not.
interface Recorder extends FilterableQuery<Recorder> {
  calls: Call[];
}

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
    or(filters) {
      calls.push(["or", filters]);
      return q;
    },
    // Phase 6. Adding a method to FilterableQuery without adding it here is a
    // compile error in this file rather than a silent gap in coverage, which is
    // the reason the structural type exists at all.
    is(column, value) {
      calls.push(["is", column, value]);
      return q;
    },
    not(column, operator, value) {
      calls.push(["not", column, operator, value]);
      return q;
    },
    order(column, options) {
      calls.push(["order", column, options]);
      return q;
    },
  };
  return q;
}

/** Most tests here run against no definitions at all — the pre-phase-4 world,
 * which is exactly what they were written to describe. Phase 4's custom sorting
 * has its own blocks that pass real ones. Imported rather than redeclared so
 * "no custom fields" means one thing in the tests and the source alike. */
const NO_FIELDS = NO_CUSTOM_FIELDS;

function callsFor(
  filter: Partial<MemberFilter>,
  fields: readonly SortableField[] = NO_FIELDS
): Call[] {
  const full = parseMemberFilter({});
  return applyMemberFilter(recorder(), { ...full, ...filter }, fields).calls;
}

describe("parseMemberFilter", () => {
  it("defaults to the active roster sorted by name", () => {
    const filter = parseMemberFilter({});
    expect(filter.state).toBe("active");
    expect(filter.sort).toBe("name");
    expect(filter.dir).toBe("asc");
    expect(filter.minPoints).toBeNull();
    expect(isDefaultFilter(filter)).toBe(true);
  });

  it("gives the points column a descending default and the text columns ascending", () => {
    expect(parseMemberFilter({ sort: "total_points" }).dir).toBe("desc");
    expect(parseMemberFilter({ sort: "eid" }).dir).toBe("asc");
    expect(parseMemberFilter({ sort: "email" }).dir).toBe("asc");
    // An explicit direction always wins over the default.
    expect(parseMemberFilter({ sort: "total_points", dir: "asc" }).dir).toBe(
      "asc"
    );
  });

  it("sorts on the displayed columns and nothing else", () => {
    // Email is newly sortable in phase 3 — displayed since phase 1, but with no
    // header of its own until the table shrank to four columns.
    expect(parseMemberFilter({ sort: "email" }).sort).toBe("email");
    // The phase-1 sort keys are gone with their columns. A URL naming one must
    // fall back rather than order by something nobody can see.
    for (const retired of [
      "joined_at",
      "events_attended",
      "attendance_points",
      "bonus_points",
      "attendance_rate",
      "last_seen_at",
      "pending_count",
    ]) {
      expect(parseMemberFilter({ sort: retired }).sort).toBe("name");
    }
  });

  // Phase 4. A `cf:` key is only a sort key if it names a live field that the
  // directory actually shows.
  it("accepts a cf: sort key naming a live directory field", () => {
    const fields: SortableField[] = [
      { key: "committee_paid", showInDirectory: true },
    ];
    expect(parseMemberFilter({ sort: "cf:committee_paid" }, fields).sort).toBe(
      "cf:committee_paid"
    );
  });

  it("falls back to name for a cf: key naming nothing sortable", () => {
    const fields: SortableField[] = [
      { key: "committee_paid", showInDirectory: true },
      // Defined, editable on the detail page, but not a column — so not a sort.
      { key: "shirt_size", showInDirectory: false },
    ];
    for (const sort of [
      "cf:shirt_size",
      // Archived since the officer bookmarked the URL, so absent from the list.
      "cf:committee_2025",
      "cf:",
      // Would be a sort-injection surface if it ever reached the query.
      "cf:committee,full_name",
      "cf:full_name",
    ]) {
      expect(parseMemberFilter({ sort }, fields).sort, sort).toBe("name");
    }
  });

  // The default argument is the pre-phase-4 world, not a shortcut: a caller
  // with no definitions to hand must not be able to name one either.
  it("knows no custom fields when none are passed", () => {
    expect(parseMemberFilter({ sort: "cf:committee_paid" }).sort).toBe("name");
  });

  it("defaults a custom sort ascending, like the text columns it resembles", () => {
    const fields: SortableField[] = [
      { key: "committee_paid", showInDirectory: true },
    ];
    expect(parseMemberFilter({ sort: "cf:committee_paid" }, fields).dir).toBe("asc");
    expect(
      parseMemberFilter({ sort: "cf:committee_paid", dir: "desc" }, fields).dir
    ).toBe("desc");
  });

  it("falls back rather than throwing on values a human edited into the URL", () => {
    const filter = parseMemberFilter({
      state: "banana",
      sort: "'; drop table members; --",
      dir: "sideways",
    });
    expect(filter.state).toBe("active");
    expect(filter.sort).toBe("name");
    expect(filter.dir).toBe("asc");
  });

  it("tolerates a phase-1 bookmark without letting it narrow anything", () => {
    // The retired fields left MemberFilter entirely rather than merely losing
    // their controls. An old URL must therefore parse to the default filter —
    // not to an invisible narrowing the officer cannot account for, which is
    // the phase-1 defect arriving from the other direction.
    //
    // 📌 The list keeps shrinking, and that is the honest record of what has
    // been un-retired rather than a weakening of the test. `source` left it in
    // phase 5c; `minEvents` and `maxEvents` leave it here, because phase 6
    // brings the "attended fewer than N events" query back with a control in
    // the Attendance panel. A phase-1 bookmark carrying any of the three now
    // narrows again — correctly, because it narrows *with a control on screen*.
    // The invariant was never "an old bookmark can't narrow"; it is "nothing
    // narrows without a control." These three still have neither.
    const filter = parseMemberFilter({
      minRate: "50",
      joinedFrom: "2026-01-01",
      joinedTo: "2026-06-30",
    });
    expect(isDefaultFilter(filter)).toBe(true);
    // And it does not survive back into the URL.
    expect(memberFilterToParams(filter).toString()).toBe("");
    // Nor does it reach the query.
    const calls = applyMemberFilter(recorder(), filter, NO_FIELDS).calls;
    expect(
      calls.filter(
        ([, column]) =>
          column === "attendance_rate" ||
          column === "events_attended" ||
          column === "joined_at" ||
          column === "source"
      )
    ).toHaveLength(0);
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

  it("takes the first value when a key is repeated", () => {
    expect(parseMemberFilter({ state: ["inactive", "all"] }).state).toBe(
      "inactive"
    );
  });
});

describe("the search term is sanitized where the filter is built", () => {
  const q = (raw: string) => parseMemberFilter({ q: raw }).q;

  it("keeps the characters an email or an EID is made of", () => {
    // Stripping these would make most of the roster unsearchable, and searching
    // an email is most of the point. applyMemberFilter quotes the value instead,
    // which is what makes `.` and `,` safe to keep.
    expect(q("a.person+tag@example.edu")).toBe("a.person+tag@example.edu");
    expect(q("Nolan, Dara")).toBe("Nolan, Dara");
    expect(q("vi-9701")).toBe("vi-9701");
    expect(q("some_one")).toBe("some_one");
    expect(q("O'Brien (Sam)")).toBe("O'Brien (Sam)");
  });

  it("strips the ILIKE wildcards, so a search box is not a pattern language", () => {
    // A bare "%" would silently match the entire roster while reading as a
    // legitimately-narrowed result.
    expect(q("%")).toBe("");
    expect(q("*")).toBe("");
    expect(q("ni%all")).toBe("niall");
  });

  it("strips the two characters the quoted value cannot survive", () => {
    expect(q('say "hi"')).toBe("say hi");
    expect(q("back\\slash")).toBe("backslash");
  });

  it("collapses whitespace and caps the length", () => {
    expect(q("  Dara   Nolan  ")).toBe("Dara Nolan");
    expect(q("")).toBe("");
    expect(q("   ")).toBe("");
    expect(q("a".repeat(200))).toHaveLength(MAX_SEARCH_LENGTH);
  });

  it("round-trips a sanitized term through the URL", () => {
    const filter = parseMemberFilter({ q: '  Dara %"Nolan"  ' });
    expect(filter.q).toBe("Dara Nolan");
    const again = parseMemberFilter(
      Object.fromEntries(memberFilterToParams(filter))
    );
    expect(again).toEqual(filter);
  });
});

describe("memberFilterToParams", () => {
  it("round-trips through parseMemberFilter", () => {
    const original = parseMemberFilter({
      state: "all",
      q: "dara",
      minPoints: "3",
      maxPoints: "40",
      sort: "total_points",
      dir: "asc",
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
    const params = memberFilterToParams(filter, { dir: undefined });
    expect(params.get("dir")).toBe("asc");
  });

  it("defaultDirection agrees with what the parser would have chosen", () => {
    for (const sort of MEMBER_SORTS) {
      expect(defaultDirection(sort)).toBe(parseMemberFilter({ sort }).dir);
    }
  });
});

describe("sortColumn", () => {
  const fields: SortableField[] = [
    { key: "committee_paid", showInDirectory: true },
    { key: "shirt_size", showInDirectory: false },
  ];

  it("maps the built-ins to their real column names", () => {
    expect(sortColumn("name", fields)).toBe("full_name");
    expect(sortColumn("email", fields)).toBe("email");
    expect(sortColumn("eid", fields)).toBe("eid");
    expect(sortColumn("total_points", fields)).toBe("total_points");
  });

  it("maps a live directory field to its JSON path", () => {
    expect(sortColumn(customFieldKey("committee_paid"), fields)).toBe(
      "custom_fields->>committee_paid"
    );
  });

  // A field the officer chose not to show is not sortable either: sorting by a
  // column nobody can see rearranges the list for no visible reason, which is
  // the argument that cut phase 1's ten sort keys down to four.
  it("refuses a field that is not a directory column", () => {
    expect(sortColumn(customFieldKey("shirt_size"), fields)).toBeNull();
  });

  it("returns null rather than guessing for anything unrecognized", () => {
    for (const sort of ["", "joined_at", "cf:", "cf:gone", "full_name"]) {
      expect(sortColumn(sort, fields), sort).toBeNull();
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

  it("bounds the roster on total points", () => {
    const calls = callsFor({ minPoints: 3, maxPoints: 12 });
    expect(calls).toContainEqual(["gte", "total_points", 3]);
    expect(calls).toContainEqual(["lte", "total_points", 12]);
  });

  describe("custom-field sorting (phase 4)", () => {
    const fields: SortableField[] = [
      { key: "committee_paid", showInDirectory: true },
      { key: "shirt_size", showInDirectory: false },
    ];
    const orders = (calls: Call[]) => calls.filter(([m]) => m === "order");

    it("orders by the JSON path for a live directory field", () => {
      const calls = callsFor({ sort: customFieldKey("committee_paid") }, fields);
      expect(orders(calls)[0]).toEqual([
        "order",
        "custom_fields->>committee_paid",
        { ascending: true, nullsFirst: false },
      ]);
    });

    // Sparse by nature: most members will hold no answer for most fields, and a
    // missing key reads as SQL NULL. Nulls float to the top of a descending sort
    // unless told otherwise, which would bury everyone who HAS an answer.
    it("keeps members with no answer last in both directions", () => {
      for (const dir of ["asc", "desc"] as const) {
        const calls = callsFor(
          { sort: customFieldKey("committee_paid"), dir },
          fields
        );
        expect(orders(calls)[0][2]).toEqual({
          ascending: dir === "asc",
          nullsFirst: false,
        });
      }
    });

    it("still ends on a total order, so pages cannot skip or repeat", () => {
      const calls = orders(callsFor({ sort: customFieldKey("committee_paid") }, fields));
      // A dropdown has a handful of options over the whole roster, so ties are
      // the rule rather than the exception here — the spike reproduced exactly
      // this, losing a row across a page boundary without the id tie-break.
      expect(calls.at(-1)).toEqual(["order", "id", { ascending: true }]);
      expect(calls.map((c) => c[1])).toContain("full_name");
    });

    // 🔓 applyMemberFilter re-checks rather than trusting that parseMemberFilter
    // sanitized first, because this is the function that builds the query string.
    it("falls back to full_name rather than interpolating an unsafe key", () => {
      for (const sort of [
        "cf:committee,full_name",
        "cf:committee paid",
        "cf:shirt_size",
        "cf:never_defined",
      ]) {
        const first = orders(callsFor({ sort }, fields))[0];
        expect(first[1], sort).toBe("full_name");
      }
    });
  });

  it("searches the three displayed identity columns as ONE or-group", () => {
    // Three separate .or() calls would be three ANDed groups and match nobody —
    // a filter that silently returns an empty roster and looks like a legitimate
    // "no results".
    const groups = callsFor({ q: "dara" }).filter(([m]) => m === "or");
    expect(groups).toHaveLength(1);
    expect(groups[0][1]).toBe(
      'full_name.ilike."*dara*",email.ilike."*dara*",eid.ilike."*dara*"'
    );
  });

  it("quotes the search value, so an email is not read as filter syntax", () => {
    // `.` and `,` are PostgREST's column/operator and condition separators, and
    // an email is full of both. Unquoted, `email.ilike.*a.person@example.edu*`
    // parses as a malformed operator rather than as a search.
    const [, group] = callsFor({ q: "a.person@example.edu" }).find(
      ([m]) => m === "or"
    )!;
    expect(group).toContain('email.ilike."*a.person@example.edu*"');
    expect(group).toBe(
      'full_name.ilike."*a.person@example.edu*",' +
        'email.ilike."*a.person@example.edu*",' +
        'eid.ilike."*a.person@example.edu*"'
    );
  });

  it("emits no or-group at all when the search is empty", () => {
    expect(callsFor({ q: "" }).some(([m]) => m === "or")).toBe(false);
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
      const order = callsFor({ sort: "email", dir }).find(
        ([m, c]) => m === "order" && c === "email"
      );
      expect(order?.[2]).toEqual({ ascending: dir === "asc", nullsFirst: false });
    }
  });

  it("never windows the result — that is the caller's job", () => {
    // ⚠️ MORE load-bearing since the directory stopped paginating, not less.
    // Both callers now read in chunks and each applies its own .range(); if one
    // ever appeared in here, every caller would inherit it and "copy all N
    // matching" would return one chunk and report success.
    const calls = callsFor({});
    expect(calls.some(([m]) => m === "range" || m === "limit")).toBe(false);
  });
});

// Stage 6.5 phase 4. Dues status is the fifth displayed column and the first
// filter added since phase 3 removed six — so these assertions are as much about
// the rules that removal established as about the column itself.
describe("dues status (Stage 6.5 phase 4)", () => {
  it("defaults to 'all', which narrows nothing", () => {
    // ⚠️ The asymmetry with `state` is the point. `state` defaults to the
    // narrowing "active"; dues must not hide anyone until asked, because a
    // roster silently missing its unpaid members is a count nobody can account
    // for — on the one column with money behind it.
    const filter = parseMemberFilter({});
    expect(filter.dues).toBe("all");
    expect(isDefaultFilter(filter)).toBe(true);
    expect(callsFor({ dues: "all" }).some(([, column]) =>
      column === "dues_paid_current_term"
    )).toBe(false);
  });

  it("parses both narrowing values and falls back on anything else", () => {
    expect(parseMemberFilter({ dues: "paid" }).dues).toBe("paid");
    expect(parseMemberFilter({ dues: "unpaid" }).dues).toBe("unpaid");
    for (const junk of ["yes", "true", "1", "PAID", ""]) {
      expect(parseMemberFilter({ dues: junk }).dues).toBe("all");
    }
  });

  it("translates to one equality on the view's calculated boolean", () => {
    expect(callsFor({ dues: "paid" })).toContainEqual([
      "eq",
      "dues_paid_current_term",
      true,
    ]);
    // Not `.not("eq", true)` and not a null branch: the view computes this as an
    // `exists (…)`, so it is a real boolean in every row.
    expect(callsFor({ dues: "unpaid" })).toContainEqual([
      "eq",
      "dues_paid_current_term",
      false,
    ]);
  });

  it("composes with the other clauses rather than replacing them", () => {
    // The exit-criterion query: every unpaid active member matching a search.
    const calls = callsFor({ dues: "unpaid", state: "active", q: "sharma" });
    expect(calls).toContainEqual(["eq", "active", true]);
    expect(calls).toContainEqual(["eq", "dues_paid_current_term", false]);
    expect(calls.some(([method]) => method === "or")).toBe(true);
    expect(calls.some(([method]) => method === "range")).toBe(false);
  });

  it("is sortable, and opens on the members who have paid", () => {
    expect(parseMemberFilter({ sort: "dues" }).sort).toBe("dues");
    // Descending on a boolean is true-first. The officer picking this column is
    // looking at dues; who has paid is the answer it should open on.
    expect(parseMemberFilter({ sort: "dues" }).dir).toBe("desc");
    expect(defaultDirection("dues")).toBe("desc");
    expect(sortColumn("dues", NO_FIELDS)).toBe("dues_paid_current_term");
  });

  it("is a built-in sort key, not a custom one", () => {
    // 📌 `dues` names a column the VIEW calculates, so it belongs in
    // MEMBER_SORTS rather than behind the `cf:` namespace — and the three
    // reserved keys are what stop an officer-defined field from turning up
    // beside it claiming to answer the same question.
    expect(sortColumn("cf:dues", [{ key: "dues", showInDirectory: true }])).toBe(
      null
    );
  });

  it("round-trips through the URL, omitting only the default", () => {
    const unpaid = parseMemberFilter({ dues: "unpaid" });
    const params = memberFilterToParams(unpaid);
    expect(params.get("dues")).toBe("unpaid");
    expect(parseMemberFilter(Object.fromEntries(params)).dues).toBe("unpaid");

    expect(memberFilterToParams(parseMemberFilter({})).has("dues")).toBe(false);
  });

  it("survives a filter change, the way a cf: sort had to be taught to", () => {
    // 🪤 The memberFilterUrl trap: it re-parses what it builds, so a field the
    // round trip drops is silently reset by any OTHER control. That killed a
    // `cf:` sort on every keystroke in the search box once already.
    const filter = parseMemberFilter({ dues: "unpaid", sort: "total_points" });
    const next = memberFilterUrl(filter, { q: "sharma" }, NO_FIELDS);
    const params = new URLSearchParams(next);
    expect(params.get("dues")).toBe("unpaid");
    expect(params.get("sort")).toBe("total_points");
    expect(params.get("q")).toBe("sharma");
  });
});

// Stage 6 phase 5c. The categorical filters — `source`, and one predicate per
// officer-defined directory field. The dues third of this phase shipped early
// with Stage 6.5 phase 4 and has its own block above.
describe("categorical filters (phase 5c)", () => {
  const shirt: SortableField = { key: "shirt_size", showInDirectory: true };
  const hidden: SortableField = { key: "committee", showInDirectory: false };

  describe("source", () => {
    it("defaults to 'all' and narrows nothing", () => {
      const filter = parseMemberFilter({});
      expect(filter.source).toBe("all");
      expect(isDefaultFilter(filter)).toBe(true);
      expect(
        callsFor({ source: "all" }).some(([, column]) => column === "source")
      ).toBe(false);
    });

    it("translates to one equality", () => {
      expect(callsFor({ source: "self_checkin" })).toContainEqual([
        "eq",
        "source",
        "self_checkin",
      ]);
      expect(callsFor({ source: "admin" })).toContainEqual([
        "eq",
        "source",
        "admin",
      ]);
    });

    it("falls back for anything outside the column's own domain", () => {
      // members_source_check allows exactly two values; the parser must not be
      // the thing that discovers a third.
      for (const junk of ["officer", "SELF_CHECKIN", "1", ""]) {
        expect(parseMemberFilter({ source: junk }).source).toBe("all");
      }
    });

    it("round-trips through the URL", () => {
      const params = memberFilterToParams(
        parseMemberFilter({ source: "self_checkin" })
      );
      expect(params.get("source")).toBe("self_checkin");
      expect(parseMemberFilter(Object.fromEntries(params)).source).toBe(
        "self_checkin"
      );
    });
  });

  describe("custom fields", () => {
    it("is empty by default and adds no clause", () => {
      const filter = parseMemberFilter({}, [shirt]);
      expect(filter.custom).toEqual({});
      expect(isDefaultFilter(filter)).toBe(true);
    });

    it("reads a cf: param naming a live directory field", () => {
      const filter = parseMemberFilter({ "cf:shirt_size": "M" }, [shirt]);
      expect(filter.custom).toEqual({ shirt_size: "M" });
      expect(callsFor(filter, [shirt])).toContainEqual([
        "eq",
        "custom_fields->>shirt_size",
        "M",
      ]);
    });

    it("⚠️ ignores a field that is not a directory column", () => {
      // The same predicate sortColumn applies, for the same reason: a filter
      // with no control on screen leaves a count the officer cannot account
      // for. A stale bookmark must narrow nothing, not narrow invisibly.
      const filter = parseMemberFilter({ "cf:committee": "Socials" }, [hidden]);
      expect(filter.custom).toEqual({});
      expect(
        callsFor(filter, [hidden]).some(([method, column]) =>
          method === "eq" && String(column).startsWith("custom_fields")
        )
      ).toBe(false);
    });

    it("ignores a cf: param naming no definition at all", () => {
      // Built by walking the definitions rather than the params, so an unknown
      // key is ignored by construction — the same way every retired phase-1
      // key is.
      expect(
        parseMemberFilter({ "cf:nonexistent": "x" }, [shirt]).custom
      ).toEqual({});
    });

    it("knows no custom fields when none are passed", () => {
      expect(parseMemberFilter({ "cf:shirt_size": "M" }).custom).toEqual({});
    });

    it("🔓 drops a key the format check rejects rather than interpolating it", () => {
      // The definitions come from the database and the key is CHECK-constrained
      // there, so this cannot happen through the UI — which is exactly why it is
      // asserted. customFieldColumn re-checks at the point the key becomes part
      // of a query string, because the phase-4 spike showed PostgREST accepts a
      // space and a `"` silently, with no error at all. Dropping is the right
      // failure: a filter that does not apply beats one that applies something
      // else.
      const evil: SortableField = {
        key: "shirt,size",
        showInDirectory: true,
      };
      const filter = { ...parseMemberFilter({}), custom: { "shirt,size": "M" } };
      const calls = callsFor(filter, [evil]);
      expect(
        calls.some(([, column]) => String(column).includes("shirt,size"))
      ).toBe(false);
    });

    it("applies several fields as a conjunction", () => {
      const other: SortableField = { key: "committee", showInDirectory: true };
      const filter = parseMemberFilter(
        { "cf:shirt_size": "M", "cf:committee": "Socials" },
        [shirt, other]
      );
      const calls = callsFor(filter, [shirt, other]);
      expect(calls).toContainEqual(["eq", "custom_fields->>shirt_size", "M"]);
      expect(calls).toContainEqual(["eq", "custom_fields->>committee", "Socials"]);
    });

    it("emits clauses in key order, not insertion order", () => {
      // The query has to be a function of the filter rather than of how the
      // object was built, or two identical filters produce two different
      // recorded shapes — and the URL is the export's query string.
      const b: SortableField = { key: "b_field", showInDirectory: true };
      const a: SortableField = { key: "a_field", showInDirectory: true };
      const filter = { ...parseMemberFilter({}), custom: { b_field: "2", a_field: "1" } };

      const columns = callsFor(filter, [b, a])
        .filter(([method]) => method === "eq")
        .map(([, column]) => column)
        .filter((column) => String(column).startsWith("custom_fields"));

      expect(columns).toEqual([
        "custom_fields->>a_field",
        "custom_fields->>b_field",
      ]);

      const params = memberFilterToParams(filter).toString();
      expect(params.indexOf("a_field")).toBeLessThan(params.indexOf("b_field"));
    });

    it("📌 keeps a value the definition no longer offers", () => {
      // Orphans are information (see fieldFilterValue). "Find everyone still on
      // the retired size" is the cleanup query an officer needs after editing an
      // option list, and restricting the filter to live options would make the
      // orphans the one thing the directory cannot show.
      const filter = parseMemberFilter({ "cf:shirt_size": "XXL" }, [shirt]);
      expect(filter.custom).toEqual({ shirt_size: "XXL" });
    });

    it("caps a hand-edited value rather than passing it through", () => {
      const long = "x".repeat(500);
      const filter = parseMemberFilter({ "cf:shirt_size": long }, [shirt]);
      expect(filter.custom.shirt_size).toHaveLength(MAX_FIELD_VALUE_LENGTH);
    });

    it("treats a blank value as no filter", () => {
      expect(parseMemberFilter({ "cf:shirt_size": "   " }, [shirt]).custom).toEqual(
        {}
      );
    });

    it("🪤 survives a change to any other control", () => {
      // The memberFilterUrl re-parse trap, which phase 5c gives a second mouth:
      // the round trip reads the cf: FILTER params as well as the sort, so
      // without the definitions every custom filter would be dropped on the next
      // keystroke — not merely the sort.
      const filter = parseMemberFilter(
        { "cf:shirt_size": "M", sort: "cf:shirt_size" },
        [shirt]
      );
      const next = new URLSearchParams(
        memberFilterUrl(filter, { q: "sharma" }, [shirt])
      );
      expect(next.get("cf:shirt_size")).toBe("M");
      expect(next.get("sort")).toBe("cf:shirt_size");
      expect(next.get("q")).toBe("sharma");
    });

    it("never windows the result, however many predicates are applied", () => {
      const calls = callsFor(
        {
          ...parseMemberFilter({ "cf:shirt_size": "M" }, [shirt]),
          source: "self_checkin",
          dues: "unpaid",
          q: "a",
        },
        [shirt]
      );
      expect(calls.some(([m]) => m === "range" || m === "limit")).toBe(false);
    });
  });
});

// Stage 6 phase 6. The relational filters — the first that narrow on data the
// directory does not display, and the first whose predicate is not a column.
describe("relational filters (phase 6)", () => {
  const EVENT = "11111111-2222-4333-8444-555555555555";

  it("all five default to narrowing nothing", () => {
    const filter = parseMemberFilter({});
    expect(filter.event).toBeNull();
    expect(filter.pending).toBe("all");
    expect(filter.notSeenSince).toBeNull();
    expect(filter.minEvents).toBeNull();
    expect(filter.maxEvents).toBeNull();
    expect(isDefaultFilter(filter)).toBe(true);
    expect(hasRelationalFilter(filter)).toBe(false);
    expect(relationalFilterCount(filter)).toBe(0);
  });

  describe("has pending", () => {
    it("asks for at least one, not for a truthy count", () => {
      expect(callsFor({ pending: "has" })).toContainEqual([
        "gte",
        "pending_count",
        1,
      ]);
    });

    it("adds no clause for 'all'", () => {
      expect(
        callsFor({ pending: "all" }).some(([, c]) => c === "pending_count")
      ).toBe(false);
    });
  });

  describe("events attended", () => {
    it("bounds events_attended, not total_points", () => {
      const calls = callsFor({ minEvents: 2, maxEvents: 9 });
      expect(calls).toContainEqual(["gte", "events_attended", 2]);
      expect(calls).toContainEqual(["lte", "events_attended", 9]);
    });

    it("keeps a real 0 bound, which hides rows", () => {
      // Same null-vs-zero rule the points bounds follow: "attended 0 events" is
      // the whole point of this filter, not an unset field.
      expect(parseMemberFilter({ maxEvents: "0" }).maxEvents).toBe(0);
      expect(callsFor({ maxEvents: 0 })).toContainEqual([
        "lte",
        "events_attended",
        0,
      ]);
    });
  });

  describe("not seen since", () => {
    it("⚠️ includes members never seen at all", () => {
      // The null branch IS the filter. A bare .lt() drops nulls silently, so
      // the officer asking "who has gone quiet?" would get an answer with the
      // quietest members missing from it.
      const or = callsFor({ notSeenSince: "2026-09-01" }).find(
        ([method]) => method === "or"
      );
      expect(or?.[1]).toContain("last_seen_at.is.null");
      expect(or?.[1]).toContain("last_seen_at.lt.");
    });

    it("🪤 anchors the cutoff in Central, not UTC", () => {
      // A bare "2026-09-01" is read as UTC midnight and silently drops the last
      // five hours of the Central day before it. September is CDT (UTC-5), so
      // Central midnight is 05:00Z.
      const or = callsFor({ notSeenSince: "2026-09-01" }).find(
        ([method]) => method === "or"
      );
      expect(or?.[1]).toContain("2026-09-01T05:00:00.000Z");
    });

    it("rejects anything that is not a civil date", () => {
      for (const bad of ["yesterday", "2026-9-1", "09/01/2026", ""]) {
        expect(parseMemberFilter({ notSeenSince: bad }).notSeenSince, bad).toBeNull();
      }
    });

    it("📌 coexists with the search as a SECOND or-group", () => {
      // Separate `or=` params AND together, which is what two independent
      // concerns want. The failure the search's own comment warns about is
      // different — splitting ONE concern's alternatives across several calls
      // ANDs them and matches nothing.
      const groups = callsFor({ q: "dara", notSeenSince: "2026-09-01" }).filter(
        ([method]) => method === "or"
      );
      expect(groups).toHaveLength(2);
      expect(groups.some(([, body]) => String(body).includes("full_name.ilike"))).toBe(true);
      expect(groups.some(([, body]) => String(body).includes("last_seen_at"))).toBe(true);
    });
  });

  describe("attended / missed one event", () => {
    it("scopes the embed to present rows and asks for a match", () => {
      const calls = callsFor({ event: EVENT, eventMode: "attended" });
      expect(calls).toContainEqual(["eq", "attendance.event_id", EVENT]);
      // ⚠️ Not optional: a pending or rejected submission is not attendance.
      expect(calls).toContainEqual(["eq", "attendance.status", "present"]);
      expect(calls).toContainEqual(["not", "attendance", "is", null]);
    });

    it("inverts to an anti-join for 'missed'", () => {
      const calls = callsFor({ event: EVENT, eventMode: "missed" });
      expect(calls).toContainEqual(["is", "attendance", null]);
      expect(calls).not.toContainEqual(["not", "attendance", "is", null]);
      // The event and status clauses are identical in both modes — one embed,
      // two readings of it.
      expect(calls).toContainEqual(["eq", "attendance.event_id", EVENT]);
      expect(calls).toContainEqual(["eq", "attendance.status", "present"]);
    });

    it("🔓 drops an event id that is not a uuid", () => {
      // Interpolated into the query, so it is format-checked before it can get
      // there — the same discipline customFieldColumn applies to a key.
      for (const bad of ["' or 1=1", "abc", "11111111-2222-4333-8444", ""]) {
        expect(parseMemberFilter({ event: bad }).event, bad).toBeNull();
      }
      const calls = callsFor({ event: null, eventMode: "missed" });
      expect(calls.some(([, c]) => String(c).startsWith("attendance"))).toBe(false);
    });

    it("needs the embed only when an event is chosen", () => {
      expect(needsAttendanceEmbed(parseMemberFilter({}))).toBe(false);
      expect(needsAttendanceEmbed(parseMemberFilter({ event: EVENT }))).toBe(true);
      // The mode alone is not enough — there is nothing to have missed.
      expect(
        needsAttendanceEmbed(parseMemberFilter({ eventMode: "missed" }))
      ).toBe(false);
    });

    it("⚠️ never puts the mode in the URL without its event", () => {
      // A `eventMode=missed` with no event reads as an active filter in the
      // controls and narrows nothing — and it would break the round trip.
      const orphan = memberFilterToParams(
        parseMemberFilter({ eventMode: "missed" })
      );
      expect(orphan.has("eventMode")).toBe(false);
      expect(orphan.toString()).toBe("");

      const paired = memberFilterToParams(
        parseMemberFilter({ event: EVENT, eventMode: "missed" })
      );
      expect(paired.get("event")).toBe(EVENT);
      expect(paired.get("eventMode")).toBe("missed");
    });

    it("omits the default mode but keeps the event", () => {
      const params = memberFilterToParams(
        parseMemberFilter({ event: EVENT, eventMode: "attended" })
      );
      expect(params.get("event")).toBe(EVENT);
      expect(params.has("eventMode")).toBe(false);
    });
  });

  it("counts what the Advanced panel must open for", () => {
    // ⚠️ The panel opens on this, so an active filter can never be hidden
    // behind a collapsed lid — the phase-1 defect in a new costume.
    const filter = parseMemberFilter({
      event: EVENT,
      pending: "has",
      notSeenSince: "2026-09-01",
      minEvents: "2",
    });
    expect(hasRelationalFilter(filter)).toBe(true);
    expect(relationalFilterCount(filter)).toBe(4);
  });

  it("round-trips every field through the URL", () => {
    const filter = parseMemberFilter({
      event: EVENT,
      eventMode: "missed",
      pending: "has",
      notSeenSince: "2026-09-01",
      minEvents: "2",
      maxEvents: "9",
    });
    const back = parseMemberFilter(
      Object.fromEntries(memberFilterToParams(filter))
    );
    expect(back).toEqual(filter);
  });

  it("survives a change to any other control", () => {
    const filter = parseMemberFilter(
      { event: EVENT, eventMode: "missed", pending: "has", notSeenSince: "2026-09-01" },
      NO_FIELDS
    );
    const next = new URLSearchParams(
      memberFilterUrl(filter, { q: "dara" }, NO_FIELDS)
    );
    expect(next.get("event")).toBe(EVENT);
    expect(next.get("eventMode")).toBe("missed");
    expect(next.get("pending")).toBe("has");
    expect(next.get("notSeenSince")).toBe("2026-09-01");
  });

  it("never windows the result, however many predicates are applied", () => {
    const calls = callsFor({
      event: EVENT,
      eventMode: "missed",
      pending: "has",
      notSeenSince: "2026-09-01",
      minEvents: 1,
      maxEvents: 9,
      q: "a",
      dues: "unpaid",
      source: "self_checkin",
    });
    expect(calls.some(([m]) => m === "range" || m === "limit")).toBe(false);
  });
});

describe("chunk arithmetic", () => {
  it("produces inclusive PostgREST bounds, zero-based", () => {
    expect(chunkRange(0)).toEqual({ from: 0, to: READ_CHUNK - 1 });
    expect(chunkRange(1)).toEqual({ from: READ_CHUNK, to: 2 * READ_CHUNK - 1 });
    expect(chunkRange(2)).toEqual({
      from: 2 * READ_CHUNK,
      to: 3 * READ_CHUNK - 1,
    });
  });

  it("clamps a negative index rather than producing a negative offset", () => {
    expect(chunkRange(-1)).toEqual({ from: 0, to: READ_CHUNK - 1 });
  });
});

// Regression coverage for the defect found in the phase-1 browser walkthrough
// (2026-08-01). The numeric filter boxes were uncontrolled — `defaultValue`
// plus `onBlur` — which React reads only at mount. CLEAR is a client-side push
// with no remount, so an officer who typed "Rate at least 50", cleared, and then
// typed a points bound saw BOTH values on screen above a count that applied only
// the points one. The rate box was lying, and on this seed the two sets happened
// to coincide, which is how it would have shipped.
//
// Neither half is reachable from a node-environment test as a rendered
// component, so the fix put both translations in lib/filters.ts: what the boxes
// display, and what the next URL is. These lock them.
//
// The rate box is gone in phase 3 and the search box is the one now most exposed
// to this — it is the control an officer is likeliest to type into and clear —
// so it is covered here in the same shape.
describe("filter control state", () => {
  const base = parseMemberFilter({});

  it("shows an empty box for every unset field, so CLEAR empties them all", () => {
    // The exact post-CLEAR filter: nothing narrowing. Every box empty, and the
    // assertion is exhaustive on purpose — a new typed-into filter that forgets
    // its empty state fails here rather than on the officer's screen.
    expect(memberFilterFields(base)).toEqual({
      q: "",
      minPoints: "",
      maxPoints: "",
      minEvents: "",
      maxEvents: "",
      notSeenSince: "",
    });
  });

  it("distinguishes a real 0 bound from no bound", () => {
    // "" and "0" must never blur together: 0 is a bound that hides rows.
    const fields = memberFilterFields({ ...base, minPoints: 0 });
    expect(fields.minPoints).toBe("0");
    expect(fields.maxPoints).toBe("");
  });

  it("renders every field the filter carries", () => {
    expect(
      memberFilterFields({
        ...base,
        q: "dara",
        minPoints: 15,
        maxPoints: 40,
        minEvents: 2,
        maxEvents: 9,
        notSeenSince: "2026-09-01",
      })
    ).toEqual({
      q: "dara",
      minPoints: "15",
      maxPoints: "40",
      minEvents: "2",
      maxEvents: "9",
      // A date passes through as its civil string — no Date round trip, which
      // is what would shift it a day for anyone east or west of the server.
      notSeenSince: "2026-09-01",
    });
  });

  it("builds the next URL from the filter, not from a stale control", () => {
    // The walkthrough repro, in its phase-3 shape. The filter carries no search
    // term — whatever the box may still be showing — so editing points must not
    // resurrect one.
    const url = memberFilterUrl(base, { minPoints: "15" }, NO_CUSTOM_FIELDS);
    expect(url).toBe("minPoints=15");
    expect(url).not.toContain("q=");
  });

  it("drops a field when its box is emptied", () => {
    const withSearch: MemberFilter = { ...base, q: "dara" };
    expect(memberFilterUrl(withSearch, { q: "" }, NO_CUSTOM_FIELDS)).toBe("");
    // And leaves the others alone while doing it.
    expect(memberFilterUrl({ ...withSearch, minPoints: 15 }, { q: "" }, NO_CUSTOM_FIELDS)).toBe(
      "minPoints=15"
    );
  });

  it("ignores a stale page param from a pre-2026-08-07 bookmark", () => {
    // The directory stopped paginating and `page` left MemberFilter with it, so
    // there is nothing to drop any more — an old URL simply parses without it.
    const stale = parseMemberFilter(
      { minPoints: "15", page: "3" },
      NO_CUSTOM_FIELDS
    );
    expect(memberFilterToParams(stale).toString()).toBe("minPoints=15");
    expect(memberFilterUrl(stale, { minPoints: "20" }, NO_CUSTOM_FIELDS)).toBe(
      "minPoints=20"
    );
  });

  it("preserves sort and direction across a filter change", () => {
    const sorted: MemberFilter = { ...base, sort: "total_points", dir: "asc" };
    // total_points defaults to desc, so an explicit asc has to survive.
    const url = memberFilterUrl(sorted, { state: "all" }, NO_CUSTOM_FIELDS);
    const params = new URLSearchParams(url);
    expect(params.get("sort")).toBe("total_points");
    expect(params.get("dir")).toBe("asc");
    expect(params.get("state")).toBe("all");
  });

  it("sanitizes a typed value immediately rather than displaying an unapplied one", () => {
    // A `%` is stripped on the next request either way; putting the sanitized
    // value in the URL is what stops the box from reading "ni%all" over results
    // matched on "niall" — the same class of lie as the original defect.
    expect(memberFilterUrl(base, { q: "ni%all" }, NO_CUSTOM_FIELDS)).toBe("q=niall");
    // Junk narrows nothing at all, and must not reach the query string.
    expect(memberFilterUrl(base, { minPoints: "abc" }, NO_CUSTOM_FIELDS)).toBe("");
    expect(memberFilterUrl(base, { minPoints: "-5" }, NO_CUSTOM_FIELDS)).toBe("");
    expect(memberFilterUrl(base, { q: "   " }, NO_CUSTOM_FIELDS)).toBe("");
  });

  it("round-trips: the URL it emits parses back to the fields it displays", () => {
    const url = memberFilterUrl(base, { q: "  Dara  Nolan ", minPoints: "7" }, NO_CUSTOM_FIELDS);
    const reparsed = parseMemberFilter(
      Object.fromEntries(new URLSearchParams(url))
    );
    expect(memberFilterFields(reparsed).q).toBe("Dara Nolan");
    expect(memberFilterFields(reparsed).minPoints).toBe("7");
  });

  // 🪤 Regression, named for the bug it was written after. memberFilterUrl
  // re-parses what it built, and re-parsing without the definitions makes a
  // `cf:` sort key name nothing — so it degraded to `name` on EVERY filter
  // change. Typing one character in the search box silently reset the column
  // the officer had sorted by, and only the URL showed it.
  describe("a custom sort survives a filter change (phase 4)", () => {
    const fields: SortableField[] = [
      { key: "committee_paid", showInDirectory: true },
      { key: "shirt_size", showInDirectory: false },
    ];
    const sorted = parseMemberFilter(
      { sort: customFieldKey("committee_paid") },
      fields
    );

    it("keeps the cf: sort when the field is live", () => {
      const url = memberFilterUrl(sorted, { q: "dara" }, fields);
      expect(new URLSearchParams(url).get("sort")).toBe("cf:committee_paid");
      expect(new URLSearchParams(url).get("q")).toBe("dara");
    });

    it("keeps it across every other control too", () => {
      const changes: Record<string, string>[] = [
        { state: "all" },
        { minPoints: "3" },
        { maxPoints: "40" },
      ];
      for (const change of changes) {
        const url = memberFilterUrl(sorted, change, fields);
        expect(new URLSearchParams(url).get("sort"), JSON.stringify(change)).toBe(
          "cf:committee_paid"
        );
      }
    });

    it("drops a sort naming a field that is gone or not a column", () => {
      // Archived between the officer's bookmark and now, so absent from the
      // list — and one that exists but is not a directory column.
      for (const stale of ["cf:committee_2025", "cf:shirt_size"]) {
        const filter = { ...sorted, sort: stale };
        const url = memberFilterUrl(filter, { q: "dara" }, fields);
        expect(new URLSearchParams(url).get("sort"), stale).toBeNull();
      }
    });

    it("does not leave a stale direction behind when the sort degrades", () => {
      // total_points defaults desc; name defaults asc. A dropped sort that kept
      // `dir=desc` would silently reverse the fallback column.
      const filter = { ...sorted, sort: "cf:gone", dir: "desc" as const };
      const url = memberFilterUrl(filter, { q: "dara" }, fields);
      const params = new URLSearchParams(url);
      expect(params.get("sort")).toBeNull();
      expect(params.get("dir")).toBe("desc");
      // …and that `dir` is a real, honoured choice on the fallback column
      // rather than a leftover: re-parsing yields a descending name sort.
      const reparsed = parseMemberFilter(
        Object.fromEntries(params),
        fields
      );
      expect(reparsed.sort).toBe("name");
      expect(reparsed.dir).toBe("desc");
    });
  });
});

// The defect above lived in JSX, not in a pure function: `defaultValue` instead
// of `value` on the numeric inputs. Nothing in a node-environment suite can render the
// component, so none of the tests above would fail if someone changed it back —
// they lock the extracted logic, not the wiring that consumes it.
//
// This is the guard for the wiring itself. It is a source assertion rather than
// a behavioural one, which is unusual and deliberate: the alternative is a DOM
// test environment the project does not otherwise need. If the component moves,
// update the path here rather than deleting the test — the invariant is that a
// filter control's displayed value comes from state that resyncs with the URL,
// and an uncontrolled input cannot do that.
describe("the filter controls stay controlled", () => {
  const source = readFileSync(
    new URL(
      "../app/admin/(shell)/members/_components/member-filters.tsx",
      import.meta.url
    ),
    "utf8"
  );

  it("uses no defaultValue, which React reads only at mount", () => {
    // CLEAR is a client-side push with no remount, so a defaultValue here
    // leaves the officer's typed number on screen above a count ignoring it.
    // Matching the JSX attribute form, so prose about the bug stays allowed.
    expect(source).not.toContain("defaultValue=");
  });

  it("drives every typed-into box from the shared field translation", () => {
    expect(source).toContain("memberFilterFields");
    // Every key of MemberFilterFields, derived rather than listed, so adding a
    // field to the translation without wiring its control fails here.
    for (const field of Object.keys(memberFilterFields(parseMemberFilter({})))) {
      expect(source).toContain(`value={fields.${field}}`);
    }
  });

  it("builds its URLs through lib/filters rather than by hand", () => {
    expect(source).toContain("memberFilterUrl");
    // Assembling from the incoming URL text is what let a stale control and the
    // query disagree in the first place.
    expect(source).not.toContain("new URLSearchParams");
  });
});

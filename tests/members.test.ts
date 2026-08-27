import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  AUDITED_FIELD_COLUMNS,
  AUDITED_MEMBER_COLUMNS,
  classifyTermEvents,
  customFieldColumn,
  customFieldKey,
  FIELD_KEY_PATTERN,
  fieldOptions,
  fieldValue,
  formatAttendanceRate,
  isAllowedFieldValue,
  isValidFieldKey,
  parseCustomFieldKey,
  setFieldValue,
  withoutToken,
  type TermEventInput,
} from "@/lib/members";

// Pure tests for the member detail page's core (§7 Stage 6 phase 3). No
// database and no clock: `now` is injected, so an event can be placed either
// side of it without mocking time.

const NOW = new Date("2026-03-15T18:00:00.000Z");

function event(id: string, endsAt: string): TermEventInput {
  return { id, ends_at: endsAt };
}

describe("classifyTermEvents", () => {
  it("distinguishes attended, missed, and upcoming", () => {
    const summary = classifyTermEvents(
      [
        event("went", "2026-03-01T02:00:00.000Z"),
        event("skipped", "2026-03-08T02:00:00.000Z"),
        event("later", "2026-04-01T02:00:00.000Z"),
      ],
      new Set(["went"]),
      NOW
    );

    expect(summary.events).toEqual([
      { eventId: "went", state: "attended" },
      { eventId: "skipped", state: "missed" },
      { eventId: "later", state: "upcoming" },
    ]);
    expect(summary).toMatchObject({ attended: 1, missed: 1, upcoming: 1 });
  });

  it("never counts a future event as a miss", () => {
    // ⚠️ The whole reason this is three states rather than two.
    // member_directory.events_possible counts only events that have ended, so
    // painting a future event as missed would contradict the rate printed above
    // it and make every member look worse at the start of a term.
    const summary = classifyTermEvents(
      [
        event("a", "2026-05-01T02:00:00.000Z"),
        event("b", "2026-06-01T02:00:00.000Z"),
      ],
      new Set(),
      NOW
    );

    expect(summary.missed).toBe(0);
    expect(summary.upcoming).toBe(2);
    expect(summary.events.every((e) => e.state === "upcoming")).toBe(true);
  });

  it("treats an event ending exactly now as ended", () => {
    // The same half-open boundary the view uses on the other side of the
    // comparison (`ends_at < now()`), so the grid's attended+missed and the
    // view's events_possible cannot disagree by one at the boundary.
    const summary = classifyTermEvents(
      [event("edge", NOW.toISOString())],
      new Set(),
      NOW
    );
    expect(summary.missed).toBe(1);
    expect(summary.upcoming).toBe(0);
  });

  it("lets attendance outrank the clock", () => {
    // A member marked present at an event that has not ended is attended, not
    // upcoming — attendance is a fact, and the check-in window can legitimately
    // open before the event does.
    const summary = classifyTermEvents(
      [event("running", "2026-04-01T02:00:00.000Z")],
      new Set(["running"]),
      NOW
    );
    expect(summary.events[0].state).toBe("attended");
    expect(summary.attended).toBe(1);
    expect(summary.upcoming).toBe(0);
  });

  it("ignores attendance for events outside the term", () => {
    // The attended set is this member's whole history; the event list is one
    // term. A stale id in the set must not invent a row or a count.
    const summary = classifyTermEvents(
      [event("in-term", "2026-03-01T02:00:00.000Z")],
      new Set(["in-term", "last-term", "next-term"]),
      NOW
    );
    expect(summary.events).toHaveLength(1);
    expect(summary.attended).toBe(1);
  });

  it("handles an empty term without dividing by anything", () => {
    const summary = classifyTermEvents([], new Set(), NOW);
    expect(summary).toEqual({
      events: [],
      attended: 0,
      missed: 0,
      upcoming: 0,
    });
  });
});

describe("formatAttendanceRate", () => {
  it("renders no rate as an em dash, never as 0%", () => {
    // Null means the term has no completed events, which is not "attended
    // nothing" — and 0% would sort below a real 5% at the start of a semester.
    expect(formatAttendanceRate(null)).toBe("—");
  });

  it("renders a real zero as 0%", () => {
    expect(formatAttendanceRate(0)).toBe("0%");
  });

  it("turns the view's fraction into whole percent", () => {
    expect(formatAttendanceRate(0.5)).toBe("50%");
    expect(formatAttendanceRate(1)).toBe("100%");
    expect(formatAttendanceRate(0.6667)).toBe("67%");
  });
});

// ---------------------------------------------------------------------------
// Custom fields (phase 4)
// ---------------------------------------------------------------------------

describe("isValidFieldKey", () => {
  it("accepts the documented shape", () => {
    for (const key of ["committee_paid", "a", "tshirt_size", "x9", "a".repeat(40)]) {
      expect(isValidFieldKey(key)).toBe(true);
    }
  });

  // 🔓 These are the ones that matter. The key is interpolated into a PostgREST
  // `order=` term, and the phase-4 spike showed a comma is read as a SECOND
  // order column while a space and a `"` are accepted silently with no error at
  // all — so "PostgREST would have rejected it" is not a boundary. The same
  // pattern is enforced again by member_field_definitions_key_format.
  it("rejects everything that could break out of an order term", () => {
    for (const key of [
      "committee,full_name",
      "committee.paid",
      "committee paid",
      'du"es',
      "committee)paid",
      "committee-paid",
      "committee*",
      "committee%",
      "cf:committee",
      "",
      "1committee",
      "_committee",
      "DUES",
      "committeePaid",
      "a".repeat(41),
      "committee\nfull_name",
    ]) {
      expect(isValidFieldKey(key), key).toBe(false);
    }
  });

  it("rejects keys that collide with a built-in column", () => {
    for (const key of ["email", "eid", "full_name", "total_points", "notes"]) {
      expect(isValidFieldKey(key), key).toBe(false);
    }
  });

  it("⚠️ rejects the dues keys, which are reserved for a different reason", () => {
    // The built-in keys above are reserved so two columns cannot compete for one
    // name in the export catalogue. These three forbid a duplicate ANSWER: dues
    // status is calculated from dues_payments and surfaced as
    // member_directory.dues_paid_term, so a hand-ticked dropdown beside
    // it would leave the roster saying two different things at once.
    //
    // Well-formed keys, every one of them — which is the point. Only the
    // reservation stops them, here and in migration 19's CHECK.
    for (const key of ["dues", "dues_paid", "dues_paid_term"]) {
      expect(FIELD_KEY_PATTERN.test(key), `${key} is well-formed`).toBe(true);
      expect(isValidFieldKey(key), key).toBe(false);
    }
  });
});

describe("custom sort keys", () => {
  it("round-trips through the cf: namespace", () => {
    expect(customFieldKey("committee_paid")).toBe("cf:committee_paid");
    expect(parseCustomFieldKey("cf:committee_paid")).toBe("committee_paid");
  });

  it("reports a built-in sort key as not custom", () => {
    for (const sort of ["name", "email", "eid", "total_points"]) {
      expect(parseCustomFieldKey(sort)).toBeNull();
    }
  });

  it("treats a bare prefix as naming nothing", () => {
    expect(parseCustomFieldKey("cf:")).toBeNull();
  });

  // The namespace is what makes a field keyed `email` unable to shadow the
  // column — and `:` cannot appear in a key at all, so the split is unambiguous
  // in both directions.
  it("cannot collide with a built-in even for a reserved-looking key", () => {
    expect(customFieldKey("email")).toBe("cf:email");
    expect(parseCustomFieldKey("email")).toBeNull();
  });

  it("refuses to build a column expression for an unsafe key", () => {
    expect(customFieldColumn("committee_paid")).toBe("custom_fields->>committee_paid");
    for (const key of ["committee,full_name", "committee paid", 'du"es', "email"]) {
      expect(customFieldColumn(key), key).toBeNull();
    }
  });
});

describe("fieldValue", () => {
  it("reads a stored answer", () => {
    expect(fieldValue({ committee_paid: "Paid" }, "committee_paid")).toBe("Paid");
  });

  // A missing key and an empty string are one state — "no answer" — because
  // clearing a dropdown deletes the key rather than storing "". Collapsing them
  // here is what stops two states rendering alike and sorting differently.
  it("reads a missing key and an empty string alike", () => {
    expect(fieldValue({}, "committee_paid")).toBeNull();
    expect(fieldValue({ committee_paid: "" }, "committee_paid")).toBeNull();
  });

  it("survives anything that is not an object of strings", () => {
    expect(fieldValue(null, "k")).toBeNull();
    expect(fieldValue(undefined, "k")).toBeNull();
    expect(fieldValue("scalar", "k")).toBeNull();
    expect(fieldValue([1, 2], "k")).toBeNull();
    expect(fieldValue({ k: 42 }, "k")).toBeNull();
    expect(fieldValue({ k: null }, "k")).toBeNull();
  });
});

describe("setFieldValue", () => {
  it("sets a value without disturbing the others", () => {
    expect(
      setFieldValue({ committee_paid: "Paid", size: "M" }, "size", "L")
    ).toEqual({ committee_paid: "Paid", size: "L" });
  });

  it("deletes the key rather than storing an empty string", () => {
    expect(setFieldValue({ committee_paid: "Paid", size: "M" }, "size", "")).toEqual({
      committee_paid: "Paid",
    });
    expect(
      setFieldValue({ committee_paid: "Paid", size: "M" }, "size", null)
    ).toEqual({ committee_paid: "Paid" });
  });

  it("returns a whole object, since PostgREST writes the column wholesale", () => {
    expect(setFieldValue({}, "size", "M")).toEqual({ size: "M" });
    expect(setFieldValue(null, "size", "M")).toEqual({ size: "M" });
  });

  it("drops junk already in the column rather than propagating it", () => {
    expect(setFieldValue({ good: "A", bad: 42, blank: "" }, "x", "y")).toEqual({
      good: "A",
      x: "y",
    });
  });

  it("does not mutate its input", () => {
    const before = { committee_paid: "Paid" };
    setFieldValue(before, "committee_paid", "Unpaid");
    expect(before).toEqual({ committee_paid: "Paid" });
  });
});

describe("fieldOptions", () => {
  const definition = { options: ["Paid", "Unpaid", "Waived"] };

  it("offers the definition's options, unchanged, when the value is one", () => {
    const options = fieldOptions(definition, "Paid");
    expect(options.map((o) => o.value)).toEqual(["Paid", "Unpaid", "Waived"]);
    expect(options.every((o) => !o.orphan)).toBe(true);
  });

  it("offers no orphan when the member holds nothing", () => {
    for (const current of [null, ""]) {
      expect(fieldOptions(definition, current)).toHaveLength(3);
    }
  });

  // ⚠️ The case this function exists for. Nothing in the database ties a stored
  // value to its definition's options, so editing the option list orphans every
  // member holding a value that just left it. A <select> whose value matches no
  // <option> renders blank in every browser — the member would look like they
  // hold nothing, and the officer's next edit would destroy a real answer that
  // was never displayed.
  it("appends the member's value when the definition no longer offers it", () => {
    const options = fieldOptions(definition, "Deferred");
    expect(options).toHaveLength(4);
    expect(options.at(-1)).toEqual({
      value: "Deferred",
      label: "Deferred (no longer an option)",
      orphan: true,
    });
  });

  it("never appends a duplicate for a value that is still an option", () => {
    expect(fieldOptions(definition, "Waived")).toHaveLength(3);
  });
});

describe("isAllowedFieldValue", () => {
  const definition = { options: ["Paid", "Unpaid", "Waived"] };

  it("accepts an option and the empty clear", () => {
    expect(isAllowedFieldValue(definition, "Paid")).toBe(true);
    expect(isAllowedFieldValue(definition, "")).toBe(true);
  });

  // Exact, not case-insensitive: the stored value IS the option text, and the
  // option list already rejects two entries differing only in case, so a value
  // differing in case did not come from the dropdown.
  it("rejects anything that is not an option, case included", () => {
    expect(isAllowedFieldValue(definition, "paid")).toBe(false);
    expect(isAllowedFieldValue(definition, "Pending")).toBe(false);
    expect(isAllowedFieldValue(definition, " Paid")).toBe(false);
  });
});

describe("the audited column lists", () => {
  // Cheap guards against a future trim silently breaking the diff. Both sides of
  // an audit before/after select the SAME literal, and AuditTrail renders a key
  // present on one side only as "—" — so a column leaving one of these lists
  // invents an erasure that never happened.
  it("carry the token, because the action returns it as the next CAS anchor", () => {
    expect(AUDITED_MEMBER_COLUMNS).toContain("updated_at");
    expect(AUDITED_FIELD_COLUMNS).toContain("updated_at");
  });

  it("carry the columns the member editors actually move", () => {
    expect(AUDITED_MEMBER_COLUMNS).toContain("custom_fields");
    expect(AUDITED_MEMBER_COLUMNS).toContain("notes");
    expect(AUDITED_FIELD_COLUMNS).toContain("archived_at");
    expect(AUDITED_FIELD_COLUMNS).toContain("options");
  });

  it("are single unbroken literals", () => {
    // PostgREST types the returned row off the string literal, so a wrapped or
    // concatenated list widens to plain `string` and collapses the result into
    // an untyped error shape — every field access failing at once, which reads
    // as a schema fault. A newline here is the symptom of that mistake.
    expect(AUDITED_MEMBER_COLUMNS).not.toContain("\n");
    expect(AUDITED_FIELD_COLUMNS).not.toContain("\n");
  });
});

describe("withoutToken", () => {
  it("drops updated_at and nothing else", () => {
    expect(
      withoutToken({ id: "m1", notes: "x", updated_at: "2026-08-02T00:00:00Z" })
    ).toEqual({ id: "m1", notes: "x" });
  });

  it("leaves a row that has no token alone", () => {
    expect(withoutToken({ id: "m1" })).toEqual({ id: "m1" });
  });

  it("does not mutate its input", () => {
    const before = { id: "m1", updated_at: "2026-08-02T00:00:00Z" };
    withoutToken(before);
    expect(before.updated_at).toBe("2026-08-02T00:00:00Z");
  });
});

// ---------------------------------------------------------------------------
// Source assertions for the phase-4 components
// ---------------------------------------------------------------------------
//
// Same reasoning as the block at the end of tests/filters.test.ts: these are
// wiring invariants that live in JSX, and a node-environment suite cannot render
// the component to check them behaviourally. If a file moves, update the path
// rather than deleting the test.

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("the directory row is the client boundary, not the table", () => {
  const table = read("../app/admin/(shell)/members/_components/member-table.tsx");
  const row = read("../app/admin/(shell)/members/_components/directory-row.tsx");

  // Matching the DIRECTIVE — first non-empty line — rather than the bare
  // string, so both files can go on explaining the boundary in prose. The
  // header of member-table.tsx does exactly that, which is how this test failed
  // the first time it was written.
  const directive = (source: string) =>
    source.split("\n").find((line) => line.trim() !== "")?.trim();

  it("keeps the table on the server", () => {
    // The shell, the sort headers and the empty check have no interactivity
    // beyond navigation. Moving them client-side ships them for nothing.
    expect(directive(table)).not.toBe('"use client";');
  });

  it("makes the row a Client Component", () => {
    expect(directive(row)).toBe('"use client";');
  });

  it("keeps the CAS token in the row rather than in each cell", () => {
    // ⚠️ The invariant this file exists to pin. members.updated_at is
    // row-level, so if each cell held its own copy the first save would strand
    // its siblings on a stale token and the officer's next edit in that row
    // would report a phantom conflict. The failure is a client-side timing
    // window and no behavioural test in this suite would catch it.
    expect(row).toContain("useState(row.updatedAt)");
    expect(row).toContain("onSaved");
  });
});

describe("the phase-4 client components format no dates", () => {
  // Intl inside a Client Component runs on both sides of hydration, and Node
  // and Chrome ship different ICU data for the space before "PM" — the React
  // diff then shows two strings that look character-for-character identical.
  // None of these renders a date today, which is exactly how the trap gets
  // sprung later: a date must arrive pre-formatted as a prop.
  const files = [
    "../app/admin/(shell)/members/_components/directory-row.tsx",
    "../app/admin/(shell)/members/_components/member-field-cell.tsx",
    "../app/admin/(shell)/members/[id]/_components/member-editor.tsx",
    "../app/admin/(shell)/members/fields/_components/field-form.tsx",
  ];

  for (const path of files) {
    it(`${path.split("/").pop()} calls no locale formatter`, () => {
      // Matching the CALL form, so the headers can keep warning about the trap
      // in prose — which is how this test failed the first time it was written.
      const source = read(path);
      expect(source).not.toMatch(/Intl\.\w+\(/);
      expect(source).not.toMatch(/toLocale\w*\(/);
    });
  }
});

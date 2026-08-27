import { readFileSync } from "node:fs";

import { afterAll, describe, expect, it } from "vitest";

import { anonClient, getTestOfficer, testClient } from "./helpers";

import {
  canonicalPresetQuery,
  MAX_PRESET_NAME,
  MAX_PRESET_QUERY,
  presetSummary,
  storableFields,
} from "@/lib/presets";
import { NO_CUSTOM_FIELDS, parseMemberFilter } from "@/lib/filters";
import type { FieldDefinition } from "@/lib/members";

// Saved filter presets (§7 Stage 6 phase 7a). The pure half runs with no
// database — canonicalPresetQuery and presetSummary are functions of a query
// string and a definition list — and the integration half proves the three
// things only a real Postgres can: RLS deny-all, the case-insensitive unique
// name, and the non-empty query CHECK.

const SHIRT: FieldDefinition = {
  id: "00000000-0000-4000-8000-000000000001",
  key: "shirt_size",
  label: "Shirt Size",
  kind: "select",
  options: ["S", "M", "L"],
  editableInline: true,
  showInDirectory: true,
  sortOrder: 0,
  archivedAt: null,
};

const FIELDS = [SHIRT];

function filterOf(query: string, fields = FIELDS) {
  return parseMemberFilter(
    Object.fromEntries(new URLSearchParams(query)),
    fields
  );
}

describe("canonicalPresetQuery", () => {
  it("is a function of the filter, not of the order the officer clicked", () => {
    // The property the whole feature rests on: the chip row marks the active
    // preset by STRING EQUALITY against the current filter's query string, so
    // two officers who picked the same filters in a different order must store
    // the same bytes or neither of their chips ever lights up.
    const a = canonicalPresetQuery("dues=unpaid&term=all&minPoints=5", FIELDS);
    const b = canonicalPresetQuery("minPoints=5&dues=unpaid&term=all", FIELDS);
    expect(a).toBe(b);
    expect(a).toBe("term=all&dues=unpaid&minPoints=5");
  });

  it("is idempotent", () => {
    const once = canonicalPresetQuery("dues=unpaid&sort=dues", FIELDS);
    expect(canonicalPresetQuery(once, FIELDS)).toBe(once);
  });

  it("tolerates a leading question mark", () => {
    expect(canonicalPresetQuery("?dues=paid", FIELDS)).toBe(
      canonicalPresetQuery("dues=paid", FIELDS)
    );
  });

  it("drops a retired filter, so a stale saved view narrows nothing by it", () => {
    // Phase 3 removed `minRate` from MemberFilter outright rather than hiding
    // its control. A preset carrying one must therefore store nothing for it —
    // the alternative is a chip that narrows invisibly.
    expect(canonicalPresetQuery("minRate=50&dues=paid", FIELDS)).toBe(
      "dues=paid"
    );
  });

  it("returns the empty string for a filter that narrows nothing", () => {
    // The save path refuses this at three levels: the disabled button,
    // presetSaveSchema's min(1), and the CHECK constraint.
    expect(canonicalPresetQuery("state=active&dues=all", FIELDS)).toBe("");
    expect(canonicalPresetQuery("", FIELDS)).toBe("");
  });

  it("keeps a cf: filter and sort when the definition is live", () => {
    const query = canonicalPresetQuery("cf%3Ashirt_size=M&sort=cf%3Ashirt_size", FIELDS);
    expect(query).toContain("cf%3Ashirt_size=M");
    expect(query).toContain("sort=cf%3Ashirt_size");
  });

  it("drops a cf: filter the definitions do not carry", () => {
    // 🪤 The reason this function is called on WRITE only. Canonicalising a
    // STORED preset at render time would run exactly this code path against
    // whatever the definitions happen to be right now, so a view naming a
    // temporarily-archived field would come back shortened — and the officer's
    // next save would make that loss permanent. On read the stored string is
    // handed to the URL untouched.
    expect(
      canonicalPresetQuery("cf%3Ashirt_size=M&dues=paid", NO_CUSTOM_FIELDS)
    ).toBe("dues=paid");
  });

  it("keeps the first value of a repeated param, matching the parser", () => {
    expect(canonicalPresetQuery("dues=paid&dues=unpaid", FIELDS)).toBe(
      "dues=paid"
    );
  });
});

describe("storableFields", () => {
  // 🐛 The phase-7a walkthrough defect. "Canonicalise on write, never on read"
  // is not sufficient on its own, because a RENAME is a write: the manage screen
  // posts the row's stored query straight back, so canonicalising against the
  // live definitions re-derives a filter the officer never touched.
  const ARCHIVED: FieldDefinition = {
    ...SHIRT,
    archivedAt: "2026-08-08T00:00:00.000Z",
  };
  const HIDDEN: FieldDefinition = { ...SHIRT, showInDirectory: false };

  it("keeps a cf: clause whose field has left the directory", () => {
    // What this function itself buys. parseMemberFilter drops a `cf:` key whose
    // field is not a directory column, so without the override, toggling a field
    // off the directory and then renaming a preset that used it destroys the
    // clause.
    expect(
      canonicalPresetQuery("cf%3Ashirt_size=M", [HIDDEN])
    ).toBe("");
    expect(
      canonicalPresetQuery("cf%3Ashirt_size=M", storableFields([HIDDEN]))
    ).toBe("cf%3Ashirt_size=M");
  });

  it("does not lose a live clause sitting beside a hidden one", () => {
    // The dangerous shape, and the one that would have shipped silently: with a
    // second clause the save SUCCEEDS, so nothing on screen says the first one
    // was dropped. The single-clause case at least failed loudly.
    expect(
      canonicalPresetQuery("dues=unpaid&cf%3Ashirt_size=M", [HIDDEN])
    ).toBe("dues=unpaid");
    expect(
      canonicalPresetQuery(
        "dues=unpaid&cf%3Ashirt_size=M",
        storableFields([HIDDEN])
      )
    ).toBe("dues=unpaid&cf%3Ashirt_size=M");
  });

  it("passes an archived definition through untouched", () => {
    // ⚠️ storableFields cannot protect an ARCHIVED field on its own, because
    // parseMemberFilter never looks at archivedAt — the archived row is missing
    // from the list before this function is reached. `fetchFieldDefinitions`
    // filters it out by default, so the other half of the fix is the
    // `includeArchived: true` in savePreset, pinned as a source assertion below.
    expect(
      canonicalPresetQuery("cf%3Ashirt_size=M", storableFields([ARCHIVED]))
    ).toBe("cf%3Ashirt_size=M");
    expect(canonicalPresetQuery("cf%3Ashirt_size=M", [])).toBe("");
  });

  it("still drops a cf: key naming no definition at all", () => {
    // Permissive about archived, not about invented: there is nothing to
    // preserve for a field that has never existed.
    expect(
      canonicalPresetQuery("cf%3Aghost=M&dues=paid", storableFields([ARCHIVED]))
    ).toBe("dues=paid");
  });

  it("does NOT make an archived field narrow the directory", () => {
    // The other half of the rule, and the reason storage can afford to be
    // permissive: the directory page parses with the LIVE, in-directory
    // definitions, so an archived field narrows nothing while it is archived.
    // Storage is permissive; application stays strict.
    const asDirectoryWouldParse = parseMemberFilter(
      Object.fromEntries(new URLSearchParams("cf%3Ashirt_size=M")),
      [] // fetchFieldDefinitions excludes archived rows by default
    );
    expect(asDirectoryWouldParse.custom).toEqual({});
  });

  it("loads archived definitions in savePreset", () => {
    // A SOURCE assertion, because the behaviour it guards lives in a
    // "use server" export that cannot be called from here (it needs a request
    // context) — the same convention dues.test.ts uses for the editor's
    // controlled selects. It is half of a two-part fix and the half no
    // behavioural test in this suite can reach.
    //
    // Without `includeArchived`, fetchFieldDefinitions omits an archived row
    // entirely, canonicalPresetQuery has no definition to match the key against,
    // and renaming a preset that used the field silently drops its clause.
    const source = readFileSync("app/actions/presets.ts", "utf8");
    expect(source).toMatch(/fetchFieldDefinitions\(db,\s*\{\s*includeArchived:\s*true,?\s*\}\)/);
    expect(source).toContain("storableFields(definitions)");
  });
});

describe("the save form's two name inputs", () => {
  it("keys both branches so React cannot reconcile them as one input", () => {
    // 🐛 The second phase-7a walkthrough defect, caught by a console warning
    // rather than by anything on screen: both branches of ReplaceOrCreate render
    // an `<input name="name">` in the same slot, one uncontrolled (defaultValue)
    // and one controlled (value). Without distinct keys React treats them as ONE
    // input changing mode — it reuses the DOM node, so a half-typed name is
    // carried into the hidden field when the officer switches target.
    //
    // A SOURCE assertion because vitest runs `environment: "node"` and cannot
    // render a component, so no behavioural test here would fail if the keys were
    // deleted. Same guard, same reason, as member-filters.tsx's controlled-input
    // assertions.
    const source = readFileSync(
      "app/admin/(shell)/members/_components/preset-bar.tsx",
      "utf8"
    );
    expect(source).toContain('key="name-input"');
    expect(source).toContain('key="name-hidden"');
  });
});

describe("presetSummary", () => {
  it("says nothing about a filter that narrows nothing", () => {
    expect(presetSummary(filterOf(""), FIELDS)).toEqual([]);
  });

  it("omits the default term scope and names an explicit one", () => {
    // 📌 The default is null — "whatever term it is when you open this" — and
    // describing it would make every saved view read as though it had pinned
    // the semester it was created in. That is precisely what null avoids.
    expect(presetSummary(filterOf(""), FIELDS)).toEqual([]);
    expect(presetSummary(filterOf("term=Spring 2026"), FIELDS)).toContain(
      "Spring 2026"
    );
    expect(presetSummary(filterOf("term=all"), FIELDS)).toContain("All terms");
  });

  it("describes dues, source and search", () => {
    const parts = presetSummary(
      filterOf("dues=unpaid&source=self_checkin&q=rowan"),
      FIELDS
    );
    expect(parts).toContain("Dues not paid");
    expect(parts).toContain("Self-registered");
    expect(parts).toContain("“rowan”");
  });

  it("uses the definition's label for a custom field, not its key", () => {
    expect(presetSummary(filterOf("cf%3Ashirt_size=M"), FIELDS)).toContain(
      "Shirt Size: M"
    );
  });

  it("falls back to the key when the definition is gone", () => {
    // Parsed WITH the definitions so the filter carries the key, then described
    // without them — the shape of a field archived between the two reads.
    const filter = filterOf("cf%3Ashirt_size=M");
    expect(presetSummary(filter, [])).toContain("shirt_size: M");
  });

  it("keeps a zero bound rather than reading it as no bound", () => {
    // "Attended nothing" is the query an officer reaching for this screen most
    // likely wants, and a truthiness check would silently drop it — the
    // null-vs-zero rule.
    expect(presetSummary(filterOf("maxEvents=0"), FIELDS)).toContain(
      "Events ≤ 0"
    );
    expect(presetSummary(filterOf("minEvents=0&maxEvents=0"), FIELDS)).toContain(
      "Events 0–0"
    );
  });

  it("renders each range shape", () => {
    expect(presetSummary(filterOf("minPoints=5&maxPoints=9"), FIELDS)).toContain(
      "Points 5–9"
    );
    expect(presetSummary(filterOf("minPoints=5"), FIELDS)).toContain(
      "Points ≥ 5"
    );
    expect(presetSummary(filterOf("maxPoints=9"), FIELDS)).toContain(
      "Points ≤ 9"
    );
  });

  it("names an event when it can and stays honest when it cannot", () => {
    const id = "11111111-2222-4333-8444-555555555555";
    const labels = new Map([[id, "Awards Banquet"]]);
    expect(
      presetSummary(filterOf(`event=${id}&eventMode=missed`), FIELDS, labels)
    ).toContain("Missed Awards Banquet");
    // fetchEventOptions caps at 100, so an old event legitimately falls off the
    // picker. A raw uuid on screen would be worse than no name at all.
    expect(presetSummary(filterOf(`event=${id}`), FIELDS)).toContain(
      "Attended a specific event"
    );
  });


  it("discloses a non-default sort and stays quiet about the default", () => {
    // A preset restores the sort too, and an officer who clicks a chip and
    // finds their column order changed with no warning has been surprised by
    // their own saved filter.
    expect(presetSummary(filterOf("dues=paid&sort=dues"), FIELDS)).toContain(
      "Sorted by Dues ▼"
    );
    expect(presetSummary(filterOf("dues=paid"), FIELDS)).not.toContain(
      "Sorted by Member ▲"
    );
    expect(presetSummary(filterOf("dues=paid&dir=desc"), FIELDS)).toContain(
      "Sorted by Member ▼"
    );
  });

  it("uses the field label for a cf: sort", () => {
    expect(
      presetSummary(filterOf("dues=paid&sort=cf%3Ashirt_size"), FIELDS)
    ).toContain("Sorted by Shirt Size ▲");
  });

  it("is ordered by key for the custom part, not by insertion", () => {
    const second: FieldDefinition = { ...SHIRT, key: "committee", label: "Committee" };
    const fields = [SHIRT, second];
    const parts = presetSummary(
      filterOf("cf%3Ashirt_size=M&cf%3Acommittee=Socials", fields),
      fields
    );
    expect(parts.indexOf("Committee: Socials")).toBeLessThan(
      parts.indexOf("Shirt Size: M")
    );
  });
});

// ---------------------------------------------------------------------------
// Integration — the three guarantees only the database gives
// ---------------------------------------------------------------------------

describe("member_filter_presets", () => {
  const db = testClient();
  const created: string[] = [];

  afterAll(async () => {
    if (created.length > 0) {
      await db.from("member_filter_presets").delete().in("id", created);
    }
  });

  async function insert(name: string, query: string) {
    const result = await db
      .from("member_filter_presets")
      .insert({ name, query, created_by: await getTestOfficer(db) })
      .select("id, name, query")
      .maybeSingle();
    if (result.data) created.push(result.data.id);
    return result;
  }

  it("is invisible to the anon key", async () => {
    // 🔓 RLS deny-all, like every other table. Unlike a VIEW this answers 200
    // with an EMPTY BODY rather than 401 — RLS filters rows, it does not refuse
    // the request — so the assertion has to read the body, not the status. The
    // 401 shape belongs to member_directory, which has no RLS and no grant.
    await insert("t3qp anon probe", "dues=unpaid");

    const { data, error } = await anonClient()
      .from("member_filter_presets")
      .select("id, name");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("refuses an empty query", async () => {
    // The third of three refusals, and the one a hand-rolled POST cannot get
    // past. A preset holding the default view is a chip promising a narrowed
    // roster and delivering the whole thing.
    const { error } = await insert("t3qp empty", "");
    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("query_bounded");
  });

  it("refuses a blank name", async () => {
    const { error } = await insert("   ", "dues=unpaid");
    expect(error?.code).toBe("23514");
  });

  it("refuses a duplicate name regardless of case", async () => {
    const first = await insert("t3qp Award Eligible", "minPoints=10");
    expect(first.error).toBeNull();

    // Two views rendering as the same chip is a bug, not a feature: the officer
    // cannot tell which one they are about to edit.
    const second = await insert("t3qp award eligible", "minPoints=20");
    expect(second.error?.code).toBe("23505");
  });

  it("moves updated_at on an edit", async () => {
    const { data } = await insert("t3qp trigger check", "dues=paid");
    const id = data!.id;

    const before = await db
      .from("member_filter_presets")
      .select("updated_at")
      .eq("id", id)
      .single();

    const after = await db
      .from("member_filter_presets")
      .update({ name: "t3qp trigger check renamed" })
      .eq("id", id)
      .select("updated_at")
      .single();

    expect(after.data!.updated_at).not.toBe(before.data!.updated_at);
  });

  it("accepts 'member_preset' as an audit entity type", async () => {
    // ⚠️ admin_audit is append-only, so a row written under an entity_type the
    // CHECK does not carry fails at the insert — and one written under a WRONG
    // type can never be corrected. This is the assertion that the SQL check and
    // AuditEntityType moved together.
    const { data } = await insert("t3qp audit check", "dues=unpaid");
    const { error } = await db.from("admin_audit").insert({
      entity_type: "member_preset",
      entity_id: data!.id,
      actor_id: await getTestOfficer(db),
      action: "preset.created",
      after: { name: data!.name },
    });
    expect(error).toBeNull();
  });

  it("bounds the stored query", async () => {
    const { error } = await insert("t3qp too long", "q=" + "x".repeat(MAX_PRESET_QUERY));
    expect(error?.code).toBe("23514");
  });

  it("bounds the stored name", async () => {
    const { error } = await insert("x".repeat(MAX_PRESET_NAME + 1), "dues=paid");
    expect(error?.code).toBe("23514");
  });
});

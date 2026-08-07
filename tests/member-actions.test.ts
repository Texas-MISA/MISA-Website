import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { writeAudit } from "@/app/actions/audit";
import { parseMemberFilter, type SortableField } from "@/lib/filters";
import { fetchFieldDefinitions } from "@/lib/member-fields";
import {
  AUDITED_FIELD_COLUMNS,
  AUDITED_MEMBER_COLUMNS,
  customFieldKey,
  fieldValue,
  setFieldValue,
  withoutToken,
} from "@/lib/members";

import {
  cleanup,
  createTestMember,
  getTestOfficer,
  latestAuditRow,
  newTracker,
  testClient,
  testIdentity,
  type Tracker,
} from "./helpers";

// Integration tests for the Stage 6 phase-4 member mutations, against the LOCAL
// stack. The pure half lives in tests/members.test.ts and tests/validation.test.ts.
//
// As in tests/point-actions.test.ts, the "use server" exports in
// app/actions/members.ts are NOT called directly — they need a request context
// for cookies. What is exercised here is the database behaviour those actions
// depend on and the exact statement sequences they run, so a change that breaks
// the contract fails here rather than in a browser.
//
// ⚠️ **Field definitions need explicit teardown.** cleanup() has no
// member_field_definitions pass, and the key index deliberately spans archived
// rows, so a definition left behind collides with the next run's insert on
// 23505. Every definition created here is deleted in afterAll.

const db = testClient();
const track: Tracker = newTracker();
let officerId: string;

/** Keys are unique across the whole table, so fixtures need their own space. */
const KEY = `t3q_dues_${Date.now() % 100000}`;
const OPTIONS = ["Paid", "Unpaid", "Waived"];
const definitionIds: string[] = [];

async function createDefinition(
  overrides: Partial<{
    key: string;
    label: string;
    options: string[];
    show_in_directory: boolean;
    editable_inline: boolean;
  }> = {}
): Promise<string> {
  const { data, error } = await db
    .from("member_field_definitions")
    .insert({
      key: overrides.key ?? KEY,
      label: overrides.label ?? "Dues (fixture)",
      kind: "select",
      options: overrides.options ?? OPTIONS,
      show_in_directory: overrides.show_in_directory ?? true,
      editable_inline: overrides.editable_inline ?? true,
      created_by: officerId,
    })
    .select("id")
    .single();
  if (error) throw new Error(`fixture definition insert failed: ${error.message}`);
  definitionIds.push(data.id);
  return data.id;
}

/** The member read the action does before every write. */
async function readMember(id: string) {
  const { data, error } = await db
    .from("members")
    .select(AUDITED_MEMBER_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`member read failed: ${error.message}`);
  if (!data) throw new Error("member vanished");
  return data;
}

beforeAll(async () => {
  officerId = await getTestOfficer(db);
}, 60_000);

afterAll(async () => {
  if (definitionIds.length > 0) {
    await db.from("member_field_definitions").delete().in("id", definitionIds);
  }
  await cleanup(db, track);
});

describe("the compare-and-set anchor", () => {
  it("is maintained by a trigger, not by the application", async () => {
    // A pure test cannot know the trigger is wired at all. members never had an
    // updated_at before migration 18 — nothing edited a member.
    const id = await createTestMember(db, track, testIdentity());
    const before = await readMember(id);

    const { error } = await db
      .from("members")
      .update({ notes: "touched" })
      .eq("id", id);
    if (error) throw new Error(error.message);

    const after = await readMember(id);
    expect(after.updated_at).not.toBe(before.updated_at);
    expect(new Date(after.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(before.updated_at).getTime()
    );
  });

  it("matches on the RAW string and NOT on a Date round trip", async () => {
    // 🪤 The highest-value assertion in this file. updated_at has microsecond
    // precision; `new Date(raw).toISOString()` truncates to milliseconds, and
    // the compare-and-set then never matches — so every single save reports a
    // phantom conflict and the screen looks broken for everyone at once. No
    // pure test can see this, because it is PostgREST's formatting that decides.
    const id = await createTestMember(db, track, testIdentity());
    const { updated_at: raw } = await readMember(id);

    const truncated = new Date(raw).toISOString();
    const { data: viaDate } = await db
      .from("members")
      .update({ notes: "via date" })
      .eq("id", id)
      .eq("updated_at", truncated)
      .select("id")
      .maybeSingle();
    expect(viaDate).toBeNull();

    const { data: viaRaw } = await db
      .from("members")
      .update({ notes: "via raw" })
      .eq("id", id)
      .eq("updated_at", raw)
      .select("id")
      .maybeSingle();
    expect(viaRaw).not.toBeNull();
  });

  it("returns zero rows when someone else saved first", async () => {
    const id = await createTestMember(db, track, testIdentity());
    const stale = (await readMember(id)).updated_at;

    // Another officer, in another tab.
    await db.from("members").update({ notes: "theirs" }).eq("id", id);

    const { data: conflicted } = await db
      .from("members")
      .update({ notes: "mine" })
      .eq("id", id)
      .eq("updated_at", stale)
      .select("id")
      .maybeSingle();

    expect(conflicted).toBeNull();
    // And the other officer's write is intact — a conflict loses nothing.
    expect((await readMember(id)).notes).toBe("theirs");
  });

  it("is the same string on the view as on the table", async () => {
    // ⚠️ The premise of the whole screen: both editing surfaces READ the view
    // and post its updated_at back as the token the action compares against the
    // TABLE. If PostgREST rendered the two differently, every save would
    // conflict — and the two are separate relations, so this is not a given.
    const id = await createTestMember(db, track, testIdentity());
    const { data: view, error } = await db
      .from("member_directory")
      .select("updated_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);

    expect(view?.updated_at).toBe((await readMember(id)).updated_at);

    const { data: matched } = await db
      .from("members")
      .update({ notes: "from the view's token" })
      .eq("id", id)
      .eq("updated_at", view!.updated_at!)
      .select("id")
      .maybeSingle();
    expect(matched).not.toBeNull();
  });
});

describe("writing a custom-field value", () => {
  it("preserves sibling keys, because the column is written wholesale", async () => {
    // PostgREST has no partial jsonb update: the action sends the whole object
    // that setFieldValue returns. A patch-shaped write would drop the others.
    const id = await createTestMember(db, track, testIdentity());
    await db
      .from("members")
      .update({ custom_fields: { a: "1", b: "2" } })
      .eq("id", id);

    const before = await readMember(id);
    await db
      .from("members")
      .update({ custom_fields: setFieldValue(before.custom_fields, "b", "3") })
      .eq("id", id);

    const after = await readMember(id);
    expect(after.custom_fields).toEqual({ a: "1", b: "3" });
  });

  it("clears by deleting the key, so the column reads as SQL NULL", async () => {
    // Not "" — a cleared answer and one never given must be one state, or they
    // render alike and sort differently. `custom_fields->>key` is what the sort
    // and phase 6's filters actually see.
    const id = await createTestMember(db, track, testIdentity());
    await db
      .from("members")
      .update({ custom_fields: { [KEY]: "Paid" } })
      .eq("id", id);

    const before = await readMember(id);
    await db
      .from("members")
      .update({ custom_fields: setFieldValue(before.custom_fields, KEY, null) })
      .eq("id", id);

    const after = await readMember(id);
    expect(after.custom_fields).toEqual({});
    expect(fieldValue(after.custom_fields, KEY)).toBeNull();

    // And PostgREST agrees it is null, which is what puts the member in the
    // nulls-last group rather than sorting them among the empty strings.
    const { data: nulls } = await db
      .from("members")
      .select("id")
      .eq("id", id)
      .is(`custom_fields->>${KEY}`, null);
    expect(nulls).toHaveLength(1);
  });

  it("is NOT constrained to the definition's options by the database", async () => {
    // ⚠️ This test documents a gap rather than a guarantee, and it is why
    // fieldOptions() renders an orphan. The column check is
    // `jsonb_typeof = 'object'` and nothing more: setMemberFieldValue and
    // isAllowedFieldValue are the ONLY enforcement anywhere. Editing a
    // definition's option list therefore leaves members holding values it no
    // longer offers, by design — rewriting their answers to match would
    // falsify the roster.
    const id = await createTestMember(db, track, testIdentity());
    const { error } = await db
      .from("members")
      .update({ custom_fields: { [KEY]: "Banana" } })
      .eq("id", id);

    expect(error).toBeNull();
    expect(fieldValue((await readMember(id)).custom_fields, KEY)).toBe("Banana");
  });

  it("refuses a custom_fields that is not an object", async () => {
    const id = await createTestMember(db, track, testIdentity());
    for (const bad of ["scalar", 42, [1, 2]]) {
      const { error } = await db
        .from("members")
        .update({ custom_fields: bad })
        .eq("id", id);
      expect(error?.code, JSON.stringify(bad)).toBe("23514");
    }
  });
});

describe("the member audit before/after", () => {
  it("selects the same keys on both sides", async () => {
    // AuditTrail diffs the UNION of the two objects' keys and renders a key
    // present on one side only as "—", so an asymmetric select invents an
    // erasure that never happened. Only a live read proves what PostgREST
    // actually returns for AUDITED_MEMBER_COLUMNS.
    const id = await createTestMember(db, track, testIdentity());
    const before = await readMember(id);

    const { data: after, error } = await db
      .from("members")
      .update({ custom_fields: setFieldValue(before.custom_fields, KEY, "Paid") })
      .eq("id", id)
      .eq("updated_at", before.updated_at)
      .select(AUDITED_MEMBER_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!after) throw new Error("compare-and-set unexpectedly missed");

    await writeAudit(db, {
      entityType: "member",
      entityId: id,
      actorId: officerId,
      action: "member.updated",
      before: withoutToken(before),
      after: withoutToken(after),
      note: "Dues (fixture)",
    });

    const row = await latestAuditRow(db, "member", id);
    const beforeKeys = Object.keys(row!.before as object).sort();
    const afterKeys = Object.keys(row!.after as object).sort();

    expect(beforeKeys).toEqual(afterKeys);
    // The token is stripped from BOTH sides in one expression — it changes on
    // every save and acted_at already records when.
    expect(beforeKeys).not.toContain("updated_at");
    // And exactly one field actually moved.
    expect(row!.note).toBe("Dues (fixture)");
    expect(
      beforeKeys.filter(
        (key) =>
          JSON.stringify((row!.before as Record<string, unknown>)[key]) !==
          JSON.stringify((row!.after as Record<string, unknown>)[key])
      )
    ).toEqual(["custom_fields"]);
  });
});

describe("field definitions", () => {
  it("keeps every stored answer when archived, and leaves the live list", async () => {
    const archivedKey = `${KEY}_old`;
    const definitionId = await createDefinition({
      key: archivedKey,
      label: "Retired (fixture)",
    });
    const memberId = await createTestMember(db, track, testIdentity());
    await db
      .from("members")
      .update({ custom_fields: { [archivedKey]: "Paid" } })
      .eq("id", memberId);

    await db
      .from("member_field_definitions")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", definitionId);

    const live = await fetchFieldDefinitions(db);
    const all = await fetchFieldDefinitions(db, { includeArchived: true });
    expect(live.some((d) => d.key === archivedKey)).toBe(false);
    expect(all.some((d) => d.key === archivedKey)).toBe(true);

    // The answer survives on the table AND on the view — archiving hides a
    // field, it never rewrites what the roster said.
    expect(fieldValue((await readMember(memberId)).custom_fields, archivedKey)).toBe(
      "Paid"
    );
    const { data: view } = await db
      .from("member_directory")
      .select("custom_fields")
      .eq("id", memberId)
      .maybeSingle();
    expect(fieldValue(view?.custom_fields, archivedKey)).toBe("Paid");

    // And a bookmarked sort naming it degrades rather than ordering by a column
    // with no header.
    const fields: SortableField[] = live.map((d) => ({
      key: d.key,
      showInDirectory: d.showInDirectory,
    }));
    expect(
      parseMemberFilter({ sort: customFieldKey(archivedKey) }, fields).sort
    ).toBe("name");
  });

  it("reserves an archived key against re-use", async () => {
    // The unique index spans archived rows deliberately: a new field sharing an
    // archived key would silently adopt every answer still stored under it.
    const key = `${KEY}_taken`;
    await createDefinition({ key });
    await db
      .from("member_field_definitions")
      .update({ archived_at: new Date().toISOString() })
      .eq("key", key);

    const { error } = await db.from("member_field_definitions").insert({
      key,
      label: "Second try",
      kind: "select",
      options: OPTIONS,
      created_by: officerId,
    });
    expect(error?.code).toBe("23505");
  });

  it("archives one way only, so a second attempt reports zero rows", async () => {
    const definitionId = await createDefinition({ key: `${KEY}_once` });
    const guard = () =>
      db
        .from("member_field_definitions")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", definitionId)
        .is("archived_at", null)
        .select("id")
        .maybeSingle();

    expect((await guard()).data).not.toBeNull();
    // Same reasoning as voidAdjustment: the null check IS the complete guard,
    // so no compare-and-set token is needed and zero rows means someone else
    // got there first.
    expect((await guard()).data).toBeNull();
  });

  it("maintains its own updated_at and audits symmetrically", async () => {
    const definitionId = await createDefinition({ key: `${KEY}_edit` });

    const { data: before, error: beforeError } = await db
      .from("member_field_definitions")
      .select(AUDITED_FIELD_COLUMNS)
      .eq("id", definitionId)
      .single();
    if (beforeError) throw new Error(beforeError.message);

    const { data: after, error } = await db
      .from("member_field_definitions")
      .update({ label: "Renamed (fixture)" })
      .eq("id", definitionId)
      .select(AUDITED_FIELD_COLUMNS)
      .single();
    if (error) throw new Error(error.message);

    expect(after.updated_at).not.toBe(before.updated_at);

    await writeAudit(db, {
      entityType: "member_field",
      entityId: definitionId,
      actorId: officerId,
      action: "member_field.updated",
      before: withoutToken(before),
      after: withoutToken(after),
    });

    const row = await latestAuditRow(db, "member_field", definitionId);
    expect(Object.keys(row!.before as object).sort()).toEqual(
      Object.keys(row!.after as object).sort()
    );
    expect((row!.after as Record<string, unknown>).label).toBe(
      "Renamed (fixture)"
    );
  });

  it("orders live definitions by (sort_order, key), a total order", async () => {
    // sort_order is an officer-set integer with no uniqueness, so two fields
    // sharing one would otherwise arrange themselves differently per request —
    // the same total-order rule the directory rows follow.
    await createDefinition({ key: `${KEY}_zz`, label: "Z" });
    await createDefinition({ key: `${KEY}_aa`, label: "A" });

    const first = (await fetchFieldDefinitions(db)).map((d) => d.key);
    const second = (await fetchFieldDefinitions(db)).map((d) => d.key);
    expect(first).toEqual(second);

    const tied = first.filter((k) => k.startsWith(`${KEY}_`));
    expect([...tied].sort()).toEqual(tied);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { cleanup, getTestOfficer, newTracker, testClient } from "./helpers";

import { writeAuditBatch } from "@/app/actions/audit";
import {
  countOutcomes,
  planRosterImport,
  type PlannedMember,
} from "@/lib/member-import";
import { fetchRosterIndex } from "@/lib/roster-index";
import { AUDITED_MEMBER_COLUMNS, withoutToken } from "@/lib/members";

// Roster CSV import against the local stack (§7 Stage 6 phase 7b).
//
// ⚠️ This does NOT call the `"use server"` exports — they need a request context
// — it reproduces the exact statement sequence commitRosterImport runs. Same
// convention as dues-actions.test.ts, member-actions and point-actions, and the
// reason those files exist rather than mocking Next.
//
// Fixtures own the marker `t3qimp`, a strict narrowing of `t3q`: other files in
// this suite create `t3q` members as they run, and a count against the shared
// marker would count theirs too. That mistake cost time once already (the
// export block's `t3qex`).

const MARKER = "t3qimp";

let seq = 0;
/** An EID nothing else in the suite can produce, and short enough for the cap. */
function eid(): string {
  return `${MARKER}${seq++}`;
}

describe("roster import", () => {
  const db = testClient();
  const track = newTracker();
  let officerId: string;

  beforeAll(async () => {
    officerId = await getTestOfficer(db);
  });

  afterAll(async () => {
    await cleanup(db, track);
    // Anything the import inserted is not in the tracker, so sweep the marker.
    await db.from("members").delete().like("eid", `${MARKER}%`);
  });

  /** The write half of commitRosterImport, verbatim. */
  async function commit(rows: PlannedMember[], fileName: string) {
    const fresh = rows.filter((row) => row.outcome.kind === "new");
    const { data, error } = await db
      .from("members")
      .insert(
        fresh.map((row) => ({
          eid: row.eid,
          full_name: row.fullName,
          email: row.email,
          active: row.active,
          custom_fields: row.customFields,
          source: "admin" as const,
        }))
      )
      .select(AUDITED_MEMBER_COLUMNS);

    if (!error && data) {
      for (const row of data) track.memberIds.push(row.id);
      await writeAuditBatch(
        db,
        data.map((row) => ({
          entityType: "member" as const,
          entityId: row.id,
          actorId: officerId,
          action: "member.imported" as const,
          after: withoutToken(row),
          note: `imported from "${fileName}" — ${data.length} of ${rows.length} rows`,
        }))
      );
    }
    return { data, error };
  }

  async function planFrom(csv: string) {
    const roster = await fetchRosterIndex(db);
    expect(roster.kind).toBe("ok");
    if (roster.kind !== "ok") throw new Error("roster read failed");
    return planRosterImport({ csv, definitions: [], roster: roster.roster });
  }

  it("reads the whole roster, past a chunk boundary's worth of members", async () => {
    // The seed alone is 32, well under CHUNK — this asserts the shape of the
    // result rather than the paging, which tests/member-directory.test.ts covers
    // for the same `.range()` hazard with its own small chunk.
    const roster = await fetchRosterIndex(db);
    expect(roster.kind).toBe("ok");
    if (roster.kind !== "ok") return;
    expect(roster.roster.length).toBeGreaterThanOrEqual(32);
    // Both axes populated — the whole reason this replaced fetchDuesRoster.
    for (const entry of roster.roster.slice(0, 5)) {
      expect(entry.normalizedEid).not.toBe("");
      expect(entry.emailLower).toBe(entry.emailLower.toLowerCase());
    }
  });

  it("inserts only the new rows and writes one audit row each", async () => {
    const a = eid();
    const b = eid();
    const csv = [
      "Name,Email,EID",
      `Import One,${a}@example.edu,${a}`,
      `Import Two,${b}@example.edu,${b}`,
    ].join("\n");

    const plan = await planFrom(csv);
    expect(plan.kind).toBe("ok");
    if (plan.kind !== "ok") return;
    expect(countOutcomes(plan.rows)).toMatchObject({ fresh: 2, existing: 0 });

    const { data, error } = await commit(plan.rows, "roster.csv");
    expect(error).toBeNull();
    expect(data).toHaveLength(2);

    // source is 'admin', not a third value — the audit row is what records how
    // the member arrived.
    expect(data!.every((row) => row.active)).toBe(true);

    const { data: audit } = await db
      .from("admin_audit")
      .select("action, note, before, after")
      .eq("entity_type", "member")
      .eq("action", "member.imported")
      .in("entity_id", data!.map((row) => row.id));

    expect(audit).toHaveLength(2);
    expect(audit![0].note).toContain('imported from "roster.csv"');
    // No `before` — the member did not exist — and no CAS token on `after`.
    expect(audit![0].before).toBeNull();
    expect(audit![0].after).not.toHaveProperty("updated_at");
  });

  it("reports the same file as entirely existing on a second run", async () => {
    // The create-only guarantee, end to end: re-importing adds nothing. This is
    // also what makes the all-or-nothing insert safe to retry.
    const a = eid();
    const csv = ["Name,Email,EID", `Repeat Import,${a}@example.edu,${a}`].join(
      "\n"
    );

    const first = await planFrom(csv);
    if (first.kind !== "ok") throw new Error("first plan failed");
    await commit(first.rows, "roster.csv");

    const before = await countMarked();

    const second = await planFrom(csv);
    if (second.kind !== "ok") throw new Error("second plan failed");
    expect(countOutcomes(second.rows)).toMatchObject({ fresh: 0, existing: 1 });
    expect(second.rows[0].outcome).toEqual({ kind: "existing", on: "eid" });

    // Nothing to insert, so nothing is written.
    await commit(second.rows, "roster.csv");
    expect(await countMarked()).toBe(before);
  });

  it("catches a member who differs by EID but shares an email", async () => {
    // ⚠️ The axis a single-index check would miss. Without it the preview reads
    // clean and the insert takes a 23505 on members_email_lower.
    const a = eid();
    const b = eid();
    const first = await planFrom(
      ["Name,Email,EID", `Shared Email,${a}@example.edu,${a}`].join("\n")
    );
    if (first.kind !== "ok") throw new Error("plan failed");
    await commit(first.rows, "roster.csv");

    const second = await planFrom(
      ["Name,Email,EID", `Different EID,${a}@example.edu,${b}`].join("\n")
    );
    if (second.kind !== "ok") throw new Error("plan failed");
    expect(second.rows[0].outcome).toEqual({ kind: "existing", on: "email" });
  });

  it("is the database, not only the planner, that refuses a duplicate EID", async () => {
    // The planner is a courtesy; the unique index is the guarantee. Proving both
    // matters because commitRosterImport treats a 23505 as a race rather than a
    // bug — that branch has to be reachable.
    const a = eid();
    const plan = await planFrom(
      ["Name,Email,EID", `Index Check,${a}@example.edu,${a}`].join("\n")
    );
    if (plan.kind !== "ok") throw new Error("plan failed");
    await commit(plan.rows, "roster.csv");

    const { error } = await db.from("members").insert({
      full_name: "Racing Insert",
      email: `other-${a}@example.edu`,
      eid: a.toUpperCase(),
    });
    expect(error?.code).toBe("23505");
  });

  it("writes nothing at all when one row of a batch collides", async () => {
    // All-or-nothing, and the property the "raced" status depends on: a single
    // insert statement either takes every row or none. Forty of fifty imported
    // with the officer told it worked is the failure this avoids.
    const existing = eid();
    const fresh1 = eid();
    const fresh2 = eid();

    const seed = await planFrom(
      ["Name,Email,EID", `Already Here,${existing}@example.edu,${existing}`].join("\n")
    );
    if (seed.kind !== "ok") throw new Error("plan failed");
    await commit(seed.rows, "roster.csv");

    const before = await countMarked();

    // Bypasses the planner deliberately — this is the race, where the row was
    // `new` at preview time and is not any more.
    const { data, error } = await db
      .from("members")
      .insert([
        { full_name: "New A", email: `${fresh1}@example.edu`, eid: fresh1 },
        { full_name: "Collides", email: `x-${existing}@example.edu`, eid: existing },
        { full_name: "New B", email: `${fresh2}@example.edu`, eid: fresh2 },
      ])
      .select("id");

    expect(error?.code).toBe("23505");
    expect(data).toBeNull();
    expect(await countMarked()).toBe(before);
  });

  it("stores an absent custom-field key rather than an empty string", async () => {
    const key = `${MARKER}_size`;
    const { data: definition } = await db
      .from("member_field_definitions")
      .insert({
        key,
        label: "Import Size",
        options: ["S", "M"],
        show_in_directory: true,
      })
      .select("id, key, label, options, archived_at, show_in_directory, editable_inline, sort_order")
      .single();

    try {
      const withValue = eid();
      const without = eid();
      const csv = [
        "Name,Email,EID,Import Size",
        `Has Size,${withValue}@example.edu,${withValue},M`,
        `No Size,${without}@example.edu,${without},`,
      ].join("\n");

      const roster = await fetchRosterIndex(db);
      if (roster.kind !== "ok") throw new Error("roster read failed");
      const plan = planRosterImport({
        csv,
        definitions: [
          {
            id: definition!.id,
            key: definition!.key,
            label: definition!.label,
            kind: "select",
            options: definition!.options,
            editableInline: definition!.editable_inline,
            showInDirectory: definition!.show_in_directory,
            sortOrder: definition!.sort_order,
            archivedAt: definition!.archived_at,
          },
        ],
        roster: roster.roster,
      });
      if (plan.kind !== "ok") throw new Error("plan failed");

      const { data, error } = await commit(plan.rows, "roster.csv");
      expect(error).toBeNull();

      const stored = data!.map((row) => row.custom_fields);
      // One holds the answer; the other holds NO KEY — "cleared" and "never
      // answered" must not become two states that render alike.
      expect(stored).toContainEqual({ [key]: "M" });
      expect(stored).toContainEqual({});
    } finally {
      await db.from("member_field_definitions").delete().eq("key", key);
    }
  });

  async function countMarked(): Promise<number> {
    const { count, error } = await db
      .from("members")
      .select("id", { count: "exact", head: true })
      .like("eid", `${MARKER}%`);
    if (error) throw new Error(`marker count failed: ${error.message}`);
    return count ?? 0;
  }
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanup,
  createCurrentTermEvent,
  createTestAdjustment,
  createTestAttendance,
  createTestMember,
  getTestOfficer,
  newTracker,
  testClient,
} from "./helpers";

// Merging duplicate members against the local stack (§7 Stage 6 phase 8).
//
// ⚠️ This does NOT call the `"use server"` exports — they need a request context
// — it reproduces the statement sequence commitMerge runs. Same convention as
// dues-actions, member-actions and member-import-actions.
//
// 🔓 The headline test proves the HAZARD before proving the fix. The claim that
// makes this whole phase non-trivial is that `attendance_one_per_event` cannot
// catch a merge, so a naive repoint silently double-counts an event. If that
// claim were wrong the rest of the design would be over-engineering, so it is
// asserted against real Postgres rather than argued.
//
// Fixtures own the marker `t3qmrg`, a strict narrowing of `t3q`: other files in
// this suite create `t3q` members as they run.

const MARKER = "t3qmrg";
let seq = 0;
const eid = () => `${MARKER}${seq++}`;

describe("merging members", () => {
  const db = testClient();
  const track = newTracker();
  let officerId: string;

  beforeAll(async () => {
    officerId = await getTestOfficer(db);
  });

  afterAll(async () => {
    await cleanup(db, track);
    await db.from("members").delete().like("eid", `${MARKER}%`);
  });

  async function makeMember(name: string) {
    const id = eid();
    const memberId = await createTestMember(db, track, {
      fullName: name,
      eid: id,
      email: `${id}@example.edu`,
    });
    return { memberId, eid: id };
  }

  async function present(eventId: string, member: { memberId: string; eid: string }) {
    return createTestAttendance(db, track, {
      eventId,
      memberId: member.memberId,
      submittedName: "Merge Fixture",
      submittedEid: member.eid,
      submittedEmail: `${member.eid}@example.edu`,
      submittedAt: new Date(),
      status: "present",
    });
  }

  async function directoryRow(memberId: string) {
    const { data, error } = await db
      .from("member_directory")
      .select("events_attended, attendance_points, total_points, attendance_rate")
      .eq("id", memberId)
      .maybeSingle();
    if (error) throw new Error(`directory read failed: ${error.message}`);
    return data;
  }

  it("🔓 a naive repoint DOUBLE-COUNTS a shared event, and nothing errors", async () => {
    // The claim, tested. attendance_one_per_event is keyed on (event_id,
    // normalized_eid) — the SUBMITTED eid — not on member_id, so repointing
    // member_id never touches an indexed column and the unique index cannot
    // fire. Two identities have different EIDs by construction.
    const event = await createCurrentTermEvent(db, track, { points: 5 });
    const survivor = await makeMember("Naive Survivor");
    const loser = await makeMember("Naive Loser");

    await present(event.id, survivor);
    await present(event.id, loser);

    // Exactly what a merge that skipped the collision step would do.
    const { error } = await db
      .from("attendance")
      .update({ member_id: survivor.memberId })
      .eq("member_id", loser.memberId);

    // No error. That is the finding.
    expect(error).toBeNull();

    const row = await directoryRow(survivor.memberId);

    // Two present rows, ONE event. member_directory counts rows, not distinct
    // events — `count(*) as events_attended` — so the survivor is credited with
    // attending twice.
    const { data: rows } = await db
      .from("attendance")
      .select("event_id")
      .eq("member_id", survivor.memberId)
      .eq("status", "present");
    expect(new Set(rows!.map((r) => r.event_id)).size).toBe(1);
    expect(row?.events_attended).toBe(2);

    // And the points with it: one event worth 5, summed twice.
    expect(row?.attendance_points).toBe(10);

    // ⚠️ The rate is inflated too, though it does not necessarily break 1 —
    // the denominator is every completed event of the term, which the seed
    // already fills. It reads 2/N where the truth is 1/N, which is the kind of
    // wrong that looks plausible on screen and is why the schema catching this
    // would have mattered.
  });

  it("rejecting the losing row first keeps the event counted once", async () => {
    // The same fixture through the real sequence: reject, then repoint.
    const event = await createCurrentTermEvent(db, track, { points: 5 });
    const survivor = await makeMember("Correct Survivor");
    const loser = await makeMember("Correct Loser");

    await present(event.id, survivor);
    const losing = await present(event.id, loser);

    await db
      .from("attendance")
      .update({
        status: "rejected",
        resolution_note: "Duplicate of an existing check-in — merged",
        resolved_by: officerId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", losing.id)
      .neq("status", "rejected");

    await db
      .from("attendance")
      .update({ member_id: survivor.memberId })
      .eq("member_id", loser.memberId);

    const row = await directoryRow(survivor.memberId);
    expect(row?.events_attended).toBe(1);
    expect(row?.attendance_points).toBe(5);
    expect(Number(row?.attendance_rate)).toBeLessThanOrEqual(1);

    // The rejected row still exists and still points at the survivor — it is
    // history, not something to delete.
    const { data: kept } = await db
      .from("attendance")
      .select("member_id, status")
      .eq("id", losing.id)
      .single();
    expect(kept).toMatchObject({ member_id: survivor.memberId, status: "rejected" });
  });

  it("⚠️ deleting a member CASCADES their point adjustments away", async () => {
    // Why commitMerge re-counts before deleting. point_adjustments.member_id is
    // `on delete cascade`, so a delete that runs while a grant still points at
    // the loser destroys it — no error, no trace, and the officer is told the
    // merge succeeded.
    const doomed = await makeMember("Cascade Victim");
    const adjustment = await createTestAdjustment(db, track, {
      memberId: doomed.memberId,
      points: 7,
      awardedBy: officerId,
      reason: "merge cascade fixture",
    });

    const { error } = await db.from("members").delete().eq("id", doomed.memberId);
    expect(error).toBeNull();

    const { data: gone } = await db
      .from("point_adjustments")
      .select("id")
      .eq("id", adjustment.id)
      .maybeSingle();
    expect(gone).toBeNull();
  });

  it("⚠️ deleting a member SET NULLs their attendance rather than blocking", async () => {
    // The other silent one. A check-in left pointing at the loser does not stop
    // the delete — it loses its member entirely and becomes an orphan nobody is
    // looking for.
    const doomed = await makeMember("Orphan Maker");
    const event = await createCurrentTermEvent(db, track, { points: 1 });
    const row = await present(event.id, doomed);

    // present_requires_resolution forbids a present row with a null member, so
    // the row has to leave `present` before the FK can null it. That the
    // database enforces even this much is worth knowing — but it does not save
    // a pending or rejected row, which is most of a duplicate's history.
    await db.from("attendance").update({ status: "rejected" }).eq("id", row.id);
    const { error } = await db.from("members").delete().eq("id", doomed.memberId);
    expect(error).toBeNull();

    const { data: orphan } = await db
      .from("attendance")
      .select("member_id, event_id")
      .eq("id", row.id)
      .single();
    expect(orphan?.member_id).toBeNull();
  });

  it("a dues payment BLOCKS the delete — the only FK that fails loudly", async () => {
    const holder = await makeMember("Dues Holder");
    const { data: payment, error: insertError } = await db
      .from("dues_payments")
      .insert({
        venmo_txn_id: `${MARKER}-${crypto.randomUUID()}`,
        member_id: holder.memberId,
        paid_at: new Date().toISOString(),
        amount_cents: 3000,
        terms_covered: 1,
        // Both NOT NULL on the table — a payment always arrives through an
        // import, run by an officer.
        import_batch_id: crypto.randomUUID(),
        imported_by: officerId,
      })
      .select("id")
      .single();
    expect(insertError).toBeNull();

    try {
      const { error } = await db.from("members").delete().eq("id", holder.memberId);
      // 23503: foreign key violation. `on delete restrict` doing its job — and
      // it is the ONLY one of the three that does.
      expect(error?.code).toBe("23503");
    } finally {
      await db.from("dues_payments").delete().eq("id", payment!.id);
    }
  });

  it("runs the whole sequence and leaves the survivor correct", async () => {
    const shared = await createCurrentTermEvent(db, track, { points: 5 });
    const only = await createCurrentTermEvent(db, track, { points: 3 });
    const survivor = await makeMember("Full Survivor");
    const loser = await makeMember("Full Loser");

    await present(shared.id, survivor);
    const collision = await present(shared.id, loser);
    await present(only.id, loser);
    await createTestAdjustment(db, track, {
      memberId: loser.memberId,
      points: 4,
      awardedBy: officerId,
      reason: "merge fixture grant",
    });
    const { data: payment } = await db
      .from("dues_payments")
      .insert({
        venmo_txn_id: `${MARKER}-${crypto.randomUUID()}`,
        member_id: loser.memberId,
        paid_at: new Date().toISOString(),
        amount_cents: 3000,
        terms_covered: 1,
        // Both NOT NULL on the table — a payment always arrives through an
        // import, run by an officer.
        import_batch_id: crypto.randomUUID(),
        imported_by: officerId,
      })
      .select("id")
      .single();

    // 1. Reject the collision.
    await db
      .from("attendance")
      .update({
        status: "rejected",
        resolution_note: "Duplicate — merged",
        resolved_by: officerId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", collision.id)
      .neq("status", "rejected");

    // 2. Repoint, in order.
    for (const table of ["attendance", "point_adjustments", "dues_payments"] as const) {
      const { error } = await db
        .from(table)
        .update({ member_id: survivor.memberId })
        .eq("member_id", loser.memberId);
      expect(error).toBeNull();
    }

    // 3. The survivor's own columns.
    await db
      .from("members")
      .update({ notes: "kept\n\nfrom the duplicate", custom_fields: { } })
      .eq("id", survivor.memberId);

    // 4. Prove the loser is empty — the guard that makes step 5 safe.
    for (const table of ["attendance", "point_adjustments", "dues_payments"] as const) {
      const { count } = await db
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("member_id", loser.memberId);
      expect(count).toBe(0);
    }

    // 5. Delete.
    const { error: deleteError } = await db
      .from("members")
      .delete()
      .eq("id", loser.memberId);
    expect(deleteError).toBeNull();

    const row = await directoryRow(survivor.memberId);
    // Two events, not three: the shared one counts once.
    expect(row?.events_attended).toBe(2);
    expect(row?.attendance_points).toBe(8);
    // Plus the moved adjustment.
    expect(row?.total_points).toBe(12);
    expect(Number(row?.attendance_rate)).toBeLessThanOrEqual(1);

    // The payment moved, so dues status follows the survivor.
    const { data: moved } = await db
      .from("dues_payments")
      .select("member_id")
      .eq("id", payment!.id)
      .single();
    expect(moved?.member_id).toBe(survivor.memberId);
    await db.from("dues_payments").delete().eq("id", payment!.id);

    // And the loser is gone.
    const { data: ghost } = await db
      .from("members")
      .select("id")
      .eq("id", loser.memberId)
      .maybeSingle();
    expect(ghost).toBeNull();
  });

  it("accepts 'member.merged' as an audit action on a member", async () => {
    // admin_audit.action is free text in SQL and a closed union in TypeScript,
    // so this asserts the row is writable and the entity type is right rather
    // than that the verb is constrained.
    const survivor = await makeMember("Audit Survivor");
    const { error } = await db.from("admin_audit").insert({
      entity_type: "member",
      entity_id: survivor.memberId,
      actor_id: officerId,
      action: "member.merged",
      note: "merged Someone (t3qmrg9) [uuid] — 1 check-in, 0 adjustments, 0 payments",
    });
    expect(error).toBeNull();
  });
});

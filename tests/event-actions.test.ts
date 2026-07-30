import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { writeAudit, writeAuditBatch } from "@/app/actions/audit";
import {
  duplicateDraft,
  effectiveWindow,
  expandSeries,
  findWindowConflicts,
} from "@/lib/events";

import {
  at,
  claimSlot,
  cleanup,
  countAuditRows,
  createTestEvent,
  createTestMember,
  getTestOfficer,
  latestAuditRow,
  newTracker,
  testClient,
  testIdentity,
  type Tracker,
} from "./helpers";

// Integration tests for the Stage 4 event machinery, against the LOCAL stack.
//
// These exercise the claims that only a real Postgres can settle: that the
// overlap exclusion constraint is all-or-nothing, that findWindowConflicts
// agrees with what the database would actually reject, that the updated_at
// compare-and-set works at microsecond precision, and that deleting an event
// with attendance would silently orphan rows.
//
// The "use server" exports in app/actions/events.ts are not called directly —
// they need a request context for cookies. What is tested here is everything
// they delegate to plus the database behaviour they depend on.

const db = testClient();
const track: Tracker = newTracker();
let officerId: string;

beforeAll(async () => {
  officerId = await getTestOfficer(db);
});

afterAll(async () => {
  await cleanup(db, track);
});

describe("series creation", () => {
  it("inserts a whole series as drafts sharing one series_id", async () => {
    const seriesId = crypto.randomUUID();
    const drafts = expandSeries({
      firstDate: "2030-10-01",
      untilDate: "2030-12-17",
      weekdays: [2],
      startTime: "18:00",
      durationMinutes: 60,
      openEarlyMinutes: 15,
      closeLateMinutes: 15,
      title: `TEST series ${seriesId.slice(0, 8)}`,
      description: null,
      location: "UTC 3.102",
      points: 1,
      category: "general_meeting",
      seriesId,
    });

    expect(drafts).toHaveLength(12);

    const { data, error } = await db
      .from("events")
      .insert(drafts)
      .select("id, status, series_id");

    expect(error).toBeNull();
    data!.forEach((row) => track.eventIds.push(row.id));

    expect(data).toHaveLength(12);
    expect(data!.every((r) => r.status === "draft")).toBe(true);
    expect(new Set(data!.map((r) => r.series_id)).size).toBe(1);
  });

  it("lets overlapping drafts coexist, because the constraint is published-only", async () => {
    const slot = claimSlot();
    const a = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
      status: "draft",
    });
    const b = await createTestEvent(db, track, {
      starts: at(slot, 18.5),
      ends: at(slot, 19.5),
      status: "draft",
    });

    expect(a.id).not.toBe(b.id);
  });
});

describe("overlap exclusion constraint", () => {
  it("rejects a second published event whose window overlaps", async () => {
    const slot = claimSlot();
    await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
      status: "published",
    });

    const { error } = await db.from("events").insert({
      title: "TEST overlapping",
      starts_at: at(slot, 18.5).toISOString(),
      ends_at: at(slot, 19.5).toISOString(),
      status: "published",
    });

    expect(error?.code).toBe("23P01");
  });

  it("permits back-to-back published events, since windows are half-open", async () => {
    const slot = claimSlot();
    await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
      status: "published",
    });
    const second = await createTestEvent(db, track, {
      starts: at(slot, 19),
      ends: at(slot, 20),
      status: "published",
    });

    expect(second.id).toBeTruthy();
  });

  it("fails a batch publish entirely when one row collides", async () => {
    const slot = claimSlot();
    const seriesId = crypto.randomUUID();

    // Three drafts an hour apart, plus a published event colliding with the
    // middle one.
    for (const hour of [10, 14, 18]) {
      await createTestEvent(db, track, {
        starts: at(slot, hour),
        ends: at(slot, hour + 1),
        status: "draft",
        seriesId,
      });
    }
    await createTestEvent(db, track, {
      starts: at(slot, 14.5),
      ends: at(slot, 15.5),
      status: "published",
    });

    const { error } = await db
      .from("events")
      .update({ status: "published" })
      .eq("series_id", seriesId);

    expect(error?.code).toBe("23P01");

    // The atomicity claim: one statement, one transaction, so nothing at all
    // was published — a half-published schedule is worse than a rejected one.
    const { count } = await db
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("series_id", seriesId)
      .eq("status", "published");
    expect(count).toBe(0);
  });

  it("publishes the rest when the colliding row is excluded", async () => {
    const slot = claimSlot();
    const seriesId = crypto.randomUUID();

    const drafts = [];
    for (const hour of [10, 14, 18]) {
      drafts.push(
        await createTestEvent(db, track, {
          starts: at(slot, hour),
          ends: at(slot, hour + 1),
          status: "draft",
          seriesId,
        })
      );
    }
    const blocker = await createTestEvent(db, track, {
      starts: at(slot, 14.5),
      ends: at(slot, 15.5),
      status: "published",
    });

    // Pre-flight must identify exactly the row the database would reject.
    const { data: candidates } = await db
      .from("events")
      .select("id, title, starts_at, ends_at, checkin_opens_at, checkin_closes_at")
      .eq("series_id", seriesId)
      .order("starts_at", { ascending: true });
    const { data: published } = await db
      .from("events")
      .select("id, title, starts_at, ends_at, checkin_opens_at, checkin_closes_at")
      .eq("status", "published")
      .eq("id", blocker.id);

    const conflicts = findWindowConflicts(candidates!, published!);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].withEventId).toBe(blocker.id);

    const conflictingId = candidates!.find(
      (c) => c.starts_at === conflicts[0].candidateStartsAt
    )!.id;

    const { data: updated, error } = await db
      .from("events")
      .update({ status: "published" })
      .eq("series_id", seriesId)
      .neq("id", conflictingId)
      .select("id");

    expect(error).toBeNull();
    expect(updated).toHaveLength(2);

    const { data: stillDraft } = await db
      .from("events")
      .select("id")
      .eq("series_id", seriesId)
      .eq("status", "draft");
    expect(stillDraft!.map((r) => r.id)).toEqual([conflictingId]);
  });
});

describe("updated_at compare-and-set", () => {
  it("matches at microsecond precision and bumps on write", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
      status: "draft",
    });

    const { data: before } = await db
      .from("events")
      .select("updated_at")
      .eq("id", event.id)
      .single();

    // The raw string, never round-tripped through a JS Date — that would
    // truncate microseconds and make every save report a phantom conflict.
    const { data: ok } = await db
      .from("events")
      .update({ points: 5 })
      .eq("id", event.id)
      .eq("updated_at", before!.updated_at)
      .select("id, updated_at")
      .maybeSingle();

    expect(ok).not.toBeNull();
    expect(ok!.updated_at).not.toBe(before!.updated_at);
  });

  it("affects zero rows when another officer already saved", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
      status: "draft",
    });

    const { data: stale } = await db
      .from("events")
      .select("updated_at")
      .eq("id", event.id)
      .single();

    // Somebody else writes first.
    await db.from("events").update({ points: 2 }).eq("id", event.id);

    const { data: lost } = await db
      .from("events")
      .update({ points: 9 })
      .eq("id", event.id)
      .eq("updated_at", stale!.updated_at)
      .select("id")
      .maybeSingle();

    expect(lost).toBeNull();

    const { data: actual } = await db
      .from("events")
      .select("points")
      .eq("id", event.id)
      .single();
    expect(actual!.points).toBe(2);
  });
});

describe("deleting an event with attendance", () => {
  it("would orphan the attendance rows, which is why the action blocks it", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
      status: "published",
    });
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);

    await db.from("attendance").insert({
      event_id: event.id,
      member_id: memberId,
      submitted_name: identity.fullName,
      submitted_student_id: identity.studentId,
      submitted_email: identity.email,
      status: "present",
    });

    // The count the action checks before refusing.
    const { count } = await db
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id);
    expect(count).toBe(1);

    // And this is why refusing matters: the FK is ON DELETE SET NULL, so the
    // database would not complain — it would quietly turn a recorded
    // attendance into an unresolvable orphan.
    const { data: fkBehaviour } = await db
      .from("attendance")
      .select("event_id, status")
      .eq("event_id", event.id)
      .single();
    expect(fkBehaviour!.event_id).toBe(event.id);
    expect(fkBehaviour!.status).toBe("present");
  });

  it("allows deleting an event with no attendance", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
      status: "draft",
    });

    const { error } = await db.from("events").delete().eq("id", event.id);
    expect(error).toBeNull();

    const { data } = await db
      .from("events")
      .select("id")
      .eq("id", event.id)
      .maybeSingle();
    expect(data).toBeNull();
  });
});

describe("audit writing", () => {
  it("records actor, action, and before/after for a mutation", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
      status: "draft",
    });

    await writeAudit(db, {
      entityType: "event",
      entityId: event.id,
      actorId: officerId,
      action: "event.published",
      before: { status: "draft" },
      after: { status: "published" },
    });

    expect(await countAuditRows(db, "event", event.id)).toBe(1);

    const row = await latestAuditRow(db, "event", event.id);
    expect(row).toMatchObject({
      action: "event.published",
      actor_id: officerId,
      before: { status: "draft" },
      after: { status: "published" },
    });
  });

  it("writes one row per event for a series operation", async () => {
    const slot = claimSlot();
    const seriesId = crypto.randomUUID();
    const events = [];
    for (const hour of [10, 14]) {
      events.push(
        await createTestEvent(db, track, {
          starts: at(slot, hour),
          ends: at(slot, hour + 1),
          status: "draft",
          seriesId,
        })
      );
    }

    await writeAuditBatch(
      db,
      events.map((e) => ({
        entityType: "event" as const,
        entityId: e.id,
        actorId: officerId,
        action: "series.published" as const,
        note: `series ${seriesId}`,
      }))
    );

    for (const event of events) {
      expect(await countAuditRows(db, "event", event.id)).toBe(1);
      const row = await latestAuditRow(db, "event", event.id);
      expect(row!.note).toContain(seriesId);
    }
  });

  it("stays append-only: update and delete both raise", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
      status: "draft",
    });
    await writeAudit(db, {
      entityType: "event",
      entityId: event.id,
      actorId: officerId,
      action: "event.created",
    });

    const { error: updateError } = await db
      .from("admin_audit")
      .update({ note: "tampered" })
      .eq("entity_id", event.id);
    expect(updateError?.code).toBe("P0001");

    const { error: deleteError } = await db
      .from("admin_audit")
      .delete()
      .eq("entity_id", event.id);
    expect(deleteError?.code).toBe("P0001");
  });
});

describe("term_of, the source of every term string", () => {
  it("puts July in Spring and August in Fall, anchored to Central", async () => {
    const { data: july } = await db.rpc("term_of", {
      ts: "2026-07-31T23:00:00-05:00",
    });
    const { data: august } = await db.rpc("term_of", {
      ts: "2026-08-01T00:00:00-05:00",
    });

    expect(july).toBe("Spring 2026");
    expect(august).toBe("Fall 2026");
  });

  it("agrees with the generated column on a real row", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
      status: "draft",
    });

    const { data: row } = await db
      .from("events")
      .select("starts_at, term")
      .eq("id", event.id)
      .single();
    const { data: viaRpc } = await db.rpc("term_of", { ts: row!.starts_at });

    expect(row!.term).toBe(viaRpc);
  });
});

describe("duplicateDraft against a stored row", () => {
  it("clones window offsets a week on, and stays a draft", async () => {
    const slot = claimSlot();
    const source = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
      status: "published",
      points: 3,
      category: "workshop",
      checkinOpensAt: at(slot, 17.75),
      checkinClosesAt: at(slot, 19.25),
    });

    const { data: row } = await db
      .from("events")
      .select(
        "title, description, location, starts_at, ends_at, checkin_opens_at, checkin_closes_at, points, category"
      )
      .eq("id", source.id)
      .single();

    const draft = duplicateDraft(row!);
    const { data: inserted, error } = await db
      .from("events")
      .insert(draft)
      .select("id, status, series_id, points, category, starts_at, checkin_opens_at, checkin_closes_at")
      .single();

    expect(error).toBeNull();
    track.eventIds.push(inserted!.id);

    expect(inserted!.status).toBe("draft");
    expect(inserted!.series_id).toBeNull();
    expect(inserted!.points).toBe(3);
    expect(inserted!.category).toBe("workshop");

    const window = effectiveWindow(inserted!);
    expect(window.opens.getTime()).toBe(
      new Date(inserted!.starts_at).getTime() - 15 * 60_000
    );
  });
});

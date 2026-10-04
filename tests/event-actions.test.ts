import { readFileSync } from "node:fs";

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
      category: "general_and_other",
      // Ticked, so the column default (false) cannot satisfy the assertion.
      countsAsGeneralMeeting: true,
      seriesId,
    });

    expect(drafts).toHaveLength(12);

    const { data, error } = await db
      .from("events")
      .insert(drafts)
      .select("id, status, series_id, counts_as_general_meeting");

    expect(error).toBeNull();
    data!.forEach((row) => track.eventIds.push(row.id));

    expect(data).toHaveLength(12);
    expect(data!.every((r) => r.status === "draft")).toBe(true);
    expect(new Set(data!.map((r) => r.series_id)).size).toBe(1);
    // The series form's one box reached every stored row (migration 31).
    expect(data!.every((r) => r.counts_as_general_meeting === true)).toBe(true);
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
      submitted_eid: identity.eid,
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
      category: "professional_dev",
      checkinOpensAt: at(slot, 17.75),
      checkinClosesAt: at(slot, 19.25),
      // Ticked, so a copy that fell back to the column default would show.
      countsAsGeneralMeeting: true,
    });

    const { data: row } = await db
      .from("events")
      .select(
        "title, description, location, starts_at, ends_at, checkin_opens_at, checkin_closes_at, points, category, verify_origin, counts_as_general_meeting"
      )
      .eq("id", source.id)
      .single();

    const draft = duplicateDraft(row!);
    const { data: inserted, error } = await db
      .from("events")
      .insert(draft)
      // ends_at is not asserted on, but effectiveWindow() needs it — it falls
      // back to it when checkin_closes_at is null. Selecting it keeps the row
      // an honest EventWindowRow rather than one that happens to work because
      // this fixture sets an explicit close.
      .select("id, status, series_id, points, category, starts_at, ends_at, checkin_opens_at, checkin_closes_at, counts_as_general_meeting")
      .single();

    expect(error).toBeNull();
    track.eventIds.push(inserted!.id);

    expect(inserted!.status).toBe("draft");
    expect(inserted!.series_id).toBeNull();
    expect(inserted!.points).toBe(3);
    expect(inserted!.category).toBe("professional_dev");
    // The copy keeps the source's box (officer, 2026-10-04).
    expect(inserted!.counts_as_general_meeting).toBe(true);

    const window = effectiveWindow(inserted!);
    expect(window.opens.getTime()).toBe(
      new Date(inserted!.starts_at).getTime() - 15 * 60_000
    );
  });
});

// ---------------------------------------------------------------------------
// Migration 31 — counts_as_general_meeting reaches every events column list,
// and the box the officer submitted reaches the save and the series
// ---------------------------------------------------------------------------
//
// The actions need a request context, so their wiring is pinned against
// comment-stripped source, the convention tests/member-actions.test.ts uses.
// Comments are stripped so a list mentioned in prose cannot satisfy a check.

describe("counts_as_general_meeting in the events actions (migration 31)", () => {
  const strip = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const actions = strip(readFileSync("app/actions/events.ts", "utf8"));
  /** Every one-line double-quoted string in the module. */
  const literals = (code: string) =>
    [...code.matchAll(/"([^"\n]*)"/g)].map((match) => match[1]);
  /** The select string chained after the first `anchor`. */
  const selectAfter = (code: string, anchor: string) => {
    const start = code.indexOf(anchor);
    expect(start, anchor).toBeGreaterThan(-1);
    return /\.select\(\s*"([^"]*)"/.exec(code.slice(start))?.[1] ?? "";
  };
  /** One exported action, from its declaration to the next export. */
  const actionBody = (name: string) => {
    const start = actions.indexOf(`export async function ${name}(`);
    expect(start, name).toBeGreaterThan(-1);
    const end = actions.indexOf("\nexport ", start + 1);
    return actions.slice(start, end === -1 ? undefined : end);
  };
  /** From `anchor` to the first `close` after it: one object literal. */
  const between = (code: string, anchor: string, close: string) => {
    const start = code.indexOf(anchor);
    expect(start, anchor).toBeGreaterThan(-1);
    return code.slice(start, code.indexOf(close, start));
  };
  /**
   * Every value `code` maps the property `key` to, with all whitespace removed,
   * so line breaks and spacing pass and a different value never does. The
   * lookbehind keeps `fields.key` itself from reading as a property.
   */
  const mappedValues = (code: string, key: string) =>
    [
      ...code.matchAll(new RegExp(`(?<![\\w.$])${key}\\s*:\\s*([^,}\\r\\n]*)`, "g")),
    ].map((match) => match[1].replace(/\s+/g, ""));

  it("saves the box the officer submitted, on create and on edit alike", () => {
    // 🪤 The generated Insert and Update types make the column optional, so a
    // payload that dropped it, or wrote a literal, would compile, and every
    // database test above would still pass. The insert spreads `values` and the
    // update sends it, so the mapping has to be in that literal, and nowhere
    // else in the action can override it.
    const save = actionBody("saveEvent");
    const values = between(save, "const values = {", "};");
    expect(mappedValues(values, "counts_as_general_meeting")).toEqual([
      "fields.countsAsGeneralMeeting",
    ]);
    expect(mappedValues(save, "counts_as_general_meeting")).toHaveLength(1);
  });

  it("gives every event of a series the series form's box", () => {
    // SeriesSpec makes the key REQUIRED, so dropping it is a compile error. A
    // literal `true` or `false` still compiles, and would stamp that answer on
    // every event the series creates, whatever the officer ticked.
    const series = actionBody("createSeries");
    const spec = between(series, "expandSeries({", "});");
    expect(mappedValues(spec, "countsAsGeneralMeeting")).toEqual([
      "fields.countsAsGeneralMeeting",
    ]);
    expect(mappedValues(series, "countsAsGeneralMeeting")).toHaveLength(1);
    // And the insert spreads each draft as it is: a column written there would
    // override what expandSeries copied from the spec.
    expect(mappedValues(series, "counts_as_general_meeting")).toEqual([]);
  });

  it("🪤 is in every list that names verify_origin — all five of them", () => {
    // Both sides of an audit before/after must select the same columns, or the
    // log invents a change that never happened (migration 28's note). The five
    // are create after, update before and after, delete before and the
    // duplicate's source read.
    const withVerifyOrigin = literals(actions).filter((list) =>
      /\bverify_origin\b/.test(list)
    );
    // Counted, so this guard cannot pass by matching nothing — and a sixth
    // list is a decision for whoever adds it, not a silent pass.
    expect(withVerifyOrigin).toHaveLength(5);
    for (const list of withVerifyOrigin) {
      expect(list).toMatch(/\bcounts_as_general_meeting\b/);
    }
  });

  it("is recorded on every series.created receipt and every duplicate's", () => {
    expect(selectAfter(actions, ".insert(drafts.map(")).toMatch(
      /\bcounts_as_general_meeting\b/
    );
    expect(selectAfter(actions, ".insert({ ...draft,")).toMatch(
      /\bcounts_as_general_meeting\b/
    );
  });

  it("is selected by the events list, whose result is cast rather than typed", () => {
    // `data as unknown as EventListRow[]`: nothing type-checks this string
    // against the row type, so a missing column renders as no marker at all.
    const page = strip(
      readFileSync("app/admin/(shell)/events/page.tsx", "utf8")
    );
    const listSelect = literals(page).filter((list) =>
      list.includes("attendance(count)")
    );
    expect(listSelect).toHaveLength(1);
    expect(listSelect[0]).toMatch(/\bcounts_as_general_meeting\b/);
  });
});

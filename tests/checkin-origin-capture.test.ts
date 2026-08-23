import { afterAll, describe, expect, it } from "vitest";

import { resolveCheckin } from "@/lib/checkin";
import {
  buildOriginRecord,
  deriveOriginFlag,
  establishVenueOrigin,
  withinCheckinWindow,
} from "@/lib/checkin-origin";
import type { OriginRecord } from "@/lib/network-classify";

import {
  at,
  claimSlot,
  cleanup,
  createTestEvent,
  createTestMember,
  newTracker,
  testClient,
  testIdentity,
} from "./helpers";

// Check-in origin CAPTURE, against the local stack
// (docs/checkin-location-verification.md). The pure halves are covered by
// tests/network-classify.test.ts and tests/checkin-origin.test.ts; what can
// only be proved here is what actually lands in the database — including the
// two properties that are about what does NOT.

const db = testClient();
const track = newTracker();

afterAll(() => cleanup(db, track));

const returning = (identity: ReturnType<typeof testIdentity>) => ({
  ...identity,
  declaredNew: false,
  confirmed: false,
});

/** The closure app/actions/attendance.ts builds, with the address pinned. */
const from = (ip: string) => (eventId: string | null) =>
  buildOriginRecord(eventId, ip);

async function originFor(attendanceId: string) {
  const { data, error } = await db
    .from("checkin_origin")
    .select("attendance_id, origin_hash, network_type")
    .eq("attendance_id", attendanceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function newestAttendanceId(eid: string) {
  const { data, error } = await db
    .from("attendance")
    .select("id")
    .eq("submitted_eid", eid)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

describe("what gets written", () => {
  it("records a digest and a kind for a resolved check-in", async () => {
    const slot = claimSlot();
    await createTestEvent(db, track, { starts: at(slot, 18), ends: at(slot, 19) });
    const identity = testIdentity();
    await createTestMember(db, track, identity);

    const result = await resolveCheckin(
      db,
      returning(identity),
      at(slot, 18.5),
      from("128.83.140.7") // UT space
    );
    expect(result.status).toBe("present");

    const origin = await originFor(await newestAttendanceId(identity.eid));
    expect(origin?.network_type).toBe("campus");
    expect(origin?.origin_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  // 🔓 The retroactive half. A pending orphan has no event_id to hash with, so
  // it carries no digest — but the KIND still tells an officer who later
  // assigns the row whether the submitter was on campus.
  it("records a kind but NO digest for a pending orphan", async () => {
    const slot = claimSlot();
    // An event exists, but the submission lands well outside its window.
    await createTestEvent(db, track, { starts: at(slot, 18), ends: at(slot, 19) });
    const identity = testIdentity();
    await createTestMember(db, track, identity);

    const result = await resolveCheckin(
      db,
      returning(identity),
      at(slot, 16),
      from("128.83.140.7")
    );
    expect(result.status).toBe("pending");

    const origin = await originFor(await newestAttendanceId(identity.eid));
    expect(origin?.network_type).toBe("campus");
    expect(origin?.origin_hash).toBeNull();
  });

  it("records an unknown kind and no digest when there is no address", async () => {
    const slot = claimSlot();
    await createTestEvent(db, track, { starts: at(slot, 18), ends: at(slot, 19) });
    const identity = testIdentity();
    await createTestMember(db, track, identity);

    await resolveCheckin(db, returning(identity), at(slot, 18.5), from(""));

    const origin = await originFor(await newestAttendanceId(identity.eid));
    expect(origin?.network_type).toBe("unknown");
    expect(origin?.origin_hash).toBeNull();
  });

  // 📌 Omitting the factory is the pre-feature behaviour, and every other suite
  // in this repo relies on it.
  it("records nothing at all when no factory is passed", async () => {
    const slot = claimSlot();
    await createTestEvent(db, track, { starts: at(slot, 18), ends: at(slot, 19) });
    const identity = testIdentity();
    await createTestMember(db, track, identity);

    await resolveCheckin(db, returning(identity), at(slot, 18.5));

    expect(await originFor(await newestAttendanceId(identity.eid))).toBeNull();
  });
});

describe("what never gets written", () => {
  // 🔓 THE ASSERTION THAT MATTERS MOST, and the whole justification for the
  // table existing at all. Swept over every row rather than the ones this file
  // wrote, so a future code path that stores an address fails HERE.
  it("never persists anything shaped like an IP address", async () => {
    const { data, error } = await db
      .from("checkin_origin")
      .select("origin_hash, network_type");
    expect(error).toBeNull();

    const IPV4 = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;
    const IPV6 = /[0-9a-f]{0,4}:[0-9a-f]{0,4}:/i;
    for (const row of data ?? []) {
      for (const value of [row.origin_hash, row.network_type]) {
        if (value === null) continue;
        expect(value, `${value} looks like an IPv4 address`).not.toMatch(IPV4);
        expect(value, `${value} looks like an IPv6 address`).not.toMatch(IPV6);
      }
    }
    // Guards the guard: an empty table would make the sweep vacuous.
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  // 🪤 Officer manual entry runs from the officer's laptop. Ten walk-ins would
  // otherwise write ten rows on the officer's own origin, which then either
  // BECOMES the venue mode or gets the whole batch flagged — both silent, both
  // wrong.
  //
  // 📌 This holds STRUCTURALLY, not by a filter: `admin_manual` rows are
  // created by app/actions/attendance-review.ts, which never touches
  // resolveCheckin. This asserts the structure has not quietly changed.
  it("records no origin for an officer-entered row", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);

    const { data: row, error } = await db
      .from("attendance")
      .insert({
        event_id: event.id,
        member_id: memberId,
        submitted_name: identity.fullName,
        submitted_eid: identity.eid,
        submitted_email: identity.email,
        status: "present",
        source: "admin_manual",
      })
      .select("id")
      .single();
    expect(error).toBeNull();

    expect(await originFor(row!.id)).toBeNull();
  });
});

describe("failing open", () => {
  // 🪤 An advisory signal sitting in the one unauthenticated write path must
  // never turn away a member standing in a room. Same doctrine as
  // checkRateLimit.
  //
  // The failure is forced with a network_type the CHECK constraint rejects,
  // which is a real database error rather than a mocked one.
  it("still records the check-in when the origin insert fails", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();
    await createTestMember(db, track, identity);

    const poison = () =>
      ({ originHash: null, networkType: "not-a-kind" } as unknown as OriginRecord);

    const result = await resolveCheckin(db, returning(identity), at(slot, 18.5), poison);

    expect(result).toEqual({ status: "present", eventTitle: event.title });

    const attendanceId = await newestAttendanceId(identity.eid);
    expect(attendanceId).toBeTruthy();
    expect(await originFor(attendanceId)).toBeNull();
  });

  // 🪤 The half that would have shipped unnoticed. PostgREST failures normally
  // arrive as `{ error }`, so the case above is the one anybody writes a test
  // for — but a THROW escapes into submitCheckin's house try/catch and returns
  // `error` to a member whose attendance row was already written. They are then
  // told to try again, and told they are a duplicate when they do.
  it("still records the check-in when the origin insert THROWS", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();
    await createTestMember(db, track, identity);

    // A client whose checkin_origin writes reject, and whose every other table
    // behaves normally.
    const exploding = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop !== "from") return Reflect.get(target, prop, receiver);
        return (table: string) => {
          if (table === "checkin_origin") {
            return {
              insert: () => Promise.reject(new Error("connection reset")),
            };
          }
          return target.from(table as "attendance");
        };
      },
    }) as typeof db;

    const result = await resolveCheckin(
      exploding,
      returning(identity),
      at(slot, 18.5),
      from("128.83.140.7")
    );

    expect(result).toEqual({ status: "present", eventTitle: event.title });
    // And the attendance row really is there, which is the point.
    const attendanceId = await newestAttendanceId(identity.eid);
    expect(attendanceId).toBeTruthy();
    expect(await originFor(attendanceId)).toBeNull();
  });

  // The database half of the same guarantee: the constraint that stops an
  // unclassifiable address from being reported as evidence.
  it("refuses an unknown kind carrying a digest, at the schema level", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);

    const { data: row } = await db
      .from("attendance")
      .insert({
        event_id: event.id,
        member_id: memberId,
        submitted_name: identity.fullName,
        submitted_eid: identity.eid,
        submitted_email: identity.email,
        status: "present",
      })
      .select("id")
      .single();

    const { error } = await db.from("checkin_origin").insert({
      attendance_id: row!.id,
      origin_hash: "a".repeat(64),
      network_type: "unknown",
    });
    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("checkin_origin_unknown_has_no_digest");
  });
});

describe("the per-event toggle, on an event that already finished", () => {
  // 🔓 THE HEADLINE REQUIREMENT, end to end: verification is per event, it is
  // on by default, and it can be switched on AFTER the event is over — at
  // which point the flags appear for check-ins that were captured while it was
  // switched off. Nothing is re-captured and nothing is backfilled.
  //
  // The unit tests cover deriveOriginFlag's `off` branch. What only an
  // integration test can show is that the SAME stored rows produce nothing
  // before the flip and real flags after it, against a real past event.

  /** Re-run exactly what the officer's event page does, and return the flags. */
  async function flagsFor(eventId: string) {
    const { data: event } = await db
      .from("events")
      .select("verify_origin, starts_at, ends_at, checkin_opens_at, checkin_closes_at")
      .eq("id", eventId)
      .single();

    const { data: rows } = await db
      .from("attendance")
      .select("id, status, source, submitted_at")
      .eq("event_id", eventId)
      .order("submitted_at", { ascending: true });

    const { data: origins } = await db
      .from("checkin_origin")
      .select("attendance_id, origin_hash, network_type, attendance!inner(event_id)")
      .eq("attendance.event_id", eventId);

    const byId = new Map<string, OriginRecord>(
      (origins ?? []).map((o) => [
        o.attendance_id,
        {
          originHash: o.origin_hash,
          networkType: o.network_type as OriginRecord["networkType"],
        },
      ])
    );

    const opens = event!.checkin_opens_at ?? event!.starts_at;
    const closes = event!.checkin_closes_at ?? event!.ends_at;
    const venue = establishVenueOrigin(
      (rows ?? [])
        .filter(
          (r) =>
            r.status === "present" &&
            r.source === "self_checkin" &&
            withinCheckinWindow(r.submitted_at, opens, closes)
        )
        .map((r) => byId.get(r.id))
        .filter((o): o is OriginRecord => o !== undefined)
    );

    return {
      venue,
      flags: (rows ?? []).map((r) =>
        deriveOriginFlag({
          record: byId.get(r.id),
          venue,
          verifyOrigin: event!.verify_origin,
          isSelfCheckin: r.source === "self_checkin",
        })
      ),
    };
  }

  it("switches on after the event and lights up check-ins captured while it was off", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });

    // The officer turns it OFF before anyone arrives.
    await db.from("events").update({ verify_origin: false }).eq("id", event.id);

    // Eight people check in: six on one network, one elsewhere on campus, one
    // off-network. Captured through the real path, with the toggle off.
    const venueIp = "128.83.140.7";
    for (let i = 0; i < 6; i += 1) {
      const identity = testIdentity();
      await createTestMember(db, track, identity);
      const r = await resolveCheckin(db, returning(identity), at(slot, 18.1 + i * 0.05), from(venueIp));
      expect(r.status).toBe("present");
    }
    const elsewhere = testIdentity();
    await createTestMember(db, track, elsewhere);
    await resolveCheckin(db, returning(elsewhere), at(slot, 18.5), from("146.6.1.1"));

    const offsite = testIdentity();
    await createTestMember(db, track, offsite);
    await resolveCheckin(db, returning(offsite), at(slot, 18.6), from("1.1.1.1"));

    // 🔓 Capture ran anyway. The toggle gates derivation, not collection —
    // this is the property the whole retroactive behaviour rests on.
    const { count: captured } = await db
      .from("checkin_origin")
      .select("attendance_id, attendance!inner(event_id)", { count: "exact", head: true })
      .eq("attendance.event_id", event.id);
    expect(captured).toBe(8);

    // With the toggle off, the officer's screen derives nothing at all.
    const before = await flagsFor(event.id);
    expect(new Set(before.flags)).toEqual(new Set(["off"]));

    // ── The event is over. The officer now flips the switch. ──
    const { error: flipError } = await db
      .from("events")
      .update({ verify_origin: true })
      .eq("id", event.id);
    expect(flipError).toBeNull();

    const after = await flagsFor(event.id);

    // A venue was established from rows recorded before the flip.
    expect(after.venue.status).toBe("established");
    if (after.venue.status === "established") {
      expect(after.venue.count).toBe(6);
      expect(after.venue.considered).toBe(8);
    }

    const tally = after.flags.reduce<Record<string, number>>((acc, f) => {
      acc[f] = (acc[f] ?? 0) + 1;
      return acc;
    }, {});
    expect(tally).toEqual({ at_venue: 6, on_campus: 1, off_network: 1 });

    // 🪤 And nothing was written to make that happen — same eight rows.
    const { count: afterCount } = await db
      .from("checkin_origin")
      .select("attendance_id, attendance!inner(event_id)", { count: "exact", head: true })
      .eq("attendance.event_id", event.id);
    expect(afterCount).toBe(8);
  });

  it("switches back off again, and stops deriving without losing anything", async () => {
    const slot = claimSlot();
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 19),
    });
    for (let i = 0; i < 6; i += 1) {
      const identity = testIdentity();
      await createTestMember(db, track, identity);
      await resolveCheckin(db, returning(identity), at(slot, 18.1 + i * 0.05), from("128.83.140.7"));
    }

    // Default is ON, so flags exist without anybody touching anything.
    expect(new Set((await flagsFor(event.id)).flags)).toEqual(new Set(["at_venue"]));

    await db.from("events").update({ verify_origin: false }).eq("id", event.id);
    expect(new Set((await flagsFor(event.id)).flags)).toEqual(new Set(["off"]));

    // The evidence is still there, so it is a view toggle and not a delete.
    const { count } = await db
      .from("checkin_origin")
      .select("attendance_id, attendance!inner(event_id)", { count: "exact", head: true })
      .eq("attendance.event_id", event.id);
    expect(count).toBe(6);
  });

  it("defaults to on, per event, without anyone setting it", async () => {
    const slot = claimSlot();
    const a = await createTestEvent(db, track, { starts: at(slot, 18), ends: at(slot, 19) });
    const b = await createTestEvent(db, track, { starts: at(slot, 20), ends: at(slot, 21) });

    const { data: rows } = await db
      .from("events")
      .select("id, verify_origin")
      .in("id", [a.id, b.id]);
    expect(rows?.every((r) => r.verify_origin === true)).toBe(true);

    // 📌 And it is genuinely PER EVENT: turning one off leaves the other alone.
    await db.from("events").update({ verify_origin: false }).eq("id", a.id);
    const { data: after } = await db
      .from("events")
      .select("id, verify_origin")
      .in("id", [a.id, b.id]);
    expect(after?.find((r) => r.id === a.id)?.verify_origin).toBe(false);
    expect(after?.find((r) => r.id === b.id)?.verify_origin).toBe(true);
  });
});

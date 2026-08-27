import { afterAll, describe, expect, it } from "vitest";

import {
  anonClient,
  at,
  claimSlot,
  cleanup,
  createCurrentTermEvent,
  createTestAdjustment,
  createTestAttendance,
  createTestEvent,
  createTestMember,
  getTestOfficer,
  newTracker,
  testClient,
  testIdentity,
} from "./helpers";

// The public leaderboard view (§4.4), and the term-visibility fix migration 21
// makes to current_term(). Integration against real Postgres and real
// PostgREST — the whole point of most of these is what a specific ROLE sees,
// which no pure test can model.

const db = testClient();
const track = newTracker();

afterAll(async () => {
  await cleanup(db, track);
  // Belt and braces. Every pin below restores in a finally, but a crash between
  // the pin and the restore would leave every later file asserting against the
  // wrong term — and the seed's own data would fall out of scope, so the
  // failures would look like data loss rather than like leftover state.
  await unpinTerm();
});

async function pinTerm(term: string): Promise<void> {
  const { error } = await db
    .from("app_settings")
    .update({ current_term: term })
    .eq("id", true);
  if (error) throw new Error(`pin failed: ${error.message}`);
}

async function unpinTerm(): Promise<void> {
  const { error } = await db
    .from("app_settings")
    .update({ current_term: null })
    .eq("id", true);
  if (error) throw new Error(`unpin failed: ${error.message}`);
}

async function currentTerm(): Promise<string> {
  const { data, error } = await db.rpc("current_term");
  if (error) throw new Error(`current_term() failed: ${error.message}`);
  return data;
}

async function leaderboardRow(memberId: string) {
  const { data, error } = await db
    .from("leaderboard")
    .select("id, full_name, total_points, term")
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw new Error(`leaderboard read failed: ${error.message}`);
  return data;
}

describe("current_term() visibility (migration 21)", () => {
  // 🔓 The defect this migration closes, asserted before anything that depends
  // on the fix — the house rule from the phase-8 merge work: prove the hazard
  // against real Postgres first, or the fix is unfalsifiable.
  //
  // current_term() reads app_settings, which is RLS deny-all with zero
  // policies. Before migration 21 the function was invoker-rights, so an anon
  // caller got no row, the coalesce fell through, and it silently returned the
  // DERIVED term — while the service role saw the pin. The views did not save
  // it: owner rights cover the tables a view references directly, and a plain
  // function called from inside one still runs as the invoker.

  it("reports a pinned term to anon, not the derived one", async () => {
    const derived = await currentTerm();
    const { data: pinned, error: nextError } = await db.rpc("next_term", {
      t: derived,
    });
    if (nextError) throw new Error(`next_term failed: ${nextError.message}`);
    // Derived from the database, never typed — §4.7 applies to test code too.
    expect(pinned).not.toBe(derived);

    const anon = anonClient();

    // Non-empty before the pin, or "it emptied" proves nothing.
    const { data: seeded } = await anon.from("leaderboard").select("id");
    expect((seeded ?? []).length).toBeGreaterThan(0);

    try {
      await pinTerm(pinned);

      const { data: anonTerm, error } = await anon.rpc("current_term");
      expect(error).toBeNull();
      expect(anonTerm).toBe(pinned);

      // And the view agrees, through the same role.
      //
      // 🔓 Asserted as the board EMPTYING rather than as a term string on a
      // row, and the change is migration 29's. The board is now the pinned
      // term's ROSTER, and nobody is on the roster of a term that has not
      // happened — so if current_term() were still evaluating as the derived
      // term for anon, these rows would still be here. An empty board under a
      // future pin is the assertion.
      const { data: rows, error: viewError } = await anon
        .from("leaderboard")
        .select("id, term");
      expect(viewError).toBeNull();
      expect(rows ?? []).toEqual([]);
    } finally {
      await unpinTerm();
    }

    const { data: restored } = await anon.rpc("current_term");
    expect(restored).toBe(derived);
  });

  it("still denies anon the app_settings row itself", async () => {
    // SECURITY DEFINER exposes exactly one derived string. The alternative fix
    // — an RLS policy on app_settings — would also have handed anon
    // `updated_by` (an officer's uuid) and `updated_at`, because migration 12
    // already grants anon every privilege on every table and only RLS withholds
    // them. That is the whole argument for the narrower fix, so pin it.
    const anon = anonClient();
    const { data } = await anon.from("app_settings").select("*");
    expect(data ?? []).toEqual([]);
  });

  it("moves the ROWS with the pin, not only the label", async () => {
    // The label agreeing with a board that ignored the pin would be worse than
    // no fix at all, so assert the totals actually leave scope.
    const officer = await getTestOfficer(db);
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);
    const event = await createCurrentTermEvent(db, track, { points: 5 });
    await createTestAttendance(db, track, {
      eventId: event.id,
      memberId,
      submittedName: identity.fullName,
      submittedEid: identity.eid,
      submittedEmail: identity.email,
      submittedAt: new Date(),
      status: "present",
    });
    await createTestAdjustment(db, track, {
      memberId,
      points: 3,
      awardedBy: officer,
    });

    const before = await leaderboardRow(memberId);
    expect(before?.total_points).toBe(8);
    expect(before?.term).toBe(event.term);

    const { data: other } = await db.rpc("next_term", { t: event.term });
    try {
      await pinTerm(other!);
      // ⚠️ OFF the board entirely, where before migration 29 they stayed on it
      // at zero. The board is the term's roster now, and doing nothing in a
      // term is precisely what keeps somebody off that term's roster — so the
      // rows leaving scope is visible as an absence rather than as a zero.
      expect(await leaderboardRow(memberId)).toBeNull();
    } finally {
      await unpinTerm();
    }

    const after = await leaderboardRow(memberId);
    expect(after?.total_points).toBe(8);
  });
});

describe("leaderboard contents", () => {
  it("adds attendance and bonus points into one total", async () => {
    const officer = await getTestOfficer(db);
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);
    const event = await createCurrentTermEvent(db, track, { points: 4 });
    await createTestAttendance(db, track, {
      eventId: event.id,
      memberId,
      submittedName: identity.fullName,
      submittedEid: identity.eid,
      submittedEmail: identity.email,
      submittedAt: new Date(),
      status: "present",
    });
    await createTestAdjustment(db, track, {
      memberId,
      points: -1,
      awardedBy: officer,
    });

    const row = await leaderboardRow(memberId);
    // 4 attendance + (-1) bonus. Negative adjustments are legitimate (§4.2),
    // and the public board shows only the sum (§9 #11).
    expect(row?.total_points).toBe(3);
  });

  it("omits somebody off this term's roster, while member_directory keeps them", async () => {
    // §4.4's second surprise, rebuilt on migration 29. `where m.active` used to
    // be the board's only trim and had no counterpart in member_directory; the
    // trim is now the term roster, and it DOES have a counterpart — the same
    // rule, one term over. A member who joined an earlier term and has done
    // nothing since is off the public board and still fully present in the
    // officer directory under the term they joined.
    const identity = testIdentity();
    const priorTerm = new Date();
    priorTerm.setUTCMonth(priorTerm.getUTCMonth() - 8);
    const memberId = await createTestMember(db, track, identity, {
      joinedAt: priorTerm,
    });

    expect(await leaderboardRow(memberId)).toBeNull();

    // 🔓 Not `.maybeSingle()`: the view is one row per (member, term), and the
    // point of this member is that their row is under a term that is not the
    // current one.
    const { data: directory } = await db
      .from("member_directory")
      .select("id, term, total_points")
      .eq("id", memberId);
    expect(directory).toHaveLength(1);
    expect(directory?.[0].total_points).toBe(0);
    expect(directory?.[0].term).not.toBe(await currentTerm());
  });

  it("excludes a cancelled event's points but counts a DRAFT event's", async () => {
    // §4.4's first surprise. The attendance leg filters `status <> 'cancelled'`
    // only, so a draft event's approved attendance moves the PUBLIC board
    // immediately — which is not what "draft" suggests. Both halves are pinned
    // here as behaviour, not endorsed as design: the review screen warns, and
    // changing either one is a §4.4 decision rather than a bug fix.
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);

    const cancelled = await createCurrentTermEvent(db, track, { points: 10 });
    await db.from("events").update({ status: "cancelled" }).eq("id", cancelled.id);
    const draft = await createCurrentTermEvent(db, track, { points: 7 });
    await db.from("events").update({ status: "draft" }).eq("id", draft.id);

    for (const eventId of [cancelled.id, draft.id]) {
      await createTestAttendance(db, track, {
        eventId,
        memberId,
        submittedName: identity.fullName,
        submittedEid: identity.eid,
        submittedEmail: identity.email,
        submittedAt: new Date(),
        status: "present",
      });
    }

    const row = await leaderboardRow(memberId);
    expect(row?.total_points).toBe(7);
  });

  it("ignores a voided adjustment", async () => {
    const officer = await getTestOfficer(db);
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);
    const adjustment = await createTestAdjustment(db, track, {
      memberId,
      points: 9,
      awardedBy: officer,
    });
    expect((await leaderboardRow(memberId))?.total_points).toBe(9);

    await db
      .from("point_adjustments")
      .update({
        voided_at: new Date().toISOString(),
        voided_by: officer,
        void_reason: "TEST void",
      })
      .eq("id", adjustment.id);

    expect((await leaderboardRow(memberId))?.total_points).toBe(0);
  });

  it("ignores attendance that is pending rather than present", async () => {
    // A queued check-in has not been credited yet, and the board must agree
    // with the queue about that — otherwise approving one changes nothing
    // visible and rejecting one silently removes points somebody already saw.
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);
    const event = await createCurrentTermEvent(db, track, { points: 6 });
    await createTestAttendance(db, track, {
      eventId: event.id,
      memberId,
      submittedName: identity.fullName,
      submittedEid: identity.eid,
      submittedEmail: identity.email,
      submittedAt: new Date(),
      status: "pending",
    });

    expect((await leaderboardRow(memberId))?.total_points).toBe(0);
  });

  it("ignores an event outside the current term", async () => {
    // The 2030 slots every other file uses. Scoping is what stops last year's
    // standings leaking into this year's board (§4.4).
    const slot = claimSlot();
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);
    const event = await createTestEvent(db, track, {
      starts: at(slot, 18),
      ends: at(slot, 20),
      points: 50,
    });
    await createTestAttendance(db, track, {
      eventId: event.id,
      memberId,
      submittedName: identity.fullName,
      submittedEid: identity.eid,
      submittedEmail: identity.email,
      submittedAt: at(slot, 19),
      status: "present",
    });

    expect((await leaderboardRow(memberId))?.total_points).toBe(0);
  });
});

describe("leaderboard ordering", () => {
  it("ranks by points descending, then breaks ties alphabetically", async () => {
    // The view carries the ORDER BY and the page does not re-sort, so the
    // ordering is asserted here rather than in a component test.
    const { data, error } = await db
      .from("leaderboard")
      .select("full_name, total_points");
    expect(error).toBeNull();

    const rows = data ?? [];
    expect(rows.length).toBeGreaterThan(1);

    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const curr = rows[i];
      const prevPoints = prev.total_points ?? 0;
      const currPoints = curr.total_points ?? 0;
      expect(prevPoints).toBeGreaterThanOrEqual(currPoints);
      if (prevPoints === currPoints) {
        // Postgres orders text by the database collation; comparing with
        // localeCompare here would be asserting JavaScript's opinion instead.
        expect((prev.full_name ?? "") <= (curr.full_name ?? "")).toBe(true);
      }
    }
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { writeAudit, writeAuditBatch } from "@/app/actions/audit";
import { summarizeGrant } from "@/lib/points";

import {
  cleanup,
  countAuditRows,
  createCurrentTermEvent,
  createTestAdjustment,
  createTestMember,
  getTestOfficer,
  latestAuditRow,
  newTracker,
  testClient,
  testIdentity,
  type Tracker,
} from "./helpers";

// Integration tests for the Stage 5 phase-4 point mutations, against the LOCAL
// stack. The pure half lives in tests/points.test.ts.
//
// As in tests/attendance-review.test.ts, the "use server" exports in
// app/actions/points.ts are not called directly — they need a request context
// for cookies. What is tested here is the database behaviour those actions
// depend on and the exact statement sequences they run, so a change that breaks
// the contract fails here rather than in a browser.
//
// ⚠️ **Every adjustment below must target a tracked member.** cleanup() has no
// point_adjustments pass; it relies on `member_id`'s ON DELETE CASCADE. An
// adjustment written against a seed member survives teardown permanently and
// then skews the leaderboard, the directory, and the ledger in every later run.
// createTestAdjustment() throws rather than let that happen — use it, and where
// a raw insert is needed to exercise a constraint, keep the member tracked.

const db = testClient();
const track: Tracker = newTracker();
let officerId: string;

beforeAll(async () => {
  officerId = await getTestOfficer(db);
});

afterAll(async () => {
  await cleanup(db, track);
});

async function trackedMember(): Promise<string> {
  return createTestMember(db, track, testIdentity());
}

describe("point_adjustments constraints", () => {
  // Each of these is mirrored in pointGrantSchema/pointVoidSchema so the
  // officer gets a sentence rather than a SQLSTATE. These tests are what say
  // the mirror still matches the glass: if a constraint is relaxed or renamed
  // and the schema is not, one of them fails here.

  it("refuses a zero-point adjustment", async () => {
    const memberId = await trackedMember();
    const { error } = await db.from("point_adjustments").insert({
      member_id: memberId,
      points: 0,
      reason: "nothing",
      awarded_by: officerId,
    });
    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("points_check");
  });

  it("refuses a blank reason", async () => {
    const memberId = await trackedMember();
    const { error } = await db.from("point_adjustments").insert({
      member_id: memberId,
      points: 5,
      reason: "   ",
      awarded_by: officerId,
    });
    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("reason_not_blank");
  });

  it("refuses a category outside the list", async () => {
    const memberId = await trackedMember();
    const { error } = await db.from("point_adjustments").insert({
      member_id: memberId,
      points: 5,
      reason: "for services rendered",
      category: "bribery",
      awarded_by: officerId,
    });
    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("category_check");
  });

  it("refuses a bogus member id with 23503, not 23514", async () => {
    // The distinction matters: grantPoints maps 23503 to a "that member is
    // gone" message and treats 23514 as a bug in its own schema mirror.
    const { error } = await db.from("point_adjustments").insert({
      member_id: crypto.randomUUID(),
      points: 5,
      reason: "for a ghost",
      awarded_by: officerId,
    });
    expect(error?.code).toBe("23503");
    expect(error?.message).toContain("member_id");
  });

  it("refuses a void with no reason", async () => {
    const memberId = await trackedMember();
    const created = await createTestAdjustment(db, track, {
      memberId,
      points: 5,
      awardedBy: officerId,
    });

    const { error } = await db
      .from("point_adjustments")
      .update({ voided_at: new Date().toISOString(), voided_by: officerId })
      .eq("id", created.id);

    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("void_requires_reason");
  });

  it("refuses a void reason with no void", async () => {
    // The other half of migration 13's equality-of-nullness form. Without it
    // the constraint would allow a row that reads as voided in the ledger while
    // still counting in the views.
    const memberId = await trackedMember();
    const created = await createTestAdjustment(db, track, {
      memberId,
      points: 5,
      awardedBy: officerId,
    });

    const { error } = await db
      .from("point_adjustments")
      .update({ void_reason: "changed my mind" })
      .eq("id", created.id);

    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("void_requires_reason");
  });

  it("refuses a half-voided row with no voiding officer", async () => {
    const memberId = await trackedMember();
    const created = await createTestAdjustment(db, track, {
      memberId,
      points: 5,
      awardedBy: officerId,
    });

    const { error } = await db
      .from("point_adjustments")
      .update({
        voided_at: new Date().toISOString(),
        void_reason: "duplicate grant",
      })
      .eq("id", created.id);

    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("void_is_complete");
  });

  it("refuses a blank void reason", async () => {
    const memberId = await trackedMember();
    const created = await createTestAdjustment(db, track, {
      memberId,
      points: 5,
      awardedBy: officerId,
    });

    const { error } = await db
      .from("point_adjustments")
      .update({
        voided_at: new Date().toISOString(),
        voided_by: officerId,
        void_reason: "  ",
      })
      .eq("id", created.id);

    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("void_reason_not_blank");
  });
});

describe("the term is the database's to set", () => {
  it("defaults term to current_term() when the insert omits it", async () => {
    // The regression guard for grantPoints' select-only design: `term` appears
    // in the .select() list and never in the insert payload. Both values here
    // come from the database — §4.7 forbids typing a term string anywhere.
    const memberId = await trackedMember();
    const created = await createTestAdjustment(db, track, {
      memberId,
      points: 3,
      awardedBy: officerId,
    });

    const { data: currentTerm, error } = await db.rpc("current_term");
    expect(error).toBeNull();
    expect(created.term).toBe(currentTerm);
  });
});

describe("a grant is one atomic insert", () => {
  it("writes nothing at all when one member id is bad", async () => {
    // The deliberate asymmetry with bulkAssignEvent, which reports partial
    // success. A partial grant credits some members and silently omits others,
    // and unlike a skipped bulk assign there is no queue for anyone to notice
    // it in — so a bad id costs the whole grant.
    const first = await trackedMember();
    const second = await trackedMember();

    const { error } = await db.from("point_adjustments").insert([
      {
        member_id: first,
        points: 5,
        reason: "staffed the info booth",
        awarded_by: officerId,
      },
      {
        member_id: second,
        points: 5,
        reason: "staffed the info booth",
        awarded_by: officerId,
      },
      {
        member_id: crypto.randomUUID(),
        points: 5,
        reason: "staffed the info booth",
        awarded_by: officerId,
      },
    ]);

    expect(error?.code).toBe("23503");

    const { count } = await db
      .from("point_adjustments")
      .select("id", { count: "exact", head: true })
      .in("member_id", [first, second]);
    expect(count).toBe(0);
  });

  it("writes every row and reads the term back in one statement", async () => {
    const first = await trackedMember();
    const second = await trackedMember();

    const { data, error } = await db
      .from("point_adjustments")
      .insert(
        [first, second].map((memberId) => ({
          member_id: memberId,
          points: 5,
          reason: "staffed the info booth",
          category: "recruitment",
          awarded_by: officerId,
        }))
      )
      .select("id, member_id, points, term");

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    const { data: currentTerm } = await db.rpc("current_term");
    for (const row of data!) expect(row.term).toBe(currentTerm);
  });
});

describe("granting and voiding move the leaderboard", () => {
  it("adds, subtracts, and stops counting on void", async () => {
    const memberId = await trackedMember();
    expect(await leaderboardTotal(memberId)).toBe(0);

    const bonus = await createTestAdjustment(db, track, {
      memberId,
      points: 5,
      awardedBy: officerId,
      reason: "ran the info booth",
      category: "recruitment",
    });
    expect(await leaderboardTotal(memberId)).toBe(5);

    // Negative adjustments are first-class — one mechanism covers bonuses,
    // penalties, and corrections (§4.2).
    await createTestAdjustment(db, track, {
      memberId,
      points: -2,
      awardedBy: officerId,
      reason: "double-counted earlier",
      category: "correction",
    });
    expect(await leaderboardTotal(memberId)).toBe(3);

    // The exact statement voidAdjustment runs.
    const { data: after, error } = await db
      .from("point_adjustments")
      .update({
        voided_at: new Date().toISOString(),
        voided_by: officerId,
        void_reason: "granted to the wrong person",
      })
      .eq("id", bonus.id)
      .is("voided_at", null)
      .select("id, voided_at")
      .maybeSingle();

    expect(error).toBeNull();
    expect(after?.voided_at).not.toBeNull();

    // Nothing application-side maintains this: both views filter
    // `voided_at is null`, so the points stop counting the instant the update
    // lands.
    expect(await leaderboardTotal(memberId)).toBe(-2);
  });

  it("keeps attendance points and bonus points separate in the directory", async () => {
    // §4.4's deliberate asymmetry: the public board shows one total, the
    // officer-facing directory keeps the split. Collapsing the directory
    // columns to match the board is the "fix" this test exists to fail.
    const memberId = await trackedMember();
    const event = await createCurrentTermEvent(db, track, { points: 2 });

    const { error: attendanceError } = await db.from("attendance").insert({
      event_id: event.id,
      member_id: memberId,
      submitted_name: "Test Person",
      submitted_student_id: `T3-${Date.now() % 1_000_000}`,
      submitted_email: "test.person@example.edu",
      submitted_at: new Date().toISOString(),
      status: "present",
      source: "admin_manual",
    });
    expect(attendanceError).toBeNull();

    await createTestAdjustment(db, track, {
      memberId,
      points: 3,
      awardedBy: officerId,
      reason: "volunteered at the food drive",
      category: "volunteer",
    });

    const { data: directory, error } = await db
      .from("member_directory")
      .select("attendance_points, bonus_points, total_points")
      .eq("id", memberId)
      .maybeSingle();

    expect(error).toBeNull();
    expect(directory?.attendance_points).toBe(2);
    expect(directory?.bonus_points).toBe(3);
    expect(directory?.total_points).toBe(5);

    // The public board adds them silently (§9 #11).
    expect(await leaderboardTotal(memberId)).toBe(5);
  });
});

describe("the void guard", () => {
  it("returns zero rows and no error on a second void", async () => {
    // This is what makes `if (!after) return { status: "already_voided" }`
    // correct rather than accidental. maybeSingle() must report the miss as
    // data === null with error === null — if it errored instead, the action
    // would tell the officer something went wrong when in fact a colleague
    // simply got there first.
    const memberId = await trackedMember();
    const created = await createTestAdjustment(db, track, {
      memberId,
      points: 5,
      awardedBy: officerId,
    });

    const first = await voidOnce(created.id, "granted twice by mistake");
    expect(first.error).toBeNull();
    expect(first.data?.voided_at).not.toBeNull();

    const second = await voidOnce(created.id, "trying again from a stale tab");
    expect(second.error).toBeNull();
    expect(second.data).toBeNull();

    // And the first void's reason survived — the second attempt overwrote
    // nothing, which is the point of scoping on `voided_at is null`.
    const { data } = await db
      .from("point_adjustments")
      .select("void_reason")
      .eq("id", created.id)
      .single();
    expect(data?.void_reason).toBe("granted twice by mistake");
  });
});

describe("audit rows", () => {
  it("writes one points.granted row per adjustment, sharing a batch note", async () => {
    const first = await trackedMember();
    const second = await trackedMember();

    const { data: created } = await db
      .from("point_adjustments")
      .insert(
        [first, second].map((memberId) => ({
          member_id: memberId,
          points: 5,
          reason: "staffed the info booth",
          awarded_by: officerId,
        }))
      )
      .select("id, member_id, points, term");

    const note = summarizeGrant(created!.length, 5);
    await writeAuditBatch(
      db,
      created!.map((row) => ({
        entityType: "point_adjustment" as const,
        entityId: row.id,
        actorId: officerId,
        action: "points.granted" as const,
        after: row,
        note,
      }))
    );

    for (const row of created!) {
      expect(await countAuditRows(db, "point_adjustment", row.id)).toBe(1);
      const latest = await latestAuditRow(db, "point_adjustment", row.id);
      expect(latest?.action).toBe("points.granted");
      expect(latest?.actor_id).toBe(officerId);
      expect(latest?.note).toBe("+5 points to 2 members");
    }
  });

  it("writes a points.voided row carrying the before/after of the void", async () => {
    const memberId = await trackedMember();
    const created = await createTestAdjustment(db, track, {
      memberId,
      points: 5,
      awardedBy: officerId,
    });

    const { data: before } = await db
      .from("point_adjustments")
      .select("id, points, voided_at, void_reason")
      .eq("id", created.id)
      .single();

    const voided = await voidOnce(created.id, "wrong member");

    await writeAudit(db, {
      entityType: "point_adjustment",
      entityId: created.id,
      actorId: officerId,
      action: "points.voided",
      before,
      after: voided.data,
    });

    expect(await countAuditRows(db, "point_adjustment", created.id)).toBe(1);
    const latest = await latestAuditRow(db, "point_adjustment", created.id);
    expect(latest?.action).toBe("points.voided");
    expect(
      (latest?.before as { voided_at: string | null } | null)?.voided_at
    ).toBeNull();
    expect(
      (latest?.after as { voided_at: string | null } | null)?.voided_at
    ).not.toBeNull();
  });
});

/** The exact update voidAdjustment runs, including the guard. */
async function voidOnce(id: string, reason: string) {
  return db
    .from("point_adjustments")
    .update({
      voided_at: new Date().toISOString(),
      voided_by: officerId,
      void_reason: reason,
    })
    .eq("id", id)
    .is("voided_at", null)
    .select("id, member_id, points, term, voided_at, voided_by, void_reason")
    .maybeSingle();
}

async function leaderboardTotal(memberId: string): Promise<number> {
  const { data, error } = await db
    .from("leaderboard")
    .select("total_points")
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw new Error(`leaderboard read failed: ${error.message}`);
  return data?.total_points ?? 0;
}

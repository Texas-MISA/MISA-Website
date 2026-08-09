import { readFileSync } from "node:fs";

import { afterAll, describe, expect, it } from "vitest";

import { checkRateLimit, RATE_LIMIT_MAX } from "@/lib/checkin";
import { LOOKUP_RATE_LIMIT_MAX, lookupMemberHistory } from "@/lib/lookup";

import {
  createCurrentTermEvent,
  createTestAdjustment,
  createTestAttendance,
  createTestMember,
  getTestOfficer,
  newTracker,
  testClient,
  testIdentity,
} from "./helpers";

// /lookup (§7 Stage 7 phase 2). Integration against the local stack: the whole
// point of the load-bearing cases is what a specific QUERY returns, which a
// fake cannot model.

const db = testClient();
const track = newTracker();
const now = new Date();

afterAll(async () => {
  const { cleanup } = await import("./helpers");
  await cleanup(db, track);
});

async function counts() {
  const [members, attendance, adjustments] = await Promise.all([
    db.from("members").select("id", { count: "exact", head: true }),
    db.from("attendance").select("id", { count: "exact", head: true }),
    db.from("point_adjustments").select("id", { count: "exact", head: true }),
  ]);
  return {
    members: members.count ?? -1,
    attendance: attendance.count ?? -1,
    adjustments: adjustments.count ?? -1,
  };
}

describe("the EID + email gate", () => {
  // 🔓 These four are the reason this file exists. /attend's findMember is an
  // ordered FALLBACK — normalized_eid, then lower(email) — because a check-in
  // must recognise someone who fat-fingers one field. Reproducing that shape
  // here would mean an EID alone opens the page, and the EID-alone gate is
  // exactly the one §6 says is NOT sufficient to reveal dues status. Without
  // the two mismatch cases below, a refactor to the fallback shape would pass
  // every other test in this file.

  it("refuses a real EID with the wrong email", async () => {
    const identity = testIdentity();
    await createTestMember(db, track, identity);

    const result = await lookupMemberHistory(
      db,
      { eid: identity.eid, email: "someone.else@example.edu" },
      now
    );
    expect(result.status).toBe("unmatched");
  });

  it("refuses a real email with the wrong EID", async () => {
    const identity = testIdentity();
    await createTestMember(db, track, identity);

    const result = await lookupMemberHistory(
      db,
      { eid: "t3qnobody999", email: identity.email },
      now
    );
    expect(result.status).toBe("unmatched");
  });

  it("refuses two halves belonging to two different members", async () => {
    // The sharpest version: both values are real and on the roster, and they
    // are not the same person. An `.or()` would let this through.
    const a = testIdentity();
    const b = testIdentity();
    await createTestMember(db, track, a);
    await createTestMember(db, track, b);

    const result = await lookupMemberHistory(
      db,
      { eid: a.eid, email: b.email },
      now
    );
    expect(result.status).toBe("unmatched");
  });

  it("matches when both halves name the same member", async () => {
    const identity = testIdentity();
    await createTestMember(db, track, identity);

    const result = await lookupMemberHistory(db, identity, now);
    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.profile.fullName).toBe(identity.fullName);
  });

  it("folds case and stray whitespace on both halves", async () => {
    // normalizeEid strips spaces and hyphens and lowercases; the email compare
    // is a case-insensitive equality via ilike. People paste from badges.
    const identity = testIdentity();
    await createTestMember(db, track, identity);

    const result = await lookupMemberHistory(
      db,
      {
        eid: ` ${identity.eid.toUpperCase()} `,
        email: identity.email.toUpperCase(),
      },
      now
    );
    expect(result.status).toBe("found");
  });

  it("treats an email wildcard as a literal, not a pattern", async () => {
    // escapeIlike is what keeps `.ilike()` an equality test. Without it a
    // single `%` would match half the roster — a wildcard past half the gate.
    const identity = testIdentity();
    await createTestMember(db, track, identity);

    const result = await lookupMemberHistory(
      db,
      { eid: identity.eid, email: "%@example.edu" },
      now
    );
    expect(result.status).toBe("unmatched");
  });

  it("lets a DEACTIVATED member look themselves up", async () => {
    // member_directory has no `active` filter, unlike leaderboard. Somebody
    // switched off the roster is exactly who needs to see their own record —
    // and telling them "we can't match that" would be false.
    const identity = testIdentity();
    await createTestMember(db, track, identity, { active: false });

    const result = await lookupMemberHistory(db, identity, now);
    expect(result.status).toBe("found");

    const { data: board } = await db
      .from("leaderboard")
      .select("id")
      .eq("full_name", identity.fullName);
    expect(board ?? []).toEqual([]);
  });

  it("writes nothing, on a hit or a miss", async () => {
    // A test asserting only the returned status would pass while the roster
    // quietly grew — the same assertion docs/attend-confirmation-flow.md calls
    // the one that matters most. /lookup must never create a member, and it is
    // structurally incapable of it (no insert anywhere on the path), so this
    // pins the structure rather than a branch.
    const identity = testIdentity();
    await createTestMember(db, track, identity);

    const before = await counts();
    await lookupMemberHistory(db, identity, now);
    await lookupMemberHistory(
      db,
      { eid: "t3qghost404", email: "nobody@example.edu" },
      now
    );
    expect(await counts()).toEqual(before);
  });
});

describe("what a member sees", () => {
  it("splits attendance and bonus points, and shows the reason", async () => {
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
      points: 3,
      awardedBy: officer,
      reason: "TEST ran the info booth",
    });

    const result = await lookupMemberHistory(db, identity, now);
    expect(result.status).toBe("found");
    if (result.status !== "found") return;

    const p = result.profile;
    expect(p.attendancePoints).toBe(4);
    expect(p.bonusPoints).toBe(3);
    expect(p.totalPoints).toBe(7);
    // The public board is a single number (§9 #11); this page is the only
    // place a member can see WHY their total exceeds their attendance.
    expect(p.adjustments).toHaveLength(1);
    expect(p.adjustments[0].reason).toBe("TEST ran the info booth");
    expect(p.adjustments[0].points).toBe("+3");
  });

  it("hides a voided adjustment", async () => {
    const officer = await getTestOfficer(db);
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);
    const adjustment = await createTestAdjustment(db, track, {
      memberId,
      points: 5,
      awardedBy: officer,
      reason: "TEST later voided",
    });
    await db
      .from("point_adjustments")
      .update({
        voided_at: new Date().toISOString(),
        voided_by: officer,
        void_reason: "TEST void",
      })
      .eq("id", adjustment.id);

    const result = await lookupMemberHistory(db, identity, now);
    if (result.status !== "found") throw new Error("expected a match");
    expect(result.profile.adjustments).toHaveLength(0);
    expect(result.profile.bonusPoints).toBe(0);
  });

  it("never returns an officer id with an adjustment", async () => {
    // An officer's uuid has no place in an unauthenticated response, and the
    // member's question is "why", not "who".
    const officer = await getTestOfficer(db);
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);
    await createTestAdjustment(db, track, {
      memberId,
      points: 2,
      awardedBy: officer,
      reason: "TEST attribution check",
    });

    const result = await lookupMemberHistory(db, identity, now);
    if (result.status !== "found") throw new Error("expected a match");
    const serialized = JSON.stringify(result.profile);
    expect(serialized).not.toContain(officer);
  });

  it("returns no identifier the caller did not supply", async () => {
    // §6: "emails and EIDs never returned to unauthenticated clients under any
    // route." The name is returned deliberately (that is what the double gate
    // buys); the stored email and EID are not, so the sentence stays true by
    // construction rather than by argument.
    const identity = testIdentity();
    await createTestMember(db, track, identity);

    const result = await lookupMemberHistory(db, identity, now);
    if (result.status !== "found") throw new Error("expected a match");
    const serialized = JSON.stringify(result.profile);
    expect(serialized).not.toContain(identity.eid);
    expect(serialized).not.toContain(identity.email);
    expect(serialized).toContain(identity.fullName);
  });

  it("shows a pending ORPHAN, which carries no event", async () => {
    // The case a member actually worries about: they checked in, no window was
    // open, and nothing visible happened. Silence here is what §4.2 exists to
    // prevent — and an orphan has event_id null, so it is the row a naive
    // "join to events" would drop.
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);
    await createTestAttendance(db, track, {
      eventId: null,
      memberId,
      submittedName: identity.fullName,
      submittedEid: identity.eid,
      submittedEmail: identity.email,
      submittedAt: new Date(),
      status: "pending",
    });

    const result = await lookupMemberHistory(db, identity, now);
    if (result.status !== "found") throw new Error("expected a match");
    expect(result.profile.pending).toHaveLength(1);
    expect(result.profile.pending[0].eventTitle).toBeNull();
    // Pending is never counted as points.
    expect(result.profile.totalPoints).toBe(0);
  });

  it("names the event on a pending row that has one", async () => {
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);
    const event = await createCurrentTermEvent(db, track, { points: 1 });
    await createTestAttendance(db, track, {
      eventId: event.id,
      memberId,
      submittedName: identity.fullName,
      submittedEid: identity.eid,
      submittedEmail: identity.email,
      submittedAt: new Date(),
      status: "pending",
    });

    const result = await lookupMemberHistory(db, identity, now);
    if (result.status !== "found") throw new Error("expected a match");
    expect(result.profile.pending[0].eventTitle).toBe(event.title);
  });

  it("classifies the term's events as attended, missed or upcoming", async () => {
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);
    const attended = await createCurrentTermEvent(db, track, { points: 1 });
    await createTestAttendance(db, track, {
      eventId: attended.id,
      memberId,
      submittedName: identity.fullName,
      submittedEid: identity.eid,
      submittedEmail: identity.email,
      submittedAt: new Date(),
      status: "present",
    });

    const result = await lookupMemberHistory(db, identity, now);
    if (result.status !== "found") throw new Error("expected a match");

    const row = result.profile.events.find((e) => e.id === attended.id);
    expect(row?.state).toBe("attended");
    // The seed's own current-term events are in here too, so assert the shape
    // rather than exact counts: every event is in exactly one of three states,
    // and an event that has not ended is never a miss.
    expect(
      result.profile.attended +
        result.profile.missed +
        result.profile.upcoming
    ).toBe(result.profile.events.length);
    for (const event of result.profile.events) {
      expect(["attended", "missed", "upcoming"]).toContain(event.state);
    }
  });

  it("reports dues status and what the payments cover", async () => {
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);

    const before = await lookupMemberHistory(db, identity, now);
    if (before.status !== "found") throw new Error("expected a match");
    expect(before.profile.duesPaidCurrentTerm).toBe(false);
    expect(before.profile.paidThrough).toBeNull();

    const officer = await getTestOfficer(db);
    const { data: term } = await db.rpc("current_term");
    const { error } = await db.from("dues_payments").insert({
      member_id: memberId,
      // The dedupe key is Venmo's transaction ID — a content fingerprint is
      // explicitly not an acceptable substitute (§4.1 / the dues spec).
      venmo_txn_id: `TEST-${crypto.randomUUID()}`,
      import_batch_id: crypto.randomUUID(),
      imported_by: officer,
      paid_at: new Date().toISOString(),
      amount_cents: 3000,
      // Explicit, never left to the column default: that default is
      // term_of(now()) at IMPORT time, which is a different question from the
      // term the payment belongs to (the phase-2 walkthrough defect).
      start_term: term!,
      terms_covered: 1,
    });
    if (error) throw new Error(`dues fixture failed: ${error.message}`);

    const after = await lookupMemberHistory(db, identity, now);
    if (after.status !== "found") throw new Error("expected a match");
    expect(after.profile.duesPaidCurrentTerm).toBe(true);
    // 🪤 Through the term index, never max(term).
    expect(after.profile.paidThrough).toBe(term);

    // dues_payments.member_id is ON DELETE RESTRICT, so cleanup() cannot remove
    // the member while this row exists — delete it here rather than leaving
    // teardown to fail silently and strand a fixture member on the roster.
    await db.from("dues_payments").delete().eq("member_id", memberId);
  });

  it("renders every date as a preformatted string", async () => {
    // The profile crosses into a Client Component as action state, so any Date
    // or raw timestamp here would be formatted on both sides of hydration —
    // Node and Chrome disagree about the space before "PM".
    const officer = await getTestOfficer(db);
    const identity = testIdentity();
    const memberId = await createTestMember(db, track, identity);
    await createTestAdjustment(db, track, {
      memberId,
      points: 1,
      awardedBy: officer,
    });
    await createTestAttendance(db, track, {
      eventId: null,
      memberId,
      submittedName: identity.fullName,
      submittedEid: identity.eid,
      submittedEmail: identity.email,
      submittedAt: new Date(),
      status: "pending",
    });

    const result = await lookupMemberHistory(db, identity, now);
    if (result.status !== "found") throw new Error("expected a match");
    for (const row of result.profile.adjustments) {
      expect(typeof row.awarded).toBe("string");
      expect(row.awarded).not.toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
    for (const row of result.profile.pending) {
      expect(row.submitted).toMatch(/ CT$/);
    }
    for (const row of result.profile.events) {
      expect(row.when).not.toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
});

describe("the throttle", () => {
  it("uses a bucket disjoint from check-in's", async () => {
    // 🔓 RATE_LIMIT_MAX is a ROOM CAPACITY — a venue's NAT puts a whole meeting
    // behind one address. If lookups and check-ins shared a bucket, members
    // checking their standing at an event could exhaust the slots the people
    // behind them need to check in with, and the check-in is the one that must
    // not fail. Same table, different keys.
    const suffix = crypto.randomUUID();
    const lookupHash = `test-lookup-${suffix}`;
    const checkinHash = `test-checkin-${suffix}`;

    for (let i = 0; i < LOOKUP_RATE_LIMIT_MAX; i++) {
      expect(await checkRateLimit(db, lookupHash, now, LOOKUP_RATE_LIMIT_MAX)).toBe(
        "ok"
      );
    }
    expect(
      await checkRateLimit(db, lookupHash, now, LOOKUP_RATE_LIMIT_MAX)
    ).toBe("limited");

    // The check-in bucket is untouched by all of that.
    expect(await checkRateLimit(db, checkinHash, now)).toBe("ok");

    await db
      .from("checkin_throttle")
      .delete()
      .in("ip_hash", [lookupHash, checkinHash]);
  });

  it("is a lower ceiling than check-in's, and both are still room-sized", async () => {
    expect(LOOKUP_RATE_LIMIT_MAX).toBeLessThan(RATE_LIMIT_MAX);
    // Not a token gesture: a shared campus IP has to fit several members
    // trying a couple of times each.
    expect(LOOKUP_RATE_LIMIT_MAX).toBeGreaterThanOrEqual(20);
  });
});

describe("source assertions", () => {
  // Behavioural tests cannot reach these: vitest runs `environment: "node"`,
  // so there is no DOM, and the properties are about the SHAPE of the code.

  it("resolves the member in one query carrying both predicates", () => {
    const source = readFileSync(
      new URL("../lib/lookup.ts", import.meta.url),
      "utf8"
    );
    const fn = source.slice(source.indexOf("async function findMemberByBoth"));
    const body = fn.slice(0, fn.indexOf("\n}"));

    // One .from("members"), both predicates on it, and no .or() — which is the
    // shape a well-meaning "make it more forgiving, like /attend" edit takes.
    expect(body.match(/\.from\("members"\)/g)).toHaveLength(1);
    expect(body).toContain('.eq("normalized_eid"');
    expect(body).toContain('.ilike("email"');
    expect(body).not.toContain(".or(");
  });

  it("keeps app/actions/lookup.ts to a single export", () => {
    // §6: "what can an anonymous user POST to" stays a one-file, one-symbol
    // answer. Every export of a "use server" module is a public endpoint.
    const source = readFileSync(
      new URL("../app/actions/lookup.ts", import.meta.url),
      "utf8"
    );
    const exported = [...source.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)].map(
      (m) => m[1]
    );
    expect(exported).toEqual(["lookupMember"]);
  });

  it("drives every field from server-echoed state, never undefined", () => {
    // React 19 resets an uncontrolled <form action> once the action resolves.
    // A nullish defaultValue following a non-nullish one makes React drop the
    // value attribute, and the reset then clears the field the member is
    // trying to correct.
    const source = readFileSync(
      new URL("../app/(public)/lookup/_components/lookup-form.tsx", import.meta.url),
      "utf8"
    );
    expect(source).toContain("state.submitted ?? EMPTY");
    expect(source).toContain("defaultValue={submitted.eid}");
    expect(source).toContain("defaultValue={submitted.email}");
    // The reset button carries name/value directly. The JSX attribute
    // `formAction=` would make React drop the submitter's name from the
    // FormData pre-hydration, so `step` would arrive on a slow phone and
    // vanish once hydrated. Matched as an attribute, not as a bare word — the
    // word appears in the comment explaining the rule.
    expect(source).not.toMatch(/formAction\s*=/);
  });

  it("carries robots noindex on both member-facing pages", () => {
    // 🔓 Not recoverable after the fact — a search cache outlives the deploy
    // that filled it (§9 #1).
    for (const page of ["../app/(public)/leaderboard/page.tsx", "../app/(public)/lookup/page.tsx"]) {
      const source = readFileSync(new URL(page, import.meta.url), "utf8");
      expect(source).toContain("robots: { index: false, follow: false }");
    }
  });
});

import { afterAll, describe, expect, it } from "vitest";

import { cleanup, newTracker, testClient, testIdentity } from "./helpers";

// The constraints migration 22 added (Stage 8 phase 1) — the "Data Integrity"
// half of the stage.
//
// 📌 Why these exist at all. lib/validation.ts:363-366 states the house rule:
// "Every rule below is also a constraint in migration 18 — deliberately, not
// redundantly." It was applied to the two newest tables and never applied
// backwards, so six older tables accepted data no screen can produce and some
// screen would then misread. Each case below was confirmed to REFUSE only
// after the migration; before it, every one inserted cleanly.
//
// Asserted by SQLSTATE, the way Stage 1's exit criteria were: 23514 is a check
// violation, and anything else means the row was refused for the wrong reason.

const db = testClient();
const track = newTracker();

afterAll(async () => {
  await cleanup(db, track);
});

const OFFICER = "00000000-0000-4000-8000-5eed00000001";
const CHECK_VIOLATION = "23514";

describe("EID must survive normalization", () => {
  // 🪤 The sharpest gap of the set. members_eid_not_blank only checked
  // `length(trim(eid)) > 0`, which '-' passes — and '-' normalizes to the empty
  // string. The FIRST such member takes '' in members_normalized_eid, and every
  // one after collides into that single phantom identity. Three characters
  // because the shortest real UT EIDs are three (lib/validation.ts:40-45).

  it.each([
    ["a bare hyphen", "-"],
    ["whitespace and hyphens", "  -  "],
    ["two characters", "ab"],
  ])("refuses a members row whose EID folds to <3 chars: %s", async (_l, eid) => {
    const identity = testIdentity();
    const { error } = await db
      .from("members")
      .insert({ eid, full_name: identity.fullName, email: identity.email });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("refuses the same on attendance.submitted_eid", async () => {
    const identity = testIdentity();
    const { error } = await db.from("attendance").insert({
      submitted_name: identity.fullName,
      submitted_eid: " - ",
      submitted_email: identity.email,
    });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("still accepts a real three-character EID", async () => {
    // The bound is a floor, not a fence around the seeded format.
    const identity = testIdentity();
    const id = await db
      .from("members")
      .insert({ eid: "ab1", full_name: identity.fullName, email: identity.email })
      .select("id")
      .single();
    expect(id.error).toBeNull();
    if (id.data) track.memberIds.push(id.data.id);
  });
});

describe("events cannot carry values the views would misread", () => {
  const window = () => {
    const starts = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000);
    return {
      starts_at: starts.toISOString(),
      ends_at: new Date(starts.getTime() + 3600_000).toISOString(),
    };
  };

  it("refuses negative points, which would make public standings negative", async () => {
    // Both leaderboard and member_directory compute sum(e.points).
    const { error } = await db
      .from("events")
      .insert({ title: "TEST negative", ...window(), points: -5 });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("refuses points above the form's own maximum", async () => {
    const { error } = await db
      .from("events")
      .insert({ title: "TEST huge", ...window(), points: 101 });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("refuses a category no screen can render", async () => {
    // point_adjustments.category has had a DB enum since migration 5;
    // events.category never did. Pure asymmetry, now closed.
    const { error } = await db
      .from("events")
      .insert({ title: "TEST cat", ...window(), category: "not_a_category" });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("refuses a title past the length the form allows", async () => {
    const { error } = await db
      .from("events")
      .insert({ title: "x".repeat(201), ...window() });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });
});

describe("a resolution names an officer or does not exist", () => {
  it("refuses resolved_at without resolved_by", async () => {
    // point_adjustments.void_is_complete and dues_void_is_complete already
    // enforced their pairs; attendance had no analogue, so the queue could show
    // a resolution nobody owned.
    const identity = testIdentity();
    const { error } = await db.from("attendance").insert({
      submitted_name: identity.fullName,
      submitted_eid: identity.eid,
      submitted_email: identity.email,
      resolved_at: new Date().toISOString(),
    });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("still accepts a self-check-in, which resolves with no officer", async () => {
    // ⚠️ The case that would have made this constraint a check-in outage.
    // A `present` row written by lib/checkin.ts leaves BOTH columns null — it
    // is auto-resolved against an open window with no human involved. The
    // constraint is about the PAIR, never about status.
    const identity = testIdentity();
    const { data, error } = await db
      .from("attendance")
      .insert({
        submitted_name: identity.fullName,
        submitted_eid: identity.eid,
        submitted_email: identity.email,
        status: "pending",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    if (data) track.attendanceIds.push(data.id);
  });
});

describe("a stored term is a real term", () => {
  // 🪤 The instructive one. The obvious constraint —
  // `term_index(term) is not null` — does NOT work, and finding out why is the
  // point: term_index is not a validator.
  //
  //   term_index('Autumn 2026') = 4052
  //   term_index('Spring 2026') = 4052   ← identical
  //
  // Its season arm is `case when split_part(t,' ',1) = 'Fall' then 1 else 0
  // end`, so anything that is not literally 'Fall' is filed as Spring. It never
  // returns null for a bad season; it returns a plausible wrong answer, which
  // is the lexicographic-trap family in a new place. Hence a shape check.

  it("proves term_index cannot tell Autumn from Spring", async () => {
    // Pinned so nobody 'simplifies' the constraint back to a null test.
    const autumn = await db.rpc("term_index", { t: "Autumn 2026" });
    const spring = await db.rpc("term_index", { t: "Spring 2026" });
    expect(autumn.data).toBe(spring.data);
    expect(autumn.data).not.toBeNull();
  });

  it.each([["Autumn 2026"], ["garbage"], ["fall 2026"], ["Fall 26"]])(
    "refuses a point adjustment in term %s",
    async (term) => {
      const identity = testIdentity();
      const memberId = await db
        .from("members")
        .insert({
          eid: identity.eid,
          full_name: identity.fullName,
          email: identity.email,
        })
        .select("id")
        .single();
      if (memberId.data) track.memberIds.push(memberId.data.id);

      const { error } = await db.from("point_adjustments").insert({
        member_id: memberId.data!.id,
        points: 1,
        reason: "TEST term shape",
        awarded_by: OFFICER,
        term,
      });
      expect(error?.code).toBe(CHECK_VIOLATION);
    }
  );

  it("refuses a dues payment with a malformed start_term", async () => {
    const { error } = await db.from("dues_payments").insert({
      venmo_txn_id: `TEST-${crypto.randomUUID()}`,
      import_batch_id: crypto.randomUUID(),
      imported_by: OFFICER,
      paid_at: new Date().toISOString(),
      amount_cents: 3000,
      start_term: "Autumn 2026",
    });
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it("still accepts the terms the database itself produces", async () => {
    // term_of() and current_term() are the only writers of a term in the app
    // (§4.7 — never type a term string), so the constraint must accept exactly
    // what they emit. Asking the database rather than typing 'Fall 2026' here.
    const { data: current } = await db.rpc("current_term");
    const identity = testIdentity();
    const memberId = await db
      .from("members")
      .insert({
        eid: identity.eid,
        full_name: identity.fullName,
        email: identity.email,
      })
      .select("id")
      .single();
    if (memberId.data) track.memberIds.push(memberId.data.id);

    const { error } = await db.from("point_adjustments").insert({
      member_id: memberId.data!.id,
      points: 1,
      reason: "TEST valid term",
      awarded_by: OFFICER,
      term: current!,
    });
    expect(error).toBeNull();
  });
});

describe("the append-only log cannot be truncated", () => {
  // 🔓 The verb RLS cannot restrain. RLS covers SELECT/INSERT/UPDATE/DELETE
  // only, and the existing append-only triggers are BEFORE UPDATE and BEFORE
  // DELETE — so TRUNCATE slipped past both, while migration 12's `grant all`
  // handed it to anon. Migration 22 revoked the privilege AND added a
  // statement-level trigger, because a grant can be re-widened by a later
  // migration and a trigger has to be dropped on purpose.
  it("refuses TRUNCATE even as the table owner", async () => {
    // Not reachable through PostgREST at all, so this goes straight to Postgres
    // as `postgres` — the role that CAN disable the row-level triggers, and
    // therefore the strongest statement available.
    //
    // ⚠️ psql exits non-zero on a raised exception, so execSync THROWS rather
    // than returning; the output is on the error. Reading only the return value
    // made this test fail while the trigger was working perfectly.
    const { execSync } = await import("node:child_process");
    const run = () =>
      execSync(
        'docker exec -i supabase_db_MISA-Website psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "truncate public.admin_audit;"',
        { encoding: "utf8", stdio: "pipe" }
      );

    let output = "";
    try {
      output = run();
    } catch (e) {
      const err = e as { stderr?: string; stdout?: string };
      output = `${err.stderr ?? ""}${err.stdout ?? ""}`;
    }

    expect(output).toContain("append-only");
    expect(output).not.toContain("TRUNCATE TABLE");

    // And the log is still there. The assertion that actually matters.
    const { count } = await db
      .from("admin_audit")
      .select("*", { count: "exact", head: true });
    expect(count ?? 0).toBeGreaterThan(0);
  });
});

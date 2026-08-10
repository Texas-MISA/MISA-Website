import { describe, expect, it } from "vitest";

import { signInAsOfficer, signInAsOutsider, testClient } from "./helpers";

// 🔓 What a SIGNED-IN NON-OFFICER can reach (Stage 8 phase 1).
//
// The gap this file exists for: every claim in §6 about what is protected has
// been checked with the anon key, and `authenticated` is a different role with
// different grants. tests/security.test.ts said so in prose for two stages
// while `member_directory` — every member's name, EID and email — was granted
// to exactly that role.
//
// And `authenticated` is not a small set of people. Measured against the
// production project on 2026-08-09 via the public /auth/v1/settings endpoint:
// `disable_signup: false`. Anyone can sign up, confirm an email they control,
// and hold this role. `lib/auth.ts` is what separates an officer from them, and
// `lib/auth.ts` is application code — PostgREST never runs it.
//
// The fixture deliberately has no admin_profiles row. That absence IS the test.

const db = testClient();

describe("a signed-in non-officer", () => {
  it("cannot read member_directory", async () => {
    // 🪤 The whole reason this file was written. Before migration 22 this
    // assertion FAILED — the view was granted to `authenticated`, runs
    // security_invoker off, and therefore aggregates past the deny-all base
    // tables for anyone holding any user JWT. Confirmed against the local
    // stack before the fix, then inverted here.
    const outsider = await signInAsOutsider(db);
    const { data, error } = await outsider
      .from("member_directory")
      .select("eid, email")
      .limit(1);

    // Both halves. The seed guarantees the view is non-empty, so "no rows"
    // cannot be an accident of there being no data.
    expect(error).not.toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("cannot read the members table directly", async () => {
    const outsider = await signInAsOutsider(db);
    const { data } = await outsider.from("members").select("eid, email").limit(1);
    expect(data ?? []).toEqual([]);
  });

  it("cannot read dues_payments", async () => {
    // §6 weights this above the roster: it is the only table carrying
    // financial information.
    const outsider = await signInAsOutsider(db);
    const { data } = await outsider.from("dues_payments").select("id").limit(1);
    expect(data ?? []).toEqual([]);
  });

  it("cannot read admin_profiles, so it cannot enumerate officers", async () => {
    const outsider = await signInAsOutsider(db);
    const { data } = await outsider.from("admin_profiles").select("user_id");
    expect(data ?? []).toEqual([]);
  });

  it("cannot grant itself an officer profile", async () => {
    // The §6 privilege-escalation control, asserted rather than assumed.
    const outsider = await signInAsOutsider(db);
    const userId = await outsider.auth
      .getUser()
      .then((r) => r.data.user?.id ?? "");
    expect(userId).not.toBe("");

    await outsider
      .from("admin_profiles")
      .insert({ user_id: userId, role: "admin", display_name: "nope" });

    // Re-read as service role: a write that "failed" still has to be checked
    // against the table, not against the returned error.
    const { data } = await db
      .from("admin_profiles")
      .select("user_id")
      .eq("user_id", userId);
    expect(data ?? []).toEqual([]);
  });

  it("can still read the leaderboard and published events", async () => {
    // The blast radius check: the revoke must not have caught what is public
    // by design. Both are granted to anon AND authenticated on purpose.
    const outsider = await signInAsOutsider(db);

    const board = await outsider.from("leaderboard").select("id").limit(1);
    expect(board.error).toBeNull();
    expect((board.data ?? []).length).toBe(1);

    const events = await outsider
      .from("events")
      .select("id, status")
      .eq("status", "published")
      .limit(1);
    expect(events.error).toBeNull();
    expect((events.data ?? []).length).toBe(1);
  });

  it("sees no unpublished event through the one policy that exists", async () => {
    // events_public_read is `using (status = 'published')`. The seed carries a
    // cancelled event and two drafts, so this is a real filter and not a
    // vacuous pass.
    const outsider = await signInAsOutsider(db);
    const { data, error } = await outsider.from("events").select("status");
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
    for (const row of data ?? []) expect(row.status).toBe("published");

    const all = await db.from("events").select("status");
    expect((all.data ?? []).length).toBeGreaterThan((data ?? []).length);
  });
});

describe("a signed-in OFFICER, through PostgREST", () => {
  // ⚠️ An officer's JWT carries `role = authenticated` and nothing else — the
  // officer-ness lives in admin_profiles, which PostgREST does not consult. So
  // an officer reaching the database directly has exactly the outsider's
  // privileges, and the admin screens work because they go through
  // createAdminClient() (service role) on the server, never through the
  // browser's session. Pinning that, because it is the fact that makes the
  // revoke above safe.
  it("is no more privileged than any other signed-in user", async () => {
    const officer = await signInAsOfficer(db);
    const { data } = await officer.from("member_directory").select("eid").limit(1);
    expect(data ?? []).toEqual([]);
  });
});

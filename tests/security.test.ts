import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { anonClient, testClient } from "./helpers";

// What an unauthenticated visitor can reach, checked with the anon key rather
// than reasoned about (§6). Stage 8 owns this properly; this file exists early
// because one case was already wrong in production.
//
// 🪤 The bug this was written for: `member_directory` was anon-readable on both
// databases, exposing every member's EID and email. It survived review
// because the obvious check passes — `members` itself denies correctly, RLS is
// enabled on every table, and there are no policies. The gap is that a **view
// has no RLS**. `member_directory` runs as owner (security_invoker off)
// precisely so it can aggregate past the deny-all tables beneath it, and
// 20260730000012_api_role_grants.sql grants `all privileges on all tables` —
// which includes views — to anon, on the stated reasoning that RLS would still
// be doing the denying. For a view, nothing was.
//
// So the load-bearing test here is not "member_directory is closed". It is the
// enumeration at the bottom: whatever views the migrations create, only the
// ones on the allowlist may be anon-readable. That is what makes the *next*
// view fail here instead of in production.

/**
 * The only relations anon may select from.
 *
 * Adding a name here is a privacy decision, not a maintenance chore: it means
 * an unauthenticated visitor may read every row the view returns, since a view
 * has no RLS to fall back on. Justify it in the migration.
 */
const ANON_READABLE = new Set([
  // Public standings (§4.4). Carries no eid and no email — that
  // omission is the entire reason it is allowed to be public.
  "leaderboard",
]);

/**
 * The exact columns anon may read from `leaderboard`.
 *
 * Pinned as a set, not a count: the assertion exists so that adding `eid` or
 * `email` to the one public view fails here instead of quietly making it the
 * next `member_directory`.
 *
 * 📌 `term` was appended by migration 21 (Stage 7 phase 1) so the public
 * board's heading and its rows come from one query. Widening this list is a
 * privacy decision every time — a term string names nobody, which is why that
 * one was allowed; do not treat a red assertion here as a test to update.
 */
const LEADERBOARD_COLUMNS = ["full_name", "id", "term", "total_points"];

/**
 * Every view the migrations create, read from source.
 *
 * Deliberately not a hardcoded list: a view added in a later migration is
 * picked up without anyone remembering this file exists. Names of views that
 * were later dropped are harmless — a missing relation errors for anon, which
 * is the same outcome the assertion wants.
 */
function declaredViews(): string[] {
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const names = new Set<string>();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".sql")) continue;
    const sql = readFileSync(new URL(file, dir), "utf8");
    for (const match of sql.matchAll(
      /create\s+(?:or\s+replace\s+)?view\s+public\.(\w+)/gi
    )) {
      names.add(match[1]);
    }
  }
  return [...names].sort();
}

describe("anon access", () => {
  it("cannot read member_directory, which carries EIDs and emails", async () => {
    const anon = anonClient();
    const { data, error } = await anon
      .from("member_directory")
      .select("id")
      .limit(1);

    // Both halves asserted: the request is refused, and nothing came back.
    // The seed guarantees this view is non-empty, so "no rows" here cannot be
    // an accident of there being no data.
    expect(error).not.toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("still cannot read the members table directly", async () => {
    // The half that always passed. Asserted next to the view on purpose, so a
    // reader sees that this one being clean proves nothing about the other —
    // that inference is what let the bug through.
    const anon = anonClient();
    const { data } = await anon.from("members").select("id").limit(1);
    expect(data ?? []).toEqual([]);
  });

  it("can still read the leaderboard, which is public by design", async () => {
    const anon = anonClient();
    const { error } = await anon.from("leaderboard").select("id").limit(1);
    expect(error).toBeNull();
  });

  it("gets no identifier columns from the leaderboard", async () => {
    // Why leaderboard is allowed to be the one public view. If eid or
    // email is ever added to it, this fails rather than quietly making it the
    // next member_directory.
    const anon = anonClient();
    const { data, error } = await anon.from("leaderboard").select("*").limit(5);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
    for (const row of data ?? []) {
      expect(Object.keys(row).sort()).toEqual(LEADERBOARD_COLUMNS);
    }
  });

  it("can select from no declared view except the allowlist", async () => {
    const anon = anonClient();
    const views = declaredViews();

    // Guards the guard: if the regex stops matching, this silently checks
    // nothing at all.
    expect(views).toContain("leaderboard");
    expect(views).toContain("member_directory");

    const readable: string[] = [];
    for (const view of views) {
      // Cast: the relation name comes from the migration files at runtime, so
      // it cannot be one of the generated literal types. That is the point —
      // a view added later must be probed without this file knowing its name.
      const { error } = await anon
        .from(view as "leaderboard")
        .select("*")
        .limit(1);
      if (error === null) readable.push(view);
    }

    expect(readable.sort()).toEqual([...ANON_READABLE].sort());
  });
});

describe("the service-role client is still able to read both views", () => {
  // Sanity check on the revoke's blast radius: it must not have caught the
  // roles the admin screens actually use. `authenticated` is not exercisable
  // from here without minting a session, so service_role stands in for "the
  // revoke was scoped, not blanket".
  it("reads member_directory", async () => {
    const db = testClient();
    const { data, error } = await db
      .from("member_directory")
      .select("id")
      .limit(1);
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(1);
  });
});

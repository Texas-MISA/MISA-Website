import { execSync } from "node:child_process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

import { GENERAL_MEETINGS_FROM } from "./helpers";

// Vitest global setup: the integration tests run against the LOCAL Supabase
// stack (never the linked remote), using the service-role key so RLS —
// deny-all on every table, which Stage 8 confirmed is the end state rather
// than a placeholder — doesn't block fixtures.
// The local keys are well-known dev values published by the CLI; nothing
// here is a secret.
//
// It also sets the two app_settings values the tests move to known ones for
// the duration of the run, and puts the developer's values back afterwards:
// current_term is unpinned (clearTermPin() below says why that is necessary
// rather than tidy), and general_meetings_from is set to GENERAL_MEETINGS_FROM
// (pinGeneralMeetingsFrom()).

export default async function setup() {
  let raw: string;
  try {
    raw = execSync("npx supabase status -o env", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error(
      "Local Supabase stack is not running. Start Docker Desktop, then run: npx supabase start"
    );
  }

  const env: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)="(.*)"$/);
    if (match) env[match[1]] = match[2];
  }

  const url = env.API_URL;
  const serviceKey = env.SERVICE_ROLE_KEY;
  // The anon key is what tests/security.test.ts uses to check the boundary
  // from the outside. Everything else in the suite runs as service_role, which
  // by construction cannot observe whether anon is denied.
  const anonKey = env.ANON_KEY;
  if (!url || !serviceKey || !anonKey) {
    throw new Error(
      `Could not read API_URL / SERVICE_ROLE_KEY / ANON_KEY from \`supabase status\`. Got keys: ${Object.keys(env).join(", ")}`
    );
  }
  if (!url.includes("127.0.0.1") && !url.includes("localhost")) {
    throw new Error(
      `Refusing to run tests against a non-local API_URL: ${url}`
    );
  }

  process.env.SUPABASE_TEST_URL = url;
  process.env.SUPABASE_TEST_SERVICE_KEY = serviceKey;
  process.env.SUPABASE_TEST_ANON_KEY = anonKey;

  const db = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const restoreTerm = await clearTermPin(db);
  let restoreStart: () => Promise<void>;
  try {
    restoreStart = await pinGeneralMeetingsFrom(db);
  } catch (error) {
    // Setup failed, so no teardown will run: put the term back now.
    await restoreTerm();
    throw error;
  }

  return async () => {
    // Both, even when the first one throws.
    try {
      await restoreStart();
    } finally {
      await restoreTerm();
    }
  };
}

/**
 * Unpin `app_settings.current_term` for the run, restoring it afterwards.
 *
 * `seed.sql` pins the term to the one its own data lives in, so a local admin
 * walkthrough shows a populated leaderboard instead of an empty one. That is
 * right for the seed and wrong for the tests: `createCurrentTermEvent` places
 * its fixture a few hours in the past and requires the generated `term` to
 * equal `current_term()`, which stops being true the moment real time leaves
 * the pinned term — permanently, since a pinned past term never comes back.
 * On 2026-08-01 that is exactly what happened: `term_of(now())` became
 * `Fall 2026` against a pin of `Spring 2026`, and every test touching the
 * views failed with the fixture's own guard.
 *
 * Clearing the pin makes the tests exercise the real `now()`-derived
 * derivation rather than an override, and keeps the guard meaningful — it now
 * fires only for a run that genuinely straddles Aug 1 or Jan 1. Restoring the
 * pin on teardown keeps `npm test` from quietly changing what the local admin
 * UI shows afterwards. No term string is typed either way (§4.7).
 */
async function clearTermPin(db: SupabaseClient<Database>) {
  const { data: before, error } = await db
    .from("app_settings")
    .select("id, current_term")
    .limit(1)
    .maybeSingle();

  if (error || !before) {
    throw new Error(
      `Could not read app_settings: ${error?.message ?? "no row"}. ` +
        "Is the local stack seeded? Try: npx supabase db reset"
    );
  }

  if (before.current_term !== null) {
    await db
      .from("app_settings")
      .update({ current_term: null })
      .eq("id", before.id);
  }

  return async () => {
    if (before.current_term !== null) {
      await db
        .from("app_settings")
        .update({ current_term: before.current_term })
        .eq("id", before.id);
    }
  };
}

/**
 * Set `app_settings.general_meetings_from` to `GENERAL_MEETINGS_FROM` for the
 * run, restoring the developer's value afterwards: clearTermPin's sibling, for
 * the other setting the tests move (migration 31).
 *
 * The months view reads the start for every member and term, and through it
 * so does every file's `project_eligibility`. The files that move it put it
 * back to the constant: a block's pin in that block's `afterAll` and the
 * file's, and a single test's move in a `finally`. A run killed between a move
 * and its restore still leaves it moved, on a far-past August say, so this
 * heals it at suite start rather than letting every later file read that.
 *
 * The snapshot, not the constant, goes back at the end, because a developer
 * may have moved the start on purpose for a walkthrough (docs/operations.md
 * says how), and a test run must not undo that. It goes back unconditionally,
 * so the end state holds even when a file's own restore failed. 🪤 A value a
 * killed run left behind looks exactly like a deliberate one, so it is put
 * back too: the run never reads it, but the local admin UI does until
 * `update public.app_settings set general_meetings_from = default;`.
 */
async function pinGeneralMeetingsFrom(db: SupabaseClient<Database>) {
  const { data: before, error } = await db
    .from("app_settings")
    .select("id, general_meetings_from")
    .limit(1)
    .maybeSingle();

  if (error || !before) {
    throw new Error(
      `Could not read app_settings.general_meetings_from: ${error?.message ?? "no row"}. ` +
        "Is migration 31 applied locally? Try: npx supabase migration up --local"
    );
  }

  const setStart = async (month: string) => {
    const { error: writeError } = await db
      .from("app_settings")
      .update({ general_meetings_from: month })
      .eq("id", before.id);
    if (writeError) {
      throw new Error(
        `Could not set app_settings.general_meetings_from to ${month}: ${writeError.message}`
      );
    }
  };

  if (before.general_meetings_from !== GENERAL_MEETINGS_FROM) {
    await setStart(GENERAL_MEETINGS_FROM);
  }

  return () => setStart(before.general_meetings_from);
}

import { execSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

// Vitest global setup: the integration tests run against the LOCAL Supabase
// stack (never the linked remote), using the service-role key so RLS —
// deny-all on attendance/members until Stage 8 — doesn't block fixtures.
// The local keys are well-known dev values published by the CLI; nothing
// here is a secret.
//
// It also unpins app_settings.current_term for the duration of the run, and
// puts it back afterwards. See clearTermPin() below for why that is necessary
// rather than tidy.

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

  return clearTermPin(url, serviceKey);
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
async function clearTermPin(url: string, serviceKey: string) {
  const db = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

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

// Playwright global setup for `npm run test:ui`.
//
// Exports the LOCAL stack's keys for tests/helpers.ts — the same refusal of a
// non-local URL as the Vitest suite, from the same function — and sweeps any
// fixture event a crashed earlier run left behind. The attend-state tests
// open a real event for a few minutes; a leftover one would keep check-in
// "open" on the local stack for everything that runs after.

import { readLocalStack } from "../global-setup";

export const UI_EVENT_PREFIX = "TEST ui-gate";

export default async function globalSetup() {
  const { url, serviceKey, anonKey } = readLocalStack();
  process.env.SUPABASE_TEST_URL = url;
  process.env.SUPABASE_TEST_SERVICE_KEY = serviceKey;
  process.env.SUPABASE_TEST_ANON_KEY = anonKey;

  const { testClient } = await import("../helpers");
  const { error } = await testClient()
    .from("events")
    .delete()
    .like("title", `${UI_EVENT_PREFIX}%`);
  if (error) throw new Error(`could not sweep leftover ui-gate events: ${error.message}`);
}

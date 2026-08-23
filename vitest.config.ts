import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  // Honors the "@/*" alias from tsconfig.json.
  //
  // `conditions` resolves the `server-only` marker package to its empty.js
  // rather than the module that throws "cannot be imported from a Client
  // Component". Server-only modules (lib/supabase/admin.ts,
  // app/actions/audit.ts) are exactly what these tests need to import; the
  // guard exists to keep them out of the browser bundle, and Vitest is
  // neither a browser nor a bundler.
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url)
      ),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // The check-in origin pepper (docs/checkin-location-verification.md).
    //
    // 📌 A FIXTURE, NOT A SECRET, and it is committed on purpose so the digest
    // tests run for everybody rather than skipping silently on a fresh clone.
    // It protects nothing: the addresses these tests hash are literals in
    // tests/checkin-origin.test.ts.
    //
    // 🔓 The REAL pepper is a Vercel environment variable and a line in
    // .env.local, and it must never appear in this repository — an unpeppered
    // or known-peppered SHA-256 of an IPv4 address is reversible on a laptop,
    // and this repo is public. Set here rather than in tests/global-setup.ts
    // because lib/checkin-origin.ts reads process.env at MODULE LOAD, which
    // can run before a global setup's mutation is visible to a worker.
    env: {
      CHECKIN_ORIGIN_PEPPER: "test-pepper-not-a-secret-see-vitest-config",
    },
    // Verifies the local Supabase stack is up and exports its keys.
    globalSetup: "./tests/global-setup.ts",
    // Integration tests round-trip the local stack; generous but bounded.
    testTimeout: 15000,
    hookTimeout: 30000,
    // One test file at a time.
    //
    // Every integration file shares the single local Supabase stack, and its
    // Kong gateway starts returning 502s ("An invalid response was received
    // from the upstream server") once several worker threads hit PostgREST at
    // once. The symptom is the nasty kind: a different test fails on each run
    // and each one passes in isolation, so it reads as a flaky assertion
    // rather than as saturation. Measured at roughly a 50% per-run failure
    // rate with parallelism on, and 0 across repeated serial runs.
    //
    // The whole suite takes about four seconds serially, so this costs nothing
    // worth having. Revisit only if a future stack gets its own database per
    // worker — the fixtures already isolate by 7-day slot, so the collision is
    // in the gateway, not in the data.
    fileParallelism: false,
  },
});

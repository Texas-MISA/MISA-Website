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
    // Verifies the local Supabase stack is up and exports its keys.
    globalSetup: "./tests/global-setup.ts",
    // Integration tests round-trip the local stack; generous but bounded.
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});

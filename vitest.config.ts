import { defineConfig } from "vitest/config";

export default defineConfig({
  // Honors the "@/*" alias from tsconfig.json.
  resolve: { tsconfigPaths: true },
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

import { readFileSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

// The rendered-page checks of the design toolkit (DESIGN.md §Design toolkit):
// axe, 360px overflow, no-JS reveals, and the states a first render never
// shows. `npm run test:ui`. Needs Docker Desktop up and `npx supabase start`,
// like `npm test`, plus `npx playwright install chromium` once per machine.
//
// 🪤 **Next 16 LOCKS a project against a second `next dev`** (.next/dev/lock),
// so starting our own server while `npm run dev` is up fails outright — and
// /design-gate needs both. So: if the lock names a live `next dev`, reuse it;
// otherwise start one on :3100. Reusing only what the LOCK names is the
// safety property. A `next dev` always reads .env.development.local, which
// pins the LOCAL stack; whatever else happens to answer on :3000 — a
// `next start`, which reads .env.local and so PRODUCTION — is never used.
function runningDevServer(): string | null {
  try {
    const info = JSON.parse(readFileSync(".next/dev/lock", "utf8")) as {
      pid?: number;
      appUrl?: string;
    };
    if (!info.pid || !info.appUrl) return null;
    process.kill(info.pid, 0); // throws if that process is gone (a stale lock)
    return info.appUrl;
  } catch {
    return null;
  }
}

const reuse = runningDevServer();
const baseURL = reuse ?? "http://localhost:3100";

export default defineConfig({
  testDir: "tests/ui",
  globalSetup: "./tests/ui/global-setup.ts",
  fullyParallel: false,
  // One worker: the local Kong gateway 502s under parallel load (see
  // vitest.config.ts), and the attend states share one fixture event.
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
  },
  webServer: reuse
    ? undefined
    : {
        command: "npx next dev --port 3100",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 180_000,
      },
});

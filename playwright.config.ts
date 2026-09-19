import { defineConfig, devices } from "@playwright/test";

// The rendered-page checks of the design toolkit (DESIGN.md §Design toolkit):
// axe, 360px overflow and no-JS reveals, on every public route and every
// registered design surface. `npm run test:ui`.
//
// 🪤 It drives `next dev`, which reads .env.development.local and so talks to
// the LOCAL Supabase stack — never production. Needs Docker Desktop up and
// `npx supabase start`, like `npm test`.
export default defineConfig({
  testDir: "tests/ui",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npx next dev --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});

import { execSync } from "node:child_process";

// Vitest global setup: the integration tests run against the LOCAL Supabase
// stack (never the linked remote), using the service-role key so RLS —
// deny-all on attendance/members until Stage 8 — doesn't block fixtures.
// The local keys are well-known dev values published by the CLI; nothing
// here is a secret.

export default function setup() {
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
  if (!url || !serviceKey) {
    throw new Error(
      `Could not read API_URL / SERVICE_ROLE_KEY from \`supabase status\`. Got keys: ${Object.keys(env).join(", ")}`
    );
  }
  if (!url.includes("127.0.0.1") && !url.includes("localhost")) {
    throw new Error(
      `Refusing to run tests against a non-local API_URL: ${url}`
    );
  }

  process.env.SUPABASE_TEST_URL = url;
  process.env.SUPABASE_TEST_SERVICE_KEY = serviceKey;
}

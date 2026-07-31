#!/usr/bin/env node
// Create, reset, or revoke an officer account (§2.3, §6).
//
// Officers are added out-of-band on purpose: admin_profiles is not writable by
// any client role, so there is no self-service signup and no privilege
// escalation path through the app. §6 says "via the Supabase dashboard or a
// seeded SQL script" — the seeded-script half is unusable here, because
// supabase/seed.sql is applied to the REMOTE by scripts/seed-remote.sh and
// this repository is public. Any password committed there would be a published
// production credential. This script takes the credential at runtime instead
// and writes nothing to disk.
//
//   node --env-file=.env.local scripts/create-officer.mjs --email you@utexas.edu --role admin
//   node scripts/create-officer.mjs --local --email dev@example.edu
//   node --env-file=.env.local scripts/create-officer.mjs --email you@utexas.edu --reset-password
//   node --env-file=.env.local scripts/create-officer.mjs --email them@utexas.edu --revoke
//
// `npx supabase db reset` wipes local auth.users, so the local officer has to
// be recreated after every reset.

import { execSync } from "node:child_process";
import { createInterface } from "node:readline";

import { createClient } from "@supabase/supabase-js";

const args = parseArgs(process.argv.slice(2));

if (!args.email) {
  fail(
    "Usage: create-officer.mjs --email <address> [--role officer|admin] [--local] [--reset-password] [--revoke] [--yes]"
  );
}
if (args.role && args.role !== "officer" && args.role !== "admin") {
  fail(`--role must be "officer" or "admin", got "${args.role}"`);
}

const { url, serviceKey } = args.local ? localCredentials() : envCredentials();
const isLocal = url.includes("127.0.0.1") || url.includes("localhost");

console.log(`target:  ${new URL(url).host}${isLocal ? "  (local)" : ""}`);
console.log(`email:   ${args.email}`);

// Bootstrapping production by accident is the failure mode worth a speed bump.
if (!isLocal && !args.yes) {
  const answer = await prompt("This is NOT a local database. Continue? (yes/no) ");
  if (answer.trim().toLowerCase() !== "yes") fail("aborted");
}

const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

if (args.revoke) {
  await revoke();
} else if (args["reset-password"]) {
  await resetPassword();
} else {
  await createOfficer();
}

async function createOfficer() {
  const password = await readPassword();
  const role = args.role ?? "officer";

  let userId;
  const { data, error } = await db.auth.admin.createUser({
    email: args.email,
    password,
    email_confirm: true, // No confirmation mail: the built-in sender is capped
    // at 2 emails/hour and is not for production use.
  });

  if (error) {
    // Already exists is not an error here — this doubles as "grant an existing
    // account officer access".
    if (!/already been registered|email_exists/i.test(error.message)) {
      fail(`could not create the auth user: ${describe(error)}`);
    }
    userId = await findUserId(args.email);
    if (!userId) fail(`user reported as existing but could not be found`);
    console.log("auth user already existed — updating its password");
    const { error: pwError } = await db.auth.admin.updateUserById(userId, {
      password,
    });
    if (pwError) fail(`could not set the password: ${describe(pwError)}`);
  } else {
    userId = data.user.id;
    console.log("auth user created");
  }

  // Default to the email's local part rather than null. admin_audit renders
  // the display name, and a nameless officer used to show up on every screen
  // as "an officer" with no way to tell which one — in a log whose entire job
  // is saying who did what (§6). A real name is better; this is the floor.
  const displayName =
    args["display-name"] ?? args.email.split("@")[0] ?? null;

  const { error: profileError } = await db
    .from("admin_profiles")
    .upsert(
      { user_id: userId, display_name: displayName, role },
      { onConflict: "user_id" }
    );
  if (profileError) {
    fail(`could not write admin_profiles: ${describe(profileError)}`);
  }

  console.log(`officer ready — role "${role}", user id ${userId}`);
  console.log("sign in at /admin/login");
}

async function resetPassword() {
  const userId = await findUserId(args.email);
  if (!userId) fail(`no auth user with that email`);

  const password = await readPassword();
  const { error } = await db.auth.admin.updateUserById(userId, { password });
  if (error) fail(`could not set the password: ${describe(error)}`);

  console.log("password updated");
  console.log(
    "(this is the v1 recovery path — self-serve reset needs SMTP, which is not configured)"
  );
}

async function revoke() {
  const userId = await findUserId(args.email);
  if (!userId) fail(`no auth user with that email`);

  // Delete the profile, NOT the auth user. admin_audit.actor_id and
  // point_adjustments.awarded_by reference auth.users with no cascade, so
  // deleting the account of anyone who has ever acted would fail — and would
  // erase who did what if it succeeded. Revoking the profile removes access
  // and preserves the history, which is what officer turnover needs (§2.3).
  const { error } = await db
    .from("admin_profiles")
    .delete()
    .eq("user_id", userId);
  if (error) fail(`could not revoke: ${describe(error)}`);

  console.log(`access revoked for ${args.email} (auth user kept for audit history)`);
}

async function findUserId(email) {
  const target = email.toLowerCase();
  // listUsers is paginated and there is no filter-by-email on the admin API.
  // An officer roster is a dozen accounts, so a few pages is plenty.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`could not list users: ${describe(error)}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

/**
 * Supabase AuthError carries its text on non-enumerable properties, so template
 * interpolation and JSON.stringify both render it as "{}" and hide the actual
 * failure. Pull the useful fields out by hand.
 */
function describe(error) {
  if (!error) return "unknown error";
  const parts = [error.message, error.code, error.status]
    .filter((v) => v !== undefined && v !== null && v !== "")
    .map(String);
  return parts.length > 0 ? parts.join(" / ") : String(error);
}

/**
 * Read the password from OFFICER_PASSWORD, or prompt for it with the echo
 * suppressed. Never accepted on argv — that would put a live credential in
 * shell history and in the process list for every user on the machine.
 */
async function readPassword() {
  const fromEnv = process.env.OFFICER_PASSWORD;
  if (fromEnv) {
    if (fromEnv.length < 12) {
      fail("OFFICER_PASSWORD is under 12 characters — pick a longer one");
    }
    return fromEnv;
  }

  const first = await prompt("password: ", { silent: true });
  if (first.length < 12) fail("password must be at least 12 characters");
  const second = await prompt("confirm:  ", { silent: true });
  if (first !== second) fail("passwords did not match");
  return first;
}

function prompt(question, { silent = false } = {}) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  if (silent) {
    // Swallow the echoed keystrokes; the prompt itself still prints.
    const original = rl._writeToOutput.bind(rl);
    let promptWritten = false;
    rl._writeToOutput = (chunk) => {
      if (!promptWritten) {
        promptWritten = true;
        original(chunk);
      }
    };
  }

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      if (silent) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

function envCredentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    fail(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n" +
        "Run with: node --env-file=.env.local scripts/create-officer.mjs ...\n" +
        "Or target the local stack with --local."
    );
  }
  return { url, serviceKey };
}

function localCredentials() {
  let raw;
  try {
    raw = execSync("npx supabase status -o env", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    fail(
      "Local Supabase stack is not running. Start Docker Desktop, then run: npx supabase start"
    );
  }

  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)="(.*)"$/);
    if (match) env[match[1]] = match[2];
  }

  const url = env.API_URL;
  const serviceKey = env.SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    fail("could not read API_URL / SERVICE_ROLE_KEY from `supabase status`");
  }
  // The mirror of tests/global-setup.ts's guard: --local must mean local.
  if (!url.includes("127.0.0.1") && !url.includes("localhost")) {
    fail(`--local was passed but the API URL is not local: ${url}`);
  }
  return { url, serviceKey };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) fail(`unexpected argument: ${arg}`);
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

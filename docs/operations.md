# Local environment, CLI, test and deploy notes — the long form

The full text of the traps summarised under **Commands** in `CLAUDE.md`, moved there on 2026-08-14. Each one cost real debugging time and none of them fails loudly, which is why they are written down at length rather than trimmed to a warning.

## Dev server

🪤 **`.env.local` points at the remote project, so `npm run dev` reads production unless you stop it.** That is right for builds and for `vercel env pull`, and wrong for any local walkthrough — and it fails silently, because the remote carries the same seed data, so the admin UI looks exactly as it should while you browse production. `.env.development.local` (gitignored via `.env*.local`) pins dev to `http://127.0.0.1:54321`; Next loads it ahead of `.env.local` in dev. **Confirm the `Environments: .env.development.local, .env.local` line in the dev server's banner before trusting what you see.** Env files are read once at process start, so an already-running server keeps serving the old target. `npm run dev` does not replace it, either: on Next 16.2.12 a second `next dev` **in the same folder** prints `⨯ Another next dev server is already running` with that server's PID, port and log path, and exits, even with a different `-p` (2026-10-03). An older note here said it quietly falls back to port 3001. Its log at `.next/dev/logs/next-development.log` does not record the `Environments:` line, so a leftover server's target cannot be read back. Stop it and start one whose banner you can see.
🪤 **Don't run `npm run dev` with its stdout attached to something that stops reading.** When the pipe closes, the next request-log write kills Next with an **uncaught `EPIPE`** — and the process does not exit. It spins (measured at 1080s CPU / 2 GB RSS) while every request hangs forever, so the browser keeps rendering a **stale DOM that reads exactly like an application bug**, and the dev log's final line is the request *before* the failure rather than an error. Redirect to a file and detach instead. **The general rule this bought: when the screen shows something that should be impossible, `curl` the server before believing it** — during the phase-4 walkthrough this produced a confident, entirely wrong defect report, and the actual value in the database had been correct the whole time.
🪤 **Moving a route folder needs the dev server STOPPED, twice over** (found moving the member pages under `/portal`, 2026-09-18). A running `next dev` holds handles inside `app/`, so on Windows `git mv` of a route folder fails with *Permission denied* — and a server left running from an earlier session counts, so find it by port. Then, after the move, a `.next/dev/types/validator.ts` written by the old server still imports the old page paths; `tsconfig.json` includes `.next/dev/types/**`, so `next build` fails type-checking on a module that no longer exists. Delete `.next/dev/types` (it is generated) or start a fresh dev server, which rewrites it.
🪤 **A phone-width screenshot needs device emulation, not a small window** (2026-09-18). Headless Chrome enforces a ~500px minimum window, so `--window-size=390,…` lays the page out at ~500px and CROPS it. The result looks exactly like a real layout bug — the centred wordmark sat at x≈258 in both a "390" and a "320" shot. Emulate the viewport over the DevTools protocol instead (`Emulation.setDeviceMetricsOverride` with `mobile: true`). Separately, a **hidden** tab in the automated browser defers iframe loads and pauses `requestAnimationFrame`, so an iframe-based width probe there simply hangs.
🪤 **In the automated Chrome, confirm a page has hydrated before trusting an interaction with it** (`/admin/members` item 2's walkthrough, 2026-10-03). The tab reported `document.visibilityState` as `hidden`, and hydration stalled until a screenshot forced a frame. Screenshots timed out intermittently, so the selects were driven from JavaScript, by dispatching `change` events. Before believing any interaction, check that the element carries a `__reactProps$…` key: without one React has not attached to it, and nothing is listening. Item 1's walkthrough hit the same class of trap from another side: the tool's `form_input` changed a select's DOM without firing React's `onChange`, so two "saves" never posted. Check the server log for the action call too.
📌 **To see a JUDGED general-meeting month locally, move the start back, then put it back** (`/admin/members` item 3, 2026-10-04). General meetings count from `app_settings.general_meetings_from`, which is `2026-10-01`, and no month from then on has ended yet, so on a fresh stack no month is ever judged. Move the start back with `psql`, which cannot reach the remote:

```bash
docker exec -i supabase_db_MISA-Website psql -U postgres -d postgres -tA <<'SQL'
update public.app_settings set general_meetings_from = date '2026-08-01';
SQL
```

Then tick "Count as general meeting" on some of that month's published events: the seed ticks nothing. The value must be the first of a month, or the CHECK refuses it (23514). Afterwards, put the default back with `update public.app_settings set general_meetings_from = default;`. 📌 **`npm test` leaves your start alone:** `tests/global-setup.ts` runs the suite on `2026-10-01` and puts back whatever it found once the suite ends, so a walkthrough's earlier start survives a test run. 🪤 So does a start that a killed run left moved, on a far-past August say, because it looks exactly like a deliberate one. The run never reads it, but the local admin UI does, so reset it with the `default` update above.

## The Supabase CLI on this machine

Eight sharp edges, each of which has cost a session at least once:

- **`db query` reads only the first line of its SQL argument.** Multi-line SQL silently truncates and fails with a confusing syntax error. Flatten to one line, and remember Windows caps a command line near 8k characters — `scripts/seed-remote.sh` exists to work around both.
- **`db query` targets the remote unless you pass `--local`, and `--linked=false` does NOT mean "not linked".** The flag is a boolean; the `=false` is discarded and it reads as `--linked`, so the query goes to production. The failure is quiet and convincing — a member id fetched "from local" 404s on a local page, a row count "proves" local drift — because both databases hold plausible data. **Verify which database answered before believing a surprising result**, using an id or a count you already know.
- **`db reset` needs Docker Desktop running.** WSL 2 and Docker Desktop are both installed (Docker at the *user-level* path `%LOCALAPPDATA%\Programs\DockerDesktop`, not `C:\Program Files\Docker` — a default-path check wrongly reports it missing). The engine is not a service: if `docker info` fails on `npipe:////./pipe/dockerDesktopLinuxEngine`, launch `Docker Desktop.exe` and wait for it. `wsl --list` showing no distributions is also a red herring — Docker Desktop supplies its own `docker-desktop` distro.
- **Newer stacks don't auto-grant table privileges to the API roles.** A fresh local stack gives anon/authenticated/service_role only `TRUNCATE/REFERENCES/TRIGGER` on new tables — every API read/write fails with 42501 no matter what RLS says. The remote project predates the change, which is why production worked while local tests couldn't insert as service_role. Migration `20260730000012_api_role_grants.sql` codifies the classic grants (plus default privileges for future tables); RLS remains the actual security boundary.
- **`db reset` does not re-read `config.toml`.** Container environment is baked at `supabase start`, so `db reset` replays migrations against containers still holding the old settings. A changed `jwt_expiry` (or any other `[auth]` value) needs a full `stop` + `start`. The symptom is a config change that appears to do nothing; confirm with `docker inspect supabase_auth_MISA-Website --format '{{range .Config.Env}}{{println .}}{{end}}' | grep GOTRUE_`.
- **Apply a new migration locally with `npx supabase migration up --local`, not `db reset`** (used for migration 30, 2026-10-03). It applies only the pending files and keeps everything else, including local `auth.users`, so the local officer account and any walkthrough data survive; `db reset` wipes both. Pass `--local` explicitly rather than trusting a default: `db query`, above, is the reminder that this CLI's defaults are not always where you expect. If PostgREST then reports a new column as missing, `notify pgrst, 'reload schema'` through `psql` makes it re-read the schema.
- 🪤 **Type generation has two traps, and migration 30 had to work around both (2026-10-03).**
  - **`gen types typescript --linked` reads the REMOTE**, so it cannot see a migration that exists only locally. While local is ahead, generate with `--local`.
  - **CLI 2.119.0's output drifts from the committed `lib/types/database.ts` in ways that have nothing to do with the migration.** The output is unformatted (the CLI suggests `npx oxfmt`); generated columns become `?: never` in `Insert` and `Update` (`normalized_eid` six times, `term`, `covered_terms`, `checkin_throttle.id`); `members.custom_fields` becomes `NonNullable<Json>`; and an argument-less function's `Args` becomes `Record<PropertyKey, never>` where the file has `never`. Committing that would bury the migration's real change in churn and change the types the app compiles against. **Generate into the scratchpad, diff it against the committed file, and hand-port only the migration's additions**, including the `Relationships` entries the generator adds to every table whose foreign key matches a new view's column. Migration 30's port was `members.member_type` in `Row`, `Insert` and `Update`, the two new `member_directory` columns, the two new views, and those relationship entries. Migration 31's port (2026-10-04) was seven lines: `events.counts_as_general_meeting` and `app_settings.general_meetings_from`, each in `Row`, `Insert` and `Update`, plus `counts_as_general_meeting` in `open_event_at`'s `Returns`. 🪤 That last one is easy to miss: the function returns `setof events`, so every new `events` column lands in its return type too.
- **`~/.supabase/profile` breaks every command that shells out to the legacy Go child.** A dangling active-profile pointer (a bare name, no extension) makes the child feed the path to viper, which fails with `failed to read profile: Unsupported Config Type ""` → `LegacyGoChildExitError`. `start` and `db query --linked` are unaffected, so it looks like a `db reset`-only fault. The file was deleted (it contained just `misa`, and there is no `profiles` subcommand or config file defining it). Don't recreate it; `--profile` does not work around it.

`npx supabase start` applies every migration and runs `seed.sql` itself, so a fresh stack is already a full rebuild-from-repo check. Local `config.toml` pins `major_version = 17`, matching the remote's 17.6.

## Tests

**Tests: Vitest**, chosen at Stage 3. The §7 resolution/dedupe/normalization cases run as integration tests against the **local Supabase stack** — real Postgres semantics with timestamps injected into `open_event_at()`/`nearby_events()`, no clock mocking. `tests/global-setup.ts` reads the local keys from `npx supabase status` and refuses to run against anything non-local.

```bash
npm test                                              # all tests (needs: Docker Desktop up, npx supabase start)
npm run test:watch                                    # watch mode
npx vitest run tests/checkin.test.ts -t "<test name>" # single test
```

🪤 **`fileParallelism: false` is load-bearing, not a preference.** Every integration file shares the one local Supabase stack, and its Kong gateway starts returning 502s — `An invalid response was received from the upstream server` — once several worker threads hit PostgREST at once. The symptom is the expensive kind: a *different* test fails on each run and every one of them passes in isolation, so it reads as a flaky assertion rather than as saturation. Measured at roughly a 50% per-run failure rate with parallelism on, 0 across repeated serial runs. The suite takes about four seconds serially, so there is nothing to reclaim by turning it back on. Fixtures already isolate by 7-day slot — the collision is in the gateway, not the data.

Stage 4 added `tests/events.test.ts` (pure — DST, half-open windows, edit-impact maths; no database) and `tests/event-actions.test.ts` (integration — 23P01 batch atomicity, the `updated_at` compare-and-set, append-only `admin_audit`, `term_of`). `vitest.config.ts` aliases `server-only` to `tests/stubs/server-only.ts`, because that marker package throws outside a Server Component and the tests need to import `lib/supabase/admin.ts` and `app/actions/audit.ts`.

`tests/helpers.ts`'s `getTestOfficer()` creates one officer and **never deletes it**: `admin_audit` rows can't be deleted (P0001 from the append-only trigger), `admin_audit.actor_id` has no cascade, so an officer who has written any audit row is undeletable. Audit rows are likewise left behind by `cleanup()`. That is safe only because the local stack is disposable and `global-setup.ts` refuses any non-local URL.

Test identities are obviously fake (`T3-…` IDs, `example.edu`); fixture events live in 2030, each test in its own 7-day slot so no 48-hour orphan window reaches a neighbour's events.

## Deploying to production

A push to `main` is a production deploy of https://www.txmisa.org, and `tasks.md` carries the procedure. These are the traps the member-portal deploy hit on 2026-09-30. Each one looked like success.

- 🔴 **Take a backup first.** Before a `db push`, a roster import, a dues import or a merge, run `bash scripts/backup-remote.sh`, and do not proceed if it leaves `INCOMPLETE` in its folder. Production has no other backup (§Backups below).
- 🪤 **Read the clock from the database, not from Git Bash.** The rule is "after an event, never during one", and applying it needs the time in Central. `TZ=America/Chicago date` has no zoneinfo on this machine, so it silently printed UTC: 19:00 when Central was 14:00. The database runs the check-in window on its own clock, so ask it directly. `npx supabase db query --linked "select now() at time zone 'America/Chicago' as now_ct, (select title from public.open_event_at(now())) as open_now;"` gives both answers in one line, and an empty `open_now` means no window is open.
- 🪤 **A push can 408 and still print "Everything up-to-date".** Confirm with `git ls-remote origin refs/heads/main`, which asks GitHub instead of trusting the push's own output.
- 🪤 **`npx vercel ls` prints only URLs when its output is piped.** The status column (Ready, Building, Error) goes to the terminal, so a script that greps it for `Ready` waits until it times out. Poll `npx vercel inspect <deployment-url> 2>&1 | grep status` instead. `npx vercel inspect www.txmisa.org` names the deployment that is actually live.
- 🪤 **Verify by rendered response, not by status code.** An error boundary also answers 200, so check each page's own `<h1>`, and check for "Something went wrong" and "Couldn't load" in the HTML.
- 🪤 **A browser that has visited the site cannot test the bare domain.** Chrome autocompletes `txmisa.org` to `www.txmisa.org` from history, then hides `www.` in the address bar, so a dead apex looks fine. On 2026-09-30 the apex had no A record, yet it "worked" in the officer's browser. Pointing that same Chrome at exactly `https://txmisa.org/` showed Chrome's error page. Test with `curl -sI https://txmisa.org/attend`, or click into the address bar to see the full URL.
- 📌 **A docs-only commit to `main` is still a production build.** It needs the same event check, and the live deployment can be a docs commit ahead of the commit the docs name.

## Backups

🔴 **Supabase keeps NO backups of this project.** It is on the Free plan, where `npx supabase backups list --project-ref gbxypeofjnhrhotlhyzs` returns `"backups":[]` and `"pitr_enabled":false` (checked 2026-10-09). Daily backups start at Pro ($25/month, 7 days kept), which is the officers' call. Until then, `bash scripts/backup-remote.sh [output-dir]` is the only copy of the club's data that exists anywhere else.

- **When to run it:** before anything that writes to production in bulk (a migration push, a roster import, a merge, a dues import), and weekly during the semester. It changes no club data, but the CLI does create a temporary login role on the project (the script's header says what that means). After Docker has pulled the Postgres image, which the first run does, it takes about a minute.
- **Who runs it, and where backups live** (officer, 2026-10-09): any officer, on their own computer, into the script's default folder, `~/misa-backups`. Nothing is uploaded anywhere.
- **What it writes:** one `misa-<UTC time>/` folder per run, under `$MISA_BACKUP_DIR` or `~/misa-backups`, holding `roles.sql`, `schema.sql`, `data.sql`, `counts.txt`, `migrations.txt` and `backup.log` (the CLI's own output: in a normal run it holds host and user names, never a password). It then counts the rows `data.sql` carries for each table and fails if a table that should hold rows is empty, if a table it leaves out turns up, if `migrations.txt` names no migration, or if `roles.sql` is empty.
- ⚠️ **A run that did not finish, for any reason, leaves an `INCOMPLETE` file in its folder. Never restore from a folder that has one.** The marker is written first and removed only after verify passes, so Ctrl-C or a closed window leaves it too.
- 🔴 **The output is real club data**, every EID and email plus the officers' password hashes. The script refuses any folder inside the repository, which is public, or (when git is installed; the check is skipped without it) inside any other git working tree. Keep backups somewhere private, and delete ones you no longer need.
- 📌 **What is left out, and what is not.** Left out: auth's sessions, refresh tokens, one-time-token index, MFA challenges and AMR claims, PKCE flow state, and its sign-in log with its IP addresses. After a restore, every officer signs in again. A stolen backup DOES hold every officer's password hash, any TOTP secret in `auth.mfa_factors`, and any password-reset, invite or confirmation link in `auth.users` still unused when the backup ran, live until it expires (an hour by default).
- 🪤 **It needs Docker Desktop running**, because the CLI runs `pg_dump` inside a container. It needs no database password: the CLI has Supabase create a temporary login role, `cli_login_postgres`, which stays listed in the database afterwards and is harmless.
- 🪤 **Unset `SUPABASE_DEBUG` first.** The script refuses to start with it set, because debug output would go into `backup.log`.
- **Restoring:** ⚠️ untested until `tasks.md` §Backups step 3. The script's header has both cases. A new project takes the three files in one `psql --single-transaction` run, then a `migration repair` for each version in `migrations.txt`, before any `db push`. Rows lost from the live project are recovered through the local stack, never by running `data.sql` against production, where it would collide with every row still there.

## Check-in location verification (migration 28)

**`CHECKIN_ORIGIN_PEPPER` must be set wherever check-ins are recorded.** Any long
random string: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
It goes in `.env.local` for dev and in **Vercel's project env vars** for
production; `.env.example` documents it.

🪤 **Missing is silent, not broken.** No digest is computed, no check-in fails,
and every row on the officer's review screen reads *origin unknown* — so the
symptom is a feature that appears to work and finds nothing. The event page's
summary line names the variable when it is absent, which is the only thing
standing between that and a mystery.

⚠️ **Rotating it orphans every digest already stored.** That only matters inside
an event that has not been reviewed yet, since digests are event-scoped anyway.

**Refreshing the network prefix table:**

```bash
node scripts/build-network-table.mjs      # rewrites lib/network-prefixes.generated.ts
```

Fetches UT's and the carriers' announced prefixes from RIPEstat, merges them,
and writes the committed table with a `GENERATED_AT` date. Needs network access;
**refuses to write rather than emitting an empty table** if an ASN returns
nothing, because an empty `cellular` list silently flags every member on a phone.

🪤 **Nothing detects staleness.** `GENERATED_AT` is the only signal, and a stale
table fails toward *flagging real attendees* — a carrier's new block reads
`other`, and `other` is the one label that gets flagged. Re-run it when a whole
carrier starts reading `other`.

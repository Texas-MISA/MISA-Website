# Local environment, CLI and test notes — the long form

The full text of the traps summarised under **Commands** in `CLAUDE.md`, moved there on 2026-08-14. Each one cost real debugging time and none of them fails loudly, which is why they are written down at length rather than trimmed to a warning.

## Dev server

🪤 **`.env.local` points at the remote project, so `npm run dev` reads production unless you stop it.** That is right for builds and for `vercel env pull`, and wrong for any local walkthrough — and it fails silently, because the remote carries the same seed data, so the admin UI looks exactly as it should while you browse production. `.env.development.local` (gitignored via `.env*.local`) pins dev to `http://127.0.0.1:54321`; Next loads it ahead of `.env.local` in dev. **Confirm the `Environments: .env.development.local, .env.local` line in the dev server's banner before trusting what you see.** Env files are read once at process start, so an already-running server keeps serving the old target — and `npm run dev` quietly falls back to port 3001 rather than displacing it.
🪤 **Don't run `npm run dev` with its stdout attached to something that stops reading.** When the pipe closes, the next request-log write kills Next with an **uncaught `EPIPE`** — and the process does not exit. It spins (measured at 1080s CPU / 2 GB RSS) while every request hangs forever, so the browser keeps rendering a **stale DOM that reads exactly like an application bug**, and the dev log's final line is the request *before* the failure rather than an error. Redirect to a file and detach instead. **The general rule this bought: when the screen shows something that should be impossible, `curl` the server before believing it** — during the phase-4 walkthrough this produced a confident, entirely wrong defect report, and the actual value in the database had been correct the whole time.

## The Supabase CLI on this machine

Six sharp edges, each of which has cost a session at least once:

- **`db query` reads only the first line of its SQL argument.** Multi-line SQL silently truncates and fails with a confusing syntax error. Flatten to one line, and remember Windows caps a command line near 8k characters — `scripts/seed-remote.sh` exists to work around both.
- **`db query` targets the remote unless you pass `--local`, and `--linked=false` does NOT mean "not linked".** The flag is a boolean; the `=false` is discarded and it reads as `--linked`, so the query goes to production. The failure is quiet and convincing — a member id fetched "from local" 404s on a local page, a row count "proves" local drift — because both databases hold plausible data. **Verify which database answered before believing a surprising result**, using an id or a count you already know.
- **`db reset` needs Docker Desktop running.** WSL 2 and Docker Desktop are both installed (Docker at the *user-level* path `%LOCALAPPDATA%\Programs\DockerDesktop`, not `C:\Program Files\Docker` — a default-path check wrongly reports it missing). The engine is not a service: if `docker info` fails on `npipe:////./pipe/dockerDesktopLinuxEngine`, launch `Docker Desktop.exe` and wait for it. `wsl --list` showing no distributions is also a red herring — Docker Desktop supplies its own `docker-desktop` distro.
- **Newer stacks don't auto-grant table privileges to the API roles.** A fresh local stack gives anon/authenticated/service_role only `TRUNCATE/REFERENCES/TRIGGER` on new tables — every API read/write fails with 42501 no matter what RLS says. The remote project predates the change, which is why production worked while local tests couldn't insert as service_role. Migration `20260730000012_api_role_grants.sql` codifies the classic grants (plus default privileges for future tables); RLS remains the actual security boundary.
- **`db reset` does not re-read `config.toml`.** Container environment is baked at `supabase start`, so `db reset` replays migrations against containers still holding the old settings. A changed `jwt_expiry` (or any other `[auth]` value) needs a full `stop` + `start`. The symptom is a config change that appears to do nothing; confirm with `docker inspect supabase_auth_MISA-Website --format '{{range .Config.Env}}{{println .}}{{end}}' | grep GOTRUE_`.
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

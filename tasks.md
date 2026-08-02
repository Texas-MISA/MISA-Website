# Tasks

Short-horizon working list. The full plan lives in [`docs/student-org-website-architecture.md`](docs/student-org-website-architecture.md); section refs (§) point there. Refill **Later** as stages are reached.

**Stages 0–5 are complete. Stage 6 (member directory) is in progress — phases 1, 2a, 2, and 3 of 9 built.** The stage was re-planned on 2026-08-01 after four design decisions landed on top of phase 1. Carry-over chores from Stage 0 are collected under Loose ends.

---

## 🔖 Picking this up cold (as of 2026-08-02)

Read this before touching anything; it is the state no file can tell you on its own.

| | |
|---|---|
| **Branch** | Phase 3 is built on `stage-6-member-directory`, **not yet merged or deployed**; `main` is at `01f9f68`. Stage 6 merges to `main` **at the end of each phase** rather than at the end of the stage — keep doing that. |
| **Production** | **Everything through Stage 6 phase 2 is live** on https://misa-website-beta.vercel.app; **phase 3 is not deployed yet.** Verified by response, not assumed: `/`, `/attend`, `/officers` all 200; anon is **401** on `member_directory` and 200 on `leaderboard`. ⚠️ A 307 on an `/admin/*` path proves nothing about whether a route shipped — the proxy redirects paths that do not exist. |
| **Database** | **18 migration files (through `…000017`), identical on local and the remote** (`gbxypeofjnhrhotlhyzs`) — confirmed with `npx supabase migration list --linked`. Phase 2 added **15** (anon revoke), **16** (the EID rename), and **17** (a data backfill rewriting the remote's pre-rename values). **Phase 3 added none** and regenerated no types — the view already carried everything, which is what migration 14 was for. |
| 🔴 **Production is NOT purely fake data** | It carries **one real member** — `Christian A Gonzales / cag7284`, `source = 'self_checkin'`, one attendance row — who self-registered through the live check-in form, plus a real officer account. This is why `seed.sql`'s guard refuses to run against it, and the guard is **right**: a wipe would destroy a real person's row. Production totals (33 members / 16 events / 209 attendance / 12 audit) therefore do **not** match the seed's 32/15/208/2, and are not supposed to. |
| **Next task** | **Stage 6 phase 4 — custom fields.** ⚠️ **Spike first, before any UI:** confirm supabase-js `.order()` accepts a JSON path (`custom_fields->>key`) and that it survives `.range()` pagination, against **both** the local stack and the hosted project. Every sortable-custom-column claim rests on it, and the fallback (fixed generic `custom_1 … custom_n` columns) is a different schema. Read "What changed and why" in the Stage 6 section first. |
| **Local database** | **Reset 2026-08-02** and at the documented seed exactly: 32 members, 15 events, 202 present + 5 pending + 1 rejected attendance, 6 adjustments, 2 audit rows, 29 leaderboard rows, `current_term()` = Spring 2026. `seed.sql` now **asserts these counts itself** and aborts if any drifts. ⚠️ `admin_audit` climbs after that: `cleanup()` deliberately leaves audit rows behind (they cannot be deleted — P0001), so a local database that has run `npm test` shows ~10, not 2. Members stay at 32; the suite is member-neutral. ⚠️ The reset wiped local `auth.users`, so **re-create the dev officer before signing in** — command below. |
| **Tests** | **283 across 15 files**, lint and build clean — **and `npx tsc --noEmit` is now clean too, which it had never been.** `tests/` is outside both the lint and the build graph, so run tsc explicitly; the reason it had been passing vacuously is recorded under phase 3. `tests/members.test.ts` is new. |

**Before running anything:** Docker Desktop must be up, then `npx supabase start`. `npx supabase db reset` wipes local `auth.users`, so re-create a local officer afterwards with `node scripts/create-officer.mjs --local --email dev@example.edu --role admin` (password via stdin or `OFFICER_PASSWORD` — **never commit one; this repo is public**).

🪤 **`.env.local` points at the REMOTE project, so `npm run dev` reads production by default.** That is correct for `vercel env pull` and for builds, and completely wrong for a local walkthrough — you get a working admin UI full of real data and no signal that anything is off, because the remote carries the same seed. `.env.development.local` (gitignored via `.env*.local`, created 2026-07-31) pins dev to `http://127.0.0.1:54321` with the CLI's published local keys; Next loads it ahead of `.env.local` in dev, and the dev server prints `Environments: .env.development.local, .env.local` when it is working. **Check that line before trusting anything you see at localhost:3000.** Delete the file to point dev back at the remote.

**Four things that will waste your time if you don't know them:**

- **`npm test` needs `fileParallelism: false`**, already set in `vitest.config.ts`. Don't "optimize" it back on — see the note in `CLAUDE.md`.
- **`supabase gen types --local` omits the `__InternalSupabase` block** that `--linked` emits. Restore it by hand or the diff looks like a regression.
- **Only `npm run build` works locally on Windows**; `vercel build` fails with `EPERM … symlink`.
- **A stale dev server survives an env change.** Env files are read at process start, so adding `.env.development.local` does nothing until you restart — and the old process keeps serving production. Kill it by port rather than trusting that `npm run dev` grabbed 3000; it silently falls back to 3001 and leaves the original running.

---

## Done — Stage 0: Foundations

*Goal: a deployed skeleton, so deployment is never the thing that blocks a feature. Exit: a live URL that reads one row from Postgres. ~half a day.*

- [x] `git init`; add `.gitignore` (`.env*.local`, `node_modules`, `.next`, `.vercel`); commit `docs/`, `CLAUDE.md`, `tasks.md`
- [x] `npx create-next-app@latest` — TypeScript, Tailwind, App Router, ESLint, **no `src/` directory** (§10 puts `app/` and `lib/` at the root). Landed Next **16.2.12** + React 19.2.4 + Tailwind 4. `npm run lint` and `npm run build` both pass.
- [x] Create the GitHub repo and push `main` — now [Texas-MISA/MISA-Website](https://github.com/Texas-MISA/MISA-Website), **public**, owned by the org (transferred from the personal account 2026-07-29, per §2.3)
- [x] Import the repo into Vercel — scope `txmisa-jds-projects` (the MISA email's personal **Hobby** account; Vercel Teams are Pro-only, so there is no Texas-MISA team). Connected to `Texas-MISA/MISA-Website`. Production alias **`misa-website-beta.vercel.app`** (`misa-website.vercel.app` is taken by someone else).
- [x] Deployment Protection no longer SSO-gates production — it defaulted to "All Deployments" on import and now returns 200.
- [x] Confirm push-to-`main` deploys — every commit this session triggered a build
- [x] Create the Supabase project — `misa-website`, ref **`gbxypeofjnhrhotlhyzs`**, region **us-east-2 (Ohio)**, under the MISA account. CLI is linked and `supabase/` is initialized, so migrations go through `db push`.
  - Region chosen as the closest Supabase region to Austin (~1,700 km, vs us-east-1 ~2,000 and us-west-2 ~2,900). Neither AWS nor Vercel has a Texas region. **Regions are fixed at creation** — changing later means recreating the project.
  - Replaces the original `sqgqaxegeawtlccaxdij` in us-west-2, created and discarded the same day.
- [x] **Delete the old `MISA Website` project** (ref `sqgqaxegeawtlccaxdij`, us-west-2) — done; `projects list` now shows only `misa-website`.
- [x] `.env.local` written with `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the new `sb_publishable_…` key format; template committed as `.env.example`). Confirmed gitignored. Service role key unused so far — server-only when it is, never `NEXT_PUBLIC_`.
- [x] **Update the two Vercel env vars to the us-east-2 project** — done in settings.
  - `NEXT_PUBLIC_SUPABASE_URL` = `https://gbxypeofjnhrhotlhyzs.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_CnJ934Lcn_TSFLN02--J2Q_aPa_VEfZ`
  - ⚠️ **`NEXT_PUBLIC_*` values are inlined at build time**, so editing them in Vercel settings changes nothing until a rebuild. Changing an env var always needs a redeploy — a restart won't do it.
  - ⚠️ This cost ~45 minutes across three failed dashboard edits. Root cause: the vars are stored **Sensitive**, so `vercel env pull` returns empty strings and nobody — including the dashboard — can read back what's actually stored. Each edit layered onto invisible state. Symptoms along the way: values in each other's slots, then a stray `│` (U+2502) copied out of a rendered markdown table giving 48 chars instead of 46.
  - ✅ **Fix env vars via the CLI, not the dashboard.** `vercel env rm` all copies, then `printf '%s' "$VALUE" | vercel env add NAME <env>` — no clipboard, no invisible characters. Correct lengths: URL 40 chars, anon key 46 chars, both pure ASCII. `/db-check` prints both lengths, which is what finally made this diagnosable.
- [x] `lib/supabase/server.ts` and `lib/supabase/client.ts` (§10) — `@supabase/ssr` 0.12 pattern, async `cookies()`, lint/build clean
- [x] Throwaway verification page `/db-check` written and **passing locally** (HTTP 200, row renders, RLS-gated via an explicit anon select policy)
- [x] Confirm `/db-check` passes **on the deployed URL** — ✅ https://misa-website-beta.vercel.app/db-check returns 200 and renders the row. Verified request-time (timestamps differ across requests, `X-Vercel-Cache: MISS`), so the Vercel env vars are correct. **Stage 0 exit criteria met.**
- [x] Update the Commands section of `CLAUDE.md` with the verified `dev` / `build` / `lint` invocations and drop the "not yet verified" caveat

**Noted during the scaffold** — carry into later stages:

- `npm audit` reports 12 high-severity advisories, all transitive dev/build-time deps of `eslint` and `next` (`brace-expansion`, `postcss`, `sharp`). **Never run `npm audit fix --force`** — npm's proposed "fix" downgrades Next to 9.3.3. Revisit when `eslint-config-next` supports eslint 10.
- `create-next-app` generated `AGENTS.md` warning that Next 16 diverges from model training data, and a `CLAUDE.md` that was just `@AGENTS.md`. Merged: the project `CLAUDE.md` now imports `AGENTS.md` at the top. Read `node_modules/next/dist/docs/` before writing App Router / caching / Server Action code.
- §10's layout predates Next 16. Where the doc and the framework disagree, the framework wins — record the divergence in the doc.
- First divergence found and recorded (doc v1.3): **`middleware.ts` is deprecated in Next 16, renamed `proxy.ts`**, exported function `proxy()`. The Stage 4 admin gate builds on `proxy.ts`. Note the bundled docs call Proxy a last resort — when Stage 4 arrives, do the session-refresh in `proxy.ts` but keep the real authorization check in the admin layout/server code, not only at the proxy.

---

## Done — schema decisions

§9 listed 11 open decisions. **All eleven are now resolved** — five before Stage 1, the other six on 2026-07-31. Kept in full rather than collapsed to a summary, because the reasoning is what a future officer needs when one of them stops fitting.

**✅ All five schema-affecting decisions resolved 2026-07-29.** Recorded in §9 with the schema in §4 updated to match.

| # | Decision | Resolution |
|---|---|---|
| 2 | Roster policy | **Self-registering, confirmed by the member** (revised doc v1.22). Look up by `normalized_student_id`, then `lower(email)`. Both miss: ticked "first time" → review screen, then create with `source = 'self_checkin'`, active, no officer approval; unticked → nothing written, re-prompt. |
| 3 | Points weighting | Per-event `points`, default 1. |
| 4 | Semester boundaries | **One leaderboard, current term only; terms derived from dates.** One row per member, `total_points` only (no split), ties alphabetical. `events.term` generated from `starts_at` → `'Fall 2026'` / `'Spring 2027'`, half-open at Aug 1 / Jan 1, anchored America/Chicago. Rollover automatic; `app_settings.current_term` is a nullable override. |
| 5 | Excused absences | Deferred post-v1. Rate stays raw `attended / possible`. |
| 7 | Orphan grace window | 48h as one exported constant (`ORPHAN_WINDOW_HOURS`) feeding `nearby_events()`. |

**✅ The remaining six resolved 2026-07-31** — #6, #8, #9, #10 while building Stage 5, and #1 and #11 alongside them. **All eleven §9 decisions are now closed.** New questions belong in Stage 10's backlog rather than here.

The first four share one premise, and the consistency matters more than any single one: **the audit log and the ledger are the control, not a gate.** Revisit all four together if points ever decide something material — officer eligibility, a funded trip, a leadership slot — because that premise is what would change, not the individual arguments.

| # | Decision | Proposed default | |
|---|---|---|---|
| 1 | Leaderboard visibility | **✅ Resolved 2026-07-31 — public, but never indexed.** Full name + points only; no student IDs or emails. `/leaderboard` must set `robots: { index: false, follow: false }` — copy the pattern from `app/admin/(shell)/layout.tsx`. A search cache outlives the deploy that filled it, so this is the one part that can't be walked back. Display-name field or opt-out is the escalation if someone objects. | [x] |
| 6 | Override authority | **✅ Resolved 2026-07-31 — any officer may approve.** The audit log is the control, not a role gate; a gate funnels every correction through whoever is busiest, and the misuse it guards against shows up in `admin_audit` either way. | [x] |
| 8 | Resolution deadline | **✅ Resolved 2026-07-31 — none enforced in v1.** The dashboard pending badge and the oldest-first default sort (both built in phase 1) are the mitigation. A hard deadline would destroy credit for someone who did attend, which is the one outcome §4.2 exists to prevent. | [x] |
| 9 | Point grant caps | **✅ Resolved 2026-07-31 — no restrictions.** Any officer, any amount, no `admin` threshold. A cap invites splitting a grant in two: same total, less readable ledger. `MAX_POINTS_PER_GRANT = 500` in `lib/points.ts` stays a fat-finger guard and is **not** this policy — don't let it drift into being cited as one. | [x] |
| 10 | Self-grants | **✅ Resolved 2026-07-31 — allowed**, always visible in the ledger with the granting officer named. Blocking relocates it to "could you grant me these", which is harder to audit. `grantPoints` carries no self-grant check, and no officer↔member linkage is needed. | [x] |
| 11 | Bonus points publicly | **✅ Resolved 2026-07-31 — a single total, attendance and bonus added silently.** This confirms §4.4 rather than changing it, and closes the contradiction the row carried since v1.16 (it was written expecting a separate public column). The split stays officer-only, in `member_directory` and the `/admin/points` ledger. Accepted cost: a member sees a number and can't tell which part was granted. | [x] |

---

## Done — Stage 1: Data Layer

*Goal: the schema exists and enforces its own rules. Exit: invalid data is rejected by the database, verified by hand in the SQL editor. 1–2 days — don't rush this; schema changes get expensive once UI depends on them.*

**Before starting:** install **Docker Desktop** (decided 2026-07-29) so `supabase db reset` can wipe, re-run all migrations, and re-seed locally. Without it every mistake needs a corrective migration against the remote.

**✅ Stage 1 schema complete 2026-07-29.** Eight migrations applied to `gbxypeofjnhrhotlhyzs` and pushed. Files are named by concern rather than the numbering sketched here, because dependency order forced it: `terms` (defines `term_of`, `app_settings`, `current_term`) must precede `events`, which generates `term`, and `point_adjustments`, which defaults to `current_term()`.

- [x] `20260730000001_terms.sql` — `term_of()`, `app_settings` (single row), `current_term()`
- [x] `20260730000002_members.sql` — `normalized_student_id` generated + unique, `source`, `lower(email)` unique index, not-blank checks
- [x] `20260730000003_events.sql` — `valid_window`, `valid_checkin_window`, generated `term`, `updated_at` trigger, and the overlap **exclusion constraint** (resolved in favour of the constraint over an app-level check; needs no `btree_gist`, since gist handles `tstzrange &&` natively)
- [x] `20260730000004_attendance.sql` — generated `normalized_student_id`, `present_requires_resolution`, partial unique index excluding `rejected`
- [x] `20260730000005_point_adjustments.sql` — `points <> 0`, non-blank `reason`, `void_is_complete`
- [x] `20260730000006_admin.sql` — `admin_profiles`, `admin_audit` + both indexes + append-only triggers
- [x] `20260730000007_resolution_functions.sql` — `open_event_at()`, `nearby_events()`
- [x] `20260730000008_views.sql` — `leaderboard` (total only, anon-readable), `member_directory` (split retained, authenticated only)
- [x] RLS enabled on every table (deny-all until Stage 8) — not in the original plan, but Supabase exposes public tables through PostgREST, so leaving it off would have opened a window with seed data in it

**Departures from the doc, all deliberate:**

- **Check-in windows are half-open `[)`** in both the exclusion constraint and `open_event_at()`. The doc's inclusive `<=` would have made back-to-back events unpublishable — a 6–7 workshop and a 7–8 social collide at exactly 19:00. Verified that adjacent events now coexist.
- Not-blank checks on required text, since `NOT NULL` alone accepts `''`.
- An `updated_at` trigger on `events`; the column existed with nothing maintaining it.

**Types and seed:**

- [x] `lib/types/database.ts` generated — all nine relations and four functions present
- [x] `supabase/seed.sql` — 32 members (3 inactive, 3 self-registered, IDs in mixed formats), 15 events across categories/statuses including one cancelled and two Fall, 208 attendance rows (202 present, 5 pending covering all three orphan shapes, 1 rejected), 6 adjustments including one voided and one negative, 2 audit rows. All identities fabricated on `example.edu` (RFC 2606, unresolvable) — **never replace with a real roster; this repo is public**
- [x] `scripts/seed-remote.sh` — applies the seed without Docker. `supabase db query` reads only the first line of its SQL argument and Windows caps command lines near 8k, so the script strips full-line comments, flattens each `-- @chunk` to one line, and sends them separately. **seed.sql must therefore never use trailing inline comments.**

**✅ Exit criteria met — every rejection verified against the live database by SQLSTATE, not by assumption:**

- [x] `23514` — `ends_at` before `starts_at`; `present` with either link null; `points = 0`; blank reason; incomplete void; blank student_id
- [x] `23P01` — overlapping published check-in windows
- [x] `23505` — duplicate check-in on `(event_id, normalized_student_id)`; members differing only by ID formatting or by email case
- [x] `428C9` — writing the generated `term` column
- [x] `P0001` — `UPDATE` or `DELETE` on `admin_audit`
- [x] Term boundaries: Jul 31 23:59 → `Spring 2026`, Aug 1 00:00 → `Fall 2026`, Dec 31 23:59 → `Fall 2026`, Jan 1 00:00 → `Spring 2027`, and **Jul 31 7pm Central → `Spring 2026`** (the case a UTC anchor would have filed under Fall)
- [x] Behaviours that must *work*: corrected re-entry after a rejection; back-to-back published events; cancelled events keeping attendance history while contributing no points; `open_event_at()` matching during a window and not after; `nearby_events()` returning a suggestion 2h out and **nothing in June**, so a summer submission is refused rather than queued

**Known caveat:** the `admin_audit` append-only trigger does not stop a table owner — cleaning up test rows required disabling it. It blocks the app and every client role; the service-role and dashboard paths are governed by Stage 8's RLS work. §6 currently claims append-only slightly more strongly than the trigger alone delivers.

## Loose ends — all closed 2026-07-30

Carried over from Stage 0; none blocked Stage 2, and all are now resolved. Kept rather than deleted because several record traps worth not rediscovering. The three Bitwarden sub-items are officer-attested; everything else was verified by API or by live HTTP response.

- [x] ~~**Install WSL** (`wsl --install`, needs a reboot) **then Docker Desktop**~~ — **done 2026-07-29; neither install was actually needed.** WSL 2.7.11 (kernel 6.18.33.2) and Docker Desktop 29.6.2 were both already present; Docker had simply never been launched, so the engine pipe didn't exist. No reboot. Two misleading signals cost time: Docker installs to the **user-level** path `%LOCALAPPDATA%\Programs\DockerDesktop`, so a `C:\Program Files\Docker` check reports it missing, and `wsl --list` reported *no distributions* because Docker Desktop brings its own `docker-desktop` distro, created on first launch.
  - **`db reset` then failed for an unrelated reason:** `failed to read profile: Unsupported Config Type ""` / `LegacyGoChildExitError`. Cause was a dangling `~/.supabase/profile` holding the bare name `misa` — no extension, and no `profiles` subcommand or config file defining it — which the legacy Go child hands to viper. `start` and `db query --linked` were unaffected, so it presented as a `db reset`-only fault. Deleted it; `--profile misa` does **not** work around it. Verified afterwards that remote auth is unchanged: still the **MISA** org, still `gbxypeofjnhrhotlhyzs` linked and `ACTIVE_HEALTHY`, so the profile was redundant.
  - ✅ `npx supabase db reset` now wipes, replays all nine migrations, and re-runs `seed.sql`. Local counts match the documented seed exactly — 32 members, 15 events, 208 attendance, 6 adjustments, 2 audit rows, 29 leaderboard rows (32 less the 3 inactive), `current_term()` = `Spring 2026`. This also independently proves the §2.3 handoff path: `migrations/` alone rebuilds the database.
  - Local `config.toml` pins `major_version = 17`; the remote reports 17.6, so local and production agree.
- [x] **Set the Vercel function region to `cle1`** — done 2026-07-29 as **`vercel.json`** (`{"regions": ["cle1"]}`), *not* the dashboard setting the original note assumed. Deliberate divergence: a dashboard-only value is invisible to the repo and lost if the project is ever recreated, which is exactly the §2.3 `create project → link → db push` handoff path. In `vercel.json` it is version-controlled and travels with the code.
  - `cle1` is **us-east-2 (Cleveland)** — the *same AWS region* as the Supabase project, so this is co-location with the database, not merely "closest to Austin." Default for new projects is `iad1`.
  - Hobby allows a **single** function region, which is what this is; multi-region is Pro+ and `functionFailoverRegions` is Enterprise-only, so neither was used. Over-plan region counts fail *before* the build step — `vercel build` got well past that and emitted all functions, so the config is accepted.
  - ✅ **Live in production.** Confirmed by `vercel inspect` on the deployment holding the `misa-website-beta.vercel.app` alias: every function is built into `[cle1]`. Like any build-time setting it took effect only on the next deploy, so a future change to `vercel.json` needs a redeploy too.
- [x] **Confirm Deployment Protection reads Standard Protection**, not Disabled — ✅ confirmed 2026-07-29 **empirically rather than by reading the dashboard label**, which is stronger: the production alias `misa-website-beta.vercel.app` returns **200**, while per-deployment URLs return **302 → `vercel.com/sso-api`**. That pair is the unique signature of Standard Protection — under Disabled the per-deployment URLs would be 200, under "All Deployments" the alias would gate too. No change needed.
  - ~~Worth knowing: **all 22 deployments to date are `Production`, and zero are `Preview`**~~ — **stale as of 2026-07-31.** Preview deployments now exist (the `stage-5-attendance-review` branch has been pushed several times), so the §6 preview exposure is real rather than theoretical. Standard Protection is what contains it: per-deployment URLs return 302 → `vercel.com/sso-api`, so a preview is reachable only by someone signed into the Vercel account. Re-verify that gate before ever sharing a preview URL.
- [x] **Move the DB password** out of the plaintext file in the home directory — **§2.5 resolved 2026-07-30: Bitwarden.** The vault holds the GitHub 2FA recovery codes and the Supabase database password, and §2.4's inventory is filled in. Two follow-ups below; neither is verifiable from this machine, so both are on you.
  - [x] **Original plaintext file deleted.** Copying into the vault was only half of "move"; the original is gone.
  - [x] **Vault is a Bitwarden *organization*, not a personal account** — two users, shared collections, so it satisfies §2.5's "survives one person graduating" and "hand to a successor as a unit."
  - [x] **Bitwarden's own recovery path is not the MISA email**, so the vault holding that mailbox's 2FA recovery codes is not circular.
  - *These three are confirmed by the officer, not machine-verifiable from the repo — unlike the GitHub and Vercel items above, which were checked by API. Re-confirm at handoff.*
- [x] **Add a second GitHub org Owner** to `Texas-MISA` — ✅ **done and verified 2026-07-30.** `gh api /orgs/Texas-MISA/members?role=admin` returns exactly two Owners: **`TXMISA-JD`** (the MISA email) and **`cgonztx-gif`** (officer personal account). They are also the org's only two members. This closes what §2.4 called the one live single point of failure. Re-check at every turnover — a graduating officer's personal account must be *replaced*, not just removed, or the org drops back to a single owner.
- [x] **Narrow org base permissions from Admin to Read** — ✅ **done and verified 2026-07-30.** `default_repository_permission` now reads `read`. No effect on current access (both members are Owners, who keep admin regardless); it shapes what the next officer who joins as a plain member inherits. The local `gh` token now holds `admin:org` (scopes: `admin:org, gist, repo, workflow` — `admin:org` subsumes the old `read:org`).
- [x] **Require 2FA org-wide** — ✅ **done and verified 2026-07-30.** `two_factor_requirement_enabled` now reads `true`. Both Owners survived the flip (`cgonztx-gif`, `TXMISA-JD`), `filter=2fa_disabled` returns 0, and the repo is still reachable — checked explicitly, because enabling the requirement *removes* non-compliant members.
  - 🪤 **Worth keeping: `two_factor_requirement_enabled` is read-only in the REST API.** It exists in the *response* schema of `GET /orgs/{org}` but is **not** a settable body parameter of `PATCH /orgs/{org}`. The PATCH returns success and changes nothing — no error, no effect. Three attempts were lost to this before it was root-caused. **The web UI is the only route:** Organization settings → **Authentication security** → *Require two-factor authentication…*
  - Before adding officers, re-check `filter=2fa_disabled` — a member without 2FA cannot join while the requirement is on.

  - 🔗 **This is now coupled to §2.5, which changes its priority.** `TXMISA-JD` is the shared mailbox account — the recovery root for Supabase, Vercel, and the registrar (§2.4). Binding 2FA to it without storing the **recovery codes** somewhere durable makes handoff *worse*, not better: it is the classic student-org failure where 2FA lives on one person's phone and that person graduates. §2.5 also rules out keeping the codes inside the MISA Google account, since that account is the recovery path for the others.
  - **So pick the vault (§2.5) before enabling 2FA here**, and store the recovery codes as you generate them. The DB password can then move into the same vault in one pass.

**Fixed in passing (2026-07-29):** `npm run lint` started failing with 154 errors in minified code after `supabase start` ran — it writes `supabase/.temp/start-secrets/.../main/index.ts` (the edge-runtime entrypoint), and ESLint flat config does **not** read `.gitignore`, so a gitignored path is still linted. Added `supabase/.temp/**` and `.vercel/**` to `globalIgnores` in `eslint.config.mjs`. This would have hit every officer who runs the local stack. Do not "fix" such errors with `--fix`; the code is vendored, not ours.

## Done — Stage 2: Public landing page (2026-07-30)

*Goal: something worth showing people. Exit: a stranger understands what the org does and when it meets. 2–3 days, mostly content and design rather than logic.*

**Built 2026-07-30**, then immediately **rebuilt as a recreation of the existing site**, [txmisa.org](https://www.txmisa.org/) — all six of its pages, similar UI, real copy. Surveyed page-by-page into [`docs/existing-site-inventory.md`](docs/existing-site-inventory.md), which is the reference for what was reproduced and what was deliberately left out. Expected to be edited heavily later; this is a starting point, not a final design.

- [x] **Real copy** — no longer placeholder: mission, four pillars, MISA history, seven FAQs, both project write-ups, all 13 officers with roles and LinkedIn URLs, and the real emails/socials all came from the live site. `lib/site.ts` and `lib/officers.ts` hold the content; `docs/existing-site-inventory.md` records provenance.
  - Still placeholders, on purpose: **photography** (officer headshots, gallery, project photos) and **partner logos**. Real photos of real people and trademarked logos don't belong in a public repo without permission — cards show initials, gallery/projects show sized tiles. Drop assets into `public/` and swap them in.
  - The **contact form renders but is disabled** — the original posts to Squarespace and there's no replacement backend. Emails are the working path; wiring the form means a Server Action plus a delivery mechanism (§3), which is a later decision.

**Pages** (original Squarespace slugs in parentheses): `/` , `/about` (`/about-us-1`), `/gallery`, `/officers`, `/projects` (`/general-2`), `/contact` (`/contact-us`). Shared chrome in `components/site-header.tsx` (sticky slate-blue bar, centred text wordmark, socials, active-link underline, mobile menu — a Client Component only for `usePathname` and the menu toggle) and `components/site-footer.tsx`. Brand tokens (`--misa-blue`, `--misa-panel`) and the marquee keyframes live in `app/globals.css`; fonts are Roboto Slab + Poppins, approximating the original's slab-serif/geometric-sans pairing.
- [x] Upcoming events pulled live from `events where status = 'published'` and `starts_at > now()` — verified on the rendered page: `Fall Kickoff` appears; the draft `Fall Info Session`, the cancelled `Rained Out Tabling`, and past published events do not. Times render in **America/Chicago** via `Intl.DateTimeFormat` (the server runs in UTC — never format without an explicit zone).
  - This needed one RLS policy **pulled forward from Stage 8**: `20260730000009_events_public_read.sql` — anon/authenticated `select` where `status = 'published'`, which is exactly the §6 grant (doc v1.16). Verified at the PostgREST boundary with the anon key: 13 published rows, no draft, no cancelled. Everything else stays deny-all; all writes stay deny-all.
  - First use of the generated types: `Database` is now threaded through both `createServerClient` and `createBrowserClient`.
- [x] Officer roster — all 13 real officers, `/officers` cards carry LinkedIn buttons, the home grid doesn't (matching the original)
- [x] Mobile-first responsive layout — everything single-column first, grids widen at `sm`/`lg`, nav collapses to a hamburger below `lg`. Sets the conventions §1.2's 20-second check-in inherits.
- [x] Replace the `create-next-app` boilerplate — `app/page.tsx` deleted in favour of `app/(public)/page.tsx`, all five `public/*.svg` boilerplate assets dropped, root layout metadata now TEXAS MISA with a title template
- [x] Stage 0 scaffolding torn down: `app/db-check/` deleted; `_stage0_check` dropped in `20260730000010_drop_stage0_check.sql` (the original `00000000000000_stage0_check` migration stays so `db reset` replays cleanly)

**Verified 2026-07-30:** all six routes return 200 and were eyeballed in the browser; `Fall Kickoff` still shows on the home page and the draft still doesn't; `npm run lint` and `npm run build` both clean (`/` dynamic, the other five static).

## Low priority — deferred, not blocking anything

Cosmetic and content polish on the public site. None of it gates Stage 3 or any
later stage; pick it up between stages or when someone hands over the assets.

- [ ] **Add real photography** — officer headshots (`/officers` and the home grid), gallery photos, project photos. Cards currently show initials; gallery and projects show correctly-sized placeholder tiles, so the layout won't shift much. Drop files in `public/` (e.g. `public/officers/`, `public/gallery/`), then swap the placeholder `div`s for `next/image` — `components/ui/officer-card.tsx`, `app/(public)/gallery/page.tsx`, `app/(public)/projects/page.tsx`. Add a `photo` field to the `Officer` type in `lib/officers.ts` rather than deriving filenames from names.
  - ⚠️ **The repo is public.** These are photos of identifiable students, so get the officers' okay before committing them, and prefer images the org already publishes on the live site.
  - `next/image` needs no config for files served from `public/`; only remote hosts need `images.remotePatterns` in `next.config.ts`.
- [ ] **Add partner logos** — currently rendered as styled wordmarks in `components/ui/partners.tsx` (KPMG, pwc, ConocoPhillips, Credera). Real logos are trademarked; the safe route is the versions each company publishes in its own brand/press kit, used per those guidelines. Worth confirming the partner list is current before spending effort on it.
- [ ] **Decide whether the contact form gets a backend** — it renders disabled with email as the working path. Wiring it means a Server Action plus somewhere to deliver the message (§3: all writes go through Server Actions). Doing nothing is a legitimate answer; the emails work.
- [ ] **The heavier redesign** this recreation is a starting point for.

## Done — Stage 3: Attendance capture (2026-07-30, deployed & smoke-tested)

*The core feature (§7). Code, tests, docs, deploy, and production smoke test all complete.*

- [x] **Vitest chosen** (the Stage 3 decision) — 37 tests in 4 files, integration-first against the **local stack**: real Postgres, timestamps injected into `open_event_at()`/`nearby_events()`, no clock mocking. `npm test` needs Docker Desktop + `npx supabase start`; single test: `npx vitest run tests/checkin.test.ts -t "<name>"`.
- [x] `lib/checkin.ts` — `resolveCheckin()` core (§4.2/§4.3 order), `ORPHAN_WINDOW_HOURS = 48` (the §9 #7 exported constant), `normalizeStudentId()` JS mirror of the SQL expression (lockstep-tested), `checkRateLimit()`. No `next/*` imports, so tests inject clients and time.
- [x] `app/actions/attendance.ts` — `submitCheckin` Server Action: honeypot → zod (`lib/validation.ts`) → per-IP rate limit → resolve. Service-role client only here + `lib/supabase/admin.ts` (`server-only`-guarded).
- [x] `/attend` — three-field, phone-first form (`useActionState`, works pre-hydration); distinct present/pending/duplicate/refused/invalid/rate-limited/error states; in the nav as **Check In** and linked from the home events section.
  - [x] **First-time checkbox + conditional confirmation** (doc v1.22, spec `docs/attend-confirmation-flow.md`). Two more states — `unmatched` (re-prompt, nothing written) and `needs_confirmation` (review screen) — on the same `useActionState` machine, so both steps work pre-hydration. `submitCheckin` stays a single export and takes a `step` field; the confirm pass re-runs honeypot, zod, throttle, and resolution from scratch. Nothing persists between passes, so **no migration**. `RATE_LIMIT_MAX` 30 → 90, since a first-timer now spends two slots.
- [x] **Duplicate rule decided and recorded** (doc v1.18): index on `(event_id, normalized_student_id)` + app check on `(event_id, member_id)` + orphan-resubmission check. Pending orphan never blocks a later resolved check-in; rejected never blocks re-entry.
- [x] Migrations: `…000011_checkin_throttle` (rate-limit table, deny-all RLS) and `…000012_api_role_grants` — **the trap find of the stage**: newer stacks grant the API roles only `TRUNCATE/REFERENCES/TRIGGER` on new tables, so a fresh `create → link → db push` would be silently broken; codified the classic grants, RLS stays the boundary. Types regenerated.
- [x] **§7 exit criteria verified in a real browser** against the local stack: during-window ⇒ `present` on the correct event + member self-registered (`source='self_checkin'`); 1h after close ⇒ `pending` orphan; nothing within 48h ⇒ refused, zero rows. Lint + build green (`/attend` static, action request-time).
- [x] **Deployed 2026-07-30.** `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (the pasted value needed cleaning — leading space + curly quotes from the clipboard, the recurring Stage 0 trap; verified working with a service-role read before use) and in Vercel Production + Preview via CLI. `…000012_api_role_grants` pushed to the remote; migration history in sync.
- [x] **Production smoke test passed**: synthetic published event, fake identity (`T3-777001`) submitted through the live form ⇒ "You're checked in!", row `present` with both links, member self-registered (`source='self_checkin'`, active). Cleaned up in FK order (attendance → member → event → throttle row); remote counts back to the exact documented seed (208/32/15/0).

**§7 exit criteria met in production and locally; Stage 3 complete.** Next: Stage 4 (admin foundation & event management) — until Stage 5 ships, pending orphans accumulate with no UI to resolve them, which is by design for now.

## Done — Stage 4: Admin foundation & event management (2026-07-30, verified locally)

*Officers run the schedule from the UI; every mutation is audited. Doc v1.19. 97 tests across 6 files.*

- [x] **Auth end to end.** `proxy.ts` (session refresh + optimistic redirect), `lib/auth.ts` DAL (`getOfficer`/`requireOfficer`), `app/actions/auth.ts`, `/admin/login`, and `app/admin/(shell)/` carrying the authed chrome.
  - **Session refresh was verified deliberately**, not assumed: `jwt_expiry` dropped to 10s locally, then the token chain checked across several navigations — each request's outgoing cookie became the next request's incoming one, unbroken past three expiries. Restored to 3600 afterwards.
  - 🪤 **`supabase db reset` does NOT re-read `config.toml`.** Container env is baked at `supabase start`, so a changed `jwt_expiry` needs a full `stop` + `start`. Half an hour went into a "session keeps dying" hunt that was really a 10-second token lifetime still live in the auth container. Check `docker inspect supabase_auth_… | grep GOTRUE_JWT_EXP` before believing a config change took.
- [x] **Officer bootstrap** — `scripts/create-officer.mjs` (`--local`, `--reset-password`, `--revoke`). Password comes from stdin or `OFFICER_PASSWORD`, never argv. Only a local dev officer was created; **the production officer is yours to create.**
  - 🪤 **Fixed a latent seed bug:** the stand-in officer in `seed.sql` left eight `auth.users` token/change columns NULL. GoTrue deserializes them into non-nullable Go strings, so `auth.admin.listUsers()` failed with a bare 500 — breaking any lookup-by-email. They are now `''`.
- [x] **Read-only screens** — dashboard (recent check-ins, pending-review badge) and `/admin/events` with term/status/category/series filters, defaulting to `current_term()`. Officers see drafts; the public site still doesn't.
- [x] **`lib/events.ts`** — the pure core: Central wall-clock conversion, half-open window helpers, `expandSeries`, `duplicateDraft`, `previewEventEdit`, `impactToken`, `findWindowConflicts`. No `next/*` imports.
- [x] **Single-event CRUD + lifecycle + audit** — create, edit, publish/unpublish/cancel, duplicate, delete-blocked-with-attendance. `app/actions/audit.ts` is the shared writer.
- [x] **Edit-impact warnings (§4.6)** — points, times moved, term crossed, window narrowed; two-step confirm whose token doubles as an `updated_at` compare-and-set.
  - 🪤 **React 19 resets an uncontrolled `<form action>` after the action resolves.** The first build silently reverted the officer's edits when the warnings rendered, so "save anyway" would have saved the *old* values. Fixed by echoing the submitted values back in the action's state and driving every `defaultValue` from them. Worth remembering for every future admin form.
- [x] **Recurring series + duplicate** — `createSeries`, `publishSeries` with the conflict pre-flight and "publish the rest", `setSeriesStatus`, `duplicateEvent`.
- [x] **Vitest**: `tests/events.test.ts` (pure: DST, half-open windows, impact maths) and `tests/event-actions.test.ts` (integration: 23P01 atomicity, CAS, append-only audit, `term_of`). `vitest.config.ts` aliases `server-only` to a stub so server modules are importable under test.

**Verified against the local stack:** a 12-week Tuesday series spanning the 2026-11-01 DST change generated 12 drafts all reading 18:00 Central while UTC shifted 23:00→00:00; publishing with one deliberate collision named the exact occurrence and refused, then "publish the rest" published 11 and left that week a draft; editing a seeded meeting to 3 points and August warned "19 members' totals change by +2 each (+38 overall)" and "Spring 2026 → Fall 2026" before saving, and the `admin_audit` before/after matched. Lint and build clean.

**Deployed 2026-07-30** (`ebe3233`, plus `64d29e2` making draft-vs-publish an explicit button on the create form). No new env vars and no migrations were needed. The production officer account is registered and `/admin/login` is live; admin routes return 307 to it when signed out, including paths that don't exist, so the gate leaks no route names. **Stage 4 complete.**

## Done — Stage 5: Attendance review & manual adjustments (closed 2026-08-01)

*Officers can see every submission, correct any of them, and award points that never came from a check-in (§7 Stage 5). 5–6 days, shipped in five phases so each ends with something demonstrable. Branch: `stage-5-attendance-review`.*

### ✅ Phase 1 — schema, pure core, read-only queue (2026-07-31, `de352a1`)

- [x] **Migration 13** — `attendance.updated_at` + trigger reusing `set_updated_at()`, and `point_adjustments.void_requires_reason`. **Applied to both local and the remote** (`gbxypeofjnhrhotlhyzs`); migration history in sync. Types regenerated.
  - Checked the remote for violating rows *before* pushing (`(voided_at is null) <> (void_reason is null)` → 0). A constraint that fails mid-migration is a bad way to find out.
  - ⚠️ `supabase gen types --local` omits the `__InternalSupabase` block that `--linked` emits. Restore it by hand or the diff looks like a regression.
- [x] **`lib/attendance.ts`** — interval parsing, `describeGap`, member-candidate scoring with bounded Damerau-Levenshtein, `diffStudentId`, `previewResolution`, `canApprove`. Pure, same contract as `lib/events.ts`.
- [x] **`lib/points.ts`**, six zod schemas, `AuditAction` extended by seven verbs, `seed.sql` audit actions aligned to the union.
- [x] **`/admin/attendance`** — read-only queue, URL-driven filters (status / event / date range / sort), pending + oldest-first by default. Nav unlocked; dashboard badge links in; `StatusPill` extracted for its third caller.
- [x] **59 new tests** (156 total), lint and build clean, verified in a real browser against the local stack: 5 pending rows covering all three orphan shapes, 208 on `status=all` matching the documented seed exactly.

**Two traps found, both now recorded as invariants:**

- 🪤 **Date-range filters must be Central-anchored and half-open.** `to=2026-04-07` has to include the seed's 8:15 PM CT orphans, which are `01:15` **UTC the next day**. A bare `.lte("submitted_at", "2026-04-07")` returns zero rows and looks entirely reasonable.
- 🪤 **`Intl.DateTimeFormat` in a Client Component is a hydration mismatch.** Node and Chrome ship different ICU data for the space before "PM", so React's diff shows two apparently identical strings. Server Components own date formatting.

**And one that predated Stage 5:** `npm test` was failing intermittently at roughly a 50% rate — a different test each run, always a Kong 502 under parallel workers sharing the one local stack. `fileParallelism: false` fixes it; 0 failures across repeated runs, still ~4s.

### ✅ Phase 2 — submission detail (read-only) · verified in the browser 2026-07-31

- [x] `/admin/attendance/[id]` — raw form data as typed, timestamp to the minute in Central, current links, `previewResolution()` warnings
- [x] Ranked event suggestions from `nearby_events()` with the window-relative headline and the event-relative number beside it
- [x] Ranked member candidates with the first differing ID character marked; nothing preselected, empty state says so
- [x] `lib/admin-profiles.ts` → `fetchOfficerNames()`, and the shared `AuditTrail` with a computed before/after diff
- [x] **Verified in the browser** against the local stack, one seeded row per shape (ids are local-only and change on every `db reset` — re-query with `select id, submitted_name from attendance where status <> 'present' order by submitted_at;`):
  - `Luca Moretti` — orphan, member linked, no event ⇒ one suggestion, `General Meeting #6`, "check-in closed 1 hour 15 minutes before this submission (event ended 1 hour 15 minutes before)", `CLOSEST` badge, member section correctly hidden
  - `Rowan Pike` `UT-100999` / `Sage Delacroix` `ut 100998` — event linked, unknown ID ⇒ member suggestions, event section hidden
  - `Toby Vance` — neither link ⇒ the only row rendering **both** sections; `Interview Prep` at 14 hours past close
  - `Bela Kovacs` on the cancelled `Rained Out Tabling` ⇒ the warnings block, "This event is cancelled, so approving here credits nobody"
  - `Mira Petrova` rejected ⇒ the only attendance row with history: "Rejected by **Seed Officer**", note, and the diff `status: pending → rejected` — `fetchOfficerNames()` and `AuditTrail`'s `Diff` both confirmed
  - edges: unknown id ⇒ 404; signed out ⇒ 307 to `/admin/login` with `next` preserved; the Event link reaches the real `/admin/events/[id]`
- [x] 🪤 **Fixed: the near-miss highlight marked the formatting, not the digit.** `diffStudentId` compared the **raw** ID strings, so `ut 100998` vs `UT100028` "first differed" at index 0 — the case of the `u` — and the page rendered `roster `**`U`**`T100028`. The seed stores IDs in four formats precisely because members type them four ways, so this fired on most real pairs and pointed the officer at the one character that carries no information. Now compared on `normalizeStudentId()` with the index mapped back onto the raw string, and null when the two ids are the same person's in different formats. Five tests added; the old ones all used same-format IDs, which is exactly why it survived phase 1. **160 tests** (the "156" recorded earlier was one over the real 155).
- [x] **Deferred to phase 3, and built there** as `lib/event-options.ts`: the independent all-status event picker. `nearby_events()` is published-only and returns nothing beyond 48h, so suggestions alone cannot express every assignment — but the picker is a form control, so it belongs with the mutations rather than on a read-only page.

**Two findings left open at the time — both closed in phase 3:**

- ✅ **Member suggestions surfaced unrelated people at exactly the score floor.** `Rowan Pike` `UT-100999`, on no roster at all, was offered `Dara Nolan`, `Farid Haddad`, and `Omar Silva` (IDs ending `…019`, `…009`, `…029`), each scoring exactly `MIN_SUGGESTION_SCORE` on `id_near_miss` distance 2 alone. Six-digit IDs issued in sequence put three members within distance 2 of *any* number, so that similarity is a coincidence rather than a signal. Distance 2 now scores below the floor and needs corroboration; distance 1 still stands alone. Rowan Pike renders the empty state.
- ✅ **The queue's filters are no longer lost on the round trip** — see phase 3.

**Confirmed as correct, not a bug:** the window-relative and event-relative gap numbers read identically on every seeded row. `describeGap` separates them on purpose, but no seeded event sets `checkin_opens_at`/`checkin_closes_at`, so `effectiveWindow` falls back to `starts_at`/`ends_at` and the two genuinely coincide. Set a late close on an event to see them diverge.

### ✅ Phase 3 — mutations (2026-07-31, browser-verified)

- [x] `app/actions/attendance-review.ts` — `saveSubmission` (one save per officer intent: edit the typed fields, set both links, and approve in a single write and a single `attendance.approved` audit row), `rejectSubmission`, `reopenSubmission`, `bulkAssignEvent`, `createManualAttendance`. CAS on `updated_at` for every single-row mutation; `redirect()` outside the try/catch throughout.
- [x] Approve disabled until both links are set, with a `title` naming the missing one; `canApprove()` re-checked server-side and `present_requires_resolution` still the guarantee
- [x] Bulk assign — explicit selection only, `planBulkAssign()` in `lib/attendance.ts` does the deduping, two statements, auto-approve opt-in and never default, partial success reported with a reason per skipped row
- [x] Manual entry at `/admin/attendance/new` (`source = 'admin_manual'`) — **this also fixed a live 404**: the queue has linked to that route since phase 1 and nothing was there
- [x] The all-status event picker deferred out of phase 2, now `lib/event-options.ts` and shared by the queue filter, the resolution form, and manual entry
- [x] Queue filters survive the round trip — row links, the back-link, and the post-mutation redirect all carry the `searchParams`. Approve and reject return to the *filtered* queue (the drain loop); a plain save stays on the row.
- [x] `createCurrentTermEvent()` and `Tracker.attendanceIds` closed — see below
- [x] **182 tests** (10 new pure, 12 new integration in `tests/attendance-review.test.ts`), lint and build clean

**Verified in the browser against the local stack**, every one a real write: assign + approve in one click wrote exactly one `attendance.approved` row whose before/after showed `member_id` null → set and `pending` → `present`, and returned to the filtered queue with the row drained; a bulk assign of two submissions from the same person assigned one and reported *"Toby Vance — the same person as another row you selected; the earlier submission was kept"* with no 23505; manual entry for Spring Kickoff at 6:15 PM Central stored `2026-01-28 00:15Z` (CST, correctly); reopening a rejected row put it back in the queue.

**Three defects found and fixed during that walkthrough** — none would have been caught by the tests:

- 🪤 **APPROVE stayed disabled after picking an event.** Its enabled state was derived from the server's copy of the row rather than the live `<select>`, so the officer had to SAVE, wait for the round trip, and only then approve — two writes for one intent, defeating the entire one-save design. The link values are now tracked in component state.
- 🪤 **The bulk bar's count outlived its checkboxes.** React resets the form when the action resolves, so after an assign the bar read "2 selected" above six empty boxes. Cleared on completion by resetting state during render.
- 🪤 **Every ordinary officer was credited as "a former officer".** `create-officer.mjs` left `admin_profiles.display_name` null unless `--display-name` was passed, and `fetchOfficerNames` dropped nameless rows — collapsing "current officer, no display name" into "profile deleted, i.e. revoked". In the one log that exists to say who did what (§6), that is the exact opposite of the truth. The map now distinguishes absent from null, the trail says "an officer" for the middle case, and the script defaults the name to the email's local part.

**One doc correction:** the note that the seed's `Mira Petrova` row is the live 23505-on-reopen case is **wrong**. `seed.sql` inserts that rejected row only `where not exists` a non-rejected row for the same member and event, so its slot is by construction free and it reopens cleanly. The collision is real and covered by `tests/attendance-review.test.ts`, which builds the contested pair explicitly — but it cannot be reproduced from seed data.

### ✅ Phase 4 — `/admin/points` (2026-07-31, browser-verified)

- [x] ~~Decide §9 #9 and #10 first~~ — both resolved 2026-07-31: no grant restrictions, self-grants allowed. `grantPoints` carries **no** role check and **no** self-grant check, and says so in its header so neither gets added back as an "oversight".
- [x] `app/actions/points.ts` — `grantPoints` (multi-member, **one atomic insert**, `term` in the `.select()` only and never in the payload) and `voidAdjustment` (guarded on `.is("voided_at", null)`, no CAS token — the table has no `updated_at` and needs none). Two exports and no more: there is no update path and no delete.
- [x] Ledger at `/admin/points` with officer / category / member / date-range / state filters; grant at `/admin/points/new`; adjustment detail at `/admin/points/[id]` with the void form and the shared `AuditTrail`. Nav entry unlocked in the same commit as the page.
- [x] `lib/member-options.ts` — extracted first, in its own commit. `fetchMemberOptions` was duplicated in `attendance/new/page.tsx` and `attendance/[id]/page.tsx` and the copies had drifted; the grant picker was the third caller.
- [x] **26 new tests** (208 total), lint and build clean

**The member picker does NOT carry selection in the URL.** The `?q=…&sel=…` scheme sketched here previously is superseded. Its whole purpose was to survive a navigation — but the roster already arrives as a bounded scan (`MEMBER_SCAN_LIMIT`, and *why* it is a scan rather than an ILIKE probe is recorded on that constant), so the filter runs in the browser and **there is no navigation to survive**. The URL scheme would also have put a 50-uuid list in the address bar and made every keystroke a server round trip. Two things the client-side version must get right instead, both of which produce *a partial grant that reports success*:

- **The payload rides on hidden inputs, not the roster list's checkboxes.** Filtering unmounts rows, and an unmounted input is not in the FormData — so typing a new search term after picking would silently drop the earlier picks.
- **One carrier per id:** the roster list excludes anyone already selected, so no member can be mounted twice (two rows, double points, and no constraint to catch it). `grantPoints` dedupes server-side as the backstop, not as the fix.

**Three defects found in the walkthrough, none of which a test would have caught:**

- 🪤 **The void's audit diff invented changes.** `before` selected more columns than `after`, and `AuditTrail` renders a key missing from one side as `—`, so voiding logged `reason: "Staffed the info booth" → —` and `awarded_by: <uuid> → —` — as though the void had erased the reason and the awarding officer. Both sides now share `AUDITED_ADJUSTMENT_COLUMNS`.
- 🪤 **An oversized selection was truncated rather than refused.** The dedupe sliced to `MAX_GRANT_MEMBERS` *before* validation, so a hand-rolled POST of 60 ids would have granted silently to the first 50 — the exact partial-grant failure the atomic insert exists to prevent.
- 🪤 **`AUDITED_ADJUSTMENT_COLUMNS` must be one unbroken literal with `as const`.** PostgREST types the returned row off the string *literal*; `"a, b" + "c"` widens to `string` and collapses the result to an untyped error shape.

### ✅ Phase 5 — docs (2026-08-01)

- [x] Architecture doc → **v1.20**, `CLAUDE.md` invariants, this file
- [x] Architecture doc → **v1.23** and the `CLAUDE.md` amendments for phase 4 — the atomic-grant exception to the partial-success invariant, the audit-column-symmetry invariant, and the client-side picker superseding `?q=&sel=`
- [x] README replaced — it was still `create-next-app` boilerplate on a **public** repo, telling visitors to edit `app/page.tsx`, which Stage 2 deleted
- [x] Route table and phase table in the architecture doc; two stale `tasks.md` headings (Stage 2 marked "Now"; the `/attend` checkbox filed as "not built")
- [x] **Merged to `main` and deployed 2026-08-01** (`0fe85d2`)
- [x] **Final read-through of the whole stage** — done 2026-08-01, doc → **v1.24**. Re-verified against the running system rather than taken on trust: **208 tests / 10 files pass**, lint and build clean, all **14 migrations identical local and remote**, and every Stage 5 route present in the production build output. Four pieces of drift found and fixed, none of them code:
  - The architecture doc's Stage 5 heading still read *"phases 1–3 of 5 built"* and its status line *"in progress"*, two versions after phase 4 shipped.
  - §5's route table was missing `/admin/events/series` — a live route since Stage 4 — and §10's layout was missing six modules that exist (`/admin/points`, `app/actions/auth.ts`, `lib/event-options.ts`, `lib/member-options.ts`, `lib/admin-profiles.ts`, `lib/supabase/admin.ts`). §10 is the first map a new officer reads.
  - `CLAUDE.md` carried a stale status paragraph — *"Stage 2 (public site) in progress"* — four lines below one saying Stage 5 was complete. Its layout block also listed `lib/filters.ts` and `lib/export.ts` as though they existed, and filed the built `/attend` under "later".
  - The Stage 7 revalidation carry-forward existed only here, in a stage section that gets archived. It is now in the doc's Stage 7 checklist too (see below).
- [x] **Two claims checked against the live databases, both true.** The remote `admin_audit` does carry exactly two pre-Stage-5 rows with the bare verbs `reject` and `void`, permanently uncorrectable — so the "readers must tolerate unknown action values" invariant is load-bearing, not hypothetical. And on the seeded roster `leaderboard.total_points` equals `member_directory.attendance_points + bonus_points` for every member, with the negative adjustment reducing the total and the voided one contributing nothing (§4.4, §9 #11).

**Carry into Stage 7 — now recorded in the architecture doc's Stage 7 section as well, which is where it will actually be read.** `revalidatePoints` in `app/actions/points.ts` deliberately does **not** revalidate `/admin` (nothing on the dashboard aggregates points) and cannot yet revalidate `/leaderboard` (the route doesn't exist). Granting and voiding both move public standings, so **that path must be added the day `/leaderboard` ships** — otherwise it is a stale-cache bug discovered three stages later.

**✅ Both test-harness gaps closed in phase 3** — each would have made green tests that prove nothing:

- **The 2030 fixtures cannot exercise the views.** `helpers.ts` puts fixture events in 2030, so `events.term` is `"Spring 2030"`, and both views filter `e.term = current_term()`; every leaderboard assertion would have passed vacuously at zero. `createCurrentTermEvent()` now places the event a few hours in the past, reads back the generated `term`, compares it to `current_term()`, and throws if they differ — so a run straddling Aug 1 / Jan 1 fails loudly rather than silently asserting nothing. Both values come from the database; no term string is typed (§4.7).
- **`cleanup()` leaked attendance rows with neither link** — it deleted only by `event_id` or `member_id`, and that is the queue's most important fixture shape. `Tracker.attendanceIds` plus a `createTestAttendance()` helper closes it; a full run is now member-neutral (verified 33 → 33). (`point_adjustments` needs no pass: `member_id` cascades.)

## Done — `/attend` first-time checkbox (built in Stage 3, doc v1.22)

Spec: [`docs/attend-confirmation-flow.md`](docs/attend-confirmation-flow.md). Decided **and built** 2026-07-31 — kept here because the reasoning is what a future officer needs when one of these decisions stops fitting, not because anything is outstanding.

A check-in optionally declares "this is my first time". A returning member whose details match is written immediately and sees the same success screen as today — the fast path is unchanged. An unmatched submission from someone who did **not** tick the box is **re-prompted and not written at all**; a first-timer gets a review screen and is written only on confirm.

Three things not to rediscover the hard way:

- **This narrows the "nothing is ever dropped on the floor" invariant** — the amendment is recorded under that invariant in `CLAUDE.md`, and landed with `lib/checkin.ts`.
- **It needed no migration** — nothing is persisted between steps, which is what made it much smaller than it sounded.
- **The membership oracle is accepted**, deliberately and against the stance §6 takes for the officer login. The reasoning is in the spec; don't "fix" it.

## Now — Stage 6: Member directory

*The screen officers will actually live in (§7 Stage 6). **Re-planned 2026-08-01**, after phase 1 had already shipped — see "What changed and why" below. Nine phases now, same shape as Stage 5: each ends in something demonstrable, and each merges to `main` as it lands rather than waiting for the stage. Branch: `stage-6-member-directory` off current `main`.*

**Exit criterion, and the thing to build toward:** an officer filters the directory to members whose **Paid Dues = No**, sees an accurate count, clicks copy-emails, and pastes a complete list — **every** matching member, not just the visible page. That is reachable at the end of **phase 5**; phases 6–9 are the rest of the screen.

The criterion used to read "attended fewer than three events this term". That query no longer fits the screen: `events_attended` is not a directory column any more, and filtering now narrows to what is displayed. It moves to the relational filters in phase 6 — and the replacement is a better demonstration anyway, since it exercises the custom-field machinery that phase 4 introduces.

### What changed and why (2026-08-01)

Four decisions, taken after phase 1 was built, merged, and deployed. Together they invalidated enough of phases 2–6 to be worth re-planning rather than patching.

1. **"Student ID" becomes "EID"** — and not merely as a label. The identifier itself becomes a real UT EID (alphanumeric, `abc1234`), replacing the `UT` + six-sequential-digit format the seed and the suggestion ranker were built around.
2. **The directory shrinks to four columns** — Name, Email, EID, Total Points — plus officer-defined custom fields. Everything else moves to a per-member detail page.
3. **Officers can define their own member fields**, primarily dropdowns (Paid Dues → Yes/No, T-shirt size → S/M/L). Non-calculated fields are editable inline from the directory, and inline-editability is chosen when the field is created.
4. **Sorting and filtering narrow to what is displayed**, custom fields included.

**Two structural consequences drove the new phase order.** Neither is obvious and both are expensive to find late:

- **The detail page can no longer wait until phase 3.** Removing six columns from the directory before their new home exists makes that data unreachable. The column reduction and `/admin/members/[id]` must land in the same phase, and now do.
- 🪤 **`create or replace view` cannot rename an output column.** `member_directory` pins `student_id` as an output name (`20260730000008_views.sql:48`, re-pinned at `20260730000014_member_directory.sql:61`). Renaming it to `eid` needs `drop view` + recreate + re-`grant select … to authenticated`. Migration 14 chose `create or replace` *specifically to avoid* dropping the grant on a §6 security boundary — so this reverses a written rule and is recorded as an exception in `CLAUDE.md` rather than done quietly.

### Schema gaps — three closed by migration 14, three opened by the re-plan

The original four were found by reading `20260730000008_views.sql` and `20260730000002_members.sql` against §7's feature list. **Three are closed:** `member_directory.attendance_rate` exists, `members.notes` exists, and `admin_audit`'s `entity_type` check now carries `'roster'` so an export can be its own receipt row. The fourth is still open, and the re-plan adds two more. Each is cheap now and expensive once the UI depends on it — §7's "don't rush Stage 1" applies again here.

- **`AuditAction` still has no `member.*` verbs.** Phase 4 adds `member.updated`, `member_field.created`, `member_field.updated`, `member_field.archived`; phase 5 adds `roster.exported`; phase 7 adds `member.imported` and phase 8 `member.merged`. The SQL column is free text, so the TypeScript union is the only thing enforcing them — extend it in the same commit as the first mutation that uses one, and add a matching entry to `formatAuditAction`'s `LABELS` or the trail renders the raw verb.
- **`members` has no `updated_at`, so member edits have no compare-and-set anchor.** `events` and `attendance` both carry one; `members` never needed one because nothing edited a member. Inline editing changes that. Phase 4 adds the column and the `set_updated_at()` trigger.
- **Custom field values have nowhere to live, and the storage choice is forced by sorting.** PostgREST orders by column, never by a computed expression — the exact wall migration 14 hit with `attendance_rate` — and a `create or replace` view cannot grow a column per officer-defined field. An EAV values table cannot be sorted from the parent under pagination at all. Phase 4 resolves this with a JSONB column; the reasoning and the fallback are recorded there.

**One inconsistency to decide rather than inherit:** `pending_count` and `last_seen_at` in `member_directory` are **not** term-scoped, while every column beside them is. That is defensible — a pending row from last term still needs review, and "last seen" is a genuinely all-time question — but sitting next to term-scoped point columns they will be read as term-scoped by whoever uses them. **Resolved by the re-plan:** both move to the detail page (phase 3), where they are labelled all-time explicitly and sit apart from the term-scoped block. The "not seen since" filter in phase 6 must carry the same label.

### ✅ Phase 1 — schema, `lib/filters.ts`, read-only `/admin/members` (2026-08-01)

*Numbering note: this is **migration 14** (`20260730000014_member_directory.sql`). The plan above called it "migration 15" by counting files rather than following the existing convention, where `…000013` is "migration 13".*

⚠️ **Partly superseded by the 2026-08-01 re-plan.** Three things built here are replaced in phase 3: the ten-column table, the ten-entry `MEMBER_SORTS` allow-list, and the six view-column filters. **Migration 14 itself stands unchanged** — `attendance_rate`, `members.notes`, and the `'roster'` entity type are all still correct, and `attendance_rate` now backs the detail page instead of a directory column. `lib/filters.ts` keeps its shape (total parse, round-tripping params, pagination outside `applyMemberFilter`, structural query typing); what changes is which columns it knows about.

- [x] **Migration 14** — `attendance_rate` on `member_directory`, `members.notes`, and `admin_audit`'s `entity_type` widened with `'roster'`. **Applied to local and the remote**; types regenerated from `--linked`, so the `__InternalSupabase` block is intact and the diff is purely additive.
  - The view is `create or replace`, not drop-and-create: dropping would take the `authenticated` grant with it, and this view is a §6 security boundary. The replace form can only *append* columns, which is why `attendance_rate` sits last rather than beside the counts it comes from.
  - `events_possible` moved into a CTE. It never depended on the member, and it is now read twice — once as its own column and once as the rate's denominator — so computing it once is what stops the two from ever disagreeing.
- [x] **`lib/filters.ts`** — `parseMemberFilter` (total: every input yields a usable filter), `memberFilterToParams` (round-trips), `applyMemberFilter`, `pageRange`/`pageCount`. Pure, and the query builder is typed **structurally** rather than imported from supabase-js, so the tests hand it a recording fake.
- [x] **`/admin/members`** — server-side sort on all ten columns, pagination, and the six view-column filters. The table is a **Server Component**: phase 1 has no interactivity beyond navigation, so sort headers are links and every date arrives pre-formatted, which sidesteps the hydration trap rather than working around it.
- [x] Nav entry unlocked in the same commit as the page
- [x] **30 new tests** (238 total, 12 files), lint and build clean

**Verified against the local stack** — the whole suite runs member-neutral, leaving the seed at exactly 32/15/208 with the term pin restored:

- **31 fixture members across two pages**: `count` reports 31 while the page returns 25, the two pages together contain all 31 ids exactly once, and repeated reads return the identical split. That last one is the real test — every fixture is tied on points and most share a `joined_at`, so without the `id` tie-break the split drifts between requests and a member vanishes between pages.
- **A member who joined 10 PM Central on the last day of the range is included** — the UTC-midnight cut this invariant exists to prevent.
- `attendance_rate` agrees with the two counts beside it; a member who attended nothing reads a real `0`, not null.
- `minRate=100` becomes `0.5`-style fraction arithmetic, not `100.0` — a unit error there returns an empty list and looks like a legitimately empty result.

🪤 **The `AUDITED_ADJUSTMENT_COLUMNS` trap caught the build again, in a new file.** The directory's column list was written wrapped across three lines with `+`, which widens the literal to `string`, so PostgREST typed the row as `GenericStringError` and `row.id` stopped existing. Same fix, same reason: one unbroken literal with `as const`. It is worth assuming this will happen once per screen that selects more than a handful of columns.

🪤 **`memberFilterToParams` had to learn that `undefined` means "no opinion".** The sort headers pass `{ sort, dir, page }` overrides, and an early version spread `dir: undefined` straight into the filter, which put a literal `dir=undefined` in every column link. Overrides now skip undefined values, and there is a test for it.

**Not done in this phase, deliberately:** the browser walkthrough. Every Stage 5 phase was verified in a real browser and each one found something the tests could not, so this is a genuine gap rather than a skipped formality — see the note under phase 2.

### ✅ Phase 2a — the anon exposure on `member_directory` (2026-08-02, deployed)

*Found while reading the schema to write the EID migration, and split out because it outranked the rename and needed to ship in minutes rather than after a wide refactor. **Migration 15**; the EID rename becomes migration 16.*

- [x] 🔓 **The anon key could read every member's student ID and email**, on local **and production**. Verified at the PostgREST boundary before and after, not inferred — production answered `206` with `Content-Range: */33` and now answers `401 permission denied for view member_directory`.
- [x] **Cause, which is structural and will recur.** `20260730000012_api_role_grants.sql` grants `all privileges on all tables in schema public` to anon and argues it is safe because "RLS is the security boundary". True for tables; **false for views** — `grant all on all tables` includes views, and `member_directory` deliberately runs as owner (`security_invoker` off) so it can aggregate *past* the deny-all tables beneath it. That is what makes it useful and what made an unguarded select on it a total bypass.
- [x] **Why it survived review, which is the part worth remembering:** `members` itself denies correctly (anon gets `[]`), RLS is enabled everywhere, and there are no policies. Every check aimed at the table came back clean. Checking a table proves nothing about a view over it.
- [x] **Migration 15** — `revoke all on public.member_directory from anon`, plus restating the intended grant set for `authenticated` (select only; the write privileges were inert on a non-updatable aggregate view but implied someone had considered them). Applied to local and remote.
- [x] **`tests/security.test.ts`** — enumerates every view the migrations declare, by parsing `supabase/migrations/*.sql`, and asserts anon can select from none but `leaderboard`. Deliberately not a test for this one view: the point is that the **next** view fails here instead of in production. Also asserts `leaderboard` exposes exactly `id`/`full_name`/`total_points`, so it cannot quietly become the next `member_directory`.
  - Needed an anon client in the harness, which did not exist — every other test runs as service_role and therefore cannot observe whether the boundary holds. `global-setup.ts` now exports `ANON_KEY`, and `helpers.ts` has `anonClient()`. The non-local guard is unchanged.
  - **Verified the test fails against the unpatched schema first** (it named `member_directory` as readable), then passes after. 256 tests total.
- [x] ⚠️ **Carry into the EID rename:** `alter default privileges … grant all on tables` means a newly *created* view inherits anon access. `create or replace` does not re-trigger it; **`drop` + `create` does** — and migration 16 must drop and recreate this view to rename its output column. **The recreate must re-issue the revoke**, and re-running the anon check afterwards is the step that catches forgetting it.

### ✅ Phase 2 — the EID switch (2026-08-02, deployed)

*Cross-cutting, mechanical, and wide — **39 code / SQL / test files carrying 480 occurrences**, plus 4 markdown files, measured 2026-08-01 with `grep -riE "student_?id"` excluding `.next` and `node_modules`. Deliberately first and deliberately alone: it touches the public check-in path, the attendance review screens, and the suggestion ranker, and mixing it with the directory rework would leave both unreviewable. First also means every later phase writes `eid` from the start instead of renaming twice.*

- [x] **Walked phase 1 through a browser, 2026-08-01** — against the local stack, signed in as `dev@example.edu`. **It found the fourth defect of exactly the kind Stage 5 kept finding, and no test caught it.**
  - ✅ **Passed:** pagination (29 active over `PAGE_SIZE` 25 ⇒ `1–25 of 29` then `26–29`, no overlap, `← Prev` disabled on page 1); the **total-order tie-break** under the hardest case available — sorted by `joined_at` with 25 members sharing Jan 20, the alphabetical secondary sort continues cleanly across the page boundary (Viktor → Wren); all ten sort headers, `total_points` defaulting descending with ties alphabetical, filters preserved in every sort href, page reset to 1, and **no `dir=undefined` anywhere**; `minRate=50` ⇒ 22 of 32, correctly excluding the 0% inactive members, which is the `0.5`-not-`50.0` arithmetic; `INACTIVE`/`SELF` badges; inactive members reading `0 / 12`, `0%`, `never` — a real zero, not null; a negative bonus (−2 ⇒ total 4); the auth gate preserving `next`.
  - 🪤 **Defect found and fixed: the filter boxes displayed values that were not being applied.** Repro: set *Rate at least* 50 → CLEAR → type 15 into *Points min*. The URL became `?minPoints=15`, but the screen still read *Rate at least: 50* above "9 matching members" — and those 9 were points ≥ 15 alone. **The count did not mean what the screen said it meant.** On this seed the two sets coincide, which is how it would have shipped.
    - **Cause:** the five numeric boxes were `defaultValue` + `onBlur`, i.e. uncontrolled, and React reads `defaultValue` only at mount. CLEAR is a `router.push` with no remount, so they kept the officer's typed text. The selects and date inputs were already controlled and never had the bug. A hard reload hid it, which is why URL-driven checks and the whole test suite missed it.
    - **Fix:** the boxes are controlled off `memberFilterFields(filter)`, resynced with the reset-during-render pattern from `review-queue.tsx`; and `update()` now goes through `memberFilterUrl(filter, changes)` instead of hand-assembling from `new URLSearchParams(searchParams)`. Both live in `lib/filters.ts`, which is what makes them testable and honours "one filter object, one translation".
    - **Why it mattered beyond cosmetics:** this is directly upstream of phase 5's export. "Copy emails for these 9" would have copied a list matching a different filter than the one on screen — the partial-list failure the stage's invariants exist to prevent, arriving through the filter rather than through pagination.
    - **12 new tests** (250 total). Nine are pure; three are a deliberate **source assertion** over `member-filters.tsx`, because the bug lived in JSX and `vitest.config.ts` runs `environment: "node"` — nothing here can render a component, so no behavioural test would fail if someone typed `defaultValue` back. Verified the guard by reintroducing the bug: 2 tests fail, restored, 33 pass.
  - 🪤 **The `—` rate case is not observable on either database, so it was NOT ticked off.** `events_possible` is a term-wide scalar, identical for every member, so `attendance_rate` is null for everyone or for no one. Local and the remote both have 12 completed published Spring 2026 events and **zero** null rates. Seeing `—` requires pinning `app_settings.current_term` to a term with no completed events — a write, so local only. **Still outstanding.**
- [x] **Migration 16 — the rename** (numbered 16, not 15: the anon revoke took 15). Columns, constraints, and indexes renamed; generated-column expressions and CHECK bodies follow a rename by attnum, so only the object *names* needed restating. Applied to local; **remote still pending — see the note at the end of this phase.**
  - [x] **Normalization folded `upper()` → `lower()`** via PG17 `alter column … set expression as (…)`. Both databases are 17.6. Case folding is a bijection on the equivalence classes, so the unique index could not gain a collision.
  - [x] **`member_directory` dropped and recreated** to rename its output column, with the grant restated. ⚠️ **And the anon revoke re-issued** — a recreate re-inherits anon access from `alter default privileges`. Verified after the fact: anon now holds *no* privileges on the view and `authenticated` holds exactly `SELECT`.
  - [x] Types regenerated. `--local` really does omit the `__InternalSupabase` declaration (it survives only in the `Omit<>` reference), so it was spliced back by hand.
- [x] **Retuned the suggestion ranker**
  - [x] **`id_contains` (+35) removed**, along with its `MatchReason` kind and the UI label. Its own comment said it existed for a dropped `UT` prefix; there is no prefix to drop, and `includes` on short alphanumerics clears the floor on its own.
  - [x] **Distance 1 still stands alone; distance 2 stays below the floor.** Kept, but the *reason* changed and that is the part to carry forward: EIDs are derived from name initials, so the near-miss population is **correlated with the roster** rather than spread across a numeric range. Same problem as sequential IDs, from the other direction, and arguably worse — a typo now lands on a plausibly-confusable real person more often.
  - [x] **Recalibrated empirically, and then locked.** `tests/seed-fixtures.test.ts` runs the real ranker over the real seeded roster and asserts Rowan Pike, Sage Delacroix, and Toby Vance each produce **no** suggestions, while an exact EID and a case-variant EID still rank their member first. It also guards the guard: if the seed ever drifts so `rp8571` is far from everyone, the empty-list assertion would pass vacuously, so the distances are asserted too.
- [x] **Code and copy** — `normalizeEid`, both `lib/validation.ts` blocks (floor 2 → 3), `MEMBER_SORTS`, every table header and form label, `tabular-nums` dropped from the EID cell, `/attend` switched to `autoCapitalize="none"` + `autoCorrect="off"`. `tests/attendance-review.test.ts` now **imports** the normalization instead of re-implementing it — the inline copy hardcoded `toUpperCase()` and the fold to `lower()` turned it into a silent no-match, which is exactly the failure that motivated the note.
- [x] **Seed and fixtures regenerated.** EIDs are initials + four digits, written per person rather than generated, because the fixtures depend on exact distances. Case is the format axis now; two rows keep a stray space/hyphen since the generated column still strips them.
  - [x] The three unmatched fixtures were **computed, not guessed** — `rp8571`, `Sd 4390`, `tv7140`, each distance ≥2 from every member and distance 1 from none, with `rp8571` deliberately within distance 2 of three members so the floor has something to reject.
  - ⚠️ **Accepted, at the decision's request:** with no fake-marker block, the fabricated names and `example.edu` mailboxes are the only signals these are invented — weaker than `UT-100023` was on a public repo. Said so in the seed header.
- [x] 🪤 **The seed silently lost a fixture, and now cannot again.** Regenerating the EIDs changed the physical row order of `members`, which changed the seeded `random()` draw in the bulk attendance insert, which filled the slot the rejected-duplicate fixture needed — and its `not exists` guard *skips* rather than fails. Result: still 208 attendance rows, but 203 present / 0 rejected instead of 202 / 1, one review-queue fixture gone and one audit row with it. Fixed by making the member insert `order by last_name` (load-bearing, commented as such) and by adding a **`@chunk assert`** that verifies every documented count and aborts the seed if one drifts. Verified the assertion raises.
- [x] Docs: architecture doc → **v1.27** with §4 DDL, `CLAUDE.md`, `docs/attend-confirmation-flow.md`, `README.md`
- [x] **264 tests** across 14 files, lint and build clean

- [x] **Deployed 2026-08-02.** `db push` then merge in one window, because the rename breaks the deployed build until the code ships with it. The gap was ~40 seconds, measured by polling `/attend` for the `UT EID` label; production is pre-launch so nobody was in it. Verified after: public pages 200, anon **401** on `member_directory`, leaderboard 200.
- [x] 🪤 **The remote re-seed was refused, correctly, and the plan changed because of it.** `bash scripts/seed-remote.sh` aborted at chunk one with `P0001: Refusing to seed: auth.users contains real accounts`. Nothing was deleted or inserted — the script has `set -euo pipefail` and exits per chunk, which is the only reason a partial seed did not land on top of live data. **Do not work around that guard.** Instead, **migration 17** backfills the remote's pre-rename values: idempotent (keyed on `normalized_eid like 'ut1000%'`, which no new EID matches), a no-op on a fresh database (migrations run before `seed.sql`), and it leaves accounts, audit rows, and links untouched.
- [x] 🔴 **The guard was right for a reason nobody had noticed.** The remote holds a **real member** — `Christian A Gonzales / cag7284`, self-registered through the live form — not just a real officer account. A wipe would have destroyed a real person's row. Migration 17 deliberately skips it (already in real EID format). See the cold-start table.
  - **This is also the concrete subject of the phase-2a exposure.** The anon read of `member_directory` was returning a real name, email, and EID, not only fabricated seed rows.

### 🔎 Open questions raised in phase 2, deliberately not acted on

Neither blocks phase 3. Both were found by reading the code and would otherwise be lost.

- **The member-less attendance row is nearly unreachable now, and the seed pretends otherwise.** Under the v1.22 confirmation flow, all three `attendance` inserts in the codebase write a **non-null `member_id`** (`lib/checkin.ts:220` and `:264`, `app/actions/attendance-review.ts:655`) — a submission matching no roster member is re-prompted and never stored. So the check-in form can no longer produce the shape the review screen's member-suggestion half exists for. It is **not** dead code; three paths remain:
  1. an officer clears the picker (`memberId: optionalUuid("member")` in `lib/validation.ts`, written straight into `saveSubmission`'s patch);
  2. `member_id … on delete set null` — deleting a member silently orphans their rows;
  3. rows predating v1.22, which production may hold.
  - **What is actually wrong is the seed:** the three unmatched fixtures omit `source`, so they default to `'self_checkin'`, asserting a provenance the code cannot produce. A reader would reasonably conclude the form still does that. Fix is a comment or an explicit `source`, not a behaviour change.
- ⚠️ **`on delete set null` turns a merge-tool bug into silent data loss** (phase 8). Merge repoints `attendance.member_id` and `point_adjustments.member_id`, then deletes the losing member. If it misses a row, Postgres will **not** raise — it nulls the link, and the attendance survives while the credit does not. That is the §4.2 failure mode arriving through the back door. Decide before phase 8 whether the FK should be `on delete restrict` with an explicit repoint-then-delete, so a miss fails loudly.

### ✅ Phase 3 — the reshaped directory and `/admin/members/[id]`

*These landed together, or the displaced data would have become unreachable. **No migration** — the first Stage 6 phase that needed none, which is what migration 14 was for.*

- [x] **Directory down to four columns** — Name (linking to the detail page), Email, EID, Total Points. `active` and `source` are still selected but are not columns: they drive the INACTIVE / SELF badges beside the name.
- [x] `MEMBER_SORTS` shrinks to `name`, `email`, `eid`, `total_points`. **`email` is newly sortable** — it was displayed in phase 1 but not sortable.
- [x] **Filters trim to the displayed columns**: a total-points range, plus the two exceptions below.
  - ⚠️ **The six retired fields left `MemberFilter` entirely rather than just losing their controls** — a decision taken deliberately, not a shortcut. A filter that still applies with no control on screen is the phase-1 defect arriving from the other direction: a count the officer cannot account for. An old bookmark carrying `minRate=50` now narrows nothing, which is visible and safe, and `memberFilterToParams` does not put it back in the URL. There is a test for exactly that.
  - **`state` (active/inactive) stays, framed as a scope selector rather than a column filter.** It is not a displayed column, but dropping it would strand inactive members with no route to them at all — they are excluded from `leaderboard` too.
  - **Free-text search across name / email / EID moved up from phase 6.**
- [x] `parseMemberFilter` **tolerates** the removed params — it reads by key and is total, so this is free; the test makes it explicit rather than incidental.
- [x] **No column removed from the view.** The detail page needs every one of them.
- [x] **`/admin/members/[id]` — read-only**; mutations arrive in phase 4. Joined, source, active, events attended / possible, attendance rate, attendance points, bonus points, pending count, last seen, the adjustment history, read-only officer notes, and the shared `AuditTrail` with `entityType="member"`.
  - `pending_count` and `last_seen_at` sit in their own **All-time** block, apart from the term-scoped figures and labelled as such — this is where that ambiguity stops. The pending submissions are listed individually and link to `/admin/attendance/[id]`; the queue has no member scope to link to instead.
  - `notes` is **not on the view** until phase 4 appends it, so it takes its own small read against `members`. Rendering it read-only means no column in the schema is unreachable from the UI at the end of this phase.
- [x] **The events grid — current term only**, term named on the grid, published events only.
  - **Three states, not two: attended, missed, and _upcoming_**, in `classifyTermEvents` (`lib/members.ts`, new). `now` is an argument so it is testable without touching the clock, and the boundary is the same half-open one the view uses.
  - Two queries joined in the Server Component, not a PostgREST embed
- [x] `.order("id")` last for a total order, `nullsFirst: false`, `applyMemberFilter` never paginating, one unbroken `as const` select literal — all unchanged
- [x] **283 tests across 15 files** (from 264/14), lint, build and `tsc --noEmit` all clean

**Three things worth carrying forward:**

- 🪤 **Free-text search needs a quoted PostgREST value, and no pure test can prove it.** The `or` group is built as `full_name.ilike."*q*",email.ilike."*q*",eid.ilike."*q*"`. Unquoted, `.` and `,` are filter syntax — and every email is full of both, so `email.ilike.*a.person@example.edu*` parses as a malformed operator rather than as a search. Sanitizing happens once, in `parseMemberFilter` (strips `%`, `*`, `"`, `\`; deliberately keeps `.`, `,`, `@`, `-`, `_`), so nothing downstream needs a second escape pass. `tests/member-directory.test.ts` asserts the dots, a comma, case-insensitivity, and that the group composes with the roster scope as a conjunction rather than replacing it.
- **`tests/member-directory.test.ts` isolates its 31 fixtures on the `t3q` EID marker now**, not on a `joined_at` in 2035 — that filter left with the trim. The marker is the better handle anyway: it selects the fixtures by something deliberately put there rather than by a date they happen to hold, and it puts the new `.or()` in front of real PostgREST, which is the only place a quoting bug can surface. Coverage that left with the retired filters is named in the file header so it is not silently forgotten.
- 🪤 **`tsc --noEmit` had never actually checked the test suite.** `tests/filters.test.ts` declared `type Recorder = FilterableQuery<Recorder> & { calls: Call[] }`, which is circular to tsc — so it inferred `any` for every callback parameter in the file and stopped checking it. An `interface Recorder extends FilterableQuery<Recorder>` resolves lazily and does not. Fixing it immediately surfaced a real latent error in `tests/event-actions.test.ts`, where a `.select()` omitted `ends_at` from a row passed to `effectiveWindow()` — harmless only because that fixture sets an explicit `checkin_closes_at`. Both fixed; the whole repo is now `tsc` clean. Neither `npm run build` nor `npm run lint` covers `tests/`, so run `npx tsc --noEmit` to keep it that way.

### Phase 4 — custom fields

- [ ] ⚠️ **Spike first, before any UI.** Confirm that supabase-js `.order()` accepts a JSON path (`custom_fields->>key`) and that it survives `.range()` pagination, against **both** the local stack and the hosted project. Every sortable-custom-column claim rests on it. If it does not hold, the fallback is a fixed set of generic `custom_1 … custom_n` text columns on `members` — natively sortable, uglier, and capped.
- [ ] **Migration 16 — `member_field_definitions`**: `key` (stable machine key, `^[a-z][a-z0-9_]*$`, unique, rejected if it collides with a built-in sort key), `label`, `kind` (`check (kind in ('select'))` — dropdown only for now, with room to add `text`/`boolean` later without a data migration), `options text[]` (non-empty, no blank entries, bounded), `editable_inline boolean` (**the "option when creating the field"**), `show_in_directory boolean` (otherwise every field ever created widens the table forever), `sort_order`, `archived_at`, plus the house `created_by` / `created_at` / `updated_at` + trigger. RLS enabled, no policies, per every other table.
- [ ] **Values live in `members.custom_fields jsonb not null default '{}'`**, keyed by definition `key`, with a GIN index. The reason is sorting, not taste: PostgREST orders by column and an EAV values table cannot be sorted from the parent under pagination — the same wall migration 14 hit with `attendance_rate`, and a `create or replace` view cannot grow a column per officer-defined field.
- [ ] `members.updated_at` + the `set_updated_at()` trigger — the CAS anchor inline editing needs, and `members` has none today
- [ ] Append `custom_fields` and `notes` to `member_directory` (`create or replace` suffices — appending only), and widen `admin_audit.entity_type` with `'member_field'`
- [ ] **`app/actions/members.ts` and `lib/members.ts`** — the house action shape: `getOfficer()` guard, zod validation that the submitted value is one of the definition's `options` (or empty to clear), CAS on `members.updated_at` carried as the **raw PostgREST string**, `writeAudit`, `revalidatePath`, `redirect()` outside the try/catch. `AUDITED_MEMBER_COLUMNS` as one unbroken `as const` literal, used by **both** sides of the audit before/after.
- [ ] New `AuditAction` verbs — `member.updated`, `member_field.created`, `member_field.updated`, `member_field.archived` — each with a matching entry in `formatAuditAction`'s `LABELS`
- [ ] 🐛 **Fix a latent bug while here:** `AuditEntityType` in `app/actions/audit.ts` is missing `'roster'`, which migration 14 added to the SQL check. The union is the only thing enforcing entity types on the TS side.
- [ ] `parseMemberFilter` gains a definitions argument so it can validate custom sort keys while staying pure (tests pass a fake list). Sort keys are namespaced **`cf:<key>`** so a custom field can never collide with a built-in, and an unrecognized key falls back to `name`.
- [ ] **`/admin/members/fields`** — create, edit, archive definitions. **Archiving never deletes stored values**; a hard delete would silently rewrite history.
- [ ] **Inline editing in the directory.** The table becomes a Client Component for the `<select>` cells — `member-table.tsx` already carries a note that the row markup should move wholesale rather than the file gaining `"use client"`. One small form per editable cell, which sidesteps both the "never `formAction` on a submit button whose `name` you read" and "one carrier per field name" traps at once. Dates must stay pre-formatted props.
- [ ] Detail page gains the full field set (including `show_in_directory = false` fields) and the officer-notes editor, on the same `member.updated` plumbing
- [ ] **Decide and write down who may define fields and who may edit values.** Recommendation: any officer for both, consistent with §9 #6 ("the audit log is the control, not a role gate"). Nothing in the codebase branches on `admin_profiles.role` today, and this should not be the first thing that does.

### Phase 5 — selection and extraction · **exit criteria met here**

- [ ] Row checkboxes plus **"select all N matching this filter"**, visibly distinct from "the 25 rows on this page"
- [ ] Copy emails (comma-separated, ready for a To: field), copy names, copy TSV, download CSV — `lib/export.ts`, pure formatting, **custom-field columns included**
- [ ] Every export writes an `admin_audit` row under entity type `'roster'` with its own generated receipt uuid, carrying the filter — custom-field predicates included — and the row count (§6)
- [ ] Confirmation states the count that was actually copied, not the count that was selected
- [ ] **Settle whether export is admin-only.** §6 says "consider restricting it"; §9 #6 decided any officer may *approve*, which is a different question. Decide it here and record which way and why.

### Phase 6 — the relational filters

- [ ] **Attended *or* missed a specific event** — the query officers ask most often, and the one filter that cannot be expressed on `member_directory` at all: it needs an `attendance` subquery against a chosen `event_id`
- [ ] Has-pending-submissions, and not-seen-since (labelled **all-time**, matching the detail page)
- [ ] The "attended fewer than N events this term" query displaced from the phase-3 trim lands here
- [ ] `FilterableQuery` exposes `eq` / `gte` / `lte` / `or` / `order`. **`or` arrived early in phase 3** for the free-text search; `lt` left with the joined-date range. This phase needs `in`, `not`, and `lt` back — extend the structural type, not the page, and add each to the recorder fake in `tests/filters.test.ts` in the same commit or that file stops compiling.
- [ ] ⚠️ **Flag the tension in the UI.** These filter on data the directory no longer displays, which cuts against the phase-3 trim. Give them their own clearly-labelled advanced panel so it is obvious they narrow the list without being columns — otherwise the count and the visible columns look unrelated.

### Phase 7 — saved presets and CSV import

- [ ] Saved filter presets, shared across officers ("award eligible", "missed last 3 meetings") — a new table, so its own migration, and RLS deny-all in it like every other table
- [ ] CSV roster import: preview-and-confirm, duplicate detection on `normalized_eid`, a dry-run row count before committing. Same preview-then-write shape as the event edit-impact confirm. Adds `member.imported`.

### Phase 8 — the merge tool

*Explicitly allowed to follow the directory rather than gate it (§7, v1.22). Its own estimate.*

- [ ] Preview-and-confirm, one `admin_audit` row naming both sides. Adds `member.merged`.
- [ ] Repoints `attendance.member_id`, `point_adjustments.member_id`, **and now `members.custom_fields`**
- [ ] **Handles the `attendance_one_per_event` collision as a decision, not a silent drop** — when both identities attended the same event, the officer chooses which row survives
- [ ] **Conflicting custom-field values are the same shape of decision.** Two members with different answers for the same dropdown is an officer's call, not a silent overwrite.

### Phase 9 — docs

- [ ] Architecture doc version bump, `CLAUDE.md` invariants, this file
- [ ] Final read-through of the whole stage — Stage 5's found four pieces of drift in one pass, all in docs nobody had reread

### 🪤 Traps specific to this stage

- **`create or replace view` cannot rename an output column** — only append. This is why phase 2 needed an explicit `drop view` and a re-`grant`, reversing what migration 14 wrote down. A migration that drops and forgets the re-grant leaves `member_directory` unreadable by `authenticated` with no error at migration time. Phase 4 appends `custom_fields` and `notes`, which `create or replace` handles — do not reach for a drop.
- **Date filters left `lib/filters.ts` in phase 3 and come back in phase 6.** `joinedFrom`/`joinedTo` were the only Central-anchored half-open range this module carried, so its `centralWallTimeToInstant` / `addCivilDays` import went with them. "Not seen since" needs the same shape back; copy the awarded-date range in `app/admin/(shell)/points/page.tsx`, not a bare `.lte(date)`, which is a UTC-midnight cut that drops five hours and looks reasonable.
- **A JSONB text sort is lexicographic** — `"10"` sorts before `"2"`. Harmless for categorical dropdowns, and a real defect the day someone defines numeric-looking options. Decide then whether to store an explicit `sort_order` per option rather than sorting on the value.
- **An unvalidated `order=` value must never reach the query.** Custom sort keys are validated against the live definition list, never passed through from the URL. This is the one place the `cf:` namespacing is load-bearing rather than cosmetic.
- **The near-miss recalibration is empirical, not analytical.** The existing constants were set by looking at a real review screen offering three strangers, not by reasoning about edit distance. The new ones must be set the same way, against the new seed.
- **Seed EIDs must stay obviously fake.** The repo is public, and EID-shaped values *look* like real credentials in a way `UT-100001` did not.
- **The select-all bug is invisible against the seed.** The roster is **32 members, 29 active** — smaller than two pages at any sensible page size, so "copy emails" will look perfectly correct while silently returning one page. Either seed enough members to exceed the page size or drop the page size in the test; asserting 60 addresses from a 60-row filter across a 25-row page is the whole point of the coverage §7 asks for.
- **A row cap can truncate an export silently, and local and hosted may not agree.** `config.toml` sets no `max_rows`, but the hosted project applies its own — so an export that is complete locally can come back short in production, which is the same partial-list failure wearing a different hat. Verify the effective cap on **both**, and page through explicitly rather than trusting one request.
- **Don't reuse `fetchMemberOptions` for the directory query.** It is an active-only bounded scan built for pickers (`MEMBER_SCAN_LIMIT`, and the reason it is a scan and not an `ilike` probe is recorded on that constant). The directory needs its own paginated query over `member_directory`, including inactive members.
- **Date filters stay Central-anchored and half-open** — `joined_at` and `last_seen_at` both, wherever they survive the phase-3 trim or return in phase 6. The existing `centralWallTimeToInstant` / `addCivilDays` pattern is the one to copy; a bare `.lte(date)` is a UTC-midnight cut that drops five hours and looks reasonable.
- **Server Components own the date formatting** for `joined_at` and `last_seen_at`. Pass formatted labels down as props — and this gets sharper in phase 4, when the directory table becomes a Client Component for the inline `<select>` cells.
- **Admin pages read through `createAdminClient()` behind `requireOfficer()`**, as every existing admin screen does. `member_directory` is granted to `authenticated` only and carries emails and EIDs — never read it from a Client Component with the anon key, and never loosen that grant to make one work.
- **Whether export should be `admin`-role-only is still open.** §6 says "consider restricting it"; §9 #6 decided any officer may *approve*, which is a different question. Decide it in **phase 5** and write down which way and why.

### Carried in from earlier stages — the three §4.2 consequences this screen inherits

All three are the deliberate exact-match design's bill coming due, not defects. Reasoning is in the doc's Stage 6 section (v1.21, revised v1.22).

- 🪤 **Duplicate members still accumulate and nothing merges them — but far fewer of them** (revised v1.22). The main source of ghosts is gone: a double typo used to create a member silently, and now it is refused and re-prompted. What remains is someone who ticks "this is my first MISA event" *and* types badly, which is a narrower and mostly one-shot failure. Ghosts are still findable via `members.source = 'self_checkin'`. A merge must repoint `attendance.member_id` and `point_adjustments.member_id` and can hit `attendance_one_per_event` when both identities attended the same event — a real conflict to decide, not to swallow. Preview-and-confirm, one audit row naming both sides. Smaller in expectation, so it can follow the directory rather than gate it.
- 🪤 **A valid-but-wrong EID silently credits the wrong member — and got slightly *more* likely** (v1.22). The EID lookup runs before the email lookup, so mistyping into *another member's* real EID records you as them even though your own email would have matched. The one path where exact matching attributes attendance to the wrong human with nothing surfaced, and a confident typo that happens to hit a real EID now sails straight through as a matched member. Reordering just trades one silent mis-credit for another, so this is recorded rather than fixed — but merge tooling should assume mis-credits exist, and flagging a submitted-vs-matched email mismatch at check-in is the cheap partial mitigation. **This is the one the member detail page in phase 3 is the mitigation for** — it is where someone finally asks "why does this member have an event they didn't attend?"
  - ⚠️ **The EID switch makes this worse, and the reason is not obvious.** UT EIDs are derived from name initials, so students with similar names hold similar EIDs — the near-miss population is *correlated with the roster* rather than spread across a numeric range the way `UT-1000xx` was. A one-character typo is now meaningfully more likely to land on a real person, and more likely to land on someone plausibly confusable with you. Weigh this again when recalibrating the ranker in phase 2.
- 🪤 **A confirmed first-timer can leave a member row with no attendance.** If an officer already queued a manual row carrying that EID for the event, the member is created and the attendance insert then fails on `attendance_one_per_event`. Pre-existing, rare, and deliberately not fixed in v1.22: the pre-check that would catch it is a fourth duplicate check against the "three checks, not one" invariant. Another `source = 'self_checkin'` row for the directory to surface — a member with zero attendance and a self-registered source is the shape to look for.

## Later

Placeholders — expand on arrival. Effort estimates from §7.

- **Stage 7 — Member-facing views** · 3 days · `/leaderboard` and `/lookup`
  - 🪤 **Add the `/leaderboard` path to `revalidatePoints`** the day the route ships — see the carry-forward note at the end of Stage 5, and the doc's Stage 7 section.
- **Stage 8 — Hardening & data integrity** · 3–4 days · every RLS policy tested with the anon key; historically the stage most likely to be skipped and most likely to be regretted
- **Stage 9 — Launch** · 1–2 days + spreadsheet migration · soft launch with a paper backup sheet on hand
- **Stage 10 — Post-v1 backlog** · parking lot, see §7

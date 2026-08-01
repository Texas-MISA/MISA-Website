# Tasks

Short-horizon working list. The full plan lives in [`docs/student-org-website-architecture.md`](docs/student-org-website-architecture.md); section refs (§) point there. Refill **Later** as stages are reached.

**Stages 0–4 are complete. Stage 5 (attendance review) is in progress — phases 1 and 2 of 5 built.** Carry-over chores from Stage 0 are collected under Loose ends.

---

## 🔖 Picking this up cold (as of 2026-07-31)

Read this before touching anything; it is the state no file can tell you on its own.

| | |
|---|---|
| **Branch** | `stage-5-attendance-review` **merged to `main` 2026-07-31** (`a9b10ac`) and pushed. Both branches exist on the remote; keep working on the branch and merge again at the end of each phase. |
| **Production** | **Stage 5 phases 1–3 are live** on https://misa-website-beta.vercel.app. `/admin/attendance` and `/admin/attendance/new` return 307 to `/admin/login` when signed out (verified). `/admin/points` does **not** exist yet — the nav entry is disabled. |
| **Database** | All 14 migrations applied to **both** local and the remote (`gbxypeofjnhrhotlhyzs`); `migration list --linked` verified in sync before the merge. Phase 4 needs no new migration. |
| ⚠️ **Merged mid-stage** | Stage 5 is 3 of 5 phases done. This was merged early, deliberately, so the work is visible in production — not because the stage is finished. Officers using `/admin/attendance` in production can resolve and approve attendance but cannot yet grant points. |
| **Next task** | **Phase 4 — `/admin/points`.** Phases 1–3 are built and browser-verified as of 2026-07-31. |
| **Local database** | Carries the phase-3 walkthrough's mutations (an approved row, a reopened one, two bulk assigns, a manual entry, one extra fixture row). `npx supabase db reset` restores the documented seed. |

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

## Now — Stage 2: Public landing page

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

## Now — Stage 5: Attendance review & manual adjustments

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
- [ ] **Deferred to phase 3:** the independent all-status event picker. `nearby_events()` is published-only and returns nothing beyond 48h, so suggestions alone cannot express every assignment — but the picker is a form control, so it belongs with the mutations rather than on a read-only page.

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

### Phase 4 — `/admin/points`

- [x] ~~Decide §9 #9 and #10 first~~ — both resolved 2026-07-31: no grant restrictions, self-grants allowed. So `grantPoints` needs **no** role check and **no** self-grant check.
- [ ] Grant (multi-member, one atomic insert, `term` read back never sent), ledger with filters, void-with-reason
- [ ] Member picker carrying selection in the URL (`?q=…&sel=…`) — forms can't nest, so a search is a navigation and hidden inputs would drop every pick from a previous query

### Phase 5 — docs

- [x] Architecture doc → **v1.20**, `CLAUDE.md` invariants, this file
- [ ] Final pass once phases 2–4 land

**✅ Both test-harness gaps closed in phase 3** — each would have made green tests that prove nothing:

- **The 2030 fixtures cannot exercise the views.** `helpers.ts` puts fixture events in 2030, so `events.term` is `"Spring 2030"`, and both views filter `e.term = current_term()`; every leaderboard assertion would have passed vacuously at zero. `createCurrentTermEvent()` now places the event a few hours in the past, reads back the generated `term`, compares it to `current_term()`, and throws if they differ — so a run straddling Aug 1 / Jan 1 fails loudly rather than silently asserting nothing. Both values come from the database; no term string is typed (§4.7).
- **`cleanup()` leaked attendance rows with neither link** — it deleted only by `event_id` or `member_id`, and that is the queue's most important fixture shape. `Tracker.attendanceIds` plus a `createTestAttendance()` helper closes it; a full run is now member-neutral (verified 33 → 33). (`point_adjustments` needs no pass: `member_id` cascades.)

## Designed, approved, not built — `/attend` first-time checkbox

Spec: [`docs/attend-confirmation-flow.md`](docs/attend-confirmation-flow.md). Decided 2026-07-31; implement straight from it.

A check-in optionally declares "this is my first time". A returning member whose details match is written immediately and sees the same success screen as today — the fast path is unchanged. An unmatched submission from someone who did **not** tick the box is **re-prompted and not written at all**; a first-timer gets a review screen and is written only on confirm.

Three things not to rediscover the hard way:

- **This narrows the "nothing is ever dropped on the floor" invariant**, and the amendment must land in the same commit as `lib/checkin.ts`. The note is already parked under that invariant in `CLAUDE.md`.
- **It needs no migration** — nothing is persisted between steps, which is what makes it much smaller than it sounds.
- **The membership oracle is accepted**, deliberately and against the stance §6 takes for the officer login. The reasoning is in the spec; don't "fix" it.

## Later

Placeholders — expand on arrival. Effort estimates from §7.

- **Stage 6 — Member directory** · 4–5 days *plus a merge tool* · the screen officers will live in; select-all-matching semantics need real tests
  - 🪤 **Duplicate members still accumulate and nothing merges them — but far fewer of them** (revised v1.22). The main source of ghosts is gone: a double typo used to create a member silently, and now it is refused and re-prompted. What remains is someone who ticks "this is my first MISA event" *and* types badly, which is a narrower and mostly one-shot failure. Ghosts are still findable via `members.source = 'self_checkin'`. A merge must repoint `attendance.member_id` and `point_adjustments.member_id` and can hit `attendance_one_per_event` when both identities attended the same event — a real conflict to decide, not to swallow. Preview-and-confirm, one audit row naming both sides. Smaller in expectation, so it can follow the directory rather than gate it.
  - 🪤 **A valid-but-wrong student ID silently credits the wrong member — and got slightly *more* likely** (v1.22). The ID lookup runs before the email lookup, so mistyping into *another member's* real ID records you as them even though your own email would have matched. The one path where exact matching attributes attendance to the wrong human with nothing surfaced, and a confident typo that happens to hit a real ID now sails straight through as a matched member. Reordering just trades one silent mis-credit for another, so this is recorded rather than fixed — but merge tooling should assume mis-credits exist, and flagging a submitted-vs-matched email mismatch at check-in is the cheap partial mitigation.
  - 🪤 **A confirmed first-timer can leave a member row with no attendance.** If an officer already queued a manual row carrying that student ID for the event, the member is created and the attendance insert then fails on `attendance_one_per_event`. Pre-existing, rare, and deliberately not fixed in v1.22: the pre-check that would catch it is a fourth duplicate check against the "three checks, not one" invariant. Another `source = 'self_checkin'` row for the directory to surface.
  - All three are consequences of §4.2's exact-match design rather than defects in it; the reasoning is written up in the doc's Stage 6 section (v1.21) and revised in v1.22.
- **Stage 7 — Member-facing views** · 3 days · `/leaderboard` and `/lookup`
- **Stage 8 — Hardening & data integrity** · 3–4 days · every RLS policy tested with the anon key; historically the stage most likely to be skipped and most likely to be regretted
- **Stage 9 — Launch** · 1–2 days + spreadsheet migration · soft launch with a paper backup sheet on hand
- **Stage 10 — Post-v1 backlog** · parking lot, see §7

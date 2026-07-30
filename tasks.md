# Tasks

Short-horizon working list. The full plan lives in [`docs/student-org-website-architecture.md`](docs/student-org-website-architecture.md); section refs (§) point there. Currently scoped through Stage 1 — refill **Later** as stages are reached.

---

## Now — Stage 0: Foundations

*Goal: a deployed skeleton, so deployment is never the thing that blocks a feature. Exit: a live URL that reads one row from Postgres. ~half a day.*

- [x] `git init`; add `.gitignore` (`.env*.local`, `node_modules`, `.next`, `.vercel`); commit `docs/`, `CLAUDE.md`, `tasks.md`
- [x] `npx create-next-app@latest` — TypeScript, Tailwind, App Router, ESLint, **no `src/` directory** (§10 puts `app/` and `lib/` at the root). Landed Next **16.2.12** + React 19.2.4 + Tailwind 4. `npm run lint` and `npm run build` both pass.
- [x] Create the GitHub repo and push `main` — now [Texas-MISA/MISA-Website](https://github.com/Texas-MISA/MISA-Website), **public**, owned by the org (transferred from the personal account 2026-07-29, per §2.3)
- [x] Import the repo into Vercel — scope `txmisa-jds-projects` (the MISA email's personal **Hobby** account; Vercel Teams are Pro-only, so there is no Texas-MISA team). Connected to `Texas-MISA/MISA-Website`. Production alias **`misa-website-beta.vercel.app`** (`misa-website.vercel.app` is taken by someone else).
- [x] Deployment Protection no longer SSO-gates production — it defaulted to "All Deployments" on import and now returns 200.
- [ ] Confirm previews are still gated: Settings → Deployment Protection should read **Standard Protection**, not Disabled. Previews inherit production env vars, so an open preview URL is a second public check-in form writing to the real database (§6).
- [ ] Confirm push-to-`main` deploys
- [x] Create the Supabase project — `misa-website`, ref **`gbxypeofjnhrhotlhyzs`**, region **us-east-2 (Ohio)**, under the MISA account. CLI is linked and `supabase/` is initialized, so migrations go through `db push`.
  - Region chosen as the closest Supabase region to Austin (~1,700 km, vs us-east-1 ~2,000 and us-west-2 ~2,900). Neither AWS nor Vercel has a Texas region. **Regions are fixed at creation** — changing later means recreating the project.
  - Replaces the original `sqgqaxegeawtlccaxdij` in us-west-2, created and discarded the same day.
- [x] **Delete the old `MISA Website` project** (ref `sqgqaxegeawtlccaxdij`, us-west-2) — done; `projects list` now shows only `misa-website`.
- [ ] **Move the DB password out of `C:\Users\dadia\misa-supabase-db-password.txt`.** It's not recoverable from any dashboard, only resettable, and right now it exists on exactly one laptop. Blocked on §2.5 (which vault) — until then, at minimum get a copy somewhere the org can reach.
- [ ] **Add a second GitHub org Owner** to `Texas-MISA` (the MISA account plus one officer's personal account). A sole owner that is an inaccessible mailbox needs a slow manual GitHub support process to recover — the one live single point of failure today (§2.4).
- [ ] **Before adding more officers to the Texas-MISA org, narrow base permissions.** They're currently `Admin`, so every org member automatically gets admin on every repo — including delete and visibility changes. Fine at one member; too broad once officers rotate through. Conventional setup is base `Read`, granting Write/Admin deliberately per person or team. (`cgonztx-gif` is a `member`, not an Owner, and does not need to be: base permissions already give it full repo admin. Owner only adds org-level member/settings/billing management, which the MISA account handles.)
- [ ] Vercel import: connect the **Texas-MISA** org, not the personal account, so the deployment is org-owned too (§2.3). The repo is public, which sidesteps the Hobby-tier restriction on private org repos.
- [x] `.env.local` written with `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the new `sb_publishable_…` key format; template committed as `.env.example`). Confirmed gitignored. Service role key unused so far — server-only when it is, never `NEXT_PUBLIC_`.
- [x] **Update the two Vercel env vars to the us-east-2 project** — done in settings.
  - `NEXT_PUBLIC_SUPABASE_URL` = `https://gbxypeofjnhrhotlhyzs.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_CnJ934Lcn_TSFLN02--J2Q_aPa_VEfZ`
  - ⚠️ **`NEXT_PUBLIC_*` values are inlined at build time**, so editing them in Vercel settings changes nothing until a rebuild. Changing an env var always needs a redeploy — a restart won't do it.
  - ⚠️ This cost ~45 minutes across three failed dashboard edits. Root cause: the vars are stored **Sensitive**, so `vercel env pull` returns empty strings and nobody — including the dashboard — can read back what's actually stored. Each edit layered onto invisible state. Symptoms along the way: values in each other's slots, then a stray `│` (U+2502) copied out of a rendered markdown table giving 48 chars instead of 46.
  - ✅ **Fix env vars via the CLI, not the dashboard.** `vercel env rm` all copies, then `printf '%s' "$VALUE" | vercel env add NAME <env>` — no clipboard, no invisible characters. Correct lengths: URL 40 chars, anon key 46 chars, both pure ASCII. `/db-check` prints both lengths, which is what finally made this diagnosable.
- [ ] **Set the Vercel function region to `cle1` (Cleveland)** — Settings → Functions. Currently `iad1`; `cle1` is both closest to Austin and ~230 km from the us-east-2 database.
- [x] `lib/supabase/server.ts` and `lib/supabase/client.ts` (§10) — `@supabase/ssr` 0.12 pattern, async `cookies()`, lint/build clean
- [x] Throwaway verification page `/db-check` written and **passing locally** (HTTP 200, row renders, RLS-gated via an explicit anon select policy)
- [x] Confirm `/db-check` passes **on the deployed URL** — ✅ https://misa-website-beta.vercel.app/db-check returns 200 and renders the row. Verified request-time (timestamps differ across requests, `X-Vercel-Cache: MISS`), so the Vercel env vars are correct. **Stage 0 exit criteria met.**
- [ ] Then tear down: delete `app/db-check/` and `drop table public._stage0_check;`
- [x] Update the Commands section of `CLAUDE.md` with the verified `dev` / `build` / `lint` invocations and drop the "not yet verified" caveat

**Noted during the scaffold** — carry into later stages:

- `npm audit` reports 12 high-severity advisories, all transitive dev/build-time deps of `eslint` and `next` (`brace-expansion`, `postcss`, `sharp`). **Never run `npm audit fix --force`** — npm's proposed "fix" downgrades Next to 9.3.3. Revisit when `eslint-config-next` supports eslint 10.
- `create-next-app` generated `AGENTS.md` warning that Next 16 diverges from model training data, and a `CLAUDE.md` that was just `@AGENTS.md`. Merged: the project `CLAUDE.md` now imports `AGENTS.md` at the top. Read `node_modules/next/dist/docs/` before writing App Router / caching / Server Action code.
- §10's layout predates Next 16. Where the doc and the framework disagree, the framework wins — record the divergence in the doc.
- First divergence found and recorded (doc v1.3): **`middleware.ts` is deprecated in Next 16, renamed `proxy.ts`**, exported function `proxy()`. The Stage 4 admin gate builds on `proxy.ts`. Note the bundled docs call Proxy a last resort — when Stage 4 arrives, do the session-refresh in `proxy.ts` but keep the real authorization check in the admin layout/server code, not only at the proxy.

---

## Blocking decisions

§9 lists 11 open decisions. Below is a proposed default for each — **my recommendation, your call.** Most confirm the schema already written in §4, so migrations aren't blocked on a long discussion. Check off to accept, or strike through and write your own.

**✅ All five schema-affecting decisions resolved 2026-07-29.** Recorded in §9 with the schema in §4 updated to match.

| # | Decision | Resolution |
|---|---|---|
| 2 | Roster policy | **Self-registering, no confirmation.** Unknown ID → active member created immediately. Resolve by `normalized_student_id`, then `lower(email)`, then create with `source = 'self_checkin'`. |
| 3 | Points weighting | Per-event `points`, default 1. |
| 4 | Semester boundaries | **One leaderboard, current term only; terms derived from dates.** One row per member, `total_points` only (no split), ties alphabetical. `events.term` generated from `starts_at` → `'Fall 2026'` / `'Spring 2027'`, half-open at Aug 1 / Jan 1, anchored America/Chicago. Rollover automatic; `app_settings.current_term` is a nullable override. |
| 5 | Excused absences | Deferred post-v1. Rate stays raw `attended / possible`. |
| 7 | Orphan grace window | 48h as one exported constant (`ORPHAN_WINDOW_HOURS`) feeding `nearby_events()`. |

**Can wait until Stage 4–5**, but decide before the leaderboard determines anything with stakes:

| # | Decision | Proposed default | |
|---|---|---|---|
| 1 | Leaderboard visibility | Fully public. Full name + points only; no student IDs or emails, per the §4.4 privacy note. Add an opt-out or display-name field if a member objects. | [ ] |
| 6 | Override authority | Any officer may approve a pending row. The audit log is the control, not a role gate — a gate just funnels every correction through one person. | [ ] |
| 8 | Resolution deadline | None enforced in v1. The pending badge and oldest-first default sort are the mitigation for a rotting queue. | [ ] |
| 9 | Point grant caps | No hard cap. Ledger visibility and the required reason are the control; a cap invites splitting a grant in two. | [ ] |
| 10 | Self-grants | Allowed, but always visible in the ledger with the granting officer named. Blocking outright just moves it to a friend's account. | [ ] |
| 11 | Bonus points publicly | Shown as a separate column, consistent with §4.4 and with the admin views. | [ ] |

---

## Next — Stage 1: Data Layer

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

**Remaining before Stage 2:**

- [ ] Install WSL (`wsl --install`, needs a reboot) then Docker Desktop, so `supabase db reset` works. Everything above was done against the remote.
- [ ] Drop the Stage 0 scaffolding once something real reads from the database: delete `app/db-check/`, and drop `_stage0_check` in a migration

---

## Later

Placeholders — expand on arrival. Effort estimates from §7.

- **Stage 2 — Public landing page** · 2–3 days · mostly content and design
- **Stage 3 — Attendance capture** · 3–4 days · the core feature; budget most of it for the 7 explicit edge cases in §7, not the happy path. Pick the test framework here.
- **Stage 4 — Admin foundation & event management** · 6–7 days · duplicate-event and recurring-series creation are what make it worth its size
- **Stage 5 — Attendance review & point adjustments** · 5–6 days · until this ships, pending rows accumulate with no way to resolve them
- **Stage 6 — Member directory** · 4–5 days · the screen officers will live in; select-all-matching semantics need real tests
- **Stage 7 — Member-facing views** · 3 days · `/leaderboard` and `/lookup`
- **Stage 8 — Hardening & data integrity** · 3–4 days · every RLS policy tested with the anon key; historically the stage most likely to be skipped and most likely to be regretted
- **Stage 9 — Launch** · 1–2 days + spreadsheet migration · soft launch with a paper backup sheet on hand
- **Stage 10 — Post-v1 backlog** · parking lot, see §7

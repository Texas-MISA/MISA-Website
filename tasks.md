# Tasks

Short-horizon working list. The full plan lives in [`docs/student-org-website-architecture.md`](docs/student-org-website-architecture.md); section refs (§) point there. Currently scoped through Stage 1 — refill **Later** as stages are reached.

---

## Now — Stage 0: Foundations

*Goal: a deployed skeleton, so deployment is never the thing that blocks a feature. Exit: a live URL that reads one row from Postgres. ~half a day.*

- [x] `git init`; add `.gitignore` (`.env*.local`, `node_modules`, `.next`, `.vercel`); commit `docs/`, `CLAUDE.md`, `tasks.md`
- [x] `npx create-next-app@latest` — TypeScript, Tailwind, App Router, ESLint, **no `src/` directory** (§10 puts `app/` and `lib/` at the root). Landed Next **16.2.12** + React 19.2.4 + Tailwind 4. `npm run lint` and `npm run build` both pass.
- [x] Create the GitHub repo and push `main` — now [Texas-MISA/MISA-Website](https://github.com/Texas-MISA/MISA-Website), **public**, owned by the org (transferred from the personal account 2026-07-29, per §2.3)
- [ ] Import the repo into Vercel; confirm push-to-`main` deploys to `*.vercel.app`
- [ ] Create the Supabase project — **under a dedicated org account, not a personal one** (decided 2026-07-29: the personal account's 2-free-project limit is full, and a dedicated account survives officer turnover; ownership/transfer policy now documented in §2.3). Log the CLI in with `npx supabase login --profile misa` so the personal login stays intact, then `npx supabase projects create misa-website --profile misa ...`. Note the region and save the DB password somewhere durable.
- [ ] **Promote `cgonztx-gif` to Owner in the Texas-MISA org** (org → People → role). It was invited as `member`; the repo transfer only worked because the org allows members to create repos. Owner is needed to manage org settings and add officers without logging into the MISA email each time.
- [ ] Vercel import: connect the **Texas-MISA** org, not the personal account, so the deployment is org-owned too (§2.3). The repo is public, which sidesteps the Hobby-tier restriction on private org repos.
- [ ] Env vars in both `.env.local` and the Vercel project: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (template committed as `.env.example`). The service role key, if used at all, is server-only and never prefixed `NEXT_PUBLIC_`
- [x] `lib/supabase/server.ts` and `lib/supabase/client.ts` (§10) — `@supabase/ssr` 0.12 pattern, async `cookies()`, lint/build clean
- [ ] Throwaway verification: a Server Component reads one row from a scratch table and renders it **on the deployed URL**, not just locally — then delete the page and the scratch table
- [x] Update the Commands section of `CLAUDE.md` with the verified `dev` / `build` / `lint` invocations and drop the "not yet verified" caveat

**Noted during the scaffold** — carry into later stages:

- `npm audit` reports 12 high-severity advisories, all transitive dev/build-time deps of `eslint` and `next` (`brace-expansion`, `postcss`, `sharp`). **Never run `npm audit fix --force`** — npm's proposed "fix" downgrades Next to 9.3.3. Revisit when `eslint-config-next` supports eslint 10.
- `create-next-app` generated `AGENTS.md` warning that Next 16 diverges from model training data, and a `CLAUDE.md` that was just `@AGENTS.md`. Merged: the project `CLAUDE.md` now imports `AGENTS.md` at the top. Read `node_modules/next/dist/docs/` before writing App Router / caching / Server Action code.
- §10's layout predates Next 16. Where the doc and the framework disagree, the framework wins — record the divergence in the doc.
- First divergence found and recorded (doc v1.3): **`middleware.ts` is deprecated in Next 16, renamed `proxy.ts`**, exported function `proxy()`. The Stage 4 admin gate builds on `proxy.ts`. Note the bundled docs call Proxy a last resort — when Stage 4 arrives, do the session-refresh in `proxy.ts` but keep the real authorization check in the admin layout/server code, not only at the proxy.

---

## Blocking decisions

§9 lists 11 open decisions. Below is a proposed default for each — **my recommendation, your call.** Most confirm the schema already written in §4, so migrations aren't blocked on a long discussion. Check off to accept, or strike through and write your own.

**Must answer before writing migrations** — these change the schema:

| # | Decision | Proposed default | |
|---|---|---|---|
| 2 | Roster policy | Admin-seeded only. An unknown student ID produces a `pending` row with `member_id` null for an officer to resolve — no self-registration. | [ ] |
| 3 | Points weighting | Per-event `points` from day one, default 1. Already in the schema; costs nothing now, costs a migration later. | [ ] |
| 4 | Semester boundaries | Keep the `term` columns on `events` and `point_adjustments`, but **no leaderboard reset in v1**. Views stay views; convert to term-parameterized functions only if a reset is actually wanted (§4.5). | [ ] |
| 5 | Excused absences | Out of scope for v1. Attendance rate stays raw `attended / possible`. Adding an excuse mechanism means a new table and a rate-calculation change — defer until someone asks. | [ ] |
| 7 | Orphan grace window | 48 hours, defined as a **single exported constant** (e.g. `ORPHAN_WINDOW_HOURS` in `lib/validation.ts`) passed into `nearby_events()`, so tuning it is a one-line change. | [ ] |

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

**Migrations** — numbered, one concern each, SQL copied from §4.1:

- [ ] `0001_members.sql`
- [ ] `0002_events.sql` — including the `valid_window` check and the `status` check
- [ ] `0003_attendance.sql` — the `normalized_student_id` generated column, `present_requires_resolution`, and the partial unique index `attendance_one_per_event` (excludes `rejected` so a corrected re-entry is possible)
- [ ] `0004_point_adjustments.sql` — `points <> 0`, `reason not null`, `void_is_complete`
- [ ] `0005_admin_profiles.sql`
- [ ] `0006_admin_audit.sql` — plus both indexes (`entity` and `actor`)
- [ ] Overlap prevention for published events: decide between a Postgres exclusion constraint (`btree_gist` on the check-in window where `status = 'published'`) and an application-level check at publish time (§4.3). Prefer the constraint if it can be expressed cleanly — §7 Stage 3 calls for explicit test coverage either way.

**Functions and views** (§4.3–4.5):

- [ ] `open_event_at(ts)` — at most one open published event at any instant
- [ ] `nearby_events(ts, window_hours)` — ranked by gap; drives both the refuse/queue decision and the officer's suggestion list
- [ ] `leaderboard` view — `attendance_points` and `bonus_points` separate; excludes `student_id` and `email`
- [ ] `member_directory` view — pre-joined aggregates plus `pending_count`, `last_seen_at`, `events_possible`

**Types and seed:**

- [ ] Generate `lib/types/database.ts`
- [ ] `supabase/seed.sql` — 30+ members (including some inactive, and student IDs with mixed casing/whitespace/hyphens), 10+ past events across categories and statuses, varied attendance including `pending` and `rejected` rows, and a few `point_adjustments` with one voided

**Verify each rejection by hand in the SQL editor** (this is the exit criteria, not a formality):

- [ ] Two overlapping published events
- [ ] Duplicate check-in on the same `(event_id, normalized_student_id)`
- [ ] `ends_at` before `starts_at`
- [ ] `status = 'present'` with a null `event_id` or null `member_id`
- [ ] `point_adjustments` with `points = 0`, or with a null `reason`
- [ ] `voided_at` set without `voided_by`

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

# Testing after the wipe — the plan, and it runs on the LOCAL stack

**Status:** 📋 Plan, written 2026-08-19, the day `bash scripts/wipe-remote.sh`
emptied production ahead of the real Fall 2026 schedule being entered.

Production is now **0 members / 0 events / 0 attendance / 0 dues** and is about
to hold real people. Everything below is what "keep testing" means from here:
**the local stack is the test environment, and the remote is not.** It is short
on purpose — the traps live in [`operations.md`](operations.md), the history in
[`build-log.md`](build-log.md), and the checklist in [`../tasks.md`](../tasks.md).

---

## Why not "just re-seed a branch"

Asked 2026-08-19, and the answer is the reason this file exists.

**A git branch is a deployment, not a database.** Vercel preview deployments read
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
`SUPABASE_SERVICE_ROLE_KEY` from the Preview environment, and today those name
the same project production uses (`gbxypeofjnhrhotlhyzs`). So pushing a branch
and running `seed-remote.sh` does not seed a branch — **it re-inserts the 32
fabricated members into the database that was just cleared for launch.**

Two consequences worth holding on to:

- 🪤 **`npx supabase link` is machine-global.** It changes the target of every
  later `db push`, `db query` and `seed-remote.sh`, for every session on this
  machine. Run `npx supabase projects list` and read the ref back before any
  remote command — this is the `--linked=false` trap wearing a different hat.
- 🔴 **`seed-remote.sh --force` is not a staging tool.** It wipes *and*
  re-inserts. Nothing in this plan needs it.

A remote test environment is possible — a **second free Supabase project**, with
the three env vars scoped to **Preview only** in Vercel — but nothing in the
passes below needs a public URL, and it doubles the number of databases somebody
can point the CLI at by mistake. Stand one up only when an officer has to click
through something from their own phone, and relink when finished.

## Standing it up

```bash
# Docker Desktop must be running first — `docker info` is the check.
npx supabase start          # applies every migration + seed.sql; a full rebuild-from-repo
npx supabase db reset       # back to a known seed, any time after that
node scripts/create-officer.mjs --local --email dev@example.edu --role admin
npm run dev
```

📌 **`db reset` wipes local `auth.users`, so the `create-officer` line is part of
the reset, not a one-off.** And confirm the dev banner reads
`Environments: .env.development.local, .env.local` before trusting anything on
screen — without that first file, `npm run dev` is browsing production.

## What "seeded" means

`seed.sql`'s own assert block is the definition, and an unasserted fixture is an
optional fixture. After a reset, expect exactly:

| | |
|---|---|
| members | 32 |
| events | 15 |
| attendance | 202 present, 5 pending, 1 rejected (208) — of which 1 is `admin_manual` |
| point adjustments | 6 |
| admin_audit | 2 |
| leaderboard rows | 29 |
| custom field definitions | 1 (`shirt_size`) · saved views 0 · officer invites 0 |

If a count differs, the seed did not do what the docs say — read the exception
before reading the screen.

## The passes

`npm test` covers the cores and the boundary; these are the things a test cannot
see. One sitting each, in this order — later rows depend on earlier writes.

| # | Area | Route | Exercise | What it proves |
|---|---|---|---|---|
| 1 | Public v2 | `/`, `/about`, `/projects`, `/gallery`, `/officers`, `/contact` | Every breakpoint down to 360px; keyboard focus on navy grounds; JS off | Phase 2 is landing on the same system phase 1 shipped — five of these are **still v1 inside v2 grounds** |
| 2 | Check-in | `/attend` | Known EID · a typo'd EID with no "first time" tick · first-time + confirm · a closed window · a submission with no open event | The three duplicate checks, and that `unmatched` still means *definitely not on the roster* |
| 3 | Review queue | `/admin/attendance`, `/attendance/[id]`, `/attendance/new` | Approve, reject, bulk assign, the manual entry path | Ranked suggestions unreordered, nothing preselected, CAS on `updated_at` |
| 4 | Events | `/admin/events`, `/events/new`, `/events/series` | Narrow a window with attendance on it; change `points`; try to delete | Edits are not retroactive; the warnings carry real counts |
| 5 | Directory | `/admin/members` + `fields/`, `presets/`, `import`, `merge` | A `cf:` sort, a saved view, a roster import re-run twice, a merge where both identities attended one event | The merge **rejects** the losing row; a re-import is 0 new |
| 6 | Export | `/admin/members/export` | CSV, xlsx and clipboard of the same filter; open the xlsx in Excel | No repair prompt; the formula guard fires on text and not on `bonus_points`; one audit row per export |
| 7 | Dues | `/admin/dues`, `/dues/import` | Import `docs/VenmoStatement_August_2026.csv`, then import it again | The txn-id dedupe; a summer row flagged, not rewritten |
| 8 | Officer turnover | `/admin/officers`, `/officer-invite/[token]` | Mint pinned + open invites; redeem one; expire one; try self-revocation | Claim-before-create, single use, refusal to lock the team out |
| 9 | Member-facing | `/leaderboard`, `/lookup` | EID alone, email alone, both; a term with no completed events | The conjunction gate, one message for every miss, `—` for a null rate |

⚠️ **Pass 1 is the one with the most to find**, because `/about`, `/projects`,
`/gallery`, `/officers` and `/contact` have not been rebuilt yet — walking them
now is reconnaissance for phase 2, not a regression check.

## What the local stack cannot answer

Do not conclude these from a green local run:

- **PostgREST `max_rows`.** The hosted project caps a single unbounded read; local
  does not. `READ_CHUNK` exists for exactly this, and a chunking bug looks fine
  locally and silently returns short rows in production.
- **Anything about the free tier pausing**, the `cle1` region pin, or the real
  domain's aliases.
- **Whether production actually holds what you think.** Read the counts; a
  documented figure about the remote has been wrong before.

## Recording what a pass finds

Findings go in [`build-log.md`](build-log.md) (what was walked, what broke, why),
open items in [`../tasks.md`](../tasks.md). A defect that turns out to be a rule
rather than a bug goes in the Invariants — CLAUDE.md for the rule,
[`invariants.md`](invariants.md) for the measurement behind it.

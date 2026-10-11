# Testing after the wipe — the plan, and it runs on the LOCAL stack

**Status:** 📋 Plan, written 2026-08-19, the day `bash scripts/wipe-remote.sh`
emptied production ahead of the real Fall 2026 schedule being entered.

Production was emptied to **0 members / 0 events / 0 attendance / 0 dues** that
day, and it **now holds real people**: counted 2026-09-30, 65 members, 16
events, 139 attendance rows and 10 officers. That makes the rule below stronger,
not weaker. Everything below is what "keep testing" means from here:
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
and running `seed-remote.sh` does not seed a branch. Without `--force` its guard
refuses, because real officers have signed in. **With `--force` it wipes the
real club data and re-inserts the 32 fabricated members in its place.**

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
| house bingo | 24 squares (seeded by migration 33, which asserts them; `seed.sql` neither wipes nor inserts them) · 0 marks (`seed.sql` wipes and asserts them) |

If a count differs, the seed did not do what the docs say — read the exception
before reading the screen.

🪤 **A bingo rename survives `seed.sql` but not `db reset`.** The seed keeps
`bingo_squares` on purpose, so a square renamed in a walkthrough stays renamed,
and `tests/bingo.test.ts`'s seeded-board case then fails. Its message prints the
one line of SQL that puts the board back; rename it back through the UI or run
that line with `psql`. The seed cannot delete stored files either, so photos and
videos from a walkthrough stay in the local buckets after a re-seed.

## The passes

`npm test` covers the cores and the boundary; these are the things a test cannot
see. One sitting each, in this order — later rows depend on earlier writes.

| # | Area | Route | Exercise | What it proves |
|---|---|---|---|---|
| 1 | Public v2 | `/`, `/about`, `/projects`, `/gallery`, `/officers`, `/contact` | Every breakpoint down to 360px; keyboard focus on navy grounds; JS off | Phase 2 is landing on the same system phase 1 shipped — five of these are **still v1 inside v2 grounds** |
| 2 | Check-in | `/portal/attend` (was `/attend`, which now 308s here) | Known EID · a typo'd EID with no "first time" tick · first-time + confirm · a closed window · a submission with no open event | The three duplicate checks, and that `unmatched` still means *definitely not on the roster* |
| 3 | Review queue | `/admin/attendance`, `/attendance/[id]`, `/attendance/new` | Approve, reject, bulk assign, the manual entry path | Ranked suggestions unreordered, nothing preselected, CAS on `updated_at` |
| 4 | Events | `/admin/events`, `/events/new`, `/events/series` | Narrow a window with attendance on it; change `points`; try to delete | Edits are not retroactive; the warnings carry real counts |
| 5 | Directory | `/admin/members` + `fields/`, `presets/`, `import`, `merge` | A `cf:` sort, a saved view, a roster import re-run twice, a merge where both identities attended one event; in **Fields**, show and hide columns, reload, then sort by a column and untick it | The merge **rejects** the losing row; a re-import is 0 new; the columns survive a reload (the `misa_directory_columns` cookie, HttpOnly: read it in DevTools → Application → Cookies, not `document.cookie`), Name and the sorted column stay on screen, and Reset deletes the cookie |
| 6 | Export | `/admin/members/export` | CSV, xlsx and clipboard of the same filter; open the xlsx in Excel | No repair prompt; the formula guard fires on text and not on `bonus_points`; one audit row per export; the file's header row is the table's columns, in the table's order |
| 7 | Dues | `/admin/dues`, `/dues/import`, `/dues/new`, `/dues/[id]` | Import `docs/VenmoStatement_August_2026.csv`, then import it again. On `/dues/new`, record a Cash payment and a "Decide later" Zelle payment; on a payment's page, save the editor twice without touching it; void one. Then import the statement twice more with the manual rows present | The txn-id dedupe, still holding with manual rows present; a summer row flagged, not rewritten; one row per payment, and Paid derived from the payment (the "Decide later" one covers nothing); the editor keeping its values after Save, so the untouched second Save changes nothing; a hand-entered row never unlinked |
| 8 | Officer turnover | `/admin/officers`, `/officer-invite/[token]` | Mint pinned + open invites; redeem one; expire one; try self-revocation | Claim-before-create, single use, refusal to lock the team out |
| 9 | Member-facing | `/portal`, `/portal/leaderboard`, `/portal/lookup` (the old paths 308 here) | EID alone, email alone, both; a term with no completed events | The conjunction gate, one message for every miss, `—` for a null rate |
| 10 | House bingo (migration 33) | `/admin/bingo`, `/admin/bingo/[house]/[position]`, `/portal/bingo` (and its row on `/portal`) | Browse at `localhost`, not `127.0.0.1`. Upload the synthetic files in `tests/fixtures/bingo/`: the 12 MP JPEG, the EXIF-rotated JPEG with its fake GPS block, the MP4 and the MOV. Replace one proof, remove one, and rename an activity. Keep `/portal/bingo` open in a second window while you do, open a proof dialog while another officer tab records proof, and switch that window's tab away and back. Repeat one save from a stale second officer tab. Tab through the member cards, and use 360 and 390 px widths. Afterwards remove every mark through the UI and rename the square back | The photo is stored at most 2048 px with no EXIF and upright; each video records with a poster and plays, MOV included; replaced and removed files leave the bucket; the stale tab is refused with "Someone else just changed this square"; the member page shows proof within about ten seconds, holds still while a dialog is open, and catches up on becoming visible; every focused tile shows its ring on every edge; no horizontal overflow; four cards at "0 of 24" again at the end |

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
- **House bingo on the real stack** (migration 33). The upload route's host
  check against the headers Vercel actually sends, Vercel's 4.5 MB body limit,
  the hosted signed-token lifetime, and the Free plan's Storage and egress
  quotas: the local stack has no quota to exceed, which is why the uploader's
  "Storage is full" wording is unverified. The first real upload on production
  is the end-to-end check. A real iPhone is the other gap: HEIC handed over as
  JPEG on pick, a `.MOV`, the dialog's focus, and the `dvh` heights.
- **Whether production actually holds what you think.** Read the counts; a
  documented figure about the remote has been wrong before.

## Recording what a pass finds

Findings go in [`build-log.md`](build-log.md) (what was walked, what broke, why),
open items in [`../tasks.md`](../tasks.md). A defect that turns out to be a rule
rather than a bug goes in the Invariants — CLAUDE.md for the rule,
[`invariants.md`](invariants.md) for the measurement behind it.

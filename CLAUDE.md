# CLAUDE.md

@AGENTS.md

This file provides guidance to Claude Code when working with code in this repository. It is the **working brief**: current state, the rules that must not be reversed, and where everything else is written down.

## Where the documentation lives

| File | What it is |
|---|---|
| [`docs/student-org-website-architecture.md`](docs/student-org-website-architecture.md) | **The source of truth.** § references throughout this file point into it. Update it and bump its version header whenever a decision changes. |
| [`tasks.md`](tasks.md) | Short-horizon checklist, the state table (migration counts live there and nowhere else), and open items. |
| [`docs/build-log.md`](docs/build-log.md) | Stage-by-stage history — what shipped each phase, what broke, what the walkthroughs found. Read it when you need to know *why* something is the way it is. |
| [`DESIGN.md`](DESIGN.md) | 🎨 **THE DESIGN SOURCE OF TRUTH, site-wide, and it is v2 as of 2026-08-19.** Grounds, elevation, surfaces, type ramp, spacing, reveal variants, layout-family budget, photography pipeline, design invariants (photography, headshots, marquee, nav clearance) and design skill precedence. ⚠️ Marks which surfaces are **NOT YET REBUILT**. |
| [`docs/design-v1-superseded.md`](docs/design-v1-superseded.md) | The v1 design system, kept verbatim for its reasoning. **Historical.** Where it and `DESIGN.md` disagree, `DESIGN.md` wins. |
| [`docs/invariants.md`](docs/invariants.md) | **The long form of all invariants below,** with measurements and failures. The short form here is the rule; that file is the evidence. |
| [`docs/layout.md`](docs/layout.md) | **Full annotated layout** — every file, module and component with one-line annotations. Extracted from this file to save context. |
| [`docs/operations.md`](docs/operations.md) | Dev-server, Supabase CLI and test-suite traps in full. |
| [`docs/local-testing-plan.md`](docs/local-testing-plan.md) | 📋 **Where testing happens now that production is empty: the LOCAL stack.** |
| [`docs/dues-and-membership.md`](docs/dues-and-membership.md) | Stage 6.5 spec, including the real Venmo CSV format — and the plan for **manual dues entry**, which is written down but NOT BUILT. |
| [`docs/attend-confirmation-flow.md`](docs/attend-confirmation-flow.md) | `/attend`'s first-time confirmation and the accepted membership-oracle tradeoff. |
| [`docs/checkin-location-verification.md`](docs/checkin-location-verification.md) | ✅ **BUILT — migration 28, 2026-08-22.** Spec and threat model. *What this cannot catch* is the main thing to read before trusting a flag. |
| [`docs/rsvp-events.md`](docs/rsvp-events.md) | 📋 **NOT BUILT.** The "cannot use `/attend`" rule is three SQL changes; penalty disclaimer would trigger reopening §9 #5/#6/#9/#10/#12. |
| [`docs/existing-site-inventory.md`](docs/existing-site-inventory.md) | What was reproduced from the old Squarespace site and what is a placeholder. |
| [`docs/frontend-redesign-v2-plan.md`](docs/frontend-redesign-v2-plan.md) | 🏗️ **THE CURRENT PLAN, PART-BUILT.** ✅ Phases 0–2 complete. ⬅️ Phase 3 is next (`/attend`, `/leaderboard`, `/lookup`), then 4 (`/admin`) and 5 (reconcile `docs/invariants.md`). |
| [`docs/frontend-redesign-plan.md`](docs/frontend-redesign-plan.md) | 📋 **SUPERSEDED by v2 above**, kept for reasoning. |

## Repository status

**Stages 0–8 are COMPLETE. Stage 9 (launch) is next.** 29 migration files, through `…000028`. ⚠️ **Local is AHEAD of the remote**: migration 28 (`checkin_origin`) is applied locally and **not yet pushed**, and the code that reads it is not deployed either, so the two are in step — push them together. The next unclaimed number is **29**. 🪤 **26 and 27 were written by two sessions at once and both claimed 26 for a few minutes** — the collision surfaced as a 23505 on `schema_migrations_pkey` during `db reset`.

⚠️ **PRODUCTION IS THE CLUB'S REAL PUBLIC DOMAIN, https://www.txmisa.org.** A merge to `main` replaces the live club website. The production deployment's aliases are `www.txmisa.org`, `misa-website-txmisa-jds-projects.vercel.app` and `misa-website-git-main-txmisa-jds-projects.vercel.app`; confirm with `npx vercel inspect <deployment-url>`. `git push origin <branch>` without merging gives a preview URL instead.

Next.js 16 deploys from `main` to https://www.txmisa.org; the Supabase project (`gbxypeofjnhrhotlhyzs`, us-east-2) is linked, migrated and seeded.

What exists, in one pass:

- **Public** — `app/(public)/` follows the design handoff prototypes. ✂️ **`/projects` is UNLISTED as of 2026-08-23 (officer, temporary)** — the route resolves and the page renders, it is linked from nowhere. **Relisting it is exactly four places**, each commented and each naming the others: `SITE_NAV` and `MOBILE_NAV` in `components/site-header.tsx`, the `robots` key in `app/(public)/projects/page.tsx`, and the "All projects →" link on the home page's projects band. `/contact` is unlisted from the desktop nav. Copy lives in `lib/site.ts` and `lib/officers.ts` — edit those, never hardcode into pages.
- **Officers** — `/admin` covers events, the attendance queue and review, the points ledger, the member directory (custom fields, filters, presets, roster import, merge, CSV/xlsx export), dues, and `/admin/officers`.
- **Officer turnover** — officers are added by an expiring single-use invite link from `/admin/officers` (migrations 24–25), not by running `scripts/create-officer.mjs` with the production service key.
- **Stage 8** hardened the boundary (migration 22 closed a live hole), added attendance and adjustment archives (migration 23), and fixed empty-vs-error conflation.

🖼️ **Photographs ARE COMMITTED and they ship (officer decision, 2026-08-19).** `public/photos/` holds 143 tracked web-sized images. `pictures/` (the officer's raw library) stays gitignored. 🔴 **The repository is public** — a removal request is a git history rewrite, not a delete. Full photography rules: `DESIGN.md` §Design invariants.

🧹 **PRODUCTION IS EMPTY (2026-08-19).** 0 members / 0 events / 0 attendance / 0 adjustments / 0 dues. What survived: three real officer logins, all 4 `officer_invites`, and 8 `admin_audit` rows recording officer access. `seed.sql` describes **local** (32 fake members, 15 events, 208 attendance rows) — that must stay obviously fake.

## Next.js version

**This is Next.js 16**, and `AGENTS.md` warns that its APIs, conventions, and file structure differ from what's in model training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing App Router, caching, or Server Action code. Heed deprecation notices in build output.

## Commands

```bash
npm run dev                 # dev server (Turbopack is the default in Next 16)
npm run build               # production build
npm run start               # serve the production build
npm run lint                # eslint (flat config in eslint.config.mjs)

npm test                    # all tests (needs: Docker Desktop up, npx supabase start)
npm run test:watch
npx vitest run tests/checkin.test.ts -t "<test name>"
```

```bash
npx supabase db push                    # apply pending migrations to the linked project
npx supabase db reset                   # wipe, re-run migrations + seed.sql (local; needs Docker)
npx supabase db query --linked "<sql>"  # ad-hoc SQL against the remote
npx supabase gen types typescript --linked > lib/types/database.ts
bash scripts/seed-remote.sh             # apply seed.sql to the remote (no Docker needed)
bash scripts/seed-remote.sh --force     # ...even if the project has a real officer signed up
bash scripts/wipe-remote.sh             # EMPTY the remote's club data, keeping officer access
                                        # and the officer-turnover audit trail. NOT seed-remote:
                                        # that one re-inserts the fabricated fixtures

# 🪤 When the Supabase CLI will not run but the containers are fine, talk to
# Postgres directly. This takes MULTI-LINE SQL and heredocs, unlike `db query`,
# which reads only the first line of its argument.
docker exec -i supabase_db_MISA-Website psql -U postgres -d postgres -tA <<'SQL'
select count(*) from members;
SQL
```

```bash
# Officer accounts (§2.3, §6). Password comes from stdin or OFFICER_PASSWORD,
# never argv. `db reset` wipes local auth.users, so re-run --local after one.
node scripts/create-officer.mjs --local --email dev@example.edu --role admin
node --env-file=.env.local scripts/create-officer.mjs --email you@utexas.edu --role admin
node --env-file=.env.local scripts/create-officer.mjs --email you@utexas.edu --reset-password
node --env-file=.env.local scripts/create-officer.mjs --email them@utexas.edu --revoke
```

Regenerate `lib/types/database.ts` after **every** migration.

The traps, each of which fails silently. Full text in [`docs/operations.md`](docs/operations.md):

- 🪤 **`.env.local` points at the remote, so `npm run dev` reads production** unless `.env.development.local` pins it local. Confirm the `Environments:` line in the dev banner.
- **`db query` reads only the first line of its SQL argument**, and it targets the **remote** unless you pass `--local` — `--linked=false` parses as `--linked`.
- **`db reset` needs Docker Desktop running** and does **not** re-read `config.toml` — an `[auth]` change needs a full `stop` + `start`.
- 🪤 **`fileParallelism: false` in `vitest.config.ts` is load-bearing** — the local Kong gateway 502s under parallel workers.

## Architecture

Next.js App Router on Vercel → Supabase Postgres. No separate API service: Server Components read, Server Actions and Route Handlers write. Authorization lives in Postgres Row Level Security, not in the frontend (§2, §3).

Three audiences, one codebase:

| Audience | Auth |
|---|---|
| Public — org info, upcoming events | none |
| Members — check in, leaderboard, own history | none; identity-based (EID + matching email), no accounts in v1 |
| Officers — schedule, roster, attendance review, points | Supabase Auth session + a matching `admin_profiles` row, enforced by `proxy.ts` |

Domain model: `members` ↔ `events` ↔ `attendance`, plus `point_adjustments`, `dues_payments`, `admin_profiles`, `officer_invites`, and one `admin_audit` log. Aggregates live in the `leaderboard` and `member_directory` views rather than in application code (§4). Routes are listed in §5.

## Invariants

Decisions the architecture doc argues for at length. **Don't quietly reverse one.** The short form is here; `docs/invariants.md` carries the measurements and failures behind each rule. **If removing a bullet, confirm it is in `docs/invariants.md` first.**

### Security and privacy

- **All writes go through Server Actions or Route Handlers.** Browser holds only the anon key. Service-role client exists **only** in `lib/supabase/admin.ts`, guarded by `server-only`.
- **No unauthenticated route returns an email or EID.** The `leaderboard` view deliberately omits both.
- 🔓 **A grant to `authenticated` is a grant to the public whenever signup is open.** Officer-ness is an `admin_profiles` row in `lib/auth.ts`, not a PostgREST role. **No API role holds any grant on `member_directory`.**
- 🔓 **A view has no RLS; every non-public view must `revoke all … from anon`, and every recreate must re-issue the revoke.** `drop` + `create` re-triggers default privileges; `create or replace` does not. `tests/security.test.ts` allows only `leaderboard`.
- **RLS is enabled on every table, deny-all.** Exception: `events_public_read` grants anon `select` on published events. New tables ship deny-all in their own migration.
- **`/leaderboard` is public but must never be indexed** (`robots: { index: false, follow: false }`).

### Officer invites (migrations 24–25)

- 🔓 **Only `sha256(token)` is stored.** Never add a column holding the raw token; never return it from a read.
- 🔓 **The role comes off the stored row.** `inviteAcceptSchema` has no `role` key — a posted role is discarded structurally.
- 🔓 **Claim BEFORE creating the account.** The conditional `UPDATE` is both the single-use and the concurrency guard; failure after it burns the invite and grants nothing.
- ⚠️ **`email is null` is an open invite — a bearer credential redeemable by the holder.** Two structurally separate schemas, never a `??` merge.
- 🪤 **`/officer-invite/[token]` lives OUTSIDE `/admin`.** `proxy.ts` matches `/admin/:path*` and would redirect every invite recipient to login.
- ⚠️ **Self-revocation is refused,** which is what makes team-wide lockout unreachable.

### Check-in and member resolution

- **The duplicate rule is three checks:** the `(event_id, normalized_eid)` partial unique index (23505), an app check on `(event_id, member_id)` after resolution, and an app check for a prior pending orphan within the grace window.
- **Nothing that resolves to a known member is ever dropped.** Stored as `pending` if no open event.
- **`present_requires_resolution` is load-bearing.** `status = 'present'` guarantees both `event_id` and `member_id` are non-null. Never work around it.
- **Match and dedupe on the normalized generated column, never the raw value.** `members.normalized_eid` / `attendance.normalized_eid`, folded to `lower`.
- **A near-miss EID needs corroboration at edit distance 2; distance 1 stands alone.** Don't auto-resolve.
- 🔓 **`/lookup`'s gate is a CONJUNCTION in one query,** never `lib/checkin.ts`'s ordered fallback; two lookups or an `.or()` silently reduce it to EID-alone. **One `unmatched` outcome and one message for every miss.** **`/lookup` throttles in its own bucket** (`hashClientIp("lookup")`).

### Check-in location verification (migration 28)

📋 **Spec and threat model: [`docs/checkin-location-verification.md`](docs/checkin-location-verification.md).** Evidence in `docs/invariants.md` §Check-in location verification. Read *What this cannot catch* before trusting a flag.

- 📌 **ADVISORY ONLY.** Rejects no check-in, moves no row to `pending`, withholds no points, writes no `admin_audit` row.
- 🔓 **`event_id` is INSIDE the hash.** `sha256(PEPPER || event_id || normalize(ip))` — unjoinable across events is the feature. Never optimise it out.
- 🔓 **`CHECKIN_ORIGIN_PEPPER` is a server-only env secret, never a repo literal.** IPv4 SHA-256 is reversible on a laptop. Missing is **safe, not broken**: every row reads *origin unknown*.
- 🔓 **The toggle gates DERIVATION, NOT COLLECTION.** `events.verify_origin` controls the review screen; capture runs unconditionally on every self check-in. `/attend` carries a disclosure sentence in the **unconditional** present tense.
- 🪤 **NEVER capture for `source = 'admin_manual'`.** Holds structurally — `resolveCheckin` has exactly one caller.
- 🪤 **The insert fails open.** An advisory signal must never turn away a member at the door.
- 🪤 **A missing address yields `unknown` and NO digest — never a hash of a placeholder string.**
- 🔓 **`network_type = 'unknown'` implies `origin_hash is null`, enforced by a CHECK** (`checkin_origin_unknown_has_no_digest`).
- 🪤 **An IPv4-mapped address is detected on the PARSED VALUE.** The test is `v6 >> 32n === 0xffffn`. A regex covers the one spelling you thought of.
- 🪤 **The origin insert is wrapped in its own try/catch, separate from `submitCheckin`'s.** An escaping rejection returns `error` to a member whose check-in succeeded, who then retries and is told they are a duplicate.
- 🪤 **The review screen reads origins by EVENT through the embedded attendance row, never an `.in()` list of attendance ids.**
- 🪤 **Window membership goes through `withinCheckinWindow`, not `>=` on raw strings.** PostgREST renders microseconds; string compare is correct only accidentally and a non-UTC offset breaks it.
- ⚠️ **An officer-entered row renders `not_applicable`, never `unknown`.** Source check sits above missing-record check in `deriveOriginFlag`.
- 🔓 **`classifyNetwork` returns `other` only when matching nothing MEANS something.** UT announces zero IPv6; unmatched IPv6 → `unknown`, never `other`.
- ⚠️ **Cellular is NEVER flagged** (officer, 2026-08-22) — documented public bypass. If it ever gates anything, reopen this rule first.
- 🪤 **Cellular leaves both the mode's groups AND its denominator.**
- **Quorum, or there is no venue.** `VENUE_MIN_COUNT` (5), `VENUE_MIN_SHARE` (0.5). A tie is not a winner.
- ⚠️ **`lib/network-prefixes.generated.ts` is GENERATED — do not hand-edit.** `node scripts/build-network-table.mjs` rebuilds it. No runtime network call.

### Officer actions and the audit log

- **Every officer mutation writes an `admin_audit` row** — actor, timestamp, before/after JSON, reason. Append-only.
- **`app/actions/audit.ts` must never gain a `"use server"` directive** — a client-callable `writeAudit` forges audit rows under any officer's name.
- **Authorization lives in `lib/auth.ts`, not in `proxy.ts`.** Pages call `requireOfficer()`; actions start with `getOfficer()` and return `{status:"unauthorized"}`. Actions must **not** call `requireOfficer()` — `redirect()` throws `NEXT_REDIRECT` and the house try/catch swallows it.
- **Both sides of an audit before/after must select the same columns.** `AUDITED_ADJUSTMENT_COLUMNS`, `AUDITED_MEMBER_COLUMNS`.

### Mutations, concurrency and bulk work

- **Carry `updated_at` as the raw PostgREST string.** A JS `Date` round trip truncates microseconds; compare-and-set then reports phantom conflicts on every save.
- **Merge write order is a safety property.** `attendance` is `set null`, `point_adjustments` is **cascade**, `dues_payments` is `restrict`. `commitMerge` re-counts all three and refuses to delete unless every count is zero.
- 🔓 **`attendance_one_per_event` cannot catch a merge.** The index is keyed on the *submitted* EID, not `member_id`; the application must detect the collision and reject the losing row.
- **Bulk actions operate on explicitly checked IDs only and report partial success.** A multi-member grant is one atomic insert, all-or-nothing. An oversized selection is **refused, never truncated**.

### The directory, filters and export

- **One filter object, one translation, and the row window outside it.** `applyMemberFilter` is the only thing that turns a `MemberFilter` into a query. Any new filter goes there. Both callers read in chunks of `READ_CHUNK` (1000).
- 🔓 **A custom-field key is interpolated into an `order=` term; `FIELD_KEY_PATTERN` is a security control**, enforced three times: the zod schema, migration-18 CHECK, and `customFieldColumn()`.
- 🔓 **A CSV cell beginning `=`, `+`, `-`, `@` executes as a formula; member names are attacker-supplied.** Escaped with `'` prefix. **The guard fires on text, never on numbers** — `bonus_points` is legitimately negative. `ExportCell` is a typed union for exactly this reason.
- **Selection is two modes: `filter` (sends no ids) or explicit `ids` (narrows the query).** The header checkbox goes straight to filter mode.
- **A roster export is audited as its own receipt** — a fresh uuid under entity type `'roster'`, never a member's id.
- **A file download is a Route Handler, opening with `getOfficer()` returning 403** — `requireOfficer()` answers a download request with a login page.
- **A saved view stores the canonical query string, canonicalised on WRITE against every definition including archived ones.** Storage is permissive; application stays strict. Never canonicalise on read.

### Dues and terms

- **Dues status is calculated, never ticked.** "Official member" means a non-voided `dues_payments` row whose `covered_terms` includes `current_term()`. It gates nothing. `dues`, `dues_paid` and `dues_paid_current_term` are **reserved custom-field keys**.
- 🔓 **The dedupe key is Venmo's transaction ID; a content fingerprint is not acceptable.** The unique index **spans voided rows**.
- 🪤 **Terms do not sort lexicographically.** Every "which term is later" question goes through `term_index()` / `termIndex` / `isLaterTerm`, never `max(term)` or `order by term`.
- **The import is a Server Action, re-parses server-side, and never persists the uploaded file.** `MAX_IMPORT_BYTES` (512 KB) and `MAX_IMPORT_ROWS` (2000) **refuse; neither truncates**.

### Views, events and the schema

- **Both views are scoped to `current_term()`,** denominators included.
- **The board's term label comes from the same row as its numbers** (`leaderboard.term`). **`/leaderboard` is `force-dynamic`** — there is no `revalidatePath("/leaderboard")` anywhere on purpose.
- **Change a view with `create or replace`, which can only *append* columns.** Dropping a view drops its grants. The one exception (renaming an output column) requires a drop — permitted only if the same migration re-issues the grants.
- **The database must stay disposable.** Every schema change is a file in `supabase/migrations/`, never applied only through the dashboard.
- **`seed.sql` must not use trailing inline comments** — `scripts/seed-remote.sh` flattens each chunk onto one line.
- 🔴 **Emptying production is `scripts/wipe-remote.sh`, NOT `seed-remote.sh --force`** — `--force` wipes *and re-inserts the 32 fabricated members*.
- **Never type a term string.** `events.term` is generated via `term_of()`; a literal `'Fall 2026'` in application code is a bug.
- **`wipe-remote.sh` accounts for ALL TWELVE tables in `public`.** A migration that adds a table has to place it.

### Rendering, errors and framework behaviour

- 🔓 **A failed read must never render as an affirmative absence.** `x.error ? [] : x.data` renders the EMPTY state. Return a discriminated result; `lib/roster-index.ts` is the model.
- 🪤 **`error.tsx` does not wrap the `layout.tsx` in its own segment.** `app/admin/error.tsx` exists solely to catch `AdminShellLayout`'s `requireOfficer()`. Both boundaries are load-bearing.
- **Error boundaries use `unstable_retry`, not `reset`** (Next 16.2). They render `error.digest`.
- **React 19 resets an uncontrolled `<form action={…}>` after the action resolves.** Echo submitted values back in server state; drive every `defaultValue` from them; pass a **string, never `undefined`**.
- **Never build a timestamp with `new Date("2026-09-01T18:00")`.** Use `centralWallTimeToInstant()` from `lib/events.ts`.
- **Server Components own date formatting.** `Intl.DateTimeFormat` in a Client Component produces a hydration diff.
- 📌 **Officer sign-in is the "Admin" NAV item** (`/admin/login`). 🔓 **RE-MEASURED 2026-08-23 at 1280: 342px left clearance, 295px right.** The right is the tighter side. Any sixth nav item needs a fresh measurement. *(See `DESIGN.md` §Nav clearance for the full accounting.)*
- 🪤 **Global CSS must live inside a Tailwind cascade layer.** An unlayered rule beats every layered one regardless of specificity.
- 🔓 **The scroll reveal's revealed state is `clip-path: none`, NOT `inset(0 0 0 0)`.** `inset(0 0 0 0)` clips descendants; `none` does not. `wipe` keeps its own `inset()` rule because `none` is not interpolable from `inset(0 100% 0 0)`.
- 🪤 **The scroll reveal's hidden state is scoped to `html.js`.** `reveal.tsx` must never gain `"use client"` — the observer is the separate `reveal-observer.tsx`, mounted once in the public layout.
- **Every shared UI primitive lives in `components/ui/`.** Reaching for a class string instead is how drift accumulates.
- **`<Section>` owns ground, gutter and vertical rhythm together** — the Two Grounds Rule is structural rather than remembered.
- 🪤 **Never put `data-reveal` on a node that mounts after first paint.** The observer scans once per pathname; appended tiles sit at `opacity: 0` forever. Gallery grid tiles carry no `data-reveal`.

## Design

**[`DESIGN.md`](DESIGN.md) is the design source of truth.** It records all v2 design rules — grounds, surfaces, type ramp, photography pipeline, invariants, skill precedence, and which surfaces are NOT YET REBUILT. Read it before any visual change.

## Layout

Full annotated layout — every file and module with one-line annotations: **[`docs/layout.md`](docs/layout.md)**.

## Working agreements

- When a decision changes, update `docs/student-org-website-architecture.md` and bump its version header.
- Keep `tasks.md` current; record what a phase found in `docs/build-log.md` rather than growing this file.
- Stages are ordered so each ends with something demonstrable. Prefer finishing a stage's exit criteria over starting the next stage's interesting parts.
- Operational gotcha: the Supabase free tier pauses after inactivity. Check before the first event of each semester.
- **The repo is public.** Seed and test data must be obviously fake — never a real roster export, real EIDs, or real emails.
- Accounts: project infrastructure belongs to the org, never to an individual. The repo is [Texas-MISA/MISA-Website](https://github.com/Texas-MISA/MISA-Website) (public, org-owned).

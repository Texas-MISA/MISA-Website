# CLAUDE.md

@AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It is the **working brief**: current state, the rules that must not be reversed, and where everything else is written down.

## Where the documentation lives

| File | What it is |
|---|---|
| [`docs/student-org-website-architecture.md`](docs/student-org-website-architecture.md) | **The source of truth.** § references throughout this file point into it. Update it and bump its version header whenever a decision changes. |
| [`tasks.md`](tasks.md) | Short-horizon checklist, the state table (migration counts live there and nowhere else), and open items. |
| [`docs/build-log.md`](docs/build-log.md) | Stage-by-stage history — what shipped each phase, what broke, what the walkthroughs found. Read it when you need to know *why* something is the way it is. |
| [`docs/invariants.md`](docs/invariants.md) | The long form of the Invariants below, with the measurements and failures behind each rule. **The short form here is the rule; that file is the evidence.** |
| [`docs/operations.md`](docs/operations.md) | Dev-server, Supabase CLI and test-suite traps in full. |
| [`docs/dues-and-membership.md`](docs/dues-and-membership.md) | Stage 6.5 spec, including the real Venmo CSV format — and the plan for **manual dues entry**, which is written down but NOT BUILT. |
| [`docs/attend-confirmation-flow.md`](docs/attend-confirmation-flow.md) | `/attend`'s first-time confirmation and the accepted membership-oracle tradeoff. |
| [`docs/existing-site-inventory.md`](docs/existing-site-inventory.md) | What was reproduced from the old Squarespace site and what is a placeholder. |
| [`docs/frontend-redesign-v2-plan.md`](docs/frontend-redesign-v2-plan.md) | 📋 **NOT BUILT, and the CURRENT plan.** A complete visual redesign of every surface, `/admin` included, with `design-taste-frontend` as the **primary** skill and shadcn/ui as the component foundation. 🔓 It reverses several decisions in the v1 plan below — read v2 first, and treat v1 as superseded wherever the two disagree. ⚠️ **v1 was built and scrapped**; it survives on the abandoned branch `redesign-stage-1` as a record of what not to repeat. |
| [`docs/frontend-redesign-plan.md`](docs/frontend-redesign-plan.md) | 📋 **SUPERSEDED by v2 above**, and kept for its reasoning rather than its decisions. The plan for a complete redesign of the public site — its design **and** its information architecture, with new pages in scope. `/attend`, `/leaderboard`, `/lookup` and `/admin` are frozen; the data layer is untouched. Carries the rule that **no new page may invent a fact about the club**, and the four decisions the officer owns. |

## Repository status

**Stages 0–8 are COMPLETE. Stage 9 (launch) is next.** 26 migration files, through `…000025`; local and the remote are identical, and the next unclaimed number is 26. Next.js 16 deploys from `main` to https://misa-website-beta.vercel.app; the Supabase project (`gbxypeofjnhrhotlhyzs`, us-east-2) is linked, migrated and seeded.

What exists, in one pass:

- **Public** — `app/(public)/` is the **design handoff** (`docs/Texas MISA website UI mockups/`), not the old Squarespace site: navy `#16305c` on white, Barlow + Barlow Condensed, square corners, hairline borders. Home, `/about`, `/projects`, `/gallery` and `/officers` follow the five prototypes, **with every image slot a labelled placeholder** — the site publishes no photography; `/contact` survives as a route but leaves the desktop nav. `/attend` (the check-in form), `/leaderboard` (Stage 7 phase 1) and `/lookup` (phase 2, the member's own history behind an EID **and** email gate) are undesigned by the handoff and carry the same language. Copy lives in `lib/site.ts` and `lib/officers.ts` — edit those, never hardcode into pages.
- **Officers** — `/admin` covers events, the attendance queue and review, the points ledger, the member directory (custom fields, filters, presets, roster import, merge, CSV/xlsx export), dues, and `/admin/officers`.
- **Officer turnover** — officers are added by an expiring single-use invite link from `/admin/officers` (migrations 24–25), not by running `scripts/create-officer.mjs` with the production service key. The script stays as the bootstrap and recovery path. Nothing is emailed; the officer copies the link and sends it themselves.
- **Stage 8** hardened the boundary (migration 22 closed a live hole where any signed-up user could read every member's name, EID and email), added the attendance and adjustment archives (migration 23), and fixed the empty-vs-error conflation across `lib/` and every detail page.

**Production is purely fabricated data** and matches `seed.sql` exactly: 32 members / 15 events / 202 present + 5 pending + 1 rejected / 6 adjustments / 29 leaderboard / 0 dues payments / 1 custom field definition, `app_settings.current_term` unpinned. The repo is public — seed and test data must stay obviously fake.

## Next.js version

**This is Next.js 16**, and `AGENTS.md` (imported above, generated by `create-next-app`) warns that its APIs, conventions, and file structure differ from what's in model training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing App Router, caching, or Server Action code rather than working from memory. Heed deprecation notices in build output.

The architecture doc was written against a general "Next.js App Router" model, so where §10's layout or a doc snippet conflicts with Next 16 reality, the framework wins — note the divergence in the doc when it happens.

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

Regenerate `lib/types/database.ts` after **every** migration — the generated types are what make the schema type-safe end to end (§2).

The traps, each of which fails silently. Full text in [`docs/operations.md`](docs/operations.md):

- 🪤 **`.env.local` points at the remote, so `npm run dev` reads production** unless `.env.development.local` pins it local. Confirm the `Environments:` line in the dev banner before trusting what you see.
- 🪤 **Don't attach `npm run dev`'s stdout to something that stops reading** — an uncaught `EPIPE` leaves it spinning while the browser renders a stale DOM that reads exactly like an application bug. Redirect to a file. General rule: when the screen shows something impossible, `curl` the server before believing it.
- **`db query` reads only the first line of its SQL argument**, and it targets the **remote** unless you pass `--local` — `--linked=false` parses as `--linked`. Verify which database answered before believing a surprising result.
- **`db reset` needs Docker Desktop running** (user-level install path), and it does **not** re-read `config.toml` — an `[auth]` change needs a full `stop` + `start`.
- **`npx supabase start` runs every migration plus `seed.sql`**, so a fresh stack is a full rebuild-from-repo check.
- 🪤 **`fileParallelism: false` in `vitest.config.ts` is load-bearing** — the local Kong gateway 502s under parallel workers, and it presents as a different flaky test each run.

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

Decisions the architecture doc argues for at length. **Don't quietly reverse one** — if a change needs to, raise it and update the doc. [`docs/invariants.md`](docs/invariants.md) carries the same list with the measurements and the failures behind each rule; read the entry there before deciding one of these no longer applies.

### Security and privacy

- **All writes go through Server Actions or Route Handlers.** The browser holds only the anon key. The service-role client exists **only** in `lib/supabase/admin.ts`, guarded by `server-only`; anon-capable reads belong on `lib/supabase/server.ts`. (§3, §6)
- **No unauthenticated route returns an email or EID** — the `leaderboard` view deliberately omits both. `/lookup` returns the member's name and own aggregates and no identifier the caller did not already supply.
- 🔓 **A grant to `authenticated` is a grant to the public whenever signup is open.** That role is any valid user JWT, not "an officer" — officer-ness is an `admin_profiles` row checked in `lib/auth.ts`, which PostgREST never runs. **No API role holds any grant on `member_directory`.**
- 🔓 **A view has no RLS, so blanket grants do not protect it.** Every non-public view must `revoke all … from anon`, and **every recreate must re-issue the revoke** (`drop` + `create` re-triggers default privileges; `create or replace` does not). `tests/security.test.ts` allows only `leaderboard`; adding a name there is a privacy decision.
- 🔓 **RLS covers SELECT/INSERT/UPDATE/DELETE and nothing else, so TRUNCATE needs a grant or a trigger.** anon/authenticated hold `select` only; `admin_audit` also carries a statement-level `before truncate` trigger. **Never restore a blanket `grant all` to an API role.**
- ⚠️ **Deny-all with no policies is the END STATE, not a placeholder.** Everything reads through the service role and `lib/supabase/client.ts` has zero importers, so a policy for a role nothing exercises is untested attack surface.
- ⚠️ **`force row level security` is deliberately absent** — it subjects the table owner to RLS, and migrations plus `seed.sql` run as `postgres`.
- 🪤 **A security test that probes with an empty payload proves nothing.** `insert({})` trips NOT NULL before permission is consulted. Assert `42501` specifically, and re-read as service role.
- 🔓 **A view's owner rights stop at a function call.** `security_invoker = false` covers tables the view names directly; a plain function called inside it runs as the invoker — which silently gave every RLS-subject reader the derived term instead of the officer's pin until migration 21. `current_term()` is `security definer` + `set search_path = ''`, stays `stable`, and must never become `immutable`.
- **`/leaderboard` is public but must never be indexed** (`robots: { index: false, follow: false }`). Names against point totals are the residual exposure, and a search cache outlives the deploy that filled it. (§9 #1)
- **RLS is enabled on every table, deny-all**, with one exception: `events_public_read` grants anon `select` on published events. New tables ship deny-all in their own migration.

### Officer invites (migrations 24–25)

- 🔓 **An invite is a CAPABILITY and the token is the whole of it.** Five properties contain it, none optional: **only `sha256(token)` is stored** (never add a column holding the token, never return it from a read); **the role comes off the stored row** — `inviteAcceptSchema` has no `role` key at all; **claim BEFORE creating the account**, since the conditional `UPDATE` is both the single-use and the concurrency guard and a failure after it burns the invite and grants nothing; **72 hours**, with `inviteState` the one definition of liveness; and **self-revocation is refused**, which is what makes team-wide lockout unreachable.
- ⚠️ **The email is pinned only when the inviter supplied one.** `email is null` is an **open invite** — a bearer credential redeemable into any mailbox the holder controls. The two paths stay structurally apart (a separate `openInviteEmailSchema`, never a `??` merge), so the pinned branch has no parsed address in scope. The role is pinned either way.
- ⚠️ **The redemption password floor is 6, mirroring GoTrue's own minimum** rather than stating a policy — `createUser` runs after the claim, so a shorter password would burn a link and grant nothing. `scripts/create-officer.mjs` still enforces 12; the asymmetry is deliberate. The page carries no help text and no client-side length rule.
- 🔓 **Invite messages are specific where `/lookup`'s are vague**, because the caller already holds a 256-bit secret. The generic message is reserved for a token matching **no** row.
- 🪤 **`/officer-invite/[token]` lives OUTSIDE `/admin`** — `proxy.ts` matches `/admin/:path*` and would redirect every invite recipient to login.
- 🔓 **The invite page THROWS on a failed read** rather than calling a good link invalid.

### Check-in and member resolution

- **The duplicate rule is three checks, not one**: the `(event_id, normalized_eid)` partial unique index (23505), an app check on `(event_id, member_id)` after resolution, and an app check for a prior pending orphan within the grace window.
- **Nothing that resolves to a known member is ever dropped on the floor** — stored as `pending` if it matches no open event. (§4.2) The member half is narrower: a submission matching no roster member whose submitter did not tick "first time" is **discarded and re-prompted**, because the alternative is a duplicate member per typo. Recovery is officer manual entry at `/admin/attendance/new`.
- **Corollary: `unmatched` must mean "definitely not on the roster", never "we couldn't tell".** Member lookup returns a discriminated `found`/`missing`/`error`.
- **Creating a member is not part of check-in resolution.** Only the confirmed second pass (`declaredNew && confirmed`) reaches `createMember`, the single place the application inserts a member on an unauthenticated request. The confirmation is a typo guard, **not a security control**; the per-IP throttle is the abuse control.
- **The first-time checkbox is a hint, not an instruction** — it must never create a second person, and `existing` carries a bare boolean, never the matched member's details.
- **Match and dedupe on the normalized generated column, never the raw value.** `members.normalized_eid` / `attendance.normalized_eid`, folded to **`lower`** (EIDs are conventionally lowercase and the review screen otherwise shouts back).
- **A near-miss EID needs corroboration at edit distance 2; distance 1 stands alone.** An empty suggestion list is a valid answer. Don't relax the floor on the grounds that EIDs are not sequential — they are derived from name initials, so near misses land on real, plausibly confusable people.
- **`present_requires_resolution` is load-bearing** — `status = 'present'` guarantees both `event_id` and `member_id` are non-null. Never work around it in application code.
- **Check-ins outside the 48-hour orphan window are refused, not queued**; inside it with no open event they are stored `pending` with ranked `nearby_events()` suggestions. `ORPHAN_WINDOW_HOURS` lives in `lib/checkin.ts` and is **always passed explicitly**.
- **Don't auto-resolve near-misses.** Keep the human in the loop and make their job fast instead.
- **Suggestions are ranked by the database and never reordered in JavaScript**, and nothing is ever preselected — no stray `defaultChecked`.
- 🔓 **`/lookup`'s gate is a CONJUNCTION in one query**, never `lib/checkin.ts`'s ordered fallback: two lookups or an `.or()` silently reduce it to EID-alone, which is not sufficient to reveal dues status. The email side goes through `escapeIlike`. **One `unmatched` outcome and one message for every miss** — distinguishing them is a stronger oracle than §6 accepted.
- **`/lookup` throttles in its own bucket** (`hashClientIp("lookup")`). `RATE_LIMIT_MAX` is a *room capacity*, so a shared budget would let standings lookups crowd out check-ins behind a venue's NAT.

### Officer actions and the audit log

- **Every officer mutation writes an `admin_audit` row** — actor, timestamp, before/after JSON, reason. One table keyed `(entity_type, entity_id)`; no per-entity audit tables. Append-only.
- **`app/actions/audit.ts` must never gain a `"use server"` directive** — every export of such a module is a public endpoint, and a client-callable `writeAudit(actorId, …)` forges audit rows under any officer's name.
- **Authorization lives in `lib/auth.ts`, not in `proxy.ts`.** Proxy refreshes the session and redirects optimistically only. Pages call `requireOfficer()`; actions start with `getOfficer()` and return `{status:"unauthorized"}` — actions must **not** call `requireOfficer()`, because `redirect()` throws `NEXT_REDIRECT` and the house try/catch swallows it. Every `redirect()` goes outside the try/catch.
- **Both sides of an audit before/after must select the same columns.** A narrower `.select()` on the update *invents changes that never happened* (`AUDITED_ADJUSTMENT_COLUMNS`, `AUDITED_MEMBER_COLUMNS` are the shared lists).
- **`admin_audit.action` is a closed union in TypeScript and free text in SQL** — two pre-Stage-5 production rows carry bare verbs and are permanently uncorrectable. Format with a fallback to the raw string.
- **Officer attribution distinguishes "no display name" from "no profile", and `describeOfficer` has FOUR cases.** Absent means revoked, null means no display name, and a failed lookup means neither — an empty Map used to relabel every officer everywhere as "a former officer".
- **A roster read spanning `auth.users` and `admin_profiles` is two queries, always** — no PostgREST path between them, and the GoTrue admin API has no filter-by-email. `lib/officer-roster.ts` pages and stitches, and its cap **refuses rather than truncates**.

### Mutations, concurrency and bulk work

- **Carry `updated_at` as the raw PostgREST string.** A JS `Date` round trip truncates microseconds and the compare-and-set then reports a phantom conflict on every save. Applies to `attendance`, `events`, `members` and `dues_payments`.
- **Single-row attendance mutations compare-and-set on `updated_at`; bulk operations scope on `status = 'pending'`** and report requested-minus-updated as skipped.
- **A member's CAS token is row-level, so the *row* owns it, not the cell.** `directory-row.tsx` and `member-editor.tsx` hold it in state and adopt the fresh one each save returns.
- **A point adjustment is never updated except to void it, and never deleted** — no edit UI, no CAS token, since `.is("voided_at", null)` is already a complete guard. Adjustments require a `reason`, may be negative, and a void is itself a recorded action with its own reason.
- **A payment is editable *and* voidable** — the union of the two patterns, deliberately.
- **Bulk actions operate on explicitly checked IDs only and report partial success**, and the pre-flight dedupes *within* the selection. **A multi-member grant inverts this: one atomic insert, all-or-nothing**, because a partial grant has no backstop the way a skipped queue row does. An oversized selection is **refused, never truncated**.
- **A cap that silently truncates is a correctness bug waiting on growth.** `MEMBER_SCAN_LIMIT` (400) and `RATE_LIMIT_MAX` (90/IP/10min) are both documented at their definitions. Never raise one without re-reading why the number was chosen, and never add a cap that fails quietly — refuse loudly or page.
- 🔓 **`attendance_one_per_event` cannot catch a merge, so the application must.** The index is keyed on the *submitted* EID, not `member_id`, so repointing never touches an indexed column — the survivor silently gets two `present` rows for one event and both views double-count. The merge **rejects** the losing row. Never "simplify" a merge into three UPDATEs.
- **Merge write order is a safety property.** Only one of the three FKs to `members` fails loudly: `attendance` is `set null`, `point_adjustments` is **cascade**, `dues_payments` is `restrict`. `commitMerge` re-counts all three and refuses to delete unless every count is zero. ⚠️ It is not atomic and cannot be — PostgREST has no cross-statement transaction, so the order is chosen to make every partial failure recoverable and the irreversible step last.

### The directory, filters and export

- **One filter object, one translation, and the row window outside it.** `applyMemberFilter` is the only thing that turns a `MemberFilter` into a query and never applies `.range()` or `.limit()` — that is what makes "copy all N matching this filter" provably the same query as the count beside it. Any new filter goes in that one function.
- ⚠️ **Both callers read in chunks of `READ_CHUNK` (1000)** — the hosted project applies its own `max_rows`, so one unbounded request comes back complete locally and silently short in production. There is deliberately **no ceiling** on the directory.
- **A filter with no control on screen is the same defect wearing a different hat.** Retiring a filter means **deleting the field** from `MemberFilter` (as the six phase-3 filters and `page` were), so an old bookmark narrows nothing rather than narrowing invisibly.
- **A list read in more than one request needs a total order, not merely a sort.** Every directory query ends `.order("id")`; ties straddling a chunk boundary duplicate one row and **drop another**, which reads as missing data. Custom-field sorts make this the common case, and it applies to the ledger exports too.
- **A free-text search value is sanitized where the filter is built and quoted where it is used.** `parseMemberFilter` strips `%`, `*`, `"` and `\`; `.` and `,` are kept and handled by double-quoting inside the `or` group, because stripping them would make every email unsearchable.
- 🔓 **A custom-field key is interpolated into an `order=` term and a `cf:` filter predicate, so `FIELD_KEY_PATTERN` is a security control, not a naming convention.** A `,` breaks out of the order term and is read as a second column; a space and a `"` are accepted **silently**. Enforced three times: the zod schema, the migration-18 CHECK, and again in **`customFieldColumn()`** — the one function through which a key becomes part of a query string. The `cf:` namespace is a separate guard against shadowing a built-in sort; it is not what makes the key safe.
- **`applyMemberFilter` takes the field definitions as a *required* argument while `parseMemberFilter` defaults it** — a page that forgets them is a compile error rather than a silent fallback to sorting by name.
- 🔓 **Nothing ties a stored custom-field value to its definition's option list, deliberately.** Editing an option list orphans values; `fieldOptions()` renders the orphan as a trailing disabled entry, because a `<select>` with no matching `<option>` shows blank and the next edit would destroy an answer never displayed. Never add a trigger validating `custom_fields` against the definitions.
- **A custom-field value is stored by deleting the key, never by writing `""`** — otherwise "cleared" and "never answered" render identically and sort differently.
- **Selection is two modes, not one set that happens to be full.** `filter` mode sends **no ids at all** so the route re-runs the same query; explicit ids **narrow** it rather than replacing it. The header checkbox goes straight to filter mode — enumerating ids made a 1,257-character URL at 28 members.
- **"Select all N matching this filter" is not "select the rows you can see."** They now pick the same people on screen and must still not be merged: only re-running the query can prove a list is complete rather than merely long.
- **A roster export is audited as its own receipt** — a fresh uuid under entity type `'roster'`, never a member's id, with the filter, row count, chosen fields and format. ⚠️ It records the fields that **actually left**, not the ones that were ticked. The clipboard is audited exactly like the download.
- **A file download is a Route Handler, and it opens with `getOfficer()` returning 403** — `requireOfficer()` would answer a `fetch` with a login page. ⚠️ **A Route Handler does not participate in layouts**, so living inside `(shell)` grants no protection; `proxy.ts` covers the path but the 403 is what catches a signed-in non-officer.
- **An export pages explicitly in 1000s and `MAX_EXPORT_ROWS` (5000) refuses, never truncates.** An id reaching a PostgREST `in.(…)` list is format-checked first.
- 🔓 **A CSV cell beginning `=`, `+`, `-`, `@` executes as a formula, and member names are attacker-supplied.** Escaped with a `'` prefix in the CSV writer; tab and CR too. ⚠️ **The guard fires on text and must never fire on numbers** — `bonus_points` is legitimately negative — which is why `ExportCell` is a typed union rather than `string[][]`.
- ⚠️ **The xlsx writer has no formula guard, and its absence is asserted.** The two writers share `projectRow` and nothing else; xlsx must never be implemented as CSV with a different extension. 🪤 Excel's "we found a problem" repair prompt has six known causes, all pinned in `tests/xlsx.test.ts` (fills 0/1 exactly `none` then `gray125`; `numFmts` first with the rest in schema order; every `count` derived; custom `numFmtId` ≥ 164; `<autoFilter>` after `<sheetData>`; C0 controls stripped). ⚠️ The date epoch is **`1899-12-30`** and the serial comes from the **Central** civil date.
- **A saved view stores the canonical query string, canonicalised on WRITE against every definition including archived ones.** A **rename is a write**, so canonicalising against live definitions would drop a `cf:` clause the officer never touched. **Storage is permissive; application stays strict.** Never canonicalise on read.
- **A roster import creates only, and duplicate detection covers BOTH unique indexes** (`members_normalized_eid` and `members_email_lower`), including the file against itself. 🪤 One atomic insert, **not** an upsert — PostgREST's `onConflict` takes a single target. Columns are located **by name, never by position**, and the header set is `exportCatalogue`'s importable subset so a downloaded CSV round-trips.
- **A wrapped PostgREST column list is a build break, not a style choice.** PostgREST types the row off the string *literal*, so a concatenation widens it to `string` and collapses every field access at once. One unbroken literal with `as const`, every time.

### Dues and terms

- **Dues status is calculated, never ticked.** "Official member" means a non-voided `dues_payments` row whose `covered_terms` includes `current_term()`, surfaced as `member_directory.dues_paid_current_term`. It gates nothing (§9 #12). ⚠️ `dues`, `dues_paid` and `dues_paid_current_term` are **reserved custom-field keys**, and archiving a definition does not free its key. 📋 The planned manual-entry path (`/admin/dues/new`, **NOT BUILT** — plan in `docs/dues-and-membership.md`) does not weaken any of this: it records a **payment row**, so the derivation is untouched and edit, void and audit come for free.
- 🔓 **The dedupe key is Venmo's transaction ID; a content fingerprint is not an acceptable substitute** — two members can send $30 in the same minute with the note "dues". The unique index **spans voided rows**, so re-importing never resurrects a voided payment.
- **Nothing that arrived as money is dropped on the floor.** An odd amount, an unreadable note, no note — the row is stored and queued. **A payment note never creates a member**, and matching is exact-match only. The review axis is a **nullable `terms_covered`**, so an undecided row covers nothing: the failure direction is under-reporting, which the queue makes visible.
- **`dues_payments.member_id` is `on delete restrict`**, diverging from `point_adjustments`' cascade on purpose — the row records that money arrived.
- **Prices live in `app_settings` in cents and are read at import time only**; `terms_covered` is stored on the row, so raising dues never rewrites what last year's payments bought.
- 🪤 **Terms do not sort lexicographically** — `'Fall 2026' < 'Spring 2026'` is true as a string and false as a calendar fact. Every "which term is later" question goes through the **term index** (`term_index()`, `termIndex`/`isLaterTerm`), never `max(term)` or `order by term`. This is why there is no "paid through" column on the view.
- 🪤 **`term_index()` is not a validator** — `term_index('Autumn 2026')` equals `term_index('Spring 2026')`. Validate a term's *shape* (`^(Spring|Fall) [0-9]{4}$`).
- **Never type a term string.** `events.term` is generated via `term_of()`; `current_term()` derives from `now()` unless pinned. A literal `'Fall 2026'` in application code is a bug — and **`seed.sql` is application code for this purpose**.
- **The import is a Server Action, not a Route Handler**, re-parses server-side rather than trusting the preview, and 🔓 **never persists the uploaded file** — that is every dues transaction for a month in one blob. `MAX_IMPORT_BYTES` (512 KB) and `MAX_IMPORT_ROWS` (2000) sit under Next's 1MB action limit and **refuse; neither truncates**.

### Views, events and the schema

- **Both views are scoped to `current_term()`**, denominators included — an all-time `events_possible` against a current-term `events_attended` understates every rate and still looks plausible.
- **The public `leaderboard` shows a single `total_points`; `member_directory` keeps `attendance_points` and `bonus_points` split.** Don't collapse the directory columns to "fix" the inconsistency.
- **The board's term label comes from the same row as its numbers** (`leaderboard.term`) — a second `rpc("current_term")` is two sources for one fact, and it is the exact query that was silently wrong. **`/leaderboard` is `force-dynamic`**, because five modules move public standings and a cached board fails silently; there is no `revalidatePath("/leaderboard")` anywhere on purpose.
- **`attendance_rate` is null, not zero, when the term has no completed events**, and a member who attended nothing is a real `0`. Render null as "—".
- **A member's events grid has three states: attended, missed, and _upcoming_.** An event that has not ended is not a miss. Attendance outranks the clock. The grid (published-only) and the view's counts (drafts included) can legitimately disagree, and neither is derived from the other.
- **Event edits are not retroactive.** Narrowing a window warns, it never revokes. Deleting an event with attendance is blocked — offer `status = 'cancelled'`. Changing `points` warns with the count of members affected. (§4.6)
- **Check-in window bounds are half-open (`>= opens`, `< closes`) in three places that must agree:** the `events_no_overlapping_checkin` exclusion constraint, `open_event_at()`, and application-side window logic.
- **Change a view with `create or replace`, which can only *append* columns.** Dropping a view drops its grants. The one exception is renaming an output column, which requires a drop — permitted **only if the same migration re-issues the grants**, and say why in the header.
- **The database must stay disposable.** Every schema change is a file in `supabase/migrations/`, never applied only through the dashboard.
- **`seed.sql` must not use trailing inline comments** — `scripts/seed-remote.sh` flattens each chunk onto one line. 🪤 The stripper is `grep -v -E` rather than `sed`, because sed's `.*` failed to match a comment containing an emoji and half-seeded production.
- 🔓 **Re-seeding a project with a real officer on it needs `bash scripts/seed-remote.sh --force`**, which names the project ref, prints current row counts, and requires the operator to type the ref back. Never get past the guard by editing a copy of `seed.sql`. Officer logins survive a re-seed.
- **The seeded semester must sit in the term the clock is in, and completed events must be in the past** — attendance can only hang off events with `starts_at < now()`. **An unasserted fixture is an optional fixture**; the assert block is the only thing standing between "the seed ran" and "the seed produced what the docs say".

### Rendering, errors and framework behaviour

- 🔓 **A failed read must never render as an affirmative absence.** `x.error ? [] : x.data` renders the EMPTY state, so a broken query stops saying "something went wrong" and starts claiming *you have not paid*, *this member does not exist*. Return a discriminated result (`lib/roster-index.ts` is the model). Two shapes to watch: **a count from a view above a list from a second read**, and **`if (!x) notFound()` fed by a helper that returns null on error**.
- **Where to fail whole vs. per section:** `/lookup` fails the entire lookup, because its five numbers interlock; `members/[id]` degrades per section, because an officer who came to edit notes should not be blocked by a dues failure.
- 🪤 **`error.tsx` does not wrap the `layout.tsx` in its own segment.** `app/admin/error.tsx` exists solely to catch `AdminShellLayout`'s `requireOfficer()` and renders without the admin nav. Both boundaries are load-bearing.
- 🪤 **One `loading.tsx` per route OR granular `<Suspense>`, never both** — the prerenderer stops at the first boundary walking up. A rendered fallback also commits the response to **200**, so a later `notFound()` cannot be a 404.
- **Error boundaries use `unstable_retry`, not `reset`** (Next 16.2) — `reset()` cannot recover a Server Component error. They render `error.digest`, because production replaces the message.
- **Never build a timestamp with `new Date("2026-09-01T18:00")`.** The server runs in UTC; wall-clock times go through `centralWallTimeToInstant()`.
- **Date-range filters are Central-anchored and half-open:** `.gte(centralWallTimeToInstant(from, "00:00"))` … `.lt(centralWallTimeToInstant(addCivilDays(to, 1), "00:00"))`. A bare `.lte()` silently drops five to six hours of a Central day.
- **Server Components own date formatting.** `Intl.DateTimeFormat` in a Client Component produces a hydration diff between two strings that look identical.
- **React 19 resets an uncontrolled `<form action={…}>` once the action resolves.** Echo submitted values back in server state and drive every `defaultValue` from them — pass a **string, never `undefined`**. The reset clears checkboxes too, so selection state mirrored outside the form must be reset alongside it. Prefer **controlled selects with a reset-during-render resync** where a stale value could be saved back.
- **Never put `formAction` on a submit button whose `name`/`value` you read** — React drops the submitter's name from the FormData. And **one carrier per field name**: a hidden input earlier in the form wins `formData.get()`.
- **A control's enabled state comes from the live form, not the server's copy of the row.** Server state is the authority on what *is*; the form is the authority on what the officer is *about to do*.
- 📌 **Officer sign-in is the "Admin" NAV item** (`/admin/login`, not `/admin` — both land in the same place, but this skips a redirect and is honest about the destination). It moved out of the footer in the UI overhaul, where the design handoff put it in the nav: the reason it was a footer link was that the header had no room, and the redesign spends the room the other way — the socials moved to the footer and Contact left the nav, so the left group is five short uppercase items instead of eight plus four icons. 🪤 **The nav still cannot grow without measuring**: the wordmark is absolutely centred and wins the z-order, so an overflowing item silently disappears rather than breaking the layout. Measured after the overhaul at **1280: 285px clearance left of the wordmark, 312px right**; at 1646 the left group ends at x=331 against a wordmark starting at x=791. Re-measure both when adding an item.

### Design and content

- ⏳ **`DESIGN.md` IS RETIRED FOR THE DURATION OF THE v2 REDESIGN** (officer's call, 2026-08-17). Every aesthetic rule below is open — the named rules, the tokens, the type ramp, flatness, light-only, the Do/Don't list. **Seven engineering rules survive** and are listed in [`docs/frontend-redesign-v2-plan.md`](docs/frontend-redesign-v2-plan.md) under *The engineering set*: focus rings visible on every ground, sections owning their own padding, shared-rule plates, contrast measured per pairing on the real ground, monospace for `/admin` identifiers, named feedback colours, and no photography. A new `DESIGN.md` is written at phase 5 from what actually ships. Until then the rest of this entry describes the **outgoing** system, kept because `/admin` and the member pages still render it.
- 📌 **`DESIGN.md` is the source of truth for the design, site-wide** (2026-08-17). It carries the tokens, the type ramp, the spacing scale, the status palette, the five reveal variants, the named rules and the Do/Don't list, and it is the only document that covers `/admin` and the member-facing pages. 🔓 **The design handoff (`docs/Texas MISA website UI mockups/design_handoff_misa_website/`) was the source of truth until this date and is now historical reference** — it is desktop-only with no breakpoints authored, defines no focus, hover, empty or error states, and draws five of the site's twenty-odd screens. The identity it set is unchanged and is recorded in `DESIGN.md`; its README remains the only home of the duotone image-treatment spec. Never port its inline styles.
- **Every shared UI primitive lives in `components/ui/`, and reaching for a class string instead is how the last drift happened.** `button.tsx` (`buttonClass` + named constants), `field.tsx` (`Field`/`Input`/`Select`/`Textarea`/`controlClass`/`CHECKBOX`), `table.tsx`, `panel.tsx`, `banner.tsx`, `pill.tsx`, `chip.tsx`, `section.tsx`, `heading.tsx`, `empty-state.tsx`, `page-header.tsx`. Before the 2026-08-17 rework `/admin` imported exactly two things from `components/ui/`, and had accumulated three button dialects, eleven copies of an input class and nine copies of the same local `Field`.
- 🪤 **`<Section>` owns ground, gutter and vertical rhythm together, and that is what makes the Two Grounds Rule structural rather than remembered.** `ground="navy"` applies the fill, `.on-navy` (the white focus ring) and the section's own padding in one place — the 2026-08-15 gallery-band failure, where a ground was removed and its 112px inset was left behind, is no longer reachable from a page file.
- 🪤 **Global CSS must live inside a Tailwind cascade layer.** v4's `@import "tailwindcss"` emits utilities into `@layer utilities`, and an **unlayered rule beats every layered one regardless of specificity** — a bare `a { color: … }` overrode `text-white` on every link and rendered the header's Check In button navy-on-navy. Element defaults go in `@layer base`, decorative classes in `@layer components`.
- 🪤 **The scroll reveal's hidden state is scoped to `html.js`**, a class an inline script in `app/layout.tsx` sets during HTML parsing. Without the scoping a visitor with JavaScript off gets a blank page; without the inline script (an effect instead) the content paints and then blanks. `components/ui/reveal.tsx` is the **server-safe** half and must never gain `"use client"` — the observer is the separate `reveal-observer.tsx`, mounted once in the public layout so animated sections stay Server Components.
- 📌 **THE SITE PUBLISHES NO PHOTOGRAPHY.** Every image slot on every page — marquee tiles, the About cluster and photo band, the gallery feature and masonry, officer headshots — renders a hatched `<Hatch>` placeholder captioned with the shot that belongs there. The handoff specifies exactly this for the slots it had no photo for; it is applied to all of them. `public/photos/` was **deleted** rather than left unlinked, because a file under `public/` stays fetchable at its URL whether or not a page links it. **The four partner logos in `public/partners/` are the only images the site serves.** Restoring one means adding the file, the `src`, and swapping the `<Hatch>` for an `<Image>` — the treatment spec (duotone, and the two exemptions) lives in the handoff README, and `lib/site.ts`'s header carries the pointer.
- ⚠️ **Officer headshots carry a SECOND, independent reason.** Even with photography restored, the handoff's own README flags its headshots' photo-to-name pairing as never supplied — a real face against another real student's name is worse than an empty labelled square. `Officer` has no `photo` field; adding one answers only half the question.
- 🪤 **When photography returns, size framed slots with next/image's `fill`.** An intrinsically sized `<img>` makes the frame grow to the photo's own height, and the About history portrait then leaves a large void beside the column next to it — the handoff hit this in its own prototype. The gallery masonry is the one place that wants intrinsic heights.
- ⚠️ **`GALLERY_ITEMS[].category` in `lib/site.ts` is a statement of intent, not a record.** The gallery filter sorts on it, and it describes shots that do not exist yet. Nothing else reads it.
- 🪤 **A marquee needs enough copies to cover the VIEWPORT, and "duplicate twice, translate ‑50%" only does that when one group is wider than the screen.** Neither home-page track is: measured at a 1646px viewport, the groups are 1360px and 1272px, so each cycle ended with ~300px of bare ground and a snap. **The translate distance is one group width in pixels** (`--marquee-shift`, computed by the component), never a percentage — a percentage silently couples the distance to the copy count. Copies come from `Math.ceil(MAX_VIEWPORT / groupWidth) + 1`; `MAX_VIEWPORT` (4000) is a **real ceiling**, not a margin, and is documented at its definition. 📌 No pause on hover: the tracks are full-width, so a resting mouse froze a row and read as breakage. 📌 **The band's navy ground was removed on request (2026-08-15)** — it sits on white now, so the tiles are `Hatch`'s **light** tone with a `misa-border` hairline, the "See all photos" link is navy, and the section carries no `.on-navy`. Those four move together with the background, per the never-mixed rule — **and so does the padding**: `py-12 sm:pb-14` was the field's inset and became 112px of dead air once there was no field, so the band is `pb-2 sm:pb-3` and takes its rhythm from the sections either side.

## Design skill precedence

Four design skills live in `.claude/skills/` (installed 2026-08-16 per `docs/install-ui-skills.md`). They arrive with opinions about typography, colour, spacing and motion, and they will contradict each other and this file.

- **The Invariants above outrank all four, without exception.** In particular: THE SITE PUBLISHES NO PHOTOGRAPHY — every one of these skills will propose hero imagery, and every such proposal is refused, not negotiated (the `<Hatch>` placeholder is the answer); global CSS stays inside a Tailwind cascade layer; and the nav cannot grow without re-measuring the wordmark clearance.
- 📌 **`DESIGN.md` is the design source of truth for the WHOLE site** (since the 2026-08-17 rework), and it is committed. The handoff is historical reference — desktop-only, no breakpoints, no interaction states, and no coverage of `/admin`, `/attend`, `/leaderboard` or `/lookup`, which is most of the application. `DESIGN.md`'s *Relationship to the design handoff* section records what changed and what did not; the identity itself is unchanged. 🔓 **This reverses the previous rule**, which made the handoff primary for the five designed pages.
- 🔓 **`design-taste-frontend` IS PRIMARY for the public visual UI, for the duration of the v2 redesign** (officer's call, 2026-08-17). This reverses the rule below, which is kept because it still governs everything v2 has not reached. The skill owns the dials, the design-system choice, the layout-family budget, the image strategy, and its **§14 Final Pre-Flight**, which is a gate rather than advice — it caught two shipped failures in v1 the first time it was run. `emil-design-eng` still wins on motion and `web-design-guidelines` still wins on accessibility. ⚠️ **The Invariants above still outrank all four**, and the seven surviving engineering rules are listed in [`docs/frontend-redesign-v2-plan.md`](docs/frontend-redesign-v2-plan.md).
- **No aesthetic skill is primary anywhere** *(the pre-v2 rule, still in force outside the redesign)*. They execute `DESIGN.md`; they never redirect it. `impeccable`'s **"redesign replaces" / `new-work.md` path is out of scope for the entire site** — it would discard `DESIGN.md`, which is now the only complete record of the system. `shape`, `layout`, `typeset`, `polish`, `harden`, `extract`, `audit` and `critique` are in scope; `/impeccable operate` still governs `/admin`, where scanability outranks expression.
- ⚠️ **The skill conflicts are settled in `DESIGN.md`; don't relitigate them each turn.** Refused there, with reasons: dark mode, real imagery, the eyebrow ban, mono-as-costume, the 65–75ch measure, one-marquee-per-page, the em-dash ban, "no oversized H1". Adopted from the skills: no coloured border-left above 1px, entrance variety instead of one universal reveal, themed browser surfaces, and emil's easing and durations.
- **Animation and motion:** `emil-design-eng` always wins, including over `impeccable animate`, on easing, duration, and whether to animate at all. The existing scroll reveal is the house pattern and its `html.js` scoping is an invariant.
- **Pre-ship review:** run `web-design-guidelines`. Its accessibility and interaction findings override aesthetic preference on conflict. ⚠️ It fetches the current guidelines over the network at review time rather than shipping a static copy.
- **`impeccable`'s hook** runs a local detector after every Edit/Write and a full pass at end of turn (`.claude/settings.local.json`, machine-local and gitignored). It only injects context — it cannot block a turn or edit a file.
- If two skills conflict and nothing above settles it, ask. Don't average them.

## Layout

Per §10. Annotations here are one line each; [`docs/student-org-website-architecture.md`](docs/student-org-website-architecture.md) §10 carries the full reasoning for every entry.

```
app/(public)/           landing, /about, /gallery, /officers, /projects, /contact,
                        /attend, /leaderboard, /lookup, /officer-invite/[token].
                        layout.tsx holds the shared header/footer and mounts
                        RevealObserver once; _components/ holds page-private
                        pieces (leading underscore = not a route) — the home
                        page's home-hero.tsx (v2 phase 1: the Asymmetric Split
                        Hero and its floating plate cluster — replaces PageHero
                        on the HOME PAGE ONLY; the other nine public pages still
                        use PageHero, so chevron-section.tsx is untouched until
                        phase 2), gallery-marquee.tsx and upcoming-events.tsx
                        (KEPT BUT UNMOUNTED; remounting it also restores the
                        page's force-dynamic), and
                        /gallery's gallery-grid.tsx, the one client component
                        the five designed pages need (filter chips + load more).
                        📌 /contact is ROUTED BUT UNLINKED from the desktop nav:
                        the handoff drops it, and the About FAQ band and the
                        footer address are the contact paths it puts in its
                        place. It stays in the mobile sheet, which has no
                        wordmark to clear.
                        /leaderboard reads the ANON client through
                        lib/supabase/server.ts, so that grant stays exercised in
                        production; force-dynamic + robots noindex, both load-bearing.
                        /officer-invite/[token] is deliberately OUTSIDE /admin (see
                        the proxy.ts invariant) and renders the pinned email as
                        read-only TEXT — there is nothing to tamper with
app/admin/login/        officer sign-in — deliberately OUTSIDE the (shell) group,
                        whose layout calls requireOfficer()
app/admin/(shell)/      authed chrome + dashboard, events/, attendance/, points/,
                        members/ (+ [id], fields/, presets/, import, merge, and
                        export/route.ts), dues/ (+ [id], import/), officers/;
                        later audit/. Route groups don't appear in URLs, so §5's
                        route table is unchanged. _components/ holds shell-wide
                        pieces (status-pill.tsx, audit-trail.tsx, notice.tsx)
app/actions/
  attendance.ts         submitCheckin ONLY — the one unauthenticated WRITE path,
                        kept single-export so the §6 attack surface is one file
  lookup.ts             lookupMember ONLY — the one unauthenticated READ path.
                        Writes exactly one row anywhere: the throttle record
  officer-invite.ts     acceptInvite ONLY — the third unauthenticated endpoint and
                        the most consequential, because it CREATES AN OFFICER. The
                        role and (when pinned) the email come off the stored row
  invites.ts            officer-facing — createInvite (returns the one-time link),
                        revokeInvite, revokeOfficerAccess, restoreOfficerAccess.
                        Kept apart from officer-invite.ts. No role check (§9 #6)
  attendance-review.ts  officer resolution mutations
  points.ts             grantPoints, voidAdjustment — and nothing else
  members.ts            setMemberFieldValue, saveMemberNotes, saveFieldDefinition,
                        setFieldArchived. No role check, and it says so (§9 #6)
  dues.ts               previewImport / commitImport (re-parses server-side),
                        savePayment (one write, CAS) and voidPayment (no CAS)
  presets.ts            savePreset (create or update, no CAS) and deletePreset —
                        a REAL delete, since nothing is keyed to a preset
  member-import.ts      previewRosterImport / commitRosterImport — create-only,
                        ONE atomic insert, the CSV never leaves the browser
  member-merge.ts       previewMerge / commitMerge — the write ORDER is a safety
                        property; re-count, then refuse to delete unless all zero
  events.ts             event mutations
  auth.ts               sign in / sign out
  audit.ts              shared admin_audit writer — no "use server", see Invariants
lib/
  auth.ts               getOfficer / requireOfficer — the authorization boundary
  supabase/             server.ts (anon), client.ts (browser, zero importers),
                        admin.ts (service role, `server-only`-guarded)
  types/database.ts     generated — do not hand-edit
  events.ts             event domain core: Central wall-clock conversion, window
                        helpers, expandSeries, previewEventEdit — no next/* imports
  checkin.ts            check-in resolution core + ORPHAN_WINDOW_HOURS + rate limit.
                        Lookup and creation are separate on purpose
  lookup.ts             the member self-service core — the gate is a CONJUNCTION in
                        ONE query, never checkin.ts's ordered fallback
  attendance.ts         resolution core: interval parsing, member-candidate scoring,
                        previewResolution, canApprove, planBulkAssign. Anything with
                        a decision in it belongs here, not in the action
  points.ts             categories, signed formatting, AUDITED_ADJUSTMENT_COLUMNS
  members.ts            classifyTermEvents, formatAttendanceRate, FIELD_KEY_PATTERN
                        (a security control), the `cf:` namespace, fieldValue/
                        setFieldValue, AUDITED_MEMBER_COLUMNS
  filters.ts            directory filter core: parse → MemberFilter → query. The
                        query builder is typed structurally so tests drive a fake.
                        READ_CHUNK + chunkRange(); the window stays the CALLER's
  ledger-filters.ts     the points-ledger and attendance-queue filter cores. ONE
                        module for two screens: each had its own copy of the
                        Central half-open date bound and the exports were a third
  presets.ts            saved-filter core — canonicalPresetQuery (WRITE only),
                        storableFields, presetSummary
  member-presets.ts     the preset read
  member-fields.ts      fetchFieldDefinitions — live custom-field definitions,
                        deliberately uncapped
  member-options.ts     fetchMemberOptions — bounded roster scan (MEMBER_SCAN_LIMIT)
  event-options.ts      fetchEventOptions — labels formatted server-side
  merge.ts              merge core: planMerge, mergeNotes, mergedCustomFields,
                        rankDuplicateCandidates. MIN_DUPLICATE_SCORE is NOT
                        MIN_SUGGESTION_SCORE — measured against constructed shapes
  member-import.ts      roster-import core: importColumns (built FROM
                        exportCatalogue), matchHeaders (by NAME), planRosterImport
  export.ts             export core — the field catalogue, the typed ExportCell
                        projection, CSV/TSV/clipboard writers, exportedFields
  export-ledgers.ts     the archival export cores — a SIBLING of export.ts, not an
                        extension. Points go out as a NUMBER, never signedPoints
  xlsx.ts               hand-rolled, dependency-free workbook writer over node:zlib.
                        Consumes the SAME projectRow output as the CSV writer
  csv.ts                the one CSV tokenizer — quoted fields may contain newlines
  dues.ts               dues domain core: Venmo parsing, note → EID matching, the
                        amount → terms rule, and the ONLY place term ordering lives
  roster-index.ts       the uncapped {memberId, normalizedEid, emailLower} index,
                        paged in 1000s, returning a discriminated error
  officer-invites.ts    mintInviteToken, hashInviteToken (only the DIGEST is stored),
                        INVITE_TTL_HOURS, MIN_OFFICER_PASSWORD, inviteState — the
                        ONE definition of liveness. ⚠️ Imports node:crypto, so it
                        must never reach a Client Component
  officer-roster.ts     who can sign in vs. who merely has an account. 🪤 Spans two
                        stores PostgREST cannot join; every function returns a
                        discriminated result
  admin-profiles.ts     fetchOfficerNames — "who did this" is always a second query
  request-ip.ts         hashClientIp(scope) — the SCOPED throttle hash. ⚠️ Imports
                        next/headers, so it must never be imported by checkin.ts
  validation.ts         zod schemas
  utils.ts              `cn()` — clsx + tailwind-merge, created by `shadcn init`
                        and required by every shadcn component. ⚠️ It is NOT a
                        general-purpose helper drawer: nothing else belongs in
                        this file, and the rest of the app composes class
                        strings directly as it always has
  site.ts               ALL public copy and content constants: socials, emails,
                        mission, ACTIVITIES, HISTORY_*, FAQ, PROJECT*, PARTNERS
                        (with logo paths), and the GALLERY_* placeholder slots.
                        Its header is where the no-photography decision and the
                        restore path are written down
  officers.ts           officer roster. No `photo` field, deliberately
scripts/create-officer.mjs  officer bootstrap / password reset / revoke
supabase/migrations/    versioned SQL
supabase/seed.sql
components/shadcn/      🏗️ shadcn/ui components, added on demand with
                        `npx shadcn@latest add <name>`. ⚠️ This path is
                        DELIBERATE, set in components.json: shadcn's default
                        alias is `components/ui`, and `shadcn init` used it to
                        overwrite this project's own button.tsx, which 45 files
                        import. Never point it back
components/             site-header.tsx (5-item nav incl. Admin, absolutely
                        centred wordmark, navy Check In), site-footer.tsx
                        (socials row + address; NO officer link — it is in the
                        nav now). ui/ holds every shared primitive, and BOTH
                        halves of the app use it — /admin used to import two
                        things from here, which is the whole story of its drift:
                          layout    section.tsx (ground + gutter + rhythm in one
                                    place, so the Two Grounds Rule is structural).
                                    🔓 v2 phase 1 added a FOURTH ground, `field`
                                    — the drawn navy radial — and it carries
                                    `.on-navy` for the same reason `navy` does:
                                    a new ground answers the focus ring in the
                                    same commit. panel.tsx, page-header.tsx
                          type      heading.tsx (Headline/Title/Eyebrow/Lead —
                                    ground-aware via an .on-navy variant, not a
                                    prop), chevron-section.tsx (PageHero — navy
                                    field, grid overlay, chevron notch)
                          controls  button.tsx (buttonClass + named constants —
                                    class strings, not components, because every
                                    call site is already an <a>, a <Link> or a
                                    <button>), field.tsx (Field/Input/Select/
                                    Textarea/controlClass/CHECKBOX — deliberately
                                    thin; see the invariant), chip.tsx
                          feedback  banner.tsx (Banner + ReadError — ONE status
                                    language for the whole app), pill.tsx,
                                    empty-state.tsx (never a <Hatch>)
                          data      table.tsx (Table/THead/Tr/Th/Td, with the row
                                    hover none of the eight admin tables had)
                          content   partners.tsx, kpi-plate.tsx, activities.tsx,
                                    officer-card.tsx, hatch.tsx (the labelled
                                    placeholder box — every image slot is one),
                                    wordmark.tsx (draws in currentColor so it
                                    works on white AND navy; its exclamation dot
                                    is the one rounded thing in the codebase)
                          motion    reveal.tsx (server-safe revealDelay) +
                                    reveal-observer.tsx (the client observer)
public/                 partners/ (4 logos) and NOTHING ELSE. photos/ was
                        deleted with the photography — see the invariant
tests/                  Vitest — integration tests against the local stack
proxy.ts                admin route protection — Next 16 renamed middleware.ts;
                        the exported function is proxy(), not middleware()
vercel.json             function region pinned to cle1 (us-east-2) — in-repo
```

`vercel build` **cannot run locally on Windows** — it fails with `EPERM … symlink` when emitting function output. It still validates `vercel.json` and compiles routes. Use `npm run build` for ordinary local builds.

## Working agreements

- When a decision changes, update `docs/student-org-website-architecture.md` and bump its version header. Code and doc drifting apart is how the next officer inherits a mystery.
- Keep `tasks.md` current; refill its "Later" section as each stage is reached. Record what a phase found in `docs/build-log.md` rather than growing this file.
- Stages are ordered so each ends with something demonstrable. Prefer finishing a stage's exit criteria over starting the next stage's interesting parts.
- Operational gotcha: the Supabase free tier pauses after inactivity and needs a manual resume from the dashboard. Check before the first event of each semester — the single most likely operational surprise (§2.2).
- **Capacity questions are questions about constants, not about bills.** §2.2's worst case (500 members, 3 events/week, 150 attendees each) holds on every free tier with orders of magnitude to spare, and Supabase MAU doesn't grow with the roster because members have no accounts. What breaks is `RATE_LIMIT_MAX` and `MEMBER_SCAN_LIMIT`, silently. Answer "do we need to upgrade?" by reading the caps, not the pricing page.
- Accounts: project infrastructure belongs to the org, never to an individual. The repo is [Texas-MISA/MISA-Website](https://github.com/Texas-MISA/MISA-Website) (public, org-owned); other services use a dedicated org email. Everything must stay transferable — officers turn over every year. See §2.3.
- **The repo is public.** Seed and test data must be obviously fake — never a real roster export, real EIDs, or real emails.

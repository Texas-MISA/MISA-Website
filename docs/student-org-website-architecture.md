# Student Organization Website — Architecture & Staged Build Plan

**Version:** 1.6
**Status:** In progress — Stage 1
**Last updated:** July 2026

> **v1.6:** the five schema-affecting open decisions are resolved (§9) and §4
> updated to match. Two are departures from what this doc previously assumed:
> the roster **self-registers with no officer confirmation**, and `leaderboard`
> is keyed on **(member, term)** rather than being a flat view or a
> term-parameterized function. `members` gains `normalized_student_id` and
> `source`.
>
> **v1.5:** §2.3 now covers Supabase account moves alongside Vercel's. Added
> §2.4 (account inventory — what exists, who owns it, where credentials are)
> and §2.5 (credential storage, an open decision for Stage 9). Flags the two
> live single points of failure: the MISA email as universal recovery
> address, and a sole GitHub org Owner.
>
> **v1.4:** added §2.3 — account ownership and transferability. Services live
> under a dedicated org identity; every service is also individually
> transferable, and the database is disposable by design (schema as
> migrations in the repo). The repo now lives in the `Texas-MISA` GitHub org
> and is public — officers use their own accounts as org members, which is
> the preferred pattern over a shared login wherever a service supports it.
>
> **v1.3:** the build landed on Next.js 16, which renames the `middleware.ts`
> file convention to `proxy.ts` (exported function `proxy()`). References
> updated in §5, §7, and §10. The gating logic is unchanged.

---

## 1. Purpose

A single web application that replaces spreadsheet-based attendance tracking for a student organization with a self-service, auditable system.

The application serves three audiences from one codebase:

| Audience | What they do | Auth required |
|---|---|---|
| **Prospective / general public** | Learn what the org is, when it meets, how to join | No |
| **Members** | Check in at events, view the leaderboard, look up their own attendance history | No (identity-based, not password-based) |
| **Officers / admins** | Create the event schedule, manage the member roster, review and correct attendance | Yes |

### 1.1 Problem being solved

Spreadsheet-based tracking breaks down at three points: manual event-to-timestamp matching is error-prone, members have no way to check their own standing without asking an officer, and the sheet's formula logic becomes fragile as it accumulates edge cases. This system moves that logic into a database with constraints, so bad data is rejected at write time rather than patched later.

### 1.2 Success criteria for v1

- A member can check in at an event in under 20 seconds on a phone, without an account.
- An officer can publish next month's schedule in one sitting.
- Attendance is automatically attributed to the correct event with zero manual matching in the common case.
- A check-in submitted outside its event window is never lost — it lands in a review queue an officer can resolve in a few clicks.
- A member can see their own attendance record without contacting anyone.
- Total recurring infrastructure cost: **$0**, excluding an optional domain (~$12/year).

### 1.3 Explicit non-goals for v1

Scoping these out keeps v1 shippable. They are candidates for later stages, not omissions:

- Member accounts with passwords
- Payment processing for dues
- Email/SMS notifications
- Native mobile app
- Public-facing officer directory or blog/CMS

---

## 2. Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Framework** | Next.js (App Router) | First-class Vercel deployment; Server Components and Server Actions let attendance logic run server-side without a separate API service |
| **Language** | TypeScript | Generated Supabase types give end-to-end type safety from Postgres schema to React props |
| **Styling** | Tailwind CSS | Fast iteration, no separate stylesheet to maintain, good defaults for responsive/mobile-first work |
| **Database** | Supabase (Postgres) | Relational model fits the domain (members ↔ events ↔ attendance); real constraints and views instead of application-layer validation |
| **Auth** | Supabase Auth | Admin-only; email/password or magic link. Integrates natively with Row Level Security |
| **Authorization** | Postgres Row Level Security | Security enforced at the data layer, so a frontend bug cannot leak or corrupt data |
| **Hosting (frontend)** | Vercel | Free hobby tier, preview deploys per branch, automatic HTTPS |
| **Version control / CI** | GitHub + Vercel Git integration | Push to `main` deploys production; PRs get preview URLs |

### 2.1 Why this stack over alternatives

- **vs. Firebase:** the data is inherently relational and the reporting is aggregate-heavy (counts, rankings, joins across three tables). Postgres does this in a view; a document store makes you do it in application code.
- **vs. a Google Sheets + Apps Script upgrade:** no real access control, no schema constraints, and no clean public-facing UI.
- **vs. Django/Rails + managed Postgres:** more capable, but requires a paid always-on host and adds an operational surface the next officer would have to inherit.

### 2.2 Cost model

| Service | Tier | Relevant limits | Projected usage |
|---|---|---|---|
| Vercel | Hobby (free) | 100 GB bandwidth/mo | Well under |
| Supabase | Free | 500 MB database, 50k MAU | Well under — a few hundred members and a few thousand attendance rows per year is a few MB |
| Domain | Optional | — | ~$12/year |

**Note on the Supabase free tier:** projects pause after a period of inactivity and need a manual resume from the dashboard. For an org with events during the semester this is rarely an issue, but plan a wake-up check before the first meeting of each semester. This is the single most likely operational surprise.

### 2.3 Account ownership and transferability

Officers turn over every year, so every account this project depends on must be either handed over or moved without rebuilding anything. Current policy: **the services live under a dedicated org identity** (a shared org email, not any individual's), so the common handoff is transferring that login. GitHub is the exception and the better model — a real GitHub *organization*, where each officer uses their own account and membership is granted and revoked, so there is no shared login to hand over at all. Prefer that pattern wherever a service supports it.

The dedicated account itself may need to move someday — a compromised email, a change in org structure — so the per-service transfer paths matter too:

| Service | Handoff via shared login | Transfer between accounts | Notes |
|---|---|---|---|
| GitHub | ✔ | ✔ Settings → Transfer ownership; history, issues, and redirects preserved | **Done:** the repo lives in the `Texas-MISA` org and is public. Handoff = add the next owner, remove the last; no transfer needed. Public also sidesteps Vercel Hobby's restriction on deploying *private* org-owned repos. Officers work through their own GitHub accounts as org members, so no shared GitHub login exists or is needed. |
| Supabase | ✔ | ✔ Three ways, see below | Project `misa-website`, ref `gbxypeofjnhrhotlhyzs`, region us-east-2. Or skip transfer entirely: the database is **disposable by design** — see below. |
| Vercel | ✔ | ✔ Three ways, see below | Currently the MISA email's personal **Hobby** account (`txmisa-jds-projects`) — Vercel Teams are Pro-only, so there is no org-level scope on the free tier. This is therefore a shared-login handoff, unlike GitHub. |
| Domain | ✔ (registrar login) | ✔ Registrar transfer: unlock + auth code, takes days | Slowest to move; keep the registrar login in the shared credentials, or leave it and re-point DNS. |

**Moving Vercel off a given email**, in order of preference:

1. **Change the email on the account.** Account Settings → email. Project, env vars, domains, deployment history, and the git connection all stay put; only the login identity changes. No migration at all, and the right answer when the goal is just "stop tying this to that mailbox."
2. **Transfer the project.** Project Settings → Advanced → Transfer Project. Clean when the destination is a Vercel *team*; personal-to-personal is the awkward case on the free tier, since Teams are Pro-only.
3. **Re-import.** Always works. A successor imports the repo and recreates 6 environment variables (2 values × production/preview/development). Do it with the CLI, not the dashboard — see the env-var warning below. What is lost: deployment history, logs, analytics, and possibly the `*.vercel.app` subdomain if the name is contested. A custom domain moves by removing it from the old project and adding it to the new, with DNS unchanged.

**Moving Supabase off a given email**, same shape as Vercel:

1. **Change the email on the account** — Account Settings. Keeps the project, its ref, all keys, and the database untouched. Simplest when the mailbox is the only thing changing.
2. **Transfer the project** — Project Settings → General → Transfer project. The receiving organization needs a free-tier slot available (the free tier allows 2 active projects per account, which is what forced the dedicated account in the first place).
3. **Recreate from migrations** — see the disposable-database paragraph below. Always available, and the fallback if the other two are blocked.

CLI access is separate from dashboard access: `supabase login` stores a token per profile (`--profile <name>` keeps multiple accounts side by side; the token itself lives in the OS keyring, not in the repo). A successor runs `supabase login` and `supabase link --project-ref <ref>` and is current — nothing about the CLI needs transferring.

**Manage Vercel environment variables through the CLI, not the dashboard.** They are stored encrypted and cannot be read back — `vercel env pull` returns empty strings for them — so a dashboard edit is a blind write over state nobody can inspect. Use `vercel env rm` followed by `printf '%s' "$VALUE" | vercel env add NAME <env>`, which also avoids invisible characters from copy-paste. Note that `NEXT_PUBLIC_*` values are inlined at build time, so any change requires a redeploy, not a restart.

**The database is disposable, and must stay that way.** Because the full schema lives in `supabase/migrations/` and `seed.sql` in the repo, a brand-new database is: create project → `supabase link` → `db push` → update two env vars. Past years' data is not operationally needed — export tables to CSV (or `pg_dump`) for the archive before decommissioning, and start clean. This is the escape hatch if a transfer is ever awkward, and it only works under one discipline: **never change the schema through the dashboard SQL editor without capturing the change as a migration file.** The moment the live database and `migrations/` drift, the database stops being recreatable. (Within a school year, prefer the `term` column for resets — a new database is for handoffs and fresh starts, not semesters.)

### 2.4 Account inventory

Every account the project depends on. "The shared login" is not an actionable handoff instruction unless this table is filled in and current.

| Account | Identity | What it controls | Credentials live |
|---|---|---|---|
| MISA email | shared org mailbox | The recovery address for every account below — the root of the whole tree | *TBD (§2.5)* |
| GitHub org `Texas-MISA` | owned by the MISA email; officers join as members with their own accounts | The repository | No shared login; membership only |
| Supabase | MISA email | Project `misa-website` / `gbxypeofjnhrhotlhyzs`, us-east-2 | *TBD (§2.5)* |
| Supabase database password | — | `db push`, direct Postgres connections | ⚠️ Currently a plaintext file on one officer's laptop. **Must move.** |
| Vercel | MISA email, personal Hobby account `txmisa-jds-projects` | Hosting, env vars, domain binding | *TBD (§2.5)* |
| Domain registrar | not yet purchased (Stage 9) | DNS | *TBD (§2.5)* |

**The MISA email is the single point of failure.** It is the password-reset address for everything else, so losing it is materially worse than losing any individual service. Two mitigations, both cheap:

- **Keep at least two GitHub org Owners** — the MISA account plus one current officer's personal account. GitHub requires an owner to administer an org, and an org whose only owner is an inaccessible mailbox needs a slow manual support process to recover. This is the one live single point of failure in the current setup.
- **Store 2FA recovery codes wherever the passwords are stored.** The standard student-org failure is a shared account with 2FA bound to one person's phone, and that person graduates. Recovery codes are what make the account survivable; a password alone is not enough.

### 2.5 Credential storage — open decision

**Not yet decided.** The rules below hold regardless of which vault is chosen; pick the vault during Stage 9 and fill in §2.4.

What must be stored, for each account: the login email, the password, the 2FA recovery codes, and a one-line note on what breaks if it is lost. Plus the Supabase database password, which is not recoverable from any dashboard — only resettable.

What must **not** be stored there, because it is already in the repo or regenerable: the Supabase anon/publishable key (public by design, §6), the project ref, and anything in `.env.example`.

Requirements the vault has to meet: survives one person graduating, is not tied to a personal device, and can be handed to a successor as a unit. A shared password manager (Bitwarden's free org tier, or 1Password's student-org plan) meets all three. Storing everything inside the MISA Google account is simpler but circular — that account is the recovery path for the others, so it cannot also be the place its own recovery codes live.

Until this is resolved, the Supabase database password sits in a plaintext file on one laptop, which fails all three requirements.

The Stage 9 handoff guide should amount to: §2.4 filled in, the vault handed over, and a pointer to this section.

---

## 3. System Architecture

```
                       ┌─────────────────────────────┐
   Public visitor ────▶│  Next.js on Vercel          │
   Member         ────▶│  ├── Server Components      │
   Officer        ────▶│  ├── Server Actions         │
                       │  └── Route Handlers         │
                       └──────────────┬──────────────┘
                                      │
                       ┌──────────────┴──────────────┐
                       │  Supabase                   │
                       │  ├── Postgres + RLS         │
                       │  ├── Auth (admins only)     │
                       │  └── Views & SQL functions  │
                       └─────────────────────────────┘
```

**Key architectural decision:** all writes go through Server Actions or Route Handlers using the service role or an authenticated session — never from the browser with elevated keys. The browser only ever holds the anon key, and the anon key's permissions are defined by RLS policies that assume it is hostile.

---

## 4. Data Model

### 4.1 Tables

```sql
-- Roster. Seeded by admins, and also self-populating: an unrecognized student
-- ID at check-in creates a member immediately, with no officer confirmation
-- (Open Decision #2, resolved). See 4.2 for how typos are contained.
create table members (
  id           uuid primary key default gen_random_uuid(),
  student_id   text not null,
  normalized_student_id text generated always as
                 (upper(regexp_replace(student_id, '\s|-', '', 'g'))) stored,
  full_name    text not null,
  email        text not null,
  active       boolean not null default true,
  source       text not null default 'admin'
                 check (source in ('admin','self_checkin')),
  joined_at    timestamptz not null default now()
);

-- Identity is the normalized ID, not the raw one, so 'ut-123', 'UT 123', and
-- 'UT123' cannot become three members. Email is matched case-insensitively
-- for the same reason.
create unique index members_normalized_id on members (normalized_student_id);
create unique index members_email_lower   on members (lower(email));

-- The schedule. Created in advance, but editable at any time — see 4.6.
create table events (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  description        text,
  location           text,
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  checkin_opens_at   timestamptz,   -- defaults to starts_at if null
  checkin_closes_at  timestamptz,   -- defaults to ends_at if null
  points             integer not null default 1,
  category           text,          -- 'general_meeting' | 'workshop' | 'social' | 'flagship' | ...
  term               text,          -- e.g. 'F26'; scopes leaderboard resets
  status             text not null default 'draft'
                       check (status in ('draft','published','cancelled')),
  series_id          uuid,          -- groups events created as a recurring batch
  created_by         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint valid_window check (ends_at > starts_at)
);

-- One row per check-in. Stores the raw submission alongside the resolved links.
-- Both foreign keys are nullable: a submission that matches no open event and/or
-- no roster member is still captured, as 'pending', for an officer to resolve.
create table attendance (
  id                   uuid primary key default gen_random_uuid(),
  event_id             uuid references events(id) on delete set null,
  member_id            uuid references members(id) on delete set null,
  submitted_name       text not null,
  submitted_student_id text not null,
  normalized_student_id text generated always as
                         (upper(regexp_replace(submitted_student_id, '\s|-', '', 'g'))) stored,
  submitted_email      text not null,
  submitted_at         timestamptz not null default now(),
  source               text not null default 'self_checkin'
                         check (source in ('self_checkin','admin_manual')),
  status               text not null default 'pending'
                         check (status in ('present','pending','rejected')),
  resolution_note      text,
  resolved_by          uuid references auth.users(id),
  resolved_at          timestamptz,
  -- A row may only count toward the leaderboard once both links are resolved.
  constraint present_requires_resolution check (
    status <> 'present' or (event_id is not null and member_id is not null)
  )
);

-- Prevents double credit for the same person at the same event, including when
-- an officer manually assigns an orphan to an event the member already attended.
-- Partial so that rejected rows don't block a corrected re-entry.
create unique index attendance_one_per_event
  on attendance (event_id, normalized_student_id)
  where event_id is not null and status <> 'rejected';

-- Discretionary points awarded outside of event attendance: volunteering,
-- recruiting, competition placements, or corrections. Negative values allowed.
create table point_adjustments (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members(id) on delete cascade,
  points      integer not null check (points <> 0),
  reason      text not null,
  category    text not null default 'other'
                check (category in ('volunteer','recruitment','competition','leadership','correction','other')),
  event_id    uuid references events(id) on delete set null,  -- optional context
  term        text,
  awarded_by  uuid not null references auth.users(id),
  awarded_at  timestamptz not null default now(),
  voided_at   timestamptz,
  voided_by   uuid references auth.users(id),
  void_reason text,
  constraint void_is_complete check (
    (voided_at is null and voided_by is null) or
    (voided_at is not null and voided_by is not null)
  )
);

-- Single append-only audit log across every entity an officer can modify.
-- Replaces the attendance-specific table from v1.1: event edits and point
-- grants need the same accountability, and three parallel tables would drift.
create table admin_audit (
  id          bigserial primary key,
  entity_type text not null
                check (entity_type in ('attendance','event','member','point_adjustment')),
  entity_id   uuid not null,
  actor_id    uuid not null references auth.users(id),
  acted_at    timestamptz not null default now(),
  action      text not null,
  before      jsonb,
  after       jsonb,
  note        text
);

create index admin_audit_entity_idx
  on admin_audit (entity_type, entity_id, acted_at desc);
create index admin_audit_actor_idx
  on admin_audit (actor_id, acted_at desc);

-- Officer accounts, keyed to Supabase Auth users.
create table admin_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role         text not null default 'officer'
                 check (role in ('officer','admin'))
);
```

### 4.2 Design notes

- **Nothing is ever dropped on the floor.** `attendance` stores the raw submission *and* the resolved links separately. A member who forgets to check in during the window, typos their ID, or isn't on the roster yet still produces a row — it just arrives as `pending` instead of `present`. A member who showed up and got no credit is the failure mode that erodes trust in the whole system, so the schema is built to make that outcome impossible.
- **Two independent failure modes, one status.** A pending row is missing an event link, a member link, or both. The admin UI distinguishes them; the database doesn't need to, because `present_requires_resolution` guarantees a row can't count until both are filled in.
- **`present_requires_resolution` is the load-bearing constraint.** It means the leaderboard query can trust `status = 'present'` without re-checking for nulls, and an officer cannot approve a half-resolved row by mistake.
- **`normalized_student_id`** is a generated column stripping whitespace, hyphens, and casing. Duplicate detection and roster matching both key off it, so `ut-12345`, `UT 12345`, and `UT12345` are the same person.
- **The partial unique index excludes rejected rows**, so an officer can reject a bad submission and enter a corrected one for the same person and event.
- **`source`** separates member self-check-ins from officer-created rows, which matters when auditing why someone's count looks unusual.
- **`points` on events** allows weighting (a general meeting vs. a flagship event) without a schema change later.
- **`events.status`** replaces a boolean publish flag. `cancelled` is distinct from deleted: a cancelled event keeps its attendance history and disappears from the upcoming list, whereas deletion would orphan real records. Deleting an event that has attendance should be blocked outright in the UI.
- **`point_adjustments.reason` is `not null`** on purpose. An unexplained point grant is precisely what turns a leaderboard from a record into a rumor, and requiring the reason at the database level means no UI shortcut can skip it.
- **Adjustments are voided, never deleted.** A void is itself a recorded action with its own reason, so the history of "points were granted then taken back" survives.
- **Negative adjustments are allowed**, which makes this one mechanism for bonuses, penalties, and corrections rather than three.
- **One audit table, not several.** `admin_audit` keys on `(entity_type, entity_id)` so event edits, point grants, and attendance overrides all land in the same place. This makes "show me everything this officer did last month" a single query.
- **`checkin_opens_at` / `checkin_closes_at`** decouple the check-in window from the event's actual time — useful for a grace period for late arrivals. Widening these is the *preferred* fix for a systematically late crowd; manual override is for individuals.
- **Self-registration is resolution order, not a separate flow.** A check-in resolves its member link by trying, in order: `normalized_student_id`, then `lower(email)`. Only if both miss is a new member created, with `source = 'self_checkin'`. Matching on email second is what contains the common failure — someone who typos their student ID is recognized by their email and linked to their existing record instead of becoming a duplicate person. A member created this way is immediately `active` and counts on the leaderboard; there is no approval step.
- **`members.source`** distinguishes admin-seeded from self-registered rows. Officers filter the directory by it to review who the form has added, which is the cleanup path for junk rows. Self-registration writes no `admin_audit` row — there is no acting officer, and `source` plus `joined_at` already record it.
- **The residual risk is a typo in *both* ID and email**, which creates a genuine duplicate person. Rare, visible in the directory, and merged by an officer. This was accepted deliberately in exchange for zero-friction check-in at recruiting events.

### 4.3 Event-window resolution

The core piece of logic. A submission's timestamp determines its event:

```sql
create or replace function open_event_at(ts timestamptz default now())
returns setof events
language sql stable as $$
  select *
  from events
  where status = 'published'
    and ts >= coalesce(checkin_opens_at, starts_at)
    and ts <= coalesce(checkin_closes_at, ends_at)
  order by starts_at desc
  limit 1;
$$;
```

Ambiguity is prevented by an exclusion constraint or an application-level check that rejects creating overlapping published events, so at most one event can be open at any instant.

When no event is open, the submission is still accepted — but only within a bounded **orphan grace window**, so the form can't be used to manufacture attendance in the middle of summer:

```sql
create or replace function nearby_events(ts timestamptz default now(), window_hours int default 48)
returns table (event_id uuid, title text, starts_at timestamptz, ends_at timestamptz, gap interval)
language sql stable as $$
  select id, title, starts_at, ends_at,
         case when ts > ends_at then ts - ends_at else starts_at - ts end
  from events
  where status = 'published'
    and ts between starts_at - make_interval(hours => window_hours)
                and ends_at   + make_interval(hours => window_hours)
  order by 5 asc;
$$;
```

If `nearby_events()` returns nothing, the check-in is refused outright with a message. If it returns rows, the submission is stored as `pending` and those rows become the ranked suggestions an officer sees in the review queue.

### 4.4 Leaderboard view

Points now come from two sources, and the view keeps them separate rather than collapsing them into one number:

The view is keyed on **`(member, term)`** — one row per member per term (Open Decision #4, resolved). Callers filter to a term for semester standings, or sum across terms for all-time, so no term-parameterized function is needed and no migration is required when the second semester starts:

```sql
create or replace view leaderboard as
with terms as (
  -- Every term a member could appear in, so someone with bonus points but no
  -- attendance (or vice versa) still gets a row rather than vanishing.
  select term from events where term is not null
  union
  select term from point_adjustments where term is not null
),
member_terms as (
  select m.id as member_id, m.full_name, t.term
  from members m cross join terms t
  where m.active
),
attendance_pts as (
  select a.member_id, e.term,
         count(*)                   as events_attended,
         coalesce(sum(e.points), 0) as pts
  from attendance a
  join events e on e.id = a.event_id
  where a.status = 'present'
    and e.status <> 'cancelled'
  group by a.member_id, e.term
),
bonus_pts as (
  select member_id, term, coalesce(sum(points), 0) as pts
  from point_adjustments
  where voided_at is null
  group by member_id, term
)
select
  mt.member_id                                   as id,
  mt.full_name,
  mt.term,
  coalesce(ap.events_attended, 0)                as events_attended,
  coalesce(ap.pts, 0)                            as attendance_points,
  coalesce(bp.pts, 0)                            as bonus_points,
  coalesce(ap.pts, 0) + coalesce(bp.pts, 0)      as total_points
from member_terms mt
left join attendance_pts ap
       on ap.member_id = mt.member_id and ap.term = mt.term
left join bonus_pts bp
       on bp.member_id = mt.member_id and bp.term = mt.term;
```

Ordering moves to the caller, since it differs by use (`order by total_points desc, events_attended desc` for a single term; a `sum(...) group by id` wrapper for all-time).

**Three cases the migration has to get right**, all of them silent-wrong-answer bugs rather than errors:

- **Zero-attendance members** must still appear with 0 in a term, which is why `member_terms` cross-joins rather than starting from `attendance`.
- **Events or adjustments with `term is null`** are excluded from every term bucket. Either backfill `term` on all events, or treat null as its own bucket — decide in Stage 1 and enforce with a `not null` if the answer is "always set it."
- **Attendance and bonus terms are independent.** A bonus awarded in S27 for work done in F26 counts in whichever `point_adjustments.term` says, not the event's.

**Why the split columns matter:** a member looking at their total should be able to see how much of it came from showing up versus from discretionary grants, and an officer should be able to notice at a glance if the top of the leaderboard is driven by bonuses rather than attendance. Collapsing both into `total_points` hides exactly the thing worth watching.

**Privacy note:** the view deliberately excludes `student_id` and `email`. A public leaderboard should never expose identifiers that are used elsewhere as credentials. Consider offering members an opt-out or a display-name field before making it fully public.

### 4.5 Member directory view

Backs the admin roster screen. Pre-joining the aggregates means filtering and sorting is one indexed query rather than N per row:

```sql
create or replace view member_directory as
select
  m.id,
  m.student_id,
  m.full_name,
  m.email,
  m.active,
  m.joined_at,
  coalesce(l.events_attended, 0)   as events_attended,
  coalesce(l.attendance_points, 0) as attendance_points,
  coalesce(l.bonus_points, 0)      as bonus_points,
  coalesce(l.total_points, 0)      as total_points,
  (select count(*) from attendance a
    where a.member_id = m.id and a.status = 'pending')       as pending_count,
  (select max(a.submitted_at) from attendance a
    where a.member_id = m.id and a.status = 'present')       as last_seen_at,
  (select count(*) from events e
    where e.status = 'published' and e.ends_at < now())      as events_possible
from members m
left join leaderboard l on l.id = m.id;
```

`events_possible` enables an attendance-rate column (`events_attended::numeric / nullif(events_possible,0)`) without a second round trip.

Since `leaderboard` is now per `(member, term)`, this view must either take the same shape or aggregate across terms — pick one in Stage 1 and be consistent, because a directory silently showing one term's points while the leaderboard shows all-time is exactly the kind of discrepancy nobody notices until an award is decided. `events_possible` needs the same treatment: scoped to the term being displayed, not all events ever.

### 4.6 Event edit semantics

Events are editable at any point, including after attendance exists. That flexibility creates four cases the UI has to handle deliberately:

| Edit | Effect on existing attendance | Behavior |
|---|---|---|
| Change `points` | Recomputes every attendee's total retroactively | Allowed, but warn with the count of members affected before saving |
| Narrow the check-in window | Existing `present` rows may now fall outside it | **Not retroactive.** Recorded attendance is a fact; the window is only consulted at resolution time. Warn, don't revoke. |
| Move `starts_at` / `ends_at` | Same as above | Allowed with the same warning |
| Delete an event with attendance | Would orphan real records | Blocked. Offer `status = 'cancelled'` instead, which preserves history and removes it from the upcoming list |

Cancelled events are excluded from leaderboard totals but remain visible in a member's attendance history, so someone who attended an event that was later cancelled can still see they were there.

Every event edit writes an `admin_audit` row with the before/after JSON, which makes "why did everyone's total change last Tuesday" answerable.

---

## 5. Route Structure

```
/                      Landing page — org info, upcoming events, join CTA
/attend                Public check-in form
/leaderboard           Public standings
/lookup                Member self-service attendance history
/admin/login           Officer sign-in
/admin                 Dashboard — recent check-ins, pending review count
/admin/events          Schedule list — filter by term, status, category
/admin/events/new      Create event, optionally as a recurring series
/admin/events/[id]     Edit event, view its attendance, duplicate, cancel
/admin/members         Roster directory — sort, filter, select, copy, export
/admin/members/[id]    Member detail — full history, adjustments, notes
/admin/points          Point adjustment ledger — every grant, filterable by officer
/admin/attendance      Review queue — all submissions, filterable by status
/admin/attendance/[id] Submission detail: raw form data, suggestions, override actions
/admin/audit           Full activity log across all entities
```

Everything under `/admin/*` (except `/admin/login`) is gated by `proxy.ts` (Next 16's rename of `middleware.ts`), which checks for a valid session and a matching `admin_profiles` row.

---

## 6. Security Model

The public check-in form is the main attack surface: it accepts unauthenticated writes.

| Concern | Mitigation |
|---|---|
| Anon key over-permission | RLS: anon role can `select` only from `leaderboard` and published `events`. All writes go through Server Actions. |
| Spam / bot submissions | Honeypot field, per-IP rate limit on the check-in action, submissions rejected outside any open window |
| Check-in on behalf of someone else | Accepted risk for v1 — same as a paper sign-in sheet. Mitigate later with a rotating per-event code displayed at the venue. |
| Attendance data enumeration | `/lookup` requires student ID **and** matching email before returning history |
| Roster PII exposure | Emails and student IDs never returned to unauthenticated clients under any route |
| Roster pollution via self-registration | The check-in form can create members (§4.2), so junk rows are reachable by anyone who can submit during an open window. Bounded by the window, honeypot, and rate limit; contained by matching on email before creating; visible via `members.source = 'self_checkin'` in the directory. Impact is cleanup, not data loss. |
| Officer grants attendance or points improperly | Every override and adjustment writes an `admin_audit` row with actor, timestamp, before/after values, and a required reason. The log is append-only and not deletable from the app. |
| Bulk roster export leaks member PII | Export is the largest PII egress point in the system. Gate it behind an authenticated session, log every export to `admin_audit` with the filter used and row count, and consider restricting it to the `admin` role. |
| Orphan submissions used to fabricate attendance | Check-ins are only accepted within 48 hours of a published event; everything outside that is refused, not queued |
| Preview deployments writing to the production database | Vercel previews inherit production env vars, so every PR preview is a second, public check-in form pointed at the real Supabase project. Keep Vercel Deployment Protection at **Standard Protection**: production public, previews gated. Revisit if previews ever get their own Supabase project. |
| Admin privilege escalation | `admin_profiles` is not writable by any client role; officers are added via the Supabase dashboard or a seeded SQL script |

**Threat model boundary:** this system protects against casual abuse and accidental data exposure. It is not designed to withstand a determined attacker, and it holds no financial or highly sensitive data. Scope the security work accordingly — the RLS policies matter far more than, say, elaborate bot detection.

---

## 7. Project Stages

Stages are ordered so that each one ends with something demonstrable. Effort estimates assume part-time work alongside coursework.

---

### Stage 0 — Foundations
**Goal:** A deployed skeleton, so deployment is never the thing that blocks a feature.

- Initialize Next.js + TypeScript + Tailwind
- Create GitHub repo; connect to Vercel; confirm push-to-deploy on `*.vercel.app`
- Create Supabase project; store keys in Vercel env vars and `.env.local`
- Verify a server-side Supabase query renders on a deployed page

**Exit criteria:** a live URL that reads one row from Postgres.
**Effort:** ~half a day.

---

### Stage 1 — Data Layer
**Goal:** The schema exists and enforces its own rules.

- Write migrations for `members`, `events`, `attendance`, `point_adjustments`, `admin_profiles`, `admin_audit`
- Add constraints, the `open_event_at()` and `nearby_events()` functions, and the `leaderboard` and `member_directory` views
- Generate TypeScript types from the schema
- Seed with realistic fake data — 30+ members, 10+ past events, varied attendance

**Exit criteria:** invalid data (overlapping events, duplicate check-ins, `ends_at` before `starts_at`) is rejected by the database, verified by hand in the SQL editor.
**Effort:** 1–2 days. Do not rush this stage; schema changes get expensive once UI depends on them.

---

### Stage 2 — Public Landing Page
**Goal:** Something worth showing people.

- Org overview, mission, meeting cadence, contact/social links
- Upcoming events pulled live from `events where status = 'published'`
- Officer roster section (static content is fine)
- Mobile-first responsive layout

**Exit criteria:** a stranger understands what the org does and when it meets.
**Effort:** 2–3 days, mostly content and design rather than logic.

---

### Stage 3 — Attendance Capture
**Goal:** The core feature. This is the reason the project exists.

- `/attend` form: name, student ID, email
- Server Action that resolves the submission against `open_event_at()`, then matches `normalized_student_id` to the roster
- Both links resolved → `present`. Either missing → `pending`, with a message telling the member their check-in was received and is awaiting officer review
- No published event within the 48-hour orphan window → refuse outright
- Clear success, pending, duplicate, and refused states
- Honeypot field + basic rate limiting

**Exit criteria:** a check-in submitted during a test event window lands on the correct event as `present`; one submitted an hour after the window closes is stored as `pending`; one submitted three weeks from any event is refused.
**Effort:** 3–4 days. Budget most of it for edge cases, not the happy path.

**Test cases to write explicitly:**
- Before window opens / during / after window closes
- Just outside the window vs. far outside the orphan grace window
- Two events back to back with adjacent windows
- Duplicate submission by the same student ID
- Duplicate where the first submission is still `pending`
- Student ID not on the roster
- Whitespace, casing, and formatting variance in student IDs

---

### Stage 4 — Admin Foundation & Event Management
**Goal:** Officers can run the schedule entirely from the UI, and can reshape it at any point without a developer.

**Auth and shell**
- Supabase Auth email/password sign-in at `/admin/login`
- `proxy.ts` gating `/admin/*` against a valid session + `admin_profiles` row
- Persistent admin nav; dashboard with recent check-ins and a pending-review badge

**Event management**
- Full CRUD, editable at any time — before, during, or after the event has happened
- **Draft → published → cancelled** lifecycle, so a schedule can be built up privately and released at once
- **Duplicate event** — one click to clone a past event's title, duration, window offsets, points, and category. This is the single highest-leverage admin feature for an org with a weekly general meeting.
- **Recurring series creation** — "every Tuesday 6–7pm until Dec 4" generates the batch in one action, sharing a `series_id` so the set can be edited or cancelled together
- Independent check-in window controls, with sensible defaults derived from the event time and a quick "open 15 min early / close 15 min late" preset
- Per-event `points`, `category`, and `term`
- Overlap validation on publish, so no two published events can be open simultaneously
- **Edit-impact warnings** implementing the rules in §4.6: changing points shows how many members' totals will shift; narrowing a window shows how many existing check-ins now fall outside it; deleting an event with attendance is blocked with a prompt to cancel instead
- Every mutation writes to `admin_audit`

**Exit criteria:** an officer with no database access builds a 12-week recurring schedule, publishes it, then reschedules one week's meeting and changes its point value — seeing an accurate warning about who is affected before saving.
**Effort:** 6–7 days. The recurrence and duplication work is what makes this stage worth its size; skipping it means every meeting is entered by hand forever.

---

### Stage 5 — Attendance Review & Manual Adjustments
**Goal:** Officers can see every submission, correct any of them, and award points that didn't come from a check-in. Until this ships, pending rows accumulate with no way to resolve them.

**Review queue (`/admin/attendance`)**
- Table of all submissions: submitted name, ID, email, exact timestamp, resolved event, status
- Filters by status, date range, and event; default view is `pending`, oldest first
- Pending count surfaced as a badge on the admin dashboard so the queue doesn't rot

**Submission detail (`/admin/attendance/[id]`)**
- Raw form data exactly as the member typed it, with the submission timestamp shown to the minute
- **Suggested events** from `nearby_events()`, ranked by proximity and annotated with the gap — "General Meeting, closed 41 minutes before this submission"
- **Suggested members** when the student ID doesn't match: fuzzy matches on name and email, with the near-miss ID shown for comparison
- Actions: assign event, link member, approve, reject, edit submitted fields, add a note
- Approving is blocked in the UI until both links are set — the database would reject it anyway via `present_requires_resolution`, but the UI should say so before the officer clicks

**Supporting work**
- Bulk assign, for the common case where a whole group checked in after the meeting ended
- Manual creation of an attendance row for a member who never submitted anything at all (`source = 'admin_manual'`)
- Every action writes an `admin_audit` row; the detail page shows that row's full history
- Optional resolution note, and a prompt for one on reject

**Point adjustments (`/admin/points`)**
- Award or deduct points for any member outside of event attendance: volunteering, recruiting a new member, competition placement, leadership work, or correcting a past mistake
- Required reason and category on every grant — the form cannot submit without them
- Grant to a single member, or to a multi-select group in one action (e.g. everyone who staffed the info booth)
- Optional link to a related event for context
- Ledger view of all adjustments, filterable by officer, category, date range, and member — so the question "who has been handing out points" has a one-screen answer
- Void with a reason rather than delete; voided rows stay visible, struck through, and stop counting immediately

**Exit criteria:** an officer takes a submission that arrived 40 minutes after an event closed, assigns it to the correct event, approves it, sees the member's leaderboard count increase, and can later see exactly who made that change and when. Separately, an officer awards 5 bonus points to three members at once with a reason, and those points appear in the `bonus_points` column, distinct from attendance points.
**Effort:** 5–6 days. The suggestion ranking is what turns the review queue from a tedious data-entry screen into a two-click operation — worth the extra time.

**Design note:** resist the urge to auto-resolve near-misses. A submission five minutes past the window is *probably* legitimate, but auto-approving it just moves the boundary and invites the same problem five minutes later. Keep the human in the loop and make the human's job fast instead.

---

### Stage 6 — Member Directory
**Goal:** Officers can slice the roster any way they need and get the result out of the system in one action. This is the screen officers will actually live in.

**Sorting**
- Every column sortable: name, student ID, join date, events attended, attendance points, bonus points, total points, attendance rate, last seen, pending count
- Server-side sorting against `member_directory`, not client-side — required for correct behavior with pagination

**Filtering, composable**
- Active / inactive
- Point range, events-attended range, attendance-rate threshold
- Attended *or* missed a specific event (the query officers ask most often)
- Joined within a date range; not seen since a date
- Has pending submissions awaiting review
- Free-text search across name, ID, and email

**Selection and extraction**
- Row checkboxes plus **"select all N matching this filter"** — explicitly distinct from "select the 25 rows on this page." Getting this wrong is the classic bug in this kind of screen, and it silently produces a partial email list.
- **Copy emails** as a comma-separated string, ready to paste into a To: field. This is the workflow officers care about most; make it one click with a visible confirmation of how many addresses were copied.
- **Copy as TSV** — pastes directly into Sheets or Excel with columns intact
- **Copy names** for announcements or shoutouts
- **Download CSV** for the current filter and column selection
- Saved filter presets, shared across officers — "award eligible", "missed last 3 meetings", "inactive since October"

**Supporting work**
- CSV roster import with a preview-and-confirm step, duplicate detection on `normalized_student_id`, and a dry-run row count before committing
- Member detail page: full attendance history, point adjustment history, officer notes
- Exports logged to `admin_audit` per §6

**Exit criteria:** an officer filters to members who attended fewer than three events this term, sees an accurate count, clicks copy-emails, and pastes a complete list into an email client — with the list containing every matching member, not just the visible page.
**Effort:** 4–5 days. Mostly query and UI-state work rather than new domain logic, but the select-all-matching semantics and the import preview deserve real test coverage.

---

### Stage 7 — Member-Facing Views
**Goal:** Members can answer their own questions.

- `/leaderboard` — ranked standings from the view, with tie handling
- Attendance points and bonus points shown as separate columns, so standings are explicable
- `/lookup` — student ID + email, returns per-event attended/missed summary
- Any point adjustments shown with their reason, so a member can see why their total differs from their attendance count
- Pending submissions shown distinctly from confirmed ones, so a member who checked in late knows their form was received and is awaiting review rather than assuming it vanished
- Attendance-rate calculation and a visual summary of the semester

**Exit criteria:** a member can determine their own standing, why it is what it is, which specific events they missed, and whether anything of theirs is still pending — without asking an officer.
**Effort:** 3 days.

---

### Stage 8 — Hardening & Data Integrity
**Goal:** Trust the data enough to base decisions on it.

- Write and test every RLS policy; attempt each forbidden operation with the anon key and confirm it fails
- Confirm `admin_audit` is append-only: no client role can update or delete a row
- Verify officers cannot grant points or approve attendance for themselves without it being visible in the ledger
- Attendance and adjustment export for archival
- Error boundaries, loading states, empty states

**Exit criteria:** attempting to read the roster, write attendance, grant points, or alter an audit row directly with the anon key fails for every table.
**Effort:** 3–4 days. Historically the stage most likely to be skipped and most likely to be regretted.

---

### Stage 9 — Launch
**Goal:** In real use by real members.

- Custom domain purchase + DNS to Vercel; update Supabase redirect URLs
- Migrate historical data from the existing spreadsheet tracker
- Officer walkthrough and a one-page written handoff guide — the account side is just the shared login plus §2.3; the guide's real content is operations (review queue, semester wake-up check, event duplication)
- Soft launch at one event with a paper backup sign-in sheet on hand

**Exit criteria:** one full event runs on the system with no manual intervention.
**Effort:** 1–2 days plus migration time, which depends on how clean the existing data is.

---

### Stage 10 — Post-v1 Backlog
Not commitments — a parking lot, roughly ordered by value per unit of effort.

- QR code per event linking to a pre-filled check-in
- Rotating per-event check-in code to prevent remote check-ins
- Email the member automatically when their pending submission is approved or rejected
- Member-initiated attendance appeal from `/lookup`, which opens a pending row directly in the review queue
- Dues tracking and payment status
- Email reminders before events and end-of-semester standing summaries
- Officer roles with differentiated permissions
- Attendance analytics: trends over time, retention curves, event-type comparison
- Member accounts with saved profiles
- Public event calendar feed (iCal)

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Supabase free-tier project pauses between semesters | Medium | Medium | Calendar reminder to wake the project before the first event of each term |
| Members check in without attending | Medium | Low | Accepted for v1; per-event codes in Stage 10 |
| Schema change needed after UI is built | Medium | Medium | Invest in Stage 1; seed realistic data early to surface modeling gaps |
| Overlapping events create ambiguous matching | Low | High | Constraint at publish time; explicit test coverage in Stage 3 |
| Pending queue is never reviewed and members lose credit | Medium | High | Pending badge on the admin dashboard; oldest-first default sort; make queue review part of the officer handoff doc |
| Late check-in becomes the norm once members learn overrides exist | Medium | Medium | Widen `checkin_closes_at` if it's systemic; the audit log makes the pattern visible per member |
| Discretionary points quietly decide the leaderboard | Medium | Medium | Bonus and attendance points shown as separate columns everywhere; required reason on every grant; ledger view surfaces per-officer patterns |
| Officer edits an event's points and silently changes past standings | Medium | Medium | Edit-impact warning with affected-member count before saving; before/after captured in `admin_audit` |
| Bulk email copy grabs only the visible page | Medium | Low | Explicit "select all N matching" semantics with the count shown on the copy confirmation; covered by tests in Stage 6 |
| Project has no maintainer after handoff | High | High | Written handoff doc, plain-vanilla stack, no exotic dependencies; all services under one dedicated, transferable org account and the database recreatable from the repo (§2.3) |
| MISA email lost or inaccessible | Low | High | It is the password-reset address for every other account, so this is the worst single failure. Keep ≥2 GitHub org Owners, and store 2FA recovery codes outside the account they protect (§2.4, §2.5) |
| Credentials live only on one officer's laptop | High | High | Currently true of the Supabase database password. Resolve §2.5 and fill in §2.4 before handoff — a password nobody else can reach is the same as a lost one |
| Scope creep delays past the semester start | High | Medium | Stage 10 exists precisely so good ideas can be recorded and deferred |

---

## 9. Open Decisions

### Resolved before Stage 1 (2026-07-29)

The five that affect the schema. Decided together; the schema in §4 reflects them.

2. **Roster policy** — ✅ **Self-registering, no confirmation.** An unrecognized student ID at check-in creates an active member immediately. Resolution order is `normalized_student_id`, then `lower(email)`, then create; matching on email second contains the common typo case. `members.source` marks self-registered rows for review. Accepted residual risk: a typo in both ID *and* email creates a duplicate person, merged by an officer. Chosen for zero-friction check-in at recruiting events.
3. **Points weighting** — ✅ **Per-event `points`, default 1.** Flat scoring in practice, weighting available without a migration.
4. **Semester boundaries** — ✅ **Views keyed on `(member, term)`.** Callers filter to a term or sum across terms, so per-semester and all-time both work from one view and §4.5's function conversion is never needed.
5. **Excused absences** — ✅ **Deferred to post-v1.** Attendance rate stays raw `attended / possible`. `point_adjustments` already handles the standing side with a required reason, so the gap is cosmetic rather than punitive.
7. **Orphan grace window** — ✅ **48 hours**, as one exported constant feeding `nearby_events()`.

### Still open

Not schema-affecting, so they can wait — but #9 and #11 want answers before the leaderboard decides anything real.

1. **Leaderboard visibility** — fully public, or behind the member lookup flow? Affects whether names appear on an indexable page.
6. **Override authority** — can any officer approve a pending row, or only the `admin` role? Relevant if the leaderboard determines anything real.
8. **Resolution deadline** — is there a point after which pending rows can no longer be approved, e.g. end of semester? Prevents retroactive standing changes after eligibility is decided.
9. **Point grant caps** — should a single officer be able to award unlimited bonus points, or should grants above some threshold require the `admin` role? Worth deciding before the leaderboard determines anything with stakes.
10. **Self-grants** — can an officer award points to themselves? Simplest defensible answer is yes but always visible in the ledger; the alternative is blocking it outright.
11. **Bonus points in public standings** — shown as a separate column, folded into the total silently, or excluded from the public leaderboard entirely?

---

## 10. Repository Layout

```
/app
  /(public)
    page.tsx                 landing
    /attend/page.tsx
    /leaderboard/page.tsx
    /lookup/page.tsx
  /admin
    /login/page.tsx
    page.tsx
    /events/...
    /members/...
    /attendance/...
  /actions
    attendance.ts            server actions
    events.ts
    members.ts
    points.ts
    audit.ts                 shared admin_audit writer
/lib
  supabase/
    server.ts                server client
    client.ts                browser client
  types/database.ts          generated types
  validation.ts              zod schemas
  filters.ts                 directory filter → SQL translation
  export.ts                  CSV / TSV / clipboard formatting
/supabase
  /migrations                versioned SQL
  seed.sql
/components
  /ui                        shared primitives
  ...
proxy.ts                     admin route protection (Next 16 rename of middleware.ts)
```

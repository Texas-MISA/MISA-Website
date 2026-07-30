# Student Organization Website — Architecture & Staged Build Plan

**Version:** 1.3
**Status:** In progress — Stage 0
**Last updated:** July 2026

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
-- Roster of known members. Seeded by admins; not self-registration in v1.
create table members (
  id           uuid primary key default gen_random_uuid(),
  student_id   text unique not null,
  full_name    text not null,
  email        text unique not null,
  active       boolean not null default true,
  joined_at    timestamptz not null default now()
);

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

```sql
create or replace view leaderboard as
with attendance_pts as (
  select a.member_id,
         count(*)                   as events_attended,
         coalesce(sum(e.points), 0) as pts
  from attendance a
  join events e on e.id = a.event_id
  where a.status = 'present'
    and e.status <> 'cancelled'
  group by a.member_id
),
bonus_pts as (
  select member_id, coalesce(sum(points), 0) as pts
  from point_adjustments
  where voided_at is null
  group by member_id
)
select
  m.id,
  m.full_name,
  coalesce(ap.events_attended, 0)                as events_attended,
  coalesce(ap.pts, 0)                            as attendance_points,
  coalesce(bp.pts, 0)                            as bonus_points,
  coalesce(ap.pts, 0) + coalesce(bp.pts, 0)      as total_points
from members m
left join attendance_pts ap on ap.member_id = m.id
left join bonus_pts      bp on bp.member_id = m.id
where m.active
order by total_points desc, events_attended desc;
```

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

`events_possible` enables an attendance-rate column (`events_attended::numeric / nullif(events_possible,0)`) without a second round trip. If the leaderboard resets per term, both this view and `leaderboard` take a `term` parameter and become functions instead.

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
| Officer grants attendance or points improperly | Every override and adjustment writes an `admin_audit` row with actor, timestamp, before/after values, and a required reason. The log is append-only and not deletable from the app. |
| Bulk roster export leaks member PII | Export is the largest PII egress point in the system. Gate it behind an authenticated session, log every export to `admin_audit` with the filter used and row count, and consider restricting it to the `admin` role. |
| Orphan submissions used to fabricate attendance | Check-ins are only accepted within 48 hours of a published event; everything outside that is refused, not queued |
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
- Officer walkthrough and a one-page written handoff guide
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
| Project has no maintainer after handoff | High | High | Written handoff doc, plain-vanilla stack, no exotic dependencies |
| Scope creep delays past the semester start | High | Medium | Stage 10 exists precisely so good ideas can be recorded and deferred |

---

## 9. Open Decisions

Worth resolving before Stage 1 rather than mid-build:

1. **Leaderboard visibility** — fully public, or behind the member lookup flow? Affects whether names appear on an indexable page.
2. **Roster policy** — admin-seeded only, or can an unknown student ID self-register on first check-in as a pending member?
3. **Points weighting** — flat one point per event, or per-event weights from day one?
4. **Semester boundaries** — does the leaderboard reset each term? If so, add a `term` column in Stage 1, not later.
5. **Excused absences** — does the model need them, and do they affect attendance rate?
6. **Override authority** — can any officer approve a pending row, or only the `admin` role? Relevant if the leaderboard determines anything real.
7. **Orphan grace window length** — 48 hours is a starting guess. Long enough that a member who forgets until the next morning is covered; short enough to stay meaningful.
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

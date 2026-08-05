-- Stage 6 phase 4: officer-defined custom fields on the roster.
--
-- The shape here was settled by a spike before any of it was written (recorded
-- in tasks.md, 2026-08-02), because the storage choice is forced by sorting and
-- getting it wrong is a schema migration rather than a refactor. Confirmed
-- against both the local stack and the hosted project, on postgrest/14.5:
--
--   * `.order("custom_fields->>key")` is accepted on a table AND through a
--     view — the view being the case that matters, since the directory reads
--     member_directory and not members.
--   * It survives .range() pagination, but only alongside the existing
--     .order("id") tiebreak. Without it, paging 30 rows at 7/page returned one
--     duplicate and therefore silently dropped one row.
--   * `.eq("custom_fields->>key", value)` works too, so phase 6 can filter on
--     custom fields and not merely sort by them.
--
-- So JSONB it is, and the fallback that was on the table — a fixed set of
-- generic custom_1 … custom_n text columns — is not needed. The reason JSONB
-- was in question at all: PostgREST orders by column and cannot be handed an
-- expression (the wall migration 14 hit with attendance_rate), an EAV values
-- table cannot be sorted from the parent under pagination at all, and
-- `create or replace view` cannot grow a column per officer-defined field.

-- ---------------------------------------------------------------------------
-- 1. Option-list validation, as a function, because CHECK cannot hold a subquery
-- ---------------------------------------------------------------------------
--
-- "options is non-empty, has no blank entries, and is bounded" needs to look at
-- every element, which in a CHECK means either a subquery (not permitted) or an
-- immutable function (permitted). Same pattern as term_of() feeding the
-- generated `events.term` column.
create or replace function public.valid_field_options(options text[])
returns boolean
language sql
immutable
as $$
  select options is not null
     and array_length(options, 1) between 1 and 40
     and array_position(options, null) is null
     and coalesce(bool_and(length(trim(o)) between 1 and 80), false)
     and count(*) = count(distinct lower(trim(o)))
  from unnest(options) o
$$;

comment on function public.valid_field_options(text[]) is
  'Dropdown option lists: 1-40 entries, none null, none blank, none longer than '
  '80 chars, no two the same ignoring case. Duplicates are rejected because the '
  'stored value IS the option text — two options that differ only in case would '
  'be indistinguishable once written into members.custom_fields.';

-- ---------------------------------------------------------------------------
-- 2. The definitions
-- ---------------------------------------------------------------------------
create table public.member_field_definitions (
  id                uuid primary key default gen_random_uuid(),

  -- The stable machine key. Values in members.custom_fields are keyed by this,
  -- so it is the one column that must never change after rows reference it.
  --
  -- 🔓 The format check is a SECURITY control, not tidiness. This key is
  -- interpolated into a PostgREST `order=` term as `custom_fields->>key`, and
  -- the spike showed exactly what an unconstrained key buys: a key containing a
  -- comma breaks out of the order term and is parsed as a SECOND order column
  -- (`custom_fields->>a,b` came back `42703 column ... b does not exist`, i.e.
  -- an arbitrary column name would have been accepted). `.` and `)` fail as
  -- PGRST100 parse errors — but a SPACE and a `"` were accepted silently, with
  -- no error at all. Ordering by a hidden column leaks no values, but it is not
  -- a door to leave open, and "it errored when I tried it" is not a boundary.
  -- The same regex lives in lib/members.ts and is applied in the zod schema; a
  -- key that has not been through it must never reach an order string.
  key               text not null,

  label             text not null,

  -- Dropdown only for now. Written as a CHECK with one value rather than left
  -- free text so 'text' and 'boolean' can be added later by widening the check
  -- — no data migration, and no window where an unhandled kind is storable.
  kind              text not null default 'select'
                      check (kind in ('select')),

  options           text[] not null,

  -- "Can officers change this straight from the directory table?" — the option
  -- offered when the field is created. False means the detail page only.
  editable_inline   boolean not null default true,

  -- Otherwise every field ever created widens the directory forever. A field
  -- can exist, be editable, and still not be a column.
  show_in_directory boolean not null default true,

  sort_order        integer not null default 0,

  -- Archiving, never deleting. A hard delete would leave stored values keyed to
  -- a definition nobody can look up, which silently rewrites what the roster
  -- said at the time — the same reason a point adjustment is voided rather than
  -- removed (§4.2).
  archived_at       timestamptz,

  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint member_field_definitions_key_format
    check (key ~ '^[a-z][a-z0-9_]{0,39}$'),

  -- Phase 5's export field catalogue is ONE namespace over the built-in columns
  -- and the custom fields, so a key colliding with a built-in makes two
  -- different columns compete for one name in the picker, the CSV header, and
  -- the xlsx header. Sort keys themselves cannot collide — they are namespaced
  -- `cf:<key>` in lib/filters.ts — so this is the catalogue's guard, not the
  -- sort's, and it is cheap to enforce here where it cannot be forgotten.
  constraint member_field_definitions_key_not_builtin
    check (key not in (
      'id','eid','email','name','full_name','active','source','joined_at',
      'notes','custom_fields','total_points','attendance_points','bonus_points',
      'events_attended','events_possible','attendance_rate','pending_count',
      'last_seen_at'
    )),

  constraint member_field_definitions_label_not_blank
    check (length(trim(label)) > 0 and length(label) <= 80),

  constraint member_field_definitions_options_valid
    check (public.valid_field_options(options))
);

-- Unique across archived definitions too, not only live ones. Re-creating a
-- field under a key that was archived would silently adopt every value still
-- stored under it — a new "Dues 2027" field pre-filled from "Dues 2026".
create unique index member_field_definitions_key_idx
  on public.member_field_definitions (key);

-- The directory reads the live definitions in sort order on every request.
create index member_field_definitions_live_idx
  on public.member_field_definitions (sort_order, key)
  where archived_at is null;

create trigger member_field_definitions_set_updated_at
  before update on public.member_field_definitions
  for each row execute function public.set_updated_at();

alter table public.member_field_definitions enable row level security;

-- ---------------------------------------------------------------------------
-- 3. The values
-- ---------------------------------------------------------------------------
--
-- One JSONB object per member, keyed by definition key. `not null default '{}'`
-- rather than nullable: a member with no answers has an empty object, so every
-- reader can do `custom_fields->>key` without first testing the column for null.
-- A missing key still reads as SQL NULL, which is what sorts last and what the
-- UI renders as "—".
alter table public.members
  add column custom_fields jsonb not null default '{}'::jsonb;

-- jsonb accepts a bare scalar or an array as a valid document; nothing below
-- would work if a member's custom_fields were `[1,2]` or `"x"`.
alter table public.members
  add constraint members_custom_fields_is_object
    check (jsonb_typeof(custom_fields) = 'object');

-- For containment lookups — phase 6's "everyone whose dues_paid is no". This
-- index does NOT serve the sort: `explain (analyze)` on
-- `order by custom_fields->>'key', id` is a seq scan plus a sort, and
-- index-backing that would need a btree expression index per key. At 33 members
-- against §2.2's 500-member worst case there is nothing to do about it —
-- recorded so nobody later assumes the GIN made sorting cheap.
create index members_custom_fields_gin
  on public.members using gin (custom_fields);

-- ---------------------------------------------------------------------------
-- 4. The compare-and-set anchor inline editing needs
-- ---------------------------------------------------------------------------
--
-- events and attendance both carry updated_at; members never needed one because
-- nothing edited a member. Inline editing changes that, and two officers on the
-- directory at once is the ordinary case rather than the exotic one.
--
-- Existing rows take the migration timestamp. As with migration 13, that is not
-- a claim they were edited now — this is a concurrency anchor, not a fact about
-- the member. joined_at remains the fact.
alter table public.members
  add column updated_at timestamptz not null default now();

-- One set_updated_at() for the whole schema, defined with the events table.
create trigger members_set_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Surface both on the directory view
-- ---------------------------------------------------------------------------
--
-- `create or replace`, NOT drop and create. The replace form can only append
-- columns, which is all this needs, and dropping would take the grants with it —
-- member_directory is granted to authenticated as a §6 security boundary, and a
-- recreate silently re-inherits anon access from the default privileges set in
-- migration 12 (found live in production, fixed in migration 15). Appending is
-- why custom_fields and notes go last rather than beside the identity columns.
create or replace view public.member_directory as
with cur as (
  select public.current_term() as term
),
possible as (
  select count(*) as events_possible
  from public.events e
  where e.status = 'published'
    and e.ends_at < now()
    and e.term = (select term from cur)
),
attendance_agg as (
  select a.member_id,
         count(*)                   as events_attended,
         coalesce(sum(e.points), 0) as attendance_points
  from public.attendance a
  join public.events e on e.id = a.event_id
  where a.status = 'present'
    and e.status <> 'cancelled'
    and e.term = (select term from cur)
  group by a.member_id
),
bonus_agg as (
  select member_id, coalesce(sum(points), 0) as bonus_points
  from public.point_adjustments
  where voided_at is null
    and term = (select term from cur)
  group by member_id
)
select
  m.id,
  m.eid,
  m.full_name,
  m.email,
  m.active,
  m.source,
  m.joined_at,
  coalesce(aa.events_attended, 0)   as events_attended,
  coalesce(aa.attendance_points, 0) as attendance_points,
  coalesce(ba.bonus_points, 0)      as bonus_points,
  coalesce(aa.attendance_points, 0)
    + coalesce(ba.bonus_points, 0)  as total_points,
  -- Deliberately NOT term-scoped, unlike everything above: a pending row from
  -- last term still needs an officer, and "when did we last see this person"
  -- is an all-time question. The UI must label both so they are not read as
  -- current-term figures sitting beside current-term ones.
  (select count(*) from public.attendance a
    where a.member_id = m.id and a.status = 'pending')      as pending_count,
  (select max(a.submitted_at) from public.attendance a
    where a.member_id = m.id and a.status = 'present')      as last_seen_at,
  -- Term-scoped denominator. An all-time count here against a current-term
  -- numerator would understate every attendance rate and still look plausible.
  (select events_possible from possible)                    as events_possible,
  -- Stored as a fraction rather than a percentage, so the view carries the
  -- number and the UI owns the presentation.
  round(
    coalesce(aa.events_attended, 0)::numeric
      / nullif((select events_possible from possible), 0),
    4
  )                                                         as attendance_rate,
  -- Appended in phase 4. notes was on members from migration 14 but reachable
  -- only by a second query; the detail page's editor and phase 5's export both
  -- want it from the one read.
  m.notes,
  m.custom_fields,
  -- The compare-and-set token, and it has to be ON THE VIEW rather than only in
  -- AUDITED_MEMBER_COLUMNS. Both editing screens READ the view: the directory's
  -- inline cells and the detail page's notes editor each post `updated_at` back
  -- as their CAS anchor, so without it here the render side has no token at all
  -- and every save would have to re-read members first. Carried to the browser
  -- and back as the raw PostgREST string — a JS Date round trip truncates the
  -- microseconds and the compare-and-set then never matches.
  m.updated_at
from public.members m
left join attendance_agg aa on aa.member_id = m.id
left join bonus_agg      ba on ba.member_id = m.id;

-- `create or replace` preserves grants, so these are not strictly required —
-- restated because a replaced view is easy to assume has lost them, and because
-- the one thing that must never silently come back is anon access (migration 15).
revoke all on public.member_directory from anon;
grant select on public.member_directory to authenticated;

-- ---------------------------------------------------------------------------
-- 6. An audit shape for a field definition
-- ---------------------------------------------------------------------------
--
-- Creating, editing, or archiving a definition is an officer mutation like any
-- other and writes an admin_audit row (§4.2, §6). It is its own entity type:
-- a definition is not a member, and filing these under 'member' would put
-- "someone renamed the dues column" into every member's history.
--
-- ⚠️ admin_audit is append-only (P0001 on UPDATE and DELETE alike), so a row
-- written under a wrong entity_type can never be corrected — which is why this
-- widening lands with the migration rather than when the first row is written.
alter table public.admin_audit
  drop constraint admin_audit_entity_type_check;

alter table public.admin_audit
  add constraint admin_audit_entity_type_check check (
    entity_type in (
      'attendance','event','member','point_adjustment','roster','member_field'
    )
  );

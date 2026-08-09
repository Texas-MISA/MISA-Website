-- Stage 7 phase 1. Two changes, one story: make the term the public board is
-- ranking both CORRECT and VISIBLE to an unauthenticated reader.
--
-- ---------------------------------------------------------------------------
-- 🔓 1. current_term() becomes SECURITY DEFINER, because the pin has never
--       worked for any caller that goes through RLS.
-- ---------------------------------------------------------------------------
--
-- §4.4, §4.7 and §9 #4 all describe `app_settings.current_term` as the override
-- an officer sets "to pin the board on a finished term over a break". Measured
-- on 2026-08-09, against the local stack, with the pin set to 'Spring 2026':
--
--     role            current_term()     leaderboard rows
--     postgres        Spring 2026        Spring 2026   (correct)
--     authenticated   Fall 2026          Fall 2026     (pin ignored)
--     anon (PostgREST) Fall 2026         Fall 2026     (pin ignored)
--
-- Why. current_term() is `stable`, NOT `security definer`, so it executes as
-- the *invoker*. Its body reads public.app_settings, which has RLS enabled and
-- ZERO policies — deny-all. An RLS-subject caller therefore gets no row, the
-- coalesce falls through, and it returns term_of(now()): the DERIVED term.
--
-- 🪤 The trap worth naming, because it defeats the obvious reasoning. The views
-- run as their owner (security_invoker stays off — migration 8's header), and
-- that IS what lets anon read past the deny-all base tables. But owner rights
-- cover the tables the view references DIRECTLY. A plain (non-definer) function
-- called from inside the view still runs as the invoker, so current_term()
-- inside member_directory and leaderboard is evaluated with anon's privileges
-- no matter who owns the view. "The view runs as owner" is true and does not
-- reach this.
--
-- Why nobody has hit it: every admin screen reads through createAdminClient()
-- (service role, bypasses RLS) and sees the pin correctly, and `leaderboard`
-- had no reader at all until this stage. The defect has been latent since
-- migration 1 and lands squarely on the first anon-facing term-scoped page —
-- which is the one being built in this phase. Fixing it here rather than
-- working around it, because a page that silently ranks a different term than
-- its heading claims is the failure §7's own Stage 7 bullet exists to prevent.
--
-- The exposure this opens is one derived term string. app_settings itself stays
-- deny-all: an RLS policy would have been the other fix and it would have
-- handed anon `updated_by` (an officer's uuid) and `updated_at` too, because
-- migration 12 already grants anon all privileges on all tables and only RLS
-- withholds them. SECURITY DEFINER exposes exactly the one value and nothing
-- else, which is why it is the tighter option here rather than the looser one.
--
-- `set search_path = ''` is mandatory on a definer function: without it the
-- caller controls name resolution inside a body running with owner rights.
-- Every reference in the body is already schema-qualified, so an empty path
-- resolves cleanly (built-ins live in pg_catalog, which is always implicit).
--
-- Stays STABLE, so point_adjustments' `default current_term()` and both views
-- are unaffected. NOT immutable and still must not become so — it reads a
-- table, and a generated column would then cache a term that later changes.

create or replace function public.current_term()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select current_term from public.app_settings),
    public.term_of(now())
  )
$$;

-- ---------------------------------------------------------------------------
-- 2. leaderboard gains `term`, so the board's heading and its rows come from
--    ONE query.
-- ---------------------------------------------------------------------------
--
-- With the definer fix above, `rpc('current_term')` would now answer correctly
-- for anon and the page could ask twice — once for the rows, once for the
-- label. It asks once instead. The label cannot disagree with the numbers
-- beside it when it arrives on the same row, and the failure this replaces was
-- exactly two sources for one fact. It also keeps the page honest if the
-- definer fix is ever reverted: the heading would move with the board rather
-- than diverge from it.
--
-- 📌 APPEND-ONLY, so `create or replace` is legal and there is no drop here.
-- The three existing columns keep their name, type and position; `term` is
-- added last. That matters twice:
--   * `create or replace view` cannot reorder, rename, retype or drop a column,
--     which is why `term` goes last rather than beside the total it scopes;
--   * no drop means GRANTS SURVIVE. Migrations 15, 16, 18 and 19 all restate
--     member_directory's `revoke ... from anon`, because a dropped-and-recreated
--     view re-inherits anon access from migration 12's default privileges — a
--     hole that was found live in production. Nothing is dropped here, so
--     migration 8's `grant select on public.leaderboard to anon, authenticated`
--     still stands untouched and is deliberately not restated. A reader looking
--     for the re-grant should find this note in its place.
--
-- ⚠️ `term` is a term string, not an identifier. leaderboard remains the single
-- entry on tests/security.test.ts's anon allowlist precisely because it carries
-- no eid and no email, and that test pins the exact column set — it is updated
-- to four names in the same commit as this migration, deliberately rather than
-- as a fix-the-red-test afterthought.

create or replace view public.leaderboard as
with cur as (
  select public.current_term() as term
),
attendance_pts as (
  select a.member_id, coalesce(sum(e.points), 0) as pts
  from public.attendance a
  join public.events e on e.id = a.event_id
  where a.status = 'present'
    and e.status <> 'cancelled'
    and e.term = (select term from cur)
  group by a.member_id
),
bonus_pts as (
  select member_id, coalesce(sum(points), 0) as pts
  from public.point_adjustments
  where voided_at is null
    and term = (select term from cur)
  group by member_id
)
select
  m.id,
  m.full_name,
  coalesce(ap.pts, 0) + coalesce(bp.pts, 0) as total_points,
  (select term from cur)                    as term
from public.members m
left join attendance_pts ap on ap.member_id = m.id
left join bonus_pts      bp on bp.member_id = m.id
where m.active
order by total_points desc, m.full_name;

-- "Student ID" becomes "EID" (Stage 6 phase 2).
--
-- Not only a relabel: the identifier itself becomes a real UT EID — a short
-- alphanumeric like 'ao1234' — replacing the 'UT' + six-sequential-digit shape
-- the seed and the suggestion ranker were built around. This migration does
-- the schema half; seed.sql, lib/attendance.ts's near-miss scoring, and the
-- UI copy move with it.
--
-- Renames only. Postgres rewrites generated-column expressions, CHECK bodies,
-- and index definitions by attnum, so none of those need restating — but the
-- object *names* do not follow, hence the explicit constraint/index renames.

alter table public.members    rename column student_id            to eid;
alter table public.members    rename column normalized_student_id to normalized_eid;
alter table public.members    rename constraint members_student_id_not_blank
                                            to members_eid_not_blank;
alter index public.members_normalized_id    rename to members_normalized_eid;

alter table public.attendance rename column submitted_student_id  to submitted_eid;
alter table public.attendance rename column normalized_student_id to normalized_eid;
alter table public.attendance rename constraint attendance_id_not_blank
                                            to attendance_eid_not_blank;
alter index public.attendance_normalized_idx rename to attendance_normalized_eid_idx;

-- upper() → lower(). EIDs are conventionally written lowercase, and the review
-- screen renders the normalized form back at the member ("matches as ABC1234"
-- at someone who typed abc1234). Case folding is a bijection on the
-- equivalence classes, so members_normalized_eid cannot gain a collision that
-- upper() did not already have.
--
-- The whitespace/hyphen stripping stays. It no longer has its original
-- justification — EIDs contain neither — but people still paste junk, and
-- removing it would rewrite every stored value for nothing.
--
-- ALTER COLUMN ... SET EXPRESSION is Postgres 17; both databases are 17.6.
-- Must come after the renames so the expressions reference the new names.
alter table public.members    alter column normalized_eid
  set expression as (lower(regexp_replace(eid, '\s|-', '', 'g')));
alter table public.attendance alter column normalized_eid
  set expression as (lower(regexp_replace(submitted_eid, '\s|-', '', 'g')));

-- The view has to be dropped, not replaced: `create or replace view` can only
-- APPEND columns, never rename one, and this view pins `student_id` as an
-- output name. Nothing depends on it (no other view, function, or policy), so
-- no CASCADE.
--
-- ⚠️ Recreating it re-inherits anon access. 20260730000012_api_role_grants.sql
-- sets `alter default privileges ... grant all on tables`, which covers views,
-- and a view has no RLS to fall back on. Migration 15 revoked that after it
-- was found live in production; a DROP + CREATE puts it straight back unless
-- the revoke is re-issued below. This is the single easiest thing to lose in
-- this migration — tests/security.test.ts is what catches it.
drop view public.member_directory;

create view public.member_directory as
with cur as (
  select public.current_term() as term
),
-- Hoisted out of the select list. This count is the same for every member —
-- it never depended on m.id — and it is now needed twice, by events_possible
-- and by the rate. Computing it once also stops the two from ever disagreeing.
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
  )                                                         as attendance_rate
from public.members m
left join attendance_agg aa on aa.member_id = m.id
left join bonus_agg      ba on ba.member_id = m.id;

-- Contains eid and email, so authenticated officers only, never anon. Admin
-- screens read it through the service-role client behind requireOfficer().
-- The revoke is not belt-and-braces: see the note above the DROP.
revoke all on public.member_directory from anon;
revoke all on public.member_directory from authenticated;
grant select on public.member_directory to authenticated;

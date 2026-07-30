-- Reporting views (§4.4, §4.5). Both are scoped to current_term().
--
-- These run as their owner (security_invoker stays off), which is what lets
-- the anon role read aggregated standings while RLS denies it direct access
-- to members, attendance, events, and app_settings. The view IS the security
-- boundary — do not set security_invoker = true without re-reading §6.

-- Public standings: one row per active member for the current term, ranked on
-- a single total. No attendance/bonus split here by design (§4.4) — that
-- breakdown lives in member_directory, which only officers can reach.
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
  coalesce(ap.pts, 0) + coalesce(bp.pts, 0) as total_points
from public.members m
left join attendance_pts ap on ap.member_id = m.id
left join bonus_pts      bp on bp.member_id = m.id
where m.active
order by total_points desc, m.full_name;

-- Deliberately excludes student_id and email: a public leaderboard must never
-- expose identifiers used elsewhere as credentials (§6).
grant select on public.leaderboard to anon, authenticated;

-- Admin roster screen. Does NOT build on leaderboard — it keeps the
-- attendance/bonus split, because this is where oversight of discretionary
-- grants lives now. Same term scope, so the two screens cannot disagree.
create or replace view public.member_directory as
with cur as (
  select public.current_term() as term
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
  m.student_id,
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
  (select count(*) from public.attendance a
    where a.member_id = m.id and a.status = 'pending')      as pending_count,
  (select max(a.submitted_at) from public.attendance a
    where a.member_id = m.id and a.status = 'present')      as last_seen_at,
  -- Term-scoped denominator. An all-time count here against a current-term
  -- numerator would understate every attendance rate and still look plausible.
  (select count(*) from public.events e
    where e.status = 'published'
      and e.ends_at < now()
      and e.term = (select term from cur))                  as events_possible
from public.members m
left join attendance_agg aa on aa.member_id = m.id
left join bonus_agg      ba on ba.member_id = m.id;

-- Contains student_id and email, so authenticated officers only — never anon.
grant select on public.member_directory to authenticated;

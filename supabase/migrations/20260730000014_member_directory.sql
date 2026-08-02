-- Stage 6 groundwork (§7 Stage 6): the three things the member directory needs
-- that the schema does not have yet. Found by reading §7's feature list against
-- the existing schema before writing any UI, because each one is cheap now and
-- expensive once a screen depends on it (§7, "don't rush Stage 1").

-- 1. Officer notes on a member.
--
-- §7 puts these on the member detail page. Free text, nullable: there is no
-- meaningful empty-string state, and a not-blank check would only force callers
-- to send null instead of "" for the same meaning.
alter table public.members
  add column notes text;

-- 2. An audit shape for a roster export.
--
-- §6 calls export the largest PII egress point in the system and requires every
-- one logged with the filter used and the row count. admin_audit could not
-- express that: entity_id is `uuid not null` and entity_type allowed only the
-- four real entities, but an export spans N members and is not an entity at
-- all.
--
-- The resolution is a receipt: each export generates its own uuid, which goes
-- in entity_id, with entity_type 'roster'. Nothing else references that uuid —
-- it exists so the row has an identity, which keeps entity_id non-null and
-- keeps the (entity_type, entity_id, acted_at) index meaningful rather than
-- collapsing every export in history onto one synthetic key. The filter and the
-- row count travel in `after` and `note`.
--
-- Chosen over the alternatives deliberately: making entity_id nullable would
-- weaken the column for the four types that do have a real entity, and reusing
-- some member's id would make an export look like an action taken against that
-- one person.
--
-- ⚠️ admin_audit is append-only (P0001 on UPDATE and DELETE alike), so a row
-- written under a wrong shape can never be corrected. That is why this is a
-- migration ahead of the feature rather than a decision made while building it.
alter table public.admin_audit
  drop constraint admin_audit_entity_type_check;

alter table public.admin_audit
  add constraint admin_audit_entity_type_check check (
    entity_type in ('attendance','event','member','point_adjustment','roster')
  );

-- 3. attendance_rate on member_directory.
--
-- §7 wants a sortable rate column and a rate-threshold filter. Neither is
-- possible while the rate is only implied by events_attended and
-- events_possible: PostgREST filters and orders by *column*, and cannot be
-- handed an expression. So the rate has to exist in the view.
--
-- Null, not zero, when the denominator is zero. A term with no completed events
-- has no attendance rate — 0% would read as "attended nothing" and would sort
-- below a real 5%, which is exactly backwards at the start of every semester.
-- Callers must render null as "—".
--
-- create or replace, not drop and create: dropping would take the anon and
-- authenticated grants with it, and this view is a security boundary (§6). The
-- replace form can only append columns, which is why attendance_rate goes last
-- rather than beside the counts it comes from.
create or replace view public.member_directory as
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

-- Unchanged, and restated because a replaced view is easy to assume has lost
-- them: contains student_id and email, so authenticated officers only, never
-- anon. Admin screens read it through the service-role client behind
-- requireOfficer(), as every other admin screen does.
grant select on public.member_directory to authenticated;

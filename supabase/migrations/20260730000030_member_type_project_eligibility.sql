-- Migration 30 — member type and project eligibility (/admin/members item 2).
--
-- Two additions, and the second is derived from the first.
--
-- 1. `members.member_type`: General, Data project, Client project or Junior
--    director. A real column rather than a custom field, on the officer's
--    instruction ("like a custom-field dropdown, but important; other features
--    will read it later"). A custom field is precisely the thing nothing may
--    build on: its key is officer-defined, its option list can be edited out
--    from under every stored answer, and the database constrains none of it.
--    This one has a CHECK, a default and NOT NULL. Everyone starts as General
--    (officer, 2026-10-03): nothing tracks a project member today, so there is
--    nothing to carry over.
--
-- 2. `member_directory.project_eligibility`: 'yes', 'no' or 'not_applicable' —
--    whether a data-project or client-project member is meeting their
--    requirements in the ROW'S term. The rule (officer, 2026-10-03):
--      * attend EVERY published Projects event, and
--      * attend 2 of each Central calendar month's general meetings, or all of
--        them when fewer than 2 were held. A month with none needs nothing.
--    A month is judged once it is over: until then it is met or in progress,
--    never failed. A missed project meeting counts the moment it ends. Every
--    other type is not_applicable.
--
-- ⚠️ "General meeting" has no marker yet. FOR NOW it is any published event on
-- a Thursday, Central time, that is not a Projects event — so a Thursday social
-- counts too. The rule lives in exactly ONE place, the `general_meetings` CTE
-- in section 3, so a real marker later is one edit rather than a hunt.
--
-- ⚠️ The type is STANDING, unlike every aggregate around it. A member holds one
-- type, not one per term, so viewing a past semester judges it against today's
-- type — changing somebody's type re-judges their past terms too.
--
-- 📌 Only PUBLISHED events count, and a meeting is held once `ends_at < now()`,
-- the same test the attendance-rate denominator (`possible`) uses. A check-in
-- still pending review counts for nothing until an officer resolves it, like
-- every other aggregate on this view.
--
-- 🔓 VIEWS, NOT FUNCTIONS, and the reason is the public board. Postgres checks
-- EXECUTE on a function called inside a view against the CALLER, not the view's
-- owner — which is why anon has to hold EXECUTE on current_term() (migration
-- 22's note). `leaderboard` selects FROM member_directory and anon reads
-- `leaderboard`, so a helper function referenced here would either need a grant
-- to anon or turn the public board into a 42501. A RELATION referenced inside a
-- view is checked as the view's owner instead, so the two officer-only views
-- below sit under member_directory with no grant to any API role and the board
-- cannot break. (The planner also prunes the new column from the board's plan,
-- since the board reads four other columns — but nothing here relies on that.)
--
-- 🪤 Supabase's security advisor flags owner-rights views, and it will flag
-- these two exactly as it flags member_directory and leaderboard. Intentional:
-- `security_invoker` would make every read run as the caller, and the caller of
-- the public board is anon.

-- ---------------------------------------------------------------------------
-- 0. Stop before anything changes if a custom field already uses either name.
-- ---------------------------------------------------------------------------
--
-- Section 5 reserves both keys. Re-adding that CHECK over a definition that
-- already holds one fails with "check constraint ... is violated by some row",
-- which names neither the key nor what to do about it — and production could
-- hold one, since an officer waiting for this feature might have built it as a
-- dropdown. Checked FIRST, so a refusal leaves the schema untouched rather than
-- relying on the migration being one transaction. Archived definitions count:
-- the key index spans them for the reason migration 18 gives.
do $$
declare
  taken text;
begin
  select string_agg(key, ', ' order by key)
    into taken
    from public.member_field_definitions
   where key in ('member_type', 'project_eligibility');

  if taken is not null then
    raise exception
      'migration 30 reserves the custom-field key(s) % for real columns, and a field definition already uses them', taken
      using hint = 'Move the stored answers off that field and delete its definition (archived ones included), then apply this migration again.';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 1. The column.
-- ---------------------------------------------------------------------------
--
-- A constant default, so this is a catalogue change: no row is rewritten and
-- the updated_at trigger does not fire, so no officer's compare-and-set token
-- moves underneath them. The roster import, self check-in and every test
-- fixture insert members without naming the column, and all of them inherit
-- the default.
--
-- ⚠️ The list is mirrored by MEMBER_TYPES in lib/member-types.ts, the same pair
-- relationship events_category_valid has with EVENT_CATEGORIES. Changing one
-- without the other gives the officer a select whose options take a 23514.
alter table public.members
  add column member_type text not null default 'general'
    constraint members_member_type_valid
    check (member_type in ('general', 'data_project', 'client_project', 'junior_director'));

-- ---------------------------------------------------------------------------
-- 2. Project meetings: one row per member × published Projects event.
-- ---------------------------------------------------------------------------
--
-- Every member, not only the project types and not only the term's roster: the
-- rule is applied in member_directory, and the member page's breakdown reads
-- this view directly. `status` is attended / missed / upcoming, in that order
-- of precedence — attendance is a fact and outranks the clock, the same call
-- classifyTermEvents makes for the detail page's events grid.
--
-- `attended` is an EXISTS, not a count, so a member holding two present rows
-- for one meeting (the merge hazard lib/merge.ts describes) attends it once.
create view public.member_project_meetings as
with project_meetings as (
  select e.id, e.term, e.title, e.starts_at, e.ends_at, e.ends_at < now() as held
    from public.events e
   where e.status = 'published'
     and e.category = 'projects'
),
per_member as (
  select m.id as member_id,
         p.id as event_id,
         p.term,
         p.title,
         p.starts_at,
         p.ends_at,
         p.held,
         exists (select 1 from public.attendance a
                  where a.event_id = p.id
                    and a.member_id = m.id
                    and a.status = 'present') as attended
    from public.members m
   cross join project_meetings p
)
select member_id,
       event_id,
       term,
       title,
       starts_at,
       ends_at,
       held,
       attended,
       case
         when attended then 'attended'
         when held     then 'missed'
         else 'upcoming'
       end as status
  from per_member;

-- 🔓 NOT OPTIONAL. A new view inherits migration 12's default privileges, and
-- migration 22 narrowed those to SELECT — which on a view with no RLS is every
-- row. This one names every member beside every meeting they missed.
revoke all on public.member_project_meetings from anon;
revoke all on public.member_project_meetings from authenticated;

-- ---------------------------------------------------------------------------
-- 3. General meetings, by month: one row per member × term × Central month
--    that has at least one general meeting in it.
-- ---------------------------------------------------------------------------
--
-- A month with no general meeting has no row, which is the officer's "a month
-- with no meetings held needs nothing" — and so does a month whose only
-- Thursday event was cancelled, since cancelled events are not meetings.
--
-- 📌 Months are CENTRAL calendar months, like every date this app shows. A
-- meeting at 7:30pm on 30 September is 00:30 UTC on 1 October and belongs to
-- September; a UTC truncation would file it under October.
--
-- When a month is COMPLETE: its Central month has ended AND every meeting in
-- it has ended (a meeting starting late on the last day can run past
-- midnight). Once that holds, held = scheduled, so `least(2, scheduled)` is the
-- officer's "2, or all of them when fewer than 2 were held".
--
-- While a month is still running it is met once 2 meetings are attended, and
-- in progress otherwise. It is never not_met: a month is judged once it is
-- over, so an early miss cannot turn the verdict to No in week one.
create view public.member_general_meeting_months as
-- ⚠️ THE TEMPORARY RULE, and its only home. A general meeting is a published
-- event that starts on a Thursday in Central time and is not a Projects event
-- (a Thursday Projects event is a project meeting and nothing else). Replace
-- this CTE's WHERE clause, and nothing else, when general meetings get a real
-- marker.
with general_meetings as (
  select e.id,
         e.term,
         date_trunc('month', e.starts_at at time zone 'America/Chicago')::date as month,
         (date_trunc('month', e.starts_at at time zone 'America/Chicago') + interval '1 month')
           at time zone 'America/Chicago' as month_ends_at,
         e.ends_at < now() as held
    from public.events e
   where e.status = 'published'
     and e.category is distinct from 'projects'
     and extract(isodow from e.starts_at at time zone 'America/Chicago') = 4
),
per_meeting as (
  select m.id as member_id,
         g.term,
         g.month,
         g.month_ends_at,
         g.held,
         exists (select 1 from public.attendance a
                  where a.event_id = g.id
                    and a.member_id = m.id
                    and a.status = 'present') as attended
    from public.members m
   cross join general_meetings g
),
per_month as (
  select member_id,
         term,
         month,
         count(*)                                          as meetings_scheduled,
         count(*) filter (where held)                      as meetings_held,
         count(*) filter (where attended)                  as meetings_attended,
         least(2, count(*))                                as meetings_required,
         (now() >= max(month_ends_at) and bool_and(held))  as month_complete
    from per_meeting
   group by member_id, term, month
)
select member_id,
       term,
       month,
       meetings_scheduled,
       meetings_held,
       meetings_attended,
       meetings_required,
       month_complete,
       case
         when month_complete then
           case when meetings_attended >= meetings_required then 'met' else 'not_met' end
         when meetings_attended >= 2 then 'met'
         else 'in_progress'
       end as status
  from per_month;

revoke all on public.member_general_meeting_months from anon;
revoke all on public.member_general_meeting_months from authenticated;

-- ---------------------------------------------------------------------------
-- 4. member_directory gains member_type and project_eligibility.
-- ---------------------------------------------------------------------------
--
-- 📌 `create or replace`, which may only APPEND columns — and that is all this
-- does. Everything up to `dues_paid_term` is migration 29's definition
-- verbatim; the two new columns come last. No drop, so `leaderboard`, which is
-- defined over this view, is left exactly as it was and is not touched here.
--
-- `project_eligibility` is judged against the ROW'S term, like every aggregate
-- on the view: a Spring 2026 row asks about Spring 2026's meetings. The type it
-- reads is the member's standing one (see the header).
create or replace view public.member_directory as
-- Every term the database knows about. A superset of the terms `roster` can
-- produce, which is all it has to be — `possible` is left-joined FROM roster,
-- so a term in here that nobody belongs to costs one unused row.
--
-- 🪤 Never a typed literal (§4.7). Event terms are generated by term_of(), the
-- adjustment default is current_term(), and the joining term is term_of() over
-- joined_at. current_term() is unioned in so the current term exists here even
-- in an empty database.
with all_terms as (
  select public.current_term() as term
  union
  select e.term from public.events e where e.term is not null
  union
  select pa.term from public.point_adjustments pa
  union
  select ct from public.dues_payments dp, unnest(dp.covered_terms) as ct
    where dp.voided_at is null
  union
  select public.term_of(m.joined_at) from public.members m
),
-- The attendance-rate denominator, per term. Migration 14 hoisted this out of
-- the select list so events_possible and attendance_rate could not disagree;
-- it stays hoisted for the same reason and gains a term key.
possible as (
  select t.term,
         (select count(*)
            from public.events e
           where e.term = t.term
             and e.status = 'published'
             and e.ends_at < now()) as events_possible
    from all_terms t
),
attendance_agg as (
  select a.member_id,
         e.term,
         count(*)                   as events_attended,
         coalesce(sum(e.points), 0) as attendance_points
    from public.attendance a
    join public.events e on e.id = a.event_id
   where a.status = 'present'
     and e.status <> 'cancelled'
   group by a.member_id, e.term
),
bonus_agg as (
  select member_id,
         term,
         coalesce(sum(points), 0) as bonus_points
    from public.point_adjustments
   where voided_at is null
   group by member_id, term
),
dues_agg as (
  select distinct dp.member_id, ct as term
    from public.dues_payments dp, unnest(dp.covered_terms) as ct
   where dp.voided_at is null
),
-- 📌 THE MEMBERSHIP RULE, and the thing to read before trusting this screen.
--
-- A member is on the roster for a term if there is EVIDENCE they were part of
-- the club in it: they were marked present at one of its events, they were
-- granted or docked points in it, their dues cover it, or they joined during
-- it. `joined_at` is not null, so every member always appears in at least one
-- term and nobody can fall out of the roster entirely.
--
-- ⚠️ The consequence, stated because it will look like a bug in week one: at
-- the start of a semester, before any event has happened, the current term's
-- roster is only the members who joined during it or have already paid dues
-- covering it. That is the rule working, not failing — but the empty state on
-- the directory has to say so, and it does.
--
-- A UNION, not UNION ALL: the four sources overlap heavily and the join below
-- would multiply rows.
roster as (
  select member_id, term from attendance_agg
  union
  select member_id, term from bonus_agg
  union
  select member_id, term from dues_agg
  union
  select m.id, public.term_of(m.joined_at) from public.members m
)
select
  m.id,
  m.eid,
  m.full_name,
  m.email,
  m.source,
  m.joined_at,
  -- The scope key. Every aggregate to the right of it is computed for this
  -- term and no other.
  r.term,
  coalesce(aa.events_attended, 0)   as events_attended,
  coalesce(aa.attendance_points, 0) as attendance_points,
  coalesce(ba.bonus_points, 0)      as bonus_points,
  coalesce(aa.attendance_points, 0)
    + coalesce(ba.bonus_points, 0)  as total_points,
  -- ⚠️ These two stay ALL-TIME, and they are now the only columns on the view
  -- that are not scoped to the row's term. A pending row from last term still
  -- needs an officer, and "when did we last see this person" is an all-time
  -- question — the same call migration 14 made, and it matters more here
  -- because everything around them moved. The UI must label both.
  (select count(*) from public.attendance a
    where a.member_id = m.id and a.status = 'pending')      as pending_count,
  (select max(a.submitted_at) from public.attendance a
    where a.member_id = m.id and a.status = 'present')      as last_seen_at,
  p.events_possible,
  round(
    coalesce(aa.events_attended, 0)::numeric
      / nullif(p.events_possible, 0),
    4
  )                                                         as attendance_rate,
  m.notes,
  m.custom_fields,
  m.updated_at,
  -- Renamed from dues_paid_current_term. Same derivation — a live payment whose
  -- covered_terms contains the term — but the term is now the row's, not the
  -- clock's. Still calculated, still never ticked.
  (exists (
     select 1 from public.dues_payments dp
      where dp.member_id = m.id
        and dp.voided_at is null
        and dp.covered_terms @> array[r.term]
   ))                                                       as dues_paid_term,
  -- Migration 30. The member's standing type — the same on every term row.
  m.member_type,
  -- 📌 Calculated, never ticked, and it gates nothing: a label for officers.
  -- `no` once anything has FAILED in the row's term — a project meeting that
  -- ended unattended, or a finished month short of its general meetings.
  -- Otherwise `yes`, which therefore means "nothing has failed so far" until
  -- the term's months are all over. The two views carry the rule; this only
  -- asks whether either found a failure.
  case
    when m.member_type in ('data_project', 'client_project') then
      case
        when exists (select 1 from public.member_project_meetings pm
                      where pm.member_id = m.id
                        and pm.term = r.term
                        and pm.status = 'missed')
          or exists (select 1 from public.member_general_meeting_months gm
                      where gm.member_id = m.id
                        and gm.term = r.term
                        and gm.status = 'not_met')
        then 'no'
        else 'yes'
      end
    else 'not_applicable'
  end                                                       as project_eligibility
from roster r
join public.members m on m.id = r.member_id
left join attendance_agg aa on aa.member_id = r.member_id and aa.term = r.term
left join bonus_agg      ba on ba.member_id = r.member_id and ba.term = r.term
left join possible       p  on p.term = r.term;

-- 🔓 Re-issued, as every recreate of this view must (CLAUDE.md). A `create or
-- replace` keeps the existing privileges — migrations 15 and 22 left none for
-- either role — so these change nothing today. They are here so the next
-- migration that copies this block as a drop-and-create cannot leave them out.
revoke all on public.member_directory from anon;
revoke all on public.member_directory from authenticated;

-- ---------------------------------------------------------------------------
-- 5. Reserve both new column names as custom-field keys.
-- ---------------------------------------------------------------------------
--
-- Both are directory columns now, and filterable ones, so a custom field keyed
-- `member_type` would compete for the header in the export catalogue and for
-- the name in the filter namespace — the collision this constraint exists to
-- prevent. Section 0 has already refused to run over a definition holding
-- either. Migration 29's list, plus the two.
alter table public.member_field_definitions
  drop constraint member_field_definitions_key_not_builtin;

alter table public.member_field_definitions
  add constraint member_field_definitions_key_not_builtin
    check (key not in (
      'id','eid','email','name','full_name','active','source','joined_at',
      'notes','custom_fields','total_points','attendance_points','bonus_points',
      'events_attended','events_possible','attendance_rate','pending_count',
      'last_seen_at','term',
      -- Stage 6.5: dues left the custom-field mechanism entirely.
      'dues','dues_paid','dues_paid_current_term','dues_paid_term',
      -- Migration 30.
      'member_type','project_eligibility'
    ));

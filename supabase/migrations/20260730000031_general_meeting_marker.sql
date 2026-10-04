-- Migration 31 — a real general-meeting marker, and the month the requirement
-- starts (/admin/members item 3).
--
-- Two officer decisions, taken on 2026-10-04, replacing migration 30's
-- temporary Thursday inference:
--
-- 1. `events.counts_as_general_meeting`: an officer ticks "Count as general
--    meeting" on the event (or on a recurring series, which ticks every event it
--    creates). The box is honoured in EVERY category, so a ticked Projects event
--    is a project meeting in member_project_meetings AND a general meeting in
--    member_general_meeting_months. Nothing is inferred from the weekday any
--    more: an unticked Thursday counts for nothing, and a ticked Wednesday
--    counts.
--
--    📌 EVERY EVENT STARTS UNTICKED — the events that already exist (by the
--    column default) and every new one (the forms default unticked too). There
--    is deliberately no backfill: an officer decides which meetings count, one
--    event at a time, and no rule here guesses on their behalf.
--
-- 2. `app_settings.general_meetings_from`: ONLY the monthly general-meeting
--    requirement starts in October 2026. A Central calendar month before it is
--    never judged and has no row, so it needs nothing — the officer's "a month
--    with no meetings needs nothing". Project meetings are NOT cut off: every
--    published Projects event in the term still counts, September's included.
--    The start is one fixed point, not one per term. "October" is the CENTRAL
--    month, like every month this view files a meeting under: a 7:30pm meeting
--    on 30 September is 1 October in UTC and stays in September.
--
-- Unchanged from migration 30: only PUBLISHED events count, a meeting is held
-- once `ends_at < now()`, a month is judged once it ends, and the verdict gates
-- nothing.
--
-- 🔓 WHY THE START LIVES IN A TABLE, AND NEVER IN A FUNCTION. Two reasons, and
-- either alone would decide it:
--   * Permissions. A relation read inside a view is checked as the VIEW'S OWNER,
--     but EXECUTE on a function called inside a view is checked as the CALLER.
--     anon reads `leaderboard`, which selects from member_directory, which reads
--     the view below — so a helper function here would need a grant to anon or
--     turn the public board into a 42501 (migration 30's header, and migration
--     22's note on current_term()). app_settings is read as the owner and stays
--     deny-all to every API role.
--   * Tests have to be able to MOVE it. No month on or after 2026-10-01 has
--     ended yet, so the only way to exercise a judged month under the real rule
--     is to pin an earlier start on a far-past fixture term and put it back.
--     A literal inside the view could not be pinned; a row can.
--
-- 📌 The new events column is anon-readable on PUBLISHED rows through
-- events_public_read (migration 9), like every other events column. That is
-- schedule information — which meetings count — and names nobody.
--
-- 🪤 app/actions/events.ts carries FIVE literal column lists that name
-- verify_origin (migration 28's note): create after, update before and after,
-- delete before, and the duplicate's source read. The audit invariant is that
-- both sides of a before/after select the same columns, so the new column has
-- to reach all five, or the log invents a change that never happened. The
-- series insert and the duplicate's "after" list name it too, so each receipt
-- records it. tests/event-actions.test.ts pins all of that against source.
--
-- ⚠️ DEPLOY ORDER: this migration BEFORE the code. The code selects both new
-- columns, and a select naming a column the database lacks is a 42703 on every
-- events screen. The reverse is harmless: code that predates this migration
-- never names either column, so its inserts take the defaults.

-- ---------------------------------------------------------------------------
-- 1. The marker.
-- ---------------------------------------------------------------------------
--
-- A constant default, so this is a catalogue change: no row is rewritten, the
-- events_set_updated_at trigger does not fire, and no officer's compare-and-set
-- token moves underneath them. Every existing event reads false.
alter table public.events
  add column counts_as_general_meeting boolean not null default false;

comment on column public.events.counts_as_general_meeting is
  'Whether this event counts toward the monthly general-meeting requirement of '
  'data project and client project members (officer, 2026-10-04). Honoured in '
  'every category: a ticked Projects event is a project meeting and a general '
  'meeting. Counts only once published. Every event starts unticked.';

-- ---------------------------------------------------------------------------
-- 2. The month the requirement starts.
-- ---------------------------------------------------------------------------
--
-- On app_settings, the singleton migration 1 created and filled; the default
-- fills its one row here, since nothing will ever insert into it again
-- (migration 26's note). A first-of-month CHECK, because the view compares it
-- with a month — a mid-month value would silently mean the month after it.
--
-- 🪤 Not `date_trunc('month', ...) = general_meetings_from`: on a date that
-- resolves to the timestamptz overload, which is not immutable. extract() on a
-- date is.
--
-- 📌 Like the dues prices, there is deliberately NO UI for this. It changes by
-- migration, next to the reason for the change.
alter table public.app_settings
  add column general_meetings_from date not null default date '2026-10-01'
    constraint app_settings_general_meetings_from_first_of_month
    check (extract(day from general_meetings_from) = 1);

comment on column public.app_settings.general_meetings_from is
  'First Central month whose general meetings are judged (officer, 2026-10-04). '
  'Earlier months have no row and need nothing; project meetings have no start. '
  'A fixed point, not per term. Changed by migration, like the dues prices — no UI.';

-- ---------------------------------------------------------------------------
-- 3. Assert what the header claims, before the view reads it.
-- ---------------------------------------------------------------------------
--
-- Read-only, in migration 26's style: an unasserted change is an optional
-- change. `select into` on an empty table leaves the variable null, so a
-- missing singleton fails here too.
do $$
declare
  rows_found int;
  starts_on date;
  ticked int;
begin
  select count(*) into rows_found from public.app_settings;
  if rows_found <> 1 then
    raise exception
      'app_settings is meant to be a singleton, found % row(s)', rows_found;
  end if;

  select general_meetings_from into starts_on from public.app_settings;
  if starts_on is distinct from date '2026-10-01' then
    raise exception
      'general_meetings_from did not take: %', starts_on;
  end if;

  select count(*) into ticked
    from public.events
   where counts_as_general_meeting;
  if ticked <> 0 then
    raise exception
      'every event is meant to start unticked, but % count as a general meeting', ticked;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 4. General meetings, by month — the marker and the start replace the
--    Thursday inference.
-- ---------------------------------------------------------------------------
--
-- 📌 `create or replace`, so `member_directory` and `leaderboard` above it are
-- left exactly as they were. Migration 30's definition VERBATIM except the
-- general_meetings CTE's WHERE clause and the comment over it: the output
-- columns keep their names, types and order, which is all `create or replace`
-- permits and all the two dependent views bind to.
--
-- Everything migration 30 says over this view still holds: a month with no
-- general meeting has no row and needs nothing; months are CENTRAL calendar
-- months; a month is complete once its Central month has ended and every
-- meeting in it has; and a running month is met at 2 attended and in progress
-- otherwise, never not_met.
create or replace view public.member_general_meeting_months as
-- 📌 THE RULE, and its only home (officer, 2026-10-04). A general meeting is a
-- PUBLISHED event with "Count as general meeting" ticked, in any category (a
-- ticked Projects event is also a project meeting, in member_project_meetings),
-- whose Central month is on or after app_settings.general_meetings_from.
-- Earlier months have no row and so need nothing. The cutoff reuses the `month`
-- column's own expression, so the month a meeting is filed under and the month
-- the cutoff tests cannot disagree.
with general_meetings as (
  select e.id,
         e.term,
         date_trunc('month', e.starts_at at time zone 'America/Chicago')::date as month,
         (date_trunc('month', e.starts_at at time zone 'America/Chicago') + interval '1 month')
           at time zone 'America/Chicago' as month_ends_at,
         e.ends_at < now() as held
    from public.events e
   where e.status = 'published'
     and e.counts_as_general_meeting
     and date_trunc('month', e.starts_at at time zone 'America/Chicago')::date
           >= (select s.general_meetings_from from public.app_settings s)
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

-- 🔓 Re-issued, as every recreate of a non-public view must (CLAUDE.md). A
-- `create or replace` keeps the privileges migration 30 left — none for either
-- role — so these change nothing today. They are here so the next migration
-- that copies this block as a drop-and-create cannot leave them out: this view
-- names every member beside every month they fell short in.
revoke all on public.member_general_meeting_months from anon;
revoke all on public.member_general_meeting_months from authenticated;

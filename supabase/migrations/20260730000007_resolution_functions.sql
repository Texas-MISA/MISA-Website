-- Event-window resolution (§4.3). The core piece of logic: a submission's
-- timestamp determines its event.

-- The single published event whose check-in window contains ts, if any.
--
-- Half-open to match the exclusion constraint in 0003: >= opens, < closes.
-- With back-to-back events sharing a boundary instant, that instant belongs
-- to exactly one of them rather than matching both.
create or replace function public.open_event_at(ts timestamptz default now())
returns setof public.events
language sql
stable
as $$
  select *
  from public.events
  where status = 'published'
    and ts >= coalesce(checkin_opens_at, starts_at)
    and ts <  coalesce(checkin_closes_at, ends_at)
  order by starts_at desc
  limit 1;
$$;

-- Published events within window_hours of ts, ranked by proximity.
--
-- Two jobs: if this returns nothing the check-in is refused outright, and if
-- it returns rows they become the ranked suggestions an officer sees in the
-- review queue ("General Meeting, closed 41 minutes before this submission").
create or replace function public.nearby_events(
  ts timestamptz default now(),
  window_hours int default 48
)
returns table (
  event_id  uuid,
  title     text,
  starts_at timestamptz,
  ends_at   timestamptz,
  gap       interval
)
language sql
stable
as $$
  select e.id, e.title, e.starts_at, e.ends_at,
         case
           when ts > e.ends_at     then ts - e.ends_at
           when ts < e.starts_at   then e.starts_at - ts
           else interval '0'
         end as gap
  from public.events e
  where e.status = 'published'
    and ts between e.starts_at - make_interval(hours => window_hours)
               and e.ends_at   + make_interval(hours => window_hours)
  order by gap asc;
$$;

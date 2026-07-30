-- Terms are derived from dates, never typed (§4.7).
--
-- Must run before events (which generates term from starts_at) and before
-- point_adjustments (which defaults term to current_term()).

-- Maps an instant to 'Fall YYYY' or 'Spring YYYY'.
--
-- Boundaries are half-open: Fall = [Aug 1, Jan 1), Spring = [Jan 1, Aug 1).
-- January 1 is Spring, August 1 is Fall, and summer falls in Spring.
--
-- Anchored to America/Chicago, not UTC: a 7pm Central event on July 31 is
-- 00:00 UTC on August 1 and would otherwise be filed under Fall.
--
-- Marked IMMUTABLE so it can back a generated column. `at time zone` is
-- officially STABLE because tzdata can change; this is the conventional
-- overstatement, and the exposure is an event at exactly midnight on a term
-- boundary during a tzdata revision. Accepted — see §4.7.
create or replace function public.term_of(ts timestamptz)
returns text
language sql
immutable
as $$
  select case
    when extract(month from ts at time zone 'America/Chicago') >= 8
      then 'Fall '   || extract(year from ts at time zone 'America/Chicago')::int
      else 'Spring ' || extract(year from ts at time zone 'America/Chicago')::int
  end
$$;

-- Single-row settings table. The `id boolean primary key check (id)` trick
-- makes a second row impossible, so callers can subselect without a limit.
create table public.app_settings (
  id           boolean primary key default true check (id),
  -- NULL means "derive from today's date", which is the normal state.
  -- Set only to pin the board on a finished term over a break.
  current_term text,
  updated_by   uuid references auth.users(id),
  updated_at   timestamptz not null default now()
);

insert into public.app_settings (id, current_term) values (true, null);

-- The term the leaderboard ranks: automatic unless an officer has pinned it.
create or replace function public.current_term()
returns text
language sql
stable
as $$
  select coalesce((select current_term from public.app_settings), public.term_of(now()))
$$;

-- Deny-all by default. Policies arrive in Stage 8; until then nothing but the
-- service role and the (owner-executed) views can reach this.
alter table public.app_settings enable row level security;

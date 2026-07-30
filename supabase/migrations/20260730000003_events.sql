-- Schedule (§4.1). Editable at any time, including after attendance exists —
-- see §4.6 for what each kind of edit does.

create table public.events (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  description        text,
  location           text,
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  -- Decouple the check-in window from the event time; null falls back to it.
  checkin_opens_at   timestamptz,
  checkin_closes_at  timestamptz,
  points             integer not null default 1,
  category           text,
  -- Derived, never set by hand, and non-null because starts_at is (§4.7).
  term               text generated always as (public.term_of(starts_at)) stored,
  status             text not null default 'draft'
                       check (status in ('draft','published','cancelled')),
  series_id          uuid,
  created_by         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint valid_window check (ends_at > starts_at),
  -- The effective check-in window must also be non-empty, whether it comes
  -- from the explicit columns or the fallback.
  constraint valid_checkin_window check (
    coalesce(checkin_closes_at, ends_at) > coalesce(checkin_opens_at, starts_at)
  ),
  constraint events_title_not_blank check (length(trim(title)) > 0)
);

-- At most one published event open at any instant, enforced by the database
-- rather than by an application check (§4.3).
--
-- Ranges are half-open '[)', which deliberately permits back-to-back events:
-- a workshop closing at 19:00 and a social opening at 19:00 do not overlap.
-- open_event_at() uses the matching `>= opens and < closes` so that the
-- instant 19:00 resolves to exactly one of them.
alter table public.events
  add constraint events_no_overlapping_checkin
  exclude using gist (
    tstzrange(
      coalesce(checkin_opens_at, starts_at),
      coalesce(checkin_closes_at, ends_at),
      '[)'
    ) with &&
  )
  where (status = 'published');

create index events_term_status_idx on public.events (term, status);
create index events_starts_at_idx   on public.events (starts_at desc);
create index events_series_idx      on public.events (series_id) where series_id is not null;

-- updated_at is in the schema but nothing was maintaining it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

alter table public.events enable row level security;

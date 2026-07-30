-- Discretionary points awarded outside event attendance (§4.1): volunteering,
-- recruiting, competition placements, corrections. Negative values allowed, so
-- this one mechanism covers bonuses, penalties, and fixes.

create table public.point_adjustments (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  points      integer not null check (points <> 0),
  -- not null AND not blank. An unexplained grant is what turns a leaderboard
  -- from a record into a rumor, so no UI shortcut can skip the reason —
  -- and '' would have satisfied a bare not null.
  reason      text not null,
  category    text not null default 'other'
                check (category in ('volunteer','recruitment','competition',
                                    'leadership','correction','other')),
  event_id    uuid references public.events(id) on delete set null,
  -- Defaulted, not generated: a grant made in Spring for Fall work belongs to
  -- Fall, so officers can override. This independence is what §4.4 relies on.
  term        text not null default public.current_term(),
  awarded_by  uuid not null references auth.users(id),
  awarded_at  timestamptz not null default now(),
  -- Adjustments are voided, never deleted, and a void is itself a recorded
  -- action with its own reason.
  voided_at   timestamptz,
  voided_by   uuid references auth.users(id),
  void_reason text,
  constraint void_is_complete check (
    (voided_at is null and voided_by is null) or
    (voided_at is not null and voided_by is not null)
  ),
  constraint reason_not_blank check (length(trim(reason)) > 0),
  constraint void_reason_not_blank check (
    void_reason is null or length(trim(void_reason)) > 0
  )
);

-- The leaderboard and directory both sum live adjustments for one term.
create index point_adjustments_member_term_idx
  on public.point_adjustments (member_id, term)
  where voided_at is null;

-- "Who has been handing out points" — the ledger's per-officer view.
create index point_adjustments_awarded_by_idx
  on public.point_adjustments (awarded_by, awarded_at desc);

alter table public.point_adjustments enable row level security;

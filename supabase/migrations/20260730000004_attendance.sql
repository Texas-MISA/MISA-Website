-- One row per check-in (§4.1). Stores the raw submission alongside the
-- resolved links, so nothing is ever dropped on the floor: a submission that
-- matches no open event and/or no roster member is still captured as
-- 'pending' for an officer to resolve.

create table public.attendance (
  id                   uuid primary key default gen_random_uuid(),
  -- Both nullable on purpose. A pending row is missing one link or both.
  event_id             uuid references public.events(id)  on delete set null,
  member_id            uuid references public.members(id) on delete set null,
  submitted_name       text not null,
  submitted_student_id text not null,
  -- Same normalization as members.normalized_student_id; the two are matched
  -- against each other, so they must strip identically.
  normalized_student_id text generated always as
                         (upper(regexp_replace(submitted_student_id, '\s|-', '', 'g'))) stored,
  submitted_email      text not null,
  submitted_at         timestamptz not null default now(),
  source               text not null default 'self_checkin'
                         check (source in ('self_checkin','admin_manual')),
  status               text not null default 'pending'
                         check (status in ('present','pending','rejected')),
  resolution_note      text,
  resolved_by          uuid references auth.users(id),
  resolved_at          timestamptz,
  -- The load-bearing constraint: 'present' guarantees both links are set, so
  -- the leaderboard can trust status alone and an officer cannot approve a
  -- half-resolved row by mistake.
  constraint present_requires_resolution check (
    status <> 'present' or (event_id is not null and member_id is not null)
  ),
  constraint attendance_name_not_blank check (length(trim(submitted_name)) > 0),
  constraint attendance_id_not_blank   check (length(trim(submitted_student_id)) > 0)
);

-- No double credit for the same person at the same event, including when an
-- officer manually assigns an orphan to an event that member already attended.
-- Partial so a rejected row does not block a corrected re-entry.
create unique index attendance_one_per_event
  on public.attendance (event_id, normalized_student_id)
  where event_id is not null and status <> 'rejected';

-- Review queue defaults to pending, oldest first.
create index attendance_pending_idx
  on public.attendance (submitted_at)
  where status = 'pending';

create index attendance_event_idx  on public.attendance (event_id)  where event_id is not null;
create index attendance_member_idx on public.attendance (member_id) where member_id is not null;
-- Roster matching during check-in resolution.
create index attendance_normalized_idx on public.attendance (normalized_student_id);

alter table public.attendance enable row level security;

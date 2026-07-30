-- Roster (§4.1). Seeded by admins and also self-populating: an unrecognized
-- student ID at check-in creates a member immediately, with no officer
-- confirmation (Open Decision #2).

create table public.members (
  id           uuid primary key default gen_random_uuid(),
  student_id   text not null,
  -- Identity is the normalized ID, not the raw one. Strips whitespace and
  -- hyphens and uppercases, so 'ut-123', 'UT 123', and 'UT123' are one person.
  normalized_student_id text generated always as
                 (upper(regexp_replace(student_id, '\s|-', '', 'g'))) stored,
  full_name    text not null,
  email        text not null,
  active       boolean not null default true,
  -- Distinguishes admin-seeded rows from ones the check-in form created, so
  -- officers can review what self-registration has added (§4.2).
  source       text not null default 'admin'
                 check (source in ('admin','self_checkin')),
  joined_at    timestamptz not null default now(),
  constraint members_student_id_not_blank check (length(trim(student_id)) > 0),
  constraint members_full_name_not_blank  check (length(trim(full_name))  > 0),
  constraint members_email_not_blank      check (length(trim(email))      > 0)
);

-- Uniqueness is on the normalized forms, not the raw ones. Matching email
-- case-insensitively is what lets a member who typos their student ID be
-- recognized instead of duplicated (§4.2).
create unique index members_normalized_id on public.members (normalized_student_id);
create unique index members_email_lower   on public.members (lower(email));

-- Directory filters and the review queue both hit these.
create index members_active_idx on public.members (active) where active;
create index members_source_idx on public.members (source);

alter table public.members enable row level security;

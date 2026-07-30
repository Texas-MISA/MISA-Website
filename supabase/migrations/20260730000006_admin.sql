-- Officer accounts and the single append-only audit log (§4.1).

create table public.admin_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role         text not null default 'officer'
                 check (role in ('officer','admin'))
);

-- One audit table across every entity an officer can modify, keyed on
-- (entity_type, entity_id), so "show me everything this officer did last
-- month" is a single query. Do not add per-entity audit tables.
create table public.admin_audit (
  id          bigserial primary key,
  entity_type text not null
                check (entity_type in ('attendance','event','member','point_adjustment')),
  entity_id   uuid not null,
  actor_id    uuid not null references auth.users(id),
  acted_at    timestamptz not null default now(),
  action      text not null,
  before      jsonb,
  after       jsonb,
  note        text
);

create index admin_audit_entity_idx
  on public.admin_audit (entity_type, entity_id, acted_at desc);
create index admin_audit_actor_idx
  on public.admin_audit (actor_id, acted_at desc);

-- Append-only, enforced in the database rather than by convention (§6).
-- RLS in Stage 8 will deny these to client roles anyway, but this also stops
-- a service-role bug or a careless dashboard query from rewriting history.
create or replace function public.admin_audit_is_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'admin_audit is append-only: % is not permitted', tg_op;
end;
$$;

create trigger admin_audit_no_update
  before update on public.admin_audit
  for each row execute function public.admin_audit_is_append_only();

create trigger admin_audit_no_delete
  before delete on public.admin_audit
  for each row execute function public.admin_audit_is_append_only();

alter table public.admin_profiles enable row level security;
alter table public.admin_audit    enable row level security;

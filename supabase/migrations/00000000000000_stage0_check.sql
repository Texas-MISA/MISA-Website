-- Throwaway Stage 0 verification table. Proves a Server Component can read a
-- row from Postgres on the deployed URL, with RLS enforced rather than off.
-- Drop this migration and app/db-check/ once Stage 1 lands real tables.
create table public._stage0_check (
  id   int primary key,
  note text not null
);

insert into public._stage0_check (id, note)
values (1, 'Stage 0: server-side Supabase read works');

alter table public._stage0_check enable row level security;

create policy "anon can read stage0 check"
  on public._stage0_check
  for select
  to anon
  using (true);

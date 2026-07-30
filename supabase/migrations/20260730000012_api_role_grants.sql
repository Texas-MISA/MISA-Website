-- Explicit table/function/sequence grants for the PostgREST API roles.
--
-- Why this exists: newer Supabase stacks no longer auto-grant DML on new
-- tables to anon/authenticated/service_role — a fresh local stack gives them
-- only TRUNCATE/REFERENCES/TRIGGER, so every API read and write fails with
-- 42501 regardless of RLS. The remote project predates the change and has
-- the classic full grants, which is why production worked while the local
-- test suite could not even insert as service_role. Without this migration,
-- the §2.3 handoff path (create project → link → db push) would produce a
-- silently broken database.
--
-- This codifies the classic Supabase model: broad grants, with **RLS as the
-- security boundary** (§3, §6 — policies are written assuming the anon role
-- is hostile). Granting anon DML here changes nothing about what anon can
-- do: every table has RLS enabled, and deny-all-until-Stage-8 still holds
-- because there are no policies. Stage 8's anon-key tests stay meaningful
-- precisely because the grants are not the thing doing the denying.

grant usage on schema public to anon, authenticated, service_role;

grant all privileges on all tables    in schema public to anon, authenticated, service_role;
grant all privileges on all functions in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;

-- Future tables/functions/sequences created by migrations (which run as the
-- postgres role) inherit the same grants automatically.
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;

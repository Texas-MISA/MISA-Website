-- Close an anon read of member_directory (§4.4, §6).
--
-- THE BUG: the anon key could read every member's student ID and email from
-- public.member_directory, on local and in production. Verified at the
-- PostgREST boundary before this migration, not inferred:
--
--   anon → /rest/v1/member_directory?select=student_id,email  →  200, rows
--   anon → /rest/v1/members?select=student_id                 →  200, []
--
-- The second line is why this survived review: the table itself denies
-- correctly, so every check aimed at `members` came back clean.
--
-- THE CAUSE, which is structural and will recur:
-- 20260730000012_api_role_grants.sql grants `all privileges on all tables in
-- schema public` to anon, on the stated doctrine that "RLS is the security
-- boundary" and that broad grants therefore change nothing. That reasoning is
-- sound for tables and **silently false for views**. A view has no RLS, and
-- member_directory deliberately runs as owner (security_invoker off) so that
-- it can aggregate past the deny-all policies underneath it — that is what
-- makes it useful, and it is also what makes an unguarded SELECT on it a
-- complete bypass. `grant all on all tables` includes views.
--
-- leaderboard is unaffected and stays anon-readable on purpose: it carries
-- neither student_id nor email, which is the §4.4 asymmetry.
--
-- ⚠️ CONSEQUENCE FOR EVERY FUTURE VIEW. The same migration sets
-- `alter default privileges ... grant all on tables`, so a newly created view
-- inherits anon access at creation. A `create or replace` does not re-trigger
-- it, but a DROP + CREATE does. Any migration that recreates this view MUST
-- re-issue the revoke below, or it silently reopens this hole. Stage 6 phase 2
-- recreates it to rename student_id → eid, which is exactly that case.

revoke all on public.member_directory from anon;

-- Restated rather than assumed. The revoke above targets anon only, but the
-- grant set on this view is now something a reader is meant to trust, so it is
-- spelled out: officers read it, nobody writes it. The write privileges were
-- inert anyway — an aggregate view is not auto-updatable — but leaving them in
-- place invites the reading that they were considered and wanted.
revoke all on public.member_directory from authenticated;
grant select on public.member_directory to authenticated;

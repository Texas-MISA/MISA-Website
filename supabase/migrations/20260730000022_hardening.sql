-- Stage 8 phase 1. Three concerns, one push: close a live privilege hole,
-- narrow the API-role grants to what the application actually uses, and give
-- the six older tables the constraints the two newest ones already have.
--
-- ===========================================================================
-- 1. 🔓 member_directory was readable by ANY signed-in user.
-- ===========================================================================
--
-- The same defect as migration 15, one role over, and it survived that fix for
-- the same reason the original survived review: the check that was run passed.
-- Migration 15 asked "can anon read this view?", answered no, and granted it to
-- `authenticated` on the understanding that `authenticated` means "an officer".
--
-- It does not. `authenticated` is a PostgREST role that any holder of a valid
-- user JWT gets. What separates an officer from anyone else is an
-- `admin_profiles` row, and that check lives in lib/auth.ts — in the
-- APPLICATION. PostgREST never runs it. The view is `security_invoker = false`,
-- so it aggregates past the deny-all base tables; the GRANT is the only gate.
--
-- Measured 2026-08-09:
--   * production /auth/v1/settings reports `disable_signup: false`
--   * production information_schema shows `authenticated` holding SELECT here
--   * on the local stack, a signed-up user with NO admin_profiles row read
--     back `{"eid":"wa3428"}` — reproduced before this migration was written,
--     which is why tests/authenticated-boundary.test.ts exists and opens with
--     that case.
--
-- So: sign up, confirm an email you control, read every member's name, EID and
-- email. Nothing reads the view that way — all 33 modules touching member data
-- use createAdminClient(), and lib/auth.ts uses the anon client only for
-- auth.getUser() before switching to the service role (it says so at :46-49) —
-- so the revoke costs nothing.
--
-- 📌 Turning signup off in the dashboard is worth doing as defence in depth, but
-- it is NOT this fix: it lives outside the repo, so it would not survive the
-- §2.3 "create project → link → db push" path.

revoke select on public.member_directory from authenticated;

-- ⚠️ member_directory now has NO grant to any API role. It is reached only by
-- the service-role client, which bypasses grants and RLS alike. Any migration
-- that recreates this view must re-issue neither grant — but must also not let
-- `alter default privileges` hand it one back. Section 2 closes that door.

-- ===========================================================================
-- 2. Narrow the API-role grants. TRUNCATE is the reason this is not optional.
-- ===========================================================================
--
-- 20260730000012_api_role_grants.sql grants `all privileges on all tables` to
-- anon, authenticated and service_role, and argues at :12-17 that this is safe
-- because "RLS is the security boundary… granting anon DML here changes nothing
-- about what anon can do".
--
-- 🔓 That is true for SELECT/INSERT/UPDATE/DELETE and FALSE for TRUNCATE.
-- RLS covers exactly those four commands. TRUNCATE is not one of them, so no
-- policy can restrain it — and it also skips the admin_audit append-only
-- triggers, which are BEFORE UPDATE and BEFORE DELETE and nothing else. `anon`
-- has therefore been holding TRUNCATE on admin_audit with nothing whatsoever
-- withholding it.
--
-- Not reachable today: PostgREST exposes no TRUNCATE verb, and anon /
-- authenticated / service_role are NOLOGIN so cannot open a direct connection.
-- This is a latent privilege, not an open door. But "unreachable through the
-- client we currently use" is exactly the argument migration 12 made, and the
-- privilege is wrong on its own terms.
--
-- What the application actually needs from these two roles is SELECT and
-- nothing else: the only anon-key reads in the codebase are the `leaderboard`
-- view and published `events`, and every write goes through the service role.
-- RLS still does the denying; this just stops a future view-shaped or
-- verb-shaped mistake from being one grant away from a breach.
--
-- ⚠️ service_role is deliberately untouched. The entire application runs on it.

revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;

-- Future tables must inherit the narrower set, or the next migration silently
-- re-opens this. Mirrors the `alter default privileges` in migration 12, which
-- is what made the broad grant self-perpetuating.
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger on tables
  from anon, authenticated;

-- 📌 Function and sequence grants are deliberately left alone. anon needs
-- EXECUTE on current_term() transitively — the `leaderboard` view calls it —
-- and unpicking which of those a view's owner-rights covers is a separate
-- question from this one. Revoking table DML is the change that closes the
-- TRUNCATE hole; the rest would be churn with a real chance of breaking the
-- public board.

-- Belt and braces on the table where it matters most. A grant can be re-widened
-- by a future migration; a trigger has to be dropped on purpose.
--
-- Statement-level, because TRUNCATE has no rows to fire a row-level trigger on
-- — which is precisely why the existing append-only pair does not catch it.
create or replace function public.admin_audit_no_truncate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'admin_audit is append-only: TRUNCATE is not permitted';
end;
$$;

create trigger admin_audit_no_truncate
  before truncate on public.admin_audit
  for each statement execute function public.admin_audit_no_truncate();

-- The two existing trigger functions predate the house rule migration 21 set
-- (a function that runs with any elevated context pins its search_path). Both
-- are invoker-rights and neither resolves an unqualified name today — one has
-- no body references at all, the other calls only now() from pg_catalog — so
-- this changes no behaviour. It removes a standing lint finding and keeps the
-- rule uniform, which is what stops the next function from omitting it.
create or replace function public.admin_audit_is_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'admin_audit is append-only: % is not permitted', tg_op;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===========================================================================
-- 3. Constraints the application already enforces and the schema did not.
-- ===========================================================================
--
-- lib/validation.ts:363-366 states the doctrine: "Every rule below is also a
-- constraint in migration 18 — deliberately, not redundantly." It was applied
-- to member_field_definitions and member_filter_presets and never applied
-- backwards. Everything below closes a gap where the DB accepts data no screen
-- can produce and some screen would then misread.
--
-- ⚠️ Every one of these was checked against the live local database before
-- being written; all returned zero violating rows. Production is the seed, so
-- the same holds there — but `db push` will prove it rather than assume it.

-- 🪤 The sharpest of them. members_eid_not_blank checks `length(trim(eid)) > 0`,
-- which a raw '-' passes — and '-' normalizes to the empty string. The first
-- such member takes '' in members_normalized_eid, and every subsequent one
-- collides into that one phantom identity. lib/validation.ts:40-45 already
-- refuses it ("A raw EID of '-' or '  ' passes the database's not-blank check
-- but normalizes to nothing"), and says three characters because the shortest
-- real UT EIDs are three.
alter table public.members
  add constraint members_normalized_eid_min_length
  check (length(normalized_eid) >= 3);

alter table public.attendance
  add constraint attendance_normalized_eid_min_length
  check (length(normalized_eid) >= 3);

-- points has no bound at all, and both views compute sum(e.points). A negative
-- event would produce negative PUBLIC standings. Upper bound matches
-- eventSchema's .max(100).
alter table public.events
  add constraint events_points_bounded
  check (points >= 0 and points <= 100);

-- point_adjustments.category has had a DB enum check since migration 5;
-- events.category never did. Pure asymmetry — the column accepted arbitrary
-- text that formatCategory() cannot render. Mirrors EVENT_CATEGORIES in
-- lib/events.ts.
alter table public.events
  add constraint events_category_valid
  check (category is null or category in
    ('general_meeting', 'workshop', 'social', 'flagship', 'other'));

-- point_adjustments has void_is_complete and dues_payments has
-- dues_void_is_complete; attendance had no analogue, so resolved_at could be
-- set with a null resolved_by and the review screen would show a resolution
-- nobody owned. Self-check-ins leave BOTH null (they are auto-resolved with no
-- officer), which this permits — the constraint is about the pair, not about
-- status.
alter table public.attendance
  add constraint attendance_resolution_is_complete
  check ((resolved_at is null) = (resolved_by is null));

-- 🪤 A malformed term stores fine and then reads as the WRONG term, and the
-- first attempt at this constraint was itself wrong in an instructive way.
--
-- The obvious check is `term_index(term) is not null`. It does not work,
-- because **term_index is not a validator and cannot be used as one**:
--
--   term_index('Autumn 2026') = 4052
--   term_index('Spring 2026') = 4052     ← the same value
--   term_index('Fall 2026')   = 4053
--
-- Its season arm is `case when split_part(t,' ',1) = 'Fall' then 1 else 0 end`,
-- so *anything* that is not the literal 'Fall' is silently filed as Spring. It
-- never returns null for a bad season — it returns a plausible wrong answer,
-- which is the same failure family as the lexicographic trap §4.7 warns about.
-- (And for text with no space at all it raises 22P02 rather than returning
-- null, so the null test is doubly the wrong instrument.)
--
-- Measured, then replaced with a check on the shape itself. term_index stays
-- lenient on purpose — it backs the `covered_terms` generated column and
-- changing an immutable function under a stored generated column is a
-- different migration — so this stops a bad term reaching it in the first
-- place.
alter table public.point_adjustments
  add constraint point_adjustments_term_valid
  check (term ~ '^(Spring|Fall) [0-9]{4}$');

alter table public.dues_payments
  add constraint dues_payments_start_term_valid
  check (start_term ~ '^(Spring|Fall) [0-9]{4}$');

-- Text bounds, matching lib/validation.ts. The two newest tables bound their
-- text in SQL and the six older ones did not, which made the schema
-- inconsistent with itself and left notes/description unbounded — a payload and
-- xlsx-rendering concern as much as a correctness one.
alter table public.events
  add constraint events_text_bounded
  check (length(title) <= 200
     and (description is null or length(description) <= 2000)
     and (location is null or length(location) <= 200));

alter table public.members
  add constraint members_text_bounded
  check (length(full_name) <= 120
     and length(eid) <= 32
     and length(email) <= 254
     and (notes is null or length(notes) <= 2000));

alter table public.point_adjustments
  add constraint point_adjustments_text_bounded
  check (length(reason) <= 500
     and (void_reason is null or length(void_reason) <= 500));

alter table public.attendance
  add constraint attendance_text_bounded
  check (length(submitted_name) <= 120
     and length(submitted_eid) <= 32
     and length(submitted_email) <= 254
     and (resolution_note is null or length(resolution_note) <= 1000));

-- 📌 Deliberately NOT added: a trigger validating members.custom_fields against
-- its definition's option list. lib/members.ts:290-292 argues that editing an
-- option list must orphan stored values rather than rewrite or refuse them, and
-- that fieldOptions() rendering the orphan is the mitigation. That stays an
-- application-only invariant — now recorded as a decision rather than left as
-- an omission.

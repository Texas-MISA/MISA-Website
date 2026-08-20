-- Migration 26 — the real dues prices.
--
-- $30 / $50 became **$40 for one semester and $70 for two**, an officer
-- decision taken on 2026-08-19 as the club moved off the fabricated seed and
-- onto its real Fall 2026 schedule.
--
-- Two statements, and BOTH are required. Changing one and not the other is the
-- failure mode this header exists to prevent:
--
--   * the DEFAULT, so a fresh `db reset` — and any project ever rebuilt from
--     `migrations/` alone, which §2.3's handoff path depends on — starts at the
--     current price rather than at the one this repo happened to open with;
--   * the existing ROW, because a default only applies to an INSERT and
--     `app_settings` is a singleton created back in migration 1
--     (`id boolean primary key default true`). Nothing will ever insert into it
--     again, so the default alone would change nothing anywhere that matters.
--
-- Fix only the default and local silently disagrees with production about what
-- a $40 payment buys; fix only the row and the disagreement arrives later, at
-- whatever moment somebody next runs `db reset`. Neither says anything on
-- screen — a mismatched amount just returns null from `termsForAmount` and the
-- payment lands in the review queue looking like the payer got it wrong.
--
-- ⚠️ Prices are read at IMPORT time only, and `terms_covered` is stored on each
-- payment row rather than re-derived — so this does NOT rewrite what any
-- existing payment bought. That property is the entire reason the column exists,
-- and it is what makes the *next* increase safe as well. (Production holds zero
-- payments at this instant, having been wiped the same day, so there is nothing
-- to protect today; the guarantee is for the years this outlives.)
--
-- 📌 There is deliberately NO UI for this. Prices change by migration, which
-- keeps the database disposable and puts the new number in version control next
-- to the reason for it — as opposed to a dashboard edit nobody can date, review
-- or explain a year later. If a settings screen is ever built, it must write
-- through a migration-equivalent audit path, not around one.

alter table public.app_settings
  alter column dues_one_term_cents set default 4000,
  alter column dues_two_term_cents set default 7000;

update public.app_settings
set dues_one_term_cents = 4000,
    dues_two_term_cents = 7000;

-- An unasserted change is an optional change — the same rule `seed.sql`'s check
-- block enforces. This turns "the migration ran" into "the migration produced
-- what its header claims", and it also catches the singleton row having gone
-- missing, since `select into` on an empty table leaves both variables null.
do $$
declare
  one_term int;
  two_term int;
  rows_found int;
begin
  select count(*) into rows_found from public.app_settings;
  if rows_found <> 1 then
    raise exception
      'app_settings is meant to be a singleton, found % row(s)', rows_found;
  end if;

  select dues_one_term_cents, dues_two_term_cents
    into one_term, two_term
    from public.app_settings;

  if one_term is distinct from 4000 or two_term is distinct from 7000 then
    raise exception
      'dues prices did not take: one_term=%, two_term=%', one_term, two_term;
  end if;
end $$;

comment on column public.app_settings.dues_one_term_cents is
  'Price of one semester of dues, in cents. $40.00 as of migration 26 '
  '(2026-08-19). Read at import time only; terms_covered is stored per payment, '
  'so changing this never rewrites what an existing payment bought.';

comment on column public.app_settings.dues_two_term_cents is
  'Price of two semesters of dues, in cents. $70.00 as of migration 26 '
  '(2026-08-19). Exact-match only - termsForAmount() never rounds a near miss '
  'up, because that would decide on the member''s behalf.';

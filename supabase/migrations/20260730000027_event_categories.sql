-- Migration 27 — event categories: the officers' vocabulary, replacing the
-- developer's.
--
-- 📌 Numbered 27, not 26: `…000026_dues_price_increase.sql` claimed 26 the same
-- afternoon. Two files sharing a version take a 23505 on
-- `schema_migrations_pkey` at reset time, which is a loud failure and the reason
-- CLAUDE.md tracks the next unclaimed number.
--
-- The list migration 22 pinned ('general_meeting', 'workshop', 'social',
-- 'flagship', 'other') was invented while building the admin UI and was never
-- what the club actually runs. Requested 2026-08-19:
--
--   projects · academic · social · professional_dev · corporate ·
--   special_events · general_and_other
--
-- ⚠️ `events.category` is NOT free text, whatever the old comment in
-- lib/events.ts said — migration 22 closed that asymmetry deliberately, so the
-- vocabulary now lives in TWO places and they must move together. EVENT_CATEGORIES
-- in lib/events.ts is the mirror; changing one without the other gives the officer
-- a select box whose options take a 23514 on save.
--
-- Order matters: the remap writes values the OLD constraint forbids, so the
-- constraint comes off first and goes back on last.
alter table public.events
  drop constraint if exists events_category_valid;

-- Translation, not a guess. Production held 0 events when this was written
-- (wiped 2026-08-19), so in practice this touches only local seeds and any
-- database that drifted — but a `db push` that failed halfway through on rows
-- nobody remembered would be a worse outcome than a translation written down.
--
-- 🪤 'general_meeting' is the lossy one: a weekly general meeting is not
-- "other", but the new vocabulary has no seat for it, so it lands in the
-- catch-all along with everything that was already there. If a "general
-- meeting" category is ever wanted back, it is a new value, not this one
-- reappearing.
update public.events set category = 'general_and_other' where category = 'general_meeting';
update public.events set category = 'professional_dev'  where category = 'workshop';
update public.events set category = 'special_events'    where category = 'flagship';
update public.events set category = 'general_and_other' where category = 'other';
-- 'social' survives unchanged and is deliberately not listed.

alter table public.events
  add constraint events_category_valid
  check (category is null or category in
    ('projects', 'academic', 'social', 'professional_dev',
     'corporate', 'special_events', 'general_and_other'));

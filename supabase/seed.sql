-- Development seed data. Run by `supabase db reset`, or applied to a remote
-- dev project with scripts/seed-remote.sh.
--
-- DESTRUCTIVE: wipes members, events, attendance, point_adjustments,
-- dues_payments, member_field_definitions, member_filter_presets,
-- officer_invites and admin_audit before inserting. The guard below refuses to run if auth.users
-- contains any account other than the seed officer, which is the signal that
-- you are pointed at something real.
--
-- 📌 Keep that list in step with the deletes. It is not decoration: the wipe
-- list IS the definition of "this database matches the seed", so a table
-- missing from it is drift nobody can see. Two were missing until 2026-08-08 —
-- see the note on the deletes.
--
-- `checkin_throttle` is deliberately NOT wiped: IP-keyed rate-limit state with
-- a ten-minute window, not seed data, and it expires on its own.
--
-- Every identity here is fabricated. Emails use example.edu (RFC 2606
-- reserved, can never resolve) and EIDs are synthetic. Never replace
-- this with a real roster export — this repository is public.

-- @chunk guard-and-wipe
do $$
begin
  if exists (
    select 1 from auth.users
    where id <> '00000000-0000-4000-8000-5eed00000001'::uuid
  ) then
    raise exception
      'Refusing to seed: auth.users contains real accounts. This file wipes all data.';
  end if;
end $$;

delete from point_adjustments;
delete from attendance;
-- ⚠️ Before members, and not optional. dues_payments.member_id is ON DELETE
-- RESTRICT — deliberately, because the row records that money arrived (§4.1) —
-- so `delete from members` raises a foreign key violation the moment a single
-- payment exists. It also references auth.users through imported_by, which
-- would block the seed-officer delete below for the same reason. Added
-- 2026-08-07: migration 19 introduced the table long after this wipe was
-- written, so any dev project that had imported one statement could no longer
-- be re-seeded at all.
delete from dues_payments;
delete from events;
-- 🔓 Both added 2026-08-08 (Stage 6 phase 9), and their absence had already
-- caused real drift rather than being a tidy-up. `scripts/seed-remote.sh` can
-- only clear what this list names, so production still carried a `shirt_size`
-- definition left over from the phase-4 walkthrough long after "production IS
-- the seed" was recorded as true. `db reset` hid it locally because it drops
-- the whole database rather than running these deletes.
--
-- 📌 The generalisable rule, and the reason the assert block below now counts
-- both: **this wipe list is the definition of "matches the seed", and a table
-- missing from it is invisible drift.** Any migration that adds a table has to
-- decide whether it belongs here.
--
-- ⚠️ member_filter_presets must go BEFORE the auth.users delete at the end:
-- `created_by` references auth.users with no cascade, so a preset saved by the
-- seed officer would block that delete and abort the re-seed — the same shape
-- as the dues_payments note above, and the same failure.
--
-- ⚠️ officer_invites, added with migration 24, belongs here for BOTH reasons
-- the comment above gives — and the second one is the sharp end.
--
-- `created_by` (and `revoked_by`) reference auth.users with no cascade, exactly
-- like member_filter_presets, so an invite issued by the seed officer would
-- block the delete at the end of this block and abort the whole re-seed.
--
-- And leaving it out would be the invisible kind of drift: an invite is a live
-- credential until it expires, so a re-seed that wiped every member while
-- quietly leaving a working invite behind is the worst version of "the wipe
-- list is incomplete". The seed ships zero invites, and the assert block below
-- is what turns that from a claim into a check.
delete from officer_invites;
delete from member_filter_presets;
delete from member_field_definitions;
delete from members;
alter table admin_audit disable trigger admin_audit_no_delete;
delete from admin_audit;
alter table admin_audit enable trigger admin_audit_no_delete;
delete from auth.users where id = '00000000-0000-4000-8000-5eed00000001'::uuid;

-- A stand-in officer, so point_adjustments.awarded_by and admin_audit.actor_id
-- have something to reference. Not a usable login: the password hash is junk.
--
-- The eight token/change columns must be '' rather than left NULL. GoTrue
-- deserializes them into non-nullable Go strings, so a NULL anywhere in
-- auth.users makes the whole admin listUsers endpoint fail with a 500 and an
-- empty error body — which breaks scripts/create-officer.mjs and any test
-- helper that looks an officer up by email, with no hint as to why.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
                        confirmation_token, email_change, email_change_token_current,
                        email_change_token_new, phone_change, phone_change_token,
                        reauthentication_token, recovery_token)
values ('00000000-0000-4000-8000-5eed00000001',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        'seed.officer@example.edu', 'not-a-real-hash', now(), now(),
        '', '', '', '', '', '', '', '');

insert into admin_profiles (user_id, display_name, role)
values ('00000000-0000-4000-8000-5eed00000001', 'Seed Officer', 'admin');

-- ⚠️ NO TERM PIN, deliberately, and this changed on 2026-08-06 when the seed
-- moved from Spring 2026 to Fall 2026.
--
-- `app_settings.current_term` used to be pinned to the seeded semester so the
-- leaderboard would not empty when real time crossed a term boundary. The seed
-- now lives in the term the clock is actually in, so the pin would only add a
-- second source of truth — and `tests/global-setup.ts` un-pins it for the suite
-- anyway, which meant the local database and the test run genuinely disagreed
-- about what `current_term()` was. Leaving it null makes them agree.
--
-- 🪤 The cost, stated plainly because it will arrive on a specific date: on
-- **1 January 2027** `current_term()` becomes Spring 2027, every seeded event
-- falls out of scope, and the leaderboard and directory go empty with nothing
-- on screen to explain why. That is not a bug — it is this file needing its
-- dates moved forward a term. The pin is the workaround if you need the old
-- behaviour for an afternoon: `update app_settings set current_term = 'Fall 2026';`
--
-- ⚠️ The clear below is NOT redundant, and leaving it out was a real bug for a
-- day. A fresh `db reset` starts with app_settings.current_term already null,
-- so removing the old `update ... = 'Spring 2026'` looked complete — but this
-- file also runs against databases that already exist, where whatever pin is
-- sitting there survives. Seeding a project pinned to Spring 2026 with Fall
-- 2026 data gives an empty leaderboard and an empty directory and no hint as to
-- why. **The seed asserts the state it wants; it never inherits one.**
update app_settings set current_term = null;

-- @chunk members
-- 32 members with UT-EID-shaped identifiers: initials plus four digits.
--
-- ALL FABRICATED. This repo is public, and unlike the old 'UT-100023' shape
-- these *look* like real credentials, so the only signals they are invented
-- are the obviously-made-up names and the example.edu (RFC 2606) mailboxes.
-- Never replace them with a real roster export.
--
-- EIDs are written out per person rather than generated, because the near-miss
-- fixtures further down depend on exact edit distances between specific rows.
-- Initials are unique across all 32 (AO/AB, BK/BC, CW/CM, DN/DS, EB/ER, FH/FW
-- all differ), so the initials alone are already a unique key.
--
-- Case is the format axis now: a real EID contains no hyphen or space, so the
-- old dash/space variants no longer model anything a member would type. Two
-- rows keep a stray space or hyphen anyway (Jonas Berg, Viktor Ilic) because
-- the generated column still strips them and someone pasting from a badge or
-- a spreadsheet still produces them.
--
-- Deliberate: mp8570, pn8571, and ro8574 all sit at edit distance 2 from
-- rp8571, which is Rowan Pike, who is on no roster. That cluster is the
-- regression fixture for the suggestion score floor — see the note on the
-- unmatched submissions below.
with raw(first_name, last_name, eid, active, source) as (values
  ('Amara','Osei','AO4471',true,'admin'),        ('Bela','Kovacs','bk2856',true,'admin'),
  ('Chen','Wu','Cw9134',true,'admin'),           ('Dara','Nolan','dn5027',true,'admin'),
  ('Esi','Boateng','eb7318',true,'admin'),       ('Farid','Haddad','fh6402',true,'admin'),
  ('Gita','Raman','GR1975',true,'admin'),        ('Hana','Sato','hs8260',true,'admin'),
  ('Ines','Duarte','id3549',true,'admin'),       ('Jonas','Berg','jb 4183',true,'admin'),
  ('Kaia','Lindqvist','kl7092',true,'admin'),    ('Luca','Moretti','lm2647',true,'admin'),
  ('Mira','Petrova','mp8570',true,'admin'),      ('Nadia','Farouk','nf9326',true,'admin'),
  ('Omar','Silva','os1458',true,'admin'),        ('Priya','Nair','pn8571',true,'admin'),
  ('Quinn','Adeyemi','qa3291',true,'admin'),     ('Rafa','Ortiz','ro8574',true,'admin'),
  ('Suri','Tanaka','st2039',true,'admin'),       ('Tomas','Novak','tn7146',true,'admin'),
  ('Uma','Krishnan','uk4865',true,'admin'),      ('Viktor','Ilic','vi-9701',true,'admin'),
  ('Wren','Abbott','wa3428',true,'admin'),       ('Xiu','Lin','XL6157',true,'admin'),
  ('Yara','Mansour','ym1893',true,'admin'),      ('Zane','Okonkwo','zo5236',true,'admin'),
  ('Ayo','Balogun','ab8049',false,'admin'),      ('Bruno','Castro','bc2714',false,'admin'),
  ('Cleo','Marchand','cm6580',false,'admin'),    ('Devi','Sharma','ds4392',true,'self_checkin'),
  ('Eli','Rosenberg','er9067',true,'self_checkin'), ('Fern','Whitlock','fw1725',true,'self_checkin')
)
insert into members (eid, full_name, email, active, source, joined_at)
select
  eid,
  first_name || ' ' || last_name,
  lower(first_name || '.' || last_name || '@example.edu'),
  active,
  source,
  -- Self-registered members joined mid-semester, at their first check-in.
  --
  -- Load-bearing rather than flavour: the bulk attendance below only draws for
  -- events at or after a member's joined_at, so these three attend 5 of the 12
  -- completed events rather than all 12. That is what gives the leaderboard a
  -- real spread and what makes events_attended differ from events_possible for
  -- somebody. The 18:05 is five minutes AFTER the Welcome Social starts, so
  -- that event is excluded too — they joined at it, they did not attend it.
  case when source = 'self_checkin'
       then timestamptz '2026-08-03 18:05-05'
       else timestamptz '2026-07-25 12:00-05'
  end
from raw
-- The bulk attendance below draws with a seeded random() over
-- `cross join members`, so which member attends which event depends on the
-- physical row order here, and inserting in a different order reshuffles the
-- whole distribution.
--
-- ⚠️ Keep this, but do NOT rely on it for reproducibility — that is what it was
-- doing until 2026-08-10 and it does not work. An `order by` on an INSERT pins
-- physical order only on a VIRGIN table, which is the `db reset` case; a
-- re-seed deletes and re-inserts into a table with a free space map and real
-- planner statistics, so both the scan order and the join plan can differ
-- anyway. The two fixtures that used to depend on the draw landing a
-- particular way are reserved out of it explicitly now — see the exclusions on
-- the bulk insert. This clause just keeps the fresh-database case tidy and
-- comparable.
order by last_name;

-- @chunk member-field-definitions
-- One officer-defined custom field (§4.5, migration 18).
--
-- 📌 This exists because production HAS it and the officer decided to keep it
-- (2026-08-09), which closes the open question phase 9 left. The row arrived on
-- the remote as a leftover from the phase-4 walkthrough, and phase 9 then added
-- member_field_definitions to the wipe list above — so the next re-seed would
-- have deleted a column somebody was using. Seeding it is what makes "production
-- IS the seed" true in the direction that keeps the column: the wipe clears the
-- table, this puts back exactly the definition the remote already carries.
--
-- Deliberately NO member holds a value. Production has none either, and an
-- orphan-free start is the honest one — fieldOptions() handles a stored value
-- whose option was later removed, but the seed should not manufacture that case
-- for every developer. It is also what keeps the export and directory fixtures
-- unchanged: a populated column would shift what every export test sees.
--
-- created_by is the seed officer rather than NULL, so the FK says something
-- true (a person defined this) and fetchOfficerNames has a name to resolve.
insert into member_field_definitions
  (key, label, kind, options, show_in_directory, editable_inline, sort_order, created_by)
values
  ('shirt_size', 'Shirt Size', 'select',
   array['2XS','XS','S','M','L','XL','2XL','3XL'],
   true, true, 0, '00000000-0000-4000-8000-5eed00000001');

-- @chunk events
-- A Fall 2026 semester: twelve completed events plus one cancelled, then two
-- that have not happened yet. term is generated from starts_at, never set here.
--
-- ⚠️ **Why the completed events are packed into 1–5 August, which is not a
-- plausible meeting schedule.** Two hard constraints collide:
--
--   * `term_of` puts Fall 2026 at 1 Aug – 31 Dec, half-open at both ends.
--   * Attendance can only hang off events that have already happened. The bulk
--     insert below filters on `starts_at < now()`, and member_directory counts
--     `events_possible` as published events with `ends_at < now()` — so an
--     event in the future with attendance on it would make somebody's
--     attendance_rate exceed 1, or divide by zero.
--
-- This file was written when the seeded semester (Spring 2026, Jan–Apr) had
-- fully elapsed, which is what made a twelve-week schedule possible. Moving to
-- Fall 2026 while the real date is early August leaves only the first days of
-- the term in the past, so the alternative to compressing was a seed with no
-- attendance, an empty leaderboard, and every rate showing "—". Read this block
-- as "an intensive kickoff week", and **spread the dates back out the moment
-- there is more elapsed term to spread them across** — nothing depends on them
-- being adjacent, only on their order and on their being in the past.
--
-- 🪤 One consequence worth knowing before it surprises you: with twelve events
-- inside five days, every orphaned check-in now falls within the 48-hour grace
-- window of SEVERAL events, so `nearby_events()` offers a list rather than the
-- single confident suggestion the old spread-out schedule produced. That is
-- realistic and it exercises the ranking harder, but it is a change in what the
-- review screen looks like, not a coincidence.
--
-- 🪤 `events_no_overlapping_checkin` is an exclusion constraint over published
-- rows only, on half-open [starts_at, ends_at). Packed this tightly, two
-- published events sharing an instant is an easy accident and it fails the
-- whole seed with a 23P01. The cancelled row is exempt, which is why it can sit
-- inside the same afternoon as another event.
insert into events (title, description, location, starts_at, ends_at, points, category, status, created_by)
values
  -- Saturday 1 August — the term opens.
  ('Semester Kickoff',      'First general meeting of the semester', 'UTC 3.102', '2026-08-01 10:00-05','2026-08-01 11:00-05', 1, 'general_and_other','published','00000000-0000-4000-8000-5eed00000001'),
  ('General Meeting #2',    null, 'UTC 3.102', '2026-08-01 13:00-05','2026-08-01 14:00-05', 1, 'general_and_other','published','00000000-0000-4000-8000-5eed00000001'),
  -- Sunday 2 August.
  ('Resume Workshop',       'Bring a printed copy', 'GDC 2.216', '2026-08-02 10:00-05','2026-08-02 11:30-05', 2, 'professional_dev','published','00000000-0000-4000-8000-5eed00000001'),
  ('General Meeting #3',    null, 'UTC 3.102', '2026-08-02 13:00-05','2026-08-02 14:00-05', 1, 'general_and_other','published','00000000-0000-4000-8000-5eed00000001'),
  -- Monday 3 August.
  ('Case Competition',      'Judged team competition', 'RLP 1.106', '2026-08-03 09:00-05','2026-08-03 13:00-05', 5, 'academic','published','00000000-0000-4000-8000-5eed00000001'),
  ('General Meeting #4',    null, 'UTC 3.102', '2026-08-03 14:00-05','2026-08-03 15:00-05', 1, 'general_and_other','published','00000000-0000-4000-8000-5eed00000001'),
  ('Welcome Social',        'Food provided', 'Gregory Plaza', '2026-08-03 18:00-05','2026-08-03 20:00-05', 1, 'social','published','00000000-0000-4000-8000-5eed00000001'),
  -- Tuesday 4 August.
  ('General Meeting #5',    null, 'UTC 3.102', '2026-08-04 09:00-05','2026-08-04 10:00-05', 1, 'general_and_other','published','00000000-0000-4000-8000-5eed00000001'),
  ('Alumni Panel',          null, 'UTC 4.132', '2026-08-04 11:00-05','2026-08-04 12:30-05', 2, 'corporate','published','00000000-0000-4000-8000-5eed00000001'),
  ('General Meeting #6',    null, 'UTC 3.102', '2026-08-04 18:00-05','2026-08-04 19:00-05', 1, 'general_and_other','published','00000000-0000-4000-8000-5eed00000001'),
  -- Wednesday 5 August — the last elapsed day.
  ('Interview Prep',        null, 'GDC 2.216', '2026-08-05 10:00-05','2026-08-05 11:30-05', 2, 'professional_dev','published','00000000-0000-4000-8000-5eed00000001'),
  ('Awards Banquet',        'Awards and closing', 'AT&T Center', '2026-08-05 18:00-05','2026-08-05 21:00-05', 3, 'special_events','published','00000000-0000-4000-8000-5eed00000001'),
  -- Cancelled: keeps its attendance history but is excluded from totals (§4.6).
  -- Exempt from the overlap constraint, so it may share an afternoon.
  ('Rained Out Tabling',    'Cancelled due to weather', 'Speedway', '2026-08-02 15:00-05','2026-08-02 18:00-05', 1, 'social','cancelled','00000000-0000-4000-8000-5eed00000001'),
  -- Still to come, so the schedule UI has both and the member detail page has
  -- an *upcoming* event to paint (attended / missed / upcoming, §4.5).
  ('Fall Kickoff',          'First meeting of the fall', 'UTC 3.102', '2026-09-01 18:00-05','2026-09-01 19:00-05', 1, 'general_and_other','published','00000000-0000-4000-8000-5eed00000001'),
  ('Fall Info Session',     'Not announced yet', 'TBD', '2026-09-08 18:00-05','2026-09-08 19:00-05', 1, 'general_and_other','draft','00000000-0000-4000-8000-5eed00000001');

-- @chunk attendance-bulk
-- Deterministic pseudo-randomness so the seed is reproducible.
select setseed(0.42);

-- Bulk attendance across the completed events. Participation varies by member
-- so the leaderboard has a real distribution rather than a flat line.
insert into attendance (event_id, member_id, submitted_name, submitted_eid, submitted_email, submitted_at, status, source)
select
  e.id, m.id, m.full_name, m.eid, m.email,
  e.starts_at + (random() * interval '18 minutes'),
  'present', 'self_checkin'
from events e
cross join members m
where e.status = 'published'
  and e.starts_at < now()
  and m.active
  -- Self-registered members only start attending from when they joined.
  and e.starts_at >= m.joined_at
  -- 🔓 Two slots are RESERVED for the explicit fixtures below, and this
  -- exclusion is what makes a re-seed reproducible. Added 2026-08-10.
  --
  -- Both fixtures used to be guarded by `not exists`, so each one silently
  -- skipped whenever the draw happened to fill its slot — and the draw is NOT
  -- stable across a re-seed. `order by last_name` above pins the physical row
  -- order of members on a VIRGIN table, which is why `db reset` looked
  -- deterministic, but a re-seed deletes and re-inserts into a table with a
  -- free space map and real statistics, so the join plan and the scan order can
  -- both differ. Measured on 2026-08-10: six consecutive re-seeds produced the
  -- rejected fixture 4 times and skipped it twice, and the seed's own assert
  -- block failed on the runs that skipped it.
  --
  -- 📌 Reserving the slots fixes it where pinning the order cannot, because a
  -- WHERE predicate does not care what order the rows arrive in. The count of
  -- rows this draws is stable regardless of plan — setseed() fixes the sequence
  -- of random() values and there is exactly one call per candidate row — so
  -- removing two candidates changes the total by a fixed amount, not a random
  -- one. What was never stable is WHICH pairs get which value, and the fixtures
  -- must not depend on that.
  and not (m.full_name = 'Mira Petrova' and e.title = 'Alumni Panel')
  and not (m.full_name = 'Zane Okonkwo' and e.title = 'Awards Banquet')
  and random() < 0.62;

-- A couple of people at the cancelled event, to prove it stays in history but
-- out of the leaderboard.
insert into attendance (event_id, member_id, submitted_name, submitted_eid, submitted_email, submitted_at, status, source)
select e.id, m.id, m.full_name, m.eid, m.email, e.starts_at + interval '5 minutes', 'present', 'self_checkin'
from events e
cross join lateral (select * from members where active order by full_name limit 3) m
where e.title = 'Rained Out Tabling';

-- @chunk attendance-edge-cases
-- The cases the review queue exists for.

-- Orphans: checked in after the window closed, so no event link yet.
-- 1h15m after General Meeting #6 (4 Aug, 18:00–19:00) closed, which is the gap
-- the review screen describes. ⚠️ Unlike the old spread-out schedule, several
-- other events also sit within the 48-hour grace window of this instant, so
-- nearby_events() returns a ranked list rather than one obvious answer — see
-- the note on the events block.
insert into attendance (member_id, submitted_name, submitted_eid, submitted_email, submitted_at, status)
select m.id, m.full_name, m.eid, m.email, timestamptz '2026-08-04 20:15-05', 'pending'
from members m where m.full_name in ('Hana Sato','Luca Moretti');

-- Unknown EIDs: event is clear, the person is not on the roster.
--
-- Both EIDs are edit distance 2 from real members and distance 1 from none —
-- verified, not eyeballed. That is the whole point of these two rows:
--
--   rp8571 (Rowan Pike) is distance 2 from mp8570, pn8571, AND ro8574. Three
--   plausible-looking strangers, which is exactly the shape that made the
--   review screen offer confident suggestions for someone on no roster at all.
--   This row must render the EMPTY suggestion state. If it ever offers a
--   member, the score floor has regressed.
--
--   sd4390 (Sage Delacroix) is distance 2 from ds4392 — a transposed pair of
--   initials plus one digit, which is what a real mistyped EID looks like. It
--   is stored as 'Sd 4390' so the raw string and the normalized one disagree
--   on length: that is what catches diffStudentId highlighting the formatting
--   instead of the character that actually differs.
insert into attendance (event_id, submitted_name, submitted_eid, submitted_email, submitted_at, status)
select e.id, v.nm, v.sid, v.em, e.starts_at + interval '11 minutes', 'pending'
from events e
cross join (values
  ('Rowan Pike','rp8571','rowan.pike@example.edu'),
  ('Sage Delacroix','Sd 4390','sage.delacroix@example.edu')
) as v(nm, sid, em)
where e.title = 'Interview Prep';

-- Neither link resolved: late submission from someone not on the roster.
-- tv7140 is distance 2 from tn7146 and distance 1 from nobody.
--
-- 21:30 on the last elapsed day: half an hour after the Awards Banquet closed
-- and ten hours after Interview Prep did, so it sits outside every check-in
-- window while staying inside the 48-hour grace period.
insert into attendance (submitted_name, submitted_eid, submitted_email, submitted_at, status)
values ('Toby Vance','tv7140','toby.vance@example.edu', timestamptz '2026-08-05 21:30-05','pending');

-- Rejected: a duplicate someone submitted twice. The partial unique index
-- excludes rejected rows, so the corrected entry can coexist.
--
-- ⚠️ Unconditional since 2026-08-10, and the guard it lost was contradicting
-- this comment. `attendance_one_per_event` is
-- `(event_id, normalized_eid) where event_id is not null and status <> 'rejected'`,
-- so a rejected row can ALWAYS be inserted beside a present one — that is the
-- coexistence the comment describes. The old `not exists (… status <> 'rejected')`
-- therefore protected no constraint; all it did was skip the fixture whenever
-- the bulk draw had already seated Mira at this event, which made the seed's own
-- assert block fail on a re-seed. Her slot is now reserved above, so the pair
-- below is the only row she has at Alumni Panel.
insert into attendance (event_id, member_id, submitted_name, submitted_eid, submitted_email, submitted_at, status, resolution_note, resolved_by, resolved_at)
select e.id, m.id, m.full_name, m.eid, m.email, e.starts_at + interval '2 minutes',
       'rejected', 'Duplicate submission — kept the earlier row',
       '00000000-0000-4000-8000-5eed00000001', e.ends_at
from events e
join members m on m.full_name = 'Mira Petrova'
where e.title = 'Alumni Panel';

-- Officer-entered row for someone who never submitted the form.
--
-- 🪤 Unconditional since 2026-08-10, and this one had been silently LOSING for
-- longer than the rejected row was. Its `not exists` had no status filter, so
-- the bulk draw seating Zane at the Awards Banquet skipped it outright — which
-- it did on all six measured re-seeds, meaning the seeded database carried no
-- admin_manual row at all and nothing noticed, because the assert block never
-- counted one. That is the invisible half of the same defect: the rejected row
-- was asserted and failed loudly; this one was not and just quietly vanished.
-- 📌 It is asserted now. Zane's slot is reserved above, so there is no bulk row
-- here to collide with `attendance_one_per_event`.
insert into attendance (event_id, member_id, submitted_name, submitted_eid, submitted_email, submitted_at, status, source, resolution_note, resolved_by, resolved_at)
select e.id, m.id, m.full_name, m.eid, m.email, e.starts_at + interval '30 minutes',
       'present', 'admin_manual', 'Signed the paper sheet; phone was dead',
       '00000000-0000-4000-8000-5eed00000001', e.ends_at
from events e
join members m on m.full_name = 'Zane Okonkwo'
where e.title = 'Awards Banquet';

-- @chunk point-adjustments
-- Discretionary grants, including one voided and one negative.
-- 🪤 `term` is DERIVED from the award date rather than typed (§4.7): a literal
-- term string in the seed is the same bug it would be in application code, and
-- it silently stopped matching the moment these dates moved. Not omitted
-- either — the column defaults to current_term(), which is the term the seed is
-- RUN in rather than the term the grant belongs to, and those diverge the day
-- the calendar leaves Fall 2026.
insert into point_adjustments (member_id, points, reason, category, term, awarded_by, awarded_at)
select m.id, v.pts, v.rsn, v.cat,
       public.term_of(timestamptz '2026-08-03 12:00-05'),
       '00000000-0000-4000-8000-5eed00000001', timestamptz '2026-08-03 12:00-05'
from (values
  ('Amara Osei',      5, 'Staffed the info booth all day at the org fair', 'recruitment'),
  ('Chen Wu',         3, 'Volunteered at the food drive',                  'volunteer'),
  ('Priya Nair',     10, 'First place, regional case competition',         'competition'),
  ('Quinn Adeyemi',   4, 'Ran the resume workshop',                        'leadership'),
  ('Tomas Novak',    -2, 'Signed in for a member who was not present',     'correction')
) as v(nm, pts, rsn, cat)
join members m on m.full_name = v.nm;

-- Voided grant: still visible, struck through in the UI, counts for nothing.
insert into point_adjustments (member_id, points, reason, category, term, awarded_by, awarded_at, voided_at, voided_by, void_reason)
select m.id, 8, 'Bonus for tabling', 'recruitment',
       public.term_of(timestamptz '2026-08-04 12:00-05'),
       '00000000-0000-4000-8000-5eed00000001', timestamptz '2026-08-04 12:00-05',
       timestamptz '2026-08-05 09:00-05', '00000000-0000-4000-8000-5eed00000001',
       'Awarded to the wrong member'
from members m where m.full_name = 'Wren Abbott';

-- @chunk audit
-- A few audit rows so the activity log is not empty on first look.
-- Action strings must match the AuditAction union in app/actions/audit.ts.
-- The vocabulary is closed in TypeScript because the audit screen filters on
-- it, and a typo'd action silently disappears from the one screen that exists
-- to answer "who changed this".
insert into admin_audit (entity_type, entity_id, actor_id, action, before, after, note)
select 'attendance', a.id, '00000000-0000-4000-8000-5eed00000001', 'attendance.rejected',
       jsonb_build_object('status','pending'), jsonb_build_object('status','rejected'),
       'Duplicate submission'
from attendance a where a.status = 'rejected';

insert into admin_audit (entity_type, entity_id, actor_id, action, before, after, note)
select 'point_adjustment', p.id, '00000000-0000-4000-8000-5eed00000001', 'points.voided',
       jsonb_build_object('voided_at', null), jsonb_build_object('voided_at', p.voided_at),
       p.void_reason
from point_adjustments p where p.voided_at is not null;

-- @chunk assert
-- Refuse to finish if the data does not match what the docs claim it is.
--
-- Added 2026-08-02, after the EID regeneration silently lost the rejected
-- Mira Petrova row: the bulk insert above draws with a seeded random() over
-- `cross join members`, so the physical row order of members decides who
-- attends what, and the rejected-duplicate fixture is guarded by a
-- `not exists` that skips rather than fails when its slot is already taken.
-- The seed still "succeeded" — 208 attendance rows, just the wrong shape, and
-- one review-queue fixture and one audit row gone. These counts are quoted in
-- CLAUDE.md, tasks.md, and the test suite, so they are worth asserting here
-- rather than rediscovering from a failing test three files away.
do $$
declare
  n_members int; n_events int; n_present int; n_pending int; n_rejected int;
  n_adjust int; n_audit int; n_board int; n_fields int; n_presets int;
  n_manual int; n_invites int;
begin
  select count(*) into n_members from members;
  select count(*) into n_events  from events;
  select count(*) into n_present  from attendance where status = 'present';
  select count(*) into n_pending  from attendance where status = 'pending';
  select count(*) into n_rejected from attendance where status = 'rejected';
  select count(*) into n_adjust from point_adjustments;
  select count(*) into n_audit  from admin_audit;
  select count(*) into n_board  from leaderboard;
  -- Added with the two deletes above, which is what turns "the wipe list is
  -- complete" from a claim into a check.
  --
  -- 📌 n_fields was 0 until 2026-08-09 and is now 1: the officer chose to KEEP
  -- the shirt_size definition production had been carrying, so the seed creates
  -- it rather than the wipe silently removing it. The assertion still does the
  -- same job — it fails if the wipe stops working (count climbs past 1 on a
  -- re-seed) or if the insert is lost (count drops to 0).
  select count(*) into n_fields  from member_field_definitions;
  select count(*) into n_presets from member_filter_presets;
  -- Added 2026-08-10 with the slot reservations above. This fixture had been
  -- skipping itself on every measured re-seed and nothing caught it, because
  -- an admin_manual row is `present` like any other and the present count
  -- absorbed it. The rejected row failed loudly; this one just stopped
  -- existing. 📌 An unasserted fixture is an optional fixture.
  select count(*) into n_manual from attendance where source = 'admin_manual';
  -- Added 2026-08-10 with migration 24. The seed ships no invites, so this is
  -- purely a wipe check — and it is the one table where a surviving row is a
  -- LIVE CREDENTIAL rather than stale data, which is why it is asserted rather
  -- than assumed.
  select count(*) into n_invites from officer_invites;

  if n_members <> 32 then raise exception 'seed: expected 32 members, got %', n_members; end if;
  if n_events  <> 15 then raise exception 'seed: expected 15 events, got %', n_events; end if;
  if n_pending  <> 5 then raise exception 'seed: expected 5 pending attendance rows, got %', n_pending; end if;
  if n_rejected <> 1 then raise exception 'seed: expected 1 rejected attendance row, got % (the Mira Petrova duplicate fixture)', n_rejected; end if;
  if n_present <> 202 then raise exception 'seed: expected 202 present attendance rows, got %', n_present; end if;
  if n_adjust <> 6 then raise exception 'seed: expected 6 point adjustments, got %', n_adjust; end if;
  if n_audit  <> 2 then raise exception 'seed: expected 2 audit rows, got %', n_audit; end if;
  if n_board  <> 29 then raise exception 'seed: expected 29 leaderboard rows, got %', n_board; end if;
  if n_fields  <> 1 then raise exception 'seed: expected 1 custom field definition (shirt_size), got % — 0 means the insert was lost, more than 1 means the wipe is not clearing member_field_definitions', n_fields; end if;
  if n_presets <> 0 then raise exception 'seed: expected 0 saved views, got %', n_presets; end if;
  if n_manual  <> 1 then raise exception 'seed: expected 1 admin_manual attendance row (Zane Okonkwo at the Awards Banquet), got %', n_manual; end if;
  if n_invites <> 0 then raise exception 'seed: expected 0 officer invites, got % — the wipe is not clearing officer_invites, and a surviving invite is a live credential', n_invites; end if;
end $$;

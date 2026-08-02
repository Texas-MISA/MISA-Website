-- Development seed data. Run by `supabase db reset`, or applied to a remote
-- dev project with scripts/seed-remote.sh.
--
-- DESTRUCTIVE: wipes members, events, attendance, point_adjustments, and
-- admin_audit before inserting. The guard below refuses to run if auth.users
-- contains any account other than the seed officer, which is the signal that
-- you are pointed at something real.
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
delete from events;
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

-- Pin the board to the seeded semester. Without this the leaderboard empties
-- the moment the real date crosses into the next term, and the seed data
-- looks broken when it is only out of scope.
update app_settings set current_term = 'Spring 2026';

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
  case when source = 'self_checkin'
       then timestamptz '2026-03-10 18:05-06'
       else timestamptz '2026-01-20 12:00-06'
  end
from raw
-- Load-bearing, not tidiness. The bulk attendance below draws with a seeded
-- random() over `cross join members`, so which member attends which event
-- depends on the physical row order here. Inserting in a different order
-- silently reshuffles the whole distribution — and the first symptom is a
-- fixture disappearing, because the rejected-duplicate row is guarded by a
-- `not exists` that quietly skips when the draw happens to fill its slot.
order by last_name;

-- @chunk events
-- A Spring 2026 semester that has already happened, plus Fall 2026 events that
-- have not. term is generated from starts_at, so it is never set here.
insert into events (title, description, location, starts_at, ends_at, points, category, status, created_by)
values
  ('Spring Kickoff',        'First general meeting of the semester', 'UTC 3.102', '2026-01-27 18:00-06','2026-01-27 19:00-06', 1, 'general_meeting','published','00000000-0000-4000-8000-5eed00000001'),
  ('General Meeting #2',    null, 'UTC 3.102', '2026-02-03 18:00-06','2026-02-03 19:00-06', 1, 'general_meeting','published','00000000-0000-4000-8000-5eed00000001'),
  ('Resume Workshop',       'Bring a printed copy', 'GDC 2.216', '2026-02-10 18:00-06','2026-02-10 19:30-06', 2, 'workshop','published','00000000-0000-4000-8000-5eed00000001'),
  ('General Meeting #3',    null, 'UTC 3.102', '2026-02-17 18:00-06','2026-02-17 19:00-06', 1, 'general_meeting','published','00000000-0000-4000-8000-5eed00000001'),
  ('Case Competition',      'Flagship event', 'RLP 1.106', '2026-02-24 17:00-06','2026-02-24 21:00-06', 5, 'flagship','published','00000000-0000-4000-8000-5eed00000001'),
  ('General Meeting #4',    null, 'UTC 3.102', '2026-03-03 18:00-06','2026-03-03 19:00-06', 1, 'general_meeting','published','00000000-0000-4000-8000-5eed00000001'),
  ('Spring Social',         'Food provided', 'Gregory Plaza', '2026-03-10 18:00-06','2026-03-10 20:00-06', 1, 'social','published','00000000-0000-4000-8000-5eed00000001'),
  ('General Meeting #5',    null, 'UTC 3.102', '2026-03-24 18:00-05','2026-03-24 19:00-05', 1, 'general_meeting','published','00000000-0000-4000-8000-5eed00000001'),
  ('Alumni Panel',          null, 'UTC 4.132', '2026-03-31 18:00-05','2026-03-31 19:30-05', 2, 'workshop','published','00000000-0000-4000-8000-5eed00000001'),
  ('General Meeting #6',    null, 'UTC 3.102', '2026-04-07 18:00-05','2026-04-07 19:00-05', 1, 'general_meeting','published','00000000-0000-4000-8000-5eed00000001'),
  ('Interview Prep',        null, 'GDC 2.216', '2026-04-14 18:00-05','2026-04-14 19:30-05', 2, 'workshop','published','00000000-0000-4000-8000-5eed00000001'),
  ('End of Year Banquet',   'Awards and closing', 'AT&T Center', '2026-04-21 18:00-05','2026-04-21 21:00-05', 3, 'flagship','published','00000000-0000-4000-8000-5eed00000001'),
  -- Cancelled: keeps its attendance history but is excluded from totals (§4.6).
  ('Rained Out Tabling',    'Cancelled due to weather', 'Speedway', '2026-04-02 11:00-05','2026-04-02 14:00-05', 1, 'social','cancelled','00000000-0000-4000-8000-5eed00000001'),
  -- Fall 2026: one published, one still draft, so the schedule UI has both.
  ('Fall Kickoff',          'First meeting of the fall', 'UTC 3.102', '2026-09-01 18:00-05','2026-09-01 19:00-05', 1, 'general_meeting','published','00000000-0000-4000-8000-5eed00000001'),
  ('Fall Info Session',     'Not announced yet', 'TBD', '2026-09-08 18:00-05','2026-09-08 19:00-05', 1, 'general_meeting','draft','00000000-0000-4000-8000-5eed00000001');

-- @chunk attendance-bulk
-- Deterministic pseudo-randomness so the seed is reproducible.
select setseed(0.42);

-- Bulk attendance across the completed Spring events. Participation varies by
-- member so the leaderboard has a real distribution rather than a flat line.
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
insert into attendance (member_id, submitted_name, submitted_eid, submitted_email, submitted_at, status)
select m.id, m.full_name, m.eid, m.email, timestamptz '2026-04-07 20:15-05', 'pending'
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
insert into attendance (submitted_name, submitted_eid, submitted_email, submitted_at, status)
values ('Toby Vance','tv7140','toby.vance@example.edu', timestamptz '2026-04-15 09:30-05','pending');

-- Rejected: a duplicate someone submitted twice. The partial unique index
-- excludes rejected rows, so the corrected entry can coexist.
insert into attendance (event_id, member_id, submitted_name, submitted_eid, submitted_email, submitted_at, status, resolution_note, resolved_by, resolved_at)
select e.id, m.id, m.full_name, m.eid, m.email, e.starts_at + interval '2 minutes',
       'rejected', 'Duplicate submission — kept the earlier row',
       '00000000-0000-4000-8000-5eed00000001', e.ends_at
from events e
join members m on m.full_name = 'Mira Petrova'
where e.title = 'Alumni Panel'
  and not exists (
    select 1 from attendance a
    where a.event_id = e.id and a.member_id = m.id and a.status <> 'rejected'
  );

-- Officer-entered row for someone who never submitted the form.
insert into attendance (event_id, member_id, submitted_name, submitted_eid, submitted_email, submitted_at, status, source, resolution_note, resolved_by, resolved_at)
select e.id, m.id, m.full_name, m.eid, m.email, e.starts_at + interval '30 minutes',
       'present', 'admin_manual', 'Signed the paper sheet; phone was dead',
       '00000000-0000-4000-8000-5eed00000001', e.ends_at
from events e
join members m on m.full_name = 'Zane Okonkwo'
where e.title = 'End of Year Banquet'
  and not exists (
    select 1 from attendance a where a.event_id = e.id and a.member_id = m.id
  );

-- @chunk point-adjustments
-- Discretionary grants, including one voided and one negative.
insert into point_adjustments (member_id, points, reason, category, term, awarded_by, awarded_at)
select m.id, v.pts, v.rsn, v.cat, 'Spring 2026', '00000000-0000-4000-8000-5eed00000001', timestamptz '2026-03-15 12:00-05'
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
select m.id, 8, 'Bonus for tabling', 'recruitment', 'Spring 2026',
       '00000000-0000-4000-8000-5eed00000001', timestamptz '2026-03-16 12:00-05',
       timestamptz '2026-03-18 09:00-05', '00000000-0000-4000-8000-5eed00000001',
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
  n_adjust int; n_audit int; n_board int;
begin
  select count(*) into n_members from members;
  select count(*) into n_events  from events;
  select count(*) into n_present  from attendance where status = 'present';
  select count(*) into n_pending  from attendance where status = 'pending';
  select count(*) into n_rejected from attendance where status = 'rejected';
  select count(*) into n_adjust from point_adjustments;
  select count(*) into n_audit  from admin_audit;
  select count(*) into n_board  from leaderboard;

  if n_members <> 32 then raise exception 'seed: expected 32 members, got %', n_members; end if;
  if n_events  <> 15 then raise exception 'seed: expected 15 events, got %', n_events; end if;
  if n_pending  <> 5 then raise exception 'seed: expected 5 pending attendance rows, got %', n_pending; end if;
  if n_rejected <> 1 then raise exception 'seed: expected 1 rejected attendance row, got % (the Mira Petrova duplicate fixture)', n_rejected; end if;
  if n_present <> 202 then raise exception 'seed: expected 202 present attendance rows, got %', n_present; end if;
  if n_adjust <> 6 then raise exception 'seed: expected 6 point adjustments, got %', n_adjust; end if;
  if n_audit  <> 2 then raise exception 'seed: expected 2 audit rows, got %', n_audit; end if;
  if n_board  <> 29 then raise exception 'seed: expected 29 leaderboard rows, got %', n_board; end if;
end $$;

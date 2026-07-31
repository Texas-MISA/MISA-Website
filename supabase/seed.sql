-- Development seed data. Run by `supabase db reset`, or applied to a remote
-- dev project with scripts/seed-remote.sh.
--
-- DESTRUCTIVE: wipes members, events, attendance, point_adjustments, and
-- admin_audit before inserting. The guard below refuses to run if auth.users
-- contains any account other than the seed officer, which is the signal that
-- you are pointed at something real.
--
-- Every identity here is fabricated. Emails use example.edu (RFC 2606
-- reserved, can never resolve) and student IDs are synthetic. Never replace
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
-- 32 members. Student IDs are deliberately stored in mixed formats — hyphens,
-- spaces, lowercase — to exercise normalized_student_id. They are still 32
-- distinct people because normalization only collapses formatting.
with raw(first_name, last_name, fmt, active, source) as (values
  ('Amara','Osei','dash',true,'admin'),        ('Bela','Kovacs','plain',true,'admin'),
  ('Chen','Wu','space',true,'admin'),          ('Dara','Nolan','plain',true,'admin'),
  ('Esi','Boateng','lower',true,'admin'),      ('Farid','Haddad','plain',true,'admin'),
  ('Gita','Raman','dash',true,'admin'),        ('Hana','Sato','plain',true,'admin'),
  ('Ines','Duarte','plain',true,'admin'),      ('Jonas','Berg','space',true,'admin'),
  ('Kaia','Lindqvist','plain',true,'admin'),   ('Luca','Moretti','dash',true,'admin'),
  ('Mira','Petrova','plain',true,'admin'),     ('Nadia','Farouk','plain',true,'admin'),
  ('Omar','Silva','lower',true,'admin'),       ('Priya','Nair','plain',true,'admin'),
  ('Quinn','Adeyemi','plain',true,'admin'),    ('Rafa','Ortiz','dash',true,'admin'),
  ('Suri','Tanaka','plain',true,'admin'),      ('Tomas','Novak','plain',true,'admin'),
  ('Uma','Krishnan','plain',true,'admin'),     ('Viktor','Ilic','space',true,'admin'),
  ('Wren','Abbott','plain',true,'admin'),      ('Xiu','Lin','plain',true,'admin'),
  ('Yara','Mansour','plain',true,'admin'),     ('Zane','Okonkwo','dash',true,'admin'),
  ('Ayo','Balogun','plain',false,'admin'),     ('Bruno','Castro','plain',false,'admin'),
  ('Cleo','Marchand','plain',false,'admin'),   ('Devi','Sharma','plain',true,'self_checkin'),
  ('Eli','Rosenberg','plain',true,'self_checkin'), ('Fern','Whitlock','plain',true,'self_checkin')
),
numbered as (
  select *, 100000 + (row_number() over (order by last_name))::int as n from raw
)
insert into members (student_id, full_name, email, active, source, joined_at)
select
  case fmt
    when 'dash'  then 'UT-' || n
    when 'space' then 'UT ' || n
    when 'lower' then 'ut'  || n
    else 'UT' || n
  end,
  first_name || ' ' || last_name,
  lower(first_name || '.' || last_name || '@example.edu'),
  active,
  source,
  -- Self-registered members joined mid-semester, at their first check-in.
  case when source = 'self_checkin'
       then timestamptz '2026-03-10 18:05-06'
       else timestamptz '2026-01-20 12:00-06'
  end
from numbered;

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
insert into attendance (event_id, member_id, submitted_name, submitted_student_id, submitted_email, submitted_at, status, source)
select
  e.id, m.id, m.full_name, m.student_id, m.email,
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
insert into attendance (event_id, member_id, submitted_name, submitted_student_id, submitted_email, submitted_at, status, source)
select e.id, m.id, m.full_name, m.student_id, m.email, e.starts_at + interval '5 minutes', 'present', 'self_checkin'
from events e
cross join lateral (select * from members where active order by full_name limit 3) m
where e.title = 'Rained Out Tabling';

-- @chunk attendance-edge-cases
-- The cases the review queue exists for.

-- Orphans: checked in after the window closed, so no event link yet.
insert into attendance (member_id, submitted_name, submitted_student_id, submitted_email, submitted_at, status)
select m.id, m.full_name, m.student_id, m.email, timestamptz '2026-04-07 20:15-05', 'pending'
from members m where m.full_name in ('Hana Sato','Luca Moretti');

-- Unknown student IDs: event is clear, the person is not on the roster.
insert into attendance (event_id, submitted_name, submitted_student_id, submitted_email, submitted_at, status)
select e.id, v.nm, v.sid, v.em, e.starts_at + interval '11 minutes', 'pending'
from events e
cross join (values
  ('Rowan Pike','UT-100999','rowan.pike@example.edu'),
  ('Sage Delacroix','ut 100998','sage.delacroix@example.edu')
) as v(nm, sid, em)
where e.title = 'Interview Prep';

-- Neither link resolved: late submission from someone not on the roster.
insert into attendance (submitted_name, submitted_student_id, submitted_email, submitted_at, status)
values ('Toby Vance','UT-100997','toby.vance@example.edu', timestamptz '2026-04-15 09:30-05','pending');

-- Rejected: a duplicate someone submitted twice. The partial unique index
-- excludes rejected rows, so the corrected entry can coexist.
insert into attendance (event_id, member_id, submitted_name, submitted_student_id, submitted_email, submitted_at, status, resolution_note, resolved_by, resolved_at)
select e.id, m.id, m.full_name, m.student_id, m.email, e.starts_at + interval '2 minutes',
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
insert into attendance (event_id, member_id, submitted_name, submitted_student_id, submitted_email, submitted_at, status, source, resolution_note, resolved_by, resolved_at)
select e.id, m.id, m.full_name, m.student_id, m.email, e.starts_at + interval '30 minutes',
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

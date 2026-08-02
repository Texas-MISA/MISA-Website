-- Rewrite the pre-rename seed values to the new EID format.
--
-- Migration 16 renamed the columns; it did not touch the data, so the linked
-- project still holds 'UT-100023'-shaped identifiers under members.eid while
-- seed.sql now generates 'ao4471'-shaped ones. Everything works either way —
-- normalization, matching, and the unique index are all format-agnostic — but
-- the live database and the repo disagreed, and that is the drift §2.3 warns
-- about.
--
-- A full re-seed was the original plan and is not available: seed.sql refuses
-- to wipe a database whose auth.users holds a real account, and the linked
-- project has both a real officer and (see below) a real member. That guard is
-- correct and is not worked around here.
--
-- This is a NO-OP on a fresh database. Migrations run before seed.sql, so
-- locally these tables are empty when this executes; it only does work against
-- a project that already holds the old values.
--
-- IDEMPOTENT. Every statement is keyed on `normalized_eid like 'ut1000%'`,
-- which matches only the old 'UT' + six-digit shape. No new EID can match it,
-- so a second run changes nothing.
--
-- ⚠️ NOT everything is seed data. The linked project also carries
-- 'Christian A Gonzales' / cag7284, a real person who self-registered through
-- the check-in form, already in real EID format. The filter deliberately
-- leaves that row alone — do not "tidy" it into the mapping below.

-- Members, keyed by name because the old identifiers are what is being
-- replaced. The values match supabase/seed.sql exactly, including the two
-- rows that deliberately carry a stray space or hyphen (Jonas Berg, Viktor
-- Ilic) and the mixed casing that exercises the lower() fold.
update public.members m
set eid = v.new_eid
from (values
  ('Amara Osei','AO4471'),      ('Ayo Balogun','ab8049'),
  ('Bela Kovacs','bk2856'),     ('Bruno Castro','bc2714'),
  ('Chen Wu','Cw9134'),         ('Cleo Marchand','cm6580'),
  ('Dara Nolan','dn5027'),      ('Devi Sharma','ds4392'),
  ('Eli Rosenberg','er9067'),   ('Esi Boateng','eb7318'),
  ('Farid Haddad','fh6402'),    ('Fern Whitlock','fw1725'),
  ('Gita Raman','GR1975'),      ('Hana Sato','hs8260'),
  ('Ines Duarte','id3549'),     ('Jonas Berg','jb 4183'),
  ('Kaia Lindqvist','kl7092'),  ('Luca Moretti','lm2647'),
  ('Mira Petrova','mp8570'),    ('Nadia Farouk','nf9326'),
  ('Omar Silva','os1458'),      ('Priya Nair','pn8571'),
  ('Quinn Adeyemi','qa3291'),   ('Rafa Ortiz','ro8574'),
  ('Suri Tanaka','st2039'),     ('Tomas Novak','tn7146'),
  ('Uma Krishnan','uk4865'),    ('Viktor Ilic','vi-9701'),
  ('Wren Abbott','wa3428'),     ('Xiu Lin','XL6157'),
  ('Yara Mansour','ym1893'),    ('Zane Okonkwo','zo5236')
) as v(full_name, new_eid)
where m.full_name = v.full_name
  and m.normalized_eid like 'ut1000%';

-- Attendance carries its own copy of what was submitted. For rows already
-- linked to a member, the seed copied the member's identifier verbatim, so the
-- member row is the authority.
--
-- Safe against attendance_one_per_event: the mapping is injective, and no new
-- value can equal any *old* value (new ones are letter-prefixed, old ones all
-- normalize to 'ut1000NN'), so no row transiently collides with another mid-
-- statement.
update public.attendance a
set submitted_eid = m.eid
from public.members m
where a.member_id = m.id
  and a.normalized_eid like 'ut1000%';

-- The three unmatched submissions, which by construction link to no member.
-- These are the review-queue fixtures, and their replacements were computed
-- rather than picked: each is edit distance >= 2 from every member and
-- distance 1 from none, with rp8571 deliberately within distance 2 of three
-- members (mp8570, pn8571, ro8574) so the suggestion score floor has something
-- to reject. tests/seed-fixtures.test.ts asserts exactly that.
update public.attendance
set submitted_eid = case normalized_eid
  when 'ut100999' then 'rp8571'
  when 'ut100998' then 'Sd 4390'
  when 'ut100997' then 'tv7140'
  else submitted_eid
end
where normalized_eid in ('ut100999', 'ut100998', 'ut100997');

-- Migration 33 — house bingo: one shared board of 24 activities, one card per
-- house, and a square marked done by uploading one photo or video as proof
-- (decided by the officer, 2026-10-10).
--
-- The four houses are M, I, S and A. Every card shows the SAME 24 activities in
-- the SAME positions, numbered row-major 0–24 on a 5×5 grid. Position 12 is the
-- free centre square: it shows the house letter and is NEVER STORED, so nothing
-- here can mark it, rename it or count it.
--
-- Two tables:
--
--   1. bingo_squares — the board. One row per activity position, seeded below
--      from the officer's card. An officer may rename an activity; the rename
--      shows on all four cards at once and is audited. Nothing in the app adds
--      or deletes a square.
--   2. bingo_marks — one row per (house, square) that is DONE. The row exists
--      exactly when the square is complete: removing the proof DELETES the row,
--      so "done" is never a flag that can disagree with whether proof exists.
--
-- 📌 ONE CARD PER HOUSE, NO TERMS. There is deliberately no `term` column: the
-- officer decided on one standing card per house, not one per semester. If
-- that ever changes, it is a new decision and a new migration, not a column
-- quietly added to this one.
--
-- There is no `added_by` column on bingo_marks. The admin_audit row written by
-- every add, replace and remove names the officer, which is the one place this
-- schema records who did something.
--
-- ---------------------------------------------------------------------------
-- Where the proof lives: two PUBLIC Storage buckets, and no storage policies
-- ---------------------------------------------------------------------------
--
--   bingo-photos  image/jpeg only, 5 MiB per object. A photo's full JPEG and
--                 its thumbnail, and a video's poster frame.
--   bingo-videos  video/mp4 and video/quicktime, 50 MiB per object.
--
-- PUBLIC, because members see every card on a no-login portal page: the proof
-- is meant to be seen. A public bucket serves an object to anyone holding its
-- URL, and every path carries a fresh random uuid, so an object is reachable
-- only through a page that links it.
--
-- 🔓 THERE IS NO POLICY ON storage.objects, for anon, authenticated or anyone
-- else, and there must never be one. With RLS on and no policies, the API
-- roles can neither list a bucket nor write to it. Every write is authorised
-- with the service role, by officer-only server code:
--
--   * a PHOTO goes through our own Route Handler, which uploads it;
--   * a VIDEO is the one exception to "the browser never writes" (approved by
--     the officer, 2026-10-10), because 50 MiB will not fit through a Vercel
--     function's 4.5 MB request body. An officer-only Server Action mints a
--     signed upload token for ONE path, with the service role; the browser
--     uploads that one object with the anon key; and the Route Handler checks
--     the object before it records the mark. The token is the only credential
--     a browser ever holds, it names one path, and it cannot overwrite (no
--     upsert).
--
-- 📌 The buckets are created HERE, as rows, rather than in config.toml. A
-- config.toml bucket reaches a database only when someone remembers to run
-- `supabase seed buckets` against it, and a schema diff never captures
-- storage.buckets rows, so a migration is the one place both databases get
-- them from without a manual step. `on conflict do nothing` keeps a re-run
-- harmless, and the assertion block at the end refuses to finish if a bucket
-- that already existed carries different settings.
--
-- 🪤 SQL CANNOT DELETE A STORED FILE. Deleting a bingo_marks row leaves its
-- objects in the bucket; the application deletes them through the Storage API
-- (lib/bingo.ts), and scripts/wipe-remote.sh says the buckets must be emptied
-- in the dashboard.
--
-- ⚠️ DEPLOY ORDER: this migration BEFORE the code. The pages that read these
-- tables fail with 42P01 against a database that lacks them. The reverse is
-- harmless: nothing that predates this migration reads them.

-- ---------------------------------------------------------------------------
-- 1. The board
-- ---------------------------------------------------------------------------
create table public.bingo_squares (
  id          uuid primary key default gen_random_uuid(),

  -- Row-major on the 5×5 grid. Unique: one activity per position.
  position    smallint not null unique,

  activity    text not null,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- 12 is the free centre square, which is never stored.
  constraint bingo_squares_position_valid
    check (position between 0 and 24 and position <> 12),

  -- A rename is trimmed before it is saved (lib/bingo.ts); this is that rule
  -- where a hand-rolled POST cannot get round it. btrim strips spaces only,
  -- and the application's trim is stricter, so the two never disagree on a
  -- value the application writes.
  constraint bingo_squares_activity_trimmed
    check (activity = btrim(activity)),

  -- Counted in characters, not bytes, which is what lib/bingo.ts counts too.
  constraint bingo_squares_activity_length
    check (char_length(activity) between 1 and 60)
);

-- One set_updated_at() for the whole schema, defined with the events table.
-- updated_at is the compare-and-set token a rename carries.
create trigger bingo_squares_set_updated_at
  before update on public.bingo_squares
  for each row execute function public.set_updated_at();

-- ⚠️ Deny-all, like every other table (§6). The board is read on the server
-- with the service role and handed to the page; no API role reads it directly.
alter table public.bingo_squares enable row level security;

comment on table public.bingo_squares is
  'The house-bingo board: one row per activity position, shared by all four '
  'house cards. Position 12 is the free centre square and is never stored. '
  'Seeded by migration 33; officers rename activities (audited as '
  'bingo_square.renamed), and nothing adds or deletes a square.';

comment on column public.bingo_squares.position is
  'Row-major position on the 5x5 grid, 0 to 24 except 12 (the free centre).';

comment on column public.bingo_squares.activity is
  'The activity shown on every house card at this position. Trimmed, 1 to 60 '
  'characters.';

-- The officer's card, transcribed exactly. Row by row:
--    0–4    House Dinner · Study Session · Bowling Union Underground ·
--           Photo at Capitol Building · Karaoke Night
--    5–9    Food Review Video · Pool Day · Attend a UT Sports Event ·
--           Holiday Potluck · Movie Night
--   10–14   Photo at McCombs Statue · Coffee Run · (free) ·
--           Photo at UT Tower · Pickle Ball
--   15–19   Volleyball · Game Night · House Picnic · Grab a Sweet Treat ·
--           MISA Promotional Video
--   20–24   Morning Hike · Mini Golf · Barton Springs ·
--           Photo at Monochrome for Austin · Midnight McDonald's
insert into public.bingo_squares (position, activity) values
  (0,  'House Dinner'),
  (1,  'Study Session'),
  (2,  'Bowling Union Underground'),
  (3,  'Photo at Capitol Building'),
  (4,  'Karaoke Night'),
  (5,  'Food Review Video'),
  (6,  'Pool Day'),
  (7,  'Attend a UT Sports Event'),
  (8,  'Holiday Potluck'),
  (9,  'Movie Night'),
  (10, 'Photo at McCombs Statue'),
  (11, 'Coffee Run'),
  (13, 'Photo at UT Tower'),
  (14, 'Pickle Ball'),
  (15, 'Volleyball'),
  (16, 'Game Night'),
  (17, 'House Picnic'),
  (18, 'Grab a Sweet Treat'),
  (19, 'MISA Promotional Video'),
  (20, 'Morning Hike'),
  (21, 'Mini Golf'),
  (22, 'Barton Springs'),
  (23, 'Photo at Monochrome for Austin'),
  (24, 'Midnight McDonald''s');

-- ---------------------------------------------------------------------------
-- 2. The marks: one row per (house, square) that is done
-- ---------------------------------------------------------------------------
create table public.bingo_marks (
  id          uuid primary key default gen_random_uuid(),

  -- lib/bingo.ts HOUSES mirrors this list. Change both together, as with
  -- EVENT_CATEGORIES and MEMBER_TYPES.
  house       text not null
    constraint bingo_marks_house_valid
    check (house in ('M', 'I', 'S', 'A')),

  -- RESTRICT: a square that some house has completed cannot be deleted out
  -- from under its proof. Nothing in the app deletes a square anyway.
  square_id   uuid not null
    references public.bingo_squares (id) on delete restrict,

  kind        text not null
    constraint bingo_marks_kind_valid
    check (kind in ('photo', 'video')),

  -- The proof itself: a photo's full JPEG in bingo-photos, or the video in
  -- bingo-videos. Unique, because every upload gets a fresh uuid path and two
  -- marks sharing one object would delete each other's proof on removal.
  media_path  text not null unique,

  -- The small image a card shows: a photo's thumbnail, or a video's poster
  -- frame, both in bingo-photos. A video may have none. Unique for media_path's
  -- reason: two marks sharing a thumbnail would delete each other's picture on
  -- removal. NULLs are distinct in a unique index, so any number of videos
  -- without a poster coexist.
  thumb_path  text unique,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint bingo_marks_photo_has_thumb
    check (kind = 'video' or thumb_path is not null)
);

-- The rule this table exists for: at most one mark per house per square. A
-- second officer adding proof to a square that was just completed collides
-- here (23505), and lib/bingo.ts reports it as a conflict.
create unique index bingo_marks_house_square_idx
  on public.bingo_marks (house, square_id);

-- updated_at is the compare-and-set token for a replace and a remove.
create trigger bingo_marks_set_updated_at
  before update on public.bingo_marks
  for each row execute function public.set_updated_at();

-- ⚠️ Deny-all. The portal page reads the board on the server and re-reads it
-- every 10 seconds; no API role reads this table directly.
alter table public.bingo_marks enable row level security;

comment on table public.bingo_marks is
  'One row per (house, square) that is DONE; the row exists exactly when the '
  'square is complete, and removing the proof deletes it. Who added it is in '
  'admin_audit (bingo_mark.added, .replaced, .removed), not on this row.';

comment on column public.bingo_marks.media_path is
  'The proof: the full JPEG in the bingo-photos bucket when kind is photo, the '
  'video in the bingo-videos bucket when kind is video. Paths are '
  '<house letter, lowercased>/<position>/<uuid>.<ext>.';

comment on column public.bingo_marks.thumb_path is
  'In bingo-photos: the photo''s thumbnail, or the video''s poster frame. Null '
  'only for a video with no poster (bingo_marks_photo_has_thumb). Unique, like '
  'media_path, so no two marks share one file.';

-- ---------------------------------------------------------------------------
-- 3. The two Storage buckets
-- ---------------------------------------------------------------------------
--
-- lib/bingo.ts holds the same names and limits (PHOTO_BUCKET, VIDEO_BUCKET).
-- The application's own caps are tighter than the photo bucket's 5 MiB (a full
-- photo is at most 3 MiB, a thumbnail or poster 300 KiB); the bucket limit is
-- the backstop for a write that skipped them. The video bucket's 50 MiB IS the
-- cap, because a video is the one object the browser uploads itself.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('bingo-photos', 'bingo-photos', true, 5242880, array['image/jpeg']),
  ('bingo-videos', 'bingo-videos', true, 52428800, array['video/mp4', 'video/quicktime'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Two new admin_audit entity types
-- ---------------------------------------------------------------------------
--
-- 'bingo_square' names a bingo_squares row (a rename); 'bingo_mark' names a
-- bingo_marks row (an add, a replace, a removal). Two types rather than one
-- for the reason migration 24 gives: (entity_type, entity_id) identifies a row,
-- and these are two different tables.
--
-- ⚠️ This union has drifted from the TypeScript side TWICE ('roster' in 14,
-- 'dues_payment' in 19), and admin_audit is append-only, so a row filed under a
-- wrong type can never be corrected. AuditEntityType in app/actions/audit.ts is
-- widened in the same commit as this file. The list below is migration 24's,
-- copied whole, plus the two new types.
alter table public.admin_audit
  drop constraint admin_audit_entity_type_check;

alter table public.admin_audit
  add constraint admin_audit_entity_type_check check (
    entity_type in (
      'attendance','event','member','point_adjustment','roster','member_field',
      'dues_payment','member_preset','archive','officer','officer_invite',
      'bingo_square','bingo_mark'
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Assert what the header claims.
-- ---------------------------------------------------------------------------
--
-- Read-only, in migration 26's style: an unasserted change is an optional
-- change. The audit check is read from its definition rather than probed with
-- an insert, because even a rolled-back insert spends an admin_audit id, and a
-- gap in an append-only log's ids reads like a deleted row.
--
-- 🔓 The last check is the header's central claim: storage.objects carries NO
-- policy, so with RLS on, no API role can list or write a bucket. Storage was
-- unused before this migration, so a policy found there was added by hand,
-- and that is a reason to stop and find out why rather than to carry on.
do $$
declare
  positions smallint[];
  expected smallint[];
  squares int;
  photos_ok boolean;
  videos_ok boolean;
  audit_check text;
  object_policies int;
begin
  select count(*), array_agg(s.position order by s.position)
    into squares, positions
    from public.bingo_squares s;

  select array_agg(p::smallint order by p)
    into expected
    from generate_series(0, 24) as p
   where p <> 12;

  if squares <> 24 or positions is distinct from expected then
    raise exception
      'bingo_squares must hold exactly the 24 activity positions 0-24 except '
      '12; it holds % rows at %', squares, positions;
  end if;

  select coalesce(bool_and(b.public
                           and b.file_size_limit = 5242880
                           and b.allowed_mime_types = array['image/jpeg']), false)
    into photos_ok
    from storage.buckets b
   where b.id = 'bingo-photos';

  select coalesce(bool_and(b.public
                           and b.file_size_limit = 52428800
                           and b.allowed_mime_types = array['video/mp4', 'video/quicktime']), false)
    into videos_ok
    from storage.buckets b
   where b.id = 'bingo-videos';

  if not photos_ok then
    raise exception
      'bucket bingo-photos must exist, be public, cap objects at 5242880 bytes '
      'and allow only image/jpeg';
  end if;

  if not videos_ok then
    raise exception
      'bucket bingo-videos must exist, be public, cap objects at 52428800 bytes '
      'and allow only video/mp4 and video/quicktime';
  end if;

  select pg_get_constraintdef(c.oid)
    into audit_check
    from pg_constraint c
   where c.conrelid = 'public.admin_audit'::regclass
     and c.conname = 'admin_audit_entity_type_check';

  if audit_check is null then
    raise exception 'admin_audit_entity_type_check is missing';
  end if;

  if strpos(audit_check, '''bingo_square''') = 0
     or strpos(audit_check, '''bingo_mark''') = 0 then
    raise exception
      'admin_audit_entity_type_check does not accept bingo_square and '
      'bingo_mark: %', audit_check;
  end if;

  select count(*)
    into object_policies
    from pg_policies p
   where p.schemaname = 'storage'
     and p.tablename = 'objects';

  if object_policies <> 0 then
    raise exception
      'storage.objects must carry NO policy, so that no API role can list or '
      'write a bucket; it carries %. Find out who added them and why before '
      'applying this migration', object_policies;
  end if;
end
$$;

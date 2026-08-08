-- Stage 6 phase 7a (§7 Stage 6): saved filter presets for the member directory.
--
-- The directory now carries fourteen filter controls across two panels. The
-- queries officers actually repeat — "not paid this term", "attended fewer than
-- three things", "self-registered and never seen" — are rebuilt by hand every
-- week or live in one person's bookmarks. A preset is a named, shared URL.
--
-- ---------------------------------------------------------------------------
-- What is stored, and why it is TEXT rather than jsonb
-- ---------------------------------------------------------------------------
--
-- `query` holds the canonical query string `memberFilterToParams` emits — the
-- exact thing after the `?` on /admin/members. Not a structured jsonb copy of
-- MemberFilter, for three reasons:
--
--   * The URL is already the canonical form. lib/filters.ts round-trips it in
--     both directions and sorts its keys, so two officers who picked the same
--     filters in a different order produce byte-identical strings — which is
--     what lets the UI mark the active preset by string equality rather than by
--     diffing two filter objects.
--   * A jsonb copy would be a SECOND representation of MemberFilter, and every
--     field added to that type would have to be added here too or silently drop
--     out of every preset. The URL shape is maintained by one module already.
--   * A stale preset degrades exactly the way a stale bookmark does.
--     parseMemberFilter reads the keys it knows and is total, so a preset naming
--     a since-archived custom field narrows LESS rather than erroring — the
--     phase-3 rule ("retiring a filter means an old link narrows nothing")
--     applies for free.
--
-- ⚠️ Corollary the application must honour: canonicalise on WRITE, never on
-- read. Re-canonicalising a stored preset at render time needs the live field
-- definitions, and a preset naming a temporarily-archived `cf:` field would be
-- quietly rewritten to drop it — the officer's next save then makes that
-- permanent. See lib/presets.ts.

-- ---------------------------------------------------------------------------
-- 1. The presets
-- ---------------------------------------------------------------------------
create table public.member_filter_presets (
  id          uuid primary key default gen_random_uuid(),

  name        text not null,

  -- The query string, with no leading '?'. Bounded rather than unbounded text:
  -- it reaches the browser as an href on every directory render, and a filter
  -- URL the officer can actually build is a couple of hundred characters.
  query       text not null,

  -- Who first saved it. Nullable and `references` without a cascade, matching
  -- member_field_definitions.created_by: an officer leaving must not take the
  -- team's presets with them.
  created_by  uuid references auth.users(id),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint member_filter_presets_name_not_blank
    check (length(trim(name)) between 1 and 80),

  -- 🔓 Non-empty is a CORRECTNESS bound, not tidiness. An empty query is the
  -- default view, so a preset holding one is a chip an officer clicks expecting
  -- a narrowed roster and gets the whole thing — the phase-1 defect (a count
  -- nobody can account for) saved as an object and shared with the whole team.
  -- The UI disables Save when isDefaultFilter(filter); this is that rule where
  -- it cannot be bypassed by a hand-rolled POST.
  constraint member_filter_presets_query_bounded
    check (length(query) between 1 and 2000)
);

-- Case-insensitive, because two presets called "Award eligible" and "award
-- eligible" are a bug rather than a feature: they render identically in the
-- chip row and the officer cannot tell which one they are editing.
create unique index member_filter_presets_name_idx
  on public.member_filter_presets (lower(name));

-- One set_updated_at() for the whole schema, defined with the events table.
create trigger member_filter_presets_set_updated_at
  before update on public.member_filter_presets
  for each row execute function public.set_updated_at();

-- ⚠️ Deny-all, like every other table (§6). Worth stating explicitly why the
-- migration-15 hazard does NOT apply here: that one was about a VIEW, where
-- migration 12's `grant all on all tables` is genuinely a hole because a view
-- has no RLS and member_directory deliberately runs as owner. This is a table.
-- RLS with no policies is the real boundary, which is exactly what migration 12
-- claims and is true for tables. tests/security.test.ts scans the migrations for
-- views and will correctly not pick this up; the anon-reads-it-empty check lives
-- in the phase's own test file instead.
alter table public.member_filter_presets enable row level security;

comment on table public.member_filter_presets is
  'Named, shared member-directory filters. `query` is the canonical query string '
  'lib/filters.ts emits — canonicalised when written and handed to the URL '
  'untouched when read, so a preset naming an archived custom field narrows less '
  'rather than being silently rewritten.';

-- ---------------------------------------------------------------------------
-- 2. An audit shape for a preset
-- ---------------------------------------------------------------------------
--
-- Saving, renaming and deleting a preset are officer mutations like any other
-- and write an admin_audit row (§4.2, §6). Its own entity type rather than
-- 'member': a preset is not a member, and filing these under 'member' would put
-- "someone renamed a saved filter" into somebody's personal history.
--
-- ⚠️ This union has now drifted from the TypeScript side TWICE — 'roster' in
-- migration 14 and 'dues_payment' in migration 19, both caught after the fact —
-- and admin_audit is append-only (P0001 on UPDATE and DELETE alike), so a row
-- written under a wrong entity_type can never be corrected. Widening this check
-- and widening AuditEntityType in app/actions/audit.ts is ONE edit, and they
-- land in the same commit.
alter table public.admin_audit
  drop constraint admin_audit_entity_type_check;

alter table public.admin_audit
  add constraint admin_audit_entity_type_check check (
    entity_type in (
      'attendance','event','member','point_adjustment','roster','member_field',
      'dues_payment','member_preset'
    )
  );

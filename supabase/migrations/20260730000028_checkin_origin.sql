-- Check-in location verification (§6): flag check-ins whose network origin
-- differs from the event's most common one. One new table, one new column on
-- events, no new route. Plan and threat model: docs/checkin-location-verification.md.
--
-- ===========================================================================
-- 🔓 This migration adds the first data the system stores ABOUT a member's
--    network. Read this before changing anything below.
-- ===========================================================================
--
-- Until now the only IP handling in the codebase was lib/request-ip.ts, whose
-- hashes key a ten-minute rate-limit bucket and link to nobody. This table sits
-- next to a member's identity, so every column below exists to keep what it
-- reveals as narrow as the signal allows.
--
-- ⚠️ ADVISORY ONLY. Nothing here rejects a check-in, moves a row to pending,
-- withholds points, or writes an admin_audit row. It renders a pill on the
-- officer's review screen and stops. The mechanism's weakness was raised when
-- it was proposed and the officer asked for it anyway — that is recorded in the
-- plan so the tradeoff is not mistaken for an oversight.
--
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. The per-event toggle.
-- ---------------------------------------------------------------------------
--
-- On by default (officer's call, 2026-08-22). Flippable before OR after the
-- event: the digest is captured at check-in and the flag is DERIVED at review
-- time, so turning this on a week later lights up an event that already
-- happened with no backfill and no second migration.
--
-- 🔓 Which means the toggle gates DERIVATION, NOT COLLECTION. Capture runs on
-- every self check-in whether this is true or false — that is precisely what
-- makes flipping it afterwards work. An officer who turns it off is choosing
-- not to LOOK, not choosing not to RECORD. That is a disclosure obligation on
-- /attend, not a footnote.
--
-- 🪤 app/actions/events.ts carries FIVE separate literal column lists for
-- events. The audit invariant is that both sides of a before/after select the
-- same columns, so this name has to reach all five or the log will invent a
-- change that never happened.
alter table public.events
  add column verify_origin boolean not null default true;

comment on column public.events.verify_origin is
  'Whether the officer review screens derive origin flags for this event. '
  'Gates derivation only — check-in origins are captured regardless, which is '
  'what makes flipping this after the event work.';

-- ---------------------------------------------------------------------------
-- 2. The origin record.
-- ---------------------------------------------------------------------------
--
-- A SIBLING TABLE, not columns on attendance. Columns would ride into
-- member_directory, into exportCatalogue's field list, and into
-- AUDITED_MEMBER_COLUMNS and the audit before/after JSON — each a separate
-- place an origin digest could leak into a downloaded spreadsheet. A separate
-- table is reachable from exactly the query that needs it.

create table public.checkin_origin (
  -- One row per check-in, and the PK is the FK: there is no second origin for
  -- a submission. Cascades, so deleting an attendance row takes its origin
  -- with it and scripts/wipe-remote.sh needs no separate delete (it still has
  -- to NAME this table — see that file's accounting).
  attendance_id uuid primary key references public.attendance(id) on delete cascade,

  -- sha256( PEPPER || event_id || normalize(ip) ). Three load-bearing
  -- properties, none optional:
  --
  -- 🔓 PEPPER is a server-only environment secret, NEVER a repo literal. IPv4
  --    is 4.3 billion addresses, so an unpeppered SHA-256 of one is reversible
  --    on a laptop in seconds — and this repository is public.
  --
  -- 🔓 event_id INSIDE the hash breaks cross-event correlation. The same
  --    address at two events produces two unrelated digests, so this table
  --    cannot trace where a member was over a semester. Do not "optimise" the
  --    event id out to make the digests joinable: being unjoinable is the
  --    feature, and it is the single reason this design is acceptable at all.
  --
  --    normalize() folds IPv6 to its /64 and leaves IPv4 whole. Without that
  --    the mode never forms for IPv6 clients, whose low bits rotate.
  --
  -- 🔓 NULL when the submission resolved to no event. event_id is inside the
  --    hash, so a pending orphan has nothing to hash against — but it still
  --    records its network_type below, so an officer who later assigns it to
  --    an event learns whether the submitter was on campus. That asymmetry is
  --    what makes the retroactive requirement work for pending rows too.
  origin_hash   text,

  -- What KIND of connection it was, computed from the address at submission
  -- time by lib/network-classify.ts against a committed CIDR table.
  --
  -- ⚠️ This is the one stored value that IS joinable across events, unlike the
  -- digest: it says "on cellular at event X, on campus at event Y". About a bit
  -- and a half per check-in, and it is the price of the cellular exemption —
  -- which is a privacy improvement overall, because the alternative is flagging
  -- real attendees whose phone had not joined the wifi yet.
  --
  -- 🪤 NOT RETROACTIVE and cannot be made so: it needs the address, and the
  -- address is never stored. Check-ins captured before this migration have no
  -- kind and never will. They render "origin unknown", permanently and
  -- correctly.
  --
  -- 'unknown' is a REAL state, not a failure to be cleaned up later. A missing
  -- header must land here rather than hashing the literal string "unknown" —
  -- in local dev nobody has the header, so a shared literal would give every
  -- check-in one digest and form a confident, entirely fictional venue mode.
  network_type  text not null
                  check (network_type in ('campus','cellular','other','unknown')),

  created_at    timestamptz not null default now(),

  -- 🔓 The load-bearing constraint, and the reason it is in the schema rather
  -- than in a code comment: an 'unknown' kind must never carry a digest.
  --
  -- The review screen classifies in precedence order, and its last rule is
  -- "matched no venue and is not campus or cellular -> OFF-NETWORK, flagged".
  -- An address we could not parse would fall straight through to that rule and
  -- be reported as evidence against a member on the strength of a parse
  -- failure. So capture refuses to hash what it could not classify, and this
  -- constraint makes that refusal a property of the database instead of a
  -- habit of one call site — the same reason present_requires_resolution
  -- exists on attendance.
  --
  -- 📌 Not an equivalence. A PENDING orphan legitimately has a real kind and a
  -- null digest, because there is no event_id to hash with. The implication
  -- runs one way only.
  constraint checkin_origin_unknown_has_no_digest check (
    network_type <> 'unknown' or origin_hash is null
  )
);

comment on table public.checkin_origin is
  'Per-check-in network origin: a peppered, event-scoped digest and a coarse '
  'connection kind. Never an IP address. Advisory only.';

-- Grouping by digest within one event is the whole read pattern. Partial
-- because the null half is never grouped.
create index checkin_origin_hash_idx
  on public.checkin_origin (origin_hash)
  where origin_hash is not null;

-- Deny-all with zero policies, which Stage 8 established is the END STATE and
-- not a placeholder: the service-role client is the only reader and it bypasses
-- RLS entirely, so a policy here would be untested attack surface. Migration 22
-- already narrowed anon/authenticated to SELECT and set default privileges
-- accordingly, so this table inherits no DML grant and none is issued here.
alter table public.checkin_origin enable row level security;

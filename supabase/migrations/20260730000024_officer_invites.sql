-- Officer invite links (§2.3 turnover, §6). One new table and two new
-- admin_audit entity types.
--
-- ===========================================================================
-- 🔓 This migration deliberately opens the privilege-escalation path §6 has
--    claimed does not exist. Read this before changing anything below.
-- ===========================================================================
--
-- §6's risk register has said, since Stage 1:
--
--   "Admin privilege escalation | admin_profiles is not writable by any client
--    role; officers are added via the Supabase dashboard or a seeded SQL script"
--
-- Both halves stay literally true — no client role gains a grant here, and the
-- only writer is still the service-role client behind lib/auth.ts. But the
-- *property* they were shorthand for ("becoming an officer requires someone
-- with the service key") is what ends today. After this, a valid, unexpired,
-- unclaimed row in this table is a CAPABILITY: whoever holds the matching token
-- can mint an officer account. That trade is deliberate — the alternative is
-- that officer turnover, which §2.3 says happens every year, requires handing a
-- student the production service role key — but it means the security of this
-- feature is the security of the token, and every column below exists to keep
-- that capability narrow, short-lived, single-use, attributable and revocable.
--
-- The doc is updated in the same commit rather than left asserting the old
-- sentence. §9 #13 records the decision.

create table public.officer_invites (
  id            uuid primary key default gen_random_uuid(),

  -- Pinned by the INVITER, never typed by the recipient. The redemption page
  -- renders this as read-only text rather than an input, so the account that
  -- gets created is the one that was authorised — a forwarded link cannot be
  -- redeemed into an arbitrary address.
  email         text not null,

  -- Likewise pinned. app/actions/officer-invite.ts reads the role from THIS
  -- column and never from the posted form; a redeemer who edits the DOM to say
  -- admin still gets what the inviter granted.
  role          text not null default 'officer'
                  check (role in ('officer','admin')),

  -- A starting point for the recipient, who may correct it. Defaulting it at
  -- invite time rather than leaving it null is the same argument
  -- scripts/create-officer.mjs:91-96 makes: admin_audit renders the display
  -- name, and a nameless officer shows up on every screen as "an officer" in
  -- the one log whose job is saying who did what.
  display_name  text,

  -- 🔓 The SHA-256 of the token, hex — NEVER the token itself.
  --
  -- The distinction is what keeps this row from being a credential. A database
  -- backup, a Studio session left open, a careless service-role select, or a
  -- future screen that renders the invite list all leak this column; none of
  -- them can redeem it, because the redemption path hashes what the caller
  -- presents and compares. It is the same doctrine lib/request-ip.ts already
  -- applies to IPs, and the reason /admin/officers can list pending invites
  -- while being structurally unable to re-display a link.
  --
  -- Unique so a (vanishingly improbable) token collision is a 23505 rather than
  -- two invites resolving to one row.
  token_hash    text not null unique
                  check (length(token_hash) = 64),

  expires_at    timestamptz not null,
  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now(),

  -- ⚠️ Three columns for the redemption, not one, and the split is a recovery
  -- property rather than bookkeeping.
  --
  -- PostgREST has no cross-statement transaction (the same gap writeAudit and
  -- commitMerge live with), so accepting an invite is several round trips:
  -- claim it, create the auth user, insert admin_profiles. The claim goes FIRST
  -- and is a conditional update, which makes it simultaneously the single-use
  -- guard and the concurrency guard — two simultaneous redemptions, one wins,
  -- the loser updates zero rows.
  --
  -- If a later step then fails, the invite is burned and NOTHING was granted.
  -- That is the safe direction, and claimed_at is what makes it visible: the
  -- officers screen shows a claimed-but-not-accepted row as an attempt that did
  -- not complete, which is exactly the state that tells an officer to re-invite.
  -- Overloading accepted_at for the claim would make a burned invite
  -- indistinguishable from a successful one.
  claimed_at    timestamptz,
  accepted_at   timestamptz,
  accepted_user uuid references auth.users(id),

  revoked_at    timestamptz,
  revoked_by    uuid references auth.users(id),

  -- The pair constraints migration 22 applied to attendance and dues_payments,
  -- for the same reason: a half-set pair is a state no screen can render
  -- honestly, and the DB is where that stops being possible.
  constraint officer_invites_acceptance_is_complete
    check ((accepted_at is null) = (accepted_user is null)),
  constraint officer_invites_revocation_is_complete
    check ((revoked_at is null) = (revoked_by is null)),
  -- Accepted implies claimed. The reverse does not hold — that is the burned
  -- invite above.
  constraint officer_invites_accept_implies_claim
    check (accepted_at is null or claimed_at is not null),

  -- Text bounds, per the doctrine lib/validation.ts:363-366 states and
  -- migration 22 applied backwards to the older tables. 254 is the RFC maximum
  -- for an address; 120 matches members.full_name.
  constraint officer_invites_text_bounded
    check (length(email) <= 254
       and (display_name is null or length(display_name) <= 120))
);

-- 🪤 Deliberately NOT unique, and deliberately not partial on "still live".
--
-- The rule we want is "one live invite per address", and it cannot be an index:
-- liveness depends on expires_at vs now(), and now() is not immutable, so it
-- cannot appear in an index predicate. A partial index on
-- `where accepted_at is null and revoked_at is null` would be immutable and
-- WRONG in a worse way — an expired invite nobody revoked would permanently
-- block re-inviting that address, with the error surfacing as a 23505 the
-- officer cannot act on.
--
-- So createInvite supersedes: it revokes any live invite for the address before
-- issuing a new one. This index is what makes that lookup cheap, and the
-- application is what enforces the rule.
create index officer_invites_email_idx
  on public.officer_invites (lower(email));

-- The officers screen lists pending invites newest first.
create index officer_invites_created_idx
  on public.officer_invites (created_at desc);

-- Deny-all with zero policies, which Stage 8 established is the END STATE and
-- not a placeholder: the service-role client is the only reader and it bypasses
-- RLS entirely, so a policy here would be untested attack surface. Note that
-- migration 22 already narrowed anon/authenticated to SELECT and set default
-- privileges accordingly, so this table inherits no DML grant.
alter table public.officer_invites enable row level security;

-- ===========================================================================
-- Two new admin_audit entity types.
-- ===========================================================================
--
-- 'officer' names an admin_profiles row (entity_id = user_id); 'officer_invite'
-- names an invite (entity_id = the id above). TWO types rather than one,
-- because (entity_type, entity_id) is supposed to identify a row and these are
-- two different tables — filing both under 'officer' would make entity_id
-- sometimes a user and sometimes an invite, and "show me everything that
-- happened to this officer" would return rows about a link.
--
-- ⚠️ Migration 23's header records that this union has drifted from the
-- TypeScript side TWICE ('roster' in 14, 'dues_payment' in 19), and that
-- admin_audit is append-only so a row filed under a wrong type can never be
-- corrected. AuditEntityType in app/actions/audit.ts is widened in the same
-- commit as this file.

alter table public.admin_audit
  drop constraint admin_audit_entity_type_check;

alter table public.admin_audit
  add constraint admin_audit_entity_type_check check (
    entity_type in (
      'attendance','event','member','point_adjustment','roster','member_field',
      'dues_payment','member_preset','archive','officer','officer_invite'
    )
  );

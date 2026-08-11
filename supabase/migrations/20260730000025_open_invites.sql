-- Open officer invites: `officer_invites.email` becomes nullable.
--
-- ===========================================================================
-- 🔓 This WEAKENS the containment migration 24 argued for. Read that header
--    first; this one only records what changed and what it costs.
-- ===========================================================================
--
-- Migration 24 pinned the address: the inviter typed it, the redemption page
-- rendered it as read-only text, and the account created was always the one
-- that had been authorised. That made a forwarded link useless to anyone but
-- the intended recipient, and it is listed in §9 #13 as one of the five things
-- keeping the capability narrow.
--
-- It is now OPTIONAL rather than removed, and the distinction is the whole
-- design:
--
--   * email IS NOT NULL — unchanged from migration 24. The recipient sets a
--     password and nothing else; the address cannot be influenced by whoever
--     opens the link.
--
--   * email IS NULL — an OPEN invite. Whoever holds the link supplies their own
--     address. 🔓 This is a BEARER CREDENTIAL: anyone who obtains the link,
--     forwarded or leaked, can create an officer account under any address they
--     control, and the row does not record who it was meant for.
--
-- The reason for allowing it is real rather than cosmetic: an officer often
-- does not know which mailbox somebody will use — a utexas.edu address or the
-- personal one they actually read — and under migration 24 guessing wrong meant
-- the link simply did not work for them, with a "this invitation can't be used"
-- screen and no way to self-correct.
--
-- What still contains an open invite, unchanged: it expires in 72 hours, it is
-- single-use (the claim is a conditional UPDATE), any officer can revoke it
-- instantly, every step is audited, and — the important one — **the ROLE is
-- still pinned by the inviter and still read off this row**. An open invite
-- lets the holder choose who they are, never what they may do.
--
-- 📌 A domain restriction (only @utexas.edu may redeem an open invite) is the
-- obvious next mitigation if this proves too loose. It is deliberately NOT
-- added here: officers legitimately use personal mailboxes, and a rule that
-- silently refuses half of them would recreate the problem this solves.

alter table public.officer_invites
  alter column email drop not null;

-- The bound has to tolerate the null explicitly. A CHECK whose expression
-- evaluates to NULL passes, so `length(email) <= 254` would have kept working
-- by accident — this states the intent instead of relying on that.
alter table public.officer_invites
  drop constraint officer_invites_text_bounded;

alter table public.officer_invites
  add constraint officer_invites_text_bounded
  check ((email is null or length(email) <= 254)
     and (display_name is null or length(display_name) <= 120));

-- ⚠️ An open invite records the address it was REDEEMED with, written by
-- acceptInvite at the moment the account is created. Two consequences worth
-- stating, because the column now means slightly different things over time:
--
--   1. Before redemption, NULL means "anyone with the link". The officers
--      screen says exactly that rather than rendering a blank cell.
--   2. After redemption, it names whoever used it — so the audit question
--      "who did this link let in?" is answerable from the row itself, not only
--      from admin_audit.
--
-- This is why nothing here backfills or defaults the column: the null IS the
-- information until the invite is used.
comment on column public.officer_invites.email is
  'The invited address. NULL before redemption means an OPEN invite redeemable by anyone holding the link; acceptInvite writes the redeemer''s address here when the account is created.';

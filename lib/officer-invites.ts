import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// The officer-invite core (migration 24). Pure, like lib/events.ts,
// lib/attendance.ts and lib/dues.ts: no next/* imports and no database client,
// so every decision here is testable without a request context. The I/O lives
// in app/actions/invites.ts (officer-facing) and
// app/actions/officer-invite.ts (the redemption).
//
// 🔓 The security of this whole feature is the security of the token. A valid,
// unexpired, unclaimed invite is a capability to mint an officer account — see
// the header of 20260730000024_officer_invites.sql for why that trade was made.
// The three rules that keep it narrow all live in this file:
//
//   1. The token is generated here and HASHED before it is ever stored.
//   2. Liveness is decided by one function, so no screen invents its own idea
//      of "still usable".
//   3. Nothing here decides ROLE. The role travels on the invite row, and the
//      redemption action reads it from there rather than from the form.
//
// ⚠️ This file imports node:crypto, so it must never be imported by a Client
// Component — the same constraint lib/request-ip.ts carries for next/headers,
// and the reason lib/checkin.ts is deliberately free of both. lib/validation.ts
// imports MIN_OFFICER_PASSWORD from here, and that is safe today only because
// every importer of lib/validation.ts is a server module; if a form component
// ever needs a constant from this file, hardcode it in the JSX or lift it to a
// third module rather than reaching across.

/**
 * How long an invite stays redeemable.
 *
 * 72 hours: long enough to survive a weekend and a missed text, short enough
 * that a link left in a group chat is dead before anybody scrolls back to it.
 * Fixed rather than officer-chosen — a control offering "7 days" is a control
 * somebody picks on autopilot, and the cost of a too-short window is one more
 * click by an officer, while the cost of a too-long one is a live credential
 * sitting in a Discord DM.
 */
export const INVITE_TTL_HOURS = 72;

/**
 * Per-IP redemption attempts per RATE_LIMIT_WINDOW_MINUTES, in the invite's own
 * throttle bucket (see hashClientIp's `scope` in lib/request-ip.ts).
 *
 * Far below RATE_LIMIT_MAX (90), and sized differently on purpose: that number
 * is a ROOM CAPACITY, because a venue's NAT puts a whole meeting behind one
 * address. Nobody redeems an invite in a crowd — a legitimate caller does this
 * once. The limit is not what stops a brute force (43 characters of base64url
 * is 256 bits; there is nothing to brute force), it is what stops a broken
 * client or a bored person hammering the endpoint.
 */
export const INVITE_RATE_LIMIT_MAX = 10;

/**
 * Minimum password length for a redeemed invite.
 *
 * ⚠️ **Lowered from 12 to 6 on 2026-08-10, on request.** This is now a mirror of
 * GoTrue's own `minimum_password_length` rather than a policy of our own, and
 * that is the reason it is not simply removed:
 *
 * GoTrue rejects anything shorter, and `createUser` runs **after** the invite
 * has been claimed — so a 4-character password would burn a single-use link,
 * grant nothing, and leave the recipient stuck with a dead invite and an error
 * they cannot act on. Validating at the platform's floor keeps that rejection
 * where every other input rejection happens: before the claim, next to the
 * field, with the link still usable.
 *
 * 📌 Consequence to know: `scripts/create-officer.mjs:186` still enforces 12,
 * so the two officer-creation paths no longer agree. The CLI is the deliberate
 * path taken by whoever holds the service key; this is the self-service one. If
 * that asymmetry is ever unwanted, change the script rather than reintroducing a
 * floor here that GoTrue does not share.
 *
 * ⚠️ Raising GoTrue's own setting means editing `config.toml` (needs a full
 * `stop` + `start`, since `db reset` does not re-read it) **and** the remote
 * dashboard by hand — the second lives outside this repo, so it does not survive
 * the §2.3 "create project → link → db push" path.
 */
export const MIN_OFFICER_PASSWORD = 6;

/** base64url of 32 random bytes is always 43 characters, no padding. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * A fresh invite token. 256 bits from the CSPRNG, base64url so it survives a
 * URL path segment untouched — no percent-encoding to get wrong on either side.
 *
 * Returned to the inviter exactly once and never stored: only `hashInviteToken`
 * of it reaches the database.
 */
export function mintInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * What actually goes in `officer_invites.token_hash`.
 *
 * Plain SHA-256, not a password KDF, and that is correct rather than a
 * shortcut: bcrypt and friends exist to make *low-entropy* secrets expensive to
 * guess. This input is 256 uniformly random bits, so there is no dictionary and
 * no cost factor worth paying — the same reasoning that makes a random session
 * token safe to store hashed with a fast digest.
 */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Whether a string is even shaped like a token.
 *
 * Cheap rejection for the garbage that arrives when somebody truncates a link
 * in a chat client, and it bounds what gets hashed. Not a security control —
 * the hash lookup is — but it keeps a 10MB path segment from becoming a digest
 * operation.
 */
export function isWellFormedToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

/**
 * Constant-time comparison of two token hashes.
 *
 * Included for the one place the application compares digests it has both
 * halves of. The *lookup* by `token_hash` is an ordinary indexed equality and
 * is deliberately not constant-time: at 256 bits of entropy there is no
 * guessing strategy a timing signal could accelerate, and turning that lookup
 * into a scan-and-compare would trade a real property (an index) for an
 * imaginary one.
 */
export function tokenHashEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * The subset of an invite row this module reasons about.
 *
 * Structural rather than imported from lib/types/database, the same way
 * lib/filters.ts types its query builder: it keeps the file pure and lets tests
 * construct rows without a database.
 */
export type InviteLifecycle = {
  expires_at: string;
  claimed_at: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
};

export type InviteState =
  /** Redeemable right now. The only state acceptInvite will act on. */
  | { kind: "valid" }
  /** An officer withdrew it. */
  | { kind: "revoked" }
  /** Already redeemed — the account exists. */
  | { kind: "accepted" }
  /**
   * Claimed but never accepted: a redemption started, burned the single use,
   * and failed before the account was created. Nothing was granted. The
   * recovery is a new invite, which is why this is its own state rather than
   * being folded into "expired" — the officer needs to know the link is dead
   * for a reason that is not the clock.
   */
  | { kind: "stalled" }
  /** Past expires_at. */
  | { kind: "expired" };

/**
 * Whether an invite can still be redeemed, and if not, why.
 *
 * `now` is a parameter rather than being read inside, matching
 * classifyTermEvents in lib/members.ts — it is what makes expiry testable
 * without mocking the clock.
 *
 * ⚠️ Order matters and is not arbitrary. Revocation is an officer's explicit
 * decision and outranks everything, including an invite that also happens to
 * have been used; acceptance outranks the clock, because "you already have an
 * account" is more useful than "that link expired" to someone who is confused
 * about which of two emails they clicked.
 *
 * This is the ONLY definition of liveness. The redemption page, the redemption
 * action and the officers screen all call it, so a link can never look usable on
 * one and refuse on another.
 */
export function inviteState(row: InviteLifecycle, now: Date): InviteState {
  if (row.revoked_at) return { kind: "revoked" };
  if (row.accepted_at) return { kind: "accepted" };
  if (row.claimed_at) return { kind: "stalled" };
  if (new Date(row.expires_at).getTime() <= now.getTime()) {
    return { kind: "expired" };
  }
  return { kind: "valid" };
}

/**
 * What the recipient is told.
 *
 * 🔓 These messages are specific — "already used", "expired" — and that is a
 * deliberate departure from /lookup's one-message rule. There, distinguishing
 * failures would build a membership oracle out of information the caller had
 * not already supplied. Here the caller is holding the secret: a 256-bit token
 * that exists in exactly one row. Telling its holder what happened to their own
 * invite reveals nothing they could not have learned by redeeming it, and being
 * vague instead just sends a legitimate new officer to the wrong person for
 * help.
 *
 * The generic message is reserved for a token that matches NO row — there is no
 * reason to confirm to a guesser that a given string is not in the table.
 */
export function describeInviteState(state: InviteState): string {
  switch (state.kind) {
    case "valid":
      return "This invitation is ready to use.";
    case "revoked":
      return "This invitation was withdrawn by an officer. Ask them for a new link.";
    case "accepted":
      return "This invitation has already been used. If the account is yours, sign in instead.";
    case "stalled":
      return "Someone started setting up an account with this link and it did not finish, so the link is no longer usable. Ask an officer for a new one — no access was granted.";
    case "expired":
      return `This invitation expired. Links are good for ${INVITE_TTL_HOURS} hours; ask an officer for a new one.`;
  }
}

/** When a freshly minted invite stops working. */
export function inviteExpiry(now: Date): Date {
  return new Date(now.getTime() + INVITE_TTL_HOURS * 60 * 60 * 1000);
}

/**
 * "in about 2 days" / "in 5 hours" / "expired", for the officers screen.
 *
 * Formatted server-side and passed down as a string, per the hydration
 * invariant — Intl in a Client Component renders differently under Node and
 * Chrome, and the React diff shows two strings that look identical.
 */
export function describeExpiry(expiresAt: string, now: Date): string {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (ms <= 0) return "expired";

  const hours = Math.round(ms / (60 * 60 * 1000));
  if (hours < 1) return "in under an hour";
  if (hours === 1) return "in 1 hour";
  if (hours < 36) return `in ${hours} hours`;

  const days = Math.round(hours / 24);
  return days === 1 ? "in 1 day" : `in ${days} days`;
}

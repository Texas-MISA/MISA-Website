import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

// Reading the officer roster (migration 24). The counterpart to
// lib/admin-profiles.ts, which answers "what is this actor's display name?" for
// the audit trail; this one answers "who has access at all?" for
// /admin/officers and for the invite actions.
//
// 🪤 The roster spans TWO stores that PostgREST cannot join. `admin_profiles`
// lives in `public` and is reachable through the Data API; the email, the
// created date and the last sign-in live in `auth.users`, which is not exposed
// and is reachable only through the GoTrue admin API. So every function here
// does two reads and stitches them in memory. That is also why
// lib/admin-profiles.ts exists at all — the same seam, from the other side.
//
// 🔓 Every function returns a DISCRIMINATED result and never a bare array or
// null. This is the Stage 8 phase 3 rule, and it bites unusually hard here: an
// empty roster rendered on a failed read says "nobody is an officer", and a
// failed user lookup rendered as "not found" would let createInvite issue an
// invite for an address that already has an account — which the redemption then
// burns, having granted nothing.

type Client = SupabaseClient<Database>;

/** One unbroken literal with `as const`: PostgREST types the returned row off
 * the string literal, and a concatenation widens it to plain `string`. */
export const AUDITED_OFFICER_COLUMNS = "user_id, display_name, role" as const;

/**
 * A page size and a page ceiling for the GoTrue admin API, which offers no
 * filter-by-email and no server-side join. An officer roster is a dozen
 * accounts and §2.2's worst case does not grow it — members have no accounts at
 * all — so 20 pages of 200 is four thousand, with orders of magnitude to spare.
 *
 * ⚠️ It is still a CAP, and this codebase's rule is that a cap must refuse
 * loudly rather than trim (CLAUDE.md, "a cap that silently truncates"). Hitting
 * it returns an error rather than a short list, because a short list here means
 * an officer invisible on the management screen — or, worse, an existing
 * account that createInvite fails to notice.
 */
const USER_PAGE_SIZE = 200;
const MAX_USER_PAGES = 20;

export type AuthAccount = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
};

export type AuthAccountsResult =
  | { ok: true; accounts: AuthAccount[] }
  | { ok: false };

/**
 * Every account in the project's auth store.
 *
 * Members have no accounts (§2.3, and the whole point of the identity-based
 * check-in), so everything this returns is an officer or a former one.
 */
export async function fetchAuthAccounts(
  db: Client
): Promise<AuthAccountsResult> {
  const accounts: AuthAccount[] = [];

  for (let page = 1; page <= MAX_USER_PAGES; page++) {
    const { data, error } = await db.auth.admin.listUsers({
      page,
      perPage: USER_PAGE_SIZE,
    });
    if (error) {
      console.error("listUsers failed:", error.message);
      return { ok: false };
    }

    for (const user of data.users) {
      if (!user.email) continue;
      accounts.push({
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
      });
    }

    if (data.users.length < USER_PAGE_SIZE) return { ok: true, accounts };
  }

  // See MAX_USER_PAGES: refuse rather than return a truncated roster.
  console.error(
    `officer roster exceeded ${MAX_USER_PAGES * USER_PAGE_SIZE} accounts — raise MAX_USER_PAGES`
  );
  return { ok: false };
}

export type FindAccountResult =
  | { status: "found"; account: AuthAccount }
  | { status: "missing" }
  | { status: "error" };

/**
 * The account for an address, if there is one.
 *
 * Three outcomes rather than a nullable, for the reason §4.2 gives about member
 * lookup: `missing` has to mean "definitely no account", never "we could not
 * tell". createInvite branches on it, and reporting a transient failure as
 * `missing` would issue an invite that cannot be redeemed.
 *
 * The comparison is case-insensitive because GoTrue stores addresses folded and
 * an officer will type whatever their contact list holds.
 */
export async function findAccountByEmail(
  db: Client,
  email: string
): Promise<FindAccountResult> {
  const target = email.trim().toLowerCase();
  const result = await fetchAuthAccounts(db);
  if (!result.ok) return { status: "error" };

  const account = result.accounts.find(
    (candidate) => candidate.email.toLowerCase() === target
  );
  return account ? { status: "found", account } : { status: "missing" };
}

export type InviteRow = {
  id: string;
  /**
   * 🔓 Null means an OPEN invite (migration 25) — redeemable by whoever holds
   * the link, with the address chosen at redemption. Screens must say so in
   * words rather than rendering an empty cell, because "no address" and "an
   * address that failed to load" look identical otherwise, and the difference
   * is whether the link is a bearer credential.
   *
   * After redemption it names whoever actually used it, written back by
   * acceptInvite.
   */
  email: string | null;
  role: string;
  display_name: string | null;
  expires_at: string;
  created_at: string;
  claimed_at: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
};

export type InvitesResult = { ok: true; invites: InviteRow[] } | { ok: false };

/**
 * Recent invites, newest first, for the officers screen.
 *
 * Returns the raw lifecycle columns and classifies nothing — `inviteState` in
 * lib/officer-invites.ts is the single definition of liveness, and the caller
 * applies it. A second notion of "still pending" expressed as a `.is()` filter
 * here is exactly how the screen and the redemption path would come to disagree.
 *
 * 🔓 `token_hash` is deliberately not selected. Nothing on any screen needs it,
 * and the digest is the one column worth not moving around.
 */
export async function fetchRecentInvites(
  db: Client,
  limit = 50
): Promise<InvitesResult> {
  const { data, error } = await db
    .from("officer_invites")
    .select(
      "id, email, role, display_name, expires_at, created_at, claimed_at, accepted_at, revoked_at"
    )
    .order("created_at", { ascending: false })
    // A tie-break, for the reason every directory query carries one: rows tied
    // on created_at have no defined relative order, and this list is small
    // enough that nobody would notice it shuffling — which is what makes it
    // worth pinning rather than debugging later.
    .order("id")
    .limit(limit);

  if (error) {
    console.error("officer_invites read failed:", error.message);
    return { ok: false };
  }
  return { ok: true, invites: data };
}

export type OfficerRosterEntry = AuthAccount & {
  displayName: string | null;
  role: "officer" | "admin";
};

export type OfficerRoster = {
  /** Accounts holding an admin_profiles row — these people can sign in today. */
  officers: OfficerRosterEntry[];
  /**
   * Accounts with no admin_profiles row: former officers whose access was
   * revoked, and anyone who signed up without ever being granted access.
   *
   * ⚠️ The second group is not hypothetical — `enable_signup` is true, so any
   * address can create an account. Such an account is NOT an officer and never
   * was (that is exactly the distinction migration 22 turned on), so the screen
   * that renders this must not imply it used to be. Restoring one is a grant,
   * not a reinstatement.
   */
  withoutAccess: AuthAccount[];
};

export type OfficerRosterResult =
  | { ok: true; roster: OfficerRoster }
  | { ok: false };

/** The two stores, stitched. */
export async function fetchOfficerRoster(
  db: Client
): Promise<OfficerRosterResult> {
  const accounts = await fetchAuthAccounts(db);
  if (!accounts.ok) return { ok: false };

  const { data: profiles, error } = await db
    .from("admin_profiles")
    .select(AUDITED_OFFICER_COLUMNS);

  if (error) {
    console.error("admin_profiles read failed:", error.message);
    return { ok: false };
  }

  const byUserId = new Map(profiles.map((row) => [row.user_id, row]));

  const officers: OfficerRosterEntry[] = [];
  const withoutAccess: AuthAccount[] = [];

  for (const account of accounts.accounts) {
    const profile = byUserId.get(account.id);
    if (profile) {
      officers.push({
        ...account,
        displayName: profile.display_name,
        role: profile.role as "officer" | "admin",
      });
    } else {
      withoutAccess.push(account);
    }
  }

  officers.sort((a, b) =>
    (a.displayName ?? a.email).localeCompare(b.displayName ?? b.email)
  );
  withoutAccess.sort((a, b) => a.email.localeCompare(b.email));

  return { ok: true, roster: { officers, withoutAccess } };
}

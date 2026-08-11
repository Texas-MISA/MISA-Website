"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { writeAudit } from "@/app/actions/audit";
import { getOfficer } from "@/lib/auth";
import {
  hashInviteToken,
  inviteExpiry,
  mintInviteToken,
} from "@/lib/officer-invites";
import {
  AUDITED_OFFICER_COLUMNS,
  findAccountByEmail,
} from "@/lib/officer-roster";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  inviteCreateSchema,
  inviteRevokeSchema,
  officerAccessSchema,
  officerRestoreSchema,
} from "@/lib/validation";

// Officer turnover, officer-facing half (migration 24, §2.3). The redemption
// lives in app/actions/officer-invite.ts and is deliberately a separate file —
// it is unauthenticated, and keeping the one endpoint anybody may call apart
// from the four that require a session is what keeps §6's attack surface a
// one-file answer, exactly as attendance.ts and lookup.ts already do.
//
// House shape throughout, same as app/actions/presets.ts: getOfficer() rather
// than requireOfficer() (redirect() throws NEXT_REDIRECT and the try/catch would
// swallow it), zod, the service-role client, writeAudit, revalidatePath.
//
// 🔓 No role check anywhere in this file, and that is a decision rather than an
// omission (§9 #13). Any officer may invite another, change nobody's mind about
// it, and revoke access. It follows §9 #6/#9/#10 — the audit log is the control,
// not a role gate — and it is the first time that principle has been applied to
// something that grants PRIVILEGE rather than edits data, which is why the
// decision is recorded in the doc rather than inferred from the code. Nothing in
// this codebase branches on admin_profiles.role, and this file does not become
// the first thing that does.
//
// ⚠️ The one guard that IS here is self-revocation, and it is not politeness:
// it is what makes team-wide lockout unreachable through the UI. See
// revokeOfficerAccess.

const OFFICERS = "/admin/officers";

export type SubmittedInviteValues = {
  email: string;
  role: string;
  displayName: string;
};

export type InviteCreateState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  | {
      status: "invalid";
      fieldErrors: Partial<Record<"email" | "role" | "displayName", string[]>>;
      values: SubmittedInviteValues;
    }
  /** That address already has an account — this is a Restore, not an invite. */
  | { status: "already_registered"; email: string; hasAccess: boolean }
  /**
   * The link, returned to the inviter ONCE.
   *
   * 🔓 This is the only moment the token exists outside the recipient's browser.
   * Only its SHA-256 was stored, so nothing — not this action on a re-render,
   * not the officers page, not a database query — can produce it again. That is
   * the property that makes the stored row safe to read; the cost is that an
   * officer who loses the link must issue a new invite, which is the correct
   * trade and is said plainly on screen.
   */
  | { status: "created"; url: string; email: string; expiresAt: string };

/**
 * Issue an invite and return its one-time link.
 *
 * Does NOT send anything. There is no SMTP on this project — the built-in
 * Supabase mailer is capped at 2 emails/hour and is explicitly not for
 * production (scripts/create-officer.mjs:69-71), which is also why
 * `inviteUserByEmail` is unusable here. The officer copies the link and sends it
 * however they already talk to the person, which has the side benefit of adding
 * no service to hand over at turnover (§2.3).
 */
export async function createInvite(
  _prev: InviteCreateState,
  formData: FormData
): Promise<InviteCreateState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const values: SubmittedInviteValues = {
    email: echoField(formData.get("email"), 508),
    role: echoField(formData.get("role"), 32),
    displayName: echoField(formData.get("displayName"), 240),
  };

  const parsed = inviteCreateSchema.safeParse({
    email: values.email,
    role: values.role,
    displayName: values.displayName,
  });
  if (!parsed.success) {
    return {
      status: "invalid",
      fieldErrors: fieldErrorsOf<"email" | "role" | "displayName">(
        parsed.error,
        "email"
      ),
      values,
    };
  }
  const fields = parsed.data;

  try {
    const db = createAdminClient();

    // ⚠️ Refuse rather than silently doing something else. An address that
    // already has an account cannot be invited, because redemption CREATES the
    // account — pointing an invite at an existing one would either fail late
    // (having already burned the invite) or, far worse, be "helpfully" turned
    // into a password reset, which is an account takeover with a nice UI on it.
    // The officer wants Restore, and the screen says so.
    //
    // `error` is its own branch: treating a failed lookup as "no account"
    // would issue an invite that can never be redeemed.
    const existing = await findAccountByEmail(db, fields.email);
    if (existing.status === "error") return { status: "error" };
    if (existing.status === "found") {
      const { data: profile } = await db
        .from("admin_profiles")
        .select("user_id")
        .eq("user_id", existing.account.id)
        .maybeSingle();
      return {
        status: "already_registered",
        email: fields.email,
        hasAccess: Boolean(profile),
      };
    }

    const now = new Date();

    // Supersede any live invite for this address. The "one live invite per
    // address" rule cannot be an index — liveness depends on now(), which is not
    // immutable — so it is enforced here; the migration header explains why a
    // partial unique index would be worse than nothing. Re-inviting therefore
    // always means "the newest link is the one that works", with no way to end
    // up with two valid links whose recipients race.
    const { data: superseded, error: supersedeError } = await db
      .from("officer_invites")
      .update({ revoked_at: now.toISOString(), revoked_by: officer.userId })
      .eq("email", fields.email)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .select("id");

    if (supersedeError) {
      console.error("invite supersede failed:", supersedeError.message);
      return { status: "error" };
    }

    const token = mintInviteToken();
    const expiresAt = inviteExpiry(now);

    const { data: invite, error } = await db
      .from("officer_invites")
      .insert({
        email: fields.email,
        role: fields.role,
        display_name: fields.displayName,
        // Only the digest. See lib/officer-invites.ts.
        token_hash: hashInviteToken(token),
        expires_at: expiresAt.toISOString(),
        created_by: officer.userId,
      })
      .select("id, email, role, display_name, expires_at, created_at")
      .single();

    if (error) {
      console.error("createInvite failed:", error.message);
      return { status: "error" };
    }

    for (const row of superseded ?? []) {
      await writeAudit(db, {
        entityType: "officer_invite",
        entityId: row.id,
        actorId: officer.userId,
        action: "invite.revoked",
        note: `Superseded by a new invite for ${fields.email}`,
      });
    }

    await writeAudit(db, {
      entityType: "officer_invite",
      entityId: invite.id,
      actorId: officer.userId,
      action: "invite.created",
      // 🔓 `invite` deliberately carries no token and no hash. The audit trail
      // is rendered on screen, and a digest there would be a needless second
      // copy of the one secret this table exists to protect.
      after: invite,
      note: `${invite.email} as ${invite.role}`,
    });

    revalidatePath(OFFICERS);

    return {
      status: "created",
      url: await inviteUrl(token),
      email: fields.email,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (e) {
    console.error(
      "createInvite failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

export type InviteRevokeState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  /** Already revoked, or redeemed, between the render and the click. */
  | { status: "already_gone" }
  | { status: "done"; email: string };

/** Withdraw a pending invite. The link stops working immediately. */
export async function revokeInvite(
  _prev: InviteRevokeState,
  formData: FormData
): Promise<InviteRevokeState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const parsed = inviteRevokeSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { status: "error" };

  try {
    const db = createAdminClient();

    // Conditional update with a returning select, the deletePreset /
    // voidAdjustment shape: zero rows back is an unambiguous "someone got there
    // first" with no read-then-write window in between. Crucially this cannot
    // un-accept a redeemed invite — `.is("accepted_at", null)` means a race
    // between a revoke and a redemption resolves to whichever landed first,
    // rather than leaving a revoked row whose account exists.
    const { data: after, error } = await db
      .from("officer_invites")
      .update({ revoked_at: new Date().toISOString(), revoked_by: officer.userId })
      .eq("id", parsed.data.id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .select("id, email, role, expires_at, revoked_at")
      .maybeSingle();

    if (error) {
      console.error("revokeInvite failed:", error.message);
      return { status: "error" };
    }
    if (!after) return { status: "already_gone" };

    await writeAudit(db, {
      entityType: "officer_invite",
      entityId: after.id,
      actorId: officer.userId,
      action: "invite.revoked",
      after,
      note: after.email,
    });

    revalidatePath(OFFICERS);
    return { status: "done", email: after.email };
  } catch (e) {
    console.error(
      "revokeInvite failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

export type OfficerAccessState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  /** Refused: you cannot revoke your own access. See below. */
  | { status: "self" }
  /** Nothing to do — already revoked, or already an officer. */
  | { status: "no_change" }
  | { status: "done"; email: string };

/**
 * Remove an officer's access, keeping their account.
 *
 * Deletes the `admin_profiles` row and never the auth user, for the reason
 * scripts/create-officer.mjs:130-134 already gives: `admin_audit.actor_id` and
 * `point_adjustments.awarded_by` reference `auth.users` with no cascade, so
 * deleting the account of anyone who has ever acted would either fail outright
 * or erase who did what. Revoking preserves history, which is what turnover
 * needs.
 *
 * ⚠️ **Refuses to act on yourself, and that guard is load-bearing.** It is what
 * makes locking the whole team out unreachable from this screen: every
 * revocation must be performed by a different officer, so with N officers the
 * last one standing has nobody left who can remove them. Without it, two
 * officers can revoke each other and then the survivor can revoke themselves,
 * leaving an org whose only way back in is the service role key and a checkout
 * of this repo. The recovery path exists (scripts/create-officer.mjs) but
 * needing it is an outage.
 */
export async function revokeOfficerAccess(
  _prev: OfficerAccessState,
  formData: FormData
): Promise<OfficerAccessState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const parsed = officerAccessSchema.safeParse({
    userId: formData.get("userId"),
  });
  if (!parsed.success) return { status: "error" };
  const { userId } = parsed.data;

  if (userId === officer.userId) return { status: "self" };

  try {
    const db = createAdminClient();

    const { data: before, error } = await db
      .from("admin_profiles")
      .delete()
      .eq("user_id", userId)
      .select(AUDITED_OFFICER_COLUMNS)
      .maybeSingle();

    if (error) {
      console.error("revokeOfficerAccess failed:", error.message);
      return { status: "error" };
    }
    if (!before) return { status: "no_change" };

    // The email is not on admin_profiles — it lives in auth.users — so it is
    // read for the audit note rather than derived. A note naming only a uuid is
    // a note nobody can read a year later.
    const { data: account } = await db.auth.admin.getUserById(userId);
    const email = account?.user?.email ?? userId;

    await writeAudit(db, {
      entityType: "officer",
      entityId: userId,
      actorId: officer.userId,
      action: "officer.access_revoked",
      // `before` with no `after` is what AuditTrail renders as a removal.
      before,
      note: email,
    });

    revalidatePath(OFFICERS);
    return { status: "done", email };
  } catch (e) {
    console.error(
      "revokeOfficerAccess failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

/**
 * Give an existing account officer access.
 *
 * The counterpart to a revoke, and the answer to "a former officer is back" —
 * which is exactly the case createInvite refuses, because their auth user still
 * exists and an invite would try to create it again. No link and no new
 * credential is involved: they sign in with the password they already had.
 *
 * ⚠️ It is also reachable for an account that was NEVER an officer — signup is
 * open, so anyone can create one. That is a grant, not a reinstatement, and the
 * audit verb is the same either way because the end state is: this account can
 * now act. The screen is what distinguishes them.
 */
export async function restoreOfficerAccess(
  _prev: OfficerAccessState,
  formData: FormData
): Promise<OfficerAccessState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const parsed = officerRestoreSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { status: "error" };
  const { userId, role } = parsed.data;

  try {
    const db = createAdminClient();

    // The account has to exist: admin_profiles.user_id is a FK to auth.users, so
    // a bad uuid would surface as a 23503 the officer cannot interpret.
    const { data: account, error: accountError } =
      await db.auth.admin.getUserById(userId);
    if (accountError || !account?.user) {
      console.error(
        "restoreOfficerAccess: no such account:",
        accountError?.message ?? userId
      );
      return { status: "error" };
    }

    const { data: existing } = await db
      .from("admin_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return { status: "no_change" };

    const { data: after, error } = await db
      .from("admin_profiles")
      .insert({
        user_id: userId,
        // Same floor as the invite path and the script: never null, because a
        // nameless officer renders as "an officer" in the one log whose job is
        // saying who did what.
        display_name: account.user.email?.split("@")[0] ?? null,
        role,
      })
      .select(AUDITED_OFFICER_COLUMNS)
      .single();

    if (error) {
      console.error("restoreOfficerAccess failed:", error.message);
      return { status: "error" };
    }

    await writeAudit(db, {
      entityType: "officer",
      entityId: userId,
      actorId: officer.userId,
      action: "officer.access_restored",
      after,
      note: account.user.email ?? userId,
    });

    revalidatePath(OFFICERS);
    return { status: "done", email: account.user.email ?? userId };
  } catch (e) {
    console.error(
      "restoreOfficerAccess failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

// ---------------------------------------------------------------------------

/**
 * The absolute URL an invite token is redeemed at.
 *
 * Derived from the request headers rather than an env var, so it is correct in
 * dev, on a Vercel preview and in production with nothing to configure and
 * nothing to forget at deploy time. `x-forwarded-proto` is what sits in front of
 * the function on Vercel; the fallback matters only for local dev, where the
 * header is absent.
 *
 * ⚠️ `host` is attacker-supplied in principle. It is safe here because this
 * string is shown to the officer who just asked for it and is never trusted by
 * the server — the redemption resolves the TOKEN, not the URL, so a forged host
 * produces a link that does not work rather than one that goes somewhere
 * dangerous. Do not reuse this helper anywhere that acts on the result.
 */
async function inviteUrl(token: string): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  return `${proto}://${host}/officer-invite/${token}`;
}

function echoField(value: FormDataEntryValue | null, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

// Duplicated from app/actions/presets.ts rather than shared: a "use server"
// module may only export async functions, so a helper like this cannot be
// exported from one and imported by the other.
function fieldErrorsOf<K extends string>(
  error: { issues: { path: PropertyKey[]; message: string }[] },
  fallback: K
): Partial<Record<K, string[]>> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? fallback);
    (fieldErrors[field] ??= []).push(issue.message);
  }
  return fieldErrors as Partial<Record<K, string[]>>;
}

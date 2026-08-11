"use server";

import { redirect } from "next/navigation";

import { writeAudit } from "@/app/actions/audit";
import { checkRateLimit } from "@/lib/checkin";
import {
  describeInviteState,
  hashInviteToken,
  INVITE_RATE_LIMIT_MAX,
  inviteState,
  isWellFormedToken,
  type InviteState,
} from "@/lib/officer-invites";
import {
  AUDITED_OFFICER_COLUMNS,
  findAccountByEmail,
} from "@/lib/officer-roster";
import { hashClientIp } from "@/lib/request-ip";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { inviteAcceptSchema } from "@/lib/validation";

// Redeeming an officer invite (migration 24).
//
// 📌 THE ONE UNAUTHENTICATED **PRIVILEGED** WRITE PATH, and a single export, held
// to the shape app/actions/attendance.ts (the unauthenticated write) and
// app/actions/lookup.ts (the unauthenticated read) already use, for the §6
// reason those two state: "what can an anonymous caller POST to" has to stay a
// short, one-symbol-per-file answer. This is now the third such file and by far
// the most consequential — the other two record attendance and read standings;
// this one CREATES AN OFFICER.
//
// The whole of the caller's authority is the token. Everything that matters
// follows from treating it that way:
//
//   * The token is re-hashed and re-looked-up here. The page that rendered the
//     form is not trusted for anything — same posture as commitImport
//     re-parsing the CSV rather than accepting the preview's output.
//   * The ROLE comes off the stored invite row, never off the form. There is no
//     `role` field in inviteAcceptSchema, so there is nothing to tamper with;
//     a hand-rolled POST carrying `role=admin` against an officer invite gets
//     `officer`, and a test asserts it.
//   * The EMAIL likewise. The account created is the address the inviter
//     authorised, so a forwarded link cannot be redeemed into someone else's
//     inbox.
//   * Single use is enforced by a conditional UPDATE, not by a read-then-check.
//     See the claim below.
//
// ⚠️ No `getOfficer()` in this file, deliberately and by definition — the caller
// is not an officer yet; that is the entire point. The token is the gate.

export type SubmittedInviteAcceptValues = {
  displayName: string;
};

export type AcceptInviteState =
  | { status: "idle" }
  | { status: "error" }
  | { status: "rate_limited" }
  /**
   * No invite matches this token.
   *
   * 🔓 Deliberately indistinguishable from a typo'd or fabricated token, and
   * deliberately NOT the same as the states below. Once someone holds a real
   * token there is nothing left to protect by being vague about what happened to
   * their own invite (see describeInviteState) — but there is no reason to
   * confirm to a guesser that a given 43-character string is absent from the
   * table.
   */
  | { status: "unknown" }
  /** A real invite that cannot be redeemed: expired, revoked, used, stalled. */
  | { status: "unusable"; reason: InviteState; message: string }
  /** The address already has an account — an officer needs to Restore it. */
  | { status: "already_registered"; email: string }
  | {
      status: "invalid";
      fieldErrors: Partial<
        Record<"displayName" | "password" | "confirmPassword" | "token", string[]>
      >;
      submitted: SubmittedInviteAcceptValues;
    }
  /**
   * The account exists and holds officer access, but signing them in
   * automatically failed. Not an error state: the work is done and durable, and
   * the only thing left is for them to type the password they just chose.
   */
  | { status: "created_sign_in_failed"; email: string };

export async function acceptInvite(
  _prev: AcceptInviteState,
  formData: FormData
): Promise<AcceptInviteState> {
  // Honeypot (§6), first, exactly as the other two unauthenticated actions do:
  // a bot that fills a field no human can see gets the generic miss, with no
  // signal that it was detected and no query run.
  const honeypot = formData.get("website");
  if (typeof honeypot === "string" && honeypot.length > 0) {
    return { status: "unknown" };
  }

  const submitted: SubmittedInviteAcceptValues = {
    displayName: echoField(formData.get("displayName"), 240),
  };

  const parsed = inviteAcceptSchema.safeParse({
    token: formData.get("token"),
    displayName: formData.get("displayName"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "password");
      (fieldErrors[field] ??= []).push(issue.message);
    }
    // 🔓 `submitted` carries the display name and NOTHING else. Echoing a
    // password back into the DOM to "preserve what they typed" would write a
    // live credential into the page source and into React's action state; the
    // React 19 form reset clearing both password fields is the correct
    // behaviour here, not a defect to work around.
    return { status: "invalid", fieldErrors, submitted };
  }
  const fields = parsed.data;

  let signedInEmail: string | null = null;
  let signInFailedFor: string | null = null;

  try {
    const db = createAdminClient();
    const now = new Date();

    // Its own throttle bucket, disjoint from check-in's and /lookup's — see
    // hashClientIp's `scope`. Fails open, like every other caller: a throttle
    // bug must not be what stops a new officer from getting access.
    const limited = await checkRateLimit(
      db,
      await hashClientIp("invite"),
      now,
      INVITE_RATE_LIMIT_MAX
    );
    if (limited === "limited") return { status: "rate_limited" };

    if (!isWellFormedToken(fields.token)) return { status: "unknown" };

    const { data: invite, error: readError } = await db
      .from("officer_invites")
      .select(
        "id, email, role, display_name, expires_at, claimed_at, accepted_at, revoked_at"
      )
      .eq("token_hash", hashInviteToken(fields.token))
      .maybeSingle();

    // 🔓 A failed READ is not a missing invite. Returning "unknown" here would
    // tell a legitimate new officer their link is invalid because a query
    // hiccuped — the Stage 8 phase 3 rule (an error rendered as an affirmative
    // absence), landing on the one screen where the person has no way to tell
    // the difference and no officer nearby to ask.
    if (readError) {
      console.error("invite lookup failed:", readError.message);
      return { status: "error" };
    }
    if (!invite) return { status: "unknown" };

    const state = inviteState(invite, now);
    if (state.kind !== "valid") {
      return {
        status: "unusable",
        reason: state,
        message: describeInviteState(state),
      };
    }

    // Re-checked here and not only in createInvite: an account can appear in the
    // 72 hours between the two, and `createUser` would otherwise fail AFTER the
    // claim below had already burned the invite.
    const existing = await findAccountByEmail(db, invite.email);
    if (existing.status === "error") return { status: "error" };
    if (existing.status === "found") {
      return { status: "already_registered", email: invite.email };
    }

    // === The claim. ========================================================
    //
    // ⚠️ This is the single-use guard AND the concurrency guard, and it is a
    // conditional UPDATE rather than the read-and-check above precisely because
    // the check above is racy on its own. Two people opening the same link at
    // the same moment both pass `inviteState`; exactly one of them updates a
    // row here, because Postgres serialises the two UPDATEs on the same tuple
    // and the second finds its predicate no longer true.
    //
    // It runs LAST among the preconditions on purpose. Everything that can be
    // rejected for a reason the caller can fix — a short password, a mismatched
    // confirmation, an expired link, an address that already has an account —
    // has already been rejected without spending the invite.
    //
    // 🪤 If a step BELOW this fails, the invite is burned and nothing was
    // granted. That is the deliberate failure direction: PostgREST has no
    // cross-statement transaction (the writeAudit gap, the commitMerge gap), so
    // one of the two must be true after a partial failure, and "the link stopped
    // working" is recoverable by re-inviting while "an account exists that
    // nobody authorised" is not.
    const { data: claimed, error: claimError } = await db
      .from("officer_invites")
      .update({ claimed_at: now.toISOString() })
      .eq("id", invite.id)
      .is("claimed_at", null)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .select("id, email, role, expires_at")
      .maybeSingle();

    if (claimError) {
      console.error("invite claim failed:", claimError.message);
      return { status: "error" };
    }
    if (!claimed) {
      // Somebody else claimed it in the last few milliseconds.
      const reason: InviteState = { kind: "stalled" };
      return {
        status: "unusable",
        reason,
        message: describeInviteState(reason),
      };
    }

    const { data: created, error: createError } =
      await db.auth.admin.createUser({
        email: claimed.email,
        password: fields.password,
        // No confirmation mail, for the reason scripts/create-officer.mjs:69-71
        // gives: the built-in sender is capped at 2 emails/hour and is not for
        // production use. The invite link IS the proof of address — an officer
        // sent it to them.
        email_confirm: true,
      });

    if (createError || !created?.user) {
      console.error(
        "invite createUser failed:",
        createError?.message ?? "no user returned"
      );
      // Lost the race to a signup between the check above and here.
      if (/already been registered|email_exists/i.test(createError?.message ?? "")) {
        return { status: "already_registered", email: claimed.email };
      }
      return { status: "error" };
    }

    const userId = created.user.id;

    // 🔓 The role comes from the INVITE ROW. Not from the form, which has no
    // such field, and not from a default.
    const { data: profile, error: profileError } = await db
      .from("admin_profiles")
      .insert({
        user_id: userId,
        display_name: fields.displayName,
        role: claimed.role,
      })
      .select(AUDITED_OFFICER_COLUMNS)
      .single();

    if (profileError) {
      // The account exists and holds no access — which is precisely the state
      // /admin/officers renders under "no access", so the recovery is an officer
      // clicking Restore rather than anything bespoke. Nothing is granted in the
      // meantime: a valid session with no admin_profiles row is not an officer
      // (lib/auth.ts:60-63).
      console.error("invite profile insert failed:", profileError.message);
      return { status: "error" };
    }

    const { error: acceptError } = await db
      .from("officer_invites")
      .update({ accepted_at: now.toISOString(), accepted_user: userId })
      .eq("id", claimed.id);

    if (acceptError) {
      // Access has already been granted, so this is not worth failing on — the
      // invite is claimed, which means it cannot be redeemed again either way.
      // Log loudly, same contract as writeAudit.
      console.error("invite accept mark failed:", acceptError.message);
    }

    // Two rows under two entity types: the invite's history says it was
    // redeemed, the officer's says access was granted. The actor for both is the
    // new account — it exists now, admin_audit.actor_id is a FK to auth.users,
    // and attributing the act to the person who performed it is more honest than
    // borrowing the inviter's id for something they did not do.
    await writeAudit(db, {
      entityType: "officer_invite",
      entityId: claimed.id,
      actorId: userId,
      action: "invite.accepted",
      note: claimed.email,
    });
    await writeAudit(db, {
      entityType: "officer",
      entityId: userId,
      actorId: userId,
      action: "officer.access_granted",
      after: profile,
      note: `${claimed.email} accepted an invite as ${claimed.role}`,
    });

    // Sign them straight in rather than bouncing to the login form: they chose
    // the password one field ago, and asking for it again reads as though
    // something went wrong. The ANON SSR client, not the service role — cookie
    // writes work in a Server Action, which is the same reason
    // app/actions/auth.ts:9-12 gives.
    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: claimed.email,
      password: fields.password,
    });

    if (signInError) {
      console.error("invite auto sign-in failed:", signInError.message);
      signInFailedFor = claimed.email;
    } else {
      signedInEmail = claimed.email;
    }
  } catch (e) {
    console.error(
      "acceptInvite failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }

  if (signInFailedFor) {
    return { status: "created_sign_in_failed", email: signInFailedFor };
  }

  // Outside the try/catch, always: redirect() signals by throwing a
  // NEXT_REDIRECT control-flow exception and a catch block would swallow it into
  // a generic error — with the officer already created, which is the worst
  // possible moment to report a failure.
  if (signedInEmail) redirect("/admin");

  return { status: "error" };
}

function echoField(value: FormDataEntryValue | null, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

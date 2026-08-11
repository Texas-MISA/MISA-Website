import { readFileSync } from "node:fs";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  describeExpiry,
  hashInviteToken,
  INVITE_TTL_HOURS,
  inviteExpiry,
  inviteState,
  isWellFormedToken,
  MIN_OFFICER_PASSWORD,
  mintInviteToken,
  tokenHashEquals,
} from "@/lib/officer-invites";
import { AUDITED_OFFICER_COLUMNS } from "@/lib/officer-roster";
import {
  inviteAcceptSchema,
  inviteCreateSchema,
  openInviteEmailSchema,
} from "@/lib/validation";

import { anonClient, getTestOfficer, testClient } from "./helpers";

// Officer invite links (migration 24).
//
// ⚠️ Like member-merge-actions, dues-actions and member-actions, this does NOT
// call the `"use server"` exports — they need a request context. The integration
// block reproduces the exact statement sequence acceptInvite runs, which is what
// lets the single-use and concurrency guarantees be proved against real Postgres
// rather than argued.
//
// 🔓 The security properties this file exists to pin, in order of how badly they
// would fail if they broke:
//
//   1. The token never reaches the database. If it did, every reader of this
//      table would hold a live credential.
//   2. Redemption is single-use, enforced by a conditional UPDATE rather than a
//      read-then-check — so two people opening one link cannot both get in.
//   3. The redeemer cannot choose their own role. Asserted behaviourally, by
//      showing the schema DISCARDS a posted role, rather than by reading the
//      action's source.
//
// Fixtures own the marker `t3qinv`, and every invite row is deleted in teardown.
// ⚠️ Accounts created by an accepted invite are NOT deleted, for the reason
// helpers.ts gives about the officer fixture: admin_audit.actor_id references
// auth.users with no cascade and audit rows cannot be deleted (P0001), so an
// account that has acted is permanently undeletable. That is safe only because
// the local stack is disposable and global-setup.ts refuses a non-local URL.

const MARKER = "t3qinv";
let seq = 0;
const inviteEmail = () => `${MARKER}${seq++}.${Date.now() % 100000}@example.edu`;

describe("the invite token", () => {
  it("is 43 url-safe characters and unique per call", () => {
    const first = mintInviteToken();
    const second = mintInviteToken();

    expect(first).toHaveLength(43);
    expect(isWellFormedToken(first)).toBe(true);
    expect(first).not.toBe(second);
    // base64url only: a `+`, `/` or `=` would need percent-encoding in a path
    // segment, and the two sides would eventually disagree about whether it had
    // been applied.
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("hashes to something that is not the token", () => {
    const token = mintInviteToken();
    const hash = hashInviteToken(token);

    // The property the whole design rests on: what is stored cannot be replayed.
    expect(hash).not.toBe(token);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Deterministic, or a redemption could never find its own row.
    expect(hashInviteToken(token)).toBe(hash);
  });

  it("rejects tokens that are not the right shape", () => {
    expect(isWellFormedToken("")).toBe(false);
    expect(isWellFormedToken("short")).toBe(false);
    expect(isWellFormedToken("a".repeat(42))).toBe(false);
    expect(isWellFormedToken("a".repeat(44))).toBe(false);
    // 43 characters, but one of them cannot come out of base64url.
    expect(isWellFormedToken(`${"a".repeat(42)}+`)).toBe(false);
  });

  it("compares hashes without leaking length mismatches as a throw", () => {
    const hash = hashInviteToken(mintInviteToken());
    expect(tokenHashEquals(hash, hash)).toBe(true);
    expect(tokenHashEquals(hash, hashInviteToken(mintInviteToken()))).toBe(false);
    // timingSafeEqual throws on differing lengths; the wrapper must not.
    expect(tokenHashEquals(hash, "abc")).toBe(false);
  });
});

describe("invite liveness", () => {
  const now = new Date("2026-08-10T12:00:00Z");
  const live = {
    expires_at: "2026-08-12T12:00:00Z",
    claimed_at: null,
    accepted_at: null,
    revoked_at: null,
  };

  it("is valid while unclaimed and unexpired", () => {
    expect(inviteState(live, now).kind).toBe("valid");
  });

  it("expires at the boundary, not after it", () => {
    // Half-open, matching every other window in this codebase: the instant it
    // expires, it is expired.
    const atBoundary = { ...live, expires_at: now.toISOString() };
    expect(inviteState(atBoundary, now).kind).toBe("expired");

    const oneMsLeft = {
      ...live,
      expires_at: new Date(now.getTime() + 1).toISOString(),
    };
    expect(inviteState(oneMsLeft, now).kind).toBe("valid");
  });

  it("reports a claimed-but-unaccepted invite as stalled, not valid", () => {
    // The burned-invite case. It must never read as usable — the claim is what
    // makes redemption single-use, so a stalled row has already spent its use.
    const stalled = { ...live, claimed_at: "2026-08-10T11:00:00Z" };
    expect(inviteState(stalled, now).kind).toBe("stalled");
  });

  it("ranks revoked over accepted over stalled over expired", () => {
    // Precedence matters when several are true at once, and the order is a
    // product decision rather than an accident: an officer's explicit
    // withdrawal outranks everything, and "you already have an account"
    // outranks the clock.
    const everything = {
      expires_at: "2026-08-01T00:00:00Z",
      claimed_at: "2026-08-01T00:00:00Z",
      accepted_at: "2026-08-01T00:00:00Z",
      revoked_at: "2026-08-01T00:00:00Z",
    };
    expect(inviteState(everything, now).kind).toBe("revoked");
    expect(inviteState({ ...everything, revoked_at: null }, now).kind).toBe(
      "accepted"
    );
    expect(
      inviteState({ ...everything, revoked_at: null, accepted_at: null }, now)
        .kind
    ).toBe("stalled");
    expect(
      inviteState(
        { ...everything, revoked_at: null, accepted_at: null, claimed_at: null },
        now
      ).kind
    ).toBe("expired");
  });

  it("expires 72 hours out", () => {
    const expires = inviteExpiry(now);
    expect(expires.getTime() - now.getTime()).toBe(
      INVITE_TTL_HOURS * 60 * 60 * 1000
    );
    expect(describeExpiry(expires.toISOString(), now)).toBe("in 3 days");
    expect(describeExpiry(now.toISOString(), now)).toBe("expired");
  });
});

describe("what a redeemer is allowed to send", () => {
  it("🔓 DISCARDS a posted role and a posted email", () => {
    // The single most important assertion in this file. A redeemer who edits
    // the DOM (or hand-rolls the POST) to add `role=admin` must not become an
    // admin. The guarantee is structural rather than a check: the schema has no
    // `role` key, so there is nothing to parse and nothing for the action to
    // read even by mistake — it takes the role off the stored invite row.
    const parsed = inviteAcceptSchema.parse({
      token: mintInviteToken(),
      displayName: "Mallory",
      password: "correct horse battery",
      confirmPassword: "correct horse battery",
      role: "admin",
      email: "somebody.else@example.edu",
    });

    expect(parsed).not.toHaveProperty("role");
    // Same for the email. ⚠️ Since migration 25 an invite MAY be open, and the
    // redeemer then supplies an address — but through openInviteEmailSchema
    // below, never through this one. Keeping the key out of here is what makes
    // the pinned path structurally safe: there is no parsed email in scope for
    // the action to reach for, so "use the row's address" is not a rule anybody
    // has to remember.
    expect(parsed).not.toHaveProperty("email");
  });

  it("accepts a redeemer's address only through the open-invite schema", () => {
    const parsed = openInviteEmailSchema.parse({
      email: "  New.Officer@Example.EDU  ",
    });
    // Folded, like every other address in this system.
    expect(parsed.email).toBe("new.officer@example.edu");

    expect(openInviteEmailSchema.safeParse({ email: "" }).success).toBe(false);
    expect(openInviteEmailSchema.safeParse({ email: "nope" }).success).toBe(
      false
    );
  });

  it("refuses a short password and a mismatched confirmation", () => {
    const short = inviteAcceptSchema.safeParse({
      token: mintInviteToken(),
      displayName: "Sam",
      password: "a".repeat(MIN_OFFICER_PASSWORD - 1),
      confirmPassword: "a".repeat(MIN_OFFICER_PASSWORD - 1),
    });
    expect(short.success).toBe(false);

    const mismatch = inviteAcceptSchema.safeParse({
      token: mintInviteToken(),
      displayName: "Sam",
      password: "correct horse battery",
      confirmPassword: "correct horse batteries",
    });
    expect(mismatch.success).toBe(false);
    // Reported against the confirm field, so the message lands next to the
    // input the person needs to fix.
    expect(mismatch.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("refuses a malformed token before any lookup happens", () => {
    const result = inviteAcceptSchema.safeParse({
      token: "not-a-real-token",
      displayName: "Sam",
      password: "correct horse battery",
      confirmPassword: "correct horse battery",
    });
    expect(result.success).toBe(false);
  });

  it("folds the invited address to lower case", () => {
    // What lets createInvite's supersede be a plain .eq() rather than an
    // .ilike() — which would treat `_` in a local part as a wildcard and revoke
    // the wrong person's invite.
    const parsed = inviteCreateSchema.parse({
      email: "  New.Officer@Example.EDU  ",
      role: "officer",
      displayName: "  ",
    });
    expect(parsed.email).toBe("new.officer@example.edu");
    // Blank means "they fill it in", which is null rather than "".
    expect(parsed.displayName).toBeNull();
  });

  it("🔓 treats a blank invite address as an OPEN invite, not an error", () => {
    // Migration 25. Blank is a deliberate choice by the officer, so it parses
    // to null rather than "" — the column is nullable and null is what the rest
    // of the system reads as "anyone with the link".
    const open = inviteCreateSchema.parse({
      email: "   ",
      role: "officer",
      displayName: "",
    });
    expect(open.email).toBeNull();

    // A non-blank value still has to be a real address — "optional" must not
    // become "unvalidated", or a typo'd address would silently produce an open
    // invite instead of failing.
    const typo = inviteCreateSchema.safeParse({
      email: "not-an-address",
      role: "officer",
      displayName: "",
    });
    expect(typo.success).toBe(false);
  });

  it("refuses a role that is not one of the two", () => {
    const result = inviteCreateSchema.safeParse({
      email: "x@example.edu",
      role: "superuser",
      displayName: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("officer_invites against real Postgres", () => {
  const db = testClient();
  const anon = anonClient();
  let officerId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    officerId = await getTestOfficer(db);
  });

  afterAll(async () => {
    await db.from("officer_invites").delete().like("email", `${MARKER}%`);
  });

  async function insertInvite(
    overrides: Partial<{
      email: string;
      role: string;
      expires_at: string;
      token: string;
    }> = {}
  ) {
    const token = overrides.token ?? mintInviteToken();
    const { data, error } = await db
      .from("officer_invites")
      .insert({
        email: overrides.email ?? inviteEmail(),
        role: overrides.role ?? "officer",
        token_hash: hashInviteToken(token),
        expires_at:
          overrides.expires_at ?? inviteExpiry(new Date()).toISOString(),
        created_by: officerId,
      })
      .select("id, email, role, expires_at")
      .single();
    if (error) throw new Error(`invite fixture failed: ${error.message}`);
    createdIds.push(data.id);
    return { ...data, token };
  }

  /** The exact conditional UPDATE acceptInvite uses to claim an invite. */
  async function claim(id: string) {
    const { data, error } = await db
      .from("officer_invites")
      .update({ claimed_at: new Date().toISOString() })
      .eq("id", id)
      .is("claimed_at", null)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .select("id, email, role")
      .maybeSingle();
    if (error) throw new Error(`claim failed: ${error.message}`);
    return data;
  }

  it("🔓 stores no part of the token", async () => {
    const invite = await insertInvite();

    const { data } = await db
      .from("officer_invites")
      .select("*")
      .eq("id", invite.id)
      .single();

    const serialized = JSON.stringify(data);
    // The whole point: nothing in this row can be replayed as a link. Checked
    // over the ENTIRE row rather than over token_hash, so a future column that
    // happens to carry the token fails here.
    expect(serialized).not.toContain(invite.token);
    expect(data!.token_hash).toBe(hashInviteToken(invite.token));
  });

  it("🔓 is found by hash, so the token is the only way in", async () => {
    const invite = await insertInvite();

    const { data: found } = await db
      .from("officer_invites")
      .select("id")
      .eq("token_hash", hashInviteToken(invite.token))
      .maybeSingle();
    expect(found?.id).toBe(invite.id);

    // A different token cannot reach it.
    const { data: missed } = await db
      .from("officer_invites")
      .select("id")
      .eq("token_hash", hashInviteToken(mintInviteToken()))
      .maybeSingle();
    expect(missed).toBeNull();
  });

  it("🔓 can be claimed exactly once", async () => {
    const invite = await insertInvite();

    expect(await claim(invite.id)).not.toBeNull();
    // The second attempt updates ZERO rows. This is the single-use guarantee,
    // and it is a property of the predicate rather than of the application
    // remembering to check.
    expect(await claim(invite.id)).toBeNull();
  });

  it("🔓 survives two simultaneous redemptions", async () => {
    const invite = await insertInvite();

    // Both read the invite as valid, then both try to claim. Postgres
    // serialises the two UPDATEs on the same tuple, so the second re-evaluates
    // its predicate against the first's result and matches nothing.
    const [first, second] = await Promise.all([
      claim(invite.id),
      claim(invite.id),
    ]);

    const winners = [first, second].filter(Boolean);
    expect(winners).toHaveLength(1);
  });

  it("cannot be claimed once revoked", async () => {
    const invite = await insertInvite();
    await db
      .from("officer_invites")
      .update({ revoked_at: new Date().toISOString(), revoked_by: officerId })
      .eq("id", invite.id);

    expect(await claim(invite.id)).toBeNull();
  });

  it("cannot be claimed once accepted", async () => {
    const invite = await insertInvite();
    const now = new Date().toISOString();
    await db
      .from("officer_invites")
      .update({ claimed_at: now, accepted_at: now, accepted_user: officerId })
      .eq("id", invite.id);

    expect(await claim(invite.id)).toBeNull();
  });

  it("refuses a half-set acceptance pair", async () => {
    const invite = await insertInvite();

    // accepted_at without accepted_user: a state no screen could render
    // honestly, so the database is where it stops being possible.
    const { error: halfAccept } = await db
      .from("officer_invites")
      .update({ claimed_at: new Date().toISOString(), accepted_at: new Date().toISOString() })
      .eq("id", invite.id);
    expect(halfAccept?.code).toBe("23514");

    // accepted without ever being claimed: the ordering acceptInvite relies on.
    const { error: unclaimed } = await db
      .from("officer_invites")
      .update({
        accepted_at: new Date().toISOString(),
        accepted_user: officerId,
      })
      .eq("id", invite.id);
    expect(unclaimed?.code).toBe("23514");

    // revoked_at without revoked_by.
    const { error: halfRevoke } = await db
      .from("officer_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", invite.id);
    expect(halfRevoke?.code).toBe("23514");
  });

  it("refuses a token_hash that is not a sha256 digest", async () => {
    const { error } = await db.from("officer_invites").insert({
      email: inviteEmail(),
      role: "officer",
      // Length 5 — the shape of somebody storing the token, or a truncation.
      token_hash: "abcde",
      expires_at: inviteExpiry(new Date()).toISOString(),
      created_by: officerId,
    });
    expect(error?.code).toBe("23514");
  });

  it("refuses a role outside the two", async () => {
    const { error } = await db.from("officer_invites").insert({
      email: inviteEmail(),
      role: "superuser",
      token_hash: hashInviteToken(mintInviteToken()),
      expires_at: inviteExpiry(new Date()).toISOString(),
      created_by: officerId,
    });
    expect(error?.code).toBe("23514");
  });

  it("🔓 accepts an OPEN invite with no address, and records who used it", async () => {
    // Migration 25. The null is the information while the link is live: it says
    // "anyone with this" rather than naming a recipient.
    const token = mintInviteToken();
    const { data: open, error } = await db
      .from("officer_invites")
      .insert({
        email: null,
        role: "officer",
        token_hash: hashInviteToken(token),
        expires_at: inviteExpiry(new Date()).toISOString(),
        created_by: officerId,
      })
      .select("id, email, role")
      .single();

    expect(error).toBeNull();
    expect(open!.email).toBeNull();
    createdIds.push(open!.id);

    // It is claimable exactly like a pinned one — the single-use guard does not
    // depend on the address.
    expect(await claim(open!.id)).not.toBeNull();
    expect(await claim(open!.id)).toBeNull();

    // 🔓 The role is still pinned. An open invite lets the holder choose who
    // they are, never what they may do — which is the property that makes the
    // looser address rule survivable.
    expect(open!.role).toBe("officer");

    // acceptInvite writes the redeemed address back, so the row answers "who did
    // this link let in?" without going to admin_audit.
    const redeemed = `${MARKER}.open.${Date.now() % 100000}@example.edu`;
    await db
      .from("officer_invites")
      .update({
        accepted_at: new Date().toISOString(),
        accepted_user: officerId,
        email: redeemed,
      })
      .eq("id", open!.id);

    const { data: after } = await db
      .from("officer_invites")
      .select("email, claimed_at, accepted_at, revoked_at, expires_at")
      .eq("id", open!.id)
      .single();

    expect(after!.email).toBe(redeemed);
    expect(inviteState(after!, new Date()).kind).toBe("accepted");
  });

  it("🔓 is unreadable by the anon role", async () => {
    await insertInvite();

    // RLS is enabled with zero policies, so this comes back empty rather than
    // erroring — which is exactly what "deny-all is the end state" looks like
    // from the outside. If a policy is ever added here, this goes red and
    // whoever added it has to justify a reader.
    const { data, error } = await anon
      .from("officer_invites")
      .select("token_hash");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("🔓 cannot be written by the anon role", async () => {
    // Asserts 42501 specifically, not merely "an error came back": a payload
    // that trips NOT NULL first would return 23502 and pass a check for "some
    // error", straight through a wide-open grant. Migration 22 narrowed anon to
    // SELECT, so the permission gate is what answers here.
    const { error } = await anon.from("officer_invites").insert({
      email: `${MARKER}anon@example.edu`,
      role: "admin",
      token_hash: hashInviteToken(mintInviteToken()),
      expires_at: inviteExpiry(new Date()).toISOString(),
      created_by: officerId,
    });

    expect(error?.code).toBe("42501");
  });
});

describe("granting and removing access", () => {
  // The statement sequences revokeOfficerAccess and restoreOfficerAccess run.
  // ⚠️ The fixture officer is NOT used here — it is shared across the suite and
  // removing its admin_profiles row would break every file that assumes it has
  // one. A throwaway account is created instead, and it is left behind for the
  // reason at the top of this file.
  const db = testClient();
  let userId: string;
  const email = `${MARKER}.access.${Date.now() % 100000}@example.edu`;

  beforeAll(async () => {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: "a-long-enough-local-test-password",
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(`access fixture failed: ${error?.message}`);
    }
    userId = data.user.id;
  });

  afterAll(async () => {
    await db.from("admin_profiles").delete().eq("user_id", userId);
    // The account itself is deletable only while it has written no audit rows,
    // which is true here — nothing in this block writes any.
    await db.auth.admin.deleteUser(userId);
  });

  it("grants access by inserting a profile, and is idempotent by refusal", async () => {
    const { data: granted, error } = await db
      .from("admin_profiles")
      .insert({ user_id: userId, display_name: "Temp", role: "officer" })
      .select(AUDITED_OFFICER_COLUMNS)
      .single();

    expect(error).toBeNull();
    expect(granted?.role).toBe("officer");

    // A second grant collides on the primary key rather than silently
    // duplicating — which is what restoreOfficerAccess's pre-check turns into
    // the "nothing to change" state.
    const { error: again } = await db
      .from("admin_profiles")
      .insert({ user_id: userId, display_name: "Temp", role: "admin" });
    expect(again?.code).toBe("23505");
  });

  it("🔓 removes access WITHOUT deleting the account", async () => {
    const { data: before, error } = await db
      .from("admin_profiles")
      .delete()
      .eq("user_id", userId)
      .select(AUDITED_OFFICER_COLUMNS)
      .maybeSingle();

    expect(error).toBeNull();
    expect(before?.user_id).toBe(userId);

    // The whole point of revoking rather than deleting: admin_audit.actor_id and
    // point_adjustments.awarded_by reference auth.users with no cascade, so the
    // account must survive or the history naming them either blocks the delete
    // or goes with it.
    const { data: account } = await db.auth.admin.getUserById(userId);
    expect(account?.user?.id).toBe(userId);

    // Zero rows on a second attempt — the "nothing to change" state, and the
    // reason the action uses a returning delete rather than read-then-delete.
    const { data: second } = await db
      .from("admin_profiles")
      .delete()
      .eq("user_id", userId)
      .select(AUDITED_OFFICER_COLUMNS)
      .maybeSingle();
    expect(second).toBeNull();
  });
});

describe("withdrawing an invite", () => {
  const db = testClient();
  let officerId: string;

  beforeAll(async () => {
    officerId = await getTestOfficer(db);
  });

  afterAll(async () => {
    await db.from("officer_invites").delete().like("email", `${MARKER}%`);
  });

  /** The conditional update revokeInvite runs. */
  async function revoke(id: string) {
    const { data, error } = await db
      .from("officer_invites")
      .update({ revoked_at: new Date().toISOString(), revoked_by: officerId })
      .eq("id", id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .select("id, email")
      .maybeSingle();
    if (error) throw new Error(`revoke failed: ${error.message}`);
    return data;
  }

  it("withdraws once, then reports nothing to do", async () => {
    const token = mintInviteToken();
    const { data: invite } = await db
      .from("officer_invites")
      .insert({
        email: `${MARKER}.wd.${Date.now() % 100000}@example.edu`,
        role: "officer",
        token_hash: hashInviteToken(token),
        expires_at: inviteExpiry(new Date()).toISOString(),
        created_by: officerId,
      })
      .select("id")
      .single();

    expect(await revoke(invite!.id)).not.toBeNull();
    // Second click, or two officers at once: zero rows, which the action
    // reports as "already gone" rather than claiming a second withdrawal.
    expect(await revoke(invite!.id)).toBeNull();

    // And the link is dead: inviteState agrees with the database.
    const { data: after } = await db
      .from("officer_invites")
      .select("expires_at, claimed_at, accepted_at, revoked_at")
      .eq("id", invite!.id)
      .single();
    expect(inviteState(after!, new Date()).kind).toBe("revoked");
  });

  it("🔓 cannot withdraw an invite that was already accepted", async () => {
    // The race that matters: a revoke landing after a redemption must not
    // produce a revoked row whose account already exists.
    const token = mintInviteToken();
    const now = new Date().toISOString();
    const { data: invite } = await db
      .from("officer_invites")
      .insert({
        email: `${MARKER}.acc.${Date.now() % 100000}@example.edu`,
        role: "officer",
        token_hash: hashInviteToken(token),
        expires_at: inviteExpiry(new Date()).toISOString(),
        created_by: officerId,
        claimed_at: now,
        accepted_at: now,
        accepted_user: officerId,
      })
      .select("id")
      .single();

    expect(await revoke(invite!.id)).toBeNull();
  });
});

describe("the shape of the invite actions", () => {
  // Source assertions, for properties that are decisions rather than behaviour
  // — the same instrument tests/dues.test.ts and tests/members.ts use for the
  // controlled-select rule. These cannot be exercised from here (the exports
  // need a request context), and each one is a rule somebody could quietly
  // reverse while every behavioural test stayed green.
  const acceptSource = readFileSync("app/actions/officer-invite.ts", "utf8");
  const inviteSource = readFileSync("app/actions/invites.ts", "utf8");

  it("🔓 takes the role from the invite row, never from the form", () => {
    expect(acceptSource).toContain("role: claimed.role");
    // The form's FormData is never consulted for a role.
    expect(acceptSource).not.toMatch(/formData\.get\(["']role["']\)/);
  });

  it("🔓 takes the email from the invite row whenever one is pinned", () => {
    // ⚠️ This assertion CHANGED with migration 25 and is weaker than it was, so
    // it is worth being explicit about what it still guarantees.
    //
    // It used to be "the form is never consulted for an address, full stop".
    // An open invite has to consult it. What survives — and what this pins — is
    // that the two paths are structurally separate: the pinned branch assigns
    // straight off the row, and the form is only read inside a branch that is
    // reachable only when the row pinned nothing.
    expect(acceptSource).toContain("targetEmail = invite.email");
    expect(acceptSource).toContain("if (invite.email !== null)");
    expect(acceptSource).toContain("openInviteEmailSchema.safeParse");

    // The account is always created from the RESOLVED value. If this ever reads
    // straight from the form, the pinned guarantee is gone.
    expect(acceptSource).toContain("email: targetEmail");
    expect(acceptSource).not.toMatch(/email:\s*fields\.email/);
  });

  it("claims before creating the account", () => {
    // The ordering is a recovery property: a failure after the claim burns the
    // invite and grants nothing, which is the safe direction. Reversing these
    // two would leave an account with no access and a still-live invite that
    // can never be redeemed.
    const claimAt = acceptSource.indexOf(".update({ claimed_at");
    const createAt = acceptSource.indexOf("auth.admin.createUser");
    expect(claimAt).toBeGreaterThan(-1);
    expect(createAt).toBeGreaterThan(-1);
    expect(claimAt).toBeLessThan(createAt);
  });

  it("🔓 never echoes a password back into action state", () => {
    // React 19 resets the form after an action resolves, and the house rule is
    // to echo submitted values so nothing is lost. Passwords are the exception:
    // echoing one writes a live credential into the page source.
    expect(acceptSource).not.toMatch(/password:\s*echoField/);
    expect(acceptSource).toContain("displayName: echoField");
  });

  it("refuses self-revocation", () => {
    // The guard that makes locking the whole team out unreachable from the UI.
    expect(inviteSource).toContain('return { status: "self" }');
    expect(inviteSource).toContain("userId === officer.userId");
  });

  it("carries no role gate, deliberately (§9 #13)", () => {
    // Nothing in this codebase branches on admin_profiles.role, and these files
    // must not become the first thing that does — the audit log is the control.
    // A `role === "admin"` here would be a policy change wearing a bug fix's
    // clothes.
    expect(inviteSource).not.toMatch(/officer\.role\s*===/);
    expect(acceptSource).not.toMatch(/officer\.role\s*===/);
  });
});

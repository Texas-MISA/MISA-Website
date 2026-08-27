import type { Metadata } from "next";

import { Notice, ReadError } from "@/app/admin/(shell)/_components/notice";
import { requireOfficer } from "@/lib/auth";
import { formatInstant } from "@/lib/events";
import { describeExpiry, inviteState } from "@/lib/officer-invites";
import {
  fetchOfficerRoster,
  fetchRecentInvites,
  type InviteRow,
} from "@/lib/officer-roster";
import { createAdminClient } from "@/lib/supabase/admin";

import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { InviteCreateForm } from "./_components/invite-create-form";
import {
  RestoreAccessButton,
  RevokeAccessButton,
  RevokeInviteButton,
} from "./_components/officer-controls";

// Officer turnover (§2.3, migration 24). Who can sign in, who used to be able
// to, and which invitations are outstanding.
//
// This is the screen that replaces scripts/create-officer.mjs for everyday use.
// The script stays — it is the bootstrap path on a fresh project and the
// recovery path when nobody can sign in at all — but adding next year's
// treasurer should not require a checkout and the production service role key.
//
// 🔓 Any officer may do everything here, including granting officer access
// (§9 #13). That follows §9 #6/#9/#10 — the audit log is the control, not a role
// gate — and it is applied to privilege for the first time, deliberately. The
// one refusal is revoking your own access, which is what makes locking the whole
// team out unreachable from this page; see revokeOfficerAccess.

export const metadata: Metadata = { title: "Officers" };

// Every row here is a live authorization fact, and a stale one is the kind that
// gets acted on — an officer revoking access wants to see it gone.
export const dynamic = "force-dynamic";

export default async function OfficersPage() {
  const officer = await requireOfficer();

  const db = createAdminClient();
  const [rosterResult, invitesResult] = await Promise.all([
    fetchOfficerRoster(db),
    fetchRecentInvites(db),
  ]);

  const now = new Date();

  // 🔓 Both reads get a third branch. "No officers" and "no pending invites"
  // are affirmative claims about who can get into this system, and rendering
  // either one for a FAILED read is the phase-3 defect landing on the access
  // control screen — an officer would conclude access had been lost, or that
  // an invite they just sent was never created.
  const roster = rosterResult.ok ? rosterResult.roster : null;
  const invites = invitesResult.ok ? invitesResult.invites : null;

  const pending = invites?.filter(
    (invite) => inviteState(invite, now).kind === "valid"
  );
  const inactive = invites?.filter(
    (invite) => inviteState(invite, now).kind !== "valid"
  );

  return (
    <div className="space-y-12">
      <PageHeader
        title="Officers"
        description="Invite someone by sending them a link, or take access away when somebody leaves. Removing access keeps their account and everything they did — the audit trail still names them."
      />

      <section aria-labelledby="invite-heading">
        <SectionHeading id="invite-heading">
          Invite an officer
        </SectionHeading>
        <InviteCreateForm />
      </section>

      <section aria-labelledby="current-heading">
        <SectionHeading id="current-heading">
          Current officers
        </SectionHeading>

        {roster === null ? (
          <ReadError what="the officer list" className="mt-4" />
        ) : roster.officers.length === 0 ? (
          // Unreachable in practice — you are reading this page, so you are one
          // — but an empty list is not an error and must not render as one.
          <Notice className="mt-4">No officers have access yet.</Notice>
        ) : (
          <ul className="mt-4 divide-y divide-misa-hairline border border-misa-hairline">
            {roster.officers.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-medium">
                    {entry.displayName ?? entry.email}
                    {entry.id === officer.userId ? (
                      <span className="ml-2 text-xs text-misa-muted">
                        (you)
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-misa-secondary">{entry.email}</p>
                  <p className="text-xs text-misa-muted">
                    {entry.role === "admin" ? "Admin" : "Officer"} · last signed
                    in{" "}
                    {entry.lastSignInAt
                      ? formatInstant(entry.lastSignInAt)
                      : "never"}
                  </p>
                </div>
                {entry.id === officer.userId ? (
                  <span className="text-xs text-misa-muted">
                    You can&apos;t remove your own access
                  </span>
                ) : (
                  <RevokeAccessButton
                    userId={entry.id}
                    label={entry.displayName ?? entry.email}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="pending-heading">
        <SectionHeading id="pending-heading">
          Outstanding invitations
        </SectionHeading>

        {invites === null ? (
          <ReadError what="the invitation list" className="mt-4" />
        ) : pending && pending.length === 0 ? (
          <Notice className="mt-4">
            No invitations are waiting to be used.
          </Notice>
        ) : (
          <ul className="mt-4 divide-y divide-misa-hairline border border-misa-hairline">
            {pending?.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  {/* 🔓 An open invite says what it is, in words. Rendering a
                      blank cell would make "anyone with this link can use it"
                      indistinguishable from a value that failed to load — and
                      that is exactly the difference an officer needs to see
                      before deciding how to send it. */}
                  <p className="font-medium">
                    {invite.email ?? "Anyone with the link"}
                  </p>
                  <p className="text-xs text-misa-muted">
                    {invite.role === "admin" ? "Admin" : "Officer"} · expires{" "}
                    {describeExpiry(invite.expires_at, now)}
                    {invite.email ? null : " · anyone who opens it can use it"}
                  </p>
                </div>
                <RevokeInviteButton
                  id={invite.id}
                  email={invite.email ?? "anyone with the link"}
                />
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 max-w-2xl text-xs text-misa-muted">
          The link is shown once, when you create it — nothing can display it
          again, because only a fingerprint of it is stored. If it goes missing,
          invite them again and the older link stops working.
        </p>
      </section>

      {inactive && inactive.length > 0 ? (
        <section aria-labelledby="history-heading">
          <SectionHeading id="history-heading">
            Past invitations
          </SectionHeading>
          <ul className="mt-4 divide-y divide-misa-hairline border border-misa-hairline">
            {inactive.slice(0, 15).map((invite) => (
              <li key={invite.id} className="px-4 py-3">
                {/* Once redeemed, an open invite's row names whoever used it —
                    acceptInvite writes the address back. Still null here means
                    it expired or was withdrawn before anyone did. */}
                <p className="text-sm">
                  {invite.email ?? "Anyone with the link"}
                </p>
                <p className="text-xs text-misa-muted">
                  {describeInviteOutcome(invite, now)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="noaccess-heading">
        <SectionHeading id="noaccess-heading">
          Accounts without access
        </SectionHeading>
        <p className="mt-2 max-w-2xl text-sm text-misa-secondary">
          Accounts that exist but can&apos;t get in — former officers, and anyone
          who signed up without being granted access. Giving one access needs no
          invitation: they already have a password.
        </p>

        {roster === null ? (
          <ReadError what="the account list" className="mt-4" />
        ) : roster.withoutAccess.length === 0 ? (
          <Notice className="mt-4">
            Every account on this project has officer access.
          </Notice>
        ) : (
          <ul className="mt-4 divide-y divide-misa-hairline border border-misa-hairline">
            {roster.withoutAccess.map((account) => (
              <li
                key={account.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{account.email}</p>
                  <p className="text-xs text-misa-muted">
                    account created {formatInstant(account.createdAt)}
                  </p>
                </div>
                <RestoreAccessButton
                  userId={account.id}
                  label={account.email}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Why a past invitation is no longer usable.
 *
 * Formatted here rather than in the client component, per the hydration
 * invariant — and it goes through `inviteState` like everything else, so the
 * history cannot describe a row differently from how the redemption page would.
 */
function describeInviteOutcome(invite: InviteRow, now: Date): string {
  const state = inviteState(invite, now);
  switch (state.kind) {
    case "accepted":
      return `used ${invite.accepted_at ? formatInstant(invite.accepted_at) : ""}`.trim();
    case "revoked":
      return `withdrawn ${invite.revoked_at ? formatInstant(invite.revoked_at) : ""}`.trim();
    case "stalled":
      return "started but never finished — no access was granted";
    case "expired":
      return `expired ${formatInstant(invite.expires_at)}`;
    case "valid":
      // Not reachable: this helper only ever sees non-valid rows. Handled so a
      // new state fails the build rather than rendering an empty line.
      return "still valid";
  }
}

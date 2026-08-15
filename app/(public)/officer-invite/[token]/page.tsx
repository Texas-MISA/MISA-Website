import type { Metadata } from "next";
import Link from "next/link";

import {
  describeInviteState,
  hashInviteToken,
  inviteState,
  isWellFormedToken,
} from "@/lib/officer-invites";
import { createAdminClient } from "@/lib/supabase/admin";

import { InviteForm } from "./_components/invite-form";

// Redeeming an officer invite (migration 24, §2.3 turnover).
//
// 🪤 Deliberately OUTSIDE /admin, and this is the reason rather than a filing
// preference: proxy.ts matches `/admin/:path*` and redirects anyone without a
// session to /admin/login. An invite page under /admin would be unreachable by
// the only people who will ever open it, and fixing that means adding
// exceptions to the one file whose header warns that short-circuiting it
// "disables session refresh with no error anywhere". Living out here, the
// feature needs no change to proxy.ts at all — and the route stays covered by
// the (public) layout's error boundary, which matters below.
//
// The other half of that decision: this page is not protected by anything
// except the token. That is correct — the recipient is not an officer yet, and
// the token is the whole of their authority — but it means the token is the
// only thing between a stranger and an officer account. Everything that
// enforces it lives in lib/officer-invites.ts and app/actions/officer-invite.ts.

export const metadata: Metadata = {
  title: "Officer invitation",
  // Not indexable, ever. The URL contains a live credential; a search engine
  // that crawled one would cache it, and §9 #1 establishes that a cached page is
  // the one privacy mistake this project cannot walk back. Nothing links here,
  // but "nothing links here" is not a robots policy.
  robots: { index: false, follow: false, nocache: true },
};

// The page reads a token out of the URL and its answer changes the moment an
// officer revokes the invite, so there is nothing here worth caching for even a
// second.
export const dynamic = "force-dynamic";

export default async function OfficerInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Rejected before any database work: this is the shape check, not the
  // security control. It costs one regex to absorb the truncated links that
  // chat clients produce.
  if (!isWellFormedToken(token)) return <Unusable message={UNKNOWN_MESSAGE} />;

  const db = createAdminClient();
  const { data: invite, error } = await db
    .from("officer_invites")
    .select("email, role, display_name, expires_at, claimed_at, accepted_at, revoked_at")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();

  // 🔓 THROWS rather than rendering "this invitation is not valid".
  //
  // This is the Stage 8 phase 3 rule at its sharpest. A failed read here would
  // tell somebody holding a perfectly good invite that their link is bad — and
  // unlike an officer looking at an empty list, they have no way to know better
  // and nobody to ask. The (public) error boundary says something broke, which
  // is the truth, and the link keeps working once it is fixed.
  if (error) {
    console.error("officer invite read failed:", error.message);
    throw new Error("Could not read the invitation");
  }

  // No row: a fabricated, mistyped or long-deleted token. Generic on purpose —
  // there is no reason to confirm to a guesser which 43-character strings are
  // absent from the table. A REAL invite gets a specific message below, because
  // its holder already has the secret and vagueness would only strand them.
  if (!invite) return <Unusable message={UNKNOWN_MESSAGE} />;

  const state = inviteState(invite, new Date());
  if (state.kind !== "valid") {
    return (
      <Unusable
        message={describeInviteState(state)}
        // Someone whose invite was already redeemed almost certainly wants the
        // login page, and saying so is more useful than a dead end.
        showSignIn={state.kind === "accepted"}
      />
    );
  }

  return (
    <section className="px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-[34px] leading-[1.02] font-semibold tracking-[-0.02em] sm:text-[42px]">
          Set up your officer account
        </h1>

        <InviteForm
          token={token}
          email={invite.email}
          // The inviter's suggestion, which the recipient may correct. Always a
          // string: a nullish defaultValue after a non-nullish one makes React
          // drop the value attribute, and the post-action reset then clears the
          // field.
          suggestedName={invite.display_name ?? ""}
        />
      </div>
    </section>
  );
}

const UNKNOWN_MESSAGE =
  "This invitation link is not valid. It may have been mistyped, or only part of it was copied — check you have the whole link, and ask an officer for a new one if you're not sure.";

function Unusable({
  message,
  showSignIn = false,
}: {
  message: string;
  showSignIn?: boolean;
}) {
  return (
    <section className="px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-[34px] leading-[1.02] font-semibold tracking-[-0.02em] sm:text-[42px]">
          This invitation can&apos;t be used
        </h1>
        <p className="mt-4 border-l-4 border-amber-700 bg-misa-panel px-4 py-3 text-sm">
          {message}
        </p>
        {showSignIn ? (
          <p className="mt-6 text-sm text-misa-muted">
            <Link
              href="/admin/login"
              className="text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
            >
              Go to the officer sign-in page
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { LookupForm } from "./_components/lookup-form";

// Member self-service (§7 Stage 7 phase 2). Two fields, no account — the
// member's own standing, their per-event breakdown, anything still pending,
// and their dues status. The page itself is a static shell; all the work
// happens in the lookupMember Server Action.
//
// 🔓 This is the only surface in the system that shows dues status to an
// unauthenticated caller, and it is allowed to because the gate is EID **and**
// matching email — strictly narrower than the EID-alone oracle §6 accepts for
// check-in. Do not relax the gate, and do not carry dues status anywhere
// reachable with less (§9 #1, #12).

export const metadata: Metadata = {
  title: "My Attendance",
  description: "Look up your own MISA attendance, points and dues status.",
  // Nothing here is crawlable in practice — the result exists only in response
  // to a POST — but the page is a member-data surface and the board it links
  // to must never be indexed, so it carries the same header rather than
  // relying on that. Same pattern as app/admin/(shell)/layout.tsx.
  robots: { index: false, follow: false },
};

export default function LookupPage() {
  return (
    <section className="px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          My Attendance
        </h1>
        <p className="mt-3 text-foreground/70">
          Enter your UT EID and the email we have on file, and you&apos;ll see
          where you stand this term — which events you attended, which you
          missed, anything still waiting on an officer, and whether your dues
          are paid.
        </p>
        <p className="mt-2 text-sm text-foreground/60">
          Both have to match the same member, which is why this shows more than{" "}
          <Link
            href="/leaderboard"
            className="text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
          >
            the leaderboard
          </Link>{" "}
          does.
        </p>
        <div className="mt-8">
          <LookupForm />
        </div>
      </div>
    </section>
  );
}

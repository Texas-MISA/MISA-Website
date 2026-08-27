import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/ui/chevron-section";
import { Section } from "@/components/ui/section";

import { LookupForm } from "./_components/lookup-form";

// Member self-service (§7 Stage 7 phase 2). Two fields, no account — the
// member's own standing, their per-event breakdown, anything still pending,
// and their dues status. The page itself is a static shell; all the work
// happens in the lookupMember Server Action.
//
// 🔴 This is the only surface in the system that shows dues status to an
// unauthenticated caller. It used to be allowed to because the gate was EID
// **and** matching email — strictly narrower than the EID-alone oracle §6
// accepts for check-in. **That gate was reduced to the EID alone on 2026-08-25
// at the officer's instruction, and dues status was kept**, so this page no
// longer rests on the argument that justified it. The reversal is recorded at
// findMemberByEid in lib/lookup.ts and in docs/invariants.md.
//
// ⚠️ What still holds: one message for every miss, and dues status must not be
// carried anywhere reachable with LESS than this (§9 #1, #12) — /leaderboard
// most of all.

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
    <>
      <PageHero
        title="My Attendance"
        subhead="Enter your UT EID and you'll see where you stand this term."
      />
      {/* 🪤 White for the same reason /attend is: the lookup form's controls
          fill with `bg-misa-panel`, which is now the page ground's own colour. */}
      <Section ground="white" pad="md" width="narrow">
        <p className="leading-[1.65] text-misa-body">
          You&apos;ll see which events you attended, which you missed, anything
          still waiting on an officer, and whether your dues are paid.
        </p>
        <p className="mt-2 text-sm text-misa-muted">
          Both have to match the same member, which is why this shows more than{" "}
          <Link
            href="/leaderboard"
            className="text-misa-blue underline hover:text-misa-blue-dark"
          >
            the leaderboard
          </Link>{" "}
          does.
        </p>
        <div className="mt-8">
          <LookupForm />
        </div>
      </Section>
    </>
  );
}

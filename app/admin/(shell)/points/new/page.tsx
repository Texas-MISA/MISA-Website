import type { Metadata } from "next";
import Link from "next/link";

import { requireOfficer } from "@/lib/auth";
import { fetchEventOptions } from "@/lib/event-options";
import { fetchMemberOptions } from "@/lib/member-options";
import { createAdminClient } from "@/lib/supabase/admin";

import { GrantForm } from "./_components/grant-form";

// Awarding points outside of attendance (§4.2). One grant covers any number of
// members — the info-booth case, where five people did the same thing for the
// same reason and typing it five times is how a reason ends up as "same as
// above".

export const metadata: Metadata = { title: "Grant points" };

export default async function NewGrantPage({
  searchParams,
}: {
  // Promise in Next 16 — await before reading.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOfficer();

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string" && value) query.set(key, value);
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const backToLedger = `/admin/points${suffix}`;

  const db = createAdminClient();
  const [events, members] = await Promise.all([
    fetchEventOptions(db),
    fetchMemberOptions(db),
  ]);

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
        Grant points
      </h1>

      <p className="mt-3 text-sm">
        <Link href={backToLedger} className="underline">
          ← Back to the ledger
        </Link>
      </p>

      <p className="mt-6 max-w-2xl text-sm text-foreground/70">
        For points that did not come from a check-in. Everyone picked here gets
        the same points, category, and reason, recorded as separate rows in the
        ledger under your name.
      </p>

      <div className="mt-8">
        <GrantForm
          members={members}
          events={events}
          returnTo={backToLedger}
        />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { ReadError } from "@/app/admin/(shell)/_components/notice";
import { requireOfficer } from "@/lib/auth";
import { fetchEventOptions } from "@/lib/event-options";
import { toCentralFields } from "@/lib/events";
import { fetchMemberOptions } from "@/lib/member-options";
import { createAdminClient } from "@/lib/supabase/admin";

import { ManualEntryForm } from "./_components/manual-entry-form";

// Officer-entered attendance (§4.2) — someone who was there and never used the
// form. `source = 'admin_manual'` keeps it distinguishable from a real check-in
// forever, which matters when reading the ledger back a year later.

export const metadata: Metadata = { title: "Add a check-in" };

export default async function NewAttendancePage({
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
  const backToQueue = `/admin/attendance${suffix}`;

  const [eventsResult, membersResult] = await Promise.all([
    fetchEventOptions(createAdminClient()),
    fetchMemberOptions(createAdminClient()),
  ]);
  // An empty picker and an unread one are different facts (Stage 8 phase 3).
  const events = eventsResult.kind === "ok" ? eventsResult.options : [];
  const members = membersResult.kind === "ok" ? membersResult.options : [];
  const optionsFailed =
    eventsResult.kind === "error" || membersResult.kind === "error";

  // Defaults computed on the server, in Central. A `new Date()` in the browser
  // would default to the officer's own zone, which is the wrong answer for
  // anyone travelling and a silent one.
  const now = toCentralFields(new Date());

  return (
    <div>
      {optionsFailed && (
        <ReadError
          what="the event and member lists, so the pickers below are empty"
          className="mb-6"
        />
      )}
      <h1 className="font-display text-[30px] leading-[1.02] font-semibold tracking-[-0.015em] sm:text-[34px]">
        Add a check-in
      </h1>

      <p className="mt-3 text-sm">
        <Link href={backToQueue} className="underline">
          ← Back to the queue
        </Link>
      </p>

      <p className="mt-6 max-w-2xl text-sm text-misa-secondary">
        For someone who attended but never submitted the form. This is recorded
        as present immediately, so it needs both an event and a member, and it
        stays marked as entered by an officer.
      </p>

      <div className="mt-8">
        <ManualEntryForm
          events={events}
          members={members}
          defaultDate={now.date}
          defaultTime={now.time}
          returnTo={backToQueue}
        />
      </div>
    </div>
  );
}

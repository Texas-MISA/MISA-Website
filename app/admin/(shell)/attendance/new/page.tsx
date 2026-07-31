import type { Metadata } from "next";
import Link from "next/link";

import { MEMBER_SCAN_LIMIT } from "@/lib/attendance";
import { requireOfficer } from "@/lib/auth";
import { fetchEventOptions } from "@/lib/event-options";
import { toCentralFields } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";

import type { MemberOption } from "../[id]/_components/resolution-form";

import { ManualEntryForm } from "./_components/manual-entry-form";

// Officer-entered attendance (§4.2) — someone who was there and never used the
// form. `source = 'admin_manual'` keeps it distinguishable from a real check-in
// forever, which matters when reading the ledger back a year later.

export const metadata: Metadata = { title: "Add a check-in" };

async function fetchMemberOptions(): Promise<MemberOption[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("members")
    .select("id, full_name, student_id, active")
    .eq("active", true)
    .order("full_name")
    .limit(MEMBER_SCAN_LIMIT);

  if (error) {
    console.error("member options query failed:", error.message);
    return [];
  }
  return data.map((member) => ({
    id: member.id,
    label: `${member.full_name} (${member.student_id})`,
    active: member.active,
  }));
}

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

  const [events, members] = await Promise.all([
    fetchEventOptions(createAdminClient()),
    fetchMemberOptions(),
  ]);

  // Defaults computed on the server, in Central. A `new Date()` in the browser
  // would default to the officer's own zone, which is the wrong answer for
  // anyone travelling and a silent one.
  const now = toCentralFields(new Date());

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
        Add a check-in
      </h1>

      <p className="mt-3 text-sm">
        <Link href={backToQueue} className="underline">
          ← Back to the queue
        </Link>
      </p>

      <p className="mt-6 max-w-2xl text-sm text-foreground/70">
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

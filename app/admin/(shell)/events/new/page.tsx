import type { Metadata } from "next";
import Link from "next/link";

import { requireOfficer } from "@/lib/auth";
import { toCentralFields } from "@/lib/events";

import { EventForm } from "../_components/event-form";

// Create a single event (§5). Recurring series get their own screen in the
// same section — this one stays deliberately simple, because most events are
// one-offs and the series form has a lot more to explain.

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage() {
  await requireOfficer();

  // Default to next week in Central, so the date field opens somewhere useful
  // rather than on 1970.
  const today = toCentralFields(new Date()).date;

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-[30px] leading-[1.02] font-semibold tracking-[-0.015em] sm:text-[34px]">
          New event
        </h1>
        <Link
          href="/admin/events/series"
          className="text-sm text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
        >
          Create a recurring series instead
        </Link>
      </div>

      <p className="mt-3 text-misa-body">
        Times are Central. Save as a draft to keep it officer-only, or publish
        it straight to the public schedule.
      </p>

      <div className="mt-8">
        <EventForm
          initial={{
            title: "",
            description: "",
            location: "",
            date: today,
            startTime: "18:00",
            endTime: "19:00",
            openEarlyMinutes: 15,
            closeLateMinutes: 15,
            points: 1,
            category: "general_meeting",
            status: "draft",
          }}
        />
      </div>
    </div>
  );
}

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
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          New event
        </h1>
        <Link
          href="/admin/events/series"
          className="text-sm text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
        >
          Create a recurring series instead
        </Link>
      </div>

      <p className="mt-3 text-foreground/80">
        Times are Central. New events start as drafts — nothing is public until
        you publish.
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

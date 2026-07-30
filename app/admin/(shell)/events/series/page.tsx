import type { Metadata } from "next";
import Link from "next/link";

import { requireOfficer } from "@/lib/auth";
import { toCentralFields } from "@/lib/events";

import { SeriesForm } from "./_components/series-form";

// Recurring series creation (§7 Stage 4). This is the feature that makes the
// stage worth its size: without it every weekly meeting is entered by hand,
// forever.

export const metadata: Metadata = { title: "New series" };

export default async function NewSeriesPage() {
  await requireOfficer();
  const today = toCentralFields(new Date()).date;

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          New recurring series
        </h1>
        <Link
          href="/admin/events/new"
          className="text-sm text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
        >
          Create a single event instead
        </Link>
      </div>

      <p className="mt-3 text-foreground/80">
        Every occurrence is created as a draft sharing one series, so you can
        review the whole schedule before any of it goes public. Times are
        Central and stay Central — a 6pm meeting is still 6pm after the
        November clock change.
      </p>

      <div className="mt-8">
        <SeriesForm defaultDate={today} />
      </div>
    </div>
  );
}

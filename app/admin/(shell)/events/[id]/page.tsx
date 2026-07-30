import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/auth";
import {
  formatEventRange,
  formatInstant,
  toCentralFields,
  windowOffsetsOf,
} from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";

import { EventForm } from "../_components/event-form";
import { EventStatusPill } from "../_components/event-table";
import { EventLifecycle } from "./_components/event-lifecycle";

// Edit one event, see who checked in, and move it through its lifecycle (§5).

export const metadata: Metadata = { title: "Event" };

type AttendanceRow = {
  id: string;
  submitted_name: string;
  submitted_student_id: string;
  submitted_at: string;
  status: string;
};

export default async function EventDetailPage({
  params,
}: {
  // Promise in Next 16 — await before reading.
  params: Promise<{ id: string }>;
}) {
  await requireOfficer();
  const { id } = await params;

  const db = createAdminClient();

  const { data: event, error } = await db
    .from("events")
    .select(
      "id, title, description, location, starts_at, ends_at, checkin_opens_at, checkin_closes_at, points, category, status, term, series_id"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("event detail query failed:", error.message);
  }
  if (!event) notFound();

  const { data: attendance } = await db
    .from("attendance")
    .select("id, submitted_name, submitted_student_id, submitted_at, status")
    .eq("event_id", id)
    .order("submitted_at", { ascending: true });

  const rows = (attendance ?? []) as AttendanceRow[];
  const fields = toCentralFields(event.starts_at);
  const endFields = toCentralFields(event.ends_at);
  const offsets = windowOffsetsOf(event);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          {event.title}
        </h1>
        <EventStatusPill status={event.status} />
      </div>
      <p className="mt-3 text-foreground/80">
        {formatEventRange(event.starts_at, event.ends_at)} Central ·{" "}
        {event.term} · {event.points}{" "}
        {event.points === 1 ? "point" : "points"}
      </p>
      {event.series_id && (
        <p className="mt-1 text-sm text-foreground/70">
          Part of a recurring series.{" "}
          <Link
            href={`/admin/events?series=${event.series_id}`}
            className="text-misa-blue underline underline-offset-4"
          >
            See the whole series
          </Link>
        </p>
      )}

      <div className="mt-8">
        <EventLifecycle
          eventId={event.id}
          status={event.status}
          attendanceCount={rows.length}
        />
      </div>

      <section className="mt-12 max-w-3xl">
        <h2 className="font-display text-xl font-bold">Details</h2>
        <div className="mt-4">
          <EventForm
            initial={{
              id: event.id,
              title: event.title,
              description: event.description ?? "",
              location: event.location ?? "",
              date: fields.date,
              // An event that ends the next day (a late social) still edits as
              // one date plus two wall times, which is how officers think
              // about it; the action rebuilds both instants from that date.
              startTime: fields.time,
              endTime: endFields.time,
              openEarlyMinutes: offsets.openEarlyMinutes,
              closeLateMinutes: offsets.closeLateMinutes,
              points: event.points,
              category: event.category ?? "",
              status: event.status,
            }}
          />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-bold">
          Check-ins ({rows.length})
        </h2>
        <div className="mt-4">
          {rows.length === 0 ? (
            <p className="border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm">
              Nobody has checked in to this event.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-black text-left">
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Student ID</th>
                    <th className="py-2 pr-4 font-medium">Submitted (CT)</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-black/15">
                      <td className="py-2 pr-4">{row.submitted_name}</td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        {row.submitted_student_id}
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {formatInstant(row.submitted_at)}
                      </td>
                      <td className="py-2">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

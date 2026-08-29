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

import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { EventForm } from "../_components/event-form";
import { EventStatusPill } from "../_components/event-table";
import {
  Notice,
  ReadError,
} from "@/app/admin/(shell)/_components/notice";

import { EventLifecycle } from "./_components/event-lifecycle";
import { OriginPill } from "../../_components/origin-pill";
import {
  deriveOriginFlag,
  establishVenueOrigin,
  ORIGIN_CAPTURE_ENABLED,
  withinCheckinWindow,
  type OriginRecord,
} from "@/lib/checkin-origin";

// Edit one event, see who checked in, and move it through its lifecycle (§5).

export const metadata: Metadata = { title: "Event" };

type AttendanceRow = {
  id: string;
  submitted_name: string;
  submitted_eid: string;
  submitted_at: string;
  status: string;
  source: string;
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
      "id, title, description, location, starts_at, ends_at, checkin_opens_at, checkin_closes_at, points, category, status, term, series_id, verify_origin"
    )
    .eq("id", id)
    .maybeSingle();

  // 🔓 A FAILED read is not a missing row. This used to log the error and fall
  // through to notFound(), which told an officer the record does not exist —
  // indistinguishable from one that was deleted or merged away. Throwing sends
  // it to the segment error boundary instead, which says the read failed and
  // carries a digest that matches the server log.
  if (error) {
    console.error("event detail query failed:", error.message);
    throw new Error("Could not read this event.");
  }
  if (!event) notFound();

  // ⚠️ The error was not even destructured here. A failed read rendered
  // "Nobody has checked in to this event." — and, worse, passed
  // attendanceCount={0} to EventLifecycle, which RE-ENABLES the delete button
  // and drops the "cancel instead" hint. The server action re-checks so no data
  // was ever at risk, but the UI guard disarmed exactly when the page was least
  // trustworthy.
  const { data: attendance, error: attendanceError } = await db
    .from("attendance")
    .select("id, submitted_name, submitted_eid, submitted_at, status, source")
    .eq("event_id", id)
    .order("submitted_at", { ascending: true });

  if (attendanceError) {
    console.error("event attendance query failed:", attendanceError.message);
  }
  const attendanceFailed = attendanceError !== null;
  const rows = (attendance ?? []) as AttendanceRow[];

  // --- Check-in location verification (docs/checkin-location-verification.md)
  //
  // Derived HERE, at review time, never at check-in time: during an event the
  // mode is still forming, so an early arrival would be flagged for being
  // early. This page is the moment every relevant row exists.
  //
  // 📌 Skipped entirely when the event's toggle is off — not read, not
  // computed. The toggle gates derivation; capture already happened, which is
  // what lets an officer turn this on a week later and see the flags appear.
  const originByAttendance = new Map<string, OriginRecord>();
  let originsFailed = false;
  if (event.verify_origin && rows.length > 0) {
    // 🪤 Filtered through the EMBEDDED attendance row, not an `.in()` list of
    // ids. An `.in()` carrying one uuid per check-in is ~37 characters each:
    // §2.2's worst case is 150 attendees, which is a 5.5KB query string on a
    // GET — the same shape as the 1,257-character URL that made the member
    // picker abandon id enumeration. This asks the question by event, so the
    // URL is a constant length however large the event gets.
    const { data: origins, error: originError } = await db
      .from("checkin_origin")
      .select("attendance_id, origin_hash, network_type, attendance!inner(event_id)")
      .eq("attendance.event_id", id);
    // 🔓 A failed read must not render as an affirmative absence. Falling back
    // to an empty map would say "no origin was recorded for anybody", which is
    // a claim; originsFailed says the check could not run.
    if (originError) {
      console.error("checkin_origin query failed:", originError.message);
      originsFailed = true;
    }
    for (const origin of origins ?? []) {
      originByAttendance.set(origin.attendance_id, {
        originHash: origin.origin_hash,
        networkType: origin.network_type as OriginRecord["networkType"],
      });
    }
  }

  // The window bound is half-open, per the invariant that the three window
  // comparisons must agree. `source` excludes officer manual entry: those rows
  // carry the officer's own origin and would either become the venue or get the
  // whole batch flagged.
  const windowOpens = event.checkin_opens_at ?? event.starts_at;
  const windowCloses = event.checkin_closes_at ?? event.ends_at;
  const venue = establishVenueOrigin(
    rows
      .filter(
        (row) =>
          row.status === "present" &&
          // Officer manual entry carries the officer's own origin, so it must
          // never help decide where the venue was.
          row.source === "self_checkin" &&
          withinCheckinWindow(row.submitted_at, windowOpens, windowCloses)
      )
      .map((row) => originByAttendance.get(row.id))
      .filter((origin): origin is OriginRecord => origin !== undefined)
  );

  const originFlag = (row: AttendanceRow) =>
    deriveOriginFlag({
      record: originByAttendance.get(row.id),
      venue,
      verifyOrigin: event.verify_origin && !originsFailed,
      isSelfCheckin: row.source === "self_checkin",
    });

  const fields = toCentralFields(event.starts_at);
  const endFields = toCentralFields(event.ends_at);
  const offsets = windowOffsetsOf(event);

  return (
    <div>
      <PageHeader
        title={event.title}
        badge={<EventStatusPill status={event.status} />}
        description={
          <>
            {formatEventRange(event.starts_at, event.ends_at)} Central ·{" "}
            {event.term} · {event.points}{" "}
            {event.points === 1 ? "point" : "points"}
          </>
        }
      >
        {event.series_id && (
          <p className="mt-1 text-sm text-misa-secondary">
            Part of a recurring series.{" "}
            <Link
              href={`/admin/events?series=${event.series_id}`}
              className="text-misa-blue underline underline-offset-4"
            >
              See the whole series
            </Link>
          </p>
        )}
      </PageHeader>

      <div className="mt-8">
        {/* ⚠️ Fail SAFE when the count is unknown. A failed attendance read
            gave rows.length === 0, which re-enabled DELETE on an event that may
            well have check-ins. Sending 1 keeps the button disabled and the
            "cancel instead" hint on screen; the server action re-checks either
            way, so this is about not inviting the click. */}
        <EventLifecycle
          eventId={event.id}
          status={event.status}
          attendanceCount={attendanceFailed ? 1 : rows.length}
        />
      </div>

      <section className="mt-12 max-w-3xl">
        <SectionHeading>Details</SectionHeading>
        <div className="mt-4">
          <EventForm
            initial={{
              id: event.id,
              verifyOrigin: event.verify_origin,
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
        <SectionHeading>
          Check-ins ({attendanceFailed ? "—" : rows.length})
        </SectionHeading>
        {/* 🪤 The rows go quiet when there is nothing to compare against, so
            this line is the only thing that distinguishes "everyone was at the
            venue" from "we never worked out what the venue was". Without it an
            officer reads an unmarked list as a clean one. */}
        {!attendanceFailed && rows.length > 0 && (
          <p className="mt-2 text-sm text-misa-secondary">
            {originsFailed
              ? "Origin checking could not run — the origin records could not be read."
              : event.verify_origin && !ORIGIN_CAPTURE_ENABLED
                ? "Origin checking is on, but no origins are being recorded: CHECKIN_ORIGIN_PEPPER is not set on this deployment."
              : !event.verify_origin
                ? "Origin checking is off for this event. Origins were still recorded, so you can turn it on above at any time."
                : venue.status === "established"
                  ? `Origin checking is on. ${venue.count} of ${venue.considered} non-cellular check-ins came from one network, treated as the venue.`
                  : venue.status === "ambiguous"
                    ? "Origin checking is on, but two networks tied for most common, so no venue was established and nothing is marked."
                    : "Origin checking is on, but not enough check-ins came from one network to establish a venue, so nothing is marked."}
          </p>
        )}
        <div className="mt-4">
          {attendanceFailed ? (
            <ReadError what="the check-ins for this event" />
          ) : rows.length === 0 ? (
            <Notice>Nobody has checked in to this event.</Notice>
          ) : (
            <Table minWidth="min-w-[36rem]">
              <THead>
                <Tr hover={false}>
                  <Th>Name</Th>
                  <Th>EID</Th>
                  <Th>Submitted (CT)</Th>
                  <Th>Status</Th>
                </Tr>
              </THead>
              <tbody>
                {rows.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      <span className="flex flex-wrap items-center gap-2">
                        {row.submitted_name}
                        <OriginPill flag={originFlag(row)} />
                      </span>
                    </Td>
                    <Td className="font-mono text-xs">{row.submitted_eid}</Td>
                    <Td className="whitespace-nowrap">
                      {formatInstant(row.submitted_at)}
                    </Td>
                    <Td>{row.status}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </section>
    </div>
  );
}

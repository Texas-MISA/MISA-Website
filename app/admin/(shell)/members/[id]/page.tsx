import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AuditTrail } from "@/app/admin/(shell)/_components/audit-trail";
import { describeOfficer, fetchOfficerNames } from "@/lib/admin-profiles";
import { requireOfficer } from "@/lib/auth";
import { formatCents, paidThroughTerm } from "@/lib/dues";
import { formatCategory, formatDay, formatInstant } from "@/lib/events";
import { fetchFieldDefinitions } from "@/lib/member-fields";
import {
  classifyTermEvents,
  formatAttendanceRate,
  type TermEventState,
} from "@/lib/members";
import { formatPointCategory, signedPoints } from "@/lib/points";
import { createAdminClient } from "@/lib/supabase/admin";

import { MemberEditor } from "./_components/member-editor";

// One member: everything the phase-1 directory used to show in columns, plus
// the per-event breakdown that never fitted in a table (§7 Stage 6 phase 3).
//
// This page is also the recorded mitigation for a §4.2 consequence: an exact
// EID match that happens to be someone *else's* real EID credits the wrong
// member with nothing surfaced anywhere. This is where a human finally asks
// "why does this member have an event they didn't attend?", which is why the
// events grid is per-event rather than a count.
//
// Mostly read-only: everything above the custom fields is a report. The
// editable half — every live custom field (including ones the directory does
// not offer inline) and the officer notes — lives in _components/member-editor.tsx,
// which owns the one `members.updated_at` all of those forms compare against.
//
// Service-role read behind requireOfficer(), like every other admin screen.

export const metadata: Metadata = { title: "Member" };

// One unbroken literal with `as const` — see AUDITED_ADJUSTMENT_COLUMNS in
// lib/points.ts. Every column of the view, because this page is where the ones
// the directory no longer shows have to land.
const DIRECTORY_COLUMNS =
  "id, eid, full_name, email, active, source, joined_at, events_attended, attendance_points, bonus_points, total_points, pending_count, last_seen_at, events_possible, attendance_rate, notes, custom_fields, dues_paid_current_term, updated_at" as const;

const ATTENDANCE_COLUMNS =
  "id, event_id, status, submitted_at, submitted_name, submitted_eid, source" as const;

const ADJUSTMENT_COLUMNS =
  "id, points, reason, category, term, awarded_at, awarded_by, voided_at" as const;

const TERM_EVENT_COLUMNS =
  "id, title, starts_at, ends_at, points, category" as const;

const DUES_COLUMNS =
  "id, paid_at, amount_cents, note, payer_name, start_term, terms_covered, covered_terms, voided_at" as const;

export default async function MemberDetailPage({
  params,
  searchParams,
}: {
  // Promise in Next 16 — await before reading.
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOfficer();
  const { id } = await params;
  const db = createAdminClient();

  // The separate `members.select("notes")` read that used to sit here is gone:
  // migration 18 appended notes, custom_fields and updated_at to the view, which
  // is exactly what that read's own comment anticipated.
  const [directory, definitions, currentTerm, attendance, adjustments, payments] =
    await Promise.all([
      db
        .from("member_directory")
        .select(DIRECTORY_COLUMNS)
        .eq("id", id)
        .maybeSingle(),
      // Archived definitions included: a member may still hold an answer given
      // under one, and a value nobody can see is a value nobody can audit.
      fetchFieldDefinitions(db, { includeArchived: true }),
      // Never type a term string (§4.7) — ask the database, so an officer's
      // app_settings override is honoured too.
      db.rpc("current_term"),
      db.from("attendance").select(ATTENDANCE_COLUMNS).eq("member_id", id),
      db
        .from("point_adjustments")
        .select(ADJUSTMENT_COLUMNS)
        .eq("member_id", id)
        .order("awarded_at", { ascending: false }),
      // Every payment credited to this member, voided ones included — a void is
      // a recorded action rather than a deletion (§4.2), and money having
      // arrived stays a fact whatever an officer later decided about it.
      //
      // Ordered by paid_at, NOT by term: `order by term` is the lexicographic
      // trap, and this is a list of payments in the order they were made rather
      // than a claim about which term is latest. That question is
      // paidThroughTerm's, and it goes through the term index.
      db
        .from("dues_payments")
        .select(DUES_COLUMNS)
        .eq("member_id", id)
        .order("paid_at", { ascending: false }),
    ]);

  if (directory.error) {
    console.error("member detail query failed:", directory.error.message);
  }
  const member = directory.data;
  if (!member) notFound();

  const term = currentTerm.error ? null : currentTerm.data;

  // The term's published events. Cancelled events credit nobody, and drafts are
  // not something a member could have been asked to attend.
  const termEvents = term
    ? await db
        .from("events")
        .select(TERM_EVENT_COLUMNS)
        .eq("term", term)
        .eq("status", "published")
        .order("starts_at", { ascending: true })
    : null;

  const attendanceRows = attendance.error ? [] : (attendance.data ?? []);
  const adjustmentRows = adjustments.error ? [] : (adjustments.data ?? []);
  const paymentRows = payments.error ? [] : (payments.data ?? []);

  // 🪤 Through the term index, never `max(term)` — see paidThroughTerm. Null
  // means no live payment covers anything, which is a different statement from
  // "not paid this term" and is rendered as one.
  const paidThrough = paidThroughTerm(
    paymentRows.map((row) => ({
      coveredTerms: row.covered_terms,
      voided: row.voided_at !== null,
    }))
  );

  const officerNames = await fetchOfficerNames(
    db,
    adjustmentRows.map((row) => row.awarded_by)
  );

  // Two queries joined here rather than one PostgREST embed: the grid is
  // "every term event, and what this member did about it", which is a left join
  // from events — the opposite direction from the attendance rows we hold.
  const attendedEventIds = new Set(
    attendanceRows
      .filter((row) => row.status === "present" && row.event_id)
      .map((row) => row.event_id as string)
  );
  const grid = classifyTermEvents(
    termEvents?.data ?? [],
    attendedEventIds,
    new Date()
  );
  const gridState = new Map<string, TermEventState>(
    grid.events.map((e) => [e.eventId, e.state])
  );

  const pending = attendanceRows
    .filter((row) => row.status === "pending")
    .sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));

  // The directory's filters ride along, so closing this lands on the view the
  // officer was working rather than the unfiltered default.
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string" && value) query.set(key, value);
  }
  const backToDirectory = `/admin/members${
    query.toString() ? `?${query.toString()}` : ""
  }`;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          {member.full_name}
        </h1>
        <div className="flex items-center gap-2">
          {member.active === false && (
            <span className="border border-black/30 px-2 py-0.5 text-[0.7rem] tracking-wider uppercase">
              inactive
            </span>
          )}
          {member.source === "self_checkin" && (
            <span
              title="Created by the check-in form rather than an officer"
              className="border border-black/30 px-2 py-0.5 text-[0.7rem] tracking-wider uppercase"
            >
              self-registered
            </span>
          )}
        </div>
      </div>

      <p className="mt-3 text-sm">
        <Link href={backToDirectory} className="underline">
          ← Back to the directory
        </Link>
      </p>

      <section className="mt-10 max-w-3xl">
        <h2 className="font-display text-xl font-bold">Who this is</h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-[10rem_1fr]">
          <Row label="EID">{member.eid}</Row>
          <Row label="Email">
            <a
              href={`mailto:${member.email}`}
              className="underline underline-offset-2"
            >
              {member.email}
            </a>
          </Row>
          <Row label="Joined">
            {member.joined_at ? formatDay(member.joined_at) : "—"}
          </Row>
          <Row label="Added by">
            {member.source === "self_checkin"
              ? "The check-in form"
              : "An officer"}
          </Row>
          <Row label="Roster">
            {member.active === false ? "Inactive" : "Active"}
          </Row>
        </dl>
      </section>

      <section className="mt-12 max-w-3xl">
        <h2 className="font-display text-xl font-bold">
          {term ? `This term — ${term}` : "This term"}
        </h2>
        <p className="mt-2 text-sm text-foreground/70">
          Every figure below is scoped to the current term, denominators
          included. A grant made in a past term counts for nothing here.
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-[10rem_1fr]">
          <Row label="Events attended">
            {member.events_attended ?? 0}
            <span className="text-foreground/50">
              {" "}
              of {member.events_possible ?? 0} completed
            </span>
          </Row>
          <Row label="Attendance rate">
            {formatAttendanceRate(member.attendance_rate)}
            {member.attendance_rate === null && (
              <span className="ml-2 text-xs text-foreground/60">
                no events have finished in this term yet
              </span>
            )}
          </Row>
          <Row label="Attendance points">{member.attendance_points ?? 0}</Row>
          <Row label="Bonus points">{member.bonus_points ?? 0}</Row>
          <Row label="Total points">
            <span className="font-medium">{member.total_points ?? 0}</span>
          </Row>
        </dl>
      </section>

      <section className="mt-12 max-w-3xl">
        <h2 className="font-display text-xl font-bold">All-time</h2>
        {/* These two are the only columns in member_directory that are NOT
            term-scoped, and sitting beside term-scoped figures in a table is
            what made that ambiguous. Here they are labelled and set apart. */}
        <p className="mt-2 text-sm text-foreground/70">
          Not scoped to a term. A submission from last term still needs an
          officer, and &ldquo;when did we last see this person&rdquo; is an
          all-time question.
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-[10rem_1fr]">
          <Row label="Last seen">
            {member.last_seen_at ? (
              `${formatInstant(member.last_seen_at)} CT`
            ) : (
              <span className="text-foreground/50">never</span>
            )}
          </Row>
          <Row label="Pending">
            {member.pending_count ?? 0}
            {(member.pending_count ?? 0) > 0 && (
              <span className="text-foreground/60">
                {" "}
                submission{member.pending_count === 1 ? "" : "s"} awaiting review
              </span>
            )}
          </Row>
        </dl>

        {pending.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {pending.map((row) => (
              <li key={row.id} className="text-sm">
                <Link
                  href={`/admin/attendance/${row.id}`}
                  className="underline underline-offset-2"
                >
                  Submitted {formatInstant(row.submitted_at)} CT
                </Link>
                <span className="text-foreground/60">
                  {" "}
                  as {row.submitted_name} / {row.submitted_eid}
                  {row.event_id ? "" : " — no event matched"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-bold">
          {term ? `Events this term — ${term}` : "Events this term"}
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-foreground/70">
          Published events only; a cancelled event credits nobody.{" "}
          <span className="font-medium">
            An event that has not happened yet is upcoming, not a miss
          </span>{" "}
          — {grid.attended} attended, {grid.missed} missed, {grid.upcoming}{" "}
          still to come.
        </p>
        {/* ⚠️ These counts and the "events attended" figure above can legitimately
            differ. member_directory counts present rows against any non-cancelled
            current-term event, drafts included; this grid is published-only. The
            view is the authority on the numbers; the grid is the breakdown, and
            neither is derived from the other. */}

        {termEvents?.error && (
          <p className="mt-4 border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm">
            Couldn&apos;t load this term&apos;s events.
          </p>
        )}

        {termEvents && !termEvents.error && termEvents.data.length === 0 && (
          <p className="mt-4 border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm">
            No published events in this term yet.
          </p>
        )}

        {termEvents && !termEvents.error && termEvents.data.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-black text-left">
                  <th className="py-2 pr-4 font-medium">Event</th>
                  <th className="py-2 pr-4 font-medium">When</th>
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 pr-4 font-medium">Points</th>
                  <th className="py-2 font-medium">This member</th>
                </tr>
              </thead>
              <tbody>
                {termEvents.data.map((event) => (
                  <tr key={event.id} className="border-b border-black/15">
                    <td className="py-2 pr-4">
                      <Link
                        href={`/admin/events/${event.id}`}
                        className="underline underline-offset-2"
                      >
                        {event.title}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {formatDay(event.starts_at)}
                    </td>
                    <td className="py-2 pr-4">
                      {formatCategory(event.category)}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{event.points}</td>
                    <td className="py-2">
                      <AttendanceMark
                        state={gridState.get(event.id) ?? "upcoming"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-bold">Point adjustments</h2>
        {adjustmentRows.length === 0 ? (
          <p className="mt-4 max-w-3xl border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm">
            No adjustments have been granted to this member.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[48rem] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-black text-left">
                  <th className="py-2 pr-4 font-medium">Awarded</th>
                  <th className="py-2 pr-4 font-medium">Points</th>
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 pr-4 font-medium">Reason</th>
                  <th className="py-2 pr-4 font-medium">Term</th>
                  <th className="py-2 font-medium">Officer</th>
                </tr>
              </thead>
              <tbody>
                {adjustmentRows.map((row) => {
                  const voided = row.voided_at !== null;
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-black/15 align-top ${
                        voided ? "text-foreground/50" : ""
                      }`}
                    >
                      <td className="py-2 pr-4 whitespace-nowrap">
                        <Link
                          href={`/admin/points/${row.id}`}
                          className="underline underline-offset-2"
                        >
                          {formatInstant(row.awarded_at)} CT
                        </Link>
                      </td>
                      <td className="py-2 pr-4 font-mono whitespace-nowrap">
                        {/* A voided adjustment stays visible and contributes
                            nothing — voiding is a recorded action, not a
                            deletion (§4.2). */}
                        <span className={voided ? "line-through" : ""}>
                          {signedPoints(row.points)}
                        </span>
                        {voided && (
                          <span className="ml-2 border border-black/30 px-2 py-0.5 text-[0.7rem] tracking-wider uppercase">
                            voided
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {formatPointCategory(row.category)}
                      </td>
                      <td className="py-2 pr-4">{row.reason}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {row.term}
                      </td>
                      <td className="py-2">
                        {describeOfficer(officerNames, row.awarded_by)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-bold">Dues</h2>

        {/* The status comes from the view's own boolean rather than being
            re-derived from the payments below, so this page and the directory
            cannot end up saying different things about the same member. What is
            derived here is "paid through", which the view deliberately does not
            carry — see paidThroughTerm. */}
        <p className="mt-3 max-w-3xl text-sm text-foreground/70">
          Calculated from payments, never ticked by hand.{" "}
          {member.dues_paid_current_term ? (
            <span className="font-medium">
              Official for {term ?? "the current term"}.
            </span>
          ) : (
            <span className="font-medium">
              Not paid for {term ?? "the current term"}.
            </span>
          )}{" "}
          {paidThrough === null ? (
            <>No payment covers a term yet.</>
          ) : (
            <>
              Paid through <span className="font-medium">{paidThrough}</span>.
            </>
          )}
        </p>

        {paymentRows.length === 0 ? (
          <p className="mt-4 max-w-3xl border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm">
            No payments have been credited to this member.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[48rem] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-black text-left">
                  <th className="py-2 pr-4 font-medium">Paid</th>
                  <th className="py-2 pr-4 font-medium">Amount</th>
                  <th className="py-2 pr-4 font-medium">Covers</th>
                  <th className="py-2 pr-4 font-medium">Payer</th>
                  <th className="py-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {paymentRows.map((row) => {
                  const voided = row.voided_at !== null;
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-black/15 align-top ${
                        voided ? "text-foreground/50" : ""
                      }`}
                    >
                      <td className="py-2 pr-4 whitespace-nowrap">
                        <Link
                          href={`/admin/dues/${row.id}`}
                          className="underline underline-offset-2"
                        >
                          {formatInstant(row.paid_at)} CT
                        </Link>
                      </td>
                      <td className="py-2 pr-4 font-mono whitespace-nowrap">
                        <span className={voided ? "line-through" : ""}>
                          {formatCents(row.amount_cents)}
                        </span>
                        {voided && (
                          <span className="ml-2 border border-black/30 px-2 py-0.5 text-[0.7rem] tracking-wider uppercase">
                            voided
                          </span>
                        )}
                      </td>
                      {/* Same wording as the ledger's Covers column, on purpose:
                          an undecided amount covers NOTHING until an officer
                          says what it bought, and a row that reads blank here
                          would look like a bug rather than a job. */}
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {row.covered_terms && row.covered_terms.length > 0 ? (
                          row.covered_terms.join(", ")
                        ) : (
                          <span className="text-foreground/50">
                            nothing yet — from {row.start_term}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {row.payer_name ?? (
                          <span className="text-foreground/50">—</span>
                        )}
                      </td>
                      <td className="py-2 max-w-[18rem] break-words">
                        {row.note ?? (
                          <span className="text-foreground/50">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* The custom fields and the officer notes both write `members`, so they
          share one compare-and-set token and therefore one client owner. */}
      <MemberEditor
        memberId={id}
        definitions={definitions}
        customFields={member.custom_fields}
        notes={member.notes ?? ""}
        updatedAt={member.updated_at ?? ""}
      />

      <section className="mt-12 max-w-3xl">
        <h2 className="font-display text-xl font-bold">History</h2>
        <div className="mt-4">
          {/* `id` from the route rather than member.id: every column of the
              view is nullable in the generated types, and this one is the
              value the row was found by. */}
          <AuditTrail entityType="member" entityId={id} />
        </div>
      </section>
    </div>
  );
}

/** The grid's three states, as words rather than colour alone. */
function AttendanceMark({ state }: { state: TermEventState }) {
  if (state === "attended") {
    return (
      <span className="border border-black/30 bg-misa-panel px-2 py-0.5 text-[0.7rem] tracking-wider uppercase">
        attended
      </span>
    );
  }
  if (state === "missed") {
    return (
      <span className="border border-black/30 px-2 py-0.5 text-[0.7rem] tracking-wider text-foreground/60 uppercase">
        missed
      </span>
    );
  }
  return (
    <span className="text-[0.7rem] tracking-wider text-foreground/50 uppercase">
      upcoming
    </span>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-sm text-foreground/60">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </>
  );
}

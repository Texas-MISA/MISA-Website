import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AuditTrail } from "@/app/admin/(shell)/_components/audit-trail";
import { Notice, ReadError } from "@/app/admin/(shell)/_components/notice";
import { describeOfficer, fetchOfficerNames } from "@/lib/admin-profiles";
import { describeMatchReason } from "@/lib/attendance";
import { normalizeEid } from "@/lib/checkin";
import { requireOfficer } from "@/lib/auth";
import { formatCents, paidThroughTerm } from "@/lib/dues";
import { formatCategory, formatDay, formatInstant } from "@/lib/events";
import { fetchFieldDefinitions } from "@/lib/member-fields";
import {
  classifyTermEvents,
  formatAttendanceRate,
  type TermEventState,
} from "@/lib/members";
import { fetchMergeCandidates } from "@/lib/member-options";
import { rankDuplicateCandidates } from "@/lib/merge";
import { formatPointCategory, signedPoints } from "@/lib/points";
import { createAdminClient } from "@/lib/supabase/admin";

import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { Pill } from "@/components/ui/pill";
import { MemberEditor } from "./_components/member-editor";
import { MergePanel, type DuplicateHint } from "./_components/merge-panel";

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
  "id, eid, full_name, email, term, source, joined_at, events_attended, attendance_points, bonus_points, total_points, pending_count, last_seen_at, events_possible, attendance_rate, notes, custom_fields, dues_paid_term, updated_at" as const;

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
      // 🪤 EVERY term row for this member, not `.maybeSingle()`. The view is
      // one row per (member, term) since migration 29, so maybeSingle() would
      // answer PGRST116 for anyone who has been here more than one semester —
      // a working record rendering as a broken page. The rows are picked apart
      // below: identity is the same on all of them, the aggregates are not.
      db.from("member_directory").select(DIRECTORY_COLUMNS).eq("id", id),
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

  // 🔓 A FAILED read is not a missing row. This used to log the error and fall
  // through to notFound(), which told an officer the record does not exist —
  // indistinguishable from one that was deleted or merged away. Throwing sends
  // it to the segment error boundary instead, which says the read failed and
  // carries a digest that matches the server log.
  if (directory.error) {
    console.error("member detail query failed:", directory.error.message);
    throw new Error("Could not read this member.");
  }
  // 🔓 Throws rather than degrading, and this is stricter than it used to be.
  // The term used to affect only the events grid, so a failed rpc left the rest
  // of the page correct. It now decides WHICH ROW of the directory is the one to
  // show — without it this page cannot tell a member's Fall 2026 figures from
  // their Spring 2026 ones, and picking either would be a guess rendered as a
  // fact.
  if (currentTerm.error) {
    console.error("current_term rpc failed:", currentTerm.error.message);
    throw new Error("Could not determine the current term.");
  }
  const term: string = currentTerm.data;

  const rows = directory.data;
  // Genuinely absent: deleted, or merged into another member. Every member has
  // at least one row — the roster CTE includes the term they joined in, and
  // joined_at is NOT NULL — so an empty result means no such member rather than
  // "not on any roster".
  if (rows.length === 0) notFound();

  // Identity, notes, custom fields, pending_count and last_seen_at are the same
  // on every row; only the term aggregates differ. Taking them off the first row
  // is safe for exactly that reason.
  const identity = rows[0];
  const scoped = rows.find((row) => row.term === term) ?? null;

  // ⚠️ A member with no row this term is NOT missing — they are simply not on
  // this term's roster (no attendance, no points, no dues covering it, and they
  // joined earlier). Zeroes are the honest reading of "this term", and the
  // notice below says so rather than letting the officer read a real zero as a
  // lapsed record.
  const member = scoped ?? {
    ...identity,
    term,
    events_attended: 0,
    attendance_points: 0,
    bonus_points: 0,
    total_points: 0,
    // Null, never zero: this member has no row for the term, so nothing here
    // knows how many events it held. formatAttendanceRate renders null as "—",
    // which is the same call migration 14 made for a term with no events.
    events_possible: null,
    attendance_rate: null,
    dues_paid_term: false,
  };

  // The term's published events. Cancelled events credit nobody, and drafts are
  // not something a member could have been asked to attend.
  const termEvents = await db
    .from("events")
    .select(TERM_EVENT_COLUMNS)
    .eq("term", term)
    .eq("status", "published")
    .order("starts_at", { ascending: true });

  // 🔓 Per-section failure flags, not `x.error ? []`. Each of these used to
  // render a read failure as an affirmative claim: "No adjustments have been
  // granted to this member", "No payments have been credited to this member",
  // and — worst — a pending COUNT from the view above an empty list, or an
  // events grid marking everything missed.
  //
  // 📌 Per-section here, where /lookup fails the whole page. This screen is
  // sectioned and an officer often arrives to do one thing; blocking the notes
  // editor because dues failed would be its own defect. The member-facing page
  // has no such separation — its five numbers interlock.
  const attendanceFailed = attendance.error !== null;
  const adjustmentsFailed = adjustments.error !== null;
  const paymentsFailed = payments.error !== null;
  const attendanceRows = attendanceFailed ? [] : (attendance.data ?? []);
  const adjustmentRows = adjustmentsFailed ? [] : (adjustments.data ?? []);
  const paymentRows = paymentsFailed ? [] : (payments.data ?? []);

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

  // Phase 8's merge panel: the picker and the ranked suggestions, both derived
  // from ONE read so they cannot disagree about who is offerable.
  //
  // ⚠️ fetchMergeCandidates includes INACTIVE members, unlike every other picker
  // in the admin section. A duplicate is very often the deactivated half of a
  // pair — switching a ghost off was the only thing an officer could do before
  // this phase — so an active-only list would hide exactly the rows this tool
  // exists to clean up. It is still bounded by MEMBER_SCAN_LIMIT; see the note
  // on that function.
  const mergeResult = await fetchMergeCandidates(db, { excludeId: id });
  // 🔓 An unread roster is not a roster with no duplicates. Returning [] here
  // left the picker empty AND the suggestions absent, which reads as a
  // confident "this member has no duplicates" — produced by never looking.
  const mergeCandidates = mergeResult.kind === "ok" ? mergeResult.candidates : [];
  const mergeFailed = mergeResult.kind === "error";

  const memberOptions = mergeCandidates
    .map((candidate) => ({
      id: candidate.id,
      label: `${candidate.fullName} (${candidate.eid})`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const duplicateHints: DuplicateHint[] = rankDuplicateCandidates(
    {
      id,
      fullName: member.full_name ?? "",
      email: member.email ?? "",
      eid: member.eid ?? "",
      normalizedEid: normalizeEid(member.eid ?? ""),
      joinedAt: member.joined_at ?? "",
      notes: member.notes,
      customFields: member.custom_fields,
    },
    mergeCandidates
  ).map((suggestion) => ({
    id: suggestion.member.id,
    label: `${suggestion.member.fullName} (${suggestion.member.eid})`,
    // Formatted here, on the server, and through the shared describer so a
    // reason reads the same on this screen as on the resolution form.
    why: suggestion.reasons
      .map(describeMatchReason)
      .filter((phrase) => phrase !== "")
      .join(" · "),
  }));

  return (
    <div>
      <PageHeader
        back={{ href: backToDirectory, label: "Back to the directory" }}
        title={member.full_name}
        badge={
          member.source === "self_checkin" ? (
            <Pill
              tone="neutral"
              size="md"
              title="Created by the check-in form rather than an officer"
            >
              self-registered
            </Pill>
          ) : null
        }
      />

      <section className="mt-10 max-w-3xl">
        <SectionHeading>Who this is</SectionHeading>
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
          {/* Derived, not ticked. This replaced an Active / Inactive row on
              2026-08-25 when members.active was dropped — the flag answered the
              same question from a checkbox nobody kept up to date. */}
          <Row label="Roster">
            {scoped ? `On the ${term} roster` : `Not on the ${term} roster`}
          </Row>
        </dl>
      </section>

      <section className="mt-12 max-w-3xl">
        <SectionHeading>
          {term ? `This term — ${term}` : "This term"}
        </SectionHeading>
        <p className="mt-2 text-sm text-misa-secondary">
          Every figure below is scoped to the current term, denominators
          included. A grant made in a past term counts for nothing here.
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-[10rem_1fr]">
          <Row label="Events attended">
            {member.events_attended ?? 0}
            <span className="text-misa-muted">
              {" "}
              of {member.events_possible ?? 0} completed
            </span>
          </Row>
          <Row label="Attendance rate">
            {formatAttendanceRate(member.attendance_rate)}
            {member.attendance_rate === null && (
              <span className="ml-2 text-xs text-misa-muted">
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
        <SectionHeading>All-time</SectionHeading>
        {/* These two are the only columns in member_directory that are NOT
            term-scoped, and sitting beside term-scoped figures in a table is
            what made that ambiguous. Here they are labelled and set apart. */}
        <p className="mt-2 text-sm text-misa-secondary">
          Not scoped to a term. A submission from last term still needs an
          officer, and &ldquo;when did we last see this person&rdquo; is an
          all-time question.
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-[10rem_1fr]">
          <Row label="Last seen">
            {member.last_seen_at ? (
              `${formatInstant(member.last_seen_at)} CT`
            ) : (
              <span className="text-misa-muted">never</span>
            )}
          </Row>
          <Row label="Pending">
            {member.pending_count ?? 0}
            {(member.pending_count ?? 0) > 0 && (
              <span className="text-misa-muted">
                {" "}
                submission{member.pending_count === 1 ? "" : "s"} awaiting review
              </span>
            )}
          </Row>
        </dl>

        {/* ⚠️ `pending_count` comes from the VIEW and the list below from a
            second read, so a failed read printed "3 submissions awaiting
            review" above nothing at all. */}
        {attendanceFailed && (
          <ReadError what="this member's submissions" className="mt-4" />
        )}

        {!attendanceFailed && pending.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {pending.map((row) => (
              <li key={row.id} className="text-sm">
                <Link
                  href={`/admin/attendance/${row.id}`}
                  className="underline underline-offset-2"
                >
                  Submitted {formatInstant(row.submitted_at)} CT
                </Link>
                <span className="text-misa-muted">
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
        <SectionHeading>
          {term ? `Events this term — ${term}` : "Events this term"}
        </SectionHeading>
        <p className="mt-2 max-w-3xl text-sm text-misa-secondary">
          Published events only; a cancelled event credits nobody.{" "}
          <span className="font-medium">
            An event that has not happened yet is upcoming, not a miss
          </span>{" "}
          — {grid.attended} attended, {grid.missed} missed, {grid.upcoming}{" "}
          still to come.
        </p>
        {/* ⚠️ These counts and the "events attended" figure above can legitimately
            differ. member_directory counts present rows against any non-cancelled
            event in this term, drafts included; this grid is published-only. The
            view is the authority on the numbers; the grid is the breakdown, and
            neither is derived from the other. */}

        {/* 🪤 `termEvents` used to be nullable, because a failed current_term
            rpc left the term unknown and this section rendered its heading,
            "0 attended, 0 missed", and then NOTHING — no table, no empty state,
            no error, all three branches false at once. The rpc now throws
            upstream, so the null case is unreachable and only the read error
            remains. */}
        {termEvents.error && (
          <ReadError what="this term's events" className="mt-4" />
        )}

        {!termEvents.error && termEvents.data.length === 0 && (
          <Notice className="mt-4">
            No published events in this term yet.
          </Notice>
        )}

        {termEvents && !termEvents.error && termEvents.data.length > 0 && (
          <div className="mt-4">
            <Table minWidth="min-w-[40rem]">
              <THead>
                <Tr hover={false}>
                  <Th>Event</Th>
                  <Th>When</Th>
                  <Th>Category</Th>
                  <Th numeric>Points</Th>
                  <Th wrap>This member</Th>
                </Tr>
              </THead>
              <tbody>
                {termEvents.data.map((event) => (
                  <Tr key={event.id}>
                    <Td>
                      <Link
                        href={`/admin/events/${event.id}`}
                        className="underline underline-offset-2"
                      >
                        {event.title}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {formatDay(event.starts_at)}
                    </Td>
                    <Td>{formatCategory(event.category)}</Td>
                    <Td numeric>{event.points}</Td>
                    <Td>
                      <AttendanceMark
                        state={gridState.get(event.id) ?? "upcoming"}
                      />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </section>

      <section className="mt-12">
        <SectionHeading>Point adjustments</SectionHeading>
        {adjustmentsFailed ? (
          <ReadError what="this member's point adjustments" className="mt-4 max-w-3xl" />
        ) : adjustmentRows.length === 0 ? (
          <Notice className="mt-4 max-w-3xl">
            No adjustments have been granted to this member.
          </Notice>
        ) : (
          <div className="mt-4">
            <Table minWidth="min-w-[48rem]">
              <THead>
                <Tr hover={false}>
                  <Th>Awarded</Th>
                  <Th>Points</Th>
                  <Th>Category</Th>
                  <Th>Reason</Th>
                  <Th>Term</Th>
                  <Th>Officer</Th>
                </Tr>
              </THead>
              <tbody>
                {adjustmentRows.map((row) => {
                  const voided = row.voided_at !== null;
                  return (
                    <Tr key={row.id} muted={voided} className="align-top">
                      <Td className="whitespace-nowrap">
                        <Link
                          href={`/admin/points/${row.id}`}
                          className="underline underline-offset-2"
                        >
                          {formatInstant(row.awarded_at)} CT
                        </Link>
                      </Td>
                      <Td className="font-mono whitespace-nowrap">
                        {/* A voided adjustment stays visible and contributes
                            nothing — voiding is a recorded action, not a
                            deletion (§4.2). */}
                        <span className={voided ? "line-through" : ""}>
                          {signedPoints(row.points)}
                        </span>
                        {voided && (
                          <Pill tone="critical" className="ml-2">
                            voided
                          </Pill>
                        )}
                      </Td>
                      <Td>{formatPointCategory(row.category)}</Td>
                      <Td>{row.reason}</Td>
                      <Td className="whitespace-nowrap">{row.term}</Td>
                      <Td>{describeOfficer(officerNames, row.awarded_by)}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </section>

      <section className="mt-12">
        <SectionHeading>Dues</SectionHeading>

        {/* The status comes from the view's own boolean rather than being
            re-derived from the payments below, so this page and the directory
            cannot end up saying different things about the same member. What is
            derived here is "paid through", which the view deliberately does not
            carry — see paidThroughTerm. */}
        <p className="mt-3 max-w-3xl text-sm text-misa-secondary">
          Calculated from payments, never ticked by hand.{" "}
          {member.dues_paid_term ? (
            <span className="font-medium">
              Official for {term ?? "the current term"}.
            </span>
          ) : (
            <span className="font-medium">
              Not paid for {term ?? "the current term"}.
            </span>
          )}{" "}
          {/* ⚠️ "Paid through" is derived from the payments read, while the
              status above comes from the view — so a failed read produced
              "Official for Fall 2026. No payment covers a term yet." in one
              sentence. Say nothing rather than say that. */}
          {paymentsFailed ? (
            <>Couldn&apos;t read the payments, so &ldquo;paid through&rdquo; is unknown.</>
          ) : paidThrough === null ? (
            <>No payment covers a term yet.</>
          ) : (
            <>
              Paid through <span className="font-medium">{paidThrough}</span>.
            </>
          )}
        </p>

        {paymentsFailed ? (
          <ReadError what="this member's payments" className="mt-4 max-w-3xl" />
        ) : paymentRows.length === 0 ? (
          <Notice className="mt-4 max-w-3xl">
            No payments have been credited to this member.
          </Notice>
        ) : (
          <div className="mt-4">
            <Table minWidth="min-w-[48rem]">
              <THead>
                <Tr hover={false}>
                  <Th>Paid</Th>
                  <Th>Amount</Th>
                  <Th>Covers</Th>
                  <Th>Payer</Th>
                  <Th>Note</Th>
                </Tr>
              </THead>
              <tbody>
                {paymentRows.map((row) => {
                  const voided = row.voided_at !== null;
                  return (
                    <Tr key={row.id} muted={voided} className="align-top">
                      <Td className="whitespace-nowrap">
                        <Link
                          href={`/admin/dues/${row.id}`}
                          className="underline underline-offset-2"
                        >
                          {formatInstant(row.paid_at)} CT
                        </Link>
                      </Td>
                      <Td className="font-mono whitespace-nowrap">
                        <span className={voided ? "line-through" : ""}>
                          {formatCents(row.amount_cents)}
                        </span>
                        {voided && (
                          <Pill tone="critical" className="ml-2">
                            voided
                          </Pill>
                        )}
                      </Td>
                      {/* Same wording as the ledger's Covers column, on purpose:
                          an undecided amount covers NOTHING until an officer
                          says what it bought, and a row that reads blank here
                          would look like a bug rather than a job. */}
                      <Td className="whitespace-nowrap">
                        {row.covered_terms && row.covered_terms.length > 0 ? (
                          row.covered_terms.join(", ")
                        ) : (
                          <span className="text-misa-muted">
                            nothing yet — from {row.start_term}
                          </span>
                        )}
                      </Td>
                      <Td>
                        {row.payer_name ?? (
                          <span className="text-misa-muted">—</span>
                        )}
                      </Td>
                      <Td className="max-w-[18rem] break-words">
                        {row.note ?? <span className="text-misa-muted">—</span>}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
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

      {/* Phase 8. Below the editor because it is rare and destructive, and it
          reads the same member the editor writes — the CAS token it posts comes
          from the preview rather than from here, so the two cannot disagree
          about which version of the row they are acting on. */}
      {/* An unread roster is not a roster with no duplicates — the picker and
          the suggestions would both be empty and say nothing. */}
      {mergeFailed && (
        <ReadError
          what="the roster, so no merge candidates can be offered"
          className="mt-12 max-w-3xl"
        />
      )}
      <MergePanel
        survivorId={id}
        survivorLabel={`${member.full_name} (${member.eid})`}
        suggestions={duplicateHints}
        members={memberOptions}
      />

      <section className="mt-12 max-w-3xl">
        <SectionHeading>History</SectionHeading>
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
      <span className="border border-misa-border bg-misa-panel px-2 py-0.5 text-[11px] tracking-[0.12em] uppercase">
        attended
      </span>
    );
  }
  if (state === "missed") {
    return (
      <span className="border border-misa-border px-2 py-0.5 text-[0.7rem] tracking-wider text-misa-muted uppercase">
        missed
      </span>
    );
  }
  return (
    <span className="text-[0.7rem] tracking-wider text-misa-muted uppercase">
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
      <dt className="text-sm text-misa-muted">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </>
  );
}

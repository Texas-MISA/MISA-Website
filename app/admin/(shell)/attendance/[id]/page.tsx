import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AuditTrail } from "@/app/admin/(shell)/_components/audit-trail";
import { StatusPill } from "@/app/admin/(shell)/_components/status-pill";
import {
  formatDuration,
  MEMBER_SCAN_LIMIT,
  previewResolution,
  rankMemberSuggestions,
  type MemberCandidate,
  type MemberSuggestion,
  type ResolutionWarning,
} from "@/lib/attendance";
import { requireOfficer } from "@/lib/auth";
import { normalizeEid, ORPHAN_WINDOW_HOURS } from "@/lib/checkin";
import { fetchEventOptions } from "@/lib/event-options";
import { formatInstant } from "@/lib/events";
import { fetchMemberOptions } from "@/lib/member-options";
import { createAdminClient } from "@/lib/supabase/admin";

import { ResolutionForm } from "./_components/resolution-form";
import {
  buildEventSuggestions,
  EventSuggestions,
  MemberSuggestions,
  type EventSuggestionView,
} from "./_components/suggestions";

// One submission, with everything an officer needs to decide what it meant
// (§7 Stage 5). Read-only in phase 2; the resolution form lands in phase 3.

export const metadata: Metadata = { title: "Submission" };

type SubmissionDetail = {
  id: string;
  event_id: string | null;
  member_id: string | null;
  submitted_name: string;
  submitted_eid: string;
  submitted_email: string;
  submitted_at: string;
  normalized_eid: string | null;
  status: string;
  source: string;
  resolution_note: string | null;
  resolved_at: string | null;
  updated_at: string;
  events: {
    id: string;
    title: string;
    status: string;
    starts_at: string;
    ends_at: string;
    checkin_opens_at: string | null;
    checkin_closes_at: string | null;
    points: number;
    term: string | null;
  } | null;
  members: {
    id: string;
    full_name: string;
    email: string;
    eid: string;
    active: boolean;
  } | null;
};

async function fetchSubmission(id: string): Promise<SubmissionDetail | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("attendance")
    .select(
      "id, event_id, member_id, submitted_name, submitted_eid, " +
        "submitted_email, submitted_at, normalized_eid, status, source, " +
        "resolution_note, resolved_at, updated_at, " +
        "events(id, title, status, starts_at, ends_at, checkin_opens_at, checkin_closes_at, points, term), " +
        "members(id, full_name, email, eid, active)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("submission query failed:", error.message);
    return null;
  }
  return data as unknown as SubmissionDetail | null;
}

/** Ranked suggestions from nearby_events(), annotated with each event's real
 * check-in window. The ranking is the database's; this only describes it. */
async function fetchEventSuggestions(
  submittedAt: string
): Promise<EventSuggestionView[]> {
  const db = createAdminClient();

  // ORPHAN_WINDOW_HOURS is always passed explicitly — the SQL default is for
  // ad-hoc queries only (§9 #7).
  const { data: nearby, error } = await db.rpc("nearby_events", {
    ts: submittedAt,
    window_hours: ORPHAN_WINDOW_HOURS,
  });
  if (error) {
    console.error("nearby_events rpc failed:", error.message);
    return [];
  }
  if (nearby.length === 0) return [];

  // nearby_events() returns no window columns, so the gap it computed is
  // event-relative. Fetch the windows to say what actually refused the check-in.
  const { data: windows, error: windowError } = await db
    .from("events")
    .select(
      "id, starts_at, ends_at, checkin_opens_at, checkin_closes_at, status"
    )
    .in(
      "id",
      nearby.map((row) => row.event_id)
    );
  if (windowError) {
    console.error("suggestion window query failed:", windowError.message);
    return [];
  }

  return buildEventSuggestions(
    nearby,
    new Map(windows.map((row) => [row.id, row])),
    submittedAt
  );
}

async function fetchMemberSuggestions(
  submission: SubmissionDetail
): Promise<MemberSuggestion[]> {
  // Already linked — the officer needs no help finding the member.
  if (submission.member_id) return [];

  const db = createAdminClient();
  // Scanned, not probed: `ilike '%jon%'` cannot match `John`, so a probe-based
  // candidate set structurally excludes the row we are looking for.
  const { data, error } = await db
    .from("members")
    .select("id, full_name, email, eid, normalized_eid, active")
    .eq("active", true)
    .limit(MEMBER_SCAN_LIMIT);

  if (error) {
    console.error("member candidate query failed:", error.message);
    return [];
  }

  const candidates: MemberCandidate[] = data.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    eid: row.eid,
    normalizedEid: row.normalized_eid ?? "",
    active: row.active,
  }));

  return rankMemberSuggestions(
    {
      fullName: submission.submitted_name,
      email: submission.submitted_email,
      eid: submission.submitted_eid,
      normalizedEid:
        submission.normalized_eid ??
        normalizeEid(submission.submitted_eid),
    },
    candidates
  );
}

export default async function SubmissionDetailPage({
  params,
  searchParams,
}: {
  // Promise in Next 16 — await before reading.
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOfficer();
  const { id } = await params;

  const submission = await fetchSubmission(id);
  if (!submission) notFound();

  // The queue's filters, carried through so acting on a row returns to the
  // view the officer was working rather than the unfiltered default.
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string" && value) query.set(key, value);
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const backToQueue = `/admin/attendance${suffix}`;

  const [eventSuggestions, memberSuggestions, eventOptions, memberOptions] =
    await Promise.all([
      fetchEventSuggestions(submission.submitted_at),
      fetchMemberSuggestions(submission),
      fetchEventOptions(createAdminClient()),
      fetchMemberOptions(createAdminClient(), {
        includeId: submission.member_id,
      }),
    ]);

  const warnings = previewResolution({
    event: submission.events,
    memberActive: submission.members?.active ?? null,
    submittedAt: submission.submitted_at,
  });

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          Submission
        </h1>
        <StatusPill status={submission.status} />
      </div>

      <p className="mt-3 text-sm">
        <Link href={backToQueue} className="underline">
          ← Back to the queue
        </Link>
      </p>

      <section className="mt-10 max-w-3xl">
        <h2 className="font-display text-xl font-bold">As it was submitted</h2>
        <p className="mt-2 text-sm text-foreground/70">
          Exactly what the member typed. Nothing here has been corrected or
          normalized.
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-[10rem_1fr]">
          <Row label="Name">{submission.submitted_name}</Row>
          <Row label="EID">
            <span className="font-mono">{submission.submitted_eid}</span>
            {submission.normalized_eid &&
              submission.normalized_eid !==
                submission.submitted_eid && (
                <span className="ml-2 text-xs text-foreground/60">
                  matches as {submission.normalized_eid}
                </span>
              )}
          </Row>
          <Row label="Email">{submission.submitted_email}</Row>
          <Row label="Submitted">
            {formatInstant(submission.submitted_at)} CT
          </Row>
          <Row label="Source">
            {submission.source === "admin_manual"
              ? "Entered by an officer"
              : "Public check-in form"}
          </Row>
          {submission.resolution_note && (
            <Row label="Note">{submission.resolution_note}</Row>
          )}
          {submission.resolved_at && (
            <Row label="Resolved">
              {formatInstant(submission.resolved_at)} CT
            </Row>
          )}
        </dl>
      </section>

      <section className="mt-12 max-w-3xl">
        <h2 className="font-display text-xl font-bold">Where it stands</h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-[10rem_1fr]">
          <Row label="Event">
            {submission.events ? (
              <Link
                href={`/admin/events/${submission.events.id}`}
                className="underline"
              >
                {submission.events.title}
              </Link>
            ) : (
              <span className="text-foreground/50">not linked</span>
            )}
          </Row>
          <Row label="Member">
            {submission.members ? (
              <>
                {submission.members.full_name}{" "}
                <span className="text-xs text-foreground/60">
                  ({submission.members.eid})
                </span>
              </>
            ) : (
              <span className="text-foreground/50">not linked</span>
            )}
          </Row>
        </dl>

        {warnings.length > 0 && (
          <div
            role="status"
            className="mt-6 border-l-4 border-amber-700 bg-misa-panel px-4 py-3"
          >
            <p className="text-sm font-medium">
              Worth knowing before approving this
            </p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
              {warnings.map((warning, index) => (
                <li key={index}>{describeWarning(warning)}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {!submission.event_id && (
        <section className="mt-12 max-w-3xl">
          <h2 className="font-display text-xl font-bold">Which event?</h2>
          <p className="mt-2 text-sm text-foreground/70">
            Ranked by how close the submission was to each event&apos;s
            check-in window. Suggestions only — nothing is selected, and
            assigning one is your call.
          </p>
          <div className="mt-4">
            <EventSuggestions
              suggestions={eventSuggestions}
              outsideWindow={eventSuggestions.length === 0}
            />
          </div>
        </section>
      )}

      {!submission.member_id && (
        <section className="mt-12 max-w-3xl">
          <h2 className="font-display text-xl font-bold">Which member?</h2>
          <p className="mt-2 text-sm text-foreground/70">
            Closest roster matches on email, EID, and name. The
            highlighted character is where the submitted ID first differs.
          </p>
          <div className="mt-4">
            <MemberSuggestions
              suggestions={memberSuggestions}
              submittedEid={submission.submitted_eid}
            />
          </div>
        </section>
      )}

      <section className="mt-12 max-w-3xl">
        <h2 className="font-display text-xl font-bold">Resolving this</h2>
        <p className="mt-2 text-sm text-foreground/70">
          Correct whatever the member mistyped, set both links, and approve —
          one save. Nothing above is preselected; the choice is yours.
        </p>
        <div className="mt-6">
          <ResolutionForm
            id={submission.id}
            // The raw PostgREST string. A Date round trip truncates its
            // microseconds and the compare-and-set then never matches.
            updatedAt={submission.updated_at}
            status={submission.status}
            returnTo={backToQueue}
            events={eventOptions}
            members={memberOptions}
            current={{
              submittedName: submission.submitted_name,
              submittedEid: submission.submitted_eid,
              submittedEmail: submission.submitted_email,
              eventId: submission.event_id ?? "",
              memberId: submission.member_id ?? "",
              resolutionNote: submission.resolution_note ?? "",
            }}
          />
        </div>
      </section>

      <section className="mt-12 max-w-3xl">
        <h2 className="font-display text-xl font-bold">History</h2>
        <div className="mt-4">
          <AuditTrail entityType="attendance" entityId={submission.id} />
        </div>
      </section>
    </div>
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

function describeWarning(warning: ResolutionWarning): string {
  switch (warning.kind) {
    case "event_cancelled":
      return "This event is cancelled, so approving here credits nobody — cancelled events contribute no points.";
    case "event_draft":
      return "This event is still a draft. Its attendance counts on the public leaderboard anyway, so approving will move public standings before the event is published.";
    case "member_inactive":
      return "This member is inactive. They appear in the officer directory but not on the public leaderboard, so approving will change nothing publicly.";
    case "outside_window":
      return warning.side === "after"
        ? `The submission arrived ${formatDuration(warning.secondsOutside)} after check-in closed. That is normal for this queue — approving it is a judgement that they were there.`
        : `The submission arrived ${formatDuration(warning.secondsOutside)} before check-in opened.`;
  }
}

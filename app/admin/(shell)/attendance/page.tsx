import type { Metadata } from "next";
import Link from "next/link";

import { LedgerExport } from "@/app/admin/(shell)/_components/ledger-export";
import { ReadError } from "@/app/admin/(shell)/_components/notice";
import { requireOfficer } from "@/lib/auth";
import { fetchEventOptions } from "@/lib/event-options";
import { formatInstant } from "@/lib/events";
import {
  applyAttendanceFilter,
  attendanceFilterToParams,
  parseAttendanceFilter,
  type AttendanceFilter,
} from "@/lib/ledger-filters";
import {
  ATTENDANCE_DEFAULT_FIELDS,
  ATTENDANCE_EXPORT_FIELDS,
} from "@/lib/export-ledgers";
import { createAdminClient } from "@/lib/supabase/admin";

import { AttendanceFilters } from "./_components/attendance-filters";
import type { SubmissionRow } from "./_components/attendance-table";
import { ReviewQueue } from "./_components/review-queue";

// The review queue (§5, §7 Stage 5). Every submission the check-in form has
// ever produced, resolved or not — this is the screen that makes "nothing is
// ever dropped on the floor" (§4.2) mean something to an officer.
//
// Service-role read: attendance is deny-all under RLS until Stage 8.

export const metadata: Metadata = { title: "Attendance" };

const LIMIT = 200;

type RawSubmission = Omit<SubmissionRow, "submittedLabel"> & {
  submitted_at: string;
};

async function fetchSubmissions(
  filters: AttendanceFilter
): Promise<
  { kind: "ok"; rows: SubmissionRow[]; total: number } | { kind: "error" }
> {
  const db = createAdminClient();

  // 📌 The predicates live in lib/ledger-filters.ts as of Stage 8 phase 2, so
  // this screen and /admin/attendance/export are provably the same query — the
  // property applyMemberFilter gives the directory and its export. What stays
  // here is the ROW WINDOW: the order and the 200-row cap are this screen's,
  // and the export deliberately uses different ones.
  const query = applyAttendanceFilter(
    db
      .from("attendance")
      .select(
        // No members(...) join: the queue does not show the linked member. It
        // is on the submission detail page, where it can also be changed.
        "id, submitted_name, submitted_eid, submitted_email, submitted_at, " +
          "status, source, event_id, " +
          "events(id, title, status)",
        { count: "exact" }
      ),
    filters
  )
    .order("submitted_at", { ascending: filters.sort === "oldest" })
    .limit(LIMIT);

  const { data, error, count } = await query;
  if (error) {
    console.error("submissions query failed:", error.message);
    return { kind: "error" };
  }
  // `submitted_at` is deliberately dropped on the way out rather than passed
  // along: the table is a Client Component, and a raw timestamp sitting in its
  // props is an invitation to format it there, which is the hydration trap.
  const rows: SubmissionRow[] = (data as unknown as RawSubmission[]).map(
    ({ submitted_at, ...row }) => ({
      ...row,
      submittedLabel: formatInstant(submitted_at),
    })
  );

  return { kind: "ok", rows, total: count ?? data.length };
}

export default async function AdminAttendancePage({
  searchParams,
}: {
  // Promise in Next 16 — await before reading.
  searchParams: Promise<{
    status?: string;
    event?: string;
    from?: string;
    to?: string;
    sort?: string;
  }>;
}) {
  await requireOfficer();

  const params = await searchParams;
  const filters = parseAttendanceFilter(params);

  const [eventsResult, result] = await Promise.all([
    fetchEventOptions(createAdminClient()),
    fetchSubmissions(filters),
  ]);
  // The event filter's options. An unread list is not an empty one — say so
  // rather than rendering a dropdown that looks like there are no events.
  const events = eventsResult.kind === "ok" ? eventsResult.options : [];
  const eventsFailed = eventsResult.kind === "error";

  // Built from the FILTER, not from the incoming query string, so a link back
  // to this view carries what was actually applied rather than whatever was
  // typed — a `?status=xyz` that the parse ignored no longer rides along.
  const query = attendanceFilterToParams(filters).toString();
  const suffix = query ? `?${query}` : "";

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          Attendance
        </h1>
        <Link
          href={`/admin/attendance/new${suffix}`}
          className="rounded-full bg-misa-blue px-6 py-2 text-xs font-medium tracking-wider text-white transition hover:bg-misa-blue-dark"
        >
          ADD A CHECK-IN
        </Link>
      </div>

      <p className="mt-3 max-w-2xl text-sm text-foreground/70">
        Every submission the check-in form has produced. A pending row is
        missing its event link, its member link, or both — open one to see what
        the member typed and what it most likely meant.
      </p>

      {eventsFailed && (
        <ReadError
          what="the event list, so the event filter is empty"
          className="mt-6"
        />
      )}

      <div className="mt-6">
        <AttendanceFilters
          events={events}
          selected={{
            // "" is every status, which the control spells "all".
            status: filters.status === "" ? "all" : filters.status,
            event: filters.event,
            from: filters.from,
            to: filters.to,
            sort: filters.sort,
          }}
        />
      </div>

      <div className="mt-8">
        {result.kind === "error" ? (
          <p className="border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm">
            Couldn&apos;t load the review queue.
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-foreground/60">
              {result.total === 0
                ? "No matching submissions."
                : result.total > result.rows.length
                  ? `Showing the first ${result.rows.length} of ${result.total} matching submissions.`
                  : `${result.total} matching submission${result.total === 1 ? "" : "s"}.`}
            </p>
            <div className="mb-4">
              <LedgerExport
                path="/admin/attendance/export"
                filterParams={query}
                catalogue={ATTENDANCE_EXPORT_FIELDS}
                defaults={ATTENDANCE_DEFAULT_FIELDS}
                total={result.total}
                noun="submission"
              />
            </div>
            <ReviewQueue
              rows={result.rows}
              events={events}
              hrefSuffix={suffix}
            />
          </>
        )}
      </div>
    </div>
  );
}

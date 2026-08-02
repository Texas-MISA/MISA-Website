import type { Metadata } from "next";
import Link from "next/link";

import { requireOfficer } from "@/lib/auth";
import { fetchEventOptions } from "@/lib/event-options";
import {
  addCivilDays,
  centralWallTimeToInstant,
  formatInstant,
} from "@/lib/events";
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

type Filters = {
  status: string;
  event: string;
  from: string;
  to: string;
  sort: "oldest" | "newest";
};

type RawSubmission = Omit<SubmissionRow, "submittedLabel"> & {
  submitted_at: string;
};

async function fetchSubmissions(
  filters: Filters
): Promise<
  { kind: "ok"; rows: SubmissionRow[]; total: number } | { kind: "error" }
> {
  const db = createAdminClient();

  let query = db
    .from("attendance")
    .select(
      "id, submitted_name, submitted_eid, submitted_email, submitted_at, " +
        "status, source, event_id, member_id, " +
        "events(id, title, status), members(id, full_name, active)",
      { count: "exact" }
    )
    .order("submitted_at", { ascending: filters.sort === "oldest" })
    .limit(LIMIT);

  if (filters.status) query = query.eq("status", filters.status);

  if (filters.event === "unassigned") query = query.is("event_id", null);
  else if (filters.event) query = query.eq("event_id", filters.event);

  // Date bounds are Central wall time made into instants, and half-open at the
  // top. A bare .lte("submitted_at", "2026-04-07") would be read as UTC
  // midnight and silently drop the last five or six hours of a Central day —
  // the same class of bug as building a timestamp with new Date("…T18:00").
  if (filters.from) {
    query = query.gte(
      "submitted_at",
      centralWallTimeToInstant(filters.from, "00:00").toISOString()
    );
  }
  if (filters.to) {
    query = query.lt(
      "submitted_at",
      centralWallTimeToInstant(addCivilDays(filters.to, 1), "00:00").toISOString()
    );
  }

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

/** The active filters as a query string, so opening a submission and coming
 * back lands on the same view rather than the unfiltered default. */
function filterSuffix(params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
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

  // Absent status means pending: the queue exists for the unresolved rows, and
  // an officer arriving from the dashboard badge wants those. "all" is the
  // explicit escape hatch. Pending defaults to oldest-first so the queue
  // drains from the top rather than rotting at the bottom (§9 #8 chose no
  // enforced deadline, which makes the ordering the mitigation).
  const status = params.status === "all" ? "" : (params.status ?? "pending");
  const sort: Filters["sort"] =
    params.sort === "newest"
      ? "newest"
      : params.sort === "oldest"
        ? "oldest"
        : status === "pending"
          ? "oldest"
          : "newest";

  const filters: Filters = {
    status,
    event: params.event ?? "",
    from: params.from ?? "",
    to: params.to ?? "",
    sort,
  };

  const [events, result] = await Promise.all([
    fetchEventOptions(createAdminClient()),
    fetchSubmissions(filters),
  ]);

  const suffix = filterSuffix(params);

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

      <div className="mt-6">
        <AttendanceFilters
          events={events}
          selected={{
            status: params.status === "all" ? "all" : (params.status ?? "pending"),
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

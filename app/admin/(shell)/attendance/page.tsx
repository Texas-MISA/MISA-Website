import type { Metadata } from "next";
import Link from "next/link";

import { requireOfficer } from "@/lib/auth";
import {
  addCivilDays,
  centralWallTimeToInstant,
  formatEventRange,
} from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  AttendanceFilters,
  type EventOption,
} from "./_components/attendance-filters";
import {
  AttendanceTable,
  type SubmissionRow,
} from "./_components/attendance-table";

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

async function fetchEventOptions(): Promise<EventOption[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("events")
    .select("id, title, starts_at, ends_at")
    .order("starts_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("event options query failed:", error.message);
    return [];
  }
  // Label rendered here rather than in the Client Component: Intl.DateTimeFormat
  // would otherwise run on both sides of hydration, and Node and Chrome disagree
  // on the space before "PM".
  return data.map((event) => ({
    id: event.id,
    label: `${event.title} — ${formatEventRange(event.starts_at, event.ends_at)}`,
  }));
}

async function fetchSubmissions(
  filters: Filters
): Promise<
  { kind: "ok"; rows: SubmissionRow[]; total: number } | { kind: "error" }
> {
  const db = createAdminClient();

  let query = db
    .from("attendance")
    .select(
      "id, submitted_name, submitted_student_id, submitted_email, submitted_at, " +
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
  return {
    kind: "ok",
    rows: data as unknown as SubmissionRow[],
    total: count ?? data.length,
  };
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
    fetchEventOptions(),
    fetchSubmissions(filters),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          Attendance
        </h1>
        <Link
          href="/admin/attendance/new"
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
            <AttendanceTable rows={result.rows} />
          </>
        )}
      </div>
    </div>
  );
}

import type { Metadata } from "next";

import { requireOfficer } from "@/lib/auth";
import { formatDay, formatInstant } from "@/lib/events";
import {
  applyMemberFilter,
  isDefaultFilter,
  pageCount,
  pageRange,
  parseMemberFilter,
  PAGE_SIZE,
} from "@/lib/filters";
import { createAdminClient } from "@/lib/supabase/admin";

import { MemberFilters } from "./_components/member-filters";
import { MemberTable, type MemberRow } from "./_components/member-table";
import { Pagination } from "./_components/pagination";

// The member directory (§5, §7 Stage 6). Reads member_directory, which is
// current-term scoped and keeps the attendance/bonus split the public
// leaderboard deliberately drops (§4.4, §4.5).
//
// Service-role read behind requireOfficer(), like every other admin screen.
// member_directory carries eid and email, so it is granted to
// `authenticated` only and must never be read from a Client Component with the
// anon key (§6).
//
// Phase 1 is read-only: sorting, pagination, and the filters that live on the
// view. The relational filters — attended or missed a specific event, has
// pending submissions, free-text search — need an attendance subquery rather
// than a column comparison and land in phase 3.

export const metadata: Metadata = { title: "Members" };

// One unbroken literal with `as const`, for the reason recorded on
// AUDITED_ADJUSTMENT_COLUMNS in lib/points.ts: PostgREST types the returned row
// off the string *literal*, so `"a, b" + "c"` widens to plain `string` and
// collapses the result into an untyped error shape. The wrapped-and-concatenated
// version of this line cost a build here too.
const COLUMNS =
  "id, eid, full_name, email, active, source, joined_at, events_attended, attendance_points, bonus_points, total_points, pending_count, last_seen_at, events_possible, attendance_rate" as const;

type DirectoryQueryResult =
  | { kind: "ok"; rows: MemberRow[]; total: number }
  | { kind: "error" };

async function fetchDirectory(
  filter: ReturnType<typeof parseMemberFilter>
): Promise<DirectoryQueryResult> {
  const db = createAdminClient();

  const { from, to } = pageRange(filter.page);

  // applyMemberFilter is the only thing that translates a filter into a query.
  // Phase 2's export will call it on the same filter and skip the .range()
  // below — that separation is what keeps "copy all N matching" honest.
  const { data, error, count } = await applyMemberFilter(
    db.from("member_directory").select(COLUMNS, { count: "exact" }),
    filter
  ).range(from, to);

  if (error) {
    console.error("member directory query failed:", error.message);
    return { kind: "error" };
  }

  // Timestamps are formatted here and the raw values dropped. The table renders
  // on the server too, but keeping the discipline means a later "make this
  // interactive" change cannot quietly turn a raw timestamp into a hydration
  // mismatch.
  const rows: MemberRow[] = data.map((row) => ({
    id: row.id ?? "",
    eid: row.eid ?? "",
    fullName: row.full_name ?? "",
    email: row.email ?? "",
    active: row.active ?? true,
    source: row.source ?? "admin",
    joinedLabel: row.joined_at ? formatDay(row.joined_at) : "—",
    eventsAttended: row.events_attended ?? 0,
    eventsPossible: row.events_possible ?? 0,
    attendancePoints: row.attendance_points ?? 0,
    bonusPoints: row.bonus_points ?? 0,
    totalPoints: row.total_points ?? 0,
    pendingCount: row.pending_count ?? 0,
    lastSeenLabel: row.last_seen_at ? formatInstant(row.last_seen_at) : null,
    rate: row.attendance_rate,
  }));

  return { kind: "ok", rows, total: count ?? rows.length };
}

export default async function AdminMembersPage({
  searchParams,
}: {
  // Promise in Next 16 — await before reading.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOfficer();

  const params = await searchParams;
  const filter = parseMemberFilter(params);
  const result = await fetchDirectory(filter);

  const pages = result.kind === "ok" ? pageCount(result.total) : 1;

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
        Members
      </h1>

      <p className="mt-3 max-w-2xl text-sm text-foreground/70">
        The roster for the current term. Points, events attended, and the
        attendance rate are all scoped to this term;{" "}
        <span className="font-medium">pending submissions and last seen are
        all-time</span>, because a submission from last term still needs an
        officer.
      </p>

      <div className="mt-6">
        <MemberFilters filter={filter} />
      </div>

      <div className="mt-8">
        {result.kind === "error" ? (
          <p className="border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm">
            Couldn&apos;t load the directory.
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-foreground/60">
              {result.total === 0
                ? isDefaultFilter(filter)
                  ? "No active members yet."
                  : "No members match these filters."
                : result.total > PAGE_SIZE
                  ? `${result.total} matching members — showing ${result.rows.length} on page ${filter.page} of ${pages}.`
                  : `${result.total} matching member${result.total === 1 ? "" : "s"}.`}
            </p>

            <MemberTable rows={result.rows} filter={filter} />

            <Pagination filter={filter} pages={pages} total={result.total} />
          </>
        )}
      </div>
    </div>
  );
}

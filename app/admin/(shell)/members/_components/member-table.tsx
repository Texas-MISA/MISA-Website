import Link from "next/link";

import {
  defaultDirection,
  memberFilterToParams,
  type MemberFilter,
  type MemberSort,
} from "@/lib/filters";

// A Server Component, deliberately. Phase 1 has no interactivity beyond
// navigation, so the sort headers are plain links and every date arrives
// already formatted — which sidesteps the hydration trap entirely rather than
// working around it. Phase 2 adds checkboxes and will need a Client Component
// for the selection state; the row markup should move wholesale rather than
// this file gaining "use client".

export type MemberRow = {
  id: string;
  studentId: string;
  fullName: string;
  email: string;
  active: boolean;
  source: string;
  joinedLabel: string;
  eventsAttended: number;
  eventsPossible: number;
  attendancePoints: number;
  bonusPoints: number;
  totalPoints: number;
  pendingCount: number;
  lastSeenLabel: string | null;
  rate: number | null;
};

const numeric = "px-3 py-2 text-right tabular-nums";
const text = "px-3 py-2 text-left";

/** Null is not zero: a term with no completed events has no rate, and 0% would
 * read as "attended nothing" (§7 Stage 6, migration 14). */
function formatRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function MemberTable({
  rows,
  filter,
}: {
  rows: MemberRow[];
  filter: MemberFilter;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto border-2 border-black">
      <table className="w-full min-w-[64rem] border-collapse text-sm">
        <thead className="bg-misa-panel">
          <tr className="border-b-2 border-black">
            <SortHeader filter={filter} column="name" align="left">
              Member
            </SortHeader>
            <SortHeader filter={filter} column="student_id" align="left">
              Student ID
            </SortHeader>
            <SortHeader filter={filter} column="joined_at" align="left">
              Joined
            </SortHeader>
            <SortHeader filter={filter} column="events_attended">
              Events
            </SortHeader>
            <SortHeader filter={filter} column="attendance_rate">
              Rate
            </SortHeader>
            <SortHeader filter={filter} column="attendance_points">
              Attend.
            </SortHeader>
            <SortHeader filter={filter} column="bonus_points">
              Bonus
            </SortHeader>
            <SortHeader filter={filter} column="total_points">
              Total
            </SortHeader>
            <SortHeader filter={filter} column="pending_count">
              Pending
            </SortHeader>
            <SortHeader filter={filter} column="last_seen_at" align="left">
              Last seen
            </SortHeader>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={`border-b border-black/20 last:border-b-0 ${
                row.active ? "" : "bg-black/[0.03] text-foreground/60"
              }`}
            >
              <td className={text}>
                <div className="font-medium">
                  {row.fullName}
                  {!row.active && (
                    <span className="ml-2 border border-black/40 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wider">
                      inactive
                    </span>
                  )}
                  {row.source === "self_checkin" && (
                    <span
                      title="Created by the check-in form rather than an officer"
                      className="ml-2 border border-black/40 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wider"
                    >
                      self
                    </span>
                  )}
                </div>
                <div className="text-xs text-foreground/60">{row.email}</div>
              </td>
              <td className={`${text} tabular-nums`}>{row.studentId}</td>
              <td className={text}>{row.joinedLabel}</td>
              <td className={numeric}>
                {row.eventsAttended}
                <span className="text-foreground/50">
                  {" "}
                  / {row.eventsPossible}
                </span>
              </td>
              <td className={numeric}>{formatRate(row.rate)}</td>
              <td className={numeric}>{row.attendancePoints}</td>
              <td className={numeric}>
                {row.bonusPoints === 0 ? (
                  <span className="text-foreground/40">0</span>
                ) : (
                  row.bonusPoints
                )}
              </td>
              <td className={`${numeric} font-medium`}>{row.totalPoints}</td>
              <td className={numeric}>
                {row.pendingCount === 0 ? (
                  <span className="text-foreground/40">0</span>
                ) : (
                  <Link
                    href={`/admin/attendance?status=pending`}
                    className="underline decoration-1 underline-offset-2"
                  >
                    {row.pendingCount}
                  </Link>
                )}
              </td>
              <td className={text}>
                {row.lastSeenLabel ?? (
                  <span className="text-foreground/40">never</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A column header that sorts.
 *
 * Clicking the active column flips the direction; clicking any other starts at
 * that column's own default, which is descending for the count-like columns —
 * nobody opens a leaderboard-shaped screen wanting the lowest total first.
 * Always resets to page 1: keeping the offset across a re-sort lands the
 * officer in the middle of a list they have not seen the top of.
 */
function SortHeader({
  filter,
  column,
  align = "right",
  children,
}: {
  filter: MemberFilter;
  column: MemberSort;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const isActive = filter.sort === column;
  const nextDir: "asc" | "desc" = isActive
    ? filter.dir === "asc"
      ? "desc"
      : "asc"
    : defaultDirection(column);
  const params = memberFilterToParams(filter, {
    sort: column,
    dir: nextDir,
    page: 1,
  });
  const query = params.toString();

  return (
    <th
      scope="col"
      aria-sort={
        isActive ? (filter.dir === "asc" ? "ascending" : "descending") : "none"
      }
      className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <Link
        href={`/admin/members${query ? `?${query}` : ""}`}
        className="inline-flex items-center gap-1 hover:underline"
      >
        {children}
        <span aria-hidden className="text-[0.6rem]">
          {isActive ? (filter.dir === "asc" ? "▲" : "▼") : ""}
        </span>
      </Link>
    </th>
  );
}

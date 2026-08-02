import Link from "next/link";

import {
  defaultDirection,
  memberFilterToParams,
  type MemberFilter,
  type MemberSort,
} from "@/lib/filters";

// A Server Component, deliberately. Phase 3 still has no interactivity beyond
// navigation, so the sort headers are plain links and nothing here formats a
// date — which sidesteps the hydration trap entirely rather than working around
// it. Phase 4 adds the inline <select> cells for custom fields and will need a
// Client Component for them; the row markup should move wholesale rather than
// this file gaining "use client".
//
// Four columns (phase 3): Name, Email, EID, Total Points. Everything the phase-1
// table showed beside them — joined, source, events, rate, the attendance/bonus
// split, pending, last seen — lives on /admin/members/[id] now, which is why
// the name links there.

export type MemberRow = {
  id: string;
  eid: string;
  fullName: string;
  email: string;
  /** Not a column. Drives the INACTIVE badge, which is an annotation on the
   * name rather than a field of its own — and the only on-screen signal that
   * the roster scope is showing someone deactivated. */
  active: boolean;
  /** Likewise: the SELF badge marks a row the check-in form created, which is
   * §4.2's roster-cleanup signal. */
  source: string;
  totalPoints: number;
};

const numeric = "px-3 py-2 text-right tabular-nums";
const text = "px-3 py-2 text-left";

export function MemberTable({
  rows,
  filter,
}: {
  rows: MemberRow[];
  filter: MemberFilter;
}) {
  if (rows.length === 0) return null;

  // The filter rides along to the detail page so its back link returns to the
  // view the officer was working, not the unfiltered default — the same idiom
  // the points ledger uses for its adjustment pages.
  const context = memberFilterToParams(filter).toString();
  const detailHref = (id: string) =>
    `/admin/members/${id}${context ? `?${context}` : ""}`;

  return (
    <div className="overflow-x-auto border-2 border-black">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <thead className="bg-misa-panel">
          <tr className="border-b-2 border-black">
            <SortHeader filter={filter} column="name" align="left">
              Member
            </SortHeader>
            <SortHeader filter={filter} column="email" align="left">
              Email
            </SortHeader>
            <SortHeader filter={filter} column="eid" align="left">
              EID
            </SortHeader>
            <SortHeader filter={filter} column="total_points">
              Total points
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
                <Link
                  href={detailHref(row.id)}
                  className="font-medium underline decoration-1 underline-offset-2"
                >
                  {row.fullName}
                </Link>
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
              </td>
              <td className={text}>{row.email}</td>
              <td className={text}>{row.eid}</td>
              <td className={`${numeric} font-medium`}>{row.totalPoints}</td>
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
 * that column's own default, which is descending only for total points — nobody
 * opens a leaderboard-shaped screen wanting the lowest total first. Always
 * resets to page 1: keeping the offset across a re-sort lands the officer in
 * the middle of a list they have not seen the top of.
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

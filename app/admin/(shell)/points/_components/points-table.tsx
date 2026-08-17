import Link from "next/link";

import { formatPointCategory, signedPoints } from "@/lib/points";

// Presentational only — the page owns the query, matching attendance-table.tsx.
//
// A Server Component, unlike the attendance table, because the ledger has no
// selection to hold. Dates still arrive pre-formatted: the page is where every
// Intl call in this subtree lives, so there is one place to check rather than
// one per component.

export type LedgerRow = {
  id: string;
  points: number;
  reason: string;
  category: string;
  term: string;
  awardedLabel: string;
  voided: boolean;
  officerLabel: string;
  member_id: string;
  members: { id: string; full_name: string; active: boolean } | null;
  events: { id: string; title: string } | null;
};

export function PointsTable({
  rows,
  hrefSuffix,
  memberHref,
}: {
  rows: LedgerRow[];
  /** The ledger's own filters, so a row opens and comes back to this view. */
  hrefSuffix: string;
  /** Builds the "filter to this member" link, preserving the other filters. */
  memberHref: (memberId: string) => string;
}) {
  if (rows.length === 0) {
    return (
      <p className="border border-misa-blue/35 bg-misa-panel px-4 py-3 text-sm">
        No adjustments match these filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[64rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-misa-border text-left">
            <th className="py-2 pr-4 align-bottom text-[12px] font-medium tracking-[0.14em] text-misa-muted uppercase">Awarded</th>
            <th className="py-2 pr-4 align-bottom text-[12px] font-medium tracking-[0.14em] text-misa-muted uppercase">Member</th>
            <th className="py-2 pr-4 align-bottom text-[12px] font-medium tracking-[0.14em] text-misa-muted uppercase">Points</th>
            <th className="py-2 pr-4 align-bottom text-[12px] font-medium tracking-[0.14em] text-misa-muted uppercase">Category</th>
            <th className="py-2 pr-4 align-bottom text-[12px] font-medium tracking-[0.14em] text-misa-muted uppercase">Reason</th>
            <th className="py-2 pr-4 align-bottom text-[12px] font-medium tracking-[0.14em] text-misa-muted uppercase">Event</th>
            <th className="py-2 pr-4 align-bottom text-[12px] font-medium tracking-[0.14em] text-misa-muted uppercase">Term</th>
            <th className="py-2 align-bottom text-[12px] font-medium tracking-[0.14em] text-misa-muted uppercase">Officer</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={`border-b border-misa-hairline align-top transition-colors duration-150 hover:bg-misa-panel/70 ${
                row.voided ? "text-misa-muted" : ""
              }`}
            >
              <td className="py-2 pr-4 whitespace-nowrap">
                <Link
                  href={`/admin/points/${row.id}${hrefSuffix}`}
                  className="underline underline-offset-2"
                >
                  {row.awardedLabel} CT
                </Link>
              </td>
              <td className="py-2 pr-4">
                {row.members ? (
                  // Filters the ledger rather than opening the member page,
                  // deliberately: from here the useful next question is "what
                  // else was awarded to this person", not "who are they". The
                  // member page carries its own adjustment list for the other
                  // direction.
                  <Link
                    href={memberHref(row.member_id)}
                    className="underline underline-offset-2"
                  >
                    {row.members.full_name}
                  </Link>
                ) : (
                  <span className="text-misa-muted">unknown member</span>
                )}
                {row.members?.active === false && (
                  <span className="ml-2 text-xs text-misa-muted">
                    inactive
                  </span>
                )}
              </td>
              <td className="py-2 pr-4 font-mono whitespace-nowrap">
                <span className={row.voided ? "line-through" : ""}>
                  {signedPoints(row.points)}
                </span>
                {row.voided && (
                  <span className="ml-2 border border-misa-border px-2 py-0.5 text-[11px] tracking-[0.12em] uppercase">
                    voided
                  </span>
                )}
              </td>
              <td className="py-2 pr-4">{formatPointCategory(row.category)}</td>
              <td className="py-2 pr-4">{row.reason}</td>
              <td className="py-2 pr-4">
                {row.events ? (
                  <Link
                    href={`/admin/events/${row.events.id}`}
                    className="underline underline-offset-2"
                  >
                    {row.events.title}
                  </Link>
                ) : (
                  <span className="text-misa-muted">—</span>
                )}
              </td>
              {/* Not decoration: both views are scoped to current_term(), so a
                  live grant in a past term counts for nothing. Without this
                  column the ledger and the directory appear to disagree with
                  no visible reason. */}
              <td className="py-2 pr-4 whitespace-nowrap">{row.term}</td>
              <td className="py-2">{row.officerLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

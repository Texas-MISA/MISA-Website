"use client";

import Link from "next/link";

import { StatusPill } from "@/app/admin/(shell)/_components/status-pill";

// Presentational only — the page owns the query, matching event-table.tsx.
//
// ⚠️ A Client Component since bulk selection landed, which is why every date
// arrives pre-formatted as `submittedLabel`. Calling Intl.DateTimeFormat in
// here would run it on both sides of hydration, and Node and Chrome ship
// different ICU data for the space before "PM" — React then reports a mismatch
// between two strings that are character-for-character identical on screen.
// Server Components own date formatting.

export type SubmissionRow = {
  id: string;
  submitted_name: string;
  submitted_eid: string;
  submitted_email: string;
  submittedLabel: string;
  status: string;
  source: string;
  event_id: string | null;
  events: { id: string; title: string; status: string } | null;
};

export function AttendanceTable({
  rows,
  hrefSuffix,
  selected,
  onToggle,
  onToggleAll,
}: {
  rows: SubmissionRow[];
  /** The queue's own filters, so a row opens and comes back to this view. */
  hrefSuffix: string;
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="border border-misa-blue/35 bg-misa-panel px-4 py-3 text-sm">
        No submissions match these filters.
      </p>
    );
  }

  // Only pending rows can be bulk-assigned, so only they get a checkbox. That
  // is also the clearest way to say so.
  const selectableIds = rows
    .filter((row) => row.status === "pending")
    .map((row) => row.id);
  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selected.has(id));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[60rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-misa-border text-left">
            <th className="py-2 pr-3 align-bottom text-[12px] font-medium tracking-[0.14em] text-misa-muted uppercase">
              {selectableIds.length > 0 && (
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onToggleAll(selectableIds, e.target.checked)}
                  // "Select all" here means the pending rows on this page, and
                  // never "all N matching the filter" — conflating the two is
                  // how this kind of screen quietly produces a partial write.
                  aria-label="Select every pending row shown"
                />
              )}
            </th>
            <th className="py-2 pr-4 align-bottom text-[12px] font-medium tracking-[0.14em] text-misa-muted uppercase">Submitted</th>
            <th className="py-2 pr-4 align-bottom text-[12px] font-medium tracking-[0.14em] text-misa-muted uppercase">Name</th>
            <th className="py-2 pr-4 align-bottom text-[12px] font-medium tracking-[0.14em] text-misa-muted uppercase">EID</th>
            <th className="py-2 pr-4 align-bottom text-[12px] font-medium tracking-[0.14em] text-misa-muted uppercase">Event</th>
            <th className="py-2 align-bottom text-[12px] font-medium tracking-[0.14em] text-misa-muted uppercase">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-misa-hairline align-top transition-colors duration-150 hover:bg-misa-panel/70">
              <td className="py-2 pr-3">
                {row.status === "pending" && (
                  <input
                    type="checkbox"
                    name="ids"
                    value={row.id}
                    checked={selected.has(row.id)}
                    onChange={() => onToggle(row.id)}
                    aria-label={`Select ${row.submitted_name}`}
                  />
                )}
              </td>
              <td className="py-2 pr-4 whitespace-nowrap">
                <Link
                  href={`/admin/attendance/${row.id}${hrefSuffix}`}
                  className="underline underline-offset-2"
                >
                  {row.submittedLabel} CT
                </Link>
              </td>
              <td className="py-2 pr-4">
                {row.submitted_name}
                {row.source === "admin_manual" && (
                  <span className="ml-2 text-xs text-misa-muted">
                    entered by an officer
                  </span>
                )}
              </td>
              <td className="py-2 pr-4 font-mono text-xs">
                {row.submitted_eid}
              </td>
              <td className="py-2 pr-4">
                <Unlinked value={row.events?.title} label="no event" />
              </td>
              <td className="py-2">
                <StatusPill status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A missing link is the whole reason a row is in this queue, so it is named
 * rather than left as an empty cell. */
function Unlinked({ value, label }: { value?: string; label: string }) {
  if (value) return <>{value}</>;
  return <span className="text-misa-muted">{label}</span>;
}

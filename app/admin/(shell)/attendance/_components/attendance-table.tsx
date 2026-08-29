"use client";

import Link from "next/link";

import { Notice } from "@/app/admin/(shell)/_components/notice";
import { StatusPill } from "@/app/admin/(shell)/_components/status-pill";
import { CHECKBOX } from "@/components/ui/field";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";

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
      <Notice>No submissions match these filters.</Notice>
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
    <Table minWidth="min-w-[60rem]">
      <THead>
        <Tr hover={false}>
          <Th className="pr-3">
            {selectableIds.length > 0 && (
              <input
                type="checkbox"
                className={CHECKBOX}
                checked={allSelected}
                onChange={(e) => onToggleAll(selectableIds, e.target.checked)}
                // "Select all" here means the pending rows on this page, and
                // never "all N matching the filter" — conflating the two is
                // how this kind of screen quietly produces a partial write.
                aria-label="Select every pending row shown"
              />
            )}
          </Th>
          <Th>Submitted</Th>
          <Th>Name</Th>
          <Th>EID</Th>
          <Th>Event</Th>
          <Th>Status</Th>
        </Tr>
      </THead>
      <tbody>
        {rows.map((row) => (
          <Tr key={row.id} className="align-top">
            <Td className="pr-3">
              {row.status === "pending" && (
                <input
                  type="checkbox"
                  className={CHECKBOX}
                  name="ids"
                  value={row.id}
                  checked={selected.has(row.id)}
                  onChange={() => onToggle(row.id)}
                  aria-label={`Select ${row.submitted_name}`}
                />
              )}
            </Td>
            <Td className="whitespace-nowrap">
              <Link
                href={`/admin/attendance/${row.id}${hrefSuffix}`}
                className="underline underline-offset-2"
              >
                {row.submittedLabel} CT
              </Link>
            </Td>
            <Td>
              {row.submitted_name}
              {row.source === "admin_manual" && (
                <span className="ml-2 text-xs text-misa-muted">
                  entered by an officer
                </span>
              )}
            </Td>
            <Td className="font-mono text-xs">{row.submitted_eid}</Td>
            <Td>
              <Unlinked value={row.events?.title} label="no event" />
            </Td>
            <Td>
              <StatusPill status={row.status} />
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

/** A missing link is the whole reason a row is in this queue, so it is named
 * rather than left as an empty cell. */
function Unlinked({ value, label }: { value?: string; label: string }) {
  if (value) return <>{value}</>;
  return <span className="text-misa-muted">{label}</span>;
}

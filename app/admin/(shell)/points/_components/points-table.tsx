import Link from "next/link";

import { Notice } from "@/app/admin/(shell)/_components/notice";
import { Pill } from "@/components/ui/pill";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
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
  members: { id: string; full_name: string } | null;
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
      <Notice>No adjustments match these filters.</Notice>
    );
  }

  return (
    <Table minWidth="min-w-[64rem]">
      <THead>
        <Tr hover={false}>
          <Th>Awarded</Th>
          <Th>Member</Th>
          <Th>Points</Th>
          <Th>Category</Th>
          <Th>Reason</Th>
          <Th>Event</Th>
          <Th>Term</Th>
          <Th>Officer</Th>
        </Tr>
      </THead>
      <tbody>
        {rows.map((row) => (
          // `muted` is the vocabulary's word for voided/archived/superseded —
          // still true, just not current.
          <Tr key={row.id} muted={row.voided} className="align-top">
            <Td className="whitespace-nowrap">
              <Link
                href={`/admin/points/${row.id}${hrefSuffix}`}
                className="underline underline-offset-2"
              >
                {row.awardedLabel} CT
              </Link>
            </Td>
            <Td>
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
            </Td>
            {/* Mono rather than `numeric`: a signed figure sharing its cell
                with a badge cannot be right-aligned without pushing the badge
                to the column edge, and mono numerals already align. */}
            <Td className="font-mono whitespace-nowrap">
              <span className={row.voided ? "line-through" : ""}>
                {signedPoints(row.points)}
              </span>
              {row.voided && (
                <Pill tone="critical" className="ml-2">
                  voided
                </Pill>
              )}
            </Td>
            <Td>{formatPointCategory(row.category)}</Td>
            <Td>{row.reason}</Td>
            <Td>
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
            </Td>
            {/* Not decoration: both views are scoped to current_term(), so a
                live grant in a past term counts for nothing. Without this
                column the ledger and the directory appear to disagree with
                no visible reason. */}
            <Td className="whitespace-nowrap">{row.term}</Td>
            <Td>{row.officerLabel}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

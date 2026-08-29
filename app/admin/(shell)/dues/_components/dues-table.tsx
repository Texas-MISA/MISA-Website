import Link from "next/link";

import { Notice } from "@/app/admin/(shell)/_components/notice";
import { Pill } from "@/components/ui/pill";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";

// Presentational only — the page owns the query, matching points-table.tsx.
//
// A Server Component: the ledger holds no selection, and every amount, date and
// term arrives pre-formatted. Intl inside a Client Component runs on both sides
// of hydration and Node and Chrome ship different ICU data, so the page is the
// one place in this subtree that formats anything.

export type DuesLedgerRow = {
  id: string;
  /** Central, formatted by the page. */
  paidLabel: string;
  amountLabel: string;
  payerName: string | null;
  note: string | null;
  memberId: string | null;
  memberName: string | null;
  /** The terms this payment actually covers, or null while undecided. */
  coveredTerms: string[] | null;
  startTerm: string;
  voided: boolean;
  noMember: boolean;
  undecidedAmount: boolean;
};

export function DuesTable({
  rows,
  hrefSuffix,
  memberHref,
}: {
  rows: DuesLedgerRow[];
  /** The ledger's own filters, so a row opens and comes back to this view. */
  hrefSuffix: string;
  /** Builds the "filter to this member" link, preserving the other filters. */
  memberHref: (memberId: string) => string;
}) {
  if (rows.length === 0) {
    return (
      <Notice>No payments match these filters.</Notice>
    );
  }

  return (
    <Table minWidth="min-w-[64rem]">
      <THead>
        <Tr hover={false}>
          <Th>Paid</Th>
          <Th>Payer</Th>
          <Th>Member</Th>
          <Th>Amount</Th>
          <Th>Covers</Th>
          <Th>Note</Th>
          <Th wrap>Needs review</Th>
        </Tr>
      </THead>
      <tbody>
        {rows.map((row) => (
          <Tr key={row.id} muted={row.voided} className="align-top">
            <Td className="whitespace-nowrap">
              <Link
                href={`/admin/dues/${row.id}${hrefSuffix}`}
                className="underline underline-offset-2"
              >
                {row.paidLabel} CT
              </Link>
            </Td>
            <Td>
              {row.payerName ?? <span className="text-misa-muted">—</span>}
            </Td>
            <Td>
              {row.memberId && row.memberName ? (
                // Filters the ledger rather than opening the member page, for
                // the same reason the points ledger does: from here the useful
                // next question is "what else has this person paid".
                <Link
                  href={memberHref(row.memberId)}
                  className="underline underline-offset-2"
                >
                  {row.memberName}
                </Link>
              ) : (
                <span className="text-misa-muted">nobody yet</span>
              )}
            </Td>
            {/* Mono rather than `numeric`, as in the points ledger: the badge
                shares the cell, and mono numerals already align. */}
            <Td className="font-mono whitespace-nowrap">
              <span className={row.voided ? "line-through" : ""}>
                {row.amountLabel}
              </span>
              {row.voided && (
                <Pill tone="critical" className="ml-2">
                  voided
                </Pill>
              )}
            </Td>
            {/* Not decoration. member_directory is scoped to current_term(),
                so a live payment covering only past terms counts for nothing
                — without this column the ledger and the directory appear to
                disagree with no visible reason. Same argument as the points
                ledger's Term column. */}
            <Td className="whitespace-nowrap">
              {row.coveredTerms && row.coveredTerms.length > 0 ? (
                row.coveredTerms.join(", ")
              ) : (
                <span className="text-misa-muted">
                  nothing yet — from {row.startTerm}
                </span>
              )}
            </Td>
            <Td className="max-w-[18rem] break-words">
              {row.note ?? <span className="text-misa-muted">—</span>}
            </Td>
            <Td className="whitespace-nowrap">
              <ReviewFlags row={row} />
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

/**
 * Why this row is still waiting.
 *
 * ⚠️ "No member" and not "unmatched" or "ambiguous". Those are two parse
 * outcomes and one storage outcome — nothing persists which of them happened —
 * so claiming to tell them apart here would be inventing information the row
 * does not carry. The note is on screen beside this; reading it is the officer's
 * next move anyway.
 */
function ReviewFlags({ row }: { row: DuesLedgerRow }) {
  if (row.voided) return <span className="text-misa-muted">—</span>;
  if (!row.noMember && !row.undecidedAmount) {
    return <span className="text-misa-muted">—</span>;
  }

  return (
    <span className="flex flex-col items-start gap-1">
      {row.noMember && <Pill tone="caution">no member</Pill>}
      {row.undecidedAmount && <Pill tone="caution">amount undecided</Pill>}
    </span>
  );
}

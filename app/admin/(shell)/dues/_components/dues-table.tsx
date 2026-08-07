import Link from "next/link";

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
  memberActive: boolean;
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
      <p className="border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm">
        No payments match these filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[64rem] border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-2 pr-4 font-medium">Paid</th>
            <th className="py-2 pr-4 font-medium">Payer</th>
            <th className="py-2 pr-4 font-medium">Member</th>
            <th className="py-2 pr-4 font-medium">Amount</th>
            <th className="py-2 pr-4 font-medium">Covers</th>
            <th className="py-2 pr-4 font-medium">Note</th>
            <th className="py-2 font-medium">Needs review</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={`border-b border-black/15 align-top ${
                row.voided ? "text-foreground/50" : ""
              }`}
            >
              <td className="py-2 pr-4 whitespace-nowrap">
                <Link
                  href={`/admin/dues/${row.id}${hrefSuffix}`}
                  className="underline underline-offset-2"
                >
                  {row.paidLabel} CT
                </Link>
              </td>
              <td className="py-2 pr-4">
                {row.payerName ?? <span className="text-foreground/50">—</span>}
              </td>
              <td className="py-2 pr-4">
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
                  <span className="text-foreground/50">nobody yet</span>
                )}
                {row.memberId && !row.memberActive && (
                  <span className="ml-2 text-xs text-foreground/50">
                    inactive
                  </span>
                )}
              </td>
              <td className="py-2 pr-4 font-mono whitespace-nowrap">
                <span className={row.voided ? "line-through" : ""}>
                  {row.amountLabel}
                </span>
                {row.voided && (
                  <span className="ml-2 border border-black/30 px-2 py-0.5 text-[0.7rem] tracking-wider uppercase">
                    voided
                  </span>
                )}
              </td>
              {/* Not decoration. member_directory is scoped to current_term(),
                  so a live payment covering only past terms counts for nothing
                  — without this column the ledger and the directory appear to
                  disagree with no visible reason. Same argument as the points
                  ledger's Term column. */}
              <td className="py-2 pr-4 whitespace-nowrap">
                {row.coveredTerms && row.coveredTerms.length > 0 ? (
                  row.coveredTerms.join(", ")
                ) : (
                  <span className="text-foreground/50">
                    nothing yet — from {row.startTerm}
                  </span>
                )}
              </td>
              <td className="py-2 pr-4 max-w-[18rem] break-words">
                {row.note ?? <span className="text-foreground/50">—</span>}
              </td>
              <td className="py-2 whitespace-nowrap">
                <ReviewFlags row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
  if (row.voided) return <span className="text-foreground/50">—</span>;
  if (!row.noMember && !row.undecidedAmount) {
    return <span className="text-foreground/50">—</span>;
  }

  return (
    <span className="flex flex-col gap-1">
      {row.noMember && (
        <span className="border border-amber-700 px-2 py-0.5 text-[0.7rem] tracking-wider uppercase">
          no member
        </span>
      )}
      {row.undecidedAmount && (
        <span className="border border-amber-700 px-2 py-0.5 text-[0.7rem] tracking-wider uppercase">
          amount undecided
        </span>
      )}
    </span>
  );
}

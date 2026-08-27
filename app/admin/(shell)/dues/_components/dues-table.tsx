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
      <p className="border border-misa-blue/35 bg-misa-panel px-4 py-3 text-sm">
        No payments match these filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[64rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-misa-border text-left">
            <th className="py-2 pr-4 align-bottom text-[12px] font-medium tracking-[0.14em] text-misa-muted uppercase">Paid</th>
            <th className="py-2 pr-4 align-bottom text-[12px] font-medium tracking-[0.14em] text-misa-muted uppercase">Payer</th>
            <th className="py-2 pr-4 align-bottom text-[12px] font-medium tracking-[0.14em] text-misa-muted uppercase">Member</th>
            <th className="py-2 pr-4 align-bottom text-[12px] font-medium tracking-[0.14em] text-misa-muted uppercase">Amount</th>
            <th className="py-2 pr-4 align-bottom text-[12px] font-medium tracking-[0.14em] text-misa-muted uppercase">Covers</th>
            <th className="py-2 pr-4 align-bottom text-[12px] font-medium tracking-[0.14em] text-misa-muted uppercase">Note</th>
            <th className="py-2 align-bottom text-[12px] font-medium tracking-[0.14em] text-misa-muted uppercase">Needs review</th>
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
                  href={`/admin/dues/${row.id}${hrefSuffix}`}
                  className="underline underline-offset-2"
                >
                  {row.paidLabel} CT
                </Link>
              </td>
              <td className="py-2 pr-4">
                {row.payerName ?? <span className="text-misa-muted">—</span>}
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
                  <span className="text-misa-muted">nobody yet</span>
                )}
              </td>
              <td className="py-2 pr-4 font-mono whitespace-nowrap">
                <span className={row.voided ? "line-through" : ""}>
                  {row.amountLabel}
                </span>
                {row.voided && (
                  <span className="ml-2 border border-misa-border px-2 py-0.5 text-[11px] tracking-[0.12em] uppercase">
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
                  <span className="text-misa-muted">
                    nothing yet — from {row.startTerm}
                  </span>
                )}
              </td>
              <td className="py-2 pr-4 max-w-[18rem] break-words">
                {row.note ?? <span className="text-misa-muted">—</span>}
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
  if (row.voided) return <span className="text-misa-muted">—</span>;
  if (!row.noMember && !row.undecidedAmount) {
    return <span className="text-misa-muted">—</span>;
  }

  return (
    <span className="flex flex-col gap-1">
      {row.noMember && (
        <span className="border border-misa-caution px-2 py-0.5 text-[11px] tracking-[0.12em] uppercase">
          no member
        </span>
      )}
      {row.undecidedAmount && (
        <span className="border border-misa-caution px-2 py-0.5 text-[11px] tracking-[0.12em] uppercase">
          amount undecided
        </span>
      )}
    </span>
  );
}

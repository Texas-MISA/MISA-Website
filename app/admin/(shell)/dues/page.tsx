import { BUTTON_PRIMARY_SM } from "@/components/ui/button";
import type { Metadata } from "next";
import Link from "next/link";

import { requireOfficer } from "@/lib/auth";
import {
  formatCents,
  isLaterTerm,
  paymentReviewState,
  termIndex,
} from "@/lib/dues";
import {
  addCivilDays,
  centralWallTimeToInstant,
  formatInstant,
} from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";

import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/app/admin/(shell)/_components/notice";
import { DuesFilters } from "./_components/dues-filters";
import { DuesTable, type DuesLedgerRow } from "./_components/dues-table";

// The dues ledger (§4.1, §7 Stage 6.5 phase 3). Every payment the import has
// ever recorded, and — the part that makes this screen worth building — the
// handful the parser could not resolve.
//
// The import deliberately decides as little as possible: a note naming nobody,
// a note naming two members, and an amount matching neither configured price all
// produce a stored row with member_id or terms_covered null. Because
// covered_terms is generated from a nullable terms_covered, every one of those
// covers nothing and its member reads Not Paid. This is where they get drained.
//
// Service-role read: dues_payments is deny-all under RLS until Stage 8.

export const metadata: Metadata = { title: "Dues" };

const LIMIT = 200;

/**
 * How deep to look for the terms that populate the filter.
 *
 * PostgREST has no `select distinct` and phase 3 ships no migration, so the term
 * list is a bounded scan, exactly as the points ledger builds its officer list.
 * Deeper than LIMIT so a term whose payments have all scrolled off page one
 * still appears.
 */
const TERM_SCAN_LIMIT = 1000;

/** ⚠️ Unbroken `as const` literal. PostgREST types the returned row off the
 * string literal, so a concatenation widens it to plain `string` and collapses
 * every field access at once — this has bitten twice already. */
const LEDGER_COLUMNS =
  "id, paid_at, amount_cents, note, payer_name, member_id, start_term, terms_covered, covered_terms, voided_at, members(id, full_name)" as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Filters = {
  state: "all" | "review" | "live" | "voided";
  term: string;
  member: string;
  from: string;
  to: string;
};

/** The needs-review predicate, in one place because two queries ask it: the
 * table when `state=review`, and the header count that is never filtered. It is
 * character-for-character `dues_payments_review_idx`'s predicate. */
const REVIEW_OR = "member_id.is.null,terms_covered.is.null" as const;

type RawPayment = {
  id: string;
  paid_at: string;
  amount_cents: number;
  note: string | null;
  payer_name: string | null;
  member_id: string | null;
  start_term: string;
  terms_covered: number | null;
  covered_terms: string[] | null;
  voided_at: string | null;
  members: { id: string; full_name: string } | null;
};

async function fetchLedger(
  filters: Filters
): Promise<
  { kind: "ok"; rows: DuesLedgerRow[]; total: number } | { kind: "error" }
> {
  const db = createAdminClient();

  let query = db
    .from("dues_payments")
    .select(LEDGER_COLUMNS, { count: "exact" })
    .order("paid_at", { ascending: false })
    // A paginated list needs a total ORDER, not merely a sort — and two members
    // can pay in the same minute, so ties here are ordinary rather than
    // theoretical. Without this the LIMIT below can cut a tied pair differently
    // per request, which reads as missing data rather than as an ordering fault.
    .order("id")
    .limit(LIMIT);

  if (filters.state === "review") {
    query = query.is("voided_at", null).or(REVIEW_OR);
  } else if (filters.state === "live") {
    query = query.is("voided_at", null);
  } else if (filters.state === "voided") {
    query = query.not("voided_at", "is", null);
  }

  if (filters.member) query = query.eq("member_id", filters.member);
  // Containment against the generated array column, served by
  // dues_payments_covered_idx. Asking "does this payment cover term X" rather
  // than "does it start at term X" is the question the directory asks, so the
  // filter and the column agree by construction.
  if (filters.term) query = query.contains("covered_terms", [filters.term]);

  // Central wall time made into instants, half-open at the top. A bare
  // .lte("paid_at", "2026-04-07") would be read as UTC midnight and silently
  // drop the last five or six hours of a Central day — an evening payment on the
  // last day of the range simply vanishing from the officer's reconciliation.
  if (filters.from) {
    query = query.gte(
      "paid_at",
      centralWallTimeToInstant(filters.from, "00:00").toISOString()
    );
  }
  if (filters.to) {
    query = query.lt(
      "paid_at",
      centralWallTimeToInstant(addCivilDays(filters.to, 1), "00:00").toISOString()
    );
  }

  const { data, error, count } = await query;
  if (error) {
    console.error("dues ledger query failed:", error.message);
    return { kind: "error" };
  }

  const raw = data as unknown as RawPayment[];

  // paid_at is dropped on the way out rather than passed along — a raw timestamp
  // in a child component's props is an invitation to format it there, and Server
  // Components own date formatting.
  const rows: DuesLedgerRow[] = raw.map((row) => {
    const review = paymentReviewState(row);
    return {
      id: row.id,
      paidLabel: formatInstant(row.paid_at),
      amountLabel: formatCents(row.amount_cents),
      payerName: row.payer_name,
      note: row.note,
      memberId: row.member_id,
      memberName: row.members?.full_name ?? null,
      coveredTerms: row.covered_terms,
      startTerm: row.start_term,
      voided: row.voided_at !== null,
      noMember: review.noMember,
      undecidedAmount: review.undecidedAmount,
    };
  });

  return { kind: "ok", rows, total: count ?? raw.length };
}

/**
 * How many payments an officer still has to act on.
 *
 * Its own `head: true` count rather than a number read off the table, because
 * this is the one number that must be true regardless of what the officer has
 * filtered to. Behind a filter it would answer "how many of the rows you are
 * looking at need review", which is not the question.
 */
async function fetchReviewCount(): Promise<number | null> {
  const db = createAdminClient();
  const { count, error } = await db
    .from("dues_payments")
    .select("id", { count: "exact", head: true })
    .is("voided_at", null)
    .or(REVIEW_OR);

  if (error) {
    console.error("dues review count failed:", error.message);
    return null;
  }
  return count ?? 0;
}

/**
 * The terms offered by the filter.
 *
 * Never a typed term string (§4.7): these come from what the database actually
 * holds, plus `current_term()` so the term officers care about most is offered
 * even before anyone has paid for it. Sorted by term index — `'Fall 2026' <
 * 'Spring 2026'` is true as a string compare and false as a calendar fact.
 */
async function fetchTermOptions(selected: string): Promise<string[]> {
  const db = createAdminClient();

  const [scan, current] = await Promise.all([
    db
      .from("dues_payments")
      .select("start_term, covered_terms")
      .order("paid_at", { ascending: false })
      .limit(TERM_SCAN_LIMIT),
    db.rpc("current_term"),
  ]);

  if (scan.error) {
    console.error("dues term options query failed:", scan.error.message);
  }
  if (current.error) {
    console.error("current_term rpc failed:", current.error.message);
  }

  const terms = new Set<string>();
  for (const row of scan.data ?? []) {
    if (row.start_term) terms.add(row.start_term);
    for (const term of row.covered_terms ?? []) terms.add(term);
  }
  if (current.data) terms.add(current.data);
  // A bookmarked ?term=… older than the scan would otherwise render a <select>
  // with no matching option — blank on screen while the results below are
  // genuinely filtered. A filter that looks cleared but isn't is worse than one
  // that is missing.
  if (selected) terms.add(selected);

  return [...terms]
    .filter((term) => termIndex(term) !== null)
    .sort((a, b) => (isLaterTerm(a, b) ? -1 : 1));
}

/** The name behind an active `?member=` filter, for the chip. */
async function fetchMemberLabel(memberId: string): Promise<string | null> {
  if (!memberId) return null;
  const db = createAdminClient();
  const { data, error } = await db
    .from("members")
    .select("full_name")
    .eq("id", memberId)
    .maybeSingle();

  if (error) {
    console.error("member label query failed:", error.message);
    return null;
  }
  return data?.full_name ?? null;
}

/** The active filters as a query string, so opening a payment and coming back
 * lands on the same view rather than the unfiltered default. */
function filterSuffix(params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

function uuidOrEmpty(value: string | undefined): string {
  return value && UUID_RE.test(value) ? value : "";
}

export default async function AdminDuesPage({
  searchParams,
}: {
  // Promise in Next 16 — await before reading.
  searchParams: Promise<{
    state?: string;
    term?: string;
    member?: string;
    from?: string;
    to?: string;
  }>;
}) {
  await requireOfficer();

  const params = await searchParams;

  const filters: Filters = {
    state:
      params.state === "review"
        ? "review"
        : params.state === "live"
          ? "live"
          : params.state === "voided"
            ? "voided"
            : "all",
    // Checked for shape before it reaches a query. A term that is not a term
    // narrows nothing and would only ever arrive from a hand-edited URL.
    term: params.term && termIndex(params.term) !== null ? params.term : "",
    member: uuidOrEmpty(params.member),
    from: params.from ?? "",
    to: params.to ?? "",
  };

  const [result, reviewCount, terms, memberLabel] = await Promise.all([
    fetchLedger(filters),
    fetchReviewCount(),
    fetchTermOptions(filters.term),
    fetchMemberLabel(filters.member),
  ]);

  const suffix = filterSuffix(params);

  // "Filter to this member", keeping every other filter the officer set.
  function memberHref(memberId: string): string {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) next.set(key, value);
    }
    next.set("member", memberId);
    return `/admin/dues?${next.toString()}`;
  }

  return (
    <div>
      <PageHeader
        title="Dues"
        action={
          <Link href="/admin/dues/import" className={BUTTON_PRIMARY_SM}>
            IMPORT A STATEMENT
          </Link>
        }
        description="Every payment reconciled from a Venmo statement. A member counts as official for a term when a live payment covers it — nothing here is ticked by hand, and voiding a payment takes that status away again."
      />

      {/* The number an officer acts on, so it sits in the header rather than
          behind a filter. It is counted across the whole table, not across the
          current view. */}
      <p className="mt-4 text-sm">
        {reviewCount === null ? (
          <span className="text-misa-muted">
            Couldn&apos;t count what needs review.
          </span>
        ) : reviewCount === 0 ? (
          <span className="text-misa-muted">
            Nothing is waiting on an officer.
          </span>
        ) : (
          <Link
            href="/admin/dues?state=review"
            className="border border-misa-caution/45 bg-misa-caution-wash px-4 py-2 underline underline-offset-2"
          >
            {reviewCount} payment{reviewCount === 1 ? "" : "s"} need
            {reviewCount === 1 ? "s" : ""} an officer
          </Link>
        )}
      </p>

      <div className="mt-6">
        <DuesFilters
          terms={terms}
          memberLabel={memberLabel}
          selected={{
            state: filters.state,
            term: filters.term,
            from: filters.from,
            to: filters.to,
          }}
        />
      </div>

      <div className="mt-8">
        {result.kind === "error" ? (
          <Notice>
            Couldn&apos;t load the dues ledger.
          </Notice>
        ) : (
          <>
            <p className="mb-3 text-xs text-misa-muted">
              {result.total === 0
                ? "No matching payments."
                : result.total > result.rows.length
                  ? `Showing the first ${result.rows.length} of ${result.total} matching payments.`
                  : `${result.total} matching payment${result.total === 1 ? "" : "s"}.`}
            </p>
            <DuesTable
              rows={result.rows}
              hrefSuffix={suffix}
              memberHref={memberHref}
            />
          </>
        )}
      </div>
    </div>
  );
}

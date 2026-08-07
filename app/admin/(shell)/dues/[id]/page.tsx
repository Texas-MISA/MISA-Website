import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AuditTrail } from "@/app/admin/(shell)/_components/audit-trail";
import { describeOfficer, fetchOfficerNames } from "@/lib/admin-profiles";
import { MEMBER_SCAN_LIMIT, type MemberCandidate } from "@/lib/attendance";
import { requireOfficer } from "@/lib/auth";
import {
  formatCents,
  isSummerTerm,
  paymentReviewState,
  rankPaymentSuggestions,
  startTermOptions,
  termOf,
} from "@/lib/dues";
import { formatInstant } from "@/lib/events";
import { fetchMemberOptions } from "@/lib/member-options";
import { createAdminClient } from "@/lib/supabase/admin";

import { PaymentEditor } from "./_components/payment-editor";
import { PaymentSuggestions } from "./_components/payment-suggestions";
import { VoidPaymentForm } from "./_components/void-payment-form";

// One payment: what arrived, who it credits, and the two things an officer can
// do about it (§7 Stage 6.5 phase 3).
//
// A payment is EDITABLE, unlike a point adjustment — the parser attributes it
// from member-supplied free text, so getting one wrong is an ordinary outcome
// and correcting it is legitimate. It is also VOIDABLE rather than deletable,
// like a point adjustment, because money arriving is a fact. This screen is
// deliberately both.
//
// Service-role read: dues_payments is deny-all under RLS until Stage 8.

export const metadata: Metadata = { title: "Payment" };

/** ⚠️ Unbroken `as const` literal — PostgREST types the row off the string
 * literal, and a concatenation widens it to plain `string`. */
const DETAIL_COLUMNS =
  "id, venmo_txn_id, member_id, paid_at, amount_cents, note, payer_name, payer_handle, submitted_eid, start_term, terms_covered, covered_terms, import_batch_id, imported_by, imported_at, voided_at, voided_by, void_reason, updated_at, members(id, full_name, eid, active)" as const;

type Payment = {
  id: string;
  venmo_txn_id: string;
  member_id: string | null;
  paid_at: string;
  amount_cents: number;
  note: string | null;
  payer_name: string | null;
  payer_handle: string | null;
  submitted_eid: string | null;
  start_term: string;
  terms_covered: number | null;
  covered_terms: string[] | null;
  import_batch_id: string;
  imported_by: string;
  imported_at: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  updated_at: string;
  members: { id: string; full_name: string; eid: string; active: boolean } | null;
};

async function fetchPayment(id: string): Promise<Payment | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("dues_payments")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("payment query failed:", error.message);
    return null;
  }
  return data as unknown as Payment | null;
}

/**
 * Roster candidates for an unmatched payment.
 *
 * Scanned, not probed — `ilike '%jon%'` cannot match `John`, so a probe-based
 * candidate set structurally excludes the row we are looking for. Same shape and
 * the same caveat as the attendance resolution screen: ⚠️ past
 * MEMBER_SCAN_LIMIT this scores an arbitrary subset with nothing on screen to
 * say so. Fix the limit (pg_trgm), never add an order here — an order would only
 * make the truncation deterministic, not correct.
 */
async function fetchSuggestions(payment: Payment) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("members")
    .select("id, full_name, email, eid, normalized_eid, active")
    .eq("active", true)
    .limit(MEMBER_SCAN_LIMIT);

  if (error) {
    console.error("payment candidate query failed:", error.message);
    return [];
  }

  const candidates: MemberCandidate[] = data.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    eid: row.eid,
    normalizedEid: row.normalized_eid ?? "",
    active: row.active,
  }));

  return rankPaymentSuggestions(
    { payerName: payment.payer_name, note: payment.note },
    candidates
  );
}

export default async function PaymentDetailPage({
  params,
  searchParams,
}: {
  // Promise in Next 16 — await before reading.
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOfficer();
  const { id } = await params;

  const payment = await fetchPayment(id);
  if (!payment) notFound();

  // The ledger's filters ride along, so closing this lands on the view the
  // officer was working rather than the unfiltered default.
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string" && value) query.set(key, value);
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const backToLedger = `/admin/dues${suffix}`;

  const db = createAdminClient();
  const review = paymentReviewState(payment);
  const voided = payment.voided_at !== null;
  const paidAt = new Date(payment.paid_at);

  const [names, members, suggestions] = await Promise.all([
    fetchOfficerNames(
      db,
      [payment.imported_by, payment.voided_by].filter(
        (v): v is string => v !== null
      )
    ),
    // includeId keeps a deactivated but currently-credited member in the list;
    // dropping them would silently unlink them on the next save.
    voided
      ? Promise.resolve([])
      : fetchMemberOptions(db, { includeId: payment.member_id }),
    review.noMember && !voided ? fetchSuggestions(payment) : Promise.resolve([]),
  ]);

  // Derived from the payment date by the same rule the database uses (§4.7) —
  // never a typed term string, here or in the picker's options.
  const derivedTerm = termOf(paidAt);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          Payment
        </h1>
        {voided && (
          <span className="border border-black/30 px-2 py-0.5 text-[0.7rem] tracking-wider uppercase">
            voided
          </span>
        )}
      </div>

      <p className="mt-3 text-sm">
        <Link href={backToLedger} className="underline">
          ← Back to the ledger
        </Link>
      </p>

      {!voided && review.needsReview && (
        <p className="mt-6 max-w-3xl border-l-4 border-amber-700 bg-misa-panel px-4 py-3 text-sm">
          {review.noMember && review.undecidedAmount
            ? "Nobody is credited with this payment and nothing has been decided about what it bought."
            : review.noMember
              ? "Nobody is credited with this payment — the note named no member on the roster, or named more than one."
              : "Nobody has decided how many terms this amount bought, so it currently covers nothing."}{" "}
          It counts towards nobody&apos;s membership until that is settled.
        </p>
      )}

      <section className="mt-10 max-w-3xl">
        <h2 className="font-display text-xl font-bold">What arrived</h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-[10rem_1fr]">
          <Row label="Amount">
            <span className={voided ? "line-through" : ""}>
              {formatCents(payment.amount_cents)}
            </span>
          </Row>
          <Row label="Paid at">
            {formatInstant(payment.paid_at)} CT
            {isSummerTerm(paidAt) && (
              <span className="ml-2 text-xs text-foreground/60">
                summer — {derivedTerm} by date, which may not be what the payer
                meant
              </span>
            )}
          </Row>
          <Row label="From">
            {payment.payer_name ?? <Missing />}
            {payment.payer_handle && (
              <span className="ml-2 text-foreground/60">
                {payment.payer_handle}
              </span>
            )}
          </Row>
          <Row label="Note">
            {payment.note ? (
              // Member-supplied text. Rendered as text by React, which escapes
              // it; the formula-injection concern is the CSV export's, and its
              // escape lives in lib/export.ts's writer.
              <span className="break-words">{payment.note}</span>
            ) : (
              <Missing />
            )}
          </Row>
          <Row label="EID matched">
            {payment.submitted_eid ? (
              <span className="font-mono">{payment.submitted_eid}</span>
            ) : (
              <span className="text-foreground/50">
                nothing in the note matched the roster
              </span>
            )}
          </Row>
          <Row label="Venmo ID">
            <span className="font-mono text-xs">{payment.venmo_txn_id}</span>
            <span className="ml-2 text-xs text-foreground/60">
              re-importing this statement will not duplicate it
            </span>
          </Row>
          <Row label="Imported">
            {formatInstant(payment.imported_at)} CT by{" "}
            {describeOfficer(names, payment.imported_by)}
          </Row>
        </dl>
      </section>

      {review.noMember && !voided && (
        <section className="mt-12 max-w-3xl">
          <h2 className="font-display text-xl font-bold">
            Who might have sent this
          </h2>
          <p className="mt-2 text-sm text-foreground/70">
            Ranked from the payer&apos;s name and the note. Nothing is
            preselected — pick below once you are sure.
          </p>
          <div className="mt-4">
            <PaymentSuggestions suggestions={suggestions} />
          </div>
        </section>
      )}

      <section className="mt-12 max-w-3xl">
        <h2 className="font-display text-xl font-bold">Who it credits</h2>

        {voided ? (
          <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-[10rem_1fr]">
            <Row label="Member">
              {payment.members ? (
                <Link
                  href={`/admin/members/${payment.members.id}`}
                  className="underline underline-offset-2"
                >
                  {payment.members.full_name}
                </Link>
              ) : (
                <span className="text-foreground/50">nobody</span>
              )}
            </Row>
            <Row label="Covered">
              <Covered terms={payment.covered_terms} />
              <span className="ml-2 text-xs text-foreground/60">
                no longer counting
              </span>
            </Row>
          </dl>
        ) : (
          <>
            {/* Says who as well as what. "It currently covers Spring 2026"
                alone reads as though somebody is getting a term out of this,
                which is exactly wrong on an unassigned row — coverage without a
                member counts towards nobody. */}
            <p className="mt-2 text-sm text-foreground/70">
              {payment.covered_terms && payment.covered_terms.length > 0 ? (
                <>
                  This payment buys <Covered terms={payment.covered_terms} />,{" "}
                  {payment.members ? (
                    <>
                      credited to <strong>{payment.members.full_name}</strong>.
                    </>
                  ) : (
                    <>but credits nobody until a member is picked.</>
                  )}
                </>
              ) : (
                <>
                  This payment covers nothing until somebody decides how many
                  terms it bought.
                </>
              )}
            </p>
            <div className="mt-4">
              <PaymentEditor
                id={payment.id}
                updatedAt={payment.updated_at}
                members={members}
                memberId={payment.member_id}
                startTerm={payment.start_term}
                termsCovered={payment.terms_covered}
                termOptions={startTermOptions(paidAt, payment.start_term)}
                derivedTerm={derivedTerm}
              />
            </div>
          </>
        )}
      </section>

      <section className="mt-12 max-w-3xl">
        <h2 className="font-display text-xl font-bold">
          {voided ? "How it was voided" : "Void this payment"}
        </h2>

        {voided ? (
          <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-[10rem_1fr]">
            <Row label="Reason">{payment.void_reason ?? <Missing />}</Row>
            <Row label="Voided by">
              {payment.voided_by
                ? describeOfficer(names, payment.voided_by)
                : "—"}
            </Row>
            <Row label="Voided at">
              {payment.voided_at
                ? `${formatInstant(payment.voided_at)} CT`
                : "—"}
            </Row>
          </dl>
        ) : (
          <div className="mt-4">
            <VoidPaymentForm id={payment.id} />
          </div>
        )}
      </section>

      <section className="mt-12 max-w-3xl">
        <h2 className="font-display text-xl font-bold">History</h2>
        <div className="mt-4">
          <AuditTrail entityType="dues_payment" entityId={payment.id} />
        </div>
      </section>
    </div>
  );
}

function Covered({ terms }: { terms: string[] | null }) {
  if (!terms || terms.length === 0) {
    return <span className="text-foreground/50">nothing</span>;
  }
  // Rendered in the order terms_from() generated, which is term-index order —
  // never re-sorted here, because a string compare puts Fall before Spring.
  return <strong>{terms.join(", ")}</strong>;
}

function Missing() {
  return <span className="text-foreground/50">—</span>;
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-sm text-foreground/60">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </>
  );
}

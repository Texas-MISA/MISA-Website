import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AuditTrail } from "@/app/admin/(shell)/_components/audit-trail";
import { describeOfficer, fetchOfficerNames } from "@/lib/admin-profiles";
import { requireOfficer } from "@/lib/auth";
import { formatInstant } from "@/lib/events";
import { formatPointCategory, signedPoints } from "@/lib/points";
import { createAdminClient } from "@/lib/supabase/admin";

import { VoidForm } from "./_components/void-form";

// One adjustment, its history, and the only mutation it will ever accept.
//
// Service-role read: point_adjustments is deny-all under RLS until Stage 8.

export const metadata: Metadata = { title: "Adjustment" };

type Adjustment = {
  id: string;
  member_id: string;
  points: number;
  reason: string;
  category: string;
  term: string;
  event_id: string | null;
  awarded_by: string;
  awarded_at: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  members: { id: string; full_name: string; active: boolean } | null;
  events: { id: string; title: string } | null;
};

async function fetchAdjustment(id: string): Promise<Adjustment | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("point_adjustments")
    .select(
      "id, member_id, points, reason, category, term, event_id, " +
        "awarded_by, awarded_at, voided_at, voided_by, void_reason, " +
        "members(id, full_name, active), events(id, title)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("adjustment query failed:", error.message);
    return null;
  }
  return data as unknown as Adjustment | null;
}

export default async function AdjustmentDetailPage({
  params,
  searchParams,
}: {
  // Promise in Next 16 — await before reading.
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOfficer();
  const { id } = await params;

  const adjustment = await fetchAdjustment(id);
  if (!adjustment) notFound();

  // The ledger's filters ride along, so closing this lands on the view the
  // officer was working rather than the unfiltered default.
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string" && value) query.set(key, value);
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const backToLedger = `/admin/points${suffix}`;

  const names = await fetchOfficerNames(
    createAdminClient(),
    [adjustment.awarded_by, adjustment.voided_by].filter(
      (v): v is string => v !== null
    )
  );

  const voided = adjustment.voided_at !== null;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          Adjustment
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

      <section className="mt-10 max-w-3xl">
        <h2 className="font-display text-xl font-bold">What was awarded</h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-[10rem_1fr]">
          <Row label="Member">
            {adjustment.members ? (
              <Link
                href={`/admin/points?member=${adjustment.member_id}`}
                className="underline underline-offset-2"
              >
                {adjustment.members.full_name}
              </Link>
            ) : (
              <span className="text-foreground/50">unknown member</span>
            )}
            {adjustment.members?.active === false && (
              <span className="ml-2 text-xs text-foreground/50">inactive</span>
            )}
          </Row>
          <Row label="Points">
            <span className={voided ? "line-through" : ""}>
              {signedPoints(adjustment.points)}
            </span>
            {voided && (
              <span className="ml-2 text-xs text-foreground/60">
                no longer counting
              </span>
            )}
          </Row>
          <Row label="Category">
            {formatPointCategory(adjustment.category)}
          </Row>
          <Row label="Reason">{adjustment.reason}</Row>
          <Row label="Term">
            {adjustment.term}
            <span className="ml-2 text-xs text-foreground/60">
              set from the award date
            </span>
          </Row>
          <Row label="Related event">
            {adjustment.events ? (
              <Link
                href={`/admin/events/${adjustment.events.id}`}
                className="underline underline-offset-2"
              >
                {adjustment.events.title}
              </Link>
            ) : (
              <span className="text-foreground/50">not linked</span>
            )}
          </Row>
          <Row label="Awarded by">
            {describeOfficer(names, adjustment.awarded_by)}
          </Row>
          <Row label="Awarded at">
            {formatInstant(adjustment.awarded_at)} CT
          </Row>
        </dl>
      </section>

      <section className="mt-12 max-w-3xl">
        <h2 className="font-display text-xl font-bold">
          {voided ? "How it was voided" : "Void this adjustment"}
        </h2>

        {voided ? (
          <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-[10rem_1fr]">
            <Row label="Reason">
              {adjustment.void_reason ?? (
                <span className="text-foreground/50">—</span>
              )}
            </Row>
            <Row label="Voided by">
              {adjustment.voided_by
                ? describeOfficer(names, adjustment.voided_by)
                : "—"}
            </Row>
            <Row label="Voided at">
              {adjustment.voided_at
                ? `${formatInstant(adjustment.voided_at)} CT`
                : "—"}
            </Row>
          </dl>
        ) : (
          <div className="mt-4">
            <VoidForm id={adjustment.id} />
          </div>
        )}
      </section>

      <section className="mt-12 max-w-3xl">
        <h2 className="font-display text-xl font-bold">History</h2>
        <div className="mt-4">
          <AuditTrail entityType="point_adjustment" entityId={adjustment.id} />
        </div>
      </section>
    </div>
  );
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

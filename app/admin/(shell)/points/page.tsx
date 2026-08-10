import type { Metadata } from "next";
import Link from "next/link";

import { describeOfficer, fetchOfficerNames } from "@/lib/admin-profiles";
import { LedgerExport } from "@/app/admin/(shell)/_components/ledger-export";
import { requireOfficer } from "@/lib/auth";
import { formatInstant } from "@/lib/events";
import {
  adjustmentFilterToParams,
  applyAdjustmentFilter,
  parseAdjustmentFilter,
  type AdjustmentFilter,
} from "@/lib/ledger-filters";
import {
  ADJUSTMENT_DEFAULT_FIELDS,
  ADJUSTMENT_EXPORT_FIELDS,
} from "@/lib/export-ledgers";
import { createAdminClient } from "@/lib/supabase/admin";

import { PointFilters, type OfficerOption } from "./_components/point-filters";
import { PointsTable, type LedgerRow } from "./_components/points-table";

// The point-adjustment ledger (§4.2, §7 Stage 5 phase 4). Every grant and every
// deduction that did not come from a check-in, with the reason and the officer
// attached — so "who has been handing out points" has a one-screen answer (§9
// #9 and #10 chose the ledger over a role gate and a self-grant block, which
// only works if the ledger is actually legible).
//
// Service-role read: point_adjustments is deny-all under RLS until Stage 8.

export const metadata: Metadata = { title: "Points" };

const LIMIT = 200;

/**
 * How far back to look for officers to populate the filter.
 *
 * PostgREST has no `select distinct` and phase 4 ships no migration, so the
 * officer list is a bounded scan over recent grants. Deeper than the ledger's
 * own LIMIT so an officer whose grants have all scrolled off page one still
 * appears. An officer with nothing in the last 1000 adjustments drops off the
 * list; at this org's volume that is decades away, and the fix when it isn't is
 * a union with the (13-row) admin_profiles table.
 */
const OFFICER_SCAN_LIMIT = 1000;

type RawAdjustment = Omit<
  LedgerRow,
  "awardedLabel" | "voided" | "officerLabel"
> & {
  awarded_at: string;
  voided_at: string | null;
  awarded_by: string;
};

async function fetchLedger(
  filters: AdjustmentFilter
): Promise<
  { kind: "ok"; rows: LedgerRow[]; total: number } | { kind: "error" }
> {
  const db = createAdminClient();

  // 📌 The predicates live in lib/ledger-filters.ts as of Stage 8 phase 2, so
  // this screen and /admin/points/export are provably the same query — the
  // property applyMemberFilter gives the directory and its export. What stays
  // here is the ROW WINDOW: the order and the 200-row cap belong to this
  // screen, and the export deliberately uses different ones.
  const query = applyAdjustmentFilter(
    db
      .from("point_adjustments")
      .select(
        "id, member_id, points, reason, category, event_id, term, " +
          "awarded_by, awarded_at, voided_at, " +
          "members(id, full_name, active), events(id, title)",
        { count: "exact" }
      ),
    filters
  )
    // The (awarded_by, awarded_at desc) index serves this and the officer
    // filter together.
    .order("awarded_at", { ascending: false })
    .limit(LIMIT);

  const { data, error, count } = await query;
  if (error) {
    console.error("points ledger query failed:", error.message);
    return { kind: "error" };
  }

  const raw = data as unknown as RawAdjustment[];
  const names = await fetchOfficerNames(
    db,
    raw.map((row) => row.awarded_by)
  );

  // awarded_at and voided_at are dropped on the way out rather than passed
  // along — a raw timestamp in a child component's props is an invitation to
  // format it there, and Server Components own date formatting.
  const rows: LedgerRow[] = raw.map(
    ({ awarded_at, voided_at, awarded_by, ...row }) => ({
      ...row,
      awardedLabel: formatInstant(awarded_at),
      voided: voided_at !== null,
      officerLabel: describeOfficer(names, awarded_by),
    })
  );

  return { kind: "ok", rows, total: count ?? raw.length };
}

/**
 * The officers who appear in the filter.
 *
 * The currently selected id is re-appended when the scan misses it. Without
 * that, a bookmarked `?officer=…` older than the scan renders a `<select>` with
 * no matching option — which React shows as blank while the results below are
 * genuinely filtered. A filter that looks cleared but isn't is worse than one
 * that is missing.
 */
async function fetchOfficerOptions(
  selected: string
): Promise<OfficerOption[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("point_adjustments")
    .select("awarded_by")
    .order("awarded_at", { ascending: false })
    .limit(OFFICER_SCAN_LIMIT);

  if (error) {
    console.error("officer options query failed:", error.message);
    return [];
  }

  const ids = [...new Set(data.map((row) => row.awarded_by))];
  if (selected && !ids.includes(selected)) ids.push(selected);
  if (ids.length === 0) return [];

  const names = await fetchOfficerNames(db, ids);
  return ids
    .map((id) => ({
      id,
      // All three cases (§6). A revoked officer's grants are exactly what
      // someone auditing wants to filter on, so the id fragment keeps two
      // anonymous entries apart.
      label: names.has(id)
        ? (names.get(id) ?? `an officer (…${id.slice(-4)})`)
        : `a former officer (…${id.slice(-4)})`,
      named: names.get(id) != null,
    }))
    .sort((a, b) =>
      a.named === b.named ? a.label.localeCompare(b.label) : a.named ? -1 : 1
    )
    .map(({ id, label }) => ({ id, label }));
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

export default async function AdminPointsPage({
  searchParams,
}: {
  // Promise in Next 16 — await before reading.
  searchParams: Promise<{
    officer?: string;
    category?: string;
    member?: string;
    state?: string;
    from?: string;
    to?: string;
  }>;
}) {
  await requireOfficer();

  const params = await searchParams;
  const filters = parseAdjustmentFilter(params);

  const [result, officers, memberLabel] = await Promise.all([
    fetchLedger(filters),
    fetchOfficerOptions(filters.officer),
    fetchMemberLabel(filters.member),
  ]);

  // Built from the FILTER, not the incoming query string, so a link back
  // carries what was actually applied rather than whatever was typed.
  const query = adjustmentFilterToParams(filters).toString();
  const suffix = query ? `?${query}` : "";

  // "Filter to this member", keeping every other filter the officer set.
  function memberHref(memberId: string): string {
    const next = adjustmentFilterToParams({ ...filters, member: memberId });
    return `/admin/points?${next.toString()}`;
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          Points
        </h1>
        <Link
          href={`/admin/points/new${suffix}`}
          className="rounded-full bg-misa-blue px-6 py-2 text-xs font-medium tracking-wider text-white transition hover:bg-misa-blue-dark"
        >
          GRANT POINTS
        </Link>
      </div>

      <p className="mt-3 max-w-2xl text-sm text-foreground/70">
        Points awarded outside of event attendance — volunteering, recruiting,
        competition placings, and corrections. Every one carries a reason and
        the officer who made it. A voided adjustment stays here, struck through,
        and stops counting immediately.
      </p>

      <div className="mt-6">
        <PointFilters
          officers={officers}
          memberLabel={memberLabel}
          selected={{
            officer: filters.officer,
            category: filters.category,
            state: filters.state,
            from: filters.from,
            to: filters.to,
          }}
        />
      </div>

      <div className="mt-8">
        {result.kind === "error" ? (
          <p className="border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm">
            Couldn&apos;t load the points ledger.
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-foreground/60">
              {result.total === 0
                ? "No matching adjustments."
                : result.total > result.rows.length
                  ? `Showing the first ${result.rows.length} of ${result.total} matching adjustments.`
                  : `${result.total} matching adjustment${result.total === 1 ? "" : "s"}.`}
            </p>
            <div className="mb-4">
              <LedgerExport
                path="/admin/points/export"
                filterParams={query}
                catalogue={ADJUSTMENT_EXPORT_FIELDS}
                defaults={ADJUSTMENT_DEFAULT_FIELDS}
                total={result.total}
                noun="adjustment"
              />
            </div>
            <PointsTable
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

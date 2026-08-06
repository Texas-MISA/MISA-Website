import type { Metadata } from "next";
import Link from "next/link";

import { requireOfficer } from "@/lib/auth";
import {
  applyMemberFilter,
  isDefaultFilter,
  memberFilterToParams,
  pageCount,
  pageRange,
  parseMemberFilter,
  PAGE_SIZE,
} from "@/lib/filters";
import { exportCatalogue } from "@/lib/export";
import { fetchFieldDefinitions } from "@/lib/member-fields";
import type { FieldDefinition } from "@/lib/members";
import { createAdminClient } from "@/lib/supabase/admin";

import { ExportToolbar } from "./_components/export-toolbar";
import { MemberFilters } from "./_components/member-filters";
import { MemberTable, type MemberRow } from "./_components/member-table";
import { Pagination } from "./_components/pagination";
import { SelectionProvider } from "./_components/selection";

// The member directory (§5, §7 Stage 6). Reads member_directory, which is
// current-term scoped and keeps the attendance/bonus split the public
// leaderboard deliberately drops (§4.4, §4.5).
//
// Service-role read behind requireOfficer(), like every other admin screen.
// member_directory carries eid and email, so it is granted to
// `authenticated` only and must never be read from a Client Component with the
// anon key (§6).
//
// Four columns as of phase 3 — Name, Email, EID, Total Points — with everything
// else on /admin/members/[id]. Still read-only: inline editing arrives with the
// custom fields in phase 4, and selection and export in phase 5. The relational
// filters (attended or missed a specific event, has pending submissions, not
// seen since) need an attendance subquery rather than a column comparison and
// land in phase 6, in their own labelled panel.

export const metadata: Metadata = { title: "Members" };

// One unbroken literal with `as const`, for the reason recorded on
// AUDITED_ADJUSTMENT_COLUMNS in lib/points.ts: PostgREST types the returned row
// off the string *literal*, so `"a, b" + "c"` widens to plain `string` and
// collapses the result into an untyped error shape. The wrapped-and-concatenated
// version of this line cost a build here too.
//
// `active` and `source` are not displayed columns — they drive the INACTIVE and
// SELF badges beside the name. The view keeps every other column for the detail
// page; nothing was dropped from the schema by this trim.
const COLUMNS =
  "id, eid, full_name, email, active, source, total_points, custom_fields, updated_at" as const;

type DirectoryQueryResult =
  | { kind: "ok"; rows: MemberRow[]; total: number }
  | { kind: "error" };

async function fetchDirectory(
  db: ReturnType<typeof createAdminClient>,
  filter: ReturnType<typeof parseMemberFilter>,
  fields: readonly FieldDefinition[]
): Promise<DirectoryQueryResult> {
  const { from, to } = pageRange(filter.page);

  // applyMemberFilter is the only thing that translates a filter into a query.
  // Phase 5's export will call it on the same filter and skip the .range()
  // below — that separation is what keeps "copy all N matching" honest.
  //
  // The definitions go in because a `cf:` sort key resolves against them.
  // applyMemberFilter takes them as a required argument on purpose: forgetting
  // to load them is then a compile error rather than a directory that silently
  // falls back to sorting by name.
  const { data, error, count } = await applyMemberFilter(
    db.from("member_directory").select(COLUMNS, { count: "exact" }),
    filter,
    fields
  ).range(from, to);

  if (error) {
    console.error("member directory query failed:", error.message);
    return { kind: "error" };
  }

  // No timestamp reaches the table any more, so there is nothing to pre-format
  // here — the columns that needed it moved to the detail page, which formats
  // them on the server for the same reason.
  const rows: MemberRow[] = data.map((row) => ({
    id: row.id ?? "",
    eid: row.eid ?? "",
    fullName: row.full_name ?? "",
    email: row.email ?? "",
    active: row.active ?? true,
    source: row.source ?? "admin",
    totalPoints: row.total_points ?? 0,
    customFields: row.custom_fields ?? {},
    // The compare-and-set anchor every inline cell posts back. Carried as the
    // raw PostgREST string all the way to the hidden input — a Date round trip
    // truncates the microseconds and the CAS then never matches.
    updatedAt: row.updated_at ?? "",
  }));

  return { kind: "ok", rows, total: count ?? rows.length };
}

export default async function AdminMembersPage({
  searchParams,
}: {
  // Promise in Next 16 — await before reading.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOfficer();

  const params = await searchParams;

  // Definitions first: parseMemberFilter needs them to tell a live `cf:` sort
  // key from one naming a field that has since been archived. One client for
  // both reads.
  const db = createAdminClient();
  const fields = await fetchFieldDefinitions(db);

  const filter = parseMemberFilter(params, fields);
  const result = await fetchDirectory(db, filter, fields);

  const pages = result.kind === "ok" ? pageCount(result.total) : 1;

  // The filter as the export sees it — deliberately WITHOUT `page`.
  //
  // Two jobs, and both want the page number gone. It is the export's query
  // string, and an export is never page-scoped (that separation is the whole
  // reason applyMemberFilter does not paginate). It is also the key that resets
  // the selection, and paging is not a filter change: an officer who checks
  // three rows on page 1, looks at page 2 and comes back should still have
  // three rows checked.
  const filterScope = memberFilterToParams(filter);
  filterScope.delete("page");
  const filterKey = filterScope.toString();

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          Members
        </h1>
        {/* Not an admin-nav entry: admin-nav.tsx marks an item active with
            pathname.startsWith, so a Fields link there would light "Members" up
            alongside it. This is the same in-page idiom the events form uses
            for "Create a recurring series instead". */}
        <Link
          href="/admin/members/fields"
          className="text-sm underline underline-offset-4"
        >
          Custom fields ({fields.length})
        </Link>
      </div>

      <p className="mt-3 max-w-2xl text-sm text-foreground/70">
        The roster. <span className="font-medium">Total points are scoped to
        the current term.</span> Open a member for their attendance, rate,
        points breakdown, pending submissions, and history.
      </p>

      <div className="mt-6">
        <MemberFilters filter={filter} definitions={fields} />
      </div>

      <div className="mt-8">
        {result.kind === "error" ? (
          <p className="border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm">
            Couldn&apos;t load the directory.
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-foreground/60">
              {result.total === 0
                ? isDefaultFilter(filter)
                  ? "No active members yet."
                  : "No members match these filters."
                : result.total > PAGE_SIZE
                  ? `${result.total} matching members — showing ${result.rows.length} on page ${filter.page} of ${pages}.`
                  : `${result.total} matching member${result.total === 1 ? "" : "s"}.`}
            </p>

            {/* The provider wraps the toolbar, the table AND the pagination:
                the toolbar reads the selection, the table writes it, and the
                pagination sits inside so a page change cannot remount the
                provider and silently drop what was checked. The filter key is
                what resets it — see selection.tsx. */}
            <SelectionProvider
              filterKey={filterKey}
              total={result.total}
              pageIds={result.rows.map((row) => row.id)}
            >
              {result.total > 0 && (
                <ExportToolbar
                  filterParams={filterKey}
                  catalogue={exportCatalogue(fields)}
                />
              )}

              <MemberTable rows={result.rows} filter={filter} fields={fields} />

              <Pagination filter={filter} pages={pages} total={result.total} />
            </SelectionProvider>
          </>
        )}
      </div>
    </div>
  );
}

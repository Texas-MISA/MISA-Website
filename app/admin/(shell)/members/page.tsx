import type { Metadata } from "next";
import Link from "next/link";

import { ReadError } from "@/app/admin/(shell)/_components/notice";
import { requireOfficer } from "@/lib/auth";
import {
  applyMemberFilter,
  chunkRange,
  isDefaultFilter,
  memberFilterToParams,
  needsAttendanceEmbed,
  parseMemberFilter,
  READ_CHUNK,
} from "@/lib/filters";
import { fetchEventOptions } from "@/lib/event-options";
import { exportCatalogue } from "@/lib/export";
import { fetchFieldDefinitions } from "@/lib/member-fields";
import { fetchPresets } from "@/lib/member-presets";
import type { FieldDefinition } from "@/lib/members";
import { presetSummary } from "@/lib/presets";
import { createAdminClient } from "@/lib/supabase/admin";

import { ExportToolbar } from "./_components/export-toolbar";
import { MemberFilters } from "./_components/member-filters";
import { MemberTable, type MemberRow } from "./_components/member-table";
import { PresetBar, type PresetChip } from "./_components/preset-bar";
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
  "id, eid, full_name, email, active, source, total_points, dues_paid_current_term, custom_fields, updated_at" as const;

// The same list plus the attendance embed phase 6's event filter needs.
//
// 🪤 **Two literals and a branch, never `COLUMNS + ", attendance!left(…)"`.**
// PostgREST types the returned row off the string *literal*, so a concatenation
// widens it to plain `string` and collapses every field access at once. That is
// the same GenericStringError break recorded on AUDITED_ADJUSTMENT_COLUMNS, and
// building this string dynamically is the most natural way to reintroduce it.
//
// One `!left` embed serves both modes: `attendance=is.null` is "missed",
// `not.is.null` is "attended", and the two partition the roster exactly
// (measured: 15 + 17 = 32 on the seed). It is applied ONLY when an event filter
// is set — unfiltered it still returns the right rows and the right count, but
// it nests every member's whole attendance history into the payload for nothing.
const COLUMNS_WITH_ATTENDANCE =
  "id, eid, full_name, email, active, source, total_points, dues_paid_current_term, custom_fields, updated_at, attendance!left(event_id)" as const;

type DirectoryQueryResult =
  | { kind: "ok"; rows: MemberRow[]; total: number }
  | { kind: "error" };

/**
 * The un-embedded directory select — used for real in the common branch, and
 * used for its *type* by both.
 *
 * A function rather than a bare value so the row shape can be derived without
 * building a query object that might never be issued, and so the COLUMNS
 * literal stays the single source of that shape rather than being restated.
 */
function narrowSelect(db: ReturnType<typeof createAdminClient>) {
  return db.from("member_directory").select(COLUMNS, { count: "exact" });
}

type DirectoryRow = NonNullable<
  Awaited<ReturnType<typeof narrowSelect>>["data"]
>[number];

async function fetchDirectory(
  db: ReturnType<typeof createAdminClient>,
  filter: ReturnType<typeof parseMemberFilter>,
  fields: readonly FieldDefinition[]
): Promise<DirectoryQueryResult> {
  // applyMemberFilter is the only thing that translates a filter into a query.
  // The export calls it on the same filter and reads the same way — that
  // sharing is what keeps "copy all N matching" honest.
  //
  // The definitions go in because a `cf:` sort key resolves against them.
  // applyMemberFilter takes them as a required argument on purpose: forgetting
  // to load them is then a compile error rather than a directory that silently
  // falls back to sorting by name.
  //
  // 🪤 The select branches on the filter because the attendance embed has to be
  // in the select and cannot be assembled dynamically — see the note on
  // COLUMNS_WITH_ATTENDANCE. `needsAttendanceEmbed` keeps the *decision* in
  // lib/filters.ts even though the literal cannot live there, so the page never
  // decides for itself what the filter needs.
  const query = needsAttendanceEmbed(filter)
    ? applyMemberFilter(
        db
          .from("member_directory")
          .select(COLUMNS_WITH_ATTENDANCE, { count: "exact" }),
        filter,
        fields
      )
    : applyMemberFilter(narrowSelect(db), filter, fields);

  // ⚠️ Read in chunks rather than asking for the whole result at once. The
  // directory stopped paginating on 2026-08-07 and shows every matching member,
  // which is NOT the same as issuing one unbounded request: the hosted project
  // applies its own PostgREST `max_rows`, so that request comes back complete
  // locally and silently short in production. Same loop and same reasoning as
  // the export route — it is the identical trap, not a coincidence.
  //
  // There is deliberately no ceiling. The count below is always the true total,
  // so the rows on screen and the number above them cannot disagree; a cap
  // would re-introduce a partial list that looks complete. §2.2's worst case is
  // 500 members, one chunk. If the roster ever grows enough for this to feel
  // slow, virtualize the table — do not start trimming the result.
  // Rows typed off the builder rather than restated, so the COLUMNS literal
  // stays the single source of the row shape (PostgREST types the result from
  // that literal — see the note on COLUMNS).
  //
  // 📌 Typed off the NARROW select specifically, not off `query`. Since phase 6
  // `query` is a union of two row shapes and pushing one branch's rows into an
  // array typed as the other does not compile. The narrow shape is the right
  // one: the embed adds a field nothing below reads, and an embed row is
  // structurally assignable to it.
  const raw: DirectoryRow[] = [];
  let total = 0;

  for (let index = 0; ; index++) {
    const { from, to } = chunkRange(index);
    const { data, error, count } = await query.range(from, to);

    if (error) {
      console.error("member directory query failed:", error.message);
      return { kind: "error" };
    }

    if (index === 0) total = count ?? data.length;
    raw.push(...data);

    if (data.length < READ_CHUNK || raw.length >= total) break;
  }

  // No timestamp reaches the table any more, so there is nothing to pre-format
  // here — the columns that needed it moved to the detail page, which formats
  // them on the server for the same reason.
  const rows: MemberRow[] = raw.map((row) => ({
    id: row.id ?? "",
    eid: row.eid ?? "",
    fullName: row.full_name ?? "",
    email: row.email ?? "",
    active: row.active ?? true,
    source: row.source ?? "admin",
    totalPoints: row.total_points ?? 0,
    // The view computes this as an `exists (…)`, so it is never really null —
    // but every column of a view is nullable in the generated types, and false
    // is the honest default: "we have no record of a payment covering this
    // term" is exactly what Not Paid means.
    duesPaid: row.dues_paid_current_term ?? false,
    customFields: row.custom_fields ?? {},
    // The compare-and-set anchor every inline cell posts back. Carried as the
    // raw PostgREST string all the way to the hidden input — a Date round trip
    // truncates the microseconds and the CAS then never matches.
    updatedAt: row.updated_at ?? "",
  }));

  return { kind: "ok", rows, total };
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

  // The directory read and the event picker are independent, so they go
  // together. fetchEventOptions is the same all-status list the attendance queue
  // and manual entry offer — an officer asking who missed a cancelled event is
  // asking a real question, and a published-only picker could not answer it.
  const [result, eventsResult, presetsResult] = await Promise.all([
    fetchDirectory(db, filter, fields),
    fetchEventOptions(db),
    fetchPresets(db),
  ]);

  // The filter, serving two jobs at once: it is the export's query string, and
  // it is the key that resets the selection when the officer narrows the view.
  //
  // 📌 It used to need `page` stripped for both — an export is never
  // page-scoped, and paging is not a filter change so it must not clear what
  // was checked. With pagination gone the filter simply *is* the scope, which
  // is the simplification that workaround was standing in for.
  const filterKey = memberFilterToParams(filter).toString();

  // Summaries are rendered here rather than in the chip row because
  // presetSummary needs the field definitions and the event labels, and the bar
  // is a Client Component that has neither. Each stored query is parsed the way
  // the directory itself would parse it, so a preset naming a since-archived
  // field describes what it will ACTUALLY narrow to rather than what it once did.
  // An unread event list is not an empty one — the filter says so below.
  const events = eventsResult.kind === "ok" ? eventsResult.options : [];
  const eventsFailed = eventsResult.kind === "error";

  const eventLabels = new Map(events.map((event) => [event.id, event.label]));
  // An unread preset list is not "no saved views" — the chip row simply
  // vanishing looks identical to having none.
  const presets = presetsResult.kind === "ok" ? presetsResult.presets : [];
  const presetsFailed = presetsResult.kind === "error";

  const chips: PresetChip[] = presets.map((preset) => ({
    id: preset.id,
    name: preset.name,
    query: preset.query,
    summary:
      presetSummary(
        parseMemberFilter(
          Object.fromEntries(new URLSearchParams(preset.query)),
          fields
        ),
        fields,
        eventLabels
      ).join(" · ") || "Everyone",
  }));

  return (
    <div>
      {presetsFailed && (
        <ReadError what="the saved views, so the chip row is missing" className="mb-6" />
      )}
      {eventsFailed && (
        <ReadError
          what="the event list, so the attendance filters are empty"
          className="mb-6"
        />
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-[30px] leading-[1.02] font-semibold tracking-[-0.015em] sm:text-[34px]">
          Members
        </h1>
        {/* Not admin-nav entries: admin-nav.tsx marks an item active with
            pathname.startsWith, so links there would light "Members" up
            alongside them. This is the same in-page idiom the events form uses
            for "Create a recurring series instead". */}
        <div className="flex flex-wrap items-baseline gap-4 text-sm">
          <Link
            href="/admin/members/import"
            className="underline underline-offset-4"
          >
            Import CSV
          </Link>
          <Link
            href="/admin/members/fields"
            className="underline underline-offset-4"
          >
            Custom fields ({fields.length})
          </Link>
        </div>
      </div>

      <p className="mt-3 max-w-2xl text-sm text-misa-secondary">
        The roster. <span className="font-medium">Total points are scoped to
        the current term.</span> Open a member for their attendance, rate,
        points breakdown, pending submissions, and history.
      </p>

      <div className="mt-6">
        <MemberFilters filter={filter} definitions={fields} events={events} />
        <PresetBar
          presets={chips}
          filterKey={filterKey}
          // The same predicate the schema and the CHECK apply, from the one
          // module that owns it — a saved view has to narrow something.
          canSave={!isDefaultFilter(filter)}
        />
      </div>

      <div className="mt-8">
        {result.kind === "error" ? (
          <p className="border border-misa-blue/35 bg-misa-panel px-4 py-3 text-sm">
            Couldn&apos;t load the directory.
          </p>
        ) : (
          <>
            {/* Every matching member is on screen, so this is a count rather
                than a window — and it is the SAME number the export carries,
                which is the property the whole screen is built around. */}
            <p className="mb-3 text-xs text-misa-muted">
              {result.total === 0
                ? isDefaultFilter(filter)
                  ? "No active members yet."
                  : "No members match these filters."
                : isDefaultFilter(filter)
                  ? `${result.total} member${result.total === 1 ? "" : "s"}.`
                  : `${result.total} matching member${result.total === 1 ? "" : "s"}.`}
            </p>

            {/* The provider wraps the toolbar and the table: the toolbar reads
                the selection and the table writes it. The filter key is what
                resets it — see selection.tsx. */}
            <SelectionProvider
              filterKey={filterKey}
              total={result.total}
              visibleIds={result.rows.map((row) => row.id)}
            >
              {result.total > 0 && (
                <ExportToolbar
                  filterParams={filterKey}
                  catalogue={exportCatalogue(fields)}
                />
              )}

              <MemberTable rows={result.rows} filter={filter} fields={fields} />
            </SelectionProvider>
          </>
        )}
      </div>
    </div>
  );
}

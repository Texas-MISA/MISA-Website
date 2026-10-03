import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { Notice, ReadError } from "@/app/admin/(shell)/_components/notice";
import { requireOfficer } from "@/lib/auth";
import {
  defaultDirectoryColumns,
  directoryCellText,
  directoryColumns,
  DIRECTORY_COLUMNS_COOKIE,
  forcedSortColumn,
  parseDirectoryColumns,
  resolveDirectoryColumns,
  textCellFields,
  visibleColumnKeys,
} from "@/lib/directory-columns";
import {
  applyMemberFilter,
  chunkRange,
  defaultDirection,
  isDefaultFilter,
  MEMBER_TERM_ALL,
  memberFilterToParams,
  needsAttendanceEmbed,
  parseMemberFilter,
  READ_CHUNK,
} from "@/lib/filters";
import { fetchEventOptions } from "@/lib/event-options";
import { exportCatalogue, projectRow, type ExportField } from "@/lib/export";
import { fetchFieldDefinitions } from "@/lib/member-fields";
import { fetchPresets } from "@/lib/member-presets";
import type { FieldDefinition } from "@/lib/members";
import { DEFAULT_MEMBER_TYPE } from "@/lib/member-types";
import { presetSummary } from "@/lib/presets";
import { createAdminClient } from "@/lib/supabase/admin";

import { PageHeader } from "@/components/ui/page-header";
import { ExportToolbar } from "./_components/export-toolbar";
import { MemberFilters } from "./_components/member-filters";
import { MemberTable, type MemberRow } from "./_components/member-table";
import { PresetBar, type PresetChip } from "./_components/preset-bar";
import { SelectionProvider } from "./_components/selection";

// The member directory (§5, §7 Stage 6). Reads member_directory, which since
// migration 29 is ONE ROW PER (MEMBER, TERM), and keeps the attendance/bonus
// split the public leaderboard deliberately drops (§4.4, §4.5).
//
// ⚠️ The term scope is not an ordinary filter, and treating it as one is how
// this screen would start lying. Every number on a row — points, events
// attended, the rate, dues — belongs to that row's term, so the scope decides
// what the figures MEAN and not merely which rows survive. It is also the one
// clause that can widen: without it the table would show each member once per
// term they belong to, and the count above it would be rows rather than people.
// applyMemberFilter therefore always applies a term unless the officer picked
// `all` explicitly.
//
// Service-role read behind requireOfficer(), like every other admin screen.
// member_directory carries eid and email, so it is granted to
// `authenticated` only and must never be read from a Client Component with the
// anon key (§6).
//
// 📌 The COLUMNS are the officer's choice since 2026-10-01, and the same choice
// is the export's. By default the table shows Member, Email, EID, Total points,
// Dues, Member type and Project eligibility (migration 30) plus every custom
// field marked as a default column; the toolbar's Fields menu adds or hides any
// column in the export catalogue and remembers that per browser in a cookie
// this page reads (set, HttpOnly, by the Server Action in
// app/actions/directory-columns.ts), so the first paint already has the
// officer's columns. Name is always shown, and so is the column the table
// is sorted by. The rules live in lib/directory-columns.ts; this page only
// reads the cookie and fetches what the visible columns need. Everything that
// is not on screen is still one click away on /admin/members/[id].
//
// The relational filters (attended or missed a specific event, has pending
// submissions) need an attendance subquery rather than a column comparison and
// live in their own labelled panel. "Not seen since" was the third of them
// until 2026-08-25 and went with `members.active`: both answered "is this
// person still around" by inference, and the term scope now answers it from
// evidence.

export const metadata: Metadata = { title: "Members" };

// One unbroken literal with `as const`, for the reason recorded on
// AUDITED_ADJUSTMENT_COLUMNS in lib/points.ts: PostgREST types the returned row
// off the string *literal*, so `"a, b" + "c"` widens to plain `string` and
// collapses the result into an untyped error shape. The wrapped-and-concatenated
// version of this line cost a build here too.
//
// 📌 The export route's EXPORT_COLUMNS plus `updated_at`, and the width is the
// point: since 2026-10-01 any column in the export catalogue can be on screen,
// and the visible ones go through the export's own `projectRow`, which takes a
// row carrying every column it knows. Change this with the route's literals.
// A column `ExportSourceRow` gains and this select lacks is a compile error at
// the projectRow call in fetchDirectory, because the row type comes off this
// literal. `updated_at` is the row's compare-and-set token, which the export
// has no use for.
//
// The wider read costs bytes between PostgREST and this server, not bytes to
// the browser: only the visible columns are projected into a row's `cells`.
// `source` also drives the SELF pill beside the name, shown or not.
const COLUMNS =
  "id, eid, full_name, email, term, source, joined_at, notes, total_points, attendance_points, bonus_points, events_attended, events_possible, attendance_rate, pending_count, last_seen_at, dues_paid_term, member_type, project_eligibility, custom_fields, updated_at" as const;

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
  "id, eid, full_name, email, term, source, joined_at, notes, total_points, attendance_points, bonus_points, events_attended, events_possible, attendance_rate, pending_count, last_seen_at, dues_paid_term, member_type, project_eligibility, custom_fields, updated_at, attendance!left(event_id)" as const;

type DirectoryQueryResult =
  | { kind: "ok"; rows: MemberRow[]; total: number }
  | { kind: "error" };

/**
 * The term a null `filter.term` means.
 *
 * 🔓 THROWS rather than returning null, copying the events screen deliberately.
 * The caller would otherwise need a fallback, and every honest fallback is
 * wrong here: `""` applies no predicate, which turns the roster into one row per
 * member per term with a count that reads as a member total; and this module may
 * not invent a term string (§4.7). Worse, either failure would leave the term
 * control and the query agreeing with each other about the wrong thing, which is
 * exactly the shape the events page recorded — nothing on screen looks out of
 * place. The error boundary can say the term could not be determined; a silently
 * widened roster cannot.
 */
async function fetchCurrentTerm(
  db: ReturnType<typeof createAdminClient>
): Promise<string> {
  const { data, error } = await db.rpc("current_term");
  if (error) {
    console.error("current_term rpc failed:", error.message);
    throw new Error("Could not determine the current term.");
  }
  return data;
}

/**
 * Every term the roster control can offer, newest first.
 *
 * 🪤 Through the `member_terms()` rpc rather than `select term from
 * member_directory` deduped here. The view is one row per member per term, so
 * that read is members × terms and the hosted project's PostgREST `max_rows`
 * would return a short list with no error — and a truncated term list does not
 * look broken, it looks like the club never had a Spring 2026.
 *
 * 📌 An empty list is a real answer and renders as a control offering only the
 * current term. A FAILED one is not: it returns null so the caller can say the
 * list is missing rather than implying this is the club's only term.
 */
async function fetchTerms(
  db: ReturnType<typeof createAdminClient>
): Promise<string[] | null> {
  const { data, error } = await db.rpc("member_terms");
  if (error) {
    console.error("member_terms rpc failed:", error.message);
    return null;
  }
  return data.map((row) => row.term);
}

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

/**
 * One row's plain built-in columns, as the text the table prints.
 *
 * Through `projectRow` — the export's own projection — so the screen and the
 * file cannot disagree about what a cell holds, only about how it is written.
 * `directoryCellText` calls Intl for dates, which is why this happens HERE on
 * the server and the row receives finished strings.
 */
function cellText(
  row: DirectoryRow,
  textFields: readonly ExportField[]
): Record<string, string> {
  const cells = projectRow(row, textFields);
  return Object.fromEntries(
    textFields.map((field, index) => [field.key, directoryCellText(cells[index])])
  );
}

async function fetchDirectory(
  db: ReturnType<typeof createAdminClient>,
  filter: ReturnType<typeof parseMemberFilter>,
  fields: readonly FieldDefinition[],
  currentTerm: string,
  /** The visible built-ins drawn as plain text — `textCellFields`. A column
   * that is not on screen is not in here, so its values never leave the
   * server: hidden officer notes stay hidden. */
  textFields: readonly ExportField[]
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
        fields,
        currentTerm
      )
    : applyMemberFilter(narrowSelect(db), filter, fields, currentTerm);

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

  // ⚠️ Every date and rate the table prints is formatted HERE, on the server.
  // Since 2026-10-01 an officer can put Last seen, Joined and the attendance
  // rate back on screen, and DirectoryRow is a Client Component — Intl there
  // runs on both sides of hydration with different ICU data. `cells` carries
  // the finished strings instead, for the visible plain columns only.
  const rows: MemberRow[] = raw.map((row) => ({
    id: row.id ?? "",
    // Half of the row key — see MemberRow.term. Never null on this view: it is
    // the roster CTE's grouping key.
    term: row.term ?? "",
    eid: row.eid ?? "",
    fullName: row.full_name ?? "",
    email: row.email ?? "",
    source: row.source ?? "admin",
    totalPoints: row.total_points ?? 0,
    // The view computes this as an `exists (…)`, so it is never really null —
    // but every column of a view is nullable in the generated types, and false
    // is the honest default: "we have no record of a payment covering this
    // term" is exactly what Not Paid means.
    duesPaid: row.dues_paid_term ?? false,
    // NOT NULL with a default on `members`, so the fallback only satisfies the
    // view's nullable type — and General is what the column would have said.
    memberType: row.member_type ?? DEFAULT_MEMBER_TYPE,
    // Null stays null and renders as "—": the view answers for every row, so
    // a null here is not a verdict and must not be dressed up as one.
    projectEligibility: row.project_eligibility,
    customFields: row.custom_fields ?? {},
    // The compare-and-set anchor every inline cell posts back. Carried as the
    // raw PostgREST string all the way to the hidden input — a Date round trip
    // truncates the microseconds and the CAS then never matches.
    updatedAt: row.updated_at ?? "",
    cells: cellText(row, textFields),
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
  // 🪤 Both before the filter is used, and for different reasons. The
  // definitions tell a live `cf:` sort key from an archived one; the current
  // term is what a null `filter.term` resolves to, and applyMemberFilter takes
  // it as a required argument so this cannot be forgotten.
  const [fields, currentTerm] = await Promise.all([
    fetchFieldDefinitions(db),
    fetchCurrentTerm(db),
  ]);

  const filter = parseMemberFilter(params, fields);
  // What the scope actually resolved to, for the control and the copy below.
  // Never re-derived from the clock a second time — one fact, one source.
  const scopeTerm = filter.term ?? currentTerm;

  // The columns (2026-10-01), resolved before the read because they decide
  // which cells it formats. The rules are lib/directory-columns.ts's; this is
  // only the wiring:
  //   - `preferred` is the officer's choice (P) — the defaults adjusted by the
  //     cookie, which parses totally, so a garbage value is the defaults;
  //   - `sorted` is the column the sort forces on screen, if any;
  //   - `visibleKeys` is what the table draws AND what the toolbar exports.
  // Read on every request, never cached: the cookie is per browser and this
  // page is dynamic anyway (requireOfficer reads the session).
  const catalogue = exportCatalogue(fields);
  const defaults = defaultDirectoryColumns(catalogue, fields);
  // The cookie as parsed, and handed to the toolbar as well as resolved here:
  // the toolbar's next change is built on it, so an entry naming a key this
  // catalogue lacks is kept rather than dropped. That matters most when
  // fetchFieldDefinitions has failed and the catalogue has no custom fields.
  const previous = parseDirectoryColumns(
    (await cookies()).get(DIRECTORY_COLUMNS_COOKIE)?.value
  );
  const preferred = resolveDirectoryColumns(catalogue, defaults, previous);
  const sorted = forcedSortColumn(filter.sort);
  const visibleKeys = visibleColumnKeys(catalogue, preferred, sorted);
  const columns = directoryColumns(catalogue, visibleKeys, fields);

  // Where the toolbar goes when the officer hides the column the table is
  // sorted by: this filter with the sort back at its default, so the column
  // can actually leave. Built by the one serializer, like every other link to
  // this screen.
  const unsortedQuery = memberFilterToParams(filter, {
    sort: "name",
    dir: defaultDirection("name"),
  }).toString();
  const unsortedHref = `/admin/members${unsortedQuery ? `?${unsortedQuery}` : ""}`;

  // The directory read and the event picker are independent, so they go
  // together. fetchEventOptions is the same all-status list the attendance queue
  // and manual entry offer — an officer asking who missed a cancelled event is
  // asking a real question, and a published-only picker could not answer it.
  const [result, eventsResult, presetsResult, terms] = await Promise.all([
    fetchDirectory(
      db,
      filter,
      fields,
      currentTerm,
      textCellFields(catalogue, visibleKeys)
    ),
    fetchEventOptions(db),
    fetchPresets(db),
    fetchTerms(db),
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
      {/* A failed term list is not "this is the only term". The roster below is
          still correct — it is scoped to a term that came from current_term(),
          not from this list — but the officer cannot move off it, so say so. */}
      {terms === null && (
        <ReadError
          what="the list of terms, so the term control offers only this one"
          className="mb-6"
        />
      )}
      <PageHeader
        title="Members"
        action={
          // Not admin-nav entries: admin-nav.tsx marks an item active with
          // pathname.startsWith, so links there would light "Members" up
          // alongside them. This is the same in-page idiom the events form uses
          // for "Create a recurring series instead".
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
        }
      />

      {/* The scope stated in words, because the control alone does not say what
          it does to the NUMBERS. Every figure in the table is that term's. */}
      <p className="mt-3 max-w-2xl text-sm text-misa-secondary">
        The roster for{" "}
        <span className="font-medium">
          {filter.term === MEMBER_TERM_ALL ? "every term" : scopeTerm}
        </span>
        .{" "}
        {filter.term === MEMBER_TERM_ALL
          ? "Each member appears once per term they were part of, and their points are that term's."
          : "Points, attendance and dues are all scoped to it."}{" "}
        Open a member for their attendance, rate, points breakdown, pending
        submissions, and history.
      </p>

      <div className="mt-6">
        <MemberFilters
          filter={filter}
          definitions={fields}
          events={events}
          terms={terms ?? []}
          currentTerm={currentTerm}
        />
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
          <Notice>
            Couldn&apos;t load the directory.
          </Notice>
        ) : (
          <>
            {/* Every matching member is on screen, so this is a count rather
                than a window — and it is the SAME number the export carries,
                which is the property the whole screen is built around. */}
            {/* ⚠️ The empty state names the membership rule rather than saying
                "no members", because an empty CURRENT term is the expected
                state in week one — before any event has happened, the roster is
                whoever joined this term or has already paid. Without this the
                officer reads a working screen as a broken one, or worse, as a
                lost roster. */}
            <p className="mb-3 text-xs text-misa-muted">
              {result.total === 0
                ? isDefaultFilter(filter)
                  ? `Nobody is on the ${scopeTerm} roster yet — members appear here once they attend an event, are granted points, pay dues covering the term, or join.`
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
              {/* The toolbar and the table get the SAME resolution: the
                  table draws `columns`, and the toolbar rebuilds the visible
                  keys from `preferred` and `sorted` to name them in the export
                  URL — so the file is the table on screen. */}
              {result.total > 0 && (
                <ExportToolbar
                  filterParams={filterKey}
                  catalogue={catalogue}
                  preferred={preferred}
                  previous={previous}
                  defaults={defaults}
                  sorted={sorted}
                  unsortedHref={unsortedHref}
                />
              )}

              <MemberTable rows={result.rows} filter={filter} columns={columns} />
            </SelectionProvider>
          </>
        )}
      </div>
    </div>
  );
}

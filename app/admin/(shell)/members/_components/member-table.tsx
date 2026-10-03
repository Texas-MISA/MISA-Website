import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import Link from "next/link";

import { Table, THead, Th, Tr } from "@/components/ui/table";
import type { DirectoryColumn } from "@/lib/directory-columns";
import {
  defaultDirection,
  memberFilterToParams,
  type MemberFilter,
  type MemberSort,
} from "@/lib/filters";

import { DirectoryRow } from "./directory-row";
import { SelectAllHeader } from "./selection";

// A Server Component, and it stays one. Phase 4 added the inline <select> cells
// for custom fields, and — as the phase-3 note here predicted — the row markup
// moved wholesale into directory-row.tsx rather than this file gaining
// "use client". The table shell, the sort headers and the empty check have no
// interactivity beyond navigation and are cheaper left on the server; the row
// has to be a Client Component because it owns the compare-and-set token its
// cells share (the reason is written out in directory-row.tsx).
//
// 📌 The columns are not fixed here any more (2026-10-01). The page resolves
// them from the officer's Fields choice — remembered in a cookie — plus Name,
// which is locked, plus the column the table is sorted by, and hands this file
// the result in catalogue order. The default is Member, Email, EID, Total
// points and Dues, then every custom field marked as a default column; any
// other export field can be added, and the export carries exactly what is
// drawn here. lib/directory-columns.ts owns all of it.
//
// ⚠️ A header SORTS only where `sortColumn` already accepts the key, which
// `column.sort` encodes; every other header is plain text (officer decision,
// 2026-10-01: no new sorting). Showing a column does not make it sortable, and
// a link that pretended otherwise would be worse than none — parseMemberFilter
// degrades a key `sortColumn` refuses to `name`, so the header would silently
// sort the table by Member.

/** This table renders at exactly one route. Hoisted rather than parameterised:
 * a `basePath` prop would invent a seam nothing uses. */
const DIRECTORY = "/admin/members";

export type MemberRow = {
  id: string;
  eid: string;
  fullName: string;
  email: string;
  /** Drives the SELF pill beside the name, which marks a row the check-in form
   * created — §4.2's roster-cleanup signal. The Source COLUMN, when an officer
   * shows it, is printed from `cells` like every other plain built-in. */
  source: string;
  totalPoints: number;
  /**
   * Calculated dues status for the current term (Stage 6.5 phase 4).
   *
   * A column, not a badge like `source`: officers filter and sort
   * on it, which is the line between the two. Read-only everywhere — it is
   * derived from `dues_payments` and the only way to change it is to record,
   * correct or void a payment.
   */
  duesPaid: boolean;
  /** The member's answers, keyed by definition key. Raw jsonb from the view —
   * read it with fieldValue(), which collapses a missing key and an empty
   * string to the one "no answer" state. */
  customFields: unknown;
  /** The row's compare-and-set token, as the raw PostgREST string. */
  updatedAt: string;
  /**
   * The visible plain built-ins — everything on screen outside the dedicated
   * columns and the custom fields — as finished text, keyed by catalogue key.
   *
   * ⚠️ Formatted on the SERVER (`directoryCellText`), because dates go through
   * Intl and the row is a Client Component. Only visible columns are in here,
   * so a hidden column's values — officer notes above all — never reach the
   * browser. Read it with `Object.hasOwn`; a missing key renders as "—".
   */
  cells: Record<string, string>;
};

export function MemberTable({
  rows,
  filter,
  columns,
}: {
  rows: MemberRow[];
  filter: MemberFilter;
  /** The visible columns in display order, from `directoryColumns`. The header
   * row and every DirectoryRow map over this one list, so the headers and the
   * cells cannot disagree. */
  columns: DirectoryColumn[];
}) {
  if (rows.length === 0) return null;

  // The filter rides along to the detail page so its back link returns to the
  // view the officer was working, not the unfiltered default — the same idiom
  // the points ledger uses for its adjustment pages.
  const context = memberFilterToParams(filter).toString();
  const detailHref = (id: string) =>
    `${DIRECTORY}/${id}${context ? `?${context}` : ""}`;

  return (
    /* 🪤 `maxHeight` is what makes the sticky header work, and it is not a
       styling preference. A plain `overflow-x-auto` wrapper computes
       `overflow-y` to `auto` as well, so it is already a scroll container — but
       with no height limit its content never overflows, the PAGE scrolls
       instead, and a `sticky` head has no scrollport to stick within. A real max
       height makes it scroll in both axes, which is what the head sticks to.
       Since the directory stopped paginating this list runs to the whole roster,
       and losing the column headers (and the sort controls with them) partway
       down is exactly what showing everything at once would otherwise cost. */
    <Table minWidth="min-w-[40rem]" maxHeight="max-h-[70vh]">
      {/* 🪤 `sticky` puts the position and the opaque ground on the <thead> and
          the border on each <th> — a border on the <tr> would scroll away from
          the cells that stuck. */}
      <THead sticky>
        <Tr hover={false}>
          {/* One Client Component cell in an otherwise server-rendered head —
              the other headers are navigation links or plain text, this is a
              control. */}
          <SelectAllHeader />
          {/* Catalogue order — the built-ins, then the officer-defined
              fields as one contiguous block — which is also the export's
              column order, so the file reads left to right like the table. */}
          {columns.map((column) =>
            column.sort === null ? (
              // A phrase rather than a word in most cases ("Pending
              // submissions (all-time)"), so it may wrap instead of widening
              // its column to the full uppercase label.
              <Th key={column.key} numeric={column.numeric} wrap className="px-3">
                {column.label}
              </Th>
            ) : (
              <SortHeader
                key={column.key}
                filter={filter}
                column={column.sort}
                align={column.numeric ? "right" : "left"}
              >
                {column.label}
              </SortHeader>
            )
          )}
        </Tr>
      </THead>
      <tbody>
        {rows.map((row) => (
          <DirectoryRow
            key={row.id}
            row={row}
            columns={columns}
            detailHref={detailHref(row.id)}
          />
        ))}
      </tbody>
    </Table>
  );
}

/**
 * A column header that sorts.
 *
 * Clicking the active column flips the direction; clicking any other starts at
 * that column's own default, which is descending only for total points — nobody
 * opens a leaderboard-shaped screen wanting the lowest total first.
 */
function SortHeader({
  filter,
  column,
  align = "right",
  children,
}: {
  filter: MemberFilter;
  column: MemberSort;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const isActive = filter.sort === column;
  const nextDir: "asc" | "desc" = isActive
    ? filter.dir === "asc"
      ? "desc"
      : "asc"
    : defaultDirection(column);
  const params = memberFilterToParams(filter, {
    sort: column,
    dir: nextDir,
  });
  const query = params.toString();

  // 🪤 Drawn glyphs, not "▲"/"▼". A text triangle is a CHARACTER — it inherits
  // the label's 12px uppercase type, renders in whatever the fallback font has,
  // and had been shrunk to `text-[0.6rem]` (9.6px) to stop it out-weighing the
  // header it annotates. Lucide is the family the rest of the app draws from.
  //
  // 📌 An INACTIVE column now shows a faint two-way chevron rather than an empty
  // span, which is the one behavioural gain here: with nothing rendered until a
  // column was clicked, the only way to discover the directory sorts at all was
  // to click a header and see what happened.
  const Icon = isActive
    ? filter.dir === "asc"
      ? ChevronUp
      : ChevronDown
    : ChevronsUpDown;

  return (
    <Th
      aria-sort={
        isActive ? (filter.dir === "asc" ? "ascending" : "descending") : "none"
      }
      numeric={align === "right"}
      className="px-3"
    >
      <Link
        href={`/admin/members${query ? `?${query}` : ""}`}
        className={`inline-flex items-center gap-1 transition-colors duration-150 hover:text-misa-blue ${
          isActive ? "text-foreground" : ""
        }`}
      >
        {children}
        <Icon
          aria-hidden
          className={`size-3.5 shrink-0 ${isActive ? "" : "opacity-40"}`}
        />
      </Link>
    </Th>
  );
}

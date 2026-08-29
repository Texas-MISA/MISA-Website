import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import Link from "next/link";

import { Table, THead, Th, Tr } from "@/components/ui/table";
import {
  defaultDirection,
  memberFilterToParams,
  type MemberFilter,
  type MemberSort,
} from "@/lib/filters";
import { customFieldKey, type FieldDefinition } from "@/lib/members";

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
// Four built-in columns (phase 3): Name, Email, EID, Total Points. Everything
// the phase-1 table showed beside them — joined, source, events, rate, the
// attendance/bonus split, pending, last seen — lives on /admin/members/[id],
// which is why the name links there. Officer-defined columns follow them, in
// the order officers arranged.

/** This table renders at exactly one route. Hoisted rather than parameterised:
 * a `basePath` prop would invent a seam nothing uses. */
const DIRECTORY = "/admin/members";

export type MemberRow = {
  id: string;
  eid: string;
  fullName: string;
  email: string;
  /** Not a column. Drives the INACTIVE badge, which is an annotation on the
   * name rather than a field of its own — and the only on-screen signal that
   * the roster scope is showing someone deactivated. */
  /** Likewise: the SELF badge marks a row the check-in form created, which is
   * §4.2's roster-cleanup signal. */
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
};

export function MemberTable({
  rows,
  filter,
  fields,
}: {
  rows: MemberRow[];
  filter: MemberFilter;
  /** Every live definition. The directory columns are filtered out of it here,
   * so the header list and the cell list cannot disagree. */
  fields: FieldDefinition[];
}) {
  if (rows.length === 0) return null;

  // The same predicate sortColumn() applies, and that is the point: a header
  // only exists for a column that is actually sortable.
  const columns = fields.filter((field) => field.showInDirectory);

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
              the other headers are navigation links, this is a control. */}
          <SelectAllHeader />
          <SortHeader filter={filter} column="name" align="left">
            Member
          </SortHeader>
          <SortHeader filter={filter} column="email" align="left">
            Email
          </SortHeader>
          <SortHeader filter={filter} column="eid" align="left">
            EID
          </SortHeader>
          <SortHeader filter={filter} column="total_points">
            Total points
          </SortHeader>
          {/* Last of the built-ins, so the officer-defined columns stay a
              contiguous block after them. */}
          <SortHeader filter={filter} column="dues" align="left">
            Dues
          </SortHeader>
          {columns.map((field) => (
            <SortHeader
              key={field.key}
              filter={filter}
              column={customFieldKey(field.key)}
              align="left"
            >
              {field.label}
            </SortHeader>
          ))}
        </Tr>
      </THead>
      <tbody>
        {rows.map((row) => (
          <DirectoryRow
            key={row.id}
            row={row}
            fields={columns}
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

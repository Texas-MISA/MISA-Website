"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

import { Pill } from "@/components/ui/pill";
import { Tr } from "@/components/ui/table";
import { EMPTY_CELL_TEXT, type DirectoryColumn } from "@/lib/directory-columns";
import { fieldValue } from "@/lib/members";

import { MemberFieldCell } from "./member-field-cell";
import { SelectRowCell } from "./selection";
import type { MemberRow } from "./member-table";

// One directory row (§7 Stage 6 phase 4).
//
// ⚠️ **Why the whole row is the client boundary, and not just the cells.**
// `members.updated_at` is a ROW-level compare-and-set token, and every editable
// cell in the row posts the same one. If each cell held its own copy from the
// server, the first save would move the row's `updated_at` and leave every
// sibling cell holding a stale token — so the officer's second edit in that row
// would report a phantom conflict, and their third, until a revalidation landed.
// An officer tabs across a row faster than an RSC refetch.
//
// So the row owns the token: seeded from the prop, resynced when the server
// sends a newer one, and advanced in place by whichever cell just saved. If
// someone later "simplifies" this back into member-table.tsx as a Server
// Component, the phantom conflicts come back and no test will catch it — the
// failure is a client-side timing window.
//
// ⚠️ Client Component, so nothing here may call Intl or toLocale*: Node and
// Chrome ship different ICU data and the hydration diff shows two strings that
// look identical. Since 2026-10-01 an officer can show Last seen, Joined and
// the attendance rate here, and they arrive as finished text in `row.cells`,
// formatted on the server by `directoryCellText` — which this file must never
// import.

const numeric = "px-3 py-2 text-right tabular-nums";
const text = "px-3 py-2 text-left";

export function DirectoryRow({
  row,
  columns,
  detailHref,
}: {
  row: MemberRow;
  /** The visible columns, in header order — the same list the header row
   * maps, so a cell can never land under the wrong heading. */
  columns: DirectoryColumn[];
  detailHref: string;
}) {
  const [token, setToken] = useState(row.updatedAt);

  // Resync from the server — our own revalidation, or another officer's save
  // arriving on a refresh. Reset-during-render, matching member-filters.tsx.
  const [seen, setSeen] = useState(row.updatedAt);
  if (seen !== row.updatedAt) {
    setSeen(row.updatedAt);
    setToken(row.updatedAt);
  }

  // Stable identity so the cells' effect does not re-fire on every render.
  const adoptToken = useCallback((next: string) => setToken(next), []);

  return (
    <Tr>
      {/* Outside the per-cell <form> elements below, deliberately: those each
          carry exactly one field name, and a checkbox inside one would ride
          along on a custom-field save. */}
      <SelectRowCell id={row.id} label={row.fullName} />
      {columns.map((column) => {
        // An officer-defined field. Checked FIRST, though no custom key can
        // collide with a case below — every one of them is reserved
        // (RESERVED_FIELD_KEYS, and migration 18's key_not_builtin CHECK).
        const definition = column.definition;
        if (definition !== null) {
          return (
            <td key={column.key} className={text}>
              {definition.editableInline ? (
                <MemberFieldCell
                  memberId={row.id}
                  definition={definition}
                  value={fieldValue(row.customFields, definition.key) ?? ""}
                  updatedAt={token}
                  onSaved={adoptToken}
                />
              ) : (
                // Defined and shown, but not editable from here — the officer
                // sets it on the detail page. Read-only rather than absent, so
                // the column still means the same thing in every row.
                <span className="text-sm">
                  {fieldValue(row.customFields, definition.key) ?? (
                    <span className="text-misa-muted">—</span>
                  )}
                </span>
              )}
            </td>
          );
        }

        // 📌 The DEDICATED_COLUMNS (lib/directory-columns.ts) — the built-ins
        // with markup of their own. A key added to that set needs a case here,
        // and tests/directory-columns.test.ts says so if it is missed.
        switch (column.key) {
          case "name":
            return (
              <td key={column.key} className={text}>
                <Link
                  href={detailHref}
                  className="font-medium underline decoration-1 underline-offset-2"
                >
                  {row.fullName}
                </Link>
                {row.source === "self_checkin" && (
                  <Pill
                    tone="neutral"
                    title="Created by the check-in form rather than an officer"
                    className="ml-2"
                  >
                    self
                  </Pill>
                )}
              </td>
            );
          case "email":
            return (
              <td key={column.key} className={text}>
                {row.email}
              </td>
            );
          case "eid":
            // Monospace: an EID is transcribed by hand off a phone screen, and
            // this column is where `l` has to stay distinguishable from `1`. It
            // is the one identifier column in the app that was still set in the
            // body face.
            return (
              <td key={column.key} className={`${text} font-mono text-xs`}>
                {row.eid}
              </td>
            );
          case "total_points":
            return (
              <td key={column.key} className={`${numeric} font-medium`}>
                {row.totalPoints}
              </td>
            );
          case "dues":
            // ⚠️ Text, never a <select>. Dues status is calculated from
            // dues_payments and the only way to change it is to record, correct
            // or void a payment — an editable cell here would be the
            // hand-ticked "Paid Dues" dropdown that migration 19 reserves three
            // keys to forbid, and the roster would carry two answers to one
            // question.
            //
            // One word each, and no coverage detail: what a payment bought and
            // what the member is paid through belong on /admin/members/[id],
            // which has room to show the payments themselves.
            //
            // 🐛 These two badges were `text-[11px] tracking-[0.12em]` and
            // `text-[0.7rem] tracking-wider` — 11px and 11.2px, two sizes
            // reading as one, in the SAME column one row apart. Exactly the
            // drift pill.tsx was written to end.
            return (
              <td key={column.key} className={text}>
                {row.duesPaid ? (
                  <Pill tone="affirm">paid</Pill>
                ) : (
                  <Pill tone="neutral">not paid</Pill>
                )}
              </td>
            );
          default:
            return (
              <td key={column.key} className={column.numeric ? numeric : text}>
                <PlainCell row={row} columnKey={column.key} />
              </td>
            );
        }
      })}
    </Tr>
  );
}

/**
 * Every other built-in: the server's finished text from `row.cells`.
 *
 * 🔓 `Object.hasOwn`, never a bare `row.cells[key]`. The keys are catalogue
 * keys today, but an index into a plain object answers for Object.prototype
 * too, and "—" is the honest rendering of a cell the server did not send.
 */
function PlainCell({ row, columnKey }: { row: MemberRow; columnKey: string }) {
  const value = Object.hasOwn(row.cells, columnKey)
    ? row.cells[columnKey]
    : EMPTY_CELL_TEXT;

  if (value === EMPTY_CELL_TEXT) {
    return <span className="text-misa-muted">{EMPTY_CELL_TEXT}</span>;
  }

  // Free text of any length, so it is capped and truncated rather than allowed
  // to push every column after it off the screen. The `title` carries the whole
  // note on hover — it is on a plain span, not a disabled control, so it does
  // reach a pointer user; the member's page shows it in full for everyone else.
  if (columnKey === "notes") {
    return (
      <span className="block max-w-[20rem] truncate" title={value}>
        {value}
      </span>
    );
  }

  return value;
}

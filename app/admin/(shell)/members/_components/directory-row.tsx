"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

import { fieldValue, type FieldDefinition } from "@/lib/members";

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
// look identical. The row renders no dates today, which is exactly how that
// trap gets sprung later — any date arrives pre-formatted as a prop.

const numeric = "px-3 py-2 text-right tabular-nums";
const text = "px-3 py-2 text-left";

export function DirectoryRow({
  row,
  fields,
  detailHref,
}: {
  row: MemberRow;
  /** Only the definitions shown as directory columns, in header order. */
  fields: FieldDefinition[];
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
    <tr
      className={`border-b border-black/20 last:border-b-0 ${
        row.active ? "" : "bg-black/[0.03] text-foreground/60"
      }`}
    >
      {/* Outside the per-cell <form> elements below, deliberately: those each
          carry exactly one field name, and a checkbox inside one would ride
          along on a custom-field save. */}
      <SelectRowCell id={row.id} label={row.fullName} />
      <td className={text}>
        <Link
          href={detailHref}
          className="font-medium underline decoration-1 underline-offset-2"
        >
          {row.fullName}
        </Link>
        {!row.active && (
          <span className="ml-2 border border-black/40 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wider">
            inactive
          </span>
        )}
        {row.source === "self_checkin" && (
          <span
            title="Created by the check-in form rather than an officer"
            className="ml-2 border border-black/40 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wider"
          >
            self
          </span>
        )}
      </td>
      <td className={text}>{row.email}</td>
      <td className={text}>{row.eid}</td>
      <td className={`${numeric} font-medium`}>{row.totalPoints}</td>

      {/* ⚠️ Text, never a <select>. Dues status is calculated from
          dues_payments and the only way to change it is to record, correct or
          void a payment — an editable cell here would be the hand-ticked "Paid
          Dues" dropdown that migration 19 reserves three keys to forbid, and the
          roster would carry two answers to one question.

          One word each, and no coverage detail: what a payment bought and what
          the member is paid through belong on /admin/members/[id], which has
          room to show the payments themselves. */}
      <td className={text}>
        {row.duesPaid ? (
          <span className="border border-black/30 bg-misa-panel px-2 py-0.5 text-[0.7rem] tracking-wider uppercase">
            paid
          </span>
        ) : (
          <span className="border border-black/30 px-2 py-0.5 text-[0.7rem] tracking-wider text-foreground/60 uppercase">
            not paid
          </span>
        )}
      </td>

      {fields.map((definition) => (
        <td key={definition.key} className={text}>
          {definition.editableInline ? (
            <MemberFieldCell
              memberId={row.id}
              definition={definition}
              value={fieldValue(row.customFields, definition.key) ?? ""}
              updatedAt={token}
              onSaved={adoptToken}
            />
          ) : (
            // Defined and shown, but not editable from here — the officer sets
            // it on the detail page. Read-only rather than absent, so the column
            // still means the same thing in every row.
            <span className="text-sm">
              {fieldValue(row.customFields, definition.key) ?? (
                <span className="text-foreground/40">—</span>
              )}
            </span>
          )}
        </td>
      ))}
    </tr>
  );
}

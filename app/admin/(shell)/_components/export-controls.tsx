"use client";
import { BUTTON_QUIET_SM } from "@/components/ui/button";

import { useId } from "react";

import type { ExportField } from "@/lib/export";

// The presentational half of an export toolbar, shared by the roster export and
// the two Stage 8 archives.
//
// 📌 What is NOT here, deliberately: anything about SELECTION. The members
// toolbar carries a two-mode `ids` / `filter` selection whose distinction is a
// documented invariant, and the ledger archives have no selection model at all
// — they are filter-only, so their URL is the serialized filter plus `fields`
// and `format`. Hoisting the selection into a shared component would have
// invited a ledger toolbar to grow one.
//
// The three pieces below are pure presentation; the URL building, the clipboard
// behaviour and the field defaults stay with each caller, because those are the
// parts that legitimately differ.

/**
 * A download link, and it is an `<a href>` rather than a fetch on purpose.
 *
 * ⚠️ A `Content-Disposition: attachment` response only becomes a saved file if
 * the browser navigates to it. Fetching the URL and doing something with the
 * body defeats the header, and it is also how you accidentally hold an entire
 * spreadsheet in memory.
 */
export function Download({
  href,
  disabled,
  primary = false,
  children,
}: {
  href: string;
  disabled: boolean;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={disabled ? undefined : href}
      className={`border border-misa-border px-2 py-1 text-xs font-semibold uppercase tracking-wider ${
        disabled ? "pointer-events-none opacity-40" : ""
      } ${primary && !disabled ? "bg-misa-blue text-white" : ""}`}
      aria-disabled={disabled}
    >
      {children}
    </a>
  );
}

/** A button styled to match `Download`, for the clipboard formats. */
export function Action({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={BUTTON_QUIET_SM}
    >
      {children}
    </button>
  );
}

/**
 * The column picker.
 *
 * `defaults` is a parameter rather than an import: each catalogue has its own
 * default set, and the member list shares no key with the ledger catalogues, so
 * a shared constant would reset a ledger picker to nothing at all.
 *
 * 📌 `locked`, `notes`, `intro` and `onReset` arrived on 2026-10-01 for the
 * member directory, where this picker started driving the table's columns as
 * well as the file's. All four are optional and the ledger archives pass none
 * of them, so their pickers render and behave exactly as before.
 */
export function FieldPicker({
  catalogue,
  chosen,
  defaults,
  onChange,
  onReset,
  locked,
  notes,
  intro,
}: {
  catalogue: readonly ExportField[];
  chosen: ReadonlySet<string>;
  defaults: readonly string[];
  onChange: (next: ReadonlySet<string>) => void;
  /**
   * What "Reset to default" does, when that is more than ticking the defaults.
   *
   * The directory's Reset FORGETS the officer's choice, including what it said
   * about fields this page cannot see right now; a tick keeps those. Without
   * this, Reset is an ordinary `onChange` with the defaults, which is all a
   * ledger picker needs.
   */
  onReset?: () => void;
  /**
   * Keys that are always on → the reason, shown as visible text beside the box.
   *
   * 🔓 A Map, never a plain object: a custom field may legally be keyed
   * `constructor`, and `object[key]` would read Object.prototype's and render
   * that field locked. Every set this picker emits — a toggle, Reset, Select
   * all — includes these keys, so no caller can be handed a set without them.
   */
  locked?: ReadonlyMap<string, string>;
  /** Key → a note shown under that box, for a column with something to say. */
  notes?: ReadonlyMap<string, string>;
  /** One line above the boxes saying what ticking them does. */
  intro?: React.ReactNode;
}) {
  // Per-instance, so two pickers on one page cannot collide on an id.
  const idPrefix = useId();

  function withLocked(keys: Iterable<string>): ReadonlySet<string> {
    const next = new Set(keys);
    for (const key of locked?.keys() ?? []) next.add(key);
    return next;
  }

  function toggle(key: string) {
    if (locked?.has(key)) return;
    const next = new Set(chosen);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(withLocked(next));
  }

  return (
    <div className="border-t border-misa-border px-3 py-2">
      {intro && <p className="mb-2 text-xs text-misa-secondary">{intro}</p>}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {catalogue.map((field) => {
          const reason = locked?.get(field.key);
          const detail = reason ?? notes?.get(field.key);
          const detailId =
            detail === undefined ? undefined : `${idPrefix}-${field.key}`;
          return (
            // The detail sits OUTSIDE the <label> and is wired up by
            // aria-describedby. Inside it would join the checkbox's accessible
            // NAME — the defect field-form.tsx's Field adapter records.
            <div key={field.key} className="text-sm">
              <label className="flex items-center gap-2">
                {/* ⚠️ A locked box is DISABLED and carries no `title`: a title
                    on a disabled control reaches nobody — it leaves the tab
                    order, so keyboard and touch never see the tooltip. The
                    reason is the visible text below instead. */}
                <input
                  type="checkbox"
                  className="size-4 accent-misa-blue"
                  checked={reason !== undefined || chosen.has(field.key)}
                  disabled={reason !== undefined}
                  aria-describedby={detailId}
                  onChange={() => toggle(field.key)}
                />
                <span>{field.label}</span>
                {field.source === "custom" && (
                  <span className="border border-misa-border px-1 text-[0.6rem] uppercase tracking-wider">
                    custom
                  </span>
                )}
              </label>
              {detail !== undefined && (
                // `pl-6` is the box (size-4) plus the gap (gap-2), so the note
                // starts under the label rather than under the box.
                <span id={detailId} className="block pl-6 text-xs text-misa-muted">
                  {detail}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={() =>
            onReset ? onReset() : onChange(withLocked(defaults))
          }
          className="text-xs underline decoration-1 underline-offset-2"
        >
          Reset to default
        </button>
        <button
          type="button"
          onClick={() => onChange(withLocked(catalogue.map((f) => f.key)))}
          className="text-xs underline decoration-1 underline-offset-2"
        >
          Select all fields
        </button>
      </div>
    </div>
  );
}

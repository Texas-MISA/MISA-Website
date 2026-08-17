"use client";
import { BUTTON_QUIET_SM } from "@/components/ui/button";

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
 */
export function FieldPicker({
  catalogue,
  chosen,
  defaults,
  onChange,
}: {
  catalogue: readonly ExportField[];
  chosen: ReadonlySet<string>;
  defaults: readonly string[];
  onChange: (next: ReadonlySet<string>) => void;
}) {
  function toggle(key: string) {
    const next = new Set(chosen);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  }

  return (
    <div className="border-t border-misa-border px-3 py-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {catalogue.map((field) => (
          <label key={field.key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-misa-blue"
              checked={chosen.has(field.key)}
              onChange={() => toggle(field.key)}
            />
            <span>{field.label}</span>
            {field.source === "custom" && (
              <span className="border border-misa-border px-1 text-[0.6rem] uppercase tracking-wider">
                custom
              </span>
            )}
          </label>
        ))}
      </div>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={() => onChange(new Set(defaults))}
          className="text-xs underline decoration-1 underline-offset-2"
        >
          Reset to default
        </button>
        <button
          type="button"
          onClick={() => onChange(new Set(catalogue.map((f) => f.key)))}
          className="text-xs underline decoration-1 underline-offset-2"
        >
          Select all fields
        </button>
      </div>
    </div>
  );
}

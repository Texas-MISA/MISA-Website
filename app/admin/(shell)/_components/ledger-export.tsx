"use client";

import { useMemo, useState } from "react";

import type { ExportField } from "@/lib/export";

import { Action, Download, FieldPicker } from "./export-controls";

// The archive toolbar for the two ledger screens (Stage 8 phase 2).
//
// 📌 Strictly simpler than the roster's, and the difference is structural
// rather than cosmetic: neither ledger has a selection model, so there is no
// `ids` mode and no "all N matching" affordance. The URL is the serialized
// filter plus `fields` and `format`, which means the file is the filtered query
// re-run — the same property the roster export gets from its `filter` mode, but
// with nothing to accidentally conflate it with.

type Status =
  | { kind: "idle" }
  | { kind: "copied"; count: number }
  | { kind: "failed" };

export function LedgerExport({
  path,
  filterParams,
  catalogue,
  defaults,
  total,
  noun,
}: {
  /** Where the route lives, e.g. `/admin/points/export`. */
  path: string;
  /** Already serialized by the filter's own `…FilterToParams`. */
  filterParams: string;
  catalogue: readonly ExportField[];
  defaults: readonly string[];
  /** Rows the current filter matches — the count printed beside the table. */
  total: number;
  noun: string;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [chosen, setChosen] = useState<ReadonlySet<string>>(
    () => new Set(defaults)
  );

  const url = useMemo(() => {
    return (format: string) => {
      const params = new URLSearchParams(filterParams);
      params.set("format", format);
      // Catalogue order, not click order, so the header row is stable.
      for (const field of catalogue) {
        if (chosen.has(field.key)) params.append("fields", field.key);
      }
      return `${path}?${params.toString()}`;
    };
  }, [path, filterParams, catalogue, chosen]);

  const empty = total === 0 || chosen.size === 0;

  async function copyTsv() {
    setStatus({ kind: "idle" });
    try {
      const response = await fetch(url("tsv"));
      if (!response.ok) throw new Error(String(response.status));
      const body = await response.text();
      await navigator.clipboard.writeText(body);
      // The header row is not a record.
      setStatus({
        kind: "copied",
        count: body === "" ? 0 : Math.max(0, body.split("\n").length - 1),
      });
    } catch {
      setStatus({ kind: "failed" });
    }
  }

  return (
    <div className="border border-misa-border">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2">
        <span className="text-sm">
          <span className="font-semibold">{total}</span> {noun}
          {total === 1 ? "" : "s"} in this view
        </span>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs underline decoration-1 underline-offset-2"
          aria-expanded={open}
        >
          {chosen.size} column{chosen.size === 1 ? "" : "s"}
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Plain anchors: Content-Disposition only saves a file if the
              browser navigates to it. */}
          <Download href={url("xlsx")} disabled={empty} primary>
            Download XLSX
          </Download>
          <Download href={url("csv")} disabled={empty}>
            Download CSV
          </Download>
          <Action disabled={empty} onClick={copyTsv}>
            Copy
          </Action>
        </div>
      </div>

      {status.kind !== "idle" && (
        <p role="status" className="px-3 pb-2 text-xs text-misa-secondary">
          {status.kind === "copied"
            ? `Copied ${status.count} row${status.count === 1 ? "" : "s"}.`
            : "Couldn't copy — try a download instead."}
        </p>
      )}

      {open && (
        <FieldPicker
          catalogue={catalogue}
          chosen={chosen}
          defaults={defaults}
          onChange={setChosen}
        />
      )}
    </div>
  );
}

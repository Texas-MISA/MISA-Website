"use client";
import { BUTTON_QUIET_SM } from "@/components/ui/button";

import { useMemo, useState } from "react";

import {
  Action,
  Download,
  FieldPicker,
} from "@/app/admin/(shell)/_components/export-controls";
import { DEFAULT_EXPORT_FIELDS, type ExportField } from "@/lib/export";

import { useSelection } from "./selection";

// Selection and extraction controls (§7 Stage 6 phase 5).
//
// ⚠️ Every count the officer is shown after a copy is the count that actually
// came back, never the count that was selected. They differ legitimately —
// toEmailList skips members with no address on file — and reporting the
// selection would be a quiet claim that N people were emailed when N-3 were.
//
// The clipboard and the file download hit the same Route Handler, because they
// are the same egress and earn the same audit receipt (§6). The only difference
// is Content-Disposition.

const EXPORT_PATH = "/admin/members/export";

type Status =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done"; message: string }
  | { kind: "failed"; message: string };

export function ExportToolbar({
  filterParams,
  catalogue,
}: {
  /** The current filter, already serialized by memberFilterToParams. */
  filterParams: string;
  catalogue: ExportField[];
}) {
  const { mode, ids, total, count, selectAllMatching, clear } =
    useSelection();

  const [chosen, setChosen] = useState<ReadonlySet<string>>(
    () => new Set(DEFAULT_EXPORT_FIELDS)
  );
  const [picking, setPicking] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const url = useMemo(() => {
    return (format: string) => {
      const params = new URLSearchParams(filterParams);
      params.set("format", format);
      // Catalogue order, not click order, so the header row is stable.
      for (const field of catalogue) {
        if (chosen.has(field.key)) params.append("fields", field.key);
      }
      // In `filter` mode no ids are sent at all and the route re-runs the same
      // filtered query — that is what makes "all N" provably all N rather than
      // whatever happened to be rendered.
      if (mode === "ids") {
        for (const id of ids) params.append("ids", id);
      }
      return `${EXPORT_PATH}?${params.toString()}`;
    };
  }, [filterParams, catalogue, chosen, mode, ids]);

  const nothingSelected = count === 0;
  // A file needs both rows and at least one column; the clipboard actions only
  // need rows, because their column is fixed.
  const noFile = nothingSelected || chosen.size === 0;

  async function copy(format: "emails" | "names" | "tsv", noun: string) {
    setStatus({ kind: "working" });
    try {
      const response = await fetch(url(format));
      if (!response.ok) {
        setStatus({
          kind: "failed",
          message: await response.text().catch(() => "Copy failed"),
        });
        return;
      }
      const body = await response.text();
      await navigator.clipboard.writeText(body);
      setStatus({
        kind: "done",
        message: `Copied ${copiedCount(format, body)} ${noun}.`,
      });
    } catch {
      setStatus({ kind: "failed", message: "Copy failed." });
    }
  }

  // Reachable only from a partial hand-picked selection now that the header
  // checkbox goes straight to `filter` mode. Still worth keeping: an officer who
  // ticked eleven rows and then wants everyone has a one-click way there.
  const canPromote = mode === "ids" && count > 0 && count < total;

  return (
    <div className="mb-4 border border-misa-border bg-misa-panel">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2">
        <span className="text-sm font-semibold">
          {mode === "filter"
            ? `All ${total} matching selected`
            : `${count} selected`}
        </span>

        {/* ⚠️ Still an explicitly worded control rather than a bigger checkbox.
            The wording carries the distinction the modes encode — this exports
            everything the filter matches, not the rows that happen to be
            ticked — and an officer who thinks they did the first while actually
            doing the second gets a partial list with no signal. */}
        {canPromote && (
          <button
            type="button"
            onClick={selectAllMatching}
            className="text-sm underline decoration-1 underline-offset-2"
          >
            Select all {total} matching this filter
          </button>
        )}

        {count > 0 && (
          <button
            type="button"
            onClick={clear}
            className="text-sm underline decoration-1 underline-offset-2"
          >
            Clear
          </button>
        )}

        <span className="grow" />

        <button
          type="button"
          onClick={() => setPicking((open) => !open)}
          className={BUTTON_QUIET_SM}
          aria-expanded={picking}
        >
          Fields ({chosen.size})
        </button>
      </div>

      {picking && (
        <FieldPicker
          defaults={DEFAULT_EXPORT_FIELDS}
          catalogue={catalogue}
          chosen={chosen}
          onChange={setChosen}
        />
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-misa-border px-3 py-2">
        <Action
          disabled={nothingSelected}
          onClick={() => copy("emails", "addresses")}
        >
          Copy emails
        </Action>
        <Action
          disabled={nothingSelected}
          onClick={() => copy("names", "names")}
        >
          Copy names
        </Action>
        <Action disabled={nothingSelected} onClick={() => copy("tsv", "rows")}>
          Copy table
        </Action>

        {/* Plain navigations, not fetch: Content-Disposition is what turns the
            response into a saved file, and an <a> is the only thing that lets
            the browser handle it.

            xlsx is the primary because it is what officers asked for — it opens
            ready to sort, where a CSV needs a "convert to number" pass on every
            column first. CSV stays beside it rather than behind a menu: it is
            explicitly the format that keeps working if the xlsx writer is ever
            pulled, so it must not be buried. */}
        <Download href={url("xlsx")} disabled={noFile} primary>
          Download XLSX
        </Download>
        <Download href={url("csv")} disabled={noFile}>
          Download CSV
        </Download>

        {status.kind === "working" && (
          <span className="text-sm text-misa-secondary">Working…</span>
        )}
        {status.kind === "done" && (
          <span className="text-sm font-medium">{status.message}</span>
        )}
        {status.kind === "failed" && (
          <span className="text-sm font-medium text-misa-critical">
            {status.message}
          </span>
        )}
        {chosen.size === 0 && (
          <span className="text-sm text-misa-secondary">
            Pick at least one field.
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * How many items the clipboard actually received.
 *
 * Derived from the response body rather than from the selection, because the
 * two legitimately differ: a member with no email on file is skipped, so
 * "Copied 40 addresses" from a 42-row selection is the honest answer and the
 * one that tells the officer something is missing.
 */
function copiedCount(format: "emails" | "names" | "tsv", body: string): number {
  if (body === "") return 0;
  if (format === "emails") return body.split(",").length;
  if (format === "names") return body.split("\n").length;
  // TSV carries a header row that is not a member.
  return Math.max(0, body.split("\n").length - 1);
}

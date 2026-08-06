"use client";

import { useMemo, useState } from "react";

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
  const { mode, ids, total, count, selectAllMatching, clear, pageIds } =
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

  const pageCount = pageIds.length;
  const canPromote = mode === "ids" && count > 0 && count < total;

  return (
    <div className="mb-4 border-2 border-black bg-misa-panel">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2">
        <span className="text-sm font-semibold">
          {mode === "filter"
            ? `All ${total} matching selected`
            : `${count} selected`}
        </span>

        {/* ⚠️ The promotion is a separate, explicitly worded control rather than
            a bigger checkbox. "Select all N matching this filter" and "select
            the rows on this page" have to be visibly different actions, because
            the officer who thinks they did the first and actually did the
            second gets a partial list with no signal. */}
        {canPromote && (
          <button
            type="button"
            onClick={selectAllMatching}
            className="text-sm underline decoration-1 underline-offset-2"
          >
            Select all {total} matching this filter
          </button>
        )}

        {mode === "filter" && pageCount < total && (
          <span className="text-sm text-foreground/70">
            (not just the {pageCount} on this page)
          </span>
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
          className="border-2 border-black px-2 py-1 text-xs font-semibold uppercase tracking-wider"
          aria-expanded={picking}
        >
          Fields ({chosen.size})
        </button>
      </div>

      {picking && (
        <FieldPicker
          catalogue={catalogue}
          chosen={chosen}
          onChange={setChosen}
        />
      )}

      <div className="flex flex-wrap items-center gap-2 border-t-2 border-black px-3 py-2">
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

        {/* A plain navigation, not fetch: Content-Disposition is what turns the
            response into a saved file, and an <a> is the only thing that lets
            the browser handle it. */}
        <a
          href={nothingSelected || chosen.size === 0 ? undefined : url("csv")}
          className={`border-2 border-black px-2 py-1 text-xs font-semibold uppercase tracking-wider ${
            nothingSelected || chosen.size === 0
              ? "pointer-events-none opacity-40"
              : "bg-black text-white"
          }`}
          aria-disabled={nothingSelected || chosen.size === 0}
        >
          Download CSV
        </a>

        {status.kind === "working" && (
          <span className="text-sm text-foreground/70">Working…</span>
        )}
        {status.kind === "done" && (
          <span className="text-sm font-medium">{status.message}</span>
        )}
        {status.kind === "failed" && (
          <span className="text-sm font-medium text-red-700">
            {status.message}
          </span>
        )}
        {chosen.size === 0 && (
          <span className="text-sm text-foreground/70">
            Pick at least one field.
          </span>
        )}
      </div>
    </div>
  );
}

function FieldPicker({
  catalogue,
  chosen,
  onChange,
}: {
  catalogue: ExportField[];
  chosen: ReadonlySet<string>;
  onChange: (next: ReadonlySet<string>) => void;
}) {
  function toggle(key: string) {
    const next = new Set(chosen);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  }

  return (
    <div className="border-t-2 border-black px-3 py-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {catalogue.map((field) => (
          <label key={field.key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-black"
              checked={chosen.has(field.key)}
              onChange={() => toggle(field.key)}
            />
            <span>{field.label}</span>
            {field.source === "custom" && (
              <span className="border border-black/40 px-1 text-[0.6rem] uppercase tracking-wider">
                custom
              </span>
            )}
          </label>
        ))}
      </div>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={() => onChange(new Set(DEFAULT_EXPORT_FIELDS))}
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

function Action({
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
      className="border-2 border-black px-2 py-1 text-xs font-semibold uppercase tracking-wider disabled:opacity-40"
    >
      {children}
    </button>
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

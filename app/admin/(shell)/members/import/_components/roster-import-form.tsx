"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";

import {
  commitRosterImport,
  previewRosterImport,
  type CommitState,
  type PreviewRow,
  type PreviewState,
} from "@/app/actions/member-import";
import type { ImportCounts } from "@/lib/member-import";

// The two-step roster import (§7 Stage 6 phase 7b), modelled directly on
// /admin/dues/import's form. Three things are copied deliberately rather than
// rediscovered:
//
// 🔓 The CSV text lives in THIS COMPONENT'S STATE between the steps and nowhere
// else. No staging table, no temp file. It is sent twice, once to preview and
// once to commit, and the commit re-parses it rather than trusting anything the
// preview returned.
//
// ⚠️ React 19 resets an uncontrolled `<form action={…}>` once the action
// resolves, which is why the file name and the text are component state rather
// than form fields — a reset would wipe them the instant the preview came back
// and the commit would post an empty body.
//
// 🐛 `useActionState` has no reset, so `commit.status` stays "done" forever once
// an import succeeds — which left "Import another file" clearing the text while
// the Done panel kept rendering. `dismissed` is the missing half, un-set
// whenever the action speaks again. That was a walkthrough defect in the dues
// import; it is not one worth finding twice.

const PREVIEW_INITIAL: PreviewState = { status: "idle" };
const COMMIT_INITIAL: CommitState = { status: "idle" };

export function RosterImportForm() {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [preview, previewAction, previewing] = useActionState(
    previewRosterImport,
    PREVIEW_INITIAL
  );
  const [commit, commitAction, committing] = useActionState(
    commitRosterImport,
    COMMIT_INITIAL
  );

  const [dismissed, setDismissed] = useState(false);
  const [seenCommit, setSeenCommit] = useState(commit);
  if (commit !== seenCommit) {
    setSeenCommit(commit);
    setDismissed(false);
  }

  const done = commit.status === "done" && !dismissed;

  function onFile(file: File | undefined) {
    if (!file) return;
    setReading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setCsv(typeof reader.result === "string" ? reader.result : "");
      setFileName(file.name);
      setReading(false);
    };
    reader.onerror = () => {
      setCsv("");
      setReading(false);
    };
    reader.readAsText(file);
  }

  function reset() {
    setCsv("");
    setFileName("");
    setDismissed(true);
    // Clearing the DOM input too: it is uncontrolled, so React does not reset
    // it, and the officer would otherwise still see the old file name beside a
    // chooser that had forgotten the text.
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <div className="flex flex-col gap-6">
      {!done && (
        <div className="border-2 border-black bg-misa-panel px-4 py-4">
          <label className="block text-sm font-semibold" htmlFor="roster">
            Roster (.csv)
          </label>
          <input
            id="roster"
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            className="mt-2 block w-full text-sm file:mr-3 file:border-2 file:border-black file:bg-white file:px-3 file:py-1 file:text-xs file:font-semibold file:uppercase file:tracking-wider"
            onChange={(event) => onFile(event.currentTarget.files?.[0])}
          />
          {fileName && (
            <p className="mt-2 text-xs text-foreground/70">
              Loaded <span className="font-medium">{fileName}</span> (
              {Math.max(1, Math.round(csv.length / 1024))} KB). Nothing has been
              saved yet.
            </p>
          )}
        </div>
      )}

      {/* Step 1 — preview. Writes nothing. */}
      {csv !== "" && preview.status !== "ready" && !done && (
        <form action={previewAction}>
          <input type="hidden" name="csv" value={csv} readOnly />
          <input type="hidden" name="fileName" value={fileName} readOnly />
          <button
            type="submit"
            disabled={previewing || reading}
            className="border-2 border-black bg-black px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-40"
          >
            {previewing ? "Reading…" : "Preview import"}
          </button>
        </form>
      )}

      <Problem state={preview} />
      <Problem state={commit} />

      {/* Step 2 — the preview, then the commit. */}
      {preview.status === "ready" && !done && (
        <>
          <Summary
            counts={preview.counts}
            ignoredColumns={preview.ignoredColumns}
          />
          <RowTable rows={preview.rows} />

          <form action={commitAction} className="flex flex-wrap gap-3">
            {/* The same text again. commitRosterImport re-parses it rather than
                accepting anything the preview returned. */}
            <input type="hidden" name="csv" value={csv} readOnly />
            <input type="hidden" name="fileName" value={fileName} readOnly />
            <button
              type="submit"
              disabled={committing || preview.counts.fresh === 0}
              className="border-2 border-black bg-black px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-40"
            >
              {committing
                ? "Importing…"
                : `Add ${preview.counts.fresh} member${
                    preview.counts.fresh === 1 ? "" : "s"
                  }`}
            </button>
            <button
              type="button"
              onClick={reset}
              className="border-2 border-black px-3 py-2 text-xs font-semibold uppercase tracking-wider"
            >
              Choose a different file
            </button>
          </form>

          {preview.counts.fresh === 0 && (
            <p className="text-sm font-medium">
              There is nobody new in this file — every row is already on the
              roster or needs fixing first.
            </p>
          )}
        </>
      )}

      {done && <Done counts={commit.counts} onAnother={reset} />}
    </div>
  );
}

function Problem({ state }: { state: PreviewState | CommitState }) {
  if (
    state.status !== "error" &&
    state.status !== "unauthorized" &&
    state.status !== "empty" &&
    state.status !== "too_large" &&
    state.status !== "no_header" &&
    state.status !== "raced"
  ) {
    return null;
  }

  const message =
    state.status === "error"
      ? "Something went wrong reading that file. Nothing was imported."
      : state.status === "unauthorized"
        ? "Your session expired. Sign in again."
        : state.status === "raced"
          ? "Somebody was added to the roster while you were looking at this, so nothing was imported. Preview again — anyone now on the roster will be skipped."
          : state.message;

  return (
    <p
      role="alert"
      className="border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm"
    >
      {message}
    </p>
  );
}

function Summary({
  counts,
  ignoredColumns,
}: {
  counts: ImportCounts;
  ignoredColumns: string[];
}) {
  return (
    <div className="border-2 border-black px-4 py-4">
      <h2 className="font-display text-lg font-bold">Before you import</h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <Stat label="New members" value={counts.fresh} />
        <Stat label="Already on the roster" value={counts.existing} />
        <Stat label="Repeated in the file" value={counts.duplicate} />
        <Stat label="Need fixing" value={counts.invalid} />
      </dl>

      {counts.existing > 0 && (
        <p className="mt-3 text-sm text-foreground/70">
          {counts.existing} {counts.existing === 1 ? "row is" : "rows are"}{" "}
          already on the roster and will be skipped —{" "}
          <span className="font-medium">
            nothing about those members is changed
          </span>
          .
        </p>
      )}

      {counts.invalid > 0 && (
        <p className="mt-2 text-sm">
          <span className="font-medium">
            {counts.invalid} {counts.invalid === 1 ? "row" : "rows"} cannot be
            imported as written
          </span>{" "}
          — fix them in the spreadsheet and upload it again. The rest will still
          import.
        </p>
      )}

      {ignoredColumns.length > 0 && (
        <p className="mt-2 text-xs text-foreground/60">
          Ignored {ignoredColumns.length}{" "}
          {ignoredColumns.length === 1 ? "column" : "columns"}:{" "}
          {ignoredColumns.join(", ")}. Calculated values are not imported.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-foreground/60">
        {label}
      </dt>
      <dd className="text-xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function RowTable({ rows }: { rows: PreviewRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="max-h-[60vh] overflow-auto border-2 border-black">
      <table className="w-full min-w-[48rem] border-collapse text-sm">
        <thead className="bg-misa-panel">
          <tr>
            {["Line", "Name", "Email", "EID", "Outcome"].map((head) => (
              <th
                key={head}
                scope="col"
                className="sticky top-0 z-10 border-b-2 border-black bg-misa-panel px-3 py-2 text-left"
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.line}
              className={`border-b border-black/20 last:border-b-0 ${
                row.willImport ? "" : "bg-black/[0.03] text-foreground/60"
              }`}
            >
              <td className="px-3 py-2 tabular-nums">{row.line}</td>
              <td className="px-3 py-2">
                {row.fullName || "—"}
                {!row.active && (
                  <span className="ml-2 border border-black/40 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wider">
                    inactive
                  </span>
                )}
              </td>
              <td className="px-3 py-2">{row.email || "—"}</td>
              <td className="px-3 py-2">{row.eid || "—"}</td>
              <td className="px-3 py-2">{row.outcome}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Done({
  counts,
  onAnother,
}: {
  counts: ImportCounts;
  onAnother: () => void;
}) {
  return (
    <div className="border-2 border-black px-4 py-4">
      <h2 className="font-display text-lg font-bold">Imported</h2>
      <p className="mt-2 text-sm">
        {counts.fresh} member{counts.fresh === 1 ? "" : "s"} added
        {counts.existing > 0 &&
          `, ${counts.existing} already on the roster and skipped`}
        .
      </p>
      {counts.invalid > 0 && (
        <p className="mt-2 text-sm font-medium">
          {counts.invalid} row{counts.invalid === 1 ? "" : "s"} still need
          fixing — they were not imported.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href="/admin/members"
          className="border-2 border-black bg-black px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white"
        >
          Back to the directory
        </Link>
        <button
          type="button"
          onClick={onAnother}
          className="border-2 border-black px-3 py-2 text-xs font-semibold uppercase tracking-wider"
        >
          Import another file
        </button>
      </div>
    </div>
  );
}

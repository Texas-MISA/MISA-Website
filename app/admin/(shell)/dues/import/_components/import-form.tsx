"use client";
import { BUTTON_PRIMARY_SM, BUTTON_QUIET_SM } from "@/components/ui/button";

import { useActionState, useRef, useState } from "react";

import {
  commitImport,
  previewImport,
  type CommitState,
  type ImportCounts,
  type PreviewRow,
  type PreviewState,
} from "@/app/actions/dues";
import { SectionHeading } from "@/components/ui/page-header";
import { Notice } from "@/app/admin/(shell)/_components/notice";
import { Pill } from "@/components/ui/pill";
import { Panel } from "@/components/ui/panel";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";

// The two-step import (§7 Stage 6.5 phase 2).
//
// 🔓 The CSV text lives in THIS COMPONENT'S STATE between the two steps and
// nowhere else. No staging table, no temp file, no base64 round trip through a
// hidden field on the server's side of the wire — a statement is every dues
// transaction for a month, and the fewer copies of it exist the better. It is
// sent twice, once to preview and once to commit, and the commit re-parses it
// rather than trusting anything the preview returned.
//
// ⚠️ Two actions rather than one with a `step` discriminator, because preview
// and commit return genuinely different shapes and a single union would make
// every render site check statuses that cannot occur.
//
// ⚠️ React 19 resets an uncontrolled `<form action={…}>` once the action
// resolves, which is why the file name and the text are component state rather
// than form fields — a reset would otherwise wipe them the instant the preview
// came back, and the commit would post an empty body.

const PREVIEW_INITIAL: PreviewState = { status: "idle" };
const COMMIT_INITIAL: CommitState = { status: "idle" };

export function ImportForm({ maxRows }: { maxRows: number }) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [preview, previewAction, previewing] = useActionState(
    previewImport,
    PREVIEW_INITIAL
  );
  const [commit, commitAction, committing] = useActionState(
    commitImport,
    COMMIT_INITIAL
  );

  // ⚠️ useActionState has no reset, so `commit.status` stays "done" forever
  // once an import succeeds — which left "Import another statement" clearing the
  // text while the Done panel kept rendering and the file chooser stayed hidden.
  // The button did nothing visible. Found in the phase-2 walkthrough.
  //
  // `dismissed` is the missing half, un-set whenever the action speaks again —
  // the render-phase derived-state idiom this codebase uses in grant-form.tsx
  // and directory-row.tsx rather than an effect, so no stale frame paints.
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
        <Panel ground="white" pad="sm">
          <label className="block text-sm font-semibold" htmlFor="statement">
            Venmo statement (.csv)
          </label>
          <input
            id="statement"
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            className="mt-2 block w-full text-sm file:mr-3 file:border file:border-misa-border file:bg-white file:px-3 file:py-1 file:text-xs file:font-semibold file:uppercase file:tracking-wider"
            onChange={(event) => onFile(event.currentTarget.files?.[0])}
          />
          {fileName && (
            <p className="mt-2 text-xs text-misa-secondary">
              Loaded <span className="font-medium">{fileName}</span> (
              {Math.max(1, Math.round(csv.length / 1024))} KB). Nothing has been
              saved yet.
            </p>
          )}
          <p className="mt-2 text-xs text-misa-muted">
            Up to {maxRows.toLocaleString()} payments per import. Only completed
            incoming payments count as dues — transfers to the bank are ignored.
          </p>
        </Panel>
      )}

      {/* Step 1 — preview. Writes nothing. */}
      {csv !== "" && preview.status !== "ready" && !done && (
        <form action={previewAction}>
          <input type="hidden" name="csv" value={csv} readOnly />
          <input type="hidden" name="fileName" value={fileName} readOnly />
          <button
            type="submit"
            disabled={previewing || reading}
            className={BUTTON_PRIMARY_SM}
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
          <Summary counts={preview.counts} />
          <RowTable rows={preview.rows} />

          <form action={commitAction} className="flex flex-wrap gap-3">
            {/* The same text again. commitImport re-parses it rather than
                accepting anything the preview returned. */}
            <input type="hidden" name="csv" value={csv} readOnly />
            <input type="hidden" name="fileName" value={fileName} readOnly />
            <button
              type="submit"
              disabled={committing || preview.counts.fresh === 0}
              className={BUTTON_PRIMARY_SM}
            >
              {committing
                ? "Importing…"
                : `Import ${preview.counts.fresh} payment${
                    preview.counts.fresh === 1 ? "" : "s"
                  }`}
            </button>
            <button
              type="button"
              onClick={reset}
              className={BUTTON_QUIET_SM}
            >
              Choose a different file
            </button>
          </form>

          {preview.counts.fresh === 0 && (
            <p className="text-sm font-medium">
              Everything in this statement is already recorded — there is
              nothing to import.
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
    state.status !== "too_large"
  ) {
    return null;
  }

  const message =
    state.status === "error"
      ? "Something went wrong reading that statement. Nothing was imported."
      : state.status === "unauthorized"
        ? "Your session expired. Sign in again."
        : state.message;

  return (
    <Notice tone="error" role="alert">
      {message}
    </Notice>
  );
}

function Summary({ counts }: { counts: ImportCounts }) {
  return (
    <Panel ground="white" pad="sm">
      <SectionHeading level="sub">Before you import</SectionHeading>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <Stat label="New payments" value={counts.fresh} />
        <Stat label="Already recorded" value={counts.duplicate} />
        <Stat label="Need review" value={counts.queued} />
        <Stat label="Not payments" value={counts.skipped} />
      </dl>

      {counts.duplicate > 0 && (
        <p className="mt-3 text-sm text-misa-secondary">
          {counts.duplicate} payment{counts.duplicate === 1 ? " is" : "s are"}{" "}
          already recorded and will be skipped. Importing overlapping statements
          is safe.
        </p>
      )}

      {counts.queued > 0 && (
        <p className="mt-2 text-sm">
          <span className="font-medium">
            {counts.queued} payment{counts.queued === 1 ? "" : "s"} still need
            an officer
          </span>{" "}
          — the note did not name exactly one member, or the amount does not
          match a dues price. They will be imported and queued, never dropped.
        </p>
      )}

      {/* 🪤 §4.7 puts May–July in Spring, so a July payment for the coming year
          buys a term with three weeks left. Warned about rather than silently
          corrected — the rule is not changed, and start_term is editable. */}
      {counts.summer > 0 && (
        <p className="mt-2 text-sm">
          ⚠️ {counts.summer} payment{counts.summer === 1 ? "" : "s"} fell
          between May and July, which counts as the{" "}
          <span className="font-medium">Spring</span> term. If they were meant
          for the coming Fall, correct the start term on each payment after
          importing.
        </p>
      )}
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-misa-muted">
        {label}
      </dt>
      <dd className="text-xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

const REVIEW_LABEL: Record<string, string> = {
  unmatched: "No member in the note",
  ambiguous: "Names two members",
  undecided_amount: "Amount needs a decision",
};

function RowTable({ rows }: { rows: PreviewRow[] }) {
  if (rows.length === 0) return null;

  return (
    <Table minWidth="min-w-[44rem]">
      <THead>
        <Tr hover={false}>
          <Th className="px-3">Paid</Th>
          <Th className="px-3">From</Th>
          <Th className="px-3">Note</Th>
          <Th className="px-3" numeric>
            Amount
          </Th>
          <Th className="px-3">Outcome</Th>
        </Tr>
      </THead>
      <tbody>
        {rows.map((row) => (
          // A duplicate is `muted` — already recorded, so it is a fact about
          // this file rather than something the import will do.
          <Tr
            key={row.venmoTxnId}
            muted={row.duplicate}
            className={row.duplicate ? "bg-misa-panel" : ""}
          >
            <Td className="px-3">{row.paidAtLabel}</Td>
            <Td className="px-3">{row.payerName ?? "—"}</Td>
            <Td className="px-3">{row.note ?? "—"}</Td>
            <Td className="px-3" numeric>
              ${(row.amountCents / 100).toFixed(2)}
            </Td>
            <Td className="px-3">
              {row.duplicate ? (
                <span className="text-[11px] tracking-[0.12em] uppercase">
                  already recorded
                </span>
              ) : row.review ? (
                <Pill tone="caution">
                  {REVIEW_LABEL[row.review] ?? row.review}
                </Pill>
              ) : (
                <span>
                  Matched · {row.termsCovered} term
                  {row.termsCovered === 1 ? "" : "s"}
                </span>
              )}
              {row.summer && !row.duplicate && (
                <span className="ml-2 text-xs text-misa-secondary">
                  (Spring)
                </span>
              )}
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
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
    <Panel ground="white" pad="sm">
      <SectionHeading level="sub">Imported</SectionHeading>
      <p className="mt-2 text-sm">
        {counts.fresh} payment{counts.fresh === 1 ? "" : "s"} recorded
        {counts.duplicate > 0 &&
          `, ${counts.duplicate} already on file and skipped`}
        .
      </p>
      {counts.queued > 0 && (
        <p className="mt-2 text-sm font-medium">
          {counts.queued} still need an officer to resolve.
        </p>
      )}
      <button
        type="button"
        onClick={onAnother}
        className={`mt-4 ${BUTTON_QUIET_SM}`}
      >
        Import another statement
      </button>
    </Panel>
  );
}

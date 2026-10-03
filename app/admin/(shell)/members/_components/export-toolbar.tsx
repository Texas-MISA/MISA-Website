"use client";
import { BUTTON_QUIET_SM } from "@/components/ui/button";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { rememberDirectoryColumns } from "@/app/actions/directory-columns";
import {
  Action,
  Download,
  FieldPicker,
} from "@/app/admin/(shell)/_components/export-controls";
import {
  isDefaultPreference,
  LOCKED_COLUMNS,
  nextDirectoryColumnsPreference,
  serializeDirectoryColumns,
  visibleColumnKeys,
  type DirectoryColumnsPreference,
} from "@/lib/directory-columns";
import type { ExportField } from "@/lib/export";

import { useSelection } from "./selection";

// Selection and extraction controls (§7 Stage 6 phase 5), and since 2026-10-01
// the directory's COLUMN control as well.
//
// ⚠️ Every count the officer is shown after a copy is the count that actually
// came back, never the count that was selected. They differ legitimately —
// toEmailList skips members with no address on file — and reporting the
// selection would be a quiet claim that N people were emailed when N-3 were.
//
// The clipboard and the file download hit the same Route Handler, because they
// are the same egress and earn the same audit receipt (§6). The only difference
// is Content-Disposition.
//
// ⚠️ **The Fields menu drives the TABLE, and the export follows the table.** It
// was an export-only picker held in this component's state, which is why
// ticking a box never changed the columns. Now a tick calls the Server Action
// `rememberDirectoryColumns`, which sets the officer's choice as a cookie; and
// because an action that sets a cookie re-renders the page in the same
// response, that response is the table with its new columns. There is no
// router.refresh() — the action's file says where that is documented. The
// export URL names exactly the columns that render CONFIRMED, never the
// optimistic ticks, so a file can never carry a column the table is not
// showing yet.
//
// 🔓 **Never `document.cookie`.** The first build wrote the cookie from here,
// and WebKit (Safari, every iOS browser) and Brave cap a script-written cookie
// at seven days. The server's Set-Cookie keeps its year.

const EXPORT_PATH = "/admin/members/export";

/**
 * The reason beside each locked box, visible rather than a `title` — the box is
 * disabled, and a title on a disabled control reaches nobody.
 *
 * A Map, because FieldPicker reads it by catalogue key and a custom field may
 * legally be keyed `constructor`.
 */
const LOCKED_REASONS: ReadonlyMap<string, string> = new Map(
  [...LOCKED_COLUMNS].map((key) => [key, "always shown"])
);

/** Shown, and announced, while a column change is on its way to the server. */
const UPDATING_TABLE = "Updating the table…";

/** Why the columns did not change. The ticks go back on their own when the
 * transition ends — nothing was written — so only the reason needs saying. */
const COLUMNS_SIGNED_OUT =
  "Your session expired. Sign in again — the columns did not change.";
const COLUMNS_NOT_CHANGED = "Couldn't change the columns.";

type Status =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done"; message: string }
  | { kind: "failed"; message: string };

export function ExportToolbar({
  filterParams,
  catalogue,
  preferred,
  previous,
  defaults,
  sorted,
  unsortedHref,
}: {
  /** The current filter, already serialized by memberFilterToParams. */
  filterParams: string;
  catalogue: ExportField[];
  /** The officer's column choice (P) as the server resolved it, catalogue
   * order. Name is always in it. */
  preferred: string[];
  /** The cookie as the server parsed it, or null — what the next change
   * builds on, so entries for keys this catalogue lacks are kept. */
  previous: DirectoryColumnsPreference | null;
  /** The default columns — what "Reset to default" goes back to. */
  defaults: string[];
  /** The column the table's sort forces on screen, or null. */
  sorted: string | null;
  /** This filter with the sort dropped — where hiding the sorted column goes. */
  unsortedHref: string;
}) {
  const router = useRouter();
  const { mode, ids, total, count, selectAllMatching, clear } =
    useSelection();

  // 📌 The ticks are OPTIMISTIC: they move the instant a box is clicked, and
  // fall back to `preferred` when the transition ends — by then the server's
  // new answer, since the action's response carries the re-rendered page, or
  // the unchanged old one if the action failed. The table changes one round
  // trip later, and "Updating the table…" covers the gap.
  const [optimistic, setOptimistic] = useOptimistic(preferred);
  const [pending, startTransition] = useTransition();
  const [picking, setPicking] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [columnsProblem, setColumnsProblem] = useState<string | null>(null);

  const chosen: ReadonlySet<string> = new Set(optimistic);
  const shown = visibleColumnKeys(catalogue, optimistic, sorted);

  const url = useMemo(() => {
    // ⚠️ The SERVER-CONFIRMED columns, never the optimistic ticks. These are
    // the columns the table is drawing right now, so the file is the table on
    // screen even mid-refresh. Catalogue order, not click order, so the header
    // row is stable and matches the table left to right.
    const onScreen = visibleColumnKeys(catalogue, preferred, sorted);
    return (format: string) => {
      const params = new URLSearchParams(filterParams);
      params.set("format", format);
      for (const key of onScreen) params.append("fields", key);
      // In `filter` mode no ids are sent at all and the route re-runs the same
      // filtered query — that is what makes "all N" provably all N rather than
      // whatever happened to be rendered.
      if (mode === "ids") {
        for (const id of ids) params.append("ids", id);
      }
      return `${EXPORT_PATH}?${params.toString()}`;
    };
  }, [filterParams, catalogue, preferred, sorted, mode, ids]);

  // Name is locked, so there is always at least one column — what can be
  // missing now is only rows.
  const nothingSelected = count === 0;

  /** Catalogue order, so the cookie is a function of the choice and not of
   * the order the boxes were clicked in. */
  function inCatalogueOrder(keys: ReadonlySet<string>): string[] {
    return catalogue.map((field) => field.key).filter((key) => keys.has(key));
  }

  /** The officer ticked or unticked a box, or chose Select all. */
  function choose(next: ReadonlySet<string>) {
    const keys = inCatalogueOrder(next);
    // Built on `previous`, so a choice about a field this page cannot see —
    // archived today, or hidden by a failed definitions read — survives.
    const pref = nextDirectoryColumnsPreference(
      keys,
      defaults,
      catalogue,
      previous
    );
    // Nothing left to remember deletes the cookie, so a later change to the
    // defaults reaches this officer in full.
    remember(
      keys,
      isDefaultPreference(pref) ? null : serializeDirectoryColumns(pref)
    );
  }

  /** "Reset to default" FORGETS: the cookie goes, carried entries and all. */
  function reset() {
    remember(
      inCatalogueOrder(new Set([...defaults, ...LOCKED_COLUMNS])),
      null
    );
  }

  /**
   * Show `keys` at once, and have the server remember `value` (null forgets).
   *
   * The action's response IS the re-rendered page, so the ticks hold until the
   * new table arrives with them. A failure needs no undo: nothing was written,
   * and the ticks fall back to `preferred` when the transition ends. Hiding the
   * column the table is sorted by then navigates to the same filter unsorted,
   * because the re-render alone would force that column straight back on
   * screen. 📌 That navigation resets the row selection — the filter key
   * changes — exactly as clicking a sort header does.
   */
  function remember(keys: readonly string[], value: string | null) {
    const dropsSort =
      sorted !== null && chosen.has(sorted) && !keys.includes(sorted);
    setColumnsProblem(null);
    startTransition(async () => {
      setOptimistic([...keys]);
      // A rejection is a network failure or a deploy mid-session, and it gets
      // the same answer as a refusal: the columns did not change.
      const result = await rememberDirectoryColumns(value).catch(() => null);
      if (result?.status !== "saved") {
        setColumnsProblem(
          result?.status === "unauthorized"
            ? COLUMNS_SIGNED_OUT
            : COLUMNS_NOT_CHANGED
        );
        return;
      }
      if (dropsSort) router.replace(unsortedHref, { scroll: false });
    });
  }

  // The sorted column explains itself: ticked, it warns what unticking does;
  // unticked, it says why it is on screen anyway. "name" because the picker
  // calls that box Name — the table's header says Member, the picker does not.
  const notes: ReadonlyMap<string, string> | undefined =
    sorted === null
      ? undefined
      : new Map([
          [
            sorted,
            chosen.has(sorted)
              ? "sorted — hiding it sorts by name"
              : "shown while the table is sorted by it",
          ],
        ]);

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
    <div className="mb-4 border border-misa-border bg-white">
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

        {/* The column change's announcement, separate from the visible text
            beside it — the same shape as the copy status further down, for
            the same two reasons written there: a live region must be in the
            DOM BEFORE its contents change, so it cannot be the conditional
            span below; and this row is `flex … gap-3`, so it cannot be a
            wrapper around that span either. `sr-only` is absolutely
            positioned, so it leaves the flow and cannot move anything. */}
        <span role="status" className="sr-only">
          {pending ? UPDATING_TABLE : (columnsProblem ?? "")}
        </span>

        {pending && (
          <span className="text-sm text-misa-secondary" aria-hidden="true">
            {UPDATING_TABLE}
          </span>
        )}
        {!pending && columnsProblem !== null && (
          <span
            className="text-sm font-medium text-misa-critical"
            aria-hidden="true"
          >
            {columnsProblem}
          </span>
        )}

        {/* N is the number of columns on screen: the ticks, plus a column
            shown only because the table is sorted by it. It follows the ticks
            at once; the table catches up when the action's response lands. */}
        <button
          type="button"
          onClick={() => setPicking((open) => !open)}
          className={BUTTON_QUIET_SM}
          aria-expanded={picking}
        >
          Fields ({shown.length})
        </button>
      </div>

      {picking && (
        <FieldPicker
          defaults={defaults}
          catalogue={catalogue}
          chosen={chosen}
          onChange={choose}
          onReset={reset}
          locked={LOCKED_REASONS}
          notes={notes}
          intro="The table shows these columns; Download and Copy table export exactly these. Remembered on this browser."
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
        <Download href={url("xlsx")} disabled={nothingSelected} primary>
          Download XLSX
        </Download>
        <Download href={url("csv")} disabled={nothingSelected}>
          Download CSV
        </Download>

        {/* The announcement, separate from the visible text below.
            "Copied 40 addresses." was visible-only, and the clipboard gives no
            other feedback — so a screen-reader user had no way to know whether
            the copy worked.

            🪤 Two things force this shape. A live region must be in the DOM
            BEFORE its contents change, so it cannot be one of the conditional
            spans below — those mount already carrying their text, which is
            frequently missed. And it cannot be a wrapper around them either:
            the row is `flex … gap-2`, so an always-mounted wrapper is a flex
            item even when empty and would put 8px of dead air after the
            download links. `sr-only` is absolutely positioned, so it leaves
            the flow and cannot move anything. */}
        <span role="status" className="sr-only">
          {status.kind === "working" ? "Working…" : ""}
          {status.kind === "done" || status.kind === "failed"
            ? status.message
            : ""}
        </span>

        {status.kind === "working" && (
          <span className="text-sm text-misa-secondary" aria-hidden="true">
            Working…
          </span>
        )}
        {status.kind === "done" && (
          <span className="text-sm font-medium" aria-hidden="true">
            {status.message}
          </span>
        )}
        {status.kind === "failed" && (
          <span
            className="text-sm font-medium text-misa-critical"
            aria-hidden="true"
          >
            {status.message}
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

"use client";

import { useActionState, useState } from "react";

import {
  publishSeries,
  setSeriesStatus,
  type EventActionState,
  type SeriesPublishState,
} from "@/app/actions/events";
import { formatEventRange } from "@/lib/events";
import { BUTTON_QUIET_SM } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

// Publish or cancel a whole series (§7 Stage 4).
//
// Publishing is one UPDATE, so it is all-or-nothing: a single overlapping week
// would fail the entire batch. The pre-flight below turns that into a list of
// named collisions and two explicit choices, rather than a SQLSTATE.

const PUBLISH_INITIAL: SeriesPublishState = { status: "idle" };
const STATUS_INITIAL: EventActionState = { status: "idle" };

const buttonClass =
  BUTTON_QUIET_SM;

export function SeriesActions({
  seriesId,
  draftCount,
  cancellableCount,
}: {
  seriesId: string;
  draftCount: number;
  /**
   * How many events cancelling would actually change — every occurrence in the
   * series that is not already cancelled.
   *
   * 🔴 The confirm names this because the button's blast radius is wider than
   * its label admits. `setSeriesStatus` updates on `series_id` alone, with no
   * status and no date filter, so it cancels drafts, published occurrences and
   * PAST ones alike — and there is no series-level un-cancel: once the drafts
   * are gone the publish control stops rendering, and recovery is per-event.
   * "Cancel the whole series?" and "Cancel all 14 events in this series?" are
   * the same click and very different decisions.
   */
  cancellableCount: number;
}) {
  const [publishState, publishAction, publishPending] = useActionState(
    publishSeries,
    PUBLISH_INITIAL
  );
  const [statusState, statusAction, statusPending] = useActionState(
    setSeriesStatus,
    STATUS_INITIAL
  );

  // ⚠️ The confirm is a two-click control, never `window.confirm` — same rule
  // as preset-row.tsx and merge-panel.tsx: a native dialog blocks the whole tab
  // and this codebase has no other modal.
  const [confirming, setConfirming] = useState(false);

  // Drop out of the confirm step whenever the action speaks — render-phase
  // derived state rather than an effect, because `useActionState` has no reset.
  // Same idiom as merge-panel.tsx and grant-form.tsx.
  const [seenStatus, setSeenStatus] = useState(statusState);
  if (statusState !== seenStatus) {
    setSeenStatus(statusState);
    setConfirming(false);
  }

  return (
    <Panel ground="white" pad="sm">
      <SectionHeading level="sub">This series</SectionHeading>

      {publishState.status === "conflicts" && (
        <div role="alert" className="mt-3 text-sm">
          <p>
            <strong>
              {publishState.conflicts.length}{" "}
              {publishState.conflicts.length === 1
                ? "occurrence collides"
                : "occurrences collide"}{" "}
              with an already-published event.
            </strong>{" "}
            Only one event can be open for check-in at a time, so publishing
            the whole series would be rejected outright and nothing would go
            live.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {publishState.conflicts.map((conflict, index) => (
              <li key={index}>
                {formatEventRange(
                  conflict.candidateStartsAt,
                  conflict.candidateStartsAt
                )}{" "}
                collides with <strong>{conflict.withTitle}</strong>
                {conflict.withEventId === null &&
                  " (another occurrence in this series)"}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            Fix those occurrences, or publish the rest and leave them as
            drafts.
          </p>
        </div>
      )}

      {publishState.status === "conflict_race" && (
        <p role="alert" className="mt-3 text-sm">
          The schedule changed while you were publishing — someone published a
          conflicting event just now. Nothing was published; try again to see
          the current collisions.
        </p>
      )}

      {publishState.status === "published" && (
        <p role="status" className="mt-3 text-sm">
          Published {publishState.count}{" "}
          {publishState.count === 1 ? "occurrence" : "occurrences"}.
          {publishState.skipped > 0 &&
            ` ${publishState.skipped} left as drafts because of overlaps.`}
        </p>
      )}

      {(publishState.status === "error" || statusState.status === "error") && (
        <p role="alert" className="mt-3 text-sm">
          That didn&apos;t work — please try again.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {draftCount > 0 && (
          <form action={publishAction}>
            <input type="hidden" name="seriesId" value={seriesId} />
            <button
              type="submit"
              disabled={publishPending}
              className={buttonClass}
            >
              Publish all {draftCount} drafts
            </button>
          </form>
        )}

        {publishState.status === "conflicts" && (
          <form action={publishAction}>
            <input type="hidden" name="seriesId" value={seriesId} />
            <input type="hidden" name="skipConflicts" value="yes" />
            <button
              type="submit"
              disabled={publishPending}
              className={buttonClass}
            >
              Publish the rest
            </button>
          </form>
        )}

        {confirming ? (
          <form
            action={statusAction}
            className="flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="seriesId" value={seriesId} />
            <input type="hidden" name="status" value="cancelled" />
            <span className="text-xs">
              Cancel all {cancellableCount}{" "}
              {cancellableCount === 1 ? "event" : "events"} in this series?
              This cannot be undone.
            </span>
            <button
              type="submit"
              disabled={statusPending}
              className={`${buttonClass} border-misa-critical/50 text-misa-critical`}
            >
              {statusPending ? "Cancelling…" : "Cancel them"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="px-2 py-1 text-xs underline underline-offset-4"
            >
              Keep them
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={`${buttonClass} border-misa-critical/50 text-misa-critical`}
          >
            Cancel whole series
          </button>
        )}
      </div>
    </Panel>
  );
}

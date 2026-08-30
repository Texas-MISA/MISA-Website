"use client";

import { useActionState } from "react";

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
}: {
  seriesId: string;
  draftCount: number;
}) {
  const [publishState, publishAction, publishPending] = useActionState(
    publishSeries,
    PUBLISH_INITIAL
  );
  const [statusState, statusAction, statusPending] = useActionState(
    setSeriesStatus,
    STATUS_INITIAL
  );

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
              PUBLISH ALL {draftCount} DRAFTS
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
              PUBLISH THE REST
            </button>
          </form>
        )}

        <form action={statusAction}>
          <input type="hidden" name="seriesId" value={seriesId} />
          <input type="hidden" name="status" value="cancelled" />
          <button
            type="submit"
            disabled={statusPending}
            className={`${buttonClass} border-misa-critical/50 text-misa-critical`}
          >
            CANCEL WHOLE SERIES
          </button>
        </form>
      </div>
    </Panel>
  );
}

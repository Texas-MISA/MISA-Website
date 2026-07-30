"use client";

import { useActionState } from "react";

import {
  deleteEvent,
  duplicateEvent,
  setEventStatus,
  type EventActionState,
} from "@/app/actions/events";

// Lifecycle controls: publish, cancel, reopen, delete (§4.1, §4.6).
//
// Each is a separate <form action> posting to a Server Action, so none of them
// can be triggered by a prefetch or a stray GET the way a link could.

const INITIAL: EventActionState = { status: "idle" };

const buttonClass =
  "rounded-full border border-black/50 px-5 py-2 text-xs font-medium tracking-wider transition hover:bg-black/5 disabled:opacity-60";

export function EventLifecycle({
  eventId,
  status,
  attendanceCount,
}: {
  eventId: string;
  status: string;
  attendanceCount: number;
}) {
  const [statusState, statusAction, statusPending] = useActionState(
    setEventStatus,
    INITIAL
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteEvent,
    INITIAL
  );
  const [, duplicateAction, duplicatePending] = useActionState(
    duplicateEvent,
    INITIAL
  );

  return (
    <div className="flex flex-col gap-4">
      {statusState.status === "overlap" && (
        <p
          role="alert"
          className="border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm"
        >
          Can&apos;t publish: another published event&apos;s check-in window
          overlaps this one. Only one event can be open for check-in at a time.
          Adjust either event&apos;s times or its check-in window first.
        </p>
      )}
      {(statusState.status === "error" || deleteState.status === "error") && (
        <p
          role="alert"
          className="border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm"
        >
          That didn&apos;t work — please try again.
        </p>
      )}
      {deleteState.status === "blocked" && (
        <p
          role="alert"
          className="border-l-4 border-amber-700 bg-misa-panel px-4 py-3 text-sm"
        >
          This event has {deleteState.attendanceCount} recorded check-
          {deleteState.attendanceCount === 1 ? "in" : "ins"}, so it can&apos;t
          be deleted — those are records of people who showed up. Cancel it
          instead: the history stays, and it disappears from the public
          schedule.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {status !== "published" && (
          <form action={statusAction}>
            <input type="hidden" name="id" value={eventId} />
            <input type="hidden" name="status" value="published" />
            <button type="submit" disabled={statusPending} className={buttonClass}>
              PUBLISH
            </button>
          </form>
        )}

        {status === "published" && (
          <form action={statusAction}>
            <input type="hidden" name="id" value={eventId} />
            <input type="hidden" name="status" value="draft" />
            <button type="submit" disabled={statusPending} className={buttonClass}>
              UNPUBLISH
            </button>
          </form>
        )}

        {status !== "cancelled" && (
          <form action={statusAction}>
            <input type="hidden" name="id" value={eventId} />
            <input type="hidden" name="status" value="cancelled" />
            <button type="submit" disabled={statusPending} className={buttonClass}>
              CANCEL EVENT
            </button>
          </form>
        )}

        {/* The weekly-meeting shortcut: clone as a draft one week later,
            keeping the same wall-clock time across the DST change. */}
        <form action={duplicateAction}>
          <input type="hidden" name="id" value={eventId} />
          <button type="submit" disabled={duplicatePending} className={buttonClass}>
            DUPLICATE +1 WEEK
          </button>
        </form>

        <form action={deleteAction}>
          <input type="hidden" name="id" value={eventId} />
          <button
            type="submit"
            disabled={deletePending || attendanceCount > 0}
            title={
              attendanceCount > 0
                ? "Events with recorded check-ins can't be deleted — cancel instead"
                : undefined
            }
            className={`${buttonClass} border-red-800/50 text-red-900`}
          >
            DELETE
          </button>
        </form>
      </div>

      <p className="text-xs text-foreground/60">
        Cancelling keeps the event and its attendance history but removes it
        from the public schedule and from point totals. Deleting is only
        possible while an event has no check-ins.
      </p>
    </div>
  );
}

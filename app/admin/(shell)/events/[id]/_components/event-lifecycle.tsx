"use client";

import { useActionState } from "react";
import { BUTTON_QUIET_SM } from "@/components/ui/button";

import {
  deleteEvent,
  duplicateEvent,
  setEventStatus,
  type EventActionState,
} from "@/app/actions/events";
import { Notice } from "@/app/admin/(shell)/_components/notice";

// Lifecycle controls: publish, cancel, reopen, delete (§4.1, §4.6).
//
// Each is a separate <form action> posting to a Server Action, so none of them
// can be triggered by a prefetch or a stray GET the way a link could.

const INITIAL: EventActionState = { status: "idle" };

const buttonClass =
  BUTTON_QUIET_SM;

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
        <Notice tone="error" role="alert">
          Can&apos;t publish: another published event&apos;s check-in window
          overlaps this one. Only one event can be open for check-in at a time.
          Adjust either event&apos;s times or its check-in window first.
        </Notice>
      )}
      {(statusState.status === "error" || deleteState.status === "error") && (
        <Notice tone="error" role="alert">
          That didn&apos;t work — please try again.
        </Notice>
      )}
      {deleteState.status === "blocked" && (
        <p
          role="alert"
          className="border border-misa-caution/45 bg-misa-caution-wash px-4 py-3 text-sm"
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
              Publish
            </button>
          </form>
        )}

        {status === "published" && (
          <form action={statusAction}>
            <input type="hidden" name="id" value={eventId} />
            <input type="hidden" name="status" value="draft" />
            <button type="submit" disabled={statusPending} className={buttonClass}>
              Unpublish
            </button>
          </form>
        )}

        {status !== "cancelled" && (
          <form action={statusAction}>
            <input type="hidden" name="id" value={eventId} />
            <input type="hidden" name="status" value="cancelled" />
            <button type="submit" disabled={statusPending} className={buttonClass}>
              Cancel event
            </button>
          </form>
        )}

        {/* The weekly-meeting shortcut: clone as a draft one week later,
            keeping the same wall-clock time across the DST change. */}
        <form action={duplicateAction}>
          <input type="hidden" name="id" value={eventId} />
          <button type="submit" disabled={duplicatePending} className={buttonClass}>
            Duplicate +1 week
          </button>
        </form>

        <form action={deleteAction}>
          <input type="hidden" name="id" value={eventId} />
          <button
            type="submit"
            disabled={deletePending || attendanceCount > 0}
            className={`${buttonClass} border-misa-critical/50 text-misa-critical`}
          >
            Delete
          </button>
        </form>

        {/* On screen rather than in a `title`: a disabled button is not
            focusable, so the tooltip this replaces was unreachable by keyboard
            and invisible on touch.

            📌 The <p> below already states the rule, but generically and in
            the abstract. This says it about THIS event, at the moment the
            officer has just found the button dead — and it names the count,
            which the general sentence cannot. */}
        {attendanceCount > 0 && (
          <span className="text-xs text-misa-muted">
            {/* 🪤 Both spaces are explicit `{" "}`. A plain space between an
                expression and the text that follows it does NOT survive here —
                the walkthrough caught this rendering as "20 check-insrecorded".
                Never rely on source whitespace next to a JSX expression. */}
            This event has {attendanceCount}{" "}
            {attendanceCount === 1 ? "check-in" : "check-ins"}{" "}
            recorded, so it can&apos;t be deleted — cancel it instead.
          </span>
        )}
      </div>

      <p className="text-xs text-misa-muted">
        Cancelling keeps the event and its attendance history but removes it
        from the public schedule and from point totals. Deleting is only
        possible while an event has no check-ins.
      </p>
    </div>
  );
}

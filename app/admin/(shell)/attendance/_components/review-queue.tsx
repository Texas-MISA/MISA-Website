"use client";

import { useActionState, useState } from "react";

import {
  bulkAssignEvent,
  type BulkAssignState,
} from "@/app/actions/attendance-review";
import type { EventOption } from "@/lib/event-options";

import { AttendanceTable, type SubmissionRow } from "./attendance-table";

// The queue's selection state plus the bulk-assign form, wrapping the table so
// the checkboxes are real form inputs rather than something React has to
// serialize. Selection is mirrored in state only so the bar can show a count
// and disable itself; the ids that get submitted are the checked boxes.

const initial: BulkAssignState = { status: "idle" };

export function ReviewQueue({
  rows,
  events,
  hrefSuffix,
}: {
  rows: SubmissionRow[];
  events: EventOption[];
  hrefSuffix: string;
}) {
  const [state, formAction, pending] = useActionState(bulkAssignEvent, initial);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  // Clear the selection once an assign lands. React resets the form when the
  // action resolves, so the checkboxes come back empty — leaving the count
  // behind would have the bar claim "2 selected" above six empty boxes, and an
  // officer acting on that reads the screen as still holding a selection it
  // does not have. Reset during render (the documented alternative to an
  // effect) by noticing the action state changed identity.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.status === "done") setSelected(new Set());
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(ids: string[], checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  return (
    <form action={formAction}>
      <BulkResult state={state} />

      <div className="mb-4 flex flex-wrap items-end gap-4 border border-black/20 bg-misa-panel px-4 py-3">
        <p className="text-sm">
          <strong>{selected.size}</strong> selected
        </p>

        <label className="flex flex-col gap-1 text-sm">
          Assign to
          <select
            name="eventId"
            defaultValue=""
            className="border border-black/70 bg-white px-3 py-2 text-sm"
          >
            <option value="">Pick an event…</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.label}
                {event.status !== "published" ? ` (${event.status})` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="approve" value="yes" />
          {/* Opt-in, never the default: approving is a judgement that these
              people were there, and a checkbox that starts ticked makes it an
              accident. Rows with no member stay pending regardless. */}
          Approve the ones that already have a member
        </label>

        <button
          type="submit"
          disabled={pending || selected.size === 0}
          className="rounded-full bg-misa-blue px-6 py-2 text-xs font-medium tracking-wider text-white transition hover:bg-misa-blue-dark disabled:opacity-40"
          title={
            selected.size === 0 ? "Tick the rows you want to assign" : undefined
          }
        >
          {pending ? "ASSIGNING…" : "ASSIGN"}
        </button>
      </div>

      <AttendanceTable
        rows={rows}
        hrefSuffix={hrefSuffix}
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
      />
    </form>
  );
}

/** Partial success is the normal outcome, so it gets a real report rather than
 * a count the officer has to trust. */
function BulkResult({ state }: { state: BulkAssignState }) {
  if (state.status === "idle") return null;

  if (state.status === "unauthorized") {
    return <Banner>Your session has expired — sign in again.</Banner>;
  }
  if (state.status === "error") {
    return <Banner>Couldn&apos;t assign those submissions.</Banner>;
  }
  if (state.status === "invalid") {
    return <Banner>{state.message}</Banner>;
  }

  return (
    <div
      role="status"
      className="mb-4 border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm"
    >
      <p>
        Assigned {state.assigned} submission{state.assigned === 1 ? "" : "s"}
        {state.approved > 0 && `, ${state.approved} approved`}.
      </p>

      {state.raced > 0 && (
        <p className="mt-1">
          {state.raced} changed while you were choosing and were left alone.
        </p>
      )}

      {state.skipped.length > 0 && (
        <>
          <p className="mt-2 font-medium">Skipped {state.skipped.length}:</p>
          <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5">
            {state.skipped.map((skip) => (
              <li key={skip.id}>
                {skip.submittedName} — {describeSkip(skip.reason)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function describeSkip(reason: string): string {
  switch (reason) {
    case "duplicate_in_selection":
      return "the same person as another row you selected; the earlier submission was kept";
    case "already_on_event":
      return "already has a check-in at that event";
    case "not_pending":
      return "someone resolved it first";
    default:
      return reason;
  }
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="mb-4 border-l-4 border-amber-700 bg-misa-panel px-4 py-3 text-sm"
    >
      {children}
    </p>
  );
}

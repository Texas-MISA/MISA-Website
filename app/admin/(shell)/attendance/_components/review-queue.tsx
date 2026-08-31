"use client";

import { Notice } from "@/app/admin/(shell)/_components/notice";
import { BUTTON_PRIMARY_SM } from "@/components/ui/button";
import { CHECKBOX, controlClass } from "@/components/ui/field";

import { useActionState, useState } from "react";

import {
  bulkAssignEvent,
  type BulkAssignState,
} from "@/app/actions/attendance-review";
import type { EventOption } from "@/lib/event-options";

import { Panel } from "@/components/ui/panel";
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

      <Panel ground="white" pad="sm" className="mb-4 flex flex-wrap items-end gap-4">
        <p className="text-sm">
          <strong>{selected.size}</strong> selected
        </p>

        <label className="flex flex-col gap-1 text-sm">
          Assign to
          <select
            name="eventId"
            defaultValue=""
            className={controlClass("sm")}
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
          <input type="checkbox" name="approve" value="yes" className={CHECKBOX} />
          {/* Opt-in, never the default: approving is a judgement that these
              people were there, and a checkbox that starts ticked makes it an
              accident. Rows with no member stay pending regardless. */}
          Approve the ones that already have a member
        </label>

        <button
          type="submit"
          disabled={pending || selected.size === 0}
          className={BUTTON_PRIMARY_SM}
        >
          {pending ? "Assigning…" : "Assign"}
        </button>

        {/* On screen rather than in a `title`: a disabled button is not
            focusable, so the tooltip this replaces was unreachable by keyboard
            and invisible on touch. */}
        {selected.size === 0 && (
          <span className="text-xs text-misa-muted">
            Tick the rows you want to assign.
          </span>
        )}
      </Panel>

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

  // 🐛 All three of these were one local `Banner` hardcoded to the CAUTION
  // wash. An expired session and a failed assign are not cautions — they are an
  // action that did not happen, which is what `error` is for. `invalid` stays a
  // caution: the officer's input was refused and is theirs to correct.
  if (state.status === "unauthorized") {
    return (
      <Notice tone="error" role="alert" className="mb-4">
        Your session has expired — sign in again.
      </Notice>
    );
  }
  if (state.status === "error") {
    return (
      <Notice tone="error" role="alert" className="mb-4">
        Couldn&apos;t assign those submissions.
      </Notice>
    );
  }
  if (state.status === "invalid") {
    return (
      <Notice tone="warning" role="alert" className="mb-4">
        {state.message}
      </Notice>
    );
  }

  // 🪤 `as="div"`: this report carries paragraphs and a list, and a <p> cannot
  // contain either — the parser would close the banner at the first child and
  // the rest would render outside its frame.
  return (
    <Notice tone="success" as="div" role="status" className="mb-4">
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
    </Notice>
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


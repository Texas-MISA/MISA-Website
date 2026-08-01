"use client";

import { useActionState } from "react";

import {
  createManualAttendance,
  type ManualEntryState,
} from "@/app/actions/attendance-review";
import type { EventOption } from "@/lib/event-options";
import type { MemberOption } from "@/lib/member-options";

// Manual entry (§4.2): the paper-sheet case, and the one place attendance is
// created by an officer rather than by a member.
//
// Written straight to `present`, so both links are required — the schema says
// so and present_requires_resolution enforces it. Defaults come from the server
// so no date is ever built in the browser.

const initial: ManualEntryState = { status: "idle" };

const fieldClass = "w-full border border-black/70 bg-white px-3 py-2 text-sm";

export function ManualEntryForm({
  events,
  members,
  defaultDate,
  defaultTime,
  returnTo,
}: {
  events: EventOption[];
  members: MemberOption[];
  /** Today's Central civil date, computed on the server. */
  defaultDate: string;
  defaultTime: string;
  returnTo: string;
}) {
  const [state, formAction, pending] = useActionState(
    createManualAttendance,
    initial
  );
  const errors = state.status === "invalid" ? state.fieldErrors : {};

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <input type="hidden" name="returnTo" value={returnTo} />

      {state.status === "duplicate" && (
        <p
          role="status"
          className="border-l-4 border-amber-700 bg-misa-panel px-4 py-3 text-sm"
        >
          {state.memberName ?? "That member"} already has a check-in at this
          event. Open the existing row rather than adding a second one — the
          leaderboard counts both.
        </p>
      )}
      {state.status === "error" && (
        <p
          role="status"
          className="border-l-4 border-amber-700 bg-misa-panel px-4 py-3 text-sm"
        >
          Couldn&apos;t record that check-in.
        </p>
      )}
      {state.status === "unauthorized" && (
        <p
          role="status"
          className="border-l-4 border-amber-700 bg-misa-panel px-4 py-3 text-sm"
        >
          Your session has expired — sign in again.
        </p>
      )}

      <Field label="Event" error={errors.eventId}>
        <select name="eventId" defaultValue="" className={fieldClass}>
          <option value="">Pick an event…</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.label}
              {event.status !== "published" ? ` (${event.status})` : ""}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Member" error={errors.memberId}>
        <select name="memberId" defaultValue="" className={fieldClass}>
          <option value="">Pick a member…</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Date (Central)" error={errors.date}>
          <input
            type="date"
            name="date"
            defaultValue={defaultDate}
            className={fieldClass}
          />
        </Field>
        <Field label="Time (Central)" error={errors.time}>
          <input
            type="time"
            name="time"
            defaultValue={defaultTime}
            className={fieldClass}
          />
        </Field>
      </div>

      <Field label="Note" error={errors.resolutionNote}>
        <input
          name="resolutionNote"
          className={fieldClass}
          placeholder="e.g. signed the paper sheet; phone was dead"
        />
      </Field>

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-misa-blue px-6 py-2 text-xs font-medium tracking-wider text-white transition hover:bg-misa-blue-dark disabled:opacity-40"
        >
          {pending ? "RECORDING…" : "RECORD CHECK-IN"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-foreground/60">{label}</span>
      {children}
      {error && error.length > 0 && (
        <span className="text-xs text-amber-800">{error[0]}</span>
      )}
    </label>
  );
}

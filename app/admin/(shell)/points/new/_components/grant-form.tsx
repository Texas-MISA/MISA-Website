"use client";

import { useActionState, useState } from "react";

import {
  grantPoints,
  type GrantState,
  type SubmittedGrantValues,
} from "@/app/actions/points";
import type { EventOption } from "@/lib/event-options";
import type { MemberOption } from "@/lib/member-options";
import { formatPointCategory, POINT_CATEGORIES } from "@/lib/points";

import { MemberPicker } from "./member-picker";

// The grant form (§4.2, §7 Stage 5 phase 4).
//
// ⚠️ Every field is driven from `values`, which the action echoes back. React
// 19 resets an uncontrolled `<form action={…}>` once the action resolves, so a
// form that re-renders with server state reverts silently to what it started
// with. Stage 4 shipped that bug and phase 3 shipped its selection-state
// cousin; the picker's header comment covers how the picks are kept.
//
// The `generation` counter below is the other half of that. Keying the fields
// on JSON.stringify(values) alone — which resolution-form.tsx can get away with
// — is not enough here: submitting twice with the same invalid input produces
// an identical key, so React would not remount, while the reset has already
// cleared the DOM. Bumping a counter whenever the action state changes identity
// makes the remount happen on every answer from the server rather than only on
// answers that happen to differ.

const initial: GrantState = { status: "idle" };

const EMPTY: SubmittedGrantValues = {
  memberIds: [],
  points: "",
  reason: "",
  category: "volunteer",
  eventId: "",
};

const fieldClass = "w-full border border-black/70 bg-white px-3 py-2 text-sm";

export function GrantForm({
  members,
  events,
  returnTo,
}: {
  members: MemberOption[];
  events: EventOption[];
  returnTo: string;
}) {
  const [state, formAction, pending] = useActionState(grantPoints, initial);

  // The echoed values win whenever the action has spoken, so an edit survives a
  // rejected save.
  const values = "values" in state ? state.values : EMPTY;

  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [generation, setGeneration] = useState(0);
  const [seenState, setSeenState] = useState(state);

  if (state !== seenState) {
    setSeenState(state);
    setGeneration((n) => n + 1);
    // The server's list wins after an answer — it is the deduped, capped one
    // the insert would actually have used. Selection is deliberately NOT
    // cleared on a failure: re-finding eleven people is the expensive part, and
    // keeping them is the whole reason the action echoes them back. A success
    // never reaches here, because it redirects and unmounts the page.
    if ("values" in state) setSelected(new Set(state.values.memberIds));
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const errors = state.status === "invalid" ? state.fieldErrors : {};

  return (
    <form action={formAction} className="max-w-2xl">
      <Banner state={state} />

      <input type="hidden" name="returnTo" value={returnTo} />

      <div
        key={`${generation}:${JSON.stringify(values)}`}
        className="flex flex-col gap-5"
      >
        <MemberPicker
          members={members}
          selected={selected}
          onToggle={toggle}
          onClear={() => setSelected(new Set())}
          error={errors.memberIds}
        />

        <Field label="Points" error={errors.points}>
          <input
            type="number"
            name="points"
            defaultValue={values.points}
            step={1}
            placeholder="5"
            className={fieldClass}
          />
          <span className="text-xs text-foreground/60">
            Negative is allowed — a deduction and a correction use the same
            mechanism as a bonus.
          </span>
        </Field>

        <Field label="Category" error={errors.category}>
          <select
            name="category"
            defaultValue={values.category || "volunteer"}
            className={fieldClass}
          >
            {POINT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {formatPointCategory(category)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Reason" error={errors.reason}>
          <textarea
            name="reason"
            defaultValue={values.reason}
            rows={3}
            className={fieldClass}
          />
          <span className="text-xs text-foreground/60">
            Required. This is what makes the ledger readable a year from now.
          </span>
        </Field>

        <Field label="Related event (optional)" error={errors.eventId}>
          <select
            name="eventId"
            defaultValue={values.eventId}
            className={fieldClass}
          >
            <option value="">Not linked</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.label}
                {event.status !== "published" ? ` (${event.status})` : ""}
              </option>
            ))}
          </select>
          <span className="text-xs text-foreground/60">
            Context only. It does not credit attendance.
          </span>
        </Field>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={pending || selected.size === 0}
            title={
              selected.size === 0 ? "Pick at least one member first" : undefined
            }
            className="rounded-full bg-misa-blue px-6 py-2 text-xs font-medium tracking-wider text-white transition hover:bg-misa-blue-dark disabled:opacity-40"
          >
            {pending ? "GRANTING…" : "GRANT POINTS"}
          </button>
          <span className="text-xs text-foreground/60">
            The term is set from the date; it is never typed.
          </span>
        </div>
      </div>
    </form>
  );
}

function Banner({ state }: { state: GrantState }) {
  if (
    state.status === "idle" ||
    state.status === "invalid" ||
    state.status === "unauthorized"
  ) {
    // `invalid` speaks through the per-field messages; `unauthorized` cannot
    // happen without the page itself having redirected first.
    return null;
  }

  const message =
    state.status === "stale_member"
      ? "One of the members you picked is no longer on the roster, so nothing was granted. Reload this page and pick again."
      : state.status === "stale_event"
        ? "That event has been deleted, so nothing was granted. Clear the event and try again."
        : "Something went wrong and nothing was granted. Try again.";

  return (
    <p
      role="status"
      className="mb-6 border-l-4 border-amber-700 bg-misa-panel px-4 py-3 text-sm"
    >
      {message}
    </p>
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

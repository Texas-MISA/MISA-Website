"use client";

import Link from "next/link";
import { useActionState } from "react";

import { saveEvent, type EventFormState } from "@/app/actions/events";
import {
  EVENT_CATEGORIES,
  EVENT_STATUSES,
  formatCategory,
  formatEventRange,
  type EventWarning,
} from "@/lib/events";

// Create and edit share one form: the fields are identical, and the only
// difference is whether an `id` is posted. Client Component for
// useActionState; the form still posts natively before hydration.

const INITIAL: EventFormState = { status: "idle" };

const inputClass =
  "border border-black/70 bg-misa-panel px-3 py-2 text-base w-full";

export type EventFormValues = {
  id?: string;
  title: string;
  description: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  openEarlyMinutes: number;
  closeLateMinutes: number;
  points: number;
  category: string;
  status: string;
};

export function EventForm({ initial }: { initial: EventFormValues }) {
  const [state, formAction, pending] = useActionState(saveEvent, INITIAL);

  const fieldErrors =
    state.status === "invalid" ? state.fieldErrors : undefined;
  const needsConfirmation = state.status === "needs_confirmation";

  // React 19 resets an uncontrolled form once its action resolves, so every
  // defaultValue below has to come from the values the server echoed back —
  // otherwise showing the warnings silently reverts the officer's edits, and
  // "SAVE ANYWAY" would save the original values instead of the new ones.
  const v =
    state.status === "needs_confirmation" || state.status === "invalid"
      ? state.values
      : {
          title: initial.title,
          description: initial.description,
          location: initial.location,
          date: initial.date,
          startTime: initial.startTime,
          endTime: initial.endTime,
          openEarlyMinutes: String(initial.openEarlyMinutes),
          closeLateMinutes: String(initial.closeLateMinutes),
          points: String(initial.points),
          category: initial.category,
          status: initial.status,
        };

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      {state.status === "overlap" && (
        <Alert>
          Another <strong>published</strong> event already has its check-in
          window open during this one. Two events can never be open at the same
          instant — move this event, narrow its check-in window, or leave it as
          a draft.
        </Alert>
      )}
      {state.status === "conflict" && (
        <Alert>
          Another officer changed this event while you had it open. Nothing was
          saved. Reload the page to see their version, then reapply your
          changes.
        </Alert>
      )}
      {state.status === "error" && (
        <Alert>Something went wrong saving this event — please try again.</Alert>
      )}
      {state.status === "unauthorized" && (
        <Alert>
          Your session expired. <Link href="/admin/login">Sign in again</Link>,
          then resubmit.
        </Alert>
      )}
      {state.status === "saved" && (
        <p
          role="status"
          className="border-l-4 border-green-800 bg-misa-panel px-4 py-3 text-sm"
        >
          Saved.
        </p>
      )}

      {needsConfirmation && (
        <ImpactWarnings warnings={state.warnings} token={state.token} />
      )}

      <Field label="Title" error={fieldErrors?.title}>
        <input
          type="text"
          name="title"
          required
          defaultValue={v.title}
          className={inputClass}
          aria-invalid={fieldErrors?.title ? true : undefined}
        />
      </Field>

      <Field label="Description" error={fieldErrors?.description}>
        <textarea
          name="description"
          rows={3}
          defaultValue={v.description}
          className={inputClass}
        />
      </Field>

      <Field label="Location" error={fieldErrors?.location}>
        <input
          type="text"
          name="location"
          defaultValue={v.location}
          className={inputClass}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-3">
        <Field label="Date (Central)" error={fieldErrors?.date}>
          <input
            type="date"
            name="date"
            required
            defaultValue={v.date}
            className={inputClass}
          />
        </Field>
        <Field label="Starts" error={fieldErrors?.startTime}>
          <input
            type="time"
            name="startTime"
            required
            defaultValue={v.startTime}
            className={inputClass}
          />
        </Field>
        <Field label="Ends" error={fieldErrors?.endTime}>
          <input
            type="time"
            name="endTime"
            required
            defaultValue={v.endTime}
            className={inputClass}
          />
        </Field>
      </div>

      <fieldset className="border border-black/20 px-4 py-4">
        <legend className="px-2 text-sm font-medium">Check-in window</legend>
        <p className="text-sm text-foreground/70">
          How long before and after the event members can check in. Leave both
          at 0 to use the event times exactly.
        </p>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <Field label="Opens early (minutes)" error={fieldErrors?.openEarlyMinutes}>
            <input
              type="number"
              name="openEarlyMinutes"
              min={0}
              max={1440}
              defaultValue={v.openEarlyMinutes}
              className={inputClass}
            />
          </Field>
          <Field label="Closes late (minutes)" error={fieldErrors?.closeLateMinutes}>
            <input
              type="number"
              name="closeLateMinutes"
              min={0}
              max={1440}
              defaultValue={v.closeLateMinutes}
              className={inputClass}
            />
          </Field>
        </div>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-3">
        <Field label="Points" error={fieldErrors?.points}>
          <input
            type="number"
            name="points"
            min={0}
            max={100}
            required
            defaultValue={v.points}
            className={inputClass}
          />
        </Field>
        <Field label="Category" error={fieldErrors?.category}>
          <select
            name="category"
            defaultValue={v.category}
            className={inputClass}
          >
            <option value="">None</option>
            {EVENT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {formatCategory(category)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status" error={fieldErrors?.status}>
          <select
            name="status"
            defaultValue={v.status}
            className={inputClass}
          >
            {EVENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-full bg-misa-blue px-10 py-3 text-sm font-medium tracking-wider text-white transition hover:bg-misa-blue-dark disabled:opacity-60"
        >
          {pending
            ? "SAVING…"
            : needsConfirmation
              ? "SAVE ANYWAY"
              : initial.id
                ? "SAVE CHANGES"
                : "CREATE EVENT"}
        </button>
        <Link
          href="/admin/events"
          className="text-sm text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

/**
 * The §4.6 warnings, shown before anything is written.
 *
 * The hidden token is what the action compares against on resubmit. It binds
 * to both the proposed values and the row's updated_at, so editing a field
 * after seeing these re-previews rather than confirming stale numbers.
 */
function ImpactWarnings({
  warnings,
  token,
}: {
  warnings: EventWarning[];
  token: string;
}) {
  return (
    <div
      role="alert"
      className="border-l-4 border-amber-700 bg-misa-panel px-4 py-4"
    >
      <h2 className="font-display text-lg font-bold">
        Check this before saving
      </h2>
      <ul className="mt-3 flex flex-col gap-3 text-sm">
        {warnings.map((warning, index) => (
          <li key={index}>{describeWarning(warning)}</li>
        ))}
      </ul>
      <input type="hidden" name="confirm" value={token} />
      <p className="mt-4 text-xs text-foreground/70">
        Nothing has been saved yet. Submit again to apply these changes.
      </p>
    </div>
  );
}

function describeWarning(warning: EventWarning): React.ReactNode {
  switch (warning.kind) {
    case "points_changed":
      return (
        <>
          <strong>Points change from {warning.from} to {warning.to}.</strong>{" "}
          {warning.membersAffected === 0
            ? "Nobody has attended yet, so no totals move."
            : `${warning.membersAffected} ${
                warning.membersAffected === 1 ? "member's" : "members'"
              } totals change by ${warning.to - warning.from > 0 ? "+" : ""}${
                warning.to - warning.from
              } each (${warning.totalPointDelta > 0 ? "+" : ""}${
                warning.totalPointDelta
              } overall).`}
        </>
      );
    case "window_narrowed":
      return (
        <>
          <strong>The check-in window gets narrower.</strong>{" "}
          {warning.checkinsNowOutside === 0
            ? "No recorded check-in falls outside the new window."
            : `${warning.checkinsNowOutside} recorded check-${
                warning.checkinsNowOutside === 1 ? "in" : "ins"
              } would now fall outside it.`}{" "}
          Nobody loses credit — attendance already recorded stays recorded, and
          the window only matters when a check-in first arrives.
        </>
      );
    case "times_moved":
      return (
        <>
          <strong>The event moves</strong> from{" "}
          {formatEventRange(warning.fromStart, warning.fromStart)} to{" "}
          {formatEventRange(warning.toStart, warning.toStart)} Central.{" "}
          {warning.checkinsNowOutside > 0 &&
            `${warning.checkinsNowOutside} recorded check-${
              warning.checkinsNowOutside === 1 ? "in" : "ins"
            } fall outside the new window, and keep their credit.`}
        </>
      );
    case "term_changed":
      return (
        <>
          <strong>
            This moves the event from {warning.fromTerm} to {warning.toTerm}.
          </strong>{" "}
          The term comes from the start date, so this event and{" "}
          {warning.membersAffected === 1
            ? "its one attendee's points"
            : `all ${warning.membersAffected} attendees' points`}{" "}
          move to the other semester&apos;s leaderboard.
        </>
      );
  }
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm"
    >
      {children}
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
      {label}
      {children}
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error[0]}
        </span>
      )}
    </label>
  );
}

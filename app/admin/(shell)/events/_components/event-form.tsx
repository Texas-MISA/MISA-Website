"use client";

import { BUTTON_OUTLINE, BUTTON_PRIMARY } from "@/components/ui/button";
import { CHECKBOX, controlClass } from "@/components/ui/field";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { saveEvent, type EventFormState } from "@/app/actions/events";
import {
  EVENT_CATEGORIES,
  EVENT_STATUSES,
  formatCategory,
  formatEventRange,
  type EventWarning,
} from "@/lib/events";
import { SectionHeading } from "@/components/ui/page-header";
import { Notice } from "@/app/admin/(shell)/_components/notice";
import { Panel } from "@/components/ui/panel";

// Create and edit share one form: the fields are identical, and the only
// difference is whether an `id` is posted. Client Component for
// useActionState; the form still posts natively before hydration.

const INITIAL: EventFormState = { status: "idle" };

const inputClass =
  controlClass("md", "w-full");

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
  verifyOrigin: boolean;
};

export function EventForm({ initial }: { initial: EventFormValues }) {
  const [state, formAction, pending] = useActionState(saveEvent, INITIAL);

  const fieldErrors =
    state.status === "invalid" ? state.fieldErrors : undefined;
  const needsConfirmation = state.status === "needs_confirmation";
  const isCreate = !initial.id;

  // ── Unsaved-changes guard ────────────────────────────────────────────────
  //
  // 📌 Tracks TOUCHED, not diffed. One `onInput` on the <form> rather than
  // controlling twelve inputs — controlling them would fight the `state.values`
  // echo-back below, which exists because React 19 resets an uncontrolled form
  // when its action resolves. Typing a character and deleting it still reads
  // dirty; that is the standard trade and what Next's own example does.
  const [dirty, setDirty] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  // 🪤 Only a SAVED state clears the flag. `needs_confirmation`, `invalid`,
  // `overlap`, `conflict` and `error` must all stay dirty: nothing was written,
  // the officer's values are echoed back into the fields, and losing them is
  // precisely the harm this guards. Render-phase derived state rather than an
  // effect, because useActionState has no reset — same idiom as merge-panel.tsx.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.status === "saved") {
      setDirty(false);
      setConfirmingDiscard(false);
    }
  }

  // Tab close and reload, which no in-app control can catch.
  //
  // 📌 This is NOT the `window.confirm` the codebase forbids (preset-row.tsx,
  // merge-panel.tsx). That rule is about the app opening a blocking native
  // dialog as its own UI, where a two-click control is strictly better. This
  // opens nothing — it registers intent with the browser, which may then show
  // its own prompt while the page is being torn down. There is no in-app
  // alternative for a tab close: it is this or silence.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

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
          // "on" / "" rather than a boolean, because `v` mirrors the raw
          // strings the server echoes back on an invalid or unconfirmed save.
          verifyOrigin: initial.verifyOrigin ? "on" : "",
        };

  return (
    <form
      action={formAction}
      onInput={() => setDirty(true)}
      className="flex flex-col gap-6 border border-misa-border bg-white px-4 py-4"
      noValidate
    >
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
          className="border border-misa-affirm/45 bg-misa-affirm-wash px-4 py-3 text-sm"
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

      <Panel as="fieldset" ground="none" pad="sm">
        <legend className="px-2 text-sm font-medium">Check-in window</legend>
        <p className="text-sm text-misa-secondary">
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
      </Panel>

      <div
        className={`grid gap-6 ${isCreate ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}
      >
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
        {/* On create, status is chosen by which button you press. On an
            existing event it stays a field, because editing is where you might
            change several things at once — and the lifecycle buttons above are
            the quick path for status alone. */}
        {!isCreate && (
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
        )}
      </div>

      {/* Check-in location verification (§6). Spec:
          docs/checkin-location-verification.md.

          On by default, and flippable long AFTER the event — origins are
          captured on every check-in regardless of this box, so turning it on a
          week later lights up an event that already happened with no backfill.
          That asymmetry is also why /attend discloses the capture. */}
      {/* 🪤 A bare <label>, NOT wrapped in <Field>. Field renders a <label> of
          its own around whatever it is given, and nested <label> elements are
          invalid HTML with undefined click-target behaviour — plus its
          required `label` prop would render an empty <span> above the control.
          Field is for a labelled input; a checkbox IS its own label. */}
      <label className="flex max-w-3xl items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="verifyOrigin"
          defaultChecked={v.verifyOrigin === "on"}
          className={`${CHECKBOX} mt-0.5`}
        />
        <span>
          <span className="font-medium">Check where check-ins came from</span>
          <span className="block text-misa-muted">
            Compares each check-in against the network most attendees used, and
            marks the ones that differ. Advisory only — it never rejects a
            check-in or withholds points, and a member on cellular data is
            never marked. You can turn this on or off after the event.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-4">
        {isCreate ? (
          <>
            {/* Two submitters sharing one name: the browser sends only the
                one that was pressed, so the button IS the status choice. Draft
                comes first, so it is what the Enter key does — publishing
                should take a deliberate click. */}
            <button
              type="submit"
              name="status"
              value="draft"
              disabled={pending}
              className={`w-fit ${BUTTON_PRIMARY}`}
            >
              {pending ? "Saving…" : "Save as draft"}
            </button>
            <button
              type="submit"
              name="status"
              value="published"
              disabled={pending}
              className={`w-fit ${BUTTON_OUTLINE}`}
            >
              {pending ? "Saving…" : "Publish now"}
            </button>
          </>
        ) : (
          <button
            type="submit"
            disabled={pending}
            className={`w-fit ${BUTTON_PRIMARY}`}
          >
            {pending
              ? "Saving…"
              : needsConfirmation
                ? "Save anyway"
                : "Save changes"}
          </button>
        )}
        {/* Cancel discarded silently — it is a plain <Link>, so a filled-in
            form vanished on one click with no warning.

            `onNavigate` (Next 16, next/link) is the supported way to cancel a
            client-side navigation. Next's own recipe calls window.confirm in
            here; this codebase forbids that, so the armed state is the two-click
            control used by preset-row.tsx and merge-panel.tsx instead.

            🪤 Every button here is type="button". This sits INSIDE the event
            <form>, so a bare <button> would submit it — and preset-row's nested
            <form> cannot be copied for the same reason. */}
        {confirmingDiscard ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs">Discard your changes?</span>
            <Link
              href="/admin/events"
              className="text-sm text-misa-critical underline underline-offset-4"
            >
              Discard
            </Link>
            <button
              type="button"
              onClick={() => setConfirmingDiscard(false)}
              className="px-2 py-1 text-xs underline underline-offset-4"
            >
              Keep editing
            </button>
          </div>
        ) : (
          <Link
            href="/admin/events"
            onNavigate={(event) => {
              if (dirty) {
                event.preventDefault();
                setConfirmingDiscard(true);
              }
            }}
            className="text-sm text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
          >
            Cancel
          </Link>
        )}
      </div>

      {isCreate && (
        <p className="-mt-2 text-xs text-misa-muted">
          A draft is visible only to officers. Publishing puts the event on the
          public schedule straight away and opens its check-in window at the
          time set above.
        </p>
      )}
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
      className="border border-misa-caution/45 bg-misa-caution-wash px-4 py-4"
    >
      <SectionHeading level="sub">
        Check this before saving
      </SectionHeading>
      <ul className="mt-3 flex flex-col gap-3 text-sm">
        {warnings.map((warning, index) => (
          <li key={index}>{describeWarning(warning)}</li>
        ))}
      </ul>
      <input type="hidden" name="confirm" value={token} />
      <p className="mt-4 text-xs text-misa-secondary">
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
    <Notice tone="error" role="alert">
      {children}
    </Notice>
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
        <span role="alert" className="text-xs text-misa-critical">
          {error[0]}
        </span>
      )}
    </label>
  );
}

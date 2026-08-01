"use client";

import { useActionState } from "react";

import {
  submitCheckin,
  type CheckinState,
  type SubmittedValues,
} from "@/app/actions/attendance";
// The refused copy quotes the grace window, so it reads it from the same
// constant the server decides with — a hardcoded "48 hours" would start
// lying the moment ORPHAN_WINDOW_HOURS changed. lib/checkin.ts is free of
// next/* and server-only imports, so a Client Component can import it.
import { ORPHAN_WINDOW_HOURS } from "@/lib/checkin";

// Client Component for useActionState only — the form posts to the Server
// Action via <form action>, so it works before hydration too (submissions
// queue until JS loads; Next prioritizes hydrating them). The two-step
// first-timer flow is action state rather than client-side routing for the
// same reason: it has to survive a phone that hasn't finished loading JS.

const INITIAL: CheckinState = { status: "idle" };

const inputClass =
  "border border-black/70 bg-misa-panel px-3 py-3 text-base w-full";

const buttonClass =
  "rounded-full bg-misa-blue px-10 py-3 text-sm font-medium tracking-wider text-white transition hover:bg-misa-blue-dark disabled:opacity-60";

const bannerClass =
  "border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm";

const EMPTY: SubmittedValues = {
  fullName: "",
  studentId: "",
  email: "",
  declaredNew: false,
};

export function CheckinForm() {
  const [state, formAction, pending] = useActionState(submitCheckin, INITIAL);

  // React 19 resets an uncontrolled <form action> once the action resolves,
  // so every field below is driven from what the server echoed back. Always a
  // string, never undefined: a nullish defaultValue after a non-nullish one
  // makes React drop the value attribute, and the reset then clears the field.
  const submitted = state.submitted ?? EMPTY;

  switch (state.status) {
    // Terminal outcomes replace the form entirely — the member is done.
    case "present":
      return (
        <ResultPanel heading="You're checked in!">
          Your attendance at <strong>{state.eventTitle}</strong> is recorded.
        </ResultPanel>
      );
    case "pending":
      return (
        <ResultPanel heading="Check-in received">
          No event window is open right now, so an officer will review your
          check-in and match it to the right event. You don&apos;t need to do
          anything else.
        </ResultPanel>
      );
    case "duplicate":
      return (
        <ResultPanel heading="Already recorded">
          {state.prior === "present"
            ? "You're already checked in to this event — you're all set."
            : "We already have your check-in — it's awaiting officer review. You don't need to submit again."}
        </ResultPanel>
      );
    // The `&nbsp;` is deliberate, and so is the absence of any comment inside
    // the prose below. JSX drops the space where a text run meets an embedded
    // expression or comment: a plain space rendered "48hours", and a comment
    // placed mid-sentence rendered "eventwithin". Keep the sentence one
    // unbroken run of text.
    case "refused":
      return (
        <ResultPanel heading="No event around this time">
          Check-in opens around event times, and there&apos;s no MISA event
          within {ORPHAN_WINDOW_HOURS}&nbsp;hours of right now — nothing
          running, and nothing that just ended or is about to start. Check the
          home page for the next one. If you&apos;re at a MISA event as you read
          this, tell an officer — it may not be published yet.
        </ResultPanel>
      );

    case "needs_confirmation":
      return <ReviewPanel action={formAction} pending={pending} submitted={submitted} existing={state.existing} />;

    case "idle":
    case "invalid":
    case "error":
    case "rate_limited":
    case "unmatched":
      return (
        <CheckinFields
          action={formAction}
          pending={pending}
          state={state}
          submitted={submitted}
        />
      );

    default: {
      // Every state above is handled; this fails the build if one is added
      // without a screen, rather than silently rendering an empty form —
      // which is how the previous if-chain would have absorbed a new status.
      const exhaustive: never = state;
      void exhaustive;
      return null;
    }
  }
}

function CheckinFields({
  action,
  pending,
  state,
  submitted,
}: {
  action: (formData: FormData) => void;
  pending: boolean;
  state: CheckinState;
  submitted: SubmittedValues;
}) {
  const fieldErrors =
    state.status === "invalid" ? state.fieldErrors : undefined;

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.status === "unmatched" && (
        <p role="alert" className={bannerClass}>
          We don&apos;t have that info on file. Check your student ID and email
          for a typo and try again — or, if this is your first MISA event, tick
          the box below.
        </p>
      )}
      {state.status === "rate_limited" && (
        <p role="alert" className={bannerClass}>
          Too many check-ins from this connection — wait a few minutes and try
          again.
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className={bannerClass}>
          Something went wrong on our end — please try again. If it keeps
          failing, tell an officer at the event so your attendance isn&apos;t
          lost.
        </p>
      )}

      <Field label="Full name" error={fieldErrors?.fullName}>
        <input
          type="text"
          name="fullName"
          required
          autoComplete="name"
          defaultValue={submitted.fullName}
          className={inputClass}
          aria-invalid={fieldErrors?.fullName ? true : undefined}
        />
      </Field>

      <Field label="UT student ID" error={fieldErrors?.studentId}>
        <input
          type="text"
          name="studentId"
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          defaultValue={submitted.studentId}
          className={inputClass}
          aria-invalid={fieldErrors?.studentId ? true : undefined}
        />
      </Field>

      <Field label="Email" error={fieldErrors?.email}>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          defaultValue={submitted.email}
          className={inputClass}
          aria-invalid={fieldErrors?.email ? true : undefined}
        />
      </Field>

      {/* Echoing the member's own tick back after the form reset — not a
          preselected suggestion. It starts unchecked on the first render and
          only ever reflects what they chose. */}
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="firstTime"
          defaultChecked={submitted.declaredNew}
          className="mt-1 size-4"
        />
        <span>
          This is my first MISA event
          <span className="mt-0.5 block text-xs text-foreground/70">
            Tick this and we&apos;ll show you your details before adding you.
          </span>
        </span>
      </label>

      {/* Honeypot (§6): visually hidden and skipped by keyboard/screen
          readers; bots that autofill every field give themselves away. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-auto">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {/* No name on this button, so `step` is absent on the first pass. Do not
          add a hidden <input name="step"> here: React inserts a submitter's
          name/value immediately before the submitter, so an earlier hidden
          field of the same name would win formData.get("step"). */}
      <button type="submit" disabled={pending} className={`mt-1 w-fit ${buttonClass}`}>
        {pending ? "CHECKING IN…" : "CHECK IN"}
      </button>
    </form>
  );
}

/**
 * The review step for a claimed first-timer. Values travel as hidden inputs
 * and the server re-derives the outcome from them; nothing is persisted
 * between the two passes.
 *
 * `firstTime` is carried here and the checkbox is deliberately not rendered —
 * two controls of one name in one form would make which value wins depend on
 * DOM order.
 */
function ReviewPanel({
  action,
  pending,
  submitted,
  existing,
}: {
  action: (formData: FormData) => void;
  pending: boolean;
  submitted: SubmittedValues;
  existing: boolean;
}) {
  return (
    <form action={action} className="flex flex-col gap-5">
      <div
        role="status"
        className="border-l-4 border-misa-blue bg-misa-panel px-6 py-6"
      >
        <h2 className="font-display text-xl font-bold">Check your details</h2>
        <p className="mt-2 leading-6 text-foreground/85">
          {existing
            ? "We already have you on file, so confirming will use your existing record rather than adding you twice."
            : "You'll be added to the roster with exactly these details, so give them a quick look."}
        </p>
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <Row label="Full name" value={submitted.fullName} />
          <Row label="UT student ID" value={submitted.studentId} />
          <Row label="Email" value={submitted.email} />
        </dl>
      </div>

      <input type="hidden" name="fullName" value={submitted.fullName} readOnly />
      <input type="hidden" name="studentId" value={submitted.studentId} readOnly />
      <input type="hidden" name="email" value={submitted.email} readOnly />
      <input type="hidden" name="firstTime" value="on" readOnly />

      <div aria-hidden="true" className="absolute -left-[9999px] top-auto">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {/* Confirm first in DOM order, so Enter takes the intended action.
          Plain submit buttons carrying name/value — never formAction, which
          makes React drop the submitter's name from the FormData and would
          break `step` only after hydration. */}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          name="step"
          value="confirm"
          disabled={pending}
          className={buttonClass}
        >
          {pending ? "CHECKING IN…" : "CONFIRM & CHECK IN"}
        </button>
        <button
          type="submit"
          name="step"
          value="edit"
          disabled={pending}
          className="rounded-full border border-black/70 px-10 py-3 text-sm font-medium tracking-wider transition hover:bg-misa-panel disabled:opacity-60"
        >
          GO BACK
        </button>
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-foreground/70">{label}:</dt>
      <dd className="font-medium">{value}</dd>
    </div>
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

function ResultPanel({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className="border-l-4 border-misa-blue bg-misa-panel px-6 py-6"
    >
      <h2 className="font-display text-xl font-bold">{heading}</h2>
      <p className="mt-2 leading-6 text-foreground/85">{children}</p>
    </div>
  );
}

"use client";

import { useActionState } from "react";

import { submitCheckin, type CheckinState } from "@/app/actions/attendance";

// Client Component for useActionState only — the form posts to the Server
// Action via <form action>, so it works before hydration too (submissions
// queue until JS loads; Next prioritizes hydrating them).

const INITIAL: CheckinState = { status: "idle" };

const inputClass =
  "border border-black/70 bg-misa-panel px-3 py-3 text-base w-full";

export function CheckinForm() {
  const [state, formAction, pending] = useActionState(submitCheckin, INITIAL);

  // Terminal outcomes replace the form entirely — the member is done.
  if (state.status === "present") {
    return (
      <ResultPanel heading="You're checked in!">
        Your attendance at <strong>{state.eventTitle}</strong> is recorded.
      </ResultPanel>
    );
  }
  if (state.status === "pending") {
    return (
      <ResultPanel heading="Check-in received">
        No event window is open right now, so an officer will review your
        check-in and match it to the right event. You don&apos;t need to do
        anything else.
      </ResultPanel>
    );
  }
  if (state.status === "duplicate") {
    return (
      <ResultPanel heading="Already recorded">
        {state.prior === "present"
          ? "You're already checked in to this event — you're all set."
          : "We already have your check-in — it's awaiting officer review. You don't need to submit again."}
      </ResultPanel>
    );
  }
  if (state.status === "refused") {
    return (
      <ResultPanel heading="No event right now">
        Check-ins are only open around event times, and there&apos;s no MISA
        event within the check-in window at the moment. Check the schedule on
        the home page and come back during the event.
      </ResultPanel>
    );
  }

  const fieldErrors =
    state.status === "invalid" ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.status === "rate_limited" && (
        <p
          role="alert"
          className="border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm"
        >
          Too many check-ins from this connection — wait a few minutes and try
          again.
        </p>
      )}
      {state.status === "error" && (
        <p
          role="alert"
          className="border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm"
        >
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
          className={inputClass}
          aria-invalid={fieldErrors?.email ? true : undefined}
        />
      </Field>

      {/* Honeypot (§6): visually hidden and skipped by keyboard/screen
          readers; bots that autofill every field give themselves away. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-auto">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-1 w-fit rounded-full bg-misa-blue px-10 py-3 text-sm font-medium tracking-wider text-white transition hover:bg-misa-blue-dark disabled:opacity-60"
      >
        {pending ? "CHECKING IN…" : "CHECK IN"}
      </button>
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

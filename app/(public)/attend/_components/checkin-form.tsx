"use client";

import Link from "next/link";
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
import { Banner } from "@/components/ui/banner";
import { BUTTON_OUTLINE_NAVY, BUTTON_SOLID_NAVY } from "@/components/ui/button";
import { CHECKBOX, Field, Input } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { ORPHAN_WINDOW_HOURS } from "@/lib/checkin";

// Client Component for useActionState only — the form posts to the Server
// Action via <form action>, so it works before hydration too (submissions
// queue until JS loads; Next prioritizes hydrating them). The two-step
// first-timer flow is action state rather than client-side routing for the
// same reason: it has to survive a phone that hasn't finished loading JS.

const INITIAL: CheckinState = { status: "idle" };

// 📌 The local `inputClass`, `bannerClass` and `Field` this file used to carry
// are gone — they were three of the eleven and nine copies of the same thing
// scattered across the app. The disabled tint went with them: `BUTTON_SOLID_NAVY`
// now carries one threshold for the whole codebase instead of the three that
// were in use.
const EMPTY: SubmittedValues = {
  fullName: "",
  eid: "",
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
      return (
        <ReviewPanel
          action={formAction}
          pending={pending}
          submitted={submitted}
          existing={state.existing}
        />
      );

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
        <Banner role="alert">
          We don&apos;t have that info on file. Check your EID and email for a
          typo and try again — or, if this is your first MISA event, tick the
          box below.
        </Banner>
      )}
      {state.status === "rate_limited" && (
        <Banner tone="caution" role="alert">
          Too many check-ins from this connection — wait a few minutes and try
          again.
        </Banner>
      )}
      {state.status === "error" && (
        <Banner tone="critical" role="alert">
          Something went wrong on our end — please try again. If it keeps
          failing, tell an officer at the event so your attendance isn&apos;t
          lost.
        </Banner>
      )}

      <Field label="Full name" error={fieldErrors?.fullName?.[0]}>
        <Input
          type="text"
          name="fullName"
          required
          autoComplete="name"
          defaultValue={submitted.fullName}
          aria-invalid={fieldErrors?.fullName ? true : undefined}
        />
      </Field>

      <Field label="UT EID" error={fieldErrors?.eid?.[0]}>
        <Input
          type="text"
          name="eid"
          required
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          defaultValue={submitted.eid}
          aria-invalid={fieldErrors?.eid ? true : undefined}
        />
      </Field>

      <Field label="Email" error={fieldErrors?.email?.[0]}>
        <Input
          type="email"
          spellCheck={false}
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          defaultValue={submitted.email}
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
          className={`mt-1 ${CHECKBOX}`}
        />
        <span>
          This is my first MISA event
          <span className="mt-0.5 block text-xs text-misa-muted">
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
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={`mt-1 w-fit ${BUTTON_SOLID_NAVY}`}
      >
        {pending ? "Checking in…" : "Check in"}
      </button>

      {/* 🔓 Check-in location verification discloses itself, deliberately
          (docs/checkin-location-verification.md, open decision 1).

          The site is public and the repository is public, so a form that
          quietly profiled the network you submitted from would be a worse
          surprise than this sentence is a deterrent. It is written in the
          unconditional present because that is the truth: capture runs on
          EVERY check-in regardless of any per-event setting, which is what
          lets an officer turn verification on after an event. Saying "we may"
          or naming a condition would be describing the toggle, not the
          collection.

          🪤 It says what is stored, not just that something is. "We note the
          network" invites the reading that an address is kept; no address ever
          is. */}
      <p className="text-sm leading-[1.6] text-misa-muted">
        When you check in we record a scrambled, one-way fingerprint of the
        network you used, so officers can see which check-ins came from
        somewhere other than the event. Your IP address is never stored, the
        fingerprint cannot be traced between events, and it never affects your
        points on its own.
      </p>
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
      <Panel
        as="div"
        ground="panel"
        pad="none"
        className="px-6 py-6"
        role="status"
      >
        <h2 className="font-display text-[26px] leading-[1.08] font-semibold">
          Check your details
        </h2>
        <p className="mt-2 leading-[1.65] text-misa-body">
          {existing
            ? "We already have you on file, so confirming will use your existing record rather than adding you twice."
            : "You'll be added to the roster with exactly these details, so give them a quick look."}
        </p>
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <Row label="Full name" value={submitted.fullName} />
          <Row label="UT EID" value={submitted.eid} />
          <Row label="Email" value={submitted.email} />
        </dl>
      </Panel>

      <input
        type="hidden"
        name="fullName"
        value={submitted.fullName}
        readOnly
      />
      <input type="hidden" name="eid" value={submitted.eid} readOnly />
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
          aria-busy={pending}
          className={BUTTON_SOLID_NAVY}
        >
          {pending ? "Checking in…" : "Confirm & check in"}
        </button>
        <button
          type="submit"
          name="step"
          value="edit"
          disabled={pending}
          className={BUTTON_OUTLINE_NAVY}
        >
          Go back
        </button>
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-misa-muted">{label}:</dt>
      <dd className="font-medium">{value}</dd>
    </div>
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
    // 🪤 NO `data-reveal` here, ever. This panel replaces the form after the
    // action resolves, and the reveal observer scans once per pathname — a node
    // mounted by a state change is never observed, so its unconditional
    // `opacity: 0` start state would become permanent. The one screen that
    // tells a member their attendance was recorded would render blank.
    <Panel ground="panel" pad="none" className="px-6 py-6" role="status">
      <h2 className="font-display text-[26px] leading-[1.08] font-semibold">
        {heading}
      </h2>
      <p className="mt-2 leading-[1.65] text-misa-body">{children}</p>
      {/* Stage 7 phase 2. On every terminal outcome, including `pending` and
          `duplicate` — those are the two where someone most wants to see for
          themselves that the system has them, rather than take a sentence's
          word for it. */}
      <p className="mt-4 text-sm text-misa-muted">
        <Link
          href="/lookup"
          className="text-misa-blue underline hover:text-misa-blue-dark"
        >
          Check your points and attendance
        </Link>
      </p>
    </Panel>
  );
}

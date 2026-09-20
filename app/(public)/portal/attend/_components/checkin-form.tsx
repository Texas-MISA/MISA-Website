"use client";

import { Check, CircleCheck, CircleSlash, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useId, useRef } from "react";

import {
  submitCheckin,
  type CheckinState,
  type SubmittedValues,
} from "@/app/actions/attendance";
// The refused copy quotes the grace window, so it reads it from the same
// constant the server decides with — a hardcoded "48 hours" would start
// lying the moment ORPHAN_WINDOW_HOURS changed. lib/checkin.ts is free of
// next/* and server-only imports, so a Client Component can import it.
import { Banner, type BannerTone } from "@/components/ui/banner";
import { buttonClass } from "@/components/ui/button";
import { CHECKBOX, Field, Input } from "@/components/ui/field";
import { Title } from "@/components/ui/heading";
import { Panel } from "@/components/ui/panel";
import { StatusRegion } from "@/components/ui/status-region";
import { ORPHAN_WINDOW_HOURS } from "@/lib/checkin";

// Client Component for useActionState only — the form posts to the Server
// Action via <form action>, so it works before hydration too (submissions
// queue until JS loads; Next prioritizes hydrating them). The two-step
// first-timer flow is action state rather than client-side routing for the
// same reason: it has to survive a phone that hasn't finished loading JS.
//
// REBUILT in v2 phase 3 (the Portal Rebuild), concept A "Fit the first screen".
// Brief: .impeccable/surfaces/route-portal-attend.md. Twelve states, plus the
// pre-hydration one, and every one of them is designed — the officer's named
// failure (a first-timer stuck on the checkbox's wording) happens on a screen
// no happy-path review ever opens.

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

/**
 * The sentence the always-mounted status region announces, per outcome.
 *
 * 🪤 **Empty for every state that already announces itself.** EV11's rule is
 * one atomic status message and never competing live regions: the three banners
 * carry `role="alert"`, the field errors carry their own, and the review step's
 * heading takes focus — so adding a second region saying the same thing would
 * make a screen reader read each of those twice. What this region exists for is
 * the four TERMINAL outcomes, whose panels mount already holding their text,
 * which is precisely the case CLAUDE.md records as missed and why those panels
 * no longer carry `role="status"` themselves.
 *
 * 🔓 **One rule, six states, instead of a rule and an exception.** The region
 * carries only what nothing else announces. `needs_confirmation` joined the
 * banners here when the audit pass gave the review step's heading focus: a
 * screen that CONTINUES the task moves focus (which announces it), a screen
 * that ENDS it announces politely and leaves focus alone.
 */
function announcement(state: CheckinState): string {
  switch (state.status) {
    case "present":
      return `You're checked in. Your attendance at ${state.eventTitle} is recorded.`;
    case "pending":
      return "Check-in received. No event window is open, so an officer will match it to the right event.";
    case "duplicate":
      return state.prior === "present"
        ? "Already recorded. You're already checked in to this event."
        : "Already recorded. Your check-in is awaiting officer review.";
    case "refused":
      return "No event around this time. Nothing was recorded.";
    // Announced by something else already — the three banners' and the field
    // errors' `role="alert"`, and the review step's heading taking focus.
    // Returning "" here is what keeps the two from competing.
    case "idle":
    case "invalid":
    case "error":
    case "rate_limited":
    case "unmatched":
    case "needs_confirmation":
      return "";
    default: {
      const exhaustive: never = state;
      void exhaustive;
      return "";
    }
  }
}

export function CheckinForm() {
  const [state, formAction, pending] = useActionState(submitCheckin, INITIAL);

  // React 19 resets an uncontrolled <form action> once the action resolves,
  // so every field below is driven from what the server echoed back. Always a
  // string, never undefined: a nullish defaultValue after a non-nullish one
  // makes React drop the value attribute, and the reset then clears the field.
  const submitted = state.submitted ?? EMPTY;

  return (
    <>
      {/* 🪤 **Outside the switch, and rendered unconditionally.** This is the
          whole point of the component: a live region has to be in the DOM
          BEFORE its contents change, and every screen below replaces the one
          before it. Sitting here it is mounted from first paint and only its
          text ever changes. `{message && <StatusRegion/>}` would re-create the
          exact defect it was written to fix, and so would moving it inside any
          branch. `sr-only` is absolutely positioned, so it adds no height to a
          page measured in single-digit pixels. */}
      <StatusRegion message={announcement(state)} />
      <CheckinScreen
        action={formAction}
        pending={pending}
        state={state}
        submitted={submitted}
      />
    </>
  );
}

function CheckinScreen({
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
  switch (state.status) {
    // Terminal outcomes replace the form entirely — the member is done.
    case "present":
      return (
        <ResultPanel tone="affirm" icon={Check} heading="You're checked in!">
          Your attendance at <strong>{state.eventTitle}</strong> is recorded.
        </ResultPanel>
      );
    case "pending":
      return (
        <ResultPanel tone="caution" icon={Clock} heading="Check-in received">
          No event window is open right now, so an officer will review your
          check-in and match it to the right event. You don&apos;t need to do
          anything else.
        </ResultPanel>
      );
    // 🔓 Duplicate is the one outcome whose TONE is decided by what it found.
    // "You're already checked in" is a success — the member can stop — and
    // "it's awaiting review" is the same caution as `pending`. Giving both the
    // same colour would make the affirm ground mean two different things.
    case "duplicate":
      return (
        <ResultPanel
          tone={state.prior === "present" ? "affirm" : "caution"}
          icon={CircleCheck}
          heading="Already recorded"
        >
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
        <ResultPanel
          tone="critical"
          icon={CircleSlash}
          heading="No event around this time"
        >
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
          action={action}
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
          action={action}
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
  const unmatched = state.status === "unmatched";

  // Two ids, because the box's NAME and its DESCRIPTION are different strings
  // and the difference is the whole accessible-name fix below.
  const boxId = useId();
  const labelId = `${boxId}-label`;
  const hintId = `${boxId}-hint`;

  // EV1 — after a failed submit, focus moves to the explanation. Without this
  // the submit button disables while pending and focus is left wherever the
  // browser put it, so the member is told nothing and shown nothing.
  //
  // 🪤 Queried out of the form rather than held in a ref per control. `Field`
  // clones its first element child to thread the label id, and putting a ref
  // through that clone is a second thing to get right for no gain — the
  // selectors below are exact: `aria-invalid` is only ever on a failed field,
  // and `[role="alert"][tabindex="-1"]` is only ever the banner. (The honeypot
  // is also `tabindex="-1"`, which is why the role is in the selector and not
  // just the tabindex.)
  //
  // 🪤 Keyed on `state`, not on `state.status`. Two consecutive failed submits
  // of the same kind produce the same status and a NEW state object, and only
  // the object identity changes — on `status` alone the second failure would
  // move focus nowhere.
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    if (state.status === "invalid") {
      form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    if (
      state.status === "unmatched" ||
      state.status === "rate_limited" ||
      state.status === "error"
    ) {
      form
        .querySelector<HTMLElement>('[role="alert"][tabindex="-1"]')
        ?.focus();
    }
    // Nothing moves before hydration, and nothing needs to: without JS the
    // action is a full page POST and the browser starts the member at the top
    // of the new document, which is where the explanation is.
  }, [state]);

  return (
    // 🪤 `gap-4` (16px), not `gap-5`. The idle form has four gaps — between the
    // three fields, the box and the button — so the 4px step is a measured 16px
    // off the first-screen bar, which came in at 611 against a 640 fold. EV5
    // sets the floor at 8px between touch targets and nothing here goes near
    // it; the reassurance line is what gives next if this copy ever grows.
    <form ref={formRef} action={action} className="flex flex-col gap-4" noValidate>
      {/* 🔓 The three banners sit INSIDE the sheet and above the fields, so a
          correction starts where the eye already is. Each is the focus target
          for its state (EV1) and keeps its own `role="alert"` — which is why
          `announcement()` returns "" for all three rather than saying it twice.

          🔓 The unmatched copy was REWRITTEN for the new checkbox label
          (officer, 2026-09-19). It used to say "if this is your first MISA
          event or your first time checking in here, tick the box below",
          quoting a label that no longer exists — the one place in the phase
          that generated member-facing copy the officer had not already seen.
          It now mirrors the label word for word, so a member scanning for the
          banner's words finds the control it points at.

          🔴 `tone="caution"`, not the default `info`, and the reason is
          measured rather than semantic — though it is both. The `info` wash is
          `bg-misa-panel`: **the same Vellum the three empty inputs below it are
          filled with**, since `controlClass` uses that exact token. On this
          white sheet both compute `rgb(242,242,243)` at 1.12:1 against the
          ground, so the alert carrying the officer's NAMED failure rendered as
          a fourth, empty form control. Caution's warm wash separates it by hue
          from the neutral controls, and it ties the banner to the outline on
          the box it points at — the sentence and its target now share a colour.
          It is also the more accurate token: `info` is DESIGN.md's "nothing to
          do here", and this screen is the one place on the page that asks the
          member to do something specific. */}
      {unmatched && (
        <Banner tone="caution" role="alert" tabIndex={-1}>
          We don&apos;t have that info on file. Check your EID and email for a
          typo and try again — or, if you haven&apos;t checked in with this form
          before, tick the box below.
        </Banner>
      )}
      {state.status === "rate_limited" && (
        <Banner tone="caution" role="alert" tabIndex={-1}>
          Too many check-ins from this connection — wait a few minutes and try
          again.
        </Banner>
      )}
      {state.status === "error" && (
        <Banner tone="critical" role="alert" tabIndex={-1}>
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

      {/* ── The box the officer named ──────────────────────────────────────
          🔓 **The label states a fact the MEMBER knows.** "This is my first
          MISA event, or my first time checking in here" asked about a fact the
          ROSTER knows better than they do, and the officer's 2026-09-19
          interview named that wording — not mistyped details, not signal — as
          what goes wrong at the door. Approved copy, built verbatim.

          🪤 **It is a hint, not an instruction** (docs/attend-confirmation-
          flow.md). Ticking it when we already have you links you to your own
          record and never creates a second one, which is what the reassurance
          line says out loud so an unsure member can just tick it.

          🪤 **The reassurance is a DESCRIPTION, not part of the name.** It sits
          inside the `<label>` so the whole block stays one tap target, against
          EV4's 48px floor and against the 16×16 box this replaces — but
          `aria-labelledby` points at the label span ALONE and
          `aria-describedby` at the hint. Without that split the box announces
          as one run-on string with the question buried at its front, which is
          the exact accessible-name bug `components/ui/field.tsx` documents.
          `aria-labelledby` outranks the wrapping `<label>` in the accname
          computation, so the name is the sentence and nothing more.

          🔴 **`min-h-12` IS here, and an earlier version of this comment
          declined it on a number nobody had measured.** It claimed "the block
          is already 87px" — an arithmetic estimate from the build plan, which
          assumed the reassurance wrapped to three lines. It wraps to two.
          Measured on the running page: **64px at 360** (two lines), but **44px
          at 768 and 1280**, where the label fits on one line — four pixels
          UNDER the floor this surface's own evidence commits to, on the two
          widths the estimate never considered. The floor costs the 360 bar
          nothing, because 360 already clears it. Found by the design-reviewer
          at the gate; the lesson is the project's own, and it was written into
          a comment by the same pass that was otherwise measuring everything.

          Echoing the member's own tick back after the form reset — not a
          preselected suggestion. It starts unchecked on the first render and
          only ever reflects what they chose. */}
      <label
        className={`flex min-h-12 items-start gap-3 text-sm ${
          // 🔓 On the unmatched screen the banner says "tick the box below", so
          // the box is marked in caution to end the sentence. An OUTLINE, never
          // a border: an outline is drawn outside the layout, so the idle state
          // — the one with the bar on it — pays nothing for a state it never
          // shows. Offset 4 keeps it clear of the 2px focus ring at offset 2,
          // and the two never coexist anyway.
          //
          // 🔴 2px at full strength, not 1px at 60%. At `outline-1` and /60 it
          // rendered as a SINGLE DEVICE PIXEL at 60% alpha, held 4px off a 64px
          // block — so the two faintest marks on that screen were the alert and
          // the pointer to the control it names. 2px is already the system's
          // focus-ring weight, so it is in the vocabulary; caution is a
          // desaturated earth ink rather than a signal light, and at full
          // strength it reads as deliberate rather than loud.
          unmatched
            ? "outline-2 outline-offset-4 outline-misa-caution"
            : ""
        }`.trim()}
      >
        <input
          type="checkbox"
          name="firstTime"
          defaultChecked={submitted.declaredNew}
          aria-labelledby={labelId}
          aria-describedby={hintId}
          className={`mt-1 ${CHECKBOX}`}
        />
        <span>
          <span id={labelId}>
            I haven&apos;t checked in with this form before
          </span>
          {/* 📌 Secondary Graphite, not Annotation Grey. This sits on the
              section's white ground where `--misa-muted` would pass at 4.84:1,
              but the portal has one de-emphasis ink and this is it (7.60:1),
              which is also what survives if this block ever moves grounds. */}
          <span id={hintId} className="mt-1 block text-misa-secondary">
            Not sure? Tick it. If we already have you, we&apos;ll use your
            existing record, never a second one.
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
          field of the same name would win formData.get("step").

          🔓 `touch` is the 48px native minimum (EV4) — `md` alone is 39px, which
          is the figure all three portal briefs measured. It is the last thing
          on the first screen and the reason the bar is where it is.

          🪤 EV7: the pending label must not resize the control. Below `sm` it is
          full width, so it cannot. Above `sm` `min-w` holds the box at the width
          "Checking in…" needs, so swapping the label moves nothing.

          🐛 `sm:self-start` is REQUIRED and `sm:w-auto` alone did nothing —
          measured, not assumed. This button is a flex item in a `flex-col`
          form, whose cross axis is horizontal, so the container's default
          `align-items: stretch` sets the item's width and a `width: auto` has
          no say in it. The button rendered 576px at 1280 with `sm:w-auto`
          already on it. **A width utility on a stretched flex child is not a
          width.** */}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={buttonClass({
          touch: true,
          block: true,
          className: "sm:w-auto sm:min-w-[13rem] sm:self-start",
        })}
      >
        {pending ? "Checking in…" : "Check in"}
      </button>

      {/* The check-in location-verification disclosure was removed here at the
          officer's instruction (hotfix c3890a1, re-confirmed 2026-09-19 in this
          surface's brief). Capture itself is unchanged, and this redesign adds
          none. If one ever returns it is ONE sentence in the unconditional
          present tense — never a conditional, because capture is not. */}
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
  // 🔴 **This screen replaces the one the member was focused on, so it has to
  // place focus itself.** The submit button they just pressed is unmounted with
  // the form, and focus falls back to `<body>` — so the next Tab restarts above
  // the site header, and a keyboard user has to cross the skip link, the
  // wordmark, four nav items and the MEMBER PORTAL button to reach *Confirm and
  // check in*, which is the only thing this screen asks of them.
  //
  // 🪤 **Only this screen, and only because it CONTINUES the task.** The four
  // terminal outcomes ask nothing, so they announce through `StatusRegion` and
  // leave focus alone — moving it there would interrupt a sentence the member
  // is being given rather than asked to act on. That split is also what keeps
  // `announcement()` down to one rule: the region carries what nothing else
  // announces, and a focused heading announces itself.
  //
  // 🪤 Queried out of the form rather than held on the heading, matching
  // `CheckinFields` above: `Title` would need ref forwarding for no gain, and
  // `h2[tabindex="-1"]` is exact — this is the only one on the page.
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('h2[tabindex="-1"]')?.focus();
  }, []);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      {/* 🔴 `ground="white"`, and that is THE muted-on-Vellum fix for this
          surface's first occurrence. The three `<dt>` labels below were
          `--misa-muted` on a Vellum panel — 4.33:1, the AA failure that
          `npm run test:ui` has been reporting as three `color-contrast` nodes
          on both first-timer confirmations. The concept's answer is the one
          DESIGN.md prescribes: move the GROUND, do not recolour the token in
          place. On white the panel reads against the section by its hairline,
          which is what `Panel` is for.

          🪤 No `role="status"`. It mounted already holding its text, which is
          the live-region case CLAUDE.md records as missed — the always-mounted
          `StatusRegion` in `CheckinForm` announces this step now. */}
      <Panel ground="white" pad="none" className="px-6 py-6">
        {/* 🔓 Approved copy, and the heading now says what CONFIRMING DOES
            rather than only what to look at. The sentence that used to sit
            under it said the same thing at greater length, so it is gone: the
            values are directly below, and a member holding a phone at a door
            reads one line, not two. `size="card"` is the ramp's Card title row
            (22 → 26) — a level cue against the band's h1, which is `Title`'s
            own 26 → 34. NEVER `className="text-[22px] sm:text-[26px]"`: that
            form ties on specificity and silently loses.

            `tabIndex={-1}` is the focus target, not a tab stop — see the effect
            at the top of this component for why the screen has to place focus
            itself. */}
        <Title as="h2" size="card" tabIndex={-1}>
          {existing
            ? "We found you. Confirm to check in."
            : "Check your details before we add you"}
        </Title>
        {/* 🔴 Body size (16px), not `text-sm`. **This screen's whole job is
            proofreading** — its heading says so, and the next action creates a
            roster record. What it shows is a UT EID and an email address, on a
            phone, in a room. The 14px arrived by inheritance from the form's
            labels, and a label and a value are different jobs: one is
            scaffolding you read once, the other is data you are being asked to
            verify. DESIGN.md's other instrument for an identifier — monospace,
            "because an EID is transcribed by hand off a phone screen" — is
            scoped to /admin and unavailable here, which leaves size. Measured
            cost: the list grows 76 → 88px, on a screen with no bar on it. */}
        <dl className="mt-4 flex flex-col gap-2 text-base">
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
          break `step` only after hydration.

          🔓 "Edit details" replaces "Go back", which did not say the values are
          kept — the one thing a member hesitating over a typo needs to know.
          Approved copy. Both controls are 48px (EV4); this step is reached on a
          phone at a door exactly as often as the form is.

          🪤 `flex-wrap` with `flex-1 basis-full sm:basis-auto`: below `sm` the
          two buttons stack full width rather than sharing a cramped row, and
          "Confirm and check in" is the longer label of the two. */}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          name="step"
          value="confirm"
          disabled={pending}
          aria-busy={pending}
          className={buttonClass({
            touch: true,
            className: "basis-full sm:basis-auto",
          })}
        >
          {pending ? "Checking in…" : "Confirm and check in"}
        </button>
        <button
          type="submit"
          name="step"
          value="edit"
          disabled={pending}
          className={buttonClass({
            variant: "outline",
            touch: true,
            className: "basis-full sm:basis-auto",
          })}
        >
          Edit details
        </button>
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    // 🪤 A `<div>` wrapping one `<dt>` and one `<dd>` is the shape axe's
    // `definition-list` rule allows; a stray `<p>` inside it becomes a second
    // `<dd>` and fails, which is the fault /portal/lookup's stat block carries.
    // Nothing else goes in here.
    <div className="flex flex-wrap gap-x-2">
      {/* 🔴 Secondary Graphite on white — 7.60:1. This was `--misa-muted` on
          Vellum at 4.33:1: the AA failure phase 3 exists to remove, and the one
          the suite could actually see. */}
      <dt className="text-misa-secondary">{label}:</dt>
      {/* 🔴 `min-w-0 break-words`, and NEITHER WORKS WITHOUT THE OTHER. A flex
          item's automatic minimum size is its `min-content` width, and an email
          address has no break opportunities — so the schema's 254-character
          ceiling put a real value **904px wide inside a 305px column**, taking
          the document to 588px of horizontal scroll at 360.

          🪤 The two failures look different, which is what makes this worth a
          comment. `break-words` alone does nothing: the item is still sized to
          `min-content`, so there is nothing to wrap into. `min-w-0` alone is
          worse than it looks — the `<dd>` BOX stops overflowing, so anything
          reading box geometry calls it fixed, while the text goes on painting
          588px past the viewport. Only the pair works, and the panel growing
          233 → 293px is the proof the text finally wrapped.

          🪤 It is specifically an UNBROKEN TOKEN. A 109-character *name* wraps
          cleanly today, because it has spaces — so a long-content check that
          used a realistic name would have passed and found nothing. */}
      <dd className="min-w-0 break-words font-medium">{value}</dd>
    </div>
  );
}

/**
 * A terminal outcome: the screen that ends the task.
 *
 * 🔓 **The tone is the outcome, and it is never the tone alone** (EV9). Each of
 * the four carries a status ground, a heading that names what happened, and a
 * drawn Lucide mark — so the colour is read first and confirmed twice. This is
 * the one place colour appears on the page, which is what makes it legible as
 * meaning rather than decoration (DESIGN.md: status tokens for feedback only).
 *
 * 🪤 **`Banner size="md"`, not a hand-rolled wash.** The tone → wash + hairline
 * pairing lives in `components/ui/banner.tsx` and must stay there; writing
 * `bg-misa-affirm-wash` here would be a second definition of what "affirm"
 * looks like. `size` is a prop rather than an appended `px-6 py-6` because
 * equal-specificity utilities are decided by emission order — the tie that has
 * made `<Title className="text-[22px]">` render at 26px since it was written.
 */
function ResultPanel({
  tone,
  icon: Icon,
  heading,
  children,
}: {
  tone: BannerTone;
  icon: LucideIcon;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    // 🪤 NO `data-reveal` here, ever. This panel replaces the form after the
    // action resolves, and the reveal observer scans once per pathname — a node
    // mounted by a state change is never observed, so its unconditional
    // `opacity: 0` start state would become permanent. The one screen that
    // tells a member their attendance was recorded would render blank.
    //
    // 🪤 And no `role="status"` either, for the mirror-image reason: it mounts
    // already carrying its heading, so assistive technology sees a new element
    // rather than a region that changed. `StatusRegion` does the announcing.
    <Banner as="div" tone={tone} size="md">
      <div className="flex items-start gap-3">
        {/* The mark is decorative: every word of the outcome is in the heading
            and the sentence, so a screen reader that skips this loses nothing.
            `shrink-0` because a long event title must wrap beside it, never
            squeeze it. */}
        <Icon
          aria-hidden="true"
          strokeWidth={2}
          className="mt-0.5 size-6 shrink-0"
        />
        <div className="min-w-0">
          {/* 🔴 `text-foreground` (Graphite) because `Banner`'s tone classes end
              in `text-misa-body`, and this heading was inheriting it — measured
              `rgb(58, 61, 64)`. DESIGN.md §Colors assigns Graphite to "ink —
              body headings" and Body Graphite to "long-form paragraphs", so the
              outcome heading was wearing the paragraph's ink. What made it a
              defect rather than a quibble: the review step's heading two
              screens earlier sits in a `Panel`, inherits `body`'s
              `--foreground`, and IS Graphite — so a first-timer saw the same
              component, at the same size, in two different inks.

              🪤 This does not touch `Banner`'s own rule. "The tone is in the
              rule and the ground; the text stays body-coloured" was written
              about the MESSAGE, and a heading inside a banner is a shape
              `Banner` had no call site for until this surface made one. */}
          <Title as="h2" size="card" className="text-foreground">
            {heading}
          </Title>
          {/* `leading-[1.6]`, the ramp's Body row. 1.65 is the `Lead` row's,
              for 18px — inherited from the pre-redesign panel. Ten call sites
              in the codebase still pair 1.65 with body size and three use 1.6;
              what settles it here is that the hub, the only other surface
              through this pipeline, took 1.6 against the ramp at its own gate. */}
          <p className="mt-2 leading-[1.6]">{children}</p>
          {/* Stage 7 phase 2. On every terminal outcome, including `pending`
              and `duplicate` — those are the two where someone most wants to
              see for themselves that the system has them, rather than take a
              sentence's word for it.

              🔴 The wrapper used to be `text-sm text-misa-muted`, which is this
              surface's SECOND muted-on-Vellum occurrence and the one nothing
              has ever caught: it painted no text (the link sets its own ink),
              so axe had nothing to measure and a grep found a class that did
              nothing. Both are gone — the line is body size on the ramp, and
              the link carries the only colour it needs.

              🔓 "See your points and attendance" is the approved copy (was
              "Check your points and attendance" — "check" is the verb this
              whole page already owns). */}
          {/* 🔴 `py-3` on the link and `mt-2` on the wrapper, together. This is
              the ONLY action on four of the twelve screens — on `pending`,
              `duplicate` and `refused` it is the only thing a member can do at
              all — and it measured 217 × 32px while every other target on this
              page was built to 48 on EV4's argument that the page is "used
              standing up at a door, one-handed, in a hurry". 32 clears WCAG
              2.2's 24px floor and matches what the hub shipped, but the hub's
              equivalent is a footnote for the one person on that page who is
              not a member. This is the member's next step. `py-3` takes it to
              exactly 48px; `mt-4 → mt-2` gives back the 8px the padding adds,
              so the visual gap to the sentence above stays at 20px. */}
          <p className="mt-2">
            <Link
              href="/portal/lookup"
              className="inline-block py-3 text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
            >
              See your points and attendance
            </Link>
          </p>
        </div>
      </div>
    </Banner>
  );
}

"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  createPayment,
  type PaymentCreateState,
  type SubmittedPaymentCreateValues,
} from "@/app/actions/dues";
import { Banner } from "@/components/ui/banner";
import { BUTTON_PRIMARY_SM, BUTTON_QUIET_SM } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  isSummerCivilDate,
  startTermOptionsForDate,
  termOfCivilDate,
} from "@/lib/dues";
import type { MemberOption } from "@/lib/member-options";

// The manual dues entry form (migration 32).
//
// ⚠️ Every field is uncontrolled and driven from `values`, which createPayment
// echoes back. React 19 resets an uncontrolled `<form action={…}>` once the
// action resolves, so a form that re-renders with server state would otherwise
// revert to what it started with. The `generation` key remounts the fields on
// every answer from the server, for the reason grant-form.tsx gives: two
// identical invalid submits produce identical values, and only a counter makes
// the remount happen both times. No select here is controlled, because a
// controlled `<select>` is the one control that reset still reaches (CLAUDE.md,
// "Rendering").
//
// Three things are ALSO tracked in state, because the form reacts to them as
// the officer types: the date (the start-term options and the summer warning
// follow it), the method (Other makes the note required), and the start term
// the officer picked, if they picked one.
//
// ⚠️ Client Component, so nothing here calls Intl or toLocale*. "Now" arrives
// formatted from the page, and the term arithmetic is lib/dues.ts's Intl-free
// civil-date helpers.

const initial: PaymentCreateState = { status: "idle" };

export type TermChoice = { value: string; label: string };

const STALE_MEMBER =
  "That member is no longer on the roster, so nothing was recorded. Reload the page and pick again.";
const FAILED = "Something went wrong and nothing was recorded. Try again.";
const SIGNED_OUT = "Your session has expired, so nothing was recorded. Sign in again.";

export function PaymentForm({
  members,
  defaults,
  termChoices,
}: {
  members: MemberOption[];
  /** Pre-filled values: the `?member=` pick, and now in Central time. */
  defaults: { memberId: string; paidDate: string; paidTime: string };
  /** The terms-covered choice, labelled with the real prices by the page. */
  termChoices: TermChoice[];
}) {
  const [state, formAction, pending] = useActionState(createPayment, initial);

  const fresh: SubmittedPaymentCreateValues = {
    memberId: defaults.memberId,
    amount: "",
    paidDate: defaults.paidDate,
    paidTime: defaults.paidTime,
    method: "cash",
    startTerm: "",
    termsCovered: "",
    note: "",
  };

  const [generation, setGeneration] = useState(0);
  // useActionState has no reset, so `done` would stay on screen forever without
  // this; import-form.tsx found that the hard way.
  const [dismissed, setDismissed] = useState(false);
  const [date, setDate] = useState(fresh.paidDate);
  const [method, setMethod] = useState(fresh.method);
  // Null means "follow the date": the officer has not picked a start term, so
  // it moves with the date they type.
  const [termChoice, setTermChoice] = useState<string | null>(null);

  // Reset-during-render on every answer from the server, matching
  // grant-form.tsx, so no stale frame paints. The echo wins: it is what the
  // officer submitted, and the fields are about to remount with it. An answer
  // with no echo (`unauthorized`, `done`) remounts the fields from `fresh`, so
  // the tracked state goes back to `fresh` too, or the start-term options and
  // the note's label would describe values the inputs no longer hold.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    setGeneration((n) => n + 1);
    setDismissed(false);
    if ("values" in state) {
      const echoed = state.values;
      setDate(echoed.paidDate);
      setMethod(echoed.method);
      setTermChoice(
        echoed.startTerm && echoed.startTerm !== termOfCivilDate(echoed.paidDate)
          ? echoed.startTerm
          : null
      );
    } else {
      setDate(fresh.paidDate);
      setMethod(fresh.method);
      setTermChoice(null);
    }
  }

  // Focus, which every answer would otherwise drop to <body>. Effects, because
  // focus is DOM work; nothing here sets state.
  //  - On `done` the form unmounts, so focus goes to the confirmation's first
  //    action, and a keyboard or screen-reader user lands on what happened.
  //  - Every other answer from the server, and "Record another", remounts the
  //    fields under a new `generation` key, taking the focused control with
  //    them. Focus goes to the first field with an error, or else to the first
  //    field (walkthrough, 2026-10-05).
  //  - Nothing on first load (`generation` 0): the page does not grab focus.
  const openPayment = useRef<HTMLAnchorElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const done = state.status === "done" && !dismissed;
  useEffect(() => {
    if (done) {
      openPayment.current?.focus();
      return;
    }
    if (generation === 0 || !form.current) return;
    const target =
      (state.status === "invalid"
        ? form.current.querySelector<HTMLElement>('[aria-invalid="true"]')
        : null) ??
      form.current.querySelector<HTMLElement>("select, input, textarea");
    target?.focus();
  }, [done, generation, state.status]);

  function recordAnother() {
    setDismissed(true);
    setGeneration((n) => n + 1);
    setDate(fresh.paidDate);
    setMethod(fresh.method);
    setTermChoice(null);
  }

  const values = "values" in state ? state.values : fresh;
  const errors = state.status === "invalid" ? state.fieldErrors : {};

  // The same window createPayment checks against, from the same rule, so every
  // term offered here is one the server accepts.
  const derivedTerm = termOfCivilDate(date);
  const termOptions = startTermOptionsForDate(date);
  const startTerm =
    termChoice !== null && termOptions.includes(termChoice)
      ? termChoice
      : (derivedTerm ?? "");
  const noteRequired = method === "other";

  // 📌 Always mounted, and that is the point: a live region that mounts already
  // holding its text is missed by screen readers (CLAUDE.md, "Accessible
  // controls"). The visible banners below carry no role, so nothing is said
  // twice.
  const invalidCount = Object.keys(errors).length;
  const message =
    state.status === "invalid"
      ? `Nothing was recorded. ${invalidCount} field${invalidCount === 1 ? " needs" : "s need"} attention.`
      : done
        ? "Payment recorded."
        : state.status === "stale_member"
          ? STALE_MEMBER
          : state.status === "error"
            ? FAILED
            : state.status === "unauthorized"
              ? SIGNED_OUT
              : "";
  // 🪤 A live region speaks only when its text CHANGES, so two identical
  // invalid submits in a row would be announced once. A trailing no-break
  // space, flipped on every answer from the server, makes each answer a change
  // without altering what is read. The region itself is never re-keyed: a
  // remounted region is a new one, and that is the miss described above.
  const announcement =
    message && generation % 2 === 1 ? `${message}\u00a0` : message;

  return (
    <div className="max-w-2xl">
      <p role="status" aria-atomic="true" className="sr-only">
        {announcement}
      </p>

      {done ? (
        <Banner tone="affirm" as="div">
          {/* What the stored row covers, read back by the action, so a
              "Decide later" payment is not described as counting. */}
          <p>
            Payment recorded.{" "}
            {state.coveredTerms && state.coveredTerms.length > 0
              ? `It counts toward the member's dues for ${state.coveredTerms.join(", ")}.`
              : "It covers nothing until someone decides how many terms it bought."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link
              ref={openPayment}
              href={`/admin/dues/${state.id}`}
              className={BUTTON_PRIMARY_SM}
            >
              Open the payment
            </Link>
            <button
              type="button"
              onClick={recordAnother}
              className={BUTTON_QUIET_SM}
            >
              Record another
            </button>
          </div>
        </Banner>
      ) : (
        <Panel ground="white" pad="md">
          <p className="text-sm text-misa-secondary">
            Venmo payments to the club come in through{" "}
            <Link
              href="/admin/dues/import"
              className="underline underline-offset-2"
            >
              Import a statement
            </Link>
            . Recording one here as well would count it twice, so Venmo is not
            one of the methods.
          </p>

          {state.status === "stale_member" ||
          state.status === "error" ||
          state.status === "unauthorized" ? (
            <Banner
              tone={state.status === "error" ? "critical" : "caution"}
              className="mt-5"
            >
              {state.status === "stale_member"
                ? STALE_MEMBER
                : state.status === "error"
                  ? FAILED
                  : SIGNED_OUT}
            </Banner>
          ) : null}

          <form ref={form} action={formAction} className="mt-6">
            <div key={generation} className="flex flex-col gap-5">
              <Field label="Member" error={errors.memberId?.[0]}>
                <Select
                  name="memberId"
                  density="sm"
                  defaultValue={values.memberId}
                  aria-invalid={errors.memberId ? true : undefined}
                >
                  <option value="">Pick a member</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Amount (dollars)"
                hint="What the member paid, like 40 or 40.00."
                error={errors.amount?.[0]}
              >
                <Input
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  density="sm"
                  defaultValue={values.amount}
                  aria-invalid={errors.amount ? true : undefined}
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Date paid (Central time)"
                  error={errors.paidDate?.[0]}
                >
                  <Input
                    name="paidDate"
                    type="date"
                    density="sm"
                    defaultValue={values.paidDate}
                    onChange={(event) => setDate(event.currentTarget.value)}
                    aria-invalid={errors.paidDate ? true : undefined}
                  />
                </Field>
                <Field
                  label="Time paid (Central time)"
                  error={errors.paidTime?.[0]}
                >
                  <Input
                    name="paidTime"
                    type="time"
                    density="sm"
                    defaultValue={values.paidTime}
                    aria-invalid={errors.paidTime ? true : undefined}
                  />
                </Field>
              </div>

              <Field label="How it was paid" error={errors.method?.[0]}>
                <Select
                  name="method"
                  density="sm"
                  defaultValue={values.method}
                  onChange={(event) => setMethod(event.currentTarget.value)}
                  aria-invalid={errors.method ? true : undefined}
                >
                  {PAYMENT_METHODS.map((value) => (
                    <option key={value} value={value}>
                      {PAYMENT_METHOD_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Starts covering"
                hint={
                  isSummerCivilDate(date)
                    ? "⚠️ This date is between May and July, which counts as the Spring term. If the payment was meant for the coming Fall, pick Fall."
                    : "Set from the date paid. Change it only if the payment was meant for another term."
                }
                error={errors.startTerm?.[0]}
              >
                {/* Keyed on the date: the options change with it, and an
                    uncontrolled select only takes a new defaultValue on mount. */}
                <Select
                  key={date}
                  name="startTerm"
                  density="sm"
                  defaultValue={startTerm}
                  onChange={(event) => setTermChoice(event.currentTarget.value)}
                  aria-invalid={errors.startTerm ? true : undefined}
                >
                  {termOptions.length === 0 ? (
                    <option value="">Enter the date paid first</option>
                  ) : (
                    termOptions.map((term) => (
                      <option key={term} value={term}>
                        {term}
                        {term === derivedTerm ? " (from the date paid)" : ""}
                      </option>
                    ))
                  )}
                </Select>
              </Field>

              <Field
                label="Terms it covers"
                hint="Pick now if you know. A payment left undecided waits in the review queue and the member reads as not paid."
                error={errors.termsCovered?.[0]}
              >
                <Select
                  name="termsCovered"
                  density="sm"
                  defaultValue={values.termsCovered}
                  aria-invalid={errors.termsCovered ? true : undefined}
                >
                  {termChoices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label={noteRequired ? "Note (required for Other)" : "Note (optional)"}
                hint={
                  noteRequired
                    ? "Say how the money arrived, for example a cheque, or cash handed to another officer."
                    : "Anything an officer would want to know later."
                }
                error={errors.note?.[0]}
              >
                <Textarea
                  name="note"
                  rows={3}
                  density="sm"
                  defaultValue={values.note}
                  aria-required={noteRequired}
                  aria-invalid={errors.note ? true : undefined}
                />
              </Field>

              <div className="flex flex-wrap items-center gap-4">
                {/* Disabled while pending: a double click must not record the
                    same payment twice, and nothing in the database would
                    catch it, because a manual row has no transaction id. */}
                <button
                  type="submit"
                  disabled={pending}
                  className={BUTTON_PRIMARY_SM}
                >
                  {pending ? "Recording…" : "Record payment"}
                </button>
                <span className="text-xs text-misa-muted">
                  Recorded under your name.
                </span>
              </div>
            </div>
          </form>
        </Panel>
      )}
    </div>
  );
}

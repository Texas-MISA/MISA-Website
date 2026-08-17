"use client";

import { useActionState } from "react";

import {
  lookupMember,
  type LookupState,
  type SubmittedValues,
} from "@/app/actions/lookup";
import { Banner } from "@/components/ui/banner";
import { BUTTON_SOLID_NAVY } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import type { LookupProfile } from "@/lib/lookup";
import type { TermEventState } from "@/lib/members";

// Client Component for useActionState only. The form posts to the Server
// Action via <form action>, so it works before hydration — the result is
// action state rather than client-side routing for the same reason /attend's
// two-step flow is: it has to survive a phone that has not finished loading JS.
//
// ⚠️ Everything rendered below arrives already formatted as strings. The
// profile crosses a client boundary, and Intl.DateTimeFormat running on both
// sides of hydration is the invariant that bites here — Node and Chrome ship
// different ICU data for the space before "PM", and the React diff then shows
// two strings that look character-for-character identical. Formatting lives in
// lib/lookup.ts, on the server.
//
// 📌 This page used to read as an admin screen wearing a public hero: it had
// its own `inputClass`, its own `Field`, its own `bannerClass`, a fourth
// independent status-pill implementation, and two tables built on the admin's
// plain-table idiom. All five now come from components/ui, so the difference
// between this page and /officers is the content rather than the vocabulary.

const INITIAL: LookupState = { status: "idle" };

const EMPTY: SubmittedValues = { eid: "", email: "" };

export function LookupForm() {
  const [state, formAction, pending] = useActionState(lookupMember, INITIAL);

  // React 19 resets an uncontrolled <form action> once the action resolves, so
  // both fields are driven from what the server echoed back. Always a string,
  // never undefined: a nullish defaultValue after a non-nullish one makes React
  // drop the value attribute, and the reset then clears the field — at exactly
  // the moment the member is trying to fix a typo.
  const submitted = state.submitted ?? EMPTY;

  switch (state.status) {
    case "found":
      return (
        <Result profile={state.profile} action={formAction} pending={pending} />
      );

    case "idle":
    case "invalid":
    case "unmatched":
    case "rate_limited":
    case "error":
      return (
        <LookupFields
          action={formAction}
          pending={pending}
          state={state}
          submitted={submitted}
        />
      );

    default: {
      // Every state above is handled; a new one fails the build rather than
      // rendering nothing at all.
      const exhaustive: never = state;
      void exhaustive;
      return null;
    }
  }
}

function LookupFields({
  action,
  pending,
  state,
  submitted,
}: {
  action: (formData: FormData) => void;
  pending: boolean;
  state: LookupState;
  submitted: SubmittedValues;
}) {
  const fieldErrors =
    state.status === "invalid" ? state.fieldErrors : undefined;

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {/* 🔓 ONE message for every miss. Never "no such EID" versus "that email
          doesn't match": §6 accepts that check-in makes roster membership
          probeable with an EID alone, and this page shows dues status only
          because its gate is strictly narrower than that. Two distinguishable
          failures would let someone confirm an EID and then walk the email,
          which is a stronger oracle than the one that was accepted.

          ⚠️ The TONE is `info` for the same reason. A miss here is not an
          error — most of the time it is a typo or somebody who has genuinely
          never checked in — and painting it critical would make "you are not on
          the roster" look like "something broke", which is the empty-vs-error
          confusion running in the other direction. */}
      {state.status === "unmatched" && (
        <Banner role="alert">
          We couldn&apos;t match that EID and email to a member. Both have to
          match the same person — check them for a typo and try again. If
          you&apos;ve never checked in to a MISA event, you won&apos;t be on the
          roster yet.
        </Banner>
      )}
      {state.status === "rate_limited" && (
        <Banner tone="caution" role="alert">
          Too many lookups from this connection — wait a few minutes and try
          again. This limit is per network, so it can trigger on shared campus
          WiFi even if it&apos;s your first try.
        </Banner>
      )}
      {state.status === "error" && (
        <Banner tone="critical" role="alert">
          Something went wrong on our end — please try again. This isn&apos;t a
          statement about your records; we just couldn&apos;t read them.
        </Banner>
      )}

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

      <Field
        label="Email"
        error={fieldErrors?.email?.[0]}
        hint="The email we have on file for you. Both fields have to match the same member."
      >
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

      {/* Honeypot (§6): visually hidden and skipped by keyboard/screen readers;
          bots that autofill every field give themselves away. */}
      <div aria-hidden="true" className="absolute top-auto -left-[9999px]">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {/* No name on this button, so `step` is absent on the lookup pass. Do not
          add a hidden <input name="step"> here: React inserts a submitter's
          name/value immediately before the submitter, so an earlier hidden
          field of the same name would win formData.get("step"). */}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={`mt-1 w-fit ${BUTTON_SOLID_NAVY}`}
      >
        {pending ? "Looking up…" : "Look up my attendance"}
      </button>
    </form>
  );
}

function Result({
  profile,
  action,
  pending,
}: {
  profile: LookupProfile;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  const term = profile.term ?? "this term";

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="font-display text-[30px] leading-[1.02] font-semibold tracking-[-0.015em]">
          {profile.fullName}
        </h2>
        <p className="mt-1 text-sm text-misa-muted">
          Everything below is scoped to <strong>{term}</strong>, denominators
          included. A grant from a past term counts for nothing here.
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
          <Stat label="Total points" value={profile.totalPoints} emphasis />
          <Stat label="From attendance" value={profile.attendancePoints} />
          {/* The public board is a single total (§9 #11), so this is the only
              place a member can see that part of their standing was granted
              rather than earned. That makes it more important here, not less. */}
          <Stat label="Bonus points" value={profile.bonusPoints} />
          <Stat
            label="Attendance rate"
            value={profile.attendanceRate}
            note={
              profile.rateUnavailable
                ? "no events have finished yet"
                : `${profile.eventsAttended} of ${profile.eventsPossible} completed`
            }
          />
        </dl>
      </section>

      {profile.pending.length > 0 && (
        <section>
          <h3 className="font-display text-[22px] leading-[1.05] font-semibold">
            Waiting on an officer
          </h3>
          {/* The reassurance this page exists for. Someone who checked in late,
              or when no window was open, needs to see their form arrived —
              otherwise they assume it vanished and check in again. */}
          <p className="mt-2 text-sm text-misa-muted">
            We have {profile.pending.length} check-in
            {profile.pending.length === 1 ? "" : "s"} from you that
            {profile.pending.length === 1 ? " hasn't" : " haven't"} been
            reviewed yet. Nothing is lost — an officer matches these up by hand,
            and the points appear once they do.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {profile.pending.map((row) => (
              <li key={row.id}>
                <Banner tone="caution">
                  Submitted {row.submitted}
                  {row.eventTitle ? (
                    <>
                      {" "}
                      for <strong>{row.eventTitle}</strong>
                    </>
                  ) : (
                    // An orphan: received inside the grace window with no event
                    // open. It must be visible — silence here is the failure §4.2
                    // exists to prevent.
                    <span className="opacity-80">
                      {" "}
                      — not yet matched to an event
                    </span>
                  )}
                </Banner>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="font-display text-[22px] leading-[1.05] font-semibold">
          Events this term
        </h3>
        <p className="mt-2 text-sm text-misa-muted">
          Published events only — a cancelled event credits nobody, and{" "}
          <span className="font-medium">
            an event that hasn&apos;t happened yet is upcoming, not a miss
          </span>
          . {profile.attended} attended, {profile.missed} missed,{" "}
          {profile.upcoming} still to come.
        </p>

        {profile.events.length === 0 ? (
          <Banner className="mt-4">No published events in {term} yet.</Banner>
        ) : (
          <div className="mt-4">
            <Table minWidth="min-w-[32rem]">
              <THead>
                <tr>
                  <Th>Event</Th>
                  <Th>When</Th>
                  <Th numeric>Points</Th>
                  <Th>You</Th>
                </tr>
              </THead>
              <tbody>
                {profile.events.map((event) => (
                  <Tr key={event.id}>
                    <Td>{event.title}</Td>
                    <Td className="whitespace-nowrap">{event.when}</Td>
                    <Td numeric>{event.points}</Td>
                    <Td>
                      <AttendanceMark state={event.state} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </section>

      {profile.adjustments.length > 0 && (
        <section>
          <h3 className="font-display text-[22px] leading-[1.05] font-semibold">
            Points granted separately
          </h3>
          <p className="mt-2 text-sm text-misa-muted">
            Points an officer added or removed by hand, with the reason they
            gave. These are the difference between your attendance points and
            your total.
          </p>
          <div className="mt-4">
            <Table minWidth="min-w-[32rem]">
              <THead>
                <tr>
                  <Th>When</Th>
                  <Th numeric>Points</Th>
                  <Th>Category</Th>
                  <Th wrap>Reason</Th>
                </tr>
              </THead>
              <tbody>
                {profile.adjustments.map((row) => (
                  <Tr key={row.id}>
                    <Td className="whitespace-nowrap">{row.awarded}</Td>
                    {/* 🪤 `tabular-nums`, not `font-mono`. Monospace means one
                        thing in this system — the caption naming a photograph
                        that does not exist yet — and using it for figures makes
                        that convention unreadable. Tabular figures are what was
                        actually wanted: columns of digits that line up. */}
                    <Td numeric className="whitespace-nowrap">
                      {row.points}
                    </Td>
                    <Td>{row.category}</Td>
                    <Td>{row.reason}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </section>
      )}

      <section>
        <h3 className="font-display text-[22px] leading-[1.05] font-semibold">
          Membership dues
        </h3>
        {/* 🔓 The one surface in the whole system that shows dues status to an
            unauthenticated caller, and it is allowed here only because the gate
            is EID AND matching email (§6). It must never reach /leaderboard. */}
        <p className="mt-2 text-sm text-misa-muted">
          {profile.duesPaidCurrentTerm ? (
            <>
              You&apos;re an <strong>official member for {term}</strong>.
            </>
          ) : (
            <>
              You&apos;re <strong>not paid up for {term}</strong>. Dues are
              calculated from payments we&apos;ve received — if you&apos;ve paid
              recently it may not have been matched to you yet, so ask an
              officer rather than paying twice.
            </>
          )}{" "}
          {profile.paidThrough ? (
            <>
              Your dues cover you through <strong>{profile.paidThrough}</strong>
              .
            </>
          ) : (
            <>No payment of yours covers a term yet.</>
          )}
        </p>
      </section>

      {/* Plain submit button carrying name/value — never formAction, which
          makes React drop the submitter's name from the FormData
          pre-hydration. */}
      <form action={action}>
        <button
          type="submit"
          name="step"
          value="reset"
          disabled={pending}
          className={`w-fit ${BUTTON_SOLID_NAVY}`}
        >
          Look up someone else
        </button>
      </form>
    </div>
  );
}

/** The grid's three states, as words rather than colour alone. */
function AttendanceMark({ state }: { state: TermEventState }) {
  if (state === "attended") {
    return (
      <Pill tone="affirm" size="sm">
        attended
      </Pill>
    );
  }
  if (state === "missed") {
    return (
      <Pill tone="neutral" size="sm">
        missed
      </Pill>
    );
  }
  // Upcoming carries no frame at all: it is the absence of an outcome, not an
  // outcome, and a bordered badge would give it the same weight as the two
  // states that actually happened.
  return (
    <span className="text-[11px] tracking-[0.12em] text-misa-muted uppercase">
      upcoming
    </span>
  );
}

function Stat({
  label,
  value,
  note,
  emphasis,
}: {
  label: string;
  value: number | string;
  note?: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <dt className="text-[12px] tracking-[0.14em] text-misa-muted uppercase">
        {label}
      </dt>
      <dd
        className={
          emphasis
            ? "font-display text-[34px] leading-none font-semibold text-misa-blue tabular-nums"
            : "font-display text-[26px] leading-none font-semibold text-misa-blue tabular-nums"
        }
      >
        {value}
      </dd>
      {note && <p className="text-xs text-misa-muted">{note}</p>}
    </div>
  );
}

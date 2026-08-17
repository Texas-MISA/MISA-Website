"use client";

import { Banner } from "@/components/ui/banner";

import { BUTTON_PRIMARY_SM, BUTTON_QUIET_SM } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";

import { useActionState, useState } from "react";

import {
  rejectSubmission,
  reopenSubmission,
  saveSubmission,
  type ResolutionState,
  type ReviewActionState,
  type SubmittedResolutionValues,
} from "@/app/actions/attendance-review";
import type { EventOption } from "@/lib/event-options";
import type { MemberOption } from "@/lib/member-options";

// The resolution controls (§7 Stage 5). Everything an officer can do to one
// submission, in one form and one submit.
//
// ⚠️ Every field is driven from `values`, which the action echoes back. React
// 19 resets an uncontrolled `<form action={…}>` once the action resolves, so a
// form that re-renders with server state — a validation error, a conflict, a
// missing link — otherwise reverts silently to the values the officer started
// from. Stage 4 shipped exactly that bug and it saved the *old* values behind a
// confirmation screen.
//
// Nothing here is preselected from a suggestion. The ranked lists above are
// inert; a stray defaultChecked is the easiest way to turn "don't auto-resolve
// near-misses" into "auto-resolve near-misses".

const initial: ResolutionState = { status: "idle" };
const initialAction: ReviewActionState = { status: "idle" };

const fieldClass = controlClass("sm", "w-full");

export function ResolutionForm({
  id,
  updatedAt,
  status,
  returnTo,
  events,
  members,
  current,
}: {
  id: string;
  /** The raw PostgREST string, never a Date — see the action for why. */
  updatedAt: string;
  status: string;
  returnTo: string;
  events: EventOption[];
  members: MemberOption[];
  current: SubmittedResolutionValues;
}) {
  const [state, formAction, pending] = useActionState(saveSubmission, initial);

  // The echoed values win whenever the action has spoken, so an edit survives
  // a rejected save.
  const values = "values" in state ? state.values : current;

  return (
    <div className="flex flex-col gap-8">
      {/* Keyed on the echoed values so a new server answer remounts the fields
          with those defaults. React 19 resets an uncontrolled form once the
          action resolves anyway; keying makes that deterministic instead of
          leaving the officer's edits to chance. `values` does not change while
          they type, so this does not remount under the cursor. */}
      <Fields
        key={JSON.stringify(values)}
        id={id}
        updatedAt={updatedAt}
        status={status}
        returnTo={returnTo}
        events={events}
        members={members}
        values={values}
        state={state}
        formAction={formAction}
        pending={pending}
      />

      {status === "pending" ? (
        <RejectForm id={id} updatedAt={updatedAt} returnTo={returnTo} />
      ) : (
        <ReopenForm id={id} updatedAt={updatedAt} status={status} />
      )}
    </div>
  );
}

function Fields({
  id,
  updatedAt,
  status,
  returnTo,
  events,
  members,
  values,
  state,
  formAction,
  pending,
}: {
  id: string;
  updatedAt: string;
  status: string;
  returnTo: string;
  events: EventOption[];
  members: MemberOption[];
  values: SubmittedResolutionValues;
  state: ResolutionState;
  formAction: (formData: FormData) => void;
  pending: boolean;
}) {
  const errors = state.status === "invalid" ? state.fieldErrors : {};

  // Tracked live rather than read off `values`, because the officer picks an
  // event and expects APPROVE to light up immediately. Deriving it from the
  // server's copy meant they had to SAVE, wait for the round trip, and only
  // then approve — two writes for one intent, which is exactly what the
  // one-save design exists to avoid.
  const [links, setLinks] = useState({
    eventId: values.eventId,
    memberId: values.memberId,
  });
  const canApproveNow = Boolean(links.eventId && links.memberId);

  return (
    <>
      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="updatedAt" value={updatedAt} />
        <input type="hidden" name="returnTo" value={returnTo} />

        <Notice state={state} />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Name" error={errors.submittedName}>
            <input
              name="submittedName"
              defaultValue={values.submittedName}
              className={fieldClass}
            />
          </Field>
          <Field label="EID" error={errors.submittedEid}>
            <input
              name="submittedEid"
              defaultValue={values.submittedEid}
              className={`${fieldClass} font-mono`}
            />
          </Field>
        </div>

        <Field label="Email" error={errors.submittedEmail}>
          <input
            name="submittedEmail"
            defaultValue={values.submittedEmail}
            className={fieldClass}
          />
        </Field>

        <Field label="Event" error={errors.eventId}>
          <select
            name="eventId"
            defaultValue={values.eventId}
            onChange={(e) =>
              setLinks((prev) => ({ ...prev, eventId: e.target.value }))
            }
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
          <p className="mt-1 text-xs text-misa-muted">
            {/* The picker reaches events the ranker cannot: nearby_events() is
                published-only and stops at 48 hours. */}
            Every event, including drafts and cancelled ones — the suggestions
            above only cover published events within 48 hours.
          </p>
        </Field>

        <Field label="Member" error={errors.memberId}>
          <select
            name="memberId"
            defaultValue={values.memberId}
            onChange={(e) =>
              setLinks((prev) => ({ ...prev, memberId: e.target.value }))
            }
            className={fieldClass}
          >
            <option value="">Not linked</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Note" error={errors.resolutionNote}>
          <textarea
            name="resolutionNote"
            defaultValue={values.resolutionNote}
            rows={2}
            className={fieldClass}
            placeholder="Why this was resolved the way it was"
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            name="intent"
            value="save"
            disabled={pending}
            className={BUTTON_QUIET_SM}
          >
            SAVE
          </button>

          <button
            type="submit"
            name="intent"
            value="approve"
            disabled={pending || !canApproveNow || status === "present"}
            title={
              status === "present"
                ? "Already approved"
                : canApproveNow
                  ? undefined
                  : // The JS mirror of present_requires_resolution. The
                    // constraint is still the guarantee; this is so the officer
                    // gets a sentence instead of a 23514.
                    !links.eventId && !links.memberId
                    ? "Pick an event and a member first — an approved row must have both"
                    : !links.eventId
                      ? "Pick an event first — an approved row must have one"
                      : "Link a member first — an approved row must have one"
            }
            className={BUTTON_PRIMARY_SM}
          >
            {pending ? "SAVING…" : "APPROVE"}
          </button>
        </div>
      </form>
    </>
  );
}

function RejectForm({
  id,
  updatedAt,
  returnTo,
}: {
  id: string;
  updatedAt: string;
  returnTo: string;
}) {
  const [state, formAction, pending] = useActionState(
    rejectSubmission,
    initialAction
  );

  return (
    <form
      action={formAction}
      className="border-t border-misa-hairline pt-6 flex flex-col gap-3"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="updatedAt" value={updatedAt} />
      <input type="hidden" name="returnTo" value={returnTo} />

      <p className="text-sm text-misa-secondary">
        Rejecting keeps the row and its history — nothing is deleted, and a
        rejected row never blocks a corrected re-entry.
      </p>

      <input
        name="resolutionNote"
        className={fieldClass}
        placeholder="Why (optional, but the next officer will thank you)"
      />

      {state.status === "conflict" && (
        <p className="text-sm">
          Someone else changed this row — reload and look again.
        </p>
      )}
      {state.status === "error" && (
        <p className="text-sm">Couldn&apos;t reject this submission.</p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className={BUTTON_QUIET_SM}
        >
          {pending ? "REJECTING…" : "REJECT"}
        </button>
      </div>
    </form>
  );
}

function ReopenForm({
  id,
  updatedAt,
  status,
}: {
  id: string;
  updatedAt: string;
  status: string;
}) {
  const [state, formAction, pending] = useActionState(
    reopenSubmission,
    initialAction
  );

  return (
    <form action={formAction} className="border-t border-misa-hairline pt-6">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="updatedAt" value={updatedAt} />

      <p className="text-sm text-misa-secondary">
        This row is {status}. Reopening puts it back in the pending queue.
      </p>

      {state.status === "slot_taken" && (
        <p className="mt-3 border border-misa-caution/45 bg-misa-caution-wash px-4 py-3 text-sm">
          {/* The partial unique index excludes rejected rows, so while this one
              sat rejected something else took its place at that event. */}
          Can&apos;t reopen this: {state.holderName ?? "another submission"} already
          holds this person&apos;s check-in at that event
          {state.holderId && (
            <>
              {" "}
              (
              <a
                href={`/admin/attendance/${state.holderId}`}
                className="underline"
              >
                open it
              </a>
              )
            </>
          )}
          . Resolve that row first, or leave this one rejected.
        </p>
      )}
      {state.status === "conflict" && (
        <p className="mt-3 text-sm">
          Someone else changed this row — reload and look again.
        </p>
      )}
      {state.status === "error" && (
        <p className="mt-3 text-sm">Couldn&apos;t reopen this submission.</p>
      )}

      <div className="mt-3">
        <button
          type="submit"
          disabled={pending}
          className={BUTTON_QUIET_SM}
        >
          {pending ? "REOPENING…" : "REOPEN"}
        </button>
      </div>
    </form>
  );
}

function Notice({ state }: { state: ResolutionState }) {
  if (state.status === "idle" || state.status === "invalid") return null;

  const message =
    state.status === "saved"
      ? "Saved."
      : state.status === "conflict"
        ? "Someone else changed this row while you were editing. Reload to see their version — nothing here was saved."
        : state.status === "duplicate"
          ? "That would be a second check-in for this person at this event. Look for the row that already exists rather than creating another."
          : state.status === "needs_links"
            ? state.missing === "both"
              ? "Pick an event and a member before approving."
              : `Pick ${state.missing === "event" ? "an event" : "a member"} before approving.`
            : state.status === "unauthorized"
              ? "Your session has expired — sign in again."
              : "Couldn't save this submission.";

  return (
    <Banner tone={state.status === "saved" ? "affirm" : "caution"} role="status">
      {message}
    </Banner>
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
      <span className="text-misa-muted">{label}</span>
      {children}
      {error && error.length > 0 && (
        <span className="text-xs text-misa-caution">{error[0]}</span>
      )}
    </label>
  );
}

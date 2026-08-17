"use client";

import { controlClass } from "@/components/ui/field";
import { BUTTON_PRIMARY_SM, BUTTON_QUIET_SM } from "@/components/ui/button";

import { useActionState, useState } from "react";

import {
  commitMerge,
  previewMerge,
  type CommitState,
  type PreviewState,
} from "@/app/actions/member-merge";
import type { MemberOption } from "@/lib/member-options";

// Merging a duplicate into this member (§7 Stage 6 phase 8).
//
// ⚠️ **Closed by default**, unlike phase 6's attendance-filter panel which opens
// whenever one of its filters is active. The rule there was that a collapsed
// panel must not HIDE something already applied; nothing here is applied until
// the officer acts, and this is a rare action that ends in a deleted row. It
// should not be the first thing on the page.
//
// ⚠️ The confirm is a two-click control, never `window.confirm`. A native dialog
// blocks the whole tab — the failure the browser-automation notes warn about —
// and this codebase has no other modal. Same shape as preset-row.tsx's delete.
//
// Nothing is preselected, including a suggestion. That is the resolution form's
// rule and it matters more here: acting on a wrong suggestion deletes a member.

const PREVIEW_INITIAL: PreviewState = { status: "idle" };
const COMMIT_INITIAL: CommitState = { status: "idle" };

export type DuplicateHint = {
  id: string;
  label: string;
  /** Pre-rendered on the server: the reasons come from the ranker and the
   * phrasing must read the same here as it does on the resolution form. */
  why: string;
};

export function MergePanel({
  survivorId,
  survivorLabel,
  suggestions,
  members,
}: {
  survivorId: string;
  survivorLabel: string;
  /** Ranked likely duplicates. Empty is a valid answer and says so. */
  suggestions: readonly DuplicateHint[];
  /** The full picker, for the officer who knows better than the ranker. */
  members: readonly MemberOption[];
}) {
  const [loserId, setLoserId] = useState("");
  const [confirming, setConfirming] = useState(false);

  const [preview, previewAction, previewing] = useActionState(
    previewMerge,
    PREVIEW_INITIAL
  );
  const [commit, commitAction, committing] = useActionState(
    commitMerge,
    COMMIT_INITIAL
  );

  // Drop out of the confirm step whenever the action speaks — render-phase
  // derived state rather than an effect, the idiom this codebase uses in
  // grant-form.tsx and preset-bar.tsx. useActionState has no reset, so a plain
  // effect would fight the officer on their second merge.
  const [seen, setSeen] = useState(commit);
  if (commit !== seen) {
    setSeen(commit);
    setConfirming(false);
  }

  const done = commit.status === "done";
  // The picker excludes this member: `planMerge` refuses a self-merge, but an
  // option that can only ever produce an error is not worth offering.
  const options = members.filter((member) => member.id !== survivorId);

  return (
    <section className="mt-12 max-w-3xl">
      <details className="border border-misa-border bg-misa-panel/40">
        <summary className="cursor-pointer px-4 py-2 text-sm font-medium">
          Merge a duplicate into this member
        </summary>

        <div className="border-t border-misa-border px-4 pt-3 pb-4">
          <p className="mb-4 max-w-2xl text-xs text-misa-secondary">
            Moves another member&apos;s check-ins, points and dues payments onto
            this one, then{" "}
            <span className="font-medium">deletes the other member row</span>.
            Nothing is saved until you confirm.
          </p>

          {done ? (
            <p className="text-sm font-medium">
              Merged. {commit.counts.attendanceMoved} check-in
              {commit.counts.attendanceMoved === 1 ? "" : "s"},{" "}
              {commit.counts.adjustments} adjustment
              {commit.counts.adjustments === 1 ? "" : "s"} and{" "}
              {commit.counts.payments} payment
              {commit.counts.payments === 1 ? "" : "s"} moved here
              {commit.counts.attendanceRejected > 0 &&
                `, ${commit.counts.attendanceRejected} duplicate check-in${
                  commit.counts.attendanceRejected === 1 ? "" : "s"
                } rejected`}
              .
            </p>
          ) : (
            <>
              {suggestions.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-wider text-misa-muted">
                    Possible duplicates
                  </p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {suggestions.map((hint) => (
                      <li key={hint.id}>
                        <button
                          type="button"
                          onClick={() => setLoserId(hint.id)}
                          className={`w-full border px-3 py-2 text-left text-sm transition ${
                            loserId === hint.id
                              ? "border-black bg-misa-blue text-white"
                              : "border-misa-border hover:bg-misa-panel"
                          }`}
                        >
                          {hint.label}
                          <span
                            className={`ml-2 text-xs ${
                              loserId === hint.id
                                ? "text-white/70"
                                : "text-misa-muted"
                            }`}
                          >
                            {hint.why}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 🐛 The picker sits OUTSIDE the form, and the id is posted as a
                  hidden input instead. React 19 resets a `<form action={…}>`
                  once the action resolves, and `form.reset()` snaps a `<select>`
                  back to its first option — React does not re-render, because
                  its own state never changed, so the box read "Choose a
                  member…" above a preview for a specific member until the next
                  interaction healed it. Found in the phase-8 walkthrough.
                  Keeping the control out of the form is the fix that cannot
                  regress: a reset has nothing to reach. */}
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  Member to merge in
                  <select
                    value={loserId}
                    onChange={(e) => setLoserId(e.target.value)}
                    className={controlClass("sm", "max-w-[24rem]")}
                  >
                    <option value="">Choose a member…</option>
                    {options.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.label}
                      </option>
                    ))}
                  </select>
                </label>
                <form action={previewAction}>
                  <input type="hidden" name="survivorId" value={survivorId} readOnly />
                  <input type="hidden" name="loserId" value={loserId} readOnly />
                  <button
                    type="submit"
                    disabled={previewing || loserId === ""}
                    className={BUTTON_QUIET_SM}
                  >
                    {previewing ? "Checking…" : "Preview merge"}
                  </button>
                </form>
              </div>

              {suggestions.length === 0 && (
                <p className="mt-3 text-xs text-misa-muted">
                  Nothing on the roster looks like a duplicate of this member.
                  Pick one above if you know otherwise.
                </p>
              )}

              <Problem state={preview} />
              <Problem state={commit} />

              {preview.status === "ready" && (
                <Preview
                  preview={preview}
                  survivorLabel={survivorLabel}
                  confirming={confirming}
                  committing={committing}
                  onConfirm={() => setConfirming(true)}
                  onCancel={() => setConfirming(false)}
                  action={commitAction}
                />
              )}
            </>
          )}
        </div>
      </details>
    </section>
  );
}

function Preview({
  preview,
  survivorLabel,
  confirming,
  committing,
  onConfirm,
  onCancel,
  action,
}: {
  preview: Extract<PreviewState, { status: "ready" }>;
  survivorLabel: string;
  confirming: boolean;
  committing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  action: (formData: FormData) => void;
}) {
  const { counts, collisions, conflicts } = preview;

  return (
    <form action={action} className="mt-5 border border-misa-border px-4 py-4">
      <input type="hidden" name="survivorId" value={preview.survivor.id} readOnly />
      <input type="hidden" name="loserId" value={preview.loser.id} readOnly />
      {/* The survivor's compare-and-set anchor, as the raw PostgREST string —
          this page's editor writes the same row. */}
      <input
        type="hidden"
        name="expectedUpdatedAt"
        value={preview.survivor.updatedAt}
        readOnly
      />

      <h3 className="font-display text-[18px] leading-[1.1] font-semibold">
        Merge {preview.loser.label} into {survivorLabel}
      </h3>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <Stat label="Check-ins moved" value={counts.attendanceMoved} />
        <Stat label="Rejected as duplicate" value={counts.attendanceRejected} />
        <Stat label="Adjustments" value={counts.adjustments} />
        <Stat label="Payments" value={counts.payments} />
      </dl>

      {collisions.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium">
            Both members attended {collisions.length}{" "}
            {collisions.length === 1 ? "event" : "events"}
          </p>
          {/* 🔓 Why this matters, said out loud: the database cannot catch this
              one, so an unresolved collision would credit the survivor twice for
              a single event. */}
          <p className="mt-1 text-xs text-misa-secondary">
            The duplicate&apos;s check-in is rejected so the event is only
            counted once. This member keeps theirs.
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {collisions.map((row) => (
              <li key={row.id} className="text-misa-body">
                {row.eventLabel}
              </li>
            ))}
          </ul>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium">
            {conflicts.length} field{conflicts.length === 1 ? "" : "s"} disagree
            {conflicts.length === 1 ? "s" : ""}
          </p>
          <div className="mt-2 flex flex-col gap-3">
            {conflicts.map((field) => (
              <fieldset key={field.key}>
                <legend className="text-sm">{field.label}</legend>
                <div className="mt-1 flex flex-wrap gap-4 text-sm">
                  {/* Defaults to the survivor's value: the safe direction,
                      because choosing it changes nothing. */}
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`field:${field.key}`}
                      value={field.survivorValue ?? ""}
                      defaultChecked
                    />
                    {field.survivorValue} <span className="text-misa-muted">(keep)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`field:${field.key}`}
                      value={field.loserValue ?? ""}
                    />
                    {field.loserValue}{" "}
                    <span className="text-misa-muted">(from the duplicate)</span>
                  </label>
                </div>
              </fieldset>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-sm">
        <span className="font-medium">{preview.loser.label} will be deleted.</span>{" "}
        This cannot be undone.
      </p>

      {confirming ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Merge and delete the duplicate?</span>
          <button
            type="submit"
            disabled={committing}
            className={BUTTON_PRIMARY_SM}
          >
            {committing ? "Merging…" : "Yes, merge"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-2 py-1 text-xs underline underline-offset-4"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onConfirm}
          className={`mt-4 ${BUTTON_QUIET_SM}`}
        >
          Merge
        </button>
      )}
    </form>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-misa-muted">
        {label}
      </dt>
      <dd className="text-xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function Problem({ state }: { state: PreviewState | CommitState }) {
  const message =
    state.status === "unauthorized"
      ? "Your session expired. Sign in again."
      : state.status === "not_found"
        ? "One of those members no longer exists. Reload and try again."
        : state.status === "same_member"
          ? "That is this member. Pick a different one."
          : state.status === "conflict"
            ? "Someone edited this member while you were looking. The duplicate's records have been moved here — reload and merge again to finish."
            : state.status === "incomplete"
              ? `The duplicate still holds ${state.remaining}, so it was not deleted. Nothing was lost; reload and merge again.`
              : state.status === "error"
                ? "Something went wrong. Nothing was deleted."
                : null;

  if (message === null) return null;
  return (
    <p
      role="alert"
      className="mt-3 border border-misa-blue/35 bg-misa-panel px-4 py-3 text-sm"
    >
      {message}
    </p>
  );
}

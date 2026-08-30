"use client";

import { Banner } from "@/components/ui/banner";

import { BUTTON_PRIMARY_SM } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";

import { useActionState, useState } from "react";

import {
  savePayment,
  type PaymentSaveState,
  type SubmittedPaymentValues,
} from "@/app/actions/dues";
import { MAX_TERMS_COVERED } from "@/lib/dues";
import type { MemberOption } from "@/lib/member-options";

// The one correction form on a payment (§7 Stage 6.5 phase 3): who it credits,
// which term it starts covering, and how many terms it bought.
//
// ⚠️ **One form, because the row owns one compare-and-set token.** The spec doc
// named `assignPayment` and `setPaymentTerms` as separate actions; two forms on
// this page would each hold their own copy of `updated_at`, so the first save
// would move it and strand the second — the officer's next edit reporting a
// phantom conflict, and their third, until a revalidation landed. That is the
// defect directory-row.tsx exists to prevent, and the remedy is the same: this
// component owns the token, seeds it from the prop, resyncs when the server
// sends a newer one, and adopts the fresh one each save returns.
//
// ⚠️ Client Component, so nothing here may call Intl or toLocale* — Node and
// Chrome ship different ICU data and the hydration diff shows two apparently
// identical strings. Every date and amount on this page arrives pre-formatted.

const initial: PaymentSaveState = { status: "idle" };

const selectClass = controlClass("sm");

export function PaymentEditor({
  id,
  updatedAt,
  members,
  memberId,
  startTerm,
  termsCovered,
  termOptions,
  derivedTerm,
}: {
  id: string;
  /** The row's CAS token, as the raw PostgREST string. */
  updatedAt: string;
  members: MemberOption[];
  memberId: string | null;
  startTerm: string;
  termsCovered: number | null;
  /** Derived from the payment date server-side — never a typed term (§4.7). */
  termOptions: string[];
  /** Which of those the payment date implies, so the officer can see what they
   * are overriding when they correct a summer payment. */
  derivedTerm: string;
}) {
  const [state, formAction, pending] = useActionState(savePayment, initial);

  const [token, setToken] = useState(updatedAt);

  // Resync from the server — our own revalidation, or another officer's save
  // arriving on a refresh. Reset-during-render, matching directory-row.tsx.
  const [seenProp, setSeenProp] = useState(updatedAt);
  if (seenProp !== updatedAt) {
    setSeenProp(updatedAt);
    setToken(updatedAt);
  }

  // Adopt the token the save just returned, so a second edit does not report a
  // conflict against a value this officer moved themselves.
  const [seenSave, setSeenSave] = useState<string | null>(null);
  if (state.status === "done" && state.updatedAt !== seenSave) {
    setSeenSave(state.updatedAt);
    setToken(state.updatedAt);
  }

  // ⚠️ **Controlled, not defaultValue**, and this is not a preference —
  // member-field-cell.tsx records the same rule and phase 3's walkthrough
  // rediscovered why. React 19 resets an uncontrolled `<form action>` once the
  // action resolves, and the reset beat the revalidated props: after assigning a
  // member the dropdown snapped back to "Nobody yet" while the database held the
  // new value. The officer reads that as a failed save, and the obvious next
  // move — press SAVE again — would post the empty option and genuinely unassign
  // the member they had just credited.
  //
  // Seeded from what the action echoed when it has spoken, which is what a
  // PRE-HYDRATION round trip renders (no JS, so the component mounts fresh with
  // the action's result and the officer's picks live only in that echo);
  // otherwise from the server's row.
  const serverValues: SubmittedPaymentValues = {
    memberId: memberId ?? "",
    startTerm,
    termsCovered: termsCovered === null ? "" : String(termsCovered),
  };

  const [values, setValues] = useState<SubmittedPaymentValues>(() =>
    "values" in state ? state.values : serverValues
  );

  // Resync when the server sends a different row — our own revalidation, or
  // another officer's save arriving on a refresh. Reset-during-render rather
  // than an effect, matching member-field-cell.tsx. A failed save leaves the
  // props untouched, so the officer's picks survive it without an echo.
  const [seenServer, setSeenServer] = useState(serverValues);
  if (
    seenServer.memberId !== serverValues.memberId ||
    seenServer.startTerm !== serverValues.startTerm ||
    seenServer.termsCovered !== serverValues.termsCovered
  ) {
    setSeenServer(serverValues);
    setValues(serverValues);
  }

  const set = (patch: Partial<SubmittedPaymentValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  const fieldErrors = state.status === "invalid" ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="max-w-xl border border-misa-border bg-white px-4 py-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="expectedUpdatedAt" value={token} />

      <StatusBanner state={state} />

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-misa-muted">Credit this payment to</span>
          <select
            name="memberId"
            value={values.memberId}
            onChange={(e) => set({ memberId: e.target.value })}
            className={selectClass}
          >
            {/* Clearing the member is legitimate and has to be reachable: a
                payer who wrote someone else's EID credits the wrong person, and
                the correction is to unlink it and put it back in the queue. */}
            <option value="">Nobody yet — leave it in the queue</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.label}
              </option>
            ))}
          </select>
          <FieldError messages={fieldErrors?.memberId} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-misa-muted">Starts covering</span>
          <select
            name="startTerm"
            value={values.startTerm}
            onChange={(e) => set({ startTerm: e.target.value })}
            className={selectClass}
          >
            {termOptions.map((term) => (
              <option key={term} value={term}>
                {term}
                {term === derivedTerm ? " — from the payment date" : ""}
              </option>
            ))}
          </select>
          <FieldError messages={fieldErrors?.startTerm} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-misa-muted">Terms bought</span>
          <select
            name="termsCovered"
            value={values.termsCovered}
            onChange={(e) => set({ termsCovered: e.target.value })}
            className={selectClass}
          >
            {/* Null is not an empty state to be tidied away — it IS the review
                axis (migration 19). A payment waiting on this decision covers
                nothing, so the member reads Not Paid until an officer chooses,
                which under-reports membership visibly rather than
                over-reporting it invisibly. */}
            <option value="">Undecided — leave it in the queue</option>
            {Array.from({ length: MAX_TERMS_COVERED }, (_, i) => i + 1).map(
              (n) => (
                <option key={n} value={n}>
                  {n} term{n === 1 ? "" : "s"}
                </option>
              )
            )}
          </select>
          <FieldError messages={fieldErrors?.termsCovered} />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className={`mt-5 ${BUTTON_PRIMARY_SM}`}
      >
        {pending ? "SAVING…" : "SAVE"}
      </button>
    </form>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return <span className="text-xs text-misa-caution">{messages[0]}</span>;
}

function StatusBanner({ state }: { state: PaymentSaveState }) {
  if (state.status === "idle" || state.status === "invalid") return null;

  const message =
    state.status === "done"
      ? "Saved. The directory reflects this immediately."
      : state.status === "conflict"
        ? "Someone else changed this payment while you had it open — reload to see their version before saving over it."
        : state.status === "voided"
          ? "This payment was voided while you had it open. A voided payment can't be edited; reload to see who voided it and why."
          : state.status === "stale_member"
            ? "That member no longer exists. Reload and pick again."
            : state.status === "not_found"
              ? "This payment no longer exists."
              : state.status === "unauthorized"
                ? "Your session has expired. Sign in again."
                : "Something went wrong and nothing was saved. Try again.";

  return (
    <Banner
      tone={state.status === "done" ? "affirm" : "caution"}
      role="status"
      className="mb-4"
    >
      {message}
    </Banner>
  );
}

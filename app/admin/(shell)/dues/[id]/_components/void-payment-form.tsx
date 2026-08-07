"use client";

import { useActionState } from "react";

import { voidPayment, type PaymentVoidState } from "@/app/actions/dues";

// Voiding a payment (§4.1). The row stays in the ledger, struck through —
// money arriving is a fact, and a receipt for it exists somewhere outside this
// system. A refund is recorded this way rather than as a negative payment.
//
// The reason is required, as it is for a point adjustment and for the same
// argument: this moves someone's membership status without their doing
// anything, and the ledger is where they find out why.

const initial: PaymentVoidState = { status: "idle" };

export function VoidPaymentForm({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(voidPayment, initial);

  // Echoed back so React 19's post-action reset doesn't wipe a reason the
  // officer is about to correct.
  const value = state.status === "invalid" ? state.value : "";
  const error =
    state.status === "invalid" ? state.fieldErrors.voidReason : undefined;

  return (
    <form action={formAction} className="max-w-xl">
      <input type="hidden" name="id" value={id} />

      <Banner state={state} />

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-foreground/60">Why is this being voided?</span>
        <textarea
          name="voidReason"
          defaultValue={value}
          rows={3}
          className="w-full border border-black/70 bg-white px-3 py-2 text-sm"
        />
        {error && error.length > 0 && (
          <span className="text-xs text-amber-800">{error[0]}</span>
        )}
      </label>

      <p className="mt-3 text-sm text-foreground/70">
        Voiding takes effect immediately and retroactively: dues status is
        calculated from live payments, so this member stops counting as official
        for every term this payment covered. It is not a delete — the row stays
        here with this reason and your name against it — and it cannot be undone.
        Re-importing the statement will not bring it back.
      </p>

      <button
        type="submit"
        disabled={pending || state.status === "done"}
        className="mt-4 rounded-full border border-black/70 px-6 py-2 text-xs font-medium tracking-wider transition hover:bg-misa-panel disabled:opacity-40"
      >
        {pending ? "VOIDING…" : "VOID THIS PAYMENT"}
      </button>
    </form>
  );
}

function Banner({ state }: { state: PaymentVoidState }) {
  if (state.status === "idle" || state.status === "invalid") return null;

  const message =
    state.status === "done"
      ? "Voided. This payment no longer counts towards membership."
      : state.status === "already_voided"
        ? "Someone else voided this while you had the page open — reload to see who and why."
        : state.status === "unauthorized"
          ? "Your session has expired. Sign in again."
          : "Something went wrong and nothing was voided. Try again.";

  return (
    <p
      role="status"
      className={`mb-4 border-l-4 px-4 py-3 text-sm ${
        state.status === "done"
          ? "border-misa-blue bg-misa-panel"
          : "border-amber-700 bg-misa-panel"
      }`}
    >
      {message}
    </p>
  );
}

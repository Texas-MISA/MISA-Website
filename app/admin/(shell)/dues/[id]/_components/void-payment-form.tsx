"use client";

import { Banner } from "@/components/ui/banner";

import { BUTTON_QUIET_SM } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";

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

      <StatusBanner state={state} />

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-misa-muted">Why is this being voided?</span>
        <textarea
          name="voidReason"
          defaultValue={value}
          rows={3}
          className={controlClass("sm", "w-full")}
        />
        {error && error.length > 0 && (
          <span className="text-xs text-misa-caution">{error[0]}</span>
        )}
      </label>

      <p className="mt-3 text-sm text-misa-secondary">
        Voiding takes effect immediately and retroactively: dues status is
        calculated from live payments, so this member stops counting as official
        for every term this payment covered. It is not a delete — the row stays
        here with this reason and your name against it — and it cannot be undone.
        Re-importing the statement will not bring it back.
      </p>

      <button
        type="submit"
        disabled={pending || state.status === "done"}
        className={`mt-4 ${BUTTON_QUIET_SM}`}
      >
        {pending ? "VOIDING…" : "VOID THIS PAYMENT"}
      </button>
    </form>
  );
}

function StatusBanner({ state }: { state: PaymentVoidState }) {
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
    <Banner
      tone={state.status === "done" ? "affirm" : "caution"}
      role="status"
      className="mb-4"
    >
      {message}
    </Banner>
  );
}

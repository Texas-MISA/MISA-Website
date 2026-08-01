"use client";

import { useActionState } from "react";

import { voidAdjustment, type VoidState } from "@/app/actions/points";

// Voiding (§4.2). The only thing that can ever be done to an adjustment after
// it is written — there is no edit form here and there is not meant to be one.
//
// The reason is required, unlike the resolution note on a reject: a void moves
// someone's points without their doing anything, and the ledger is where they
// find out why.

const initial: VoidState = { status: "idle" };

export function VoidForm({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(voidAdjustment, initial);

  // Echoed back so React 19's post-action reset doesn't wipe a reason the
  // officer is about to correct.
  const value = state.status === "invalid" ? state.value : "";
  const error = state.status === "invalid" ? state.fieldErrors.voidReason : undefined;

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
        Voiding stops these points counting immediately. It is not a delete —
        the row stays in the ledger, struck through, with this reason and your
        name against it — and it cannot be undone. To correct an amount, void
        this one and grant the right one.
      </p>

      <button
        type="submit"
        disabled={pending || state.status === "done"}
        className="mt-4 rounded-full border border-black/70 px-6 py-2 text-xs font-medium tracking-wider transition hover:bg-misa-panel disabled:opacity-40"
      >
        {pending ? "VOIDING…" : "VOID THIS ADJUSTMENT"}
      </button>
    </form>
  );
}

function Banner({ state }: { state: VoidState }) {
  if (state.status === "idle" || state.status === "invalid") return null;

  const message =
    state.status === "done"
      ? "Voided. These points no longer count."
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

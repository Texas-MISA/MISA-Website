"use client";

import { useActionState, useState } from "react";

import { createInvite, type InviteCreateState } from "@/app/actions/invites";

// The create-an-invite form and the one-time link it produces.
//
// 🔓 The link is rendered exactly once, here, from the action's result. Only its
// SHA-256 reached the database, so no re-render, no refresh and no query can
// produce it again — which is the property that makes the stored row safe, and
// the reason the copy below says so plainly rather than leaving an officer to
// discover it by refreshing.

const INITIAL: InviteCreateState = { status: "idle" };

const inputClass =
  "border border-black/70 bg-misa-panel px-3 py-2 text-base w-full";

const buttonClass =
  "rounded-full bg-misa-blue px-8 py-2.5 text-sm font-medium tracking-wider text-white transition hover:bg-misa-blue-dark disabled:opacity-60";

export function InviteCreateForm() {
  const [state, formAction, pending] = useActionState(createInvite, INITIAL);

  const fieldErrors = state.status === "invalid" ? state.fieldErrors : {};
  const submitted = state.status === "invalid" ? state.values : null;

  return (
    <div className="mt-4 space-y-4">
      {state.status === "created" ? (
        <InviteLink url={state.url} email={state.email} />
      ) : null}

      {state.status === "already_registered" ? (
        <p
          role="alert"
          className="border-l-4 border-amber-700 bg-misa-panel px-4 py-3 text-sm"
        >
          {state.email} already has an account, so there is nothing to create.{" "}
          {state.hasAccess
            ? "They already have officer access — they're in the list below."
            : "Give it access from “Accounts without access” below; they'll sign in with the password they already have."}
        </p>
      ) : null}

      {state.status === "unauthorized" ? (
        <p
          role="alert"
          className="border-l-4 border-red-800 bg-misa-panel px-4 py-3 text-sm"
        >
          Your session expired. Sign in again.
        </p>
      ) : null}

      {state.status === "error" ? (
        <p
          role="alert"
          className="border-l-4 border-red-800 bg-misa-panel px-4 py-3 text-sm"
        >
          Couldn&apos;t create the invitation. Nothing was sent. Try again, and
          check the invitation list below before retrying in case it went
          through.
        </p>
      ) : null}

      <form action={formAction} className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Their email{" "}
            <span className="font-normal text-foreground/60">(optional)</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            maxLength={254}
            autoComplete="off"
            // React 19 resets the form once the action resolves, so this is
            // driven from what the server echoed back. Always a string.
            defaultValue={submitted?.email ?? ""}
            className={`mt-1 ${inputClass}`}
            aria-describedby="email-help"
          />
          {/* 🔓 The officer is told what blank MEANS before they choose it. The
              two options are not equally safe and the screen should not pretend
              otherwise — a pinned address makes a forwarded link useless to
              anyone else, and an open one makes the link a bearer credential. */}
          <p id="email-help" className="mt-1 text-xs text-foreground/60">
            Leave blank and the link works for whoever opens it — useful when you
            don&apos;t know which address they&apos;ll use.{" "}
            <strong className="font-medium">
              Anyone who gets hold of an open link can use it,
            </strong>{" "}
            so send it directly. Fill it in and the link only creates that one
            account.
          </p>
          <FieldError messages={fieldErrors.email} />
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium">
            Access level
          </label>
          <select
            id="role"
            name="role"
            defaultValue={submitted?.role || "officer"}
            className={`mt-1 ${inputClass}`}
          >
            <option value="officer">Officer</option>
            <option value="admin">Admin</option>
          </select>
          <FieldError messages={fieldErrors.role} />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="displayName" className="block text-sm font-medium">
            Their name{" "}
            <span className="font-normal text-foreground/60">(optional)</span>
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            maxLength={120}
            defaultValue={submitted?.displayName ?? ""}
            className={`mt-1 ${inputClass}`}
            aria-describedby="displayName-help"
          />
          <p id="displayName-help" className="mt-1 text-xs text-foreground/60">
            A starting point they can change. Filling it in means the audit trail
            names them properly from their first action.
          </p>
          <FieldError messages={fieldErrors.displayName} />
        </div>

        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? "Creating…" : "Create invitation link"}
          </button>
          <p className="mt-2 text-xs text-foreground/60">
            Nothing is emailed — you&apos;ll get a link to send them yourself. It
            works once and expires in 72 hours.
          </p>
        </div>
      </form>
    </div>
  );
}

function InviteLink({ url, email }: { url: string; email: string | null }) {
  const [copied, setCopied] = useState(false);

  return (
    <div
      role="status"
      className="border-l-4 border-green-800 bg-misa-panel px-4 py-3"
    >
      <p className="text-sm font-medium">
        {email
          ? `Invitation ready for ${email}. Send them this link.`
          : "Open invitation ready. Send this link to one person."}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all border border-black/20 bg-white px-2 py-1 text-xs">
          {url}
        </code>
        <button
          type="button"
          onClick={() => {
            // Best-effort: the Clipboard API needs a secure context, and the
            // link is on screen and selectable either way, so a failure here is
            // not worth an error state.
            navigator.clipboard
              ?.writeText(url)
              .then(() => setCopied(true))
              .catch(() => setCopied(false));
          }}
          className="rounded-full border border-black/70 px-4 py-1.5 text-xs font-medium tracking-wider transition hover:bg-black/5"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-2 text-xs text-foreground/70">
        This is the only time it can be shown — only a fingerprint of it is
        stored, so nothing can display it again.{" "}
        {email
          ? "It only creates an account for that address."
          : "It creates an officer account for whoever opens it and whatever address they choose, so treat it like a password."}
      </p>
    </div>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return <p className="mt-1 text-sm text-red-800">{messages.join(" ")}</p>;
}

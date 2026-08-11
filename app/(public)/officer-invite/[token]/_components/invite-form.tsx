"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  acceptInvite,
  type AcceptInviteState,
} from "@/app/actions/officer-invite";

// Client Component for useActionState only, the same shape as
// app/(public)/lookup/_components/lookup-form.tsx. The form posts via
// <form action>, so it works before hydration.
//
// ⚠️ This file must not import lib/officer-invites.ts. That module pulls in
// node:crypto and is server-only.
//
// 📌 The fields carry no help text and no `minLength`, deliberately (requested
// 2026-08-10). Validation lives entirely in the schema, so the only length rule
// is the server's — there is no client-side floor here to drift away from it,
// which is the one good side effect of stripping the copy.

const INITIAL: AcceptInviteState = { status: "idle" };

const inputClass =
  "border border-black/70 bg-misa-panel px-3 py-3 text-base w-full";

const buttonClass =
  "rounded-full bg-misa-blue px-10 py-3 text-sm font-medium tracking-wider text-white transition hover:bg-misa-blue-dark disabled:opacity-60";

export function InviteForm({
  token,
  email,
  suggestedName,
}: {
  token: string;
  /** Null for an OPEN invite — the recipient supplies their own address. */
  email: string | null;
  suggestedName: string;
}) {
  const [state, formAction, pending] = useActionState(acceptInvite, INITIAL);

  // The account exists and holds access; only the automatic sign-in failed.
  // Nothing to retry here — sending them back through the form would hit an
  // invite that is already accepted.
  if (state.status === "created_sign_in_failed") {
    return (
      <div className="mt-8">
        <p
          role="alert"
          className="border-l-4 border-green-800 bg-misa-panel px-4 py-3 text-sm"
        >
          Your officer account is ready. We couldn&apos;t sign you in
          automatically, so use the password you just chose.
        </p>
        <p className="mt-6">
          <Link href="/admin/login" className={buttonClass}>
            Go to sign in
          </Link>
        </p>
      </div>
    );
  }

  // A real invite that stopped being usable between the page render and the
  // submit — revoked by an officer, or claimed by a second tab.
  if (state.status === "unusable" || state.status === "unknown") {
    return (
      <p
        role="alert"
        className="mt-8 border-l-4 border-amber-700 bg-misa-panel px-4 py-3 text-sm"
      >
        {state.status === "unusable"
          ? state.message
          : "This invitation link is not valid. Ask an officer for a new one."}
      </p>
    );
  }

  if (state.status === "already_registered") {
    return (
      <div className="mt-8">
        <p
          role="alert"
          className="border-l-4 border-amber-700 bg-misa-panel px-4 py-3 text-sm"
        >
          There is already an account for {state.email}, so this link can&apos;t
          create one. If it&apos;s yours, sign in — an officer can grant it
          access without a new invitation.
        </p>
        <p className="mt-6">
          <Link href="/admin/login" className={buttonClass}>
            Go to sign in
          </Link>
        </p>
      </div>
    );
  }

  const fieldErrors = state.status === "invalid" ? state.fieldErrors : {};

  return (
    <form action={formAction} className="mt-8 space-y-6">
      {/* The caller's entire authority. A hidden field rather than something
          read from the URL, because a Server Action never sees the page's
          location — and it is re-hashed and re-looked-up server-side regardless,
          so nothing here is trusted. */}
      <input type="hidden" name="token" value={token} />

      {/* Honeypot (§6), matching the other two unauthenticated forms. */}
      <div aria-hidden className="hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div>
        <label
          htmlFor={email === null ? "email" : undefined}
          className="block text-sm font-medium tracking-wide"
        >
          Your email
        </label>
        {email === null ? (
          <>
            {/* 🔓 An OPEN invite (migration 25): the officer did not pin an
                address, so whoever holds this link chooses one. A real input,
                and the server validates it and refuses an address that already
                has an account. */}
            <input
              id="email"
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              defaultValue={
                state.status === "invalid" ? state.submitted.email : ""
              }
              className={`mt-1 ${inputClass}`}
            />
            <FieldError messages={fieldErrors.email} />
          </>
        ) : (
          <>
            {/* 🔓 Text, not an input, and not a disabled input either — there is
                nothing to submit and nothing to tamper with. The address was
                pinned by whoever sent the invitation, and the account created is
                that address no matter what reaches the server. */}
            <p className="mt-1 text-base">{email}</p>
          </>
        )}
      </div>

      <div>
        <label
          htmlFor="displayName"
          className="block text-sm font-medium tracking-wide"
        >
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          maxLength={120}
          autoComplete="name"
          // React 19 resets an uncontrolled <form action> once the action
          // resolves, so this is driven from what the server echoed back. Always
          // a string — see the note in lookup-form.tsx.
          defaultValue={
            state.status === "invalid"
              ? state.submitted.displayName
              : suggestedName
          }
          className={`mt-1 ${inputClass}`}
        />
        <FieldError messages={fieldErrors.displayName} />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium tracking-wide"
        >
          Password
        </label>
        {/* No defaultValue on either password field, deliberately. React 19's
            post-action reset clears them, and that is the behaviour we want:
            echoing a password back would write a live credential into the page
            source. */}
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className={`mt-1 ${inputClass}`}
        />
        <FieldError messages={fieldErrors.password} />
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium tracking-wide"
        >
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          className={`mt-1 ${inputClass}`}
        />
        <FieldError messages={fieldErrors.confirmPassword} />
      </div>

      {state.status === "rate_limited" ? (
        <p
          role="alert"
          className="border-l-4 border-amber-700 bg-misa-panel px-4 py-3 text-sm"
        >
          Too many attempts from this network. Wait a few minutes and try again.
        </p>
      ) : null}

      {state.status === "error" ? (
        <p
          role="alert"
          className="border-l-4 border-red-800 bg-misa-panel px-4 py-3 text-sm"
        >
          Something went wrong setting up the account, and nothing was created.
          Try again — if it keeps happening, ask the officer who invited you for
          a fresh link.
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Setting up…" : "Create my account"}
      </button>
    </form>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p className="mt-1 text-sm text-red-800">
      {messages.join(" ")}
    </p>
  );
}

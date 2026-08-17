"use client";

import { useActionState } from "react";

import { signIn, type SignInState } from "@/app/actions/auth";
import { BUTTON_PRIMARY } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";

// Client Component for useActionState only — the form posts to the Server
// Action via <form action>, so it works before hydration too.

const INITIAL: SignInState = { status: "idle" };

const inputClass = controlClass("md", "w-full");

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signIn, INITIAL);

  const fieldErrors =
    state.status === "invalid" ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.status === "failed" && (
        <p
          role="alert"
          className="border border-misa-blue/35 bg-misa-panel px-4 py-3 text-sm"
        >
          That email and password don&apos;t match an officer account. Check
          both, or ask another officer to reset your access.
        </p>
      )}
      {state.status === "error" && (
        <p
          role="alert"
          className="border border-misa-blue/35 bg-misa-panel px-4 py-3 text-sm"
        >
          Something went wrong signing you in — please try again.
        </p>
      )}

      {next && <input type="hidden" name="next" value={next} />}

      <Field label="Email" error={fieldErrors?.email}>
        <input
          type="email"
          spellCheck={false}
          name="email"
          required
          autoComplete="username"
          inputMode="email"
          className={inputClass}
          aria-invalid={fieldErrors?.email ? true : undefined}
        />
      </Field>

      <Field label="Password" error={fieldErrors?.password}>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className={inputClass}
          aria-invalid={fieldErrors?.password ? true : undefined}
        />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className={`mt-1 w-full ${BUTTON_PRIMARY}`}
      >
        {pending ? "SIGNING IN…" : "SIGN IN"}
      </button>
    </form>
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
      {label}
      {children}
      {error && (
        <span role="alert" className="text-xs text-misa-critical">
          {error[0]}
        </span>
      )}
    </label>
  );
}

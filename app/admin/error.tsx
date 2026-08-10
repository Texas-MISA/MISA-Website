"use client";

import Link from "next/link";
import { useEffect } from "react";

// 🪤 The boundary for the ADMIN SHELL LAYOUT itself (Stage 8 phase 3), and the
// easy one to leave out.
//
// `error.js` never wraps the `layout.js` in its own segment — the docs state
// this in three separate places. So app/admin/(shell)/error.tsx cannot catch a
// throw inside AdminShellLayout, and that layout does real work: it awaits
// requireOfficer(), which reads the session and then queries admin_profiles
// with the service-role client. A Supabase hiccup there took down the whole
// admin section with the framework's default error page until this file
// existed.
//
// 📌 app/admin/ has no layout of its own, so this renders inside the ROOT
// layout — no admin nav, no officer chrome. That is correct and unavoidable:
// the shell is the thing that failed, so it cannot be part of its own fallback.
// Hence the explicit links out.

export default function AdminShellError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("admin shell error:", error);
  }, [error]);

  return (
    <main className="px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          The admin section couldn&apos;t load
        </h1>
        <p className="mt-4 text-foreground/80">
          This is the officer area failing to start up rather than one screen
          going wrong, so the usual navigation isn&apos;t available. Most often
          it means the database was briefly unreachable.
        </p>
        <p className="mt-3 text-sm text-foreground/70">
          Nothing has been changed. If retrying doesn&apos;t work, signing in
          again is the next thing to try.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-full bg-misa-blue px-6 py-2 text-xs font-medium tracking-wider text-white transition hover:bg-misa-blue-dark"
          >
            TRY AGAIN
          </button>
          <Link
            href="/admin/login"
            className="rounded-full border border-black/70 px-6 py-2 text-xs font-medium tracking-wider transition hover:bg-misa-panel"
          >
            SIGN IN AGAIN
          </Link>
          <Link
            href="/"
            className="rounded-full border border-black/70 px-6 py-2 text-xs font-medium tracking-wider transition hover:bg-misa-panel"
          >
            PUBLIC SITE
          </Link>
        </div>

        {error.digest && (
          <p className="mt-6 text-xs text-foreground/60">
            Reference: <code className="font-mono">{error.digest}</code>
          </p>
        )}
      </div>
    </main>
  );
}

"use client";

import { BUTTON_PRIMARY_SM, BUTTON_QUIET_SM } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

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
        <PageHeader title="The admin section couldn't load" />
        <p className="mt-4 text-misa-body">
          This is the officer area failing to start up rather than one screen
          going wrong, so the usual navigation isn&apos;t available. Most often
          it means the database was briefly unreachable.
        </p>
        <p className="mt-3 text-sm text-misa-secondary">
          Nothing has been changed. If retrying doesn&apos;t work, signing in
          again is the next thing to try.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className={BUTTON_PRIMARY_SM}
          >
            TRY AGAIN
          </button>
          <Link
            href="/admin/login"
            className={BUTTON_QUIET_SM}
          >
            SIGN IN AGAIN
          </Link>
          <Link
            href="/"
            className={BUTTON_QUIET_SM}
          >
            PUBLIC SITE
          </Link>
        </div>

        {/* Secondary, not muted — 4.33:1 vs 7.60:1 on the Vellum ground. */}
        {error.digest && (
          <p className="mt-6 text-xs text-misa-secondary">
            Reference: <code className="font-mono">{error.digest}</code>
          </p>
        )}
      </div>
    </main>
  );
}

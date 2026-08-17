"use client";

import Link from "next/link";
import { useEffect } from "react";

import { BUTTON_PRIMARY_SM, BUTTON_QUIET_SM } from "@/components/ui/button";

// The root-segment boundary (Stage 8 phase 3).
//
// 📌 Its real job is /admin/login. That route sits outside the (shell) group —
// deliberately, since the shell layout calls requireOfficer() and signing in
// would otherwise be impossible — which also means it has no layout and no
// nearer boundary. Without this file, a throw on the login page goes straight
// to global-error, i.e. the unstyled full-document fallback, for what is
// usually a transient Auth hiccup.
//
// It also backstops anything under app/ that adds a segment later without
// remembering to add a boundary.

export default function RootError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("root segment error:", error);
  }, [error]);

  return (
    <main className="px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-[30px] leading-[1.02] font-semibold tracking-[-0.015em] sm:text-[34px]">
          Something went wrong
        </h1>
        <p className="mt-4 text-misa-body">
          This page failed to load. Nothing you were doing has been changed.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className={BUTTON_PRIMARY_SM}
          >
            Try again
          </button>
          <Link href="/" className={BUTTON_QUIET_SM}>
            Home
          </Link>
        </div>
        {error.digest && (
          <p className="mt-6 text-xs text-misa-muted">
            Reference: <code className="font-mono">{error.digest}</code>
          </p>
        )}
      </div>
    </main>
  );
}

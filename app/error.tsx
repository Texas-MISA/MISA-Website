"use client";

import Link from "next/link";
import { useEffect } from "react";

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
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          Something went wrong
        </h1>
        <p className="mt-4 text-foreground/80">
          This page failed to load. Nothing you were doing has been changed.
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
            href="/"
            className="rounded-full border border-black/70 px-6 py-2 text-xs font-medium tracking-wider transition hover:bg-misa-panel"
          >
            HOME
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

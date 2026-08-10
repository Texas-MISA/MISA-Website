"use client";

import Link from "next/link";
import { useEffect } from "react";

// The admin segment error boundary (Stage 8 phase 3). Catches a throw in any
// admin page or nested layout and renders INSIDE the shell, so the nav survives
// and the officer can go somewhere else without using the back button.
//
// ⚠️ It does NOT catch a throw in app/admin/(shell)/layout.tsx. `error.js` wraps
// loading.js, not-found.js, page.js and nested layouts — but never the
// layout.js in its OWN segment. The shell layout awaits requireOfficer(), which
// is a Supabase call and can therefore fail, and the only boundary above it is
// app/admin/error.tsx. Both files exist for that reason; deleting either leaves
// a real hole.
//
// ⚠️ Render errors only. Event handlers and post-render async work are not
// caught by any error boundary — those still need their own try/catch.

export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  // 📌 `unstable_retry`, not `reset` (Next 16.2). Both are passed at runtime,
  // but `reset()` only clears the error state and re-renders WITHOUT
  // re-fetching, so it cannot recover a Server Component failure — which is
  // every failure this boundary will actually see. The prefix is worth the
  // working button; a rename is a one-line fix.
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("admin segment error:", error);
  }, [error]);

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
        Something went wrong
      </h1>
      <p className="mt-4 text-foreground/80">
        This screen failed to load. Nothing has been changed — this is a read
        failing, not an action half-finishing.
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
          href="/admin"
          className="rounded-full border border-black/70 px-6 py-2 text-xs font-medium tracking-wider transition hover:bg-misa-panel"
        >
          BACK TO THE DASHBOARD
        </Link>
      </div>

      {/* 🔓 The digest is the only actionable thing here, and it has to be on
          screen. In production a Server Component's error message is replaced
          by a generic one before it reaches the client, deliberately — the
          digest is the hash that matches it to the server log. Without it an
          officer can only report "it broke". */}
      {error.digest && (
        <p className="mt-6 text-xs text-foreground/60">
          Reference: <code className="font-mono">{error.digest}</code> — quote
          this if you report it.
        </p>
      )}
    </div>
  );
}

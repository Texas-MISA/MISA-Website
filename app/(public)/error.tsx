"use client";

import Link from "next/link";
import { useEffect } from "react";

// The public-site boundary (Stage 8 phase 3). Renders inside (public)/layout.tsx,
// so the header and footer survive and a visitor can keep browsing.
//
// 📌 A backstop rather than the primary path. The three public pages that query
// — the landing page's schedule, /leaderboard and /lookup — already handle their
// own read failures inline and say so on screen. This catches what they cannot:
// a render-time throw.

export default function PublicError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("public segment error:", error);
  }, [error]);

  return (
    <section className="px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          Something went wrong
        </h1>
        <p className="mt-4 text-foreground/80">
          This page didn&apos;t load. It&apos;s not something you did — try
          again in a moment.
        </p>
        <p className="mt-3 text-sm text-foreground/70">
          If you were checking in to an event, tell an officer at the door
          rather than waiting: they can add you by hand, and your attendance
          will not be lost.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-full bg-misa-blue px-8 py-3 text-sm font-medium tracking-wider text-white transition hover:bg-misa-blue-dark"
          >
            TRY AGAIN
          </button>
          <Link
            href="/"
            className="rounded-full border border-black/70 px-8 py-3 text-sm font-medium tracking-wider transition hover:bg-misa-panel"
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
    </section>
  );
}

"use client";

import Link from "next/link";
import { useEffect } from "react";

import { BUTTON_OUTLINE_NAVY, BUTTON_SOLID_NAVY } from "@/components/ui/button";
import { Section } from "@/components/ui/section";

// The public-site boundary (Stage 8 phase 3, restyled in v2 phase 2). Renders
// inside (public)/layout.tsx, so the header and footer survive and a visitor
// can keep browsing.
//
// 📌 A backstop rather than the primary path. The three public pages that query
// — the landing page's schedule, /leaderboard and /lookup — already handle their
// own read failures inline and say so on screen. This catches what they cannot:
// a render-time throw.
//
// 🪤 **`unstable_retry`, never `reset`** (Next 16.2). `reset()` cannot recover a
// Server Component error — it re-renders the client boundary against the same
// failed payload, so the error simply comes back and the button reads as broken.
//
// 📌 It renders `error.digest` because production replaces the message with a
// generic string; the digest is the only thing that ties what the visitor saw to
// a line in the server log.
//
// 🪤 `Section` is imported into a Client Component here, which is fine and worth
// knowing why: it is a plain function component with no hooks and no
// `"use client"` of its own, so it compiles into either graph. `reveal.tsx` is
// server-safe for the mirror-image reason.

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
    <Section pad="lg" width="narrow">
      <h1 className="font-display text-[34px] leading-[1.02] font-semibold tracking-[-0.02em] text-misa-blue sm:text-[42px]">
        Something went wrong
      </h1>
      <p className="mt-4 text-lg leading-[1.65] text-misa-body">
        This page didn&apos;t load. It&apos;s not something you did — try again
        in a moment.
      </p>
      {/* The one piece of copy on this page that is doing real work. A member
          standing in a doorway with a check-in that will not submit needs to be
          told to go to a human, not to keep pressing a button. */}
      <p className="mt-3 text-sm leading-[1.65] text-misa-secondary">
        If you were checking in to an event, tell an officer at the door rather
        than waiting: they can add you by hand, and your attendance will not be
        lost.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        {/* 📌 Sentence case in the source. `buttonClass` carries `uppercase`, so
            every label renders capitalised either way — this file and
            `app/error.tsx` disagreed in source only, which made them look like
            two decisions when they were one. */}
        <button
          type="button"
          onClick={() => unstable_retry()}
          className={BUTTON_SOLID_NAVY}
        >
          Try again
        </button>
        <Link href="/" className={BUTTON_OUTLINE_NAVY}>
          Home
        </Link>
      </div>
      {error.digest && (
        <p className="mt-7 text-xs text-misa-secondary">
          Reference: <code className="font-mono">{error.digest}</code>
        </p>
      )}
    </Section>
  );
}

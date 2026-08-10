"use client";

// ⚠️ This file REPLACES the root layout when active, so it must bring its own
// document and its own styling. Next's docs are explicit that global styles do
// not reach it — without this import it renders unstyled, which is the one
// screen where looking broken is least helpful.
import "./globals.css";

// The last boundary (Stage 8 phase 3). Nothing else can catch a throw in
// app/layout.tsx, because the root layout has no parent segment.
//
// Three constraints, all from the Next 16 docs and all easy to get wrong:
//
//   * It must define its own <html> and <body>. It is replacing the root
//     layout, so those tags do not exist otherwise.
//   * `metadata` / `generateMetadata` are NOT supported here — error boundaries
//     are Client Components. React's <title> is the documented substitute.
//   * Global styles and fonts do not carry over. The stylesheet is imported
//     above; the font VARIABLES are not, so this deliberately uses no
//     font-display class — it would silently fall back to a system serif and
//     look like a second bug.
//
// Kept plain on purpose. Anything clever here has a good chance of being the
// thing that throws.

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-black">
        <title>Something went wrong — TEXAS MISA</title>
        <main style={{ margin: "0 auto", maxWidth: "36rem", padding: "4rem 1.5rem" }}>
          <h1 className="text-3xl font-extrabold">Something went wrong</h1>
          <p className="mt-4 leading-7">
            The site failed to load. This is not something you did, and nothing
            you were working on has been changed.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="border-2 border-black px-4 py-2 text-xs font-semibold tracking-wider uppercase"
            >
              Try again
            </button>
            {/* A plain anchor, not next/link, and the lint rule is wrong here:
                this boundary catches a ROOT LAYOUT failure, so the app shell —
                including the router this page would otherwise navigate with —
                is the thing that broke. A full document load is the only
                reliable escape. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="border-2 border-black px-4 py-2 text-xs font-semibold tracking-wider uppercase"
            >
              Home
            </a>
          </div>

          {error.digest && (
            <p className="mt-6 text-xs">
              Reference: <code>{error.digest}</code>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}

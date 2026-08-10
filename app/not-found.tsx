import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

// The app-wide 404: every URL that matches no route at all.
//
// 🪤 This is NOT the same file as app/(public)/not-found.tsx, and adding only
// that one was a real gap — caught on the deployed site rather than locally.
// `(public)` is a route GROUP, so it does not appear in the URL and therefore
// does not participate in matching: an unmatched address belongs to no segment,
// falls all the way to the root, and got Next's built-in 404 with no header, no
// links and no way back. The (public) file only ever fired for a `notFound()`
// thrown by a page already inside that group.
//
// ⚠️ It renders inside app/layout.tsx, which carries the fonts and the
// stylesheet but NOT the site chrome — SiteHeader and SiteFooter live in
// app/(public)/layout.tsx. So this renders them itself. That duplication is the
// price of the root position; the alternative is a 404 that looks like a
// different website.

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-2xl">
            <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
              Page not found
            </h1>
            <p className="mt-4 text-foreground/80">
              That address doesn&apos;t exist. It may have moved, or the link
              that sent you here may be out of date.
            </p>
            <nav
              aria-label="Site sections"
              className="mt-8 flex flex-wrap gap-3"
            >
              {[
                ["/", "Home"],
                ["/about", "About Us"],
                ["/attend", "Check In"],
                ["/leaderboard", "Leaderboard"],
                ["/lookup", "My Attendance"],
                ["/contact", "Contact Us"],
              ].map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="border-2 border-black px-3 py-1 text-xs font-semibold tracking-wider uppercase transition hover:bg-misa-panel"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

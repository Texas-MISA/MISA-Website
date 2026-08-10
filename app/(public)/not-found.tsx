import Link from "next/link";

// The public 404 (Stage 8 phase 3). Renders inside (public)/layout.tsx, so the
// site header and footer stay — a visitor who mistypes a URL lands somewhere
// they can navigate from rather than on a bare framework page.
//
// 🪤 This file is NOT the one that catches a mistyped address, and assuming it
// was is a mistake worth recording — it survived local testing and was only
// caught against the deployed site. `(public)` is a route GROUP, so it does not
// appear in the URL and does not participate in matching: an unmatched address
// belongs to no segment and falls all the way to `app/not-found.tsx`. This file
// fires only for a `notFound()` thrown by a page already inside the group.
//
// Both exist. This one gets the chrome from (public)/layout.tsx; the root one
// renders SiteHeader and SiteFooter itself, because the root layout has neither.

export default function PublicNotFound() {
  return (
    <section className="px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-4 text-foreground/80">
          That address doesn&apos;t exist. It may have moved, or the link that
          sent you here may be out of date.
        </p>
        <nav aria-label="Site sections" className="mt-8 flex flex-wrap gap-3">
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
  );
}

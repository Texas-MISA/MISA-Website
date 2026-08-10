import Link from "next/link";

// The public 404 (Stage 8 phase 3). Renders inside (public)/layout.tsx, so the
// site header and footer stay — a visitor who mistypes a URL lands somewhere
// they can navigate from rather than on a bare framework page.
//
// 📌 The ROOT app/not-found.tsx would also handle unmatched URLs app-wide, but
// it renders inside the root layout only, without the site chrome. Putting this
// in (public) means every wrong URL under the public site keeps the nav.

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

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { InstagramIcon, LinkedInIcon, LinkIcon } from "@/components/ui/icons";
import { Wordmark } from "@/components/ui/wordmark";
import { SOCIAL_LINKS } from "@/lib/site";

// Client Component only because the active link is underlined by pathname and
// the mobile menu toggles — the pages themselves stay server-rendered.

// 🪤 The nav is SPLIT across the wordmark, and it is not a styling preference.
//
// The wordmark is absolutely centred (see below) so the two side groups cannot
// shift it off-centre, which means neither group may grow into the middle —
// nothing stops them, they just overlap, and the wordmark wins the z-order so
// the nav item is what disappears. Measured at a 1646px viewport: the six
// original items cleared the wordmark by 61px, and adding Leaderboard and
// My Attendance to the same row overflowed it by 199px, hiding "Leaderboard"
// behind the logo. Tightening the gap does not recover 199px; only fewer items
// on one side does.
//
// So the split is by audience, which is also how it reads: what the org is on
// the left, what's yours on the right beside the socials.
//
// ⚠️ Adding an item to either group means re-measuring at the xl breakpoint
// (1280) as well as at a wide viewport — the left group is the tight one there.

/** Public pages, left of the wordmark. */
const SITE_NAV = [
  { href: "/about", label: "About Us" },
  { href: "/gallery", label: "Gallery" },
  { href: "/officers", label: "Officers" },
  { href: "/projects", label: "Projects" },
  { href: "/contact", label: "Contact Us" },
  { href: "/attend", label: "Check In" },
] as const;

/**
 * Member-facing pages, right of the wordmark (Stage 7).
 *
 * Both carry `robots: { index: false, follow: false }` (§9 #1), so linking them
 * from the nav makes them crawlable but not indexable — which is exactly what
 * that meta tag is for. They belong in the nav rather than behind a link
 * somebody has to be told about: a member who cannot find them asks an officer,
 * and ending that is the whole point of the stage.
 */
const MEMBER_NAV = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/lookup", label: "My Attendance" },
] as const;

/** One list for the mobile panel, which stacks and has no wordmark to clear. */
const NAV = [...SITE_NAV, ...MEMBER_NAV];

const SOCIALS = [
  { href: SOCIAL_LINKS.instagram, label: "Instagram", Icon: InstagramIcon },
  { href: SOCIAL_LINKS.linktree, label: "Linktree", Icon: LinkIcon },
  { href: SOCIAL_LINKS.linkedin, label: "LinkedIn", Icon: LinkedInIcon },
  { href: SOCIAL_LINKS.slack, label: "Slack", Icon: LinkIcon },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b-2 border-black bg-misa-blue">
      <div className="relative mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Desktop nav, left. xl rather than lg: at 1024 even the six original
            items ran into the centred wordmark, which predates Stage 7 — the
            two new links only made an existing collision obvious. Below this
            width everything is in the mobile panel, where it stacks. */}
        <nav aria-label="Main" className="hidden xl:block">
          <ul className="flex items-center gap-8">
            {SITE_NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`text-sm text-black/90 transition hover:text-black ${
                      active ? "underline decoration-1 underline-offset-4" : ""
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Mobile menu toggle, left */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="xl:hidden -ml-1 flex h-10 w-10 items-center justify-center rounded text-black"
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="h-6 w-6"
            aria-hidden="true"
          >
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>

        {/* Centred wordmark, absolutely positioned so the nav and socials
            don't shift it off-centre. */}
        <Link
          href="/"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <Wordmark />
          <span className="sr-only">Home</span>
        </Link>

        {/* Member nav + socials, right */}
        <div className="flex items-center gap-6">
          <nav aria-label="Member" className="hidden xl:block">
            <ul className="flex items-center gap-8">
              {MEMBER_NAV.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`text-sm whitespace-nowrap text-black/90 transition hover:text-black ${
                        active ? "underline decoration-1 underline-offset-4" : ""
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <ul className="flex items-center gap-4 sm:gap-6">
            {SOCIALS.map(({ href, label, Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-black/85 transition hover:text-black"
                >
                  <Icon />
                  <span className="sr-only">{label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Mobile nav panel */}
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-t border-black/20 bg-misa-blue xl:hidden"
        >
          <ul className="mx-auto max-w-7xl px-4 py-2 sm:px-6">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`block py-3 text-black/90 ${
                      active ? "underline decoration-1 underline-offset-4" : ""
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}

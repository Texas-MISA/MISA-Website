"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { InstagramIcon, LinkedInIcon, LinkIcon } from "@/components/ui/icons";
import { Wordmark } from "@/components/ui/wordmark";
import { SOCIAL_LINKS } from "@/lib/site";

// Client Component only because the active link is underlined by pathname and
// the mobile menu toggles — the pages themselves stay server-rendered.

const NAV = [
  { href: "/about", label: "About Us" },
  { href: "/gallery", label: "Gallery" },
  { href: "/officers", label: "Officers" },
  { href: "/projects", label: "Projects" },
  { href: "/contact", label: "Contact Us" },
] as const;

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
        {/* Desktop nav, left */}
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-8">
            {NAV.map((item) => {
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
          className="lg:hidden -ml-1 flex h-10 w-10 items-center justify-center rounded text-black"
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

        {/* Socials, right */}
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

      {/* Mobile nav panel */}
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-t border-black/20 bg-misa-blue lg:hidden"
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

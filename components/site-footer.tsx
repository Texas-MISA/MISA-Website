import Link from "next/link";

import { CONTACT_EMAIL, SOCIAL_LINKS } from "@/lib/site";

// 📌 Officer sign-in is no longer here — it is the "Admin" item in the header
// nav (see components/site-header.tsx for why the nav has room for it now).
// The socials moved the other way, out of the header and into this row, which
// is what freed that room.

const LINKS = [
  { href: "/about", label: "About", external: false },
  { href: SOCIAL_LINKS.linkedin, label: "LinkedIn", external: true },
  { href: SOCIAL_LINKS.linktree, label: "LinkTree", external: true },
  { href: SOCIAL_LINKS.instagram, label: "Instagram", external: true },
  { href: SOCIAL_LINKS.slack, label: "Slack", external: true },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-misa-hairline px-5 py-11 sm:px-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <ul className="flex flex-wrap items-center gap-[22px] text-[13px] leading-none">
          {LINKS.map((link) => (
            <li key={link.label}>
              {link.external ? (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-misa-blue hover:text-misa-blue-dark"
                >
                  {link.label}
                </a>
              ) : (
                <Link href={link.href} className="text-misa-blue hover:text-misa-blue-dark">
                  {link.label}
                </Link>
              )}
            </li>
          ))}
        </ul>

        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-[13px] leading-none text-misa-muted hover:text-foreground"
        >
          {CONTACT_EMAIL}
        </a>
      </div>
    </footer>
  );
}

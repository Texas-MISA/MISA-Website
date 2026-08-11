import Link from "next/link";

import { CONTACT_EMAIL, SOCIAL_LINKS } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t-2 border-black bg-white py-16">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-6">
        <ul className="flex items-center gap-5 text-sm">
          <li>
            <Link
              href="/about"
              className="text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
            >
              About
            </Link>
          </li>
          <li>
            <a
              href={SOCIAL_LINKS.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
            >
              LinkedIn
            </a>
          </li>
          <li>
            <a
              href={SOCIAL_LINKS.linktree}
              target="_blank"
              rel="noopener noreferrer"
              className="text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
            >
              LinkTree
            </a>
          </li>
        </ul>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-sm text-foreground/80 hover:text-foreground"
        >
          {CONTACT_EMAIL}
        </a>

        {/* Officer sign-in, in the footer rather than the nav for two reasons.
            The first is the documented one: the header's wordmark is absolutely
            centred so the side groups cannot shift it, which means a group that
            grows underneath it loses an item behind the logo silently — six
            already collided at 1024 once, and adding a ninth link means
            re-measuring at 1280 and wide. The second is that this is not a
            member destination; it is where an officer goes, and the footer is
            where everyone looks for it.

            → /admin/login, NOT /admin. Both arrive in the same place — proxy.ts
            bounces a session-less /admin to the login page — but going straight
            there skips a redirect, and it is honest about the destination. An
            officer who already has a session is sent on to the dashboard by the
            same proxy, so this one href is right whether or not you are signed
            in. */}
        <Link
          href="/admin/login"
          className="text-xs text-foreground/60 underline underline-offset-4 hover:text-foreground"
        >
          Officer sign-in
        </Link>
      </div>
    </footer>
  );
}

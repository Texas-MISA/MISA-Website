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
      </div>
    </footer>
  );
}

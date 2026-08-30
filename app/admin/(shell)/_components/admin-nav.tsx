"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/actions/auth";
import { BUTTON_ON_NAVY_SM } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";
import { Pill } from "@/components/ui/pill";

// Persistent admin nav (§7 Stage 4). Client Component only for the active-link
// pathname, matching components/site-header.tsx — the pages stay server-
// rendered. Routes not yet built are listed but disabled, so the shape of the
// admin section is visible from the first day rather than appearing piecemeal.

const NAV = [
  { href: "/admin", label: "Dashboard", ready: true },
  { href: "/admin/events", label: "Events", ready: true },
  { href: "/admin/attendance", label: "Attendance", ready: true },
  { href: "/admin/members", label: "Members", ready: true },
  { href: "/admin/points", label: "Points", ready: true },
  // The ledger, since Stage 6.5 phase 3; it links on to the import. The active
  // check below is `startsWith`, so this stays underlined for every
  // /admin/dues/* path — which is what we want here, unlike the members/fields
  // case where a second entry would have lit two.
  { href: "/admin/dues", label: "Dues", ready: true },
  // Officer turnover (migration 24). Its own entry rather than a link from
  // somewhere: "who can get into this system" is not a sub-question of any
  // other screen, and an officer looking for it will look in the nav.
  { href: "/admin/officers", label: "Officers", ready: true },
  { href: "/admin/audit", label: "Audit", ready: false },
] as const;

export function AdminNav({
  displayName,
  role,
}: {
  displayName: string;
  role: "officer" | "admin";
}) {
  const pathname = usePathname();

  return (
    <header className="on-navy border-b border-misa-blue-dark bg-misa-blue text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
        <Link href="/admin" className="shrink-0">
          <Wordmark />
          <span className="sr-only">Admin dashboard</span>
        </Link>

        <nav aria-label="Admin" className="flex-1">
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {NAV.map((item) => {
              // /admin would otherwise match every child route.
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);

              if (!item.ready) {
                return (
                  <li key={item.href}>
                    {/* 🪤 A BUTTON, not a `<span>`: as a span an officer
                        tabbing the nav skipped it entirely, and nothing
                        announced that the item exists but is not built. It is
                        here precisely so the shape of the section is visible,
                        which only works if everyone can perceive it.

                        🐛 Three things had to be true for that to actually
                        hold, and only the first was:

                        1. It is a real element in the DOM. ✅
                        2. 🐛 It has to be REACHABLE. The `disabled` attribute
                           takes an element out of the tab order, so this was
                           still keyboard-invisible — the defect the paragraph
                           above claims to have fixed, surviving the fix.
                           `aria-disabled` announces the state and keeps focus;
                           the click handler is what makes it inert.
                        3. 🐛 It has to be LEGIBLE. `white/40` measured
                           **3.39:1** on the navy bar. WCAG exempts an inactive
                           control, but the exemption is beside the point when
                           the item's whole purpose is to be perceived.
                           `white/55` is the first ramp step that passes —
                           **5.05:1**, solved against the composited navy —
                           and still reads clearly quieter than the live items
                           at `white/85`.

                        🪤 The state is a real `<span>`, not `title`. A `title`
                        tooltip is mouse-only, which is the same failure in a
                        third costume. */}
                    <button
                      type="button"
                      aria-disabled="true"
                      onClick={(event) => event.preventDefault()}
                      className="cursor-not-allowed text-sm text-white/55"
                    >
                      {item.label}
                      <span className="sr-only"> — not built yet</span>
                    </button>
                  </li>
                );
              }

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`text-sm transition-colors duration-150 hover:text-white ${
                      active
                        ? "text-white underline decoration-1 underline-offset-4"
                        : "text-white/85"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-4">
          <span className="text-sm text-white/80">
            {displayName}
            {role === "admin" && (
              <Pill tone="onNavy" size="sm" className="ml-2">
                admin
              </Pill>
            )}
          </span>
          {/* A form POST, so signing out can't be triggered by a prefetch or by
              an image tag pointed at the URL, the way a GET link could. */}
          <form action={signOut}>
            <button type="submit" className={BUTTON_ON_NAVY_SM}>
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/actions/auth";
import { Wordmark } from "@/components/ui/wordmark";

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
    <header className="on-navy border-b-2 border-misa-blue-dark bg-misa-blue text-white">
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
                    <span
                      title="Not built yet"
                      className="cursor-not-allowed text-sm text-white/40"
                    >
                      {item.label}
                    </span>
                  </li>
                );
              }

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`text-sm text-white/85 transition hover:text-white ${
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

        <div className="flex items-center gap-4">
          <span className="text-sm text-white/80">
            {displayName}
            {role === "admin" && (
              <span className="ml-2 border border-white/40 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wider">
                admin
              </span>
            )}
          </span>
          {/* A form POST, so signing out can't be triggered by a prefetch or
              an <img> the way a GET link could. */}
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full border border-white/50 px-4 py-1.5 text-xs font-medium tracking-wider text-white/90 transition hover:bg-white/10"
            >
              SIGN OUT
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

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
  // Points at the import until Stage 6.5 phase 3 builds the ledger at
  // /admin/dues. The active check below is `startsWith`, so this stays
  // underlined for every /admin/dues/* path — which is what we want here,
  // unlike the members/fields case where a second entry would have lit two.
  { href: "/admin/dues/import", label: "Dues", ready: true },
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
    <header className="border-b-2 border-black bg-misa-blue">
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
                      className="cursor-not-allowed text-sm text-black/40"
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

        <div className="flex items-center gap-4">
          <span className="text-sm text-black/80">
            {displayName}
            {role === "admin" && (
              <span className="ml-2 border border-black/40 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wider">
                admin
              </span>
            )}
          </span>
          {/* A form POST, so signing out can't be triggered by a prefetch or
              an <img> the way a GET link could. */}
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full border border-black/50 px-4 py-1.5 text-xs font-medium tracking-wider text-black/90 transition hover:bg-black/10"
            >
              SIGN OUT
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

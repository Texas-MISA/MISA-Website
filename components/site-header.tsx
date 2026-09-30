"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { BUTTON_SOLID_NAVY_SM } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";

// Client Component only because the active link is derived from the pathname
// and the mobile menu toggles — the pages themselves stay server-rendered.

// 🪤 The wordmark is ABSOLUTELY CENTRED and wins the z-order, so a nav group
// that grows underneath it loses an item behind the logo silently rather than
// breaking the layout.
//
// The Stage 2 header carried eight links plus four social icons and had to be
// split across the wordmark to fit; measured then, six items on one side
// cleared it by 61px and eight overflowed by 199px. The redesign takes the
// pressure off from the other end: the socials move to the footer and Contact
// leaves the nav, so the left group is five short uppercase items and the
// right is two links and a button.
//
// ⚠️ That headroom is spent, not infinite. Adding an item to either group
// means re-measuring at the xl breakpoint (1280) as well as at a wide
// viewport, where the left group is the tight one.
//
// 🔓 **RE-MEASURED 2026-09-18**, after the member portal replaced everything
// right of the wordmark — Leaderboard, My Attendance and the Check In button —
// with ONE navy MEMBER PORTAL button. The pieces are viewport-independent at
// `xl` — left group 225px, right side 117px (was 272), wordmark 82px, 32px
// gutter — so the clearance at any width is arithmetic from those:
//
//   1280   342px left   450px right    ← 1280 is the tight width, and the
//   1450   427px left   535px right      LEFT is the tight side again
//   1646   525px left   633px right    (measured live: 518 / 626)
//
// 📌 The right gained 155px and the left did not move. **The left is the
// tighter side again** — it was the looser one after the 2026-08-23 measure
// (342 left / 295 right), when `/projects` left the nav and the wordmark grew
// from 48px to 82px, and the tighter one before that (285 / 312). Relisting
// `/projects` spends the left, so that is the side to re-measure first.
//
// 🪤 **Below `xl` the tight spot is the PHONE, not the desktop**: the button
// sits beside the centred wordmark on its own. See the note on the button.

/**
 * Public pages, left of the wordmark.
 *
 * ✂️ **`/projects` was UNLISTED on 2026-08-23 (officer, temporary).** The route
 * still exists and still renders; it is simply not linked from anywhere, and it
 * carries `robots: { index: false, follow: false }` so a crawler does not put it
 * back. Relisting it is this line, the `MOBILE_NAV` entry below, the `robots`
 * key in `app/(public)/projects/page.tsx`, and the "All projects →" link on the
 * home page's projects band — four places, all commented.
 *
 * 🪤 The nav is one item lighter than the 285/312px wordmark clearance was
 * measured against, so this direction is safe without re-measuring. Growing it
 * back to five is NOT: re-measure at 1280 before adding an item.
 */
const SITE_NAV = [
  { href: "/about", label: "About" },
  { href: "/gallery", label: "Gallery" },
  { href: "/officers", label: "Officers" },
  // 📌 Officer sign-in, in the nav as of the design overhaul. It goes to
  // /admin/login rather than /admin: both arrive in the same place, since
  // proxy.ts bounces a session-less /admin to the login page, but this skips a
  // redirect and is honest about the destination. An officer who already has a
  // session is sent on to the dashboard by the same proxy, so the one href is
  // right whether or not you are signed in.
  { href: "/admin/login", label: "Admin" },
] as const;

/**
 * The member portal's ONE way in from the site: the navy button right of the
 * wordmark, on every public page, reading MEMBER PORTAL (officer, 2026-09-18 —
 * "one blue button to the portal", labelled exactly that).
 *
 * 🔓 **Check-in lives ONLY inside the portal (officer, 2026-09-18).** The header
 * links none of /portal/attend, /portal/leaderboard or /portal/lookup directly;
 * members reach all three through the hub, and so does the 404 recovery nav.
 * The printed QR codes are unaffected — they point at /attend, which redirects
 * to /portal/attend, and that page is inside the portal.
 *
 * 📌 This replaced, in one day, two direct links (Leaderboard, My Attendance),
 * then a "Portal" text item, and the old navy Check In button. Stage 7's
 * argument for member links in the nav — a member who cannot find the tools
 * asks an officer — is answered by the button being on every page; the tools
 * are one click behind it.
 *
 * The hub, the leaderboard and the lookup carry `robots: { index: false,
 * follow: false }` (§9 #1), so linking them makes them crawlable but not
 * indexable — which is exactly what that meta tag is for. /portal/attend stays
 * indexable, as /attend always was.
 */
const PORTAL = { href: "/portal", label: "Member Portal" } as const;

/**
 * One list for the mobile panel, which stacks and has no wordmark to clear —
 * so it can carry Contact, which the desktop nav has no room for.
 *
 * 🐛 **This used to be `SITE_NAV.slice(0, 4)`, and unlisting `/projects` broke
 * it silently.** The slice meant "the site pages, without Admin" only because
 * Admin happened to sit at index 4; with one item gone it swept Admin in and
 * the panel rendered it twice — a duplicate React key on a list nobody looks at
 * on desktop. Dropping Admin BY HREF says what was meant and survives the next
 * edit to either list.
 *
 * 📌 `/projects` is unlisted here too. The mobile sheet is a nav like any other
 * and unlisting it in one place only would leave the page reachable from a
 * phone and not a laptop.
 */
const MOBILE_NAV = [
  ...SITE_NAV.filter((item) => item.href !== "/admin/login"),
  { href: "/contact", label: "Contact" },
  // Also the navy button in the bar above, which the sheet repeats the way it
  // used to repeat Check In: the sheet is the complete list.
  PORTAL,
  { href: "/admin/login", label: "Admin" },
] as const;

const NAV_ITEM =
  "font-display text-[13px] leading-none font-medium tracking-[0.06em] uppercase transition";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // The home page deliberately has no active item. An item is also current on
  // the pages BENEATH it, so the portal is current on every /portal/* page:
  // `aria-current="page"` on the exact match, `"true"` on the ancestor — "you
  // are in this section, not on this page", GOV.UK's service-navigation
  // convention. `${href}/`, never a bare prefix, so /officers can never claim
  // /officer-invite. The navy button carries the attribute but no visual state
  // of its own, as Check In never had one; the sheet's Member Portal item turns
  // navy like any other.
  //
  // The return type is spelled out because `aria-current` takes a union, and
  // inferred literals would widen to `string`.
  const current = (href: string): "page" | "true" | undefined =>
    pathname === href
      ? "page"
      : pathname.startsWith(`${href}/`)
        ? "true"
        : undefined;

  return (
    // `header-lift` adds the scroll-driven shadow — see globals.css. It needs
    // the element to be positioned, which `sticky` already makes it.
    <header className="header-lift sticky top-0 z-50 border-b border-misa-hairline bg-white">
      <div className="relative flex h-15 items-center justify-between gap-6 px-5 sm:px-8">
        {/* Desktop nav, left. xl rather than lg: below that width the centred
            wordmark and the two groups cannot coexist, so everything is in the
            sheet, where it stacks. */}
        <nav aria-label="Main" className="hidden xl:block">
          <ul className="flex items-center gap-[22px]">
            {SITE_NAV.map((item) => {
              const active = current(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active}
                    className={`${NAV_ITEM} ${
                      active
                        ? "border-b border-misa-blue pb-0.5 text-foreground"
                        : "text-misa-muted hover:text-foreground"
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
          className="-ml-1 flex h-10 w-10 items-center justify-center text-foreground xl:hidden"
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          {/* 🔓 Lucide, replacing a hand-rolled SVG. §9.E bans drawing icon
              paths from scratch when an icon library is available, and phase 0
              made Lucide this project's family — shadcn's own components are
              Lucide internally, and §3.C permits it "when the project already
              depends on it". `strokeWidth` is standardised at 1.5, which is
              what the hand-rolled glyph used. */}
          {open ? (
            <X className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
          )}
        </button>

        {/* Centred wordmark, absolutely positioned so neither side group can
            shift it off-centre. */}
        <Link
          href="/"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-misa-blue"
        >
          <Wordmark />
          <span className="sr-only">Home</span>
        </Link>

        {/* The member portal's one door, right — at every width, so a phone
            sees it without opening the sheet. Sentence case in the DOM (the
            skin uppercases it).

            🪤 **MEMBER PORTAL is ~40px wider than CHECK IN was, and on a phone
            it sits beside the CENTRED wordmark, which wins the z-order.** At
            the shared `sm` padding it measured 116.6px: 2.4px clear of the
            mark at a 360px viewport, 25px UNDER it at 320. So below `sm` it
            takes `px-3` (10px clear at 360, 18 at 375), and below 360px it
            stacks MEMBER over PORTAL at min-content width rather than slide
            under the logo. Re-measure before lengthening the label. */}
        <Link
          href={PORTAL.href}
          aria-current={current(PORTAL.href)}
          className={`${BUTTON_SOLID_NAVY_SM} whitespace-nowrap max-sm:px-3 max-[360px]:w-min max-[360px]:whitespace-normal max-[360px]:text-center max-[360px]:leading-[1.1]`}
        >
          Member portal
        </Link>
      </div>

      {/* Mobile nav panel */}
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-t border-misa-hairline bg-white xl:hidden"
        >
          <ul className="px-5 py-2 sm:px-8">
            {MOBILE_NAV.map((item) => {
              const active = current(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active}
                    className={`block py-3 ${NAV_ITEM} ${
                      active ? "text-misa-blue" : "text-foreground"
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

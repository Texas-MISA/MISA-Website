import type { Metadata } from "next";

import { PortalSheet } from "@/components/ui/portal-sheet";

import { CheckinForm } from "./_components/checkin-form";

// Public check-in (§7 Stage 3). Three fields, no account, phone-first —
// §1.2's target is a completed check-in in under 20 seconds. The page itself
// is static; all the work happens in the submitCheckin Server Action.
//
// REBUILT in v2 phase 3 (the Portal Rebuild), concept A "Fit the first screen",
// adopted by the officer 2026-09-19. Brief:
// .impeccable/surfaces/route-portal-attend.md
//
// 🔴 **THE NAVY BAND IS GONE (officer, 2026-09-20)** — "the navy header at the
// top of each page should be removed for all pages in the portal". The
// replacement the design step proposed and the officer adopted is *the sheet is
// the page*: this page is now one white `.sheet` lying on the grey ground, its
// title a masthead above a bleeding rule. See `components/ui/portal-sheet.tsx`
// for the whole argument; `PortalBand` is deleted, not orphaned.
//
// ── THE LAYOUT-FAMILY BUDGET ────────────────────────────────────────────────
//
//   1. Sheet ... The portal's one object: masthead, rule, tool
//
// ONE section, ONE family — down from two. A page that is a single object has
// no second family to spend. Eyebrow cap would be ceil(1 / 3) = 1; zero used.
//
// 🔓 **THE BAR IS A FOLD POSITION, AND IT WAS THE TIGHTEST NUMBER IN THE PHASE.**
// At 360×640, keyboard closed, scroll 0, 61px sticky header, IN THE IDLE STATE:
// the Check in button's bottom edge must sit at or above 640px. It was 668
// before the rebuild and 610.5 after it. Removing the band gives back most of
// another 131px, so the bar stops being tight — but it is still the bar, and it
// is still measured by hand, because `npm run test:ui` cannot see it
// (playwright.config.ts has one project at 1280×720).
//
// 🪤 **`ground="white"` is gone and the correctness control it carried has
// MOVED, not been dropped.** Every control in the form fills with
// `bg-misa-panel` (see `controlClass` in components/ui/field.tsx) — the same
// grey the public page ground became on 2026-08-19 — so on the page ground the
// inputs would be the colour of what is behind them. The white now comes from
// the `.sheet` the form sits inside, which is `background: var(--background)`,
// `#ffffff`. Same guarantee, supplied by the surface rather than by the
// section. 🔴 If the sheet ever stops being white, re-measure every grey in
// this form before shipping it: moving a page ground is a contrast change.
//
// 🪤 **Measure the SETTLED state, and measure the COMPUTED style.** Nothing on
// this page carries `data-reveal`, so these numbers reproduce on a first load.

export const metadata: Metadata = {
  title: "Check In",
  description: "Check in to a MISA event.",
};

export default function AttendPage() {
  return (
    // `measure="form"` rather than the default page measure: a label above a
    // field wants a narrower column than a list of rows does, and a three-field
    // form stretched to the page measure reads as a banner.
    //
    // No back link: the site header's MEMBER PORTAL button already links the
    // hub from every page, and on this one a duplicate cost 40px of a fold
    // budget. That matters here more than anywhere — the printed event QR codes
    // point at /attend, which 308s straight to this page, so for most members
    // at the door **this is the first screen they see**.
    <PortalSheet title="Event Check-In" measure="form">
      <CheckinForm />
    </PortalSheet>
  );
}

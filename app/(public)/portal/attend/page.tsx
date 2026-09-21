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
// before the rebuild and 610.5 at the 2026-09-19 gate.
//
// 🔴 **IT IS TWO NUMBERS, AND UNTIL THE 2026-09-20 RE-GATE NOTHING SAID WHICH.**
// The difference is not rounding — it is 20px, and it is a cliff:
//
//     layout width   content col   box row   Check in bottom
//     ≤ 347px            ≤ 273      104px       611.5   (label wraps to 2 lines)
//     ≥ 348px            ≥ 274       84px       591.5   (label on 1 line)
//
// A **true 360×640** — a phone, overlay scrollbars, 360 CSS px of layout — gives
// **591.5, with 48.5px of slack**. A **360px-wide DESKTOP window** gives 345–346
// px of layout once a classic 14–15px scrollbar is taken out, and there the
// checkbox's own label wraps to a second line: **611.5** headless, **607.66** in
// real Chrome, whose sub-pixel metrics run a few tenths under (header 60.57,
// inputs 49.14). **The bar as written is the phone case — 591.5 — and the
// conservative reading is 611.5. It is met under both, and both are recorded
// here so that nobody later "discovers" a 20px regression that is a scrollbar.**
//
// 🪤 **This cost the re-gate a wrong diagnosis, and that is the part worth
// keeping.** The lead measured 591.5 three ways — mobile-emulated, a "desktop"
// context, and with the `js` class stripped — got the same number each time, and
// wrote that the receipts' 607.7 "reproduces at no viewport", decomposing the
// 16.16px gap into `Title`'s `sm:text-[34px]` plus one 8px `sm:` step. The
// arithmetic worked and the diagnosis was numerology: **headless Chromium uses
// overlay scrollbars in every context**, so all three "independent" derivations
// held fixed the one variable that mattered. The `design-reviewer` reproduced
// 607.66 in real Chrome within the hour and named the real cause. **Three
// derivations that hold one variable fixed are one derivation.**
//
// The box-model chain for the phone reading, for anyone re-deriving it:
// `61 + 24 + 1 + 20 + 26.52 + 16 + 1 + 24 + 3 × (20 + 4 + 50) + 4 × 16 + 84 + 48
// = 591.52`. 🪤 **FOUR `gap-4` gaps, not three** — three between the fields,
// one before the box row, one before the button. The first draft of this line
// wrote `3 × 16`, an expression that reaches 575.52 under a total that is right;
// the re-gate's second critique assessment caught it.
//
// It is still measured by hand, because `npm run test:ui` cannot see it
// (playwright.config.ts has one project at 1280×720).
//
// 🔴 **Removing the band did NOT "give back most of another 131px", under
// either convention.** It is **+19px** at a true 360 (610.5 → 591.5) and about
// **zero** at a 346 layout (611 → 611.5). `PortalBand` was 131px of chrome, and
// the sheet's masthead, bleeding rule and margins spent essentially all of it.
// What the header removal bought was composition, not height — which is what the
// officer asked for.
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

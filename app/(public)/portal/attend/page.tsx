import type { Metadata } from "next";

import { PortalBand } from "@/components/ui/portal-band";
import { Section } from "@/components/ui/section";

import { CheckinForm } from "./_components/checkin-form";

// Public check-in (§7 Stage 3). Three fields, no account, phone-first —
// §1.2's target is a completed check-in in under 20 seconds. The page itself
// is static; all the work happens in the submitCheckin Server Action.
//
// REBUILT in v2 phase 3 (the Portal Rebuild), concept A "Fit the first screen",
// adopted by the officer 2026-09-19. Brief:
// .impeccable/surfaces/route-portal-attend.md
//
// ── THE LAYOUT-FAMILY BUDGET ────────────────────────────────────────────────
//
//   1. Band ... Short portal field band (field + chevron notch)
//   2. Form ... The check-in sheet on white
//
// TWO sections, TWO families — the same count as before, with the hero family
// swapped for the portal's. Eyebrow cap would be ceil(2 / 3) = 1; the page uses
// zero.
//
// 🔓 **THE BAR IS A FOLD POSITION, AND IT IS THE TIGHTEST NUMBER IN THE PHASE.**
// At 360×640, keyboard closed, scroll 0, 61px sticky header, IN THE IDLE STATE:
// the Check in button's bottom edge must sit at or above 640px. It was 668.
// Every decision on this page that reads as a style choice is a height decision
// first, and the two that buy the pixels are both here rather than in the form:
//
//   • `PortalBand` instead of `PageHero` — 131px against 177px at 360. That 46px
//     is most of the margin, and it is why the band is a separate component and
//     never a `PageHero` variant (DESIGN.md §Components).
//   • `pad="xs"` (24 → 32px) instead of `pad="md"` (48 → 64px) — another 24px at
//     360. The form IS the page here; there is no editorial run-up to give it.
//
// 🪤 **The band carries no `line`.** `PortalBand` takes one and /portal/lookup
// uses it; a sentence here would cost ~24px of a budget measured in single
// digits, and the three labelled fields below already say what the page is for.
//
// 🪤 **Measure the SETTLED state, and measure the COMPUTED style.** Nothing on
// this page carries `data-reveal` (the band does not, and the form must not), so
// these numbers reproduce on a first load — which is exactly why the /portal hub's
// did not. `npm run test:ui` CANNOT check this bar: playwright.config.ts has one
// project at 1280×720 and a per-test 360×800 for the overflow check only. A green
// suite and a met bar are different claims.

export const metadata: Metadata = {
  title: "Check In",
  description: "Check in to a MISA event.",
};

export default function AttendPage() {
  return (
    <>
      {/* 1. LAYOUT FAMILY: Short portal field band. The same band the hub and
          /portal/lookup render, so a member arriving from a printed QR code —
          which is MOST of them, since /attend 308s straight here — lands
          somewhere that reads as the same place as the hub they never saw. */}
      <PortalBand title="Event Check-In" />

      {/* 2. LAYOUT FAMILY: the check-in sheet.

          🪤 `ground="white"` is not decoration. Every control in the form fills
          with `bg-misa-panel` (see `controlClass` in components/ui/field.tsx),
          which is the SAME grey the public page ground became on 2026-08-19 — on
          the page ground the inputs would be the colour of what is behind them.
          The fix is a white surface under the form, not a recoloured primitive:
          `controlClass` is shared with /admin, which keeps the outgoing white
          system.

          🔓 And it is now load-bearing twice over. White is the ground that ends
          this surface's `--misa-muted` problem: the token is 4.84:1 on Paper and
          4.33:1 on Vellum, so the review step's field labels moved onto this
          ground rather than being recoloured in place. Moving a page ground is a
          contrast change — re-measure every grey on any ground you move. */}
      <Section
        ground="white"
        pad="xs"
        width="narrow"
        innerClassName="max-w-xl"
      >
        <CheckinForm />
      </Section>
    </>
  );
}

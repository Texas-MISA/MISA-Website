import type { ReactNode } from "react";

import { Title } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";

// The portal's short field band — v2 phase 3, the Portal Rebuild.
//
// 📌 **Three callers, which is why it is here and not in a page.** The hub,
// `/portal/attend` and `/portal/lookup` all adopted it (officer, 2026-09-19).
// CLAUDE.md's rule is that a primitive earns its place by a SECOND caller; this
// one had three before a line of it was written. Phase 4's lesson was the
// opposite case — `PageHeader`, `SectionHeading` and `Table` sat at zero call
// sites while 25 pages kept their copies — so a shared thing with three
// simultaneous adopters is the shape that was missing, not more indirection.
//
// 🪤 **This is NOT a variant of `PageHero`, and must never become one.**
// `PageHero` renders on the five phase-2 content pages, and its `34 → 44 → 52`
// page-hero ramp row, its `data-reveal="rise"` headline and its subhead slot are
// THEIR contract. A `short` prop there would put the portal's decisions inside
// five pages that never asked for them. The two components deliberately share
// nothing but `<Section ground="field">` and the notch.
//
// 🔓 **Why it exists at all: height.** `PageHero` costs **177px** at 360 with no
// subhead (48 pt-12 + 33 h1 + 96 pb-24), and that is what pushes `/portal/attend`'s
// Check in button to 668 on a 640px screen. This band costs **~131px** — 24 + 27
// + 80 — and the 46px it gives back is most of the margin the check-in bar needs.
// Re-measure before changing any of the three numbers.
//
// 🪤 **The notch eats a fixed 48px and that is the floor on `pb`.**
// `.chevron-notch` is `polygon(0 0, 100% 0, 100% calc(100% - 48px), 50% 100%, 0
// calc(100% - 48px))`, so the cut is DEEPEST at the left and right edges and
// zero at the horizontal centre. That is precisely why the officer's centred h1
// works at this height: a left-aligned title would be sitting where the notch
// bites. `pb-20` leaves 32px of clearance below the text before the cut starts.
//
// 🪤 **A clip-path clips DESCENDANTS.** Nothing may overhang this band's bottom
// edge — a plate positioned to overlap the section below is simply cut off.
//
// 📌 **No `data-reveal`, ever, and that is the officer's anti-goal in CSS.** The
// hub's one named anti-goal is "slower to check in". `html.js [data-reveal]`
// starts at `opacity: 0` and waits for the IntersectionObserver, so a revealed
// band is a band the member cannot read on first paint. It also makes the thing
// unmeasurable: `[data-reveal="up"]` is `translateY(18px)`, so every casual
// measurement of a revealing element reads 18px low.
//
// 🪤 **`Title` carries no colour of its own**, so it inherits the `text-white`
// that `ground="field"` lays down. Do not add `text-white` here — that would be
// a second source of truth for a fact the ground already knows, which is the
// same argument `Headline`'s `.on-navy` variant settles.

export function PortalBand({
  title,
  /**
   * One plain sentence under the title. Only `/portal/lookup` carries one
   * ("Enter your UT EID to see where you stand this term."); the hub and
   * check-in are title-only, and every line added here is height taken off
   * check-in's 16px of slack.
   */
  line,
}: {
  title: ReactNode;
  line?: string;
}) {
  return (
    <Section
      ground="field"
      width="page"
      // 🪤 `xs` (24 → 32px), against `PageHero`'s `md` (48 → 64px). The band is
      // short because the tool below it is the page, not because the type is
      // smaller — both are true, but this is the one that buys the pixels.
      padTop="xs"
      // Off the scale on purpose, exactly as `PageHero`'s is: 48px of this is
      // the notch and only the remainder is clearance. `padBottom="none"` so
      // the section contributes nothing on top of it.
      padBottom="none"
      className="chevron-notch relative pb-20 sm:pb-22"
    >
      <div
        aria-hidden="true"
        className="hero-grid pointer-events-none absolute inset-0"
      />
      <div className="relative text-center">
        {/* 📌 The `Title` ramp row (26 → 34px), not the page-hero row
            (34 → 44 → 52). A ramp STEP, never a one-off size — the detector
            reads font sizes against the ramp, and phase 5 suppresses against
            the ramp that ships or not at all.

            🪤 Centring is `text-center` PLUS `mx-auto`: a block with a `max-w`
            measure and centred text still sits hard left inside its parent. */}
        <Title as="h1" className="mx-auto max-w-[20ch]">
          {title}
        </Title>
        {line && (
          <p className="mx-auto mt-2 max-w-[44ch] leading-normal text-white/80">
            {line}
          </p>
        )}
      </div>
    </Section>
  );
}

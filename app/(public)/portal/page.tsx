import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Title } from "@/components/ui/heading";
import { PortalSheet } from "@/components/ui/portal-sheet";

// The member portal hub — REBUILT in v2 phase 3 (the Portal Rebuild), concept A
// "The title block", adopted by the officer 2026-09-19. Brief:
// .impeccable/surfaces/route-portal.md
//
// Still static: no data reads, no form, no auth.
//
// ── THE LAYOUT-FAMILY BUDGET ────────────────────────────────────────────────
//
//   1. Band ........... Short portal field band (field + chevron notch)
//   2. Destinations ... Shared-rule plate, one cell per member tool
//
// TWO sections, TWO families — the same count as before, with the families
// swapped. Eyebrow cap would be ceil(2 / 3) = 1; the page uses zero.
//
// 🔓 **The officer's anti-goal is the whole design: it must NEVER be SLOWER TO
// CHECK IN than it was.** Measured at 360×640, settled, with the 61px sticky
// header: the check-in row's bottom edge was 423px, and the bar is "at or above
// 424". Everything below that reads as a style choice is a height decision
// first.
//
// 🪤 **Measure the SETTLED state.** `html.js [data-reveal="up"]` is
// `translateY(18px)`, and the old rows each carried one — so a casual read gave
// 441 where the truth was 423. These rows carry NO `data-reveal` at all now
// (see below), which removes the delay and the measurement trap together.
//
// 🔓 **All three destinations stay formatted the SAME, and the order is fixed**
// (officer, 2026-09-18, re-confirmed 2026-09-19). Check In was first built as
// the lone primary with the other two in outline; the officer overruled that.
// Check-in's speed now comes from ORDER, PLACEMENT and COMPACTNESS — never from
// ranking it. Equal formatting is structural here rather than remembered: the
// three cells are one `.map` over one shape, so making one of them louder means
// breaking the loop, which is a thing a reviewer can see.
//
// 📌 **The separate button labels are GONE (officer approved, 2026-09-19).**
// "Check in" / "Leaderboard" / "Lookup" restated the titles beside them, and a
// row that is entirely a link does not need a control inside it saying so. What
// replaces them as the affordance is the navy key: visible at rest on every
// row, because a phone never hovers (EV14).
//
// 🪤 **Nothing else is added** (officer): no orienting line, no live data, no
// imagery. A fourth or fifth destination — houses, bingo — is a later
// re-layout, and that is accepted.
//
// 🔓 **robots is per page, and must never move to a portal layout.** The hub,
// /portal/leaderboard and /portal/lookup are noindex; /portal/attend is
// indexable, as /attend always was. A layout-level robots would silently
// de-index the check-in page. Asserted in tests/portal.test.ts.
//
// 🪤 This page sits on the grey page ground, where `--misa-muted` measures
// 4.33:1 and FAILS AA — so the officer line uses `--misa-secondary`, which is
// 7.60:1 there. The cells are white; their body copy is the secondary ink the
// token names for card copy. **This page's own content renders ZERO muted
// ink**, and the 2026-09-19 count that said 1 was a grep hit on this very
// comment.
//
// 🪤 Scope that claim to THIS FILE, which is what an earlier draft of this
// comment failed to do. Measured at the gate: `--misa-muted` *is* on the
// rendered route — the footer's `txmisa@gmail.com` at every width, and the
// four desktop nav items at 1280 — because the header and footer are shared
// chrome this surface does not own. Neither is a failure: both sit on WHITE at
// 4.84:1, which is the ground the token is allowed on. The route is clean and
// so is the file; "the page renders zero muted ink" was the stronger claim and
// it was not true. Lowest ratio anywhere on the route is 7.60:1.

export const metadata: Metadata = {
  title: "Member Portal",
  description: "Check in, see the standings, or look up your own attendance.",
  robots: { index: false, follow: false },
};

// 🔓 Titles and bodies are the OFFICER'S COPY (2026-09-18), not the destination
// pages' own headings — "Points Leaderboard" here, "Leaderboard" on the page
// itself. The one-line bodies are still each page's own `metadata.description`.
//
// 🪤 `slug` exists to build the two ids each row needs for its accessible name
// and its description. It is not derived from `href` at render time because a
// stable, readable id beats a generated one in a DOM an officer may have to
// read — and this is a Server Component, so `useId` is not available anyway.
const DESTINATIONS = [
  {
    slug: "attend",
    href: "/portal/attend",
    title: "Event Check-In",
    body: "Check in to a MISA event.",
  },
  {
    slug: "leaderboard",
    href: "/portal/leaderboard",
    title: "Points Leaderboard",
    body: "Current-term standings for MISA members.",
  },
  {
    slug: "lookup",
    href: "/portal/lookup",
    title: "My Attendance",
    body: "Look up your own MISA attendance, points and dues status.",
  },
] as const;

export default function PortalPage() {
  return (
    // ONE object. The band and the plate used to be two stacked sections; the
    // hub is now a single sheet whose masthead is its title and whose body is
    // the three rows.
    <PortalSheet title="Member Portal">
      {/* Shared-rule plate. One background showing through 1px gaps between
          opaque cells, so the seams read as ONE rule rather than as two
          adjacent borders — the same trick `KpiPlate` uses.

          🔓 It BLEEDS to the sheet's edges (`-mx-*` tracking the sheet's
          padding, `border-y` rather than a full frame) so the rows read as the
          document's body rather than as a card inside a card. A framed plate
          inside a framed sheet is the doubled rule `Panel`'s `frameless` prop
          exists to avoid. The negative margins must track `PortalSheet`'s
          padding; they are the same values its masthead rule uses. */}
      <div>
        <ul className="-mx-4 grid gap-px border-y border-misa-hairline bg-misa-hairline sm:-mx-8">
          {DESTINATIONS.map((destination) => (
            <li key={destination.href} className="bg-white">
              {/* 🪤 The WHOLE ROW is the link — exactly one `<Link>` per
                  destination, so there is no second tap target inside a tap
                  target and nothing for a thumb to miss. Its accessible name is
                  the TITLE alone (`aria-labelledby`) and the body is its
                  DESCRIPTION (`aria-describedby`): without those the computed
                  name would be "Event Check-In Check in to a MISA event." and
                  every row would announce as a run-on sentence.

                  🪤 The focus ring is INSET. The global ring is
                  `outline-offset: 2px`, which on a shared-rule plate draws two
                  pixels outside the cell — across the 1px seam and onto the
                  neighbouring cell, so a keyboard user sees a ring that appears
                  to mark two rows. `-outline-offset-2` draws it inside the cell
                  it actually names. Nothing here sets `overflow: hidden`, so
                  the ring is not clipped either way; this is about which row it
                  looks like it belongs to.

                  📌 No `data-reveal`, deliberately. A reveal holds the first
                  destination at `opacity: 0` until the observer fires, which is
                  the officer's anti-goal expressed in CSS. Hover and press swap
                  ink only — no lift, no scale (DESIGN.md: colour swaps are the
                  only hover, and nothing in this system moves on interaction). */}
              <Link
                href={destination.href}
                aria-labelledby={`${destination.slug}-title`}
                aria-describedby={`${destination.slug}-body`}
                className="group flex items-stretch [-webkit-tap-highlight-color:transparent] focus-visible:-outline-offset-2"
              >
                {/* 🪤 A `<div>`, not a `<span>`. This wrapper contains an
                    `<h2>`, and a `<span>` is phrasing content that may not
                    hold a heading — an `<a>` in a flow-content position may.
                    React's `validateDOMNesting` does NOT warn on this shape,
                    so a clean console was not evidence it was right; it was
                    found by reading the rendered markup.

                    🪤 `min-w-0` is load-bearing on a flex child. Without it
                    the item's automatic minimum size is its content's, so a
                    long destination title cannot wrap and would push the 48px
                    key off the row instead — the failure the brief's "each
                    title wrapping cleanly inside its row beside the key" at
                    360 is about. */}
                <div className="min-w-0 flex-1 px-6 py-5">
                  <Title
                    as="h2"
                    id={`${destination.slug}-title`}
                    // 📌 The CARD TITLE ramp row (22 → 26px), not `Title`'s own
                    // 26 → 34. A ramp STEP, never a one-off size. The page h1
                    // uses this same component at its default, so before this
                    // the band's title and the three things under it measured
                    // identically (26 at 360, 34 at 1280) and the plate had no
                    // level cue against the band.
                    //
                    // 🔴 It is `size="card"` and NOT `className="text-[22px]
                    // sm:text-[26px]"`, because the className form silently
                    // loses the specificity tie to the component's own base
                    // size — see the long note on `Title` in
                    // `components/ui/heading.tsx`. This was written the broken
                    // way first and caught only by reading the computed style.
                    size="card"
                    className="text-misa-blue transition-colors duration-150 group-hover:text-misa-blue-dark group-active:text-misa-blue-dark"
                  >
                    {destination.title}
                  </Title>
                  <p
                    id={`${destination.slug}-body`}
                    className="mt-1 leading-[1.6] text-misa-secondary"
                  >
                    {destination.body}
                  </p>
                </div>

                {/* The navy key: 48px wide and full height, so the three stack
                    into one navy stripe down the plate's edge, broken only by
                    the shared rule. This is the affordance that is visible AT
                    REST (EV14) — the chevron says "this goes somewhere" without
                    a label repeating the title beside it. `items-stretch` on
                    the row is what makes the key full-bleed rather than a
                    floating square, and `w-12` is the 48px the brief asks of
                    every target.

                    🔴 The key carries its OWN white focus ring, and that is
                    not belt-and-braces — it is the one place on this page the
                    system's ground rule bites. `app/globals.css:318` draws
                    `:focus-visible` as `2px solid var(--misa-blue)`, and the
                    comment two lines above it says why `.on-navy` exists: "a
                    navy ring is invisible" on navy. The row link spans BOTH
                    grounds — white cell, then this navy key — so its single
                    navy ring is 13:1 across the cell and **1:1 where it
                    crosses the key**, i.e. the indicator simply stopped at the
                    seam. `.on-navy` cannot fix it: that selector flips the
                    ring of a focused element INSIDE a navy section, and what
                    is focused here is the whole row, not the key.

                    So the key redraws the ring in white over its own 48px.
                    The two segments meet at the seam and read as one
                    continuous indicator that changes colour with the ground —
                    which is exactly what the `.on-navy` flip does everywhere
                    else, applied within a single component. 🪤 Keep this in
                    step with the row's `-outline-offset-2`: both rings are
                    inset by the same 2px, which is what makes them line up. */}
                <span
                  aria-hidden="true"
                  className="flex w-12 shrink-0 items-center justify-center bg-misa-blue text-white transition-colors duration-150 group-hover:bg-misa-blue-dark group-active:bg-misa-blue-dark group-focus-visible:outline-2 group-focus-visible:-outline-offset-2 group-focus-visible:outline-white"
                >
                  <ChevronRight className="size-5" strokeWidth={2} />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {/* 📌 Body size (16px), not `text-sm`. 14px is on NO row of DESIGN.md
            §The ramp — it has 12 (Eyebrow) and 16 (Body) and nothing between —
            and the detector cannot see it, because it reads arbitrary
            `text-[Npx]` values against the ramp and `text-sm` is neither. The
            de-emphasis this line wants comes from the INK (`--misa-secondary`,
            7.60:1 on this grey ground) and from its position outside the
            plate, not from shrinking it below the ramp's floor.

            🪤 `inline-block py-1` on the link is a TAP TARGET, not padding for
            looks: at 14px with no padding the hit area measured 39 × 17px,
            under even WCAG 2.2's 24px floor, on a page whose every other
            target is 48px+ (EV1). The padding sits on the `<Link>` so the
            target is the words themselves.

            `mt-6`, not `mt-8`: at 360×640 the line was landing at y 632 on a
            640px screen — visible enough to notice, never enough to read.

            🔓 It now sits INSIDE the sheet, below the plate, because the sheet
            is the page: a line stranded on the grey below the document would
            be the one piece of the hub that is not part of the object. The ink
            stays `--misa-secondary` — it is on white now rather than grey, so
            `--misa-muted` would also pass, but the portal has one de-emphasis
            ink and this is it. */}
        <p className="mt-6 text-misa-secondary">
          Officers:{" "}
          <Link
            href="/admin/login"
            className="inline-block py-1 text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
          >
            sign in
          </Link>
        </p>
      </div>
    </PortalSheet>
  );
}

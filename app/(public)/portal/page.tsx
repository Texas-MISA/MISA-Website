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
//   1. The sheet ...... One white `.sheet` on the grey page ground, its title
//                       a masthead above a bleeding rule, its body a
//                       shared-rule plate with one cell per member tool.
//
// ONE section, ONE family. Eyebrow cap is ceil(1 / 3) = 1; the page uses zero.
//
// 🔴 **Until the 2026-09-20 re-gate this block declared a SECOND family** —
// "Short portal field band (field + chevron notch)" — which `ca5cd06` deleted
// when the officer took the navy header off every portal page. The declaration
// was not deleted with it, so the page claimed TWO sections while rendering
// ONE and named a family with zero elements anywhere on the route. DESIGN.md
// §Layout families makes these comments the enforcement — *"declare the family
// in a code comment per section so the count is a grep rather than a memory"*
// — so a stale declaration is not a stale comment; it is a wrong count in the
// only place the count is kept. Both critique assessments found it.
//
// 🔓 **The officer's anti-goal is the whole design: it must NEVER be SLOWER TO
// CHECK IN than it was.** Measured at 360×640, settled, with the 61px sticky
// header: the check-in row's bottom edge was 423px, and the bar is "at or above
// 424". Everything below that reads as a style choice is a height decision
// first.
//
// ✅ **RE-MEASURED at the 2026-09-20 re-gate: the check-in row's bottom edge is
// 267.2px**, settled at 360×640 under the 61px sticky header, and the WHOLE
// sheet (85 → 609.4) is inside the 640 fold: rows end at 267.2 / 386.5 / 531.4.
// Measured three times independently — the lead, the `design-reviewer` agent
// and the critique's assessment B, the last of those deriving it from the box
// model rather than the browser.
//
// 🪤 **Round 1a's header change did NOT move this page.** `b01dc6a` gave the
// header's MEMBER PORTAL button `max-sm:min-h-12`, taking it 29.0 → 48.0px tall
// (top 6.0, bottom 54.0) INSIDE a bar that is still 60px plus its 1px rule. The
// shell is 61px at every width, so the sheet still starts at 85.
//
// 🪤 **The receipts said 265.5 and it does not reproduce.** 267.2 falls out of
// the box model to the pixel — 61 header + 24 `padTop="xs"` + 1 sheet border +
// 20 padding + 26.52 h1 + 16 + 1 rule + 24 + 1 plate border + 92.70 row — and
// 265.5 falls out of nothing. Corrected here, in DESIGN.md and in
// `receipts/officer.md`. Both clear the ≤424 bar by more than 150px, so nothing
// turns on it except that a frozen surface should not carry a figure that no
// longer reproduces.
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
// 🪤 **Every word on this page sits on WHITE, not on the grey page ground** —
// the sheet supplies it, and that became true of the officer line too when
// `ca5cd06` moved it inside the sheet. The ground still decides the ink:
// `--misa-muted` is 4.33:1 on the grey and FAILS AA, so the portal has one
// de-emphasis ink and it is `--misa-secondary`, which measures **8.51:1 on this
// sheet** — the lowest ratio anywhere in this page's own content. The cells are
// white too; their body copy is the same token, the one DESIGN.md names for
// card copy.
//
// 🪤 **Two claims in the block this replaces were wrong, and the 2026-09-20
// re-gate measured both.** It called the officer line `--misa-secondary`
// "7.60:1 there" — 7.60 is that token on the GREY, a ground nothing on this
// page has used since `ca5cd06`. And it ended "lowest ratio anywhere on the
// route is 7.60:1" two lines after correctly naming the footer's
// `txmisa@gmail.com` at 4.84:1, which is lower: the paragraph refuted itself
// inside seven lines. Corrected: **the page bottoms out at 8.51:1 and the route
// at 4.84:1**, the latter being the footer's muted email at every width and,
// at 1280, the four desktop nav items — all on white, which is the ground that
// token is allowed on. Both are shared chrome this surface does not own, and
// neither is an AA failure.
//
// 📌 **This FILE renders zero muted ink**; every `--misa-muted` in it is a word
// in these comments. Scope the claim to the file — scoping it to the route is
// what made the earlier version false, twice.

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
                    360 is about.

                    🔴 **The cell's horizontal padding TRACKS THE SHEET'S, and
                    that is the whole point of these two values.** It was a flat
                    `px-6` (24px) until the 2026-09-20 re-gate, compared against
                    nothing: the plate bleeds outward by exactly the sheet's
                    padding (`-mx-4 sm:-mx-8`) and the cell then re-padded by 24,
                    which equals neither 16 nor 32. So the row text started 8px
                    RIGHT of the masthead at 360 and 8px LEFT of it at 1280 —
                    **the miss inverted across `sm`**, which is the signature of
                    an unchecked constant rather than a choice. On a document
                    whose entire idea is a masthead above a body, the left margin
                    is the strongest alignment line on the page, and the three
                    destination titles sat on it at no width at all. Matching the
                    sheet's own padding puts the h1, the three titles and the
                    officers line on ONE left edge at every width.

                    📌 Found three times independently at the re-gate — the
                    `design-reviewer` agent (DR2) and both critique assessments —
                    which is the strongest signal the gate produced. It is also
                    free width where width is scarce: the phone text column goes
                    222 → 238px. */}
                <div className="min-w-0 flex-1 px-4 py-5 sm:px-8">
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
                    inset by the same 2px, which is what makes them line up.

                    🔴 **`relative` IS THE FIX, and without it every word above
                    was true of the CSS and false of the pixels.** The
                    2026-09-20 re-gate screenshotted a focused row and diffed it
                    against the same row unfocused, so the changed pixels are
                    the indicator and nothing else. As built, the white ring
                    painted **only its left 2px column**: the navy ring's top and
                    bottom runs stopped dead at the key's left edge, the row's
                    right-hand run painted nothing at all, and the key — 48px of
                    a link whose whole row is the target — sat OUTSIDE the
                    indicator that names it. The ring did not change colour at
                    the seam; it ended there, capped by a white bar.

                    An outline is painted in its element's own paint step, and a
                    non-positioned in-flow child does not get one that survives
                    over its parent's. `relative` promotes the key so its
                    outline paints after, and the ring closes around it: the
                    key's top edge and the row's right edge now measure
                    `rgb(255,255,255)` at 13.03:1 on the navy, where both
                    measured *no change at all* before. Verified by the same
                    pixel diff. 🪤 An `inset` box-shadow does NOT fix this —
                    box-shadow paints with the child's background, still under
                    the parent's outline. `position: relative`, `relative` +
                    `z-index`, and `isolation: isolate` were all measured and all
                    work; `relative` is the least of them. */}
                <span
                  aria-hidden="true"
                  className="relative flex w-12 shrink-0 items-center justify-center bg-misa-blue text-white transition-colors duration-150 group-hover:bg-misa-blue-dark group-active:bg-misa-blue-dark group-focus-visible:outline-2 group-focus-visible:-outline-offset-2 group-focus-visible:outline-white"
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
            8.51:1 on the sheet's white) and from its position outside the
            plate, not from shrinking it below the ramp's floor.

            📌 `leading-[1.6]` is the ramp's Body row, the same leading the row
            bodies carry 20px above. Without it this paragraph inherited 1.5 and
            rendered a 24px line box beside their 25.6px — two 16px paragraphs
            in one small surface set at two different leadings. Found by the
            2026-09-20 re-gate's critique.

            🪤 **`min-h-12` on the link is a TAP TARGET, not padding for looks.**
            At 14px with no padding the hit area measured 39 × 17px; `py-1` took
            it to 44.9 × 32, which clears WCAG 2.2's 24px floor and still left
            it the ONE target on a page whose every other target is 48px+ (EV1's
            44pt iOS / 48dp Android), including the header's MEMBER PORTAL
            button since round 1a raised it. The comment cited that floor while
            the control missed it. Now it is 48px, by the same `min-h-12` the
            header button uses, and `inline-flex items-center` keeps the words
            on the baseline of "Officers:" beside them rather than boxing them.

            `mt-6`, not `mt-8`: kept, but the measurement that justified it is
            gone — the line is no longer near the fold at all (its bottom was
            632 on a 640 screen when it sat on the grey; inside the sheet it is
            far above that, and `mt-8` would also fit). It stays because 24px is
            the rhythm step between the plate and a line that is not part of it.

            🔓 It now sits INSIDE the sheet, below the plate, because the sheet
            is the page: a line stranded on the grey below the document would
            be the one piece of the hub that is not part of the object. The ink
            stays `--misa-secondary` — it is on white now rather than grey, so
            `--misa-muted` would also pass, but the portal has one de-emphasis
            ink and this is it. */}
        <p className="mt-6 leading-[1.6] text-misa-secondary">
          Officers:{" "}
          <Link
            href="/admin/login"
            className="inline-flex min-h-12 items-center text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
          >
            sign in
          </Link>
        </p>
      </div>
    </PortalSheet>
  );
}

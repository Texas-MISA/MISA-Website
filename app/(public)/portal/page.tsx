import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Title } from "@/components/ui/heading";
import { PortalBand } from "@/components/ui/portal-band";
import { Section } from "@/components/ui/section";

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
// token names for card copy. This page renders ZERO muted ink, and the
// 2026-09-19 count that said 1 was a grep hit on this very comment.

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
    <>
      {/* 1. LAYOUT FAMILY: Short portal field band. Title only — the rows below
          say what the portal holds, and every line added here is height taken
          off the member's first screen. */}
      <PortalBand title="Member Portal" />

      {/* 2. LAYOUT FAMILY: Shared-rule plate. One background showing through
          1px gaps between opaque cells, so the seams read as ONE rule rather
          than as two adjacent borders — the same trick `KpiPlate` uses. */}
      <Section padTop="sm" padBottom="md" width="narrow">
        <ul className="grid gap-px border border-misa-hairline bg-misa-hairline">
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
                className="group flex items-stretch focus-visible:-outline-offset-2"
              >
                <span className="flex-1 px-6 py-5">
                  <Title
                    as="h2"
                    id={`${destination.slug}-title`}
                    className="text-misa-blue transition-colors duration-150 group-hover:text-misa-blue-dark"
                  >
                    {destination.title}
                  </Title>
                  <span
                    id={`${destination.slug}-body`}
                    className="mt-1 block leading-[1.6] text-misa-secondary"
                  >
                    {destination.body}
                  </span>
                </span>

                {/* The navy key: 48px wide and full height, so the three stack
                    into one navy stripe down the plate's edge, broken only by
                    the shared rule. This is the affordance that is visible AT
                    REST (EV14) — the chevron says "this goes somewhere" without
                    a label repeating the title beside it. `items-stretch` on
                    the row is what makes the key full-bleed rather than a
                    floating square, and `w-12` is the 48px the brief asks of
                    every target. */}
                <span
                  aria-hidden="true"
                  className="flex w-12 shrink-0 items-center justify-center bg-misa-blue text-white transition-colors duration-150 group-hover:bg-misa-blue-dark"
                >
                  <ChevronRight className="size-5" strokeWidth={2} />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm text-misa-secondary">
          Officers:{" "}
          <Link
            href="/admin/login"
            className="text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
          >
            sign in
          </Link>
        </p>
      </Section>
    </>
  );
}

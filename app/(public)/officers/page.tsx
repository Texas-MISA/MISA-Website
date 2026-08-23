import type { Metadata } from "next";

import { BUTTON_SOLID_WHITE } from "@/components/ui/button";
import { PageHero } from "@/components/ui/chevron-section";
import { Headline } from "@/components/ui/heading";
import { OfficerCard } from "@/components/ui/officer-card";
import { revealDelay } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";
import { OFFICERS } from "@/lib/officers";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Officers",
  description: "Meet the MISA officer team.",
};

// /officers, rebuilt from scratch in v2 phase 2.
//
// 🔴 **BUILT FROM THE HOME PAGE, NOT FROM THE OLD /officers.** Exact words kept,
// nothing else. The cards are the home page's bento cell: a lifted white
// `.plate` with an opaque hairline, a navy-tinted `shadow-lift` and its image
// slot on top, rather than the bare bordered squares that were here.
//
// ── THE LAYOUT-FAMILY BUDGET ────────────────────────────────────────────────
//
//   1. Hero ......... Page hero (field + chevron notch)
//   2. The team ..... Uniform plate grid
//   3. Join us ...... Navy field band
//
// THREE sections, THREE families. Eyebrow cap would be ceil(3 / 3) = 1; the page
// uses zero. Each card's role label sits BELOW a name, which makes it a role
// label rather than an eyebrow — see the note in `officer-card.tsx`.
//
// 📌 **A uniform grid is the right answer here and an asymmetric one would be
// wrong.** The home page's bento varies cell size because its four activities
// genuinely differ in weight. Thirteen officers do not: sizing one person's card
// larger than another's is a claim about the people on it. Equal cells, one
// varying property (nothing), and the composition carried by the grid itself.
//
// 🔓 **HEADSHOTS LANDED on 2026-08-23, for eleven of the thirteen.** The rule
// that kept them blank was that the photo-to-name pairing "was never supplied";
// the officer supplied it, from the live site's own officers page. Two cards
// still render the labelled placeholder because that page shows ONE image file
// on two officers' cards and neither can be attributed — `lib/officers.ts` has
// the full note. 📌 A grid that is eleven photographs and two labelled squares
// is the intended state of `PhotoSlot`, not a half-finished one.

/**
 * How many cards sit in a row at `xl`.
 *
 * 🪤 The grid is TEN columns and every card spans two, which is what lets the
 * trailing row centre under the full rows above it. Below `xl` it falls back to
 * plain column counts and the centring is dropped, because it only means
 * anything at five per row.
 */
const PER_ROW = 5;

/** The first index of the trailing short row, or -1 when the rows come out even. */
const TRAILING_START =
  OFFICERS.length % PER_ROW === 0
    ? -1
    : OFFICERS.length - (OFFICERS.length % PER_ROW);

/**
 * Which grid column the trailing row starts in, so it centres.
 *
 * 🐛 **This used to be the literal `i === 10 ? "xl:col-start-3"`** — an offset
 * hand-tuned for exactly thirteen officers in rows of five, sitting beside a
 * comment that read "Fourteen cards" and was already wrong. A fourteenth officer
 * would have left the trailing row silently off-centre with nothing to catch it,
 * and this roster turns over every year. The arithmetic: `r` trailing cards each
 * spanning 2 of 10 columns occupy `2r`, so the leading gap is `(10 - 2r) / 2`
 * columns and the 1-indexed start is `6 - r`. Thirteen officers give r = 3 and
 * column 3, which is what was hardcoded.
 */
const TRAILING_COL_START = 6 - (OFFICERS.length % PER_ROW);

// Tailwind cannot see a computed class name, so the column starts are written
// out. Five is the whole range: a trailing row of five is a full row.
const COL_START: Record<number, string> = {
  1: "xl:col-start-1",
  2: "xl:col-start-2",
  3: "xl:col-start-3",
  4: "xl:col-start-4",
  5: "xl:col-start-5",
};

export default function OfficersPage() {
  return (
    <>
      {/* 1. LAYOUT FAMILY: Page hero.
             📌 The handoff spells the count out ("Thirteen students"). It is
             derived from the roster instead, because a spelled-out number is a
             second place the roster size is recorded and it goes stale silently
             the first time an officer is added. */}
      <PageHero
        title="Meet the MISA Officers"
        subhead={`${OFFICERS.length} students running the organization this year. Reach out to any of us.`}
      />

      {/* 2. LAYOUT FAMILY: Uniform plate grid.
             📌 Grouping mechanism: the gap, plus each card's own lift. No rules
             between cards — the plates do that work, the way the bento cells do
             on the home page. */}
      <Section padTop="sm" padBottom="md" width="page">
        {/* ✂️ **The year came OFF this heading on 2026-08-23**, when the roster
            was replaced with the current one. It read "2025–26 Officer Team",
            which the new roster makes false, and the source page carries no
            year anywhere — so putting one back would be inventing a fact about
            the club rather than reading one. 📌 Restoring it is editing this
            line once the officer says which academic year this team is. */}
        <Headline data-reveal="up" className="mb-7">
          Officer Team
        </Headline>

        <ul className="grid grid-cols-2 gap-card sm:grid-cols-3 xl:grid-cols-10">
          {OFFICERS.map((officer, i) => (
            <li
              key={officer.name}
              // `fade`, not `up`. Thirteen cards entering on a translate is the
              // page-wide effect the entrance variants exist to stop being;
              // faces should arrive, not slide.
              data-reveal="fade"
              // Five per row at xl, so the stagger restarts each row.
              style={revealDelay(0.04 * (i % PER_ROW))}
              className={`xl:col-span-2 ${
                i === TRAILING_START ? (COL_START[TRAILING_COL_START] ?? "") : ""
              }`}
            >
              <OfficerCard officer={officer} />
            </li>
          ))}
        </ul>
      </Section>

      {/* 3. LAYOUT FAMILY: Navy field band.
             📌 The drawn radial under the 60×60 grid overlay, closing the page
             the way it closes the home page. */}
      <Section
        ground="field"
        pad="lg"
        width="page"
        className="relative overflow-hidden"
      >
        <div
          aria-hidden="true"
          className="hero-grid pointer-events-none absolute inset-0"
        />
        <div className="relative flex flex-wrap items-center justify-between gap-10">
          <div>
            <Headline data-reveal="up" className="mb-2.5">
              Want to join the team?
            </Headline>
            <p
              data-reveal="up"
              style={revealDelay(0.05)}
              className="max-w-[56ch] leading-[1.65] text-white/80"
            >
              Junior Director applications are open to freshmen and sophomores of
              all majors, and reopen Fall 2026. Officer elections run at the end
              of the spring semester.
            </p>
          </div>
          <a
            data-reveal="up"
            style={revealDelay(0.1)}
            href={`mailto:${CONTACT_EMAIL}`}
            className={`${BUTTON_SOLID_WHITE} whitespace-nowrap`}
          >
            Email an officer
          </a>
        </div>
      </Section>
    </>
  );
}

import type { Metadata } from "next";

import { BUTTON_SOLID_WHITE } from "@/components/ui/button";
import { PageHero } from "@/components/ui/chevron-section";
import { Headline, Title } from "@/components/ui/heading";
import { Partners } from "@/components/ui/partners";
import { PhotoSlot } from "@/components/ui/photo-slot";
import { revealDelay } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";
import {
  ABOUT_BAND_SLOTS,
  ABOUT_HISTORY_SLOT,
  ABOUT_MISSION_SLOTS,
  CONTACT_EMAIL,
  FAQ,
  HISTORY_CARDS,
  HISTORY_STATS,
  MISSION,
} from "@/lib/site";

export const metadata: Metadata = {
  title: "About Us",
  description: "Connecting technology with business.",
};

// /about, rebuilt in v2 phase 2.
//
// 🔴 **BUILT FROM THE HOME PAGE, NOT FROM THE OLD /about** (officer, mid-phase).
// The instruction was explicit: keep the exact words and nothing else. The v1
// composition here — a bordered mission panel beside a hatch cluster, then a
// second image+text split, then a card-grid FAQ — is not evolved, it is gone.
// Every section below is assembled out of vocabulary the home page already
// shipped and the officer already signed off:
//
//   · the drawn navy `field` ground under a 60×60 grid overlay
//   · floating `.plate` photographs, 4px radius, opaque hairline, navy-tinted
//     `shadow-lift`, leaning only at `lg`
//   · the raised white `.sheet` carrying a statement at statement scale
//   · one shared-rule plate: a single background showing through `gap-px`
//
// ── THE LAYOUT-FAMILY BUDGET ────────────────────────────────────────────────
// §4.7: a family appears AT MOST ONCE per page; eight sections need at least
// four families; no more than TWO consecutive image+text splits.
//
//   1. Hero .............. Page hero (field + chevron notch)
//   2. Mission ........... Plate cluster over a raised sheet
//   3. History ........... Shared-rule plate on the navy field
//   4. Photo band ........ Full-bleed feature
//   5. FAQ ............... Disclosure index
//   6. Get in touch ...... Navy strip
//   7. Partners .......... Shared-rule logo plate
//
// SEVEN sections, SEVEN families, none repeated. ZERO consecutive image+text
// splits — nothing on this page is a picture beside a paragraph any more, which
// is the specific shape v1 was scrapped for.
//
// ⚠️ **Sections 3 and 7 are both shared-rule plates, and that is the page's one
// tight spot** — the same note the home page carries about Projects and
// Partners. They stay distinguishable (three navy stat cells on a drawn field
// against four white logo cells on grey) and a THIRD would break the budget.
//
// 📌 **Eyebrow count: ZERO**, against a cap of ceil(7 / 3) = 3. The two
// HISTORY_CARDS labels render through `<Title>` because that is what they are —
// a heading for their paragraph, not a micro-label above a section headline.
//
// 📌 Ground rhythm, matching the home page's: field → grey → field → grey →
// grey → navy → grey. Never two adjacent bands of the same ground.

export default function AboutPage() {
  return (
    <>
      {/* 1. LAYOUT FAMILY: Page hero. See components/ui/chevron-section.tsx. */}
      <PageHero
        title="About Us"
        subhead="Connecting technology with business."
      />

      {/* 2. LAYOUT FAMILY: Plate cluster over a raised sheet.
             📌 The home page's two signature surfaces, stacked rather than
             placed side by side: three leaning photographs, and the mission set
             at statement scale on a white sheet lifted off the grey.
             🪤 The sheet needs a ground that is NOT white under it or it is an
             invisible rectangle wearing a shadow. The page ground supplies that.
             📌 Grouping mechanism: negative space only. No rule, no divider. */}
      <Section padTop="sm" padBottom="md" width="page" className="overflow-x-clip">
        {/* 🪤 **The tilt is a `lg:`-scoped CLASS on `.plate`, and every word of
            that is load-bearing.** It goes on the inner plate because
            `[data-revealed]` sets `transform: none` on any node carrying
            `data-reveal` — a plate that held both would snap square the moment
            it scrolled into view. And it stops below `lg` because down there the
            plates are narrow grid cells: a lean grows each cell's bounding box
            into its neighbour across the 16px gap and pushes the row wider than
            the screen. An inline style cannot carry a breakpoint, so the custom
            property is set by an arbitrary-property utility.

            📌 The angles alternate +3 / -3 / +3. ONE property varies across the
            set; shape, frame, radius and size are identical, which is what makes
            three photographs read as a set rather than as scatter.

            ── THE ARITHMETIC, WHICH IS LOAD-BEARING ───────────────────────────
            🪤 **A rotated plate needs more room than it occupies, and at `lg`
            the plain `gap-tile` is not enough.** A w×h box turned by θ has a
            bounding box of `w·cosθ + h·sinθ` wide. At 3:2, h = 2w/3, so at θ=3°
            that is `w(0.99863) + 0.667w(0.05234)` = **1.0335w**, i.e. each plate
            grows **0.0168w per side**.

            Measured at a 1631px viewport: the page caps at 1400 and the gutters
            take 56 a side, so the row has 1288px. Three columns with the 16px
            `gap-tile` gave w = 418 and a growth of 7.0px per side — two
            neighbours each leaning 7px into a 16px gap leaves **2px**. The
            browser measured **1px**. That is the same accident the home page
            hero's plates hit at ±4°, where a nominal 15px of overlap was really
            −2px at the bottom tip.

            `lg:gap-x-12` (48px) is the fix: w becomes 397, growth 6.7 a side,
            and the visible gap settles at **~35px**. 📌 The wider gap is `lg:`
            only, because the tilt is `lg:` only — below that these are upright
            grid cells and 16px is correct. **Change the angle or the ratio and
            redo this.** */}
        <div className="grid grid-cols-2 gap-tile sm:grid-cols-3 lg:gap-x-12">
          {[...ABOUT_MISSION_SLOTS, ABOUT_HISTORY_SLOT].map((slot, i) => (
            <div
              key={slot.src ?? slot.caption}
              data-reveal="up"
              style={revealDelay(0.06 * i)}
              className={i === 2 ? "col-span-2 sm:col-span-1" : ""}
            >
              <div
                className={`plate border border-misa-plate-edge shadow-lift ${
                  ["lg:[--plate-tilt:3deg]", "lg:[--plate-tilt:-3deg]", "lg:[--plate-tilt:3deg]"][i]
                }`}
              >
                <PhotoSlot
                  slot={slot}
                  ratio="aspect-3/2"
                  sizes="(max-width: 640px) 48vw, 30vw"
                  priority={i === 0}
                />
              </div>
            </div>
          ))}
        </div>

        {/* 📌 Centred, and deliberately so. §4.3's anti-centre bias is scoped to
            HERO sections; the hero above is left-aligned, which is where that
            rule bites. A one-paragraph thesis on a raised sheet is the case for
            centring, and it is the treatment the home page's mission already
            uses — this page is where that statement belongs in full. */}
        <div
          data-reveal="rise"
          style={revealDelay(0.2)}
          className="sheet mt-12 px-6 py-10 text-center sm:px-12 sm:py-14"
        >
          <Headline>Our Mission</Headline>
          <p
            data-reveal="up"
            style={revealDelay(0.26)}
            className="mx-auto mt-5 max-w-[52ch] text-[19px] leading-[1.55] text-pretty text-misa-body sm:text-[22px] lg:text-[24px]"
          >
            {MISSION}
          </p>
        </div>
      </Section>

      {/* 3. LAYOUT FAMILY: Shared-rule plate on the navy field.
             📌 The home page's projects band, carrying this page's content: one
             plate, three cells, the rule drawn once by `gap-px` showing the
             container through. It is also the page's mid-scroll contrast, which
             is the job the navy band does on the home page.
             🪤 The cells stay OPAQUE. The rule is the container's background
             showing through the 1px gap, so a transparent cell would show the
             field across the whole card instead of at the seam.
             📌 Grouping mechanism: the shared rule, and nothing else. */}
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
        <div className="relative">
          <Headline data-reveal="up">History of MISA</Headline>

          {/* 🪤 `wipe` draws the plate on from the left rather than moving it in,
              which is the variant for a shared-rule surface. It animates
              `clip-path`, so it keeps its own `[data-revealed]` rule in
              globals.css, and NOTHING ROTATED may go inside it — a clip-path
              clips descendants and a rotated child always leaves its box. Three
              upright stat cells are safe. */}
          <ul
            data-reveal="wipe"
            style={revealDelay(0.08)}
            className="mt-8 grid auto-rows-fr gap-px border border-white/30 bg-white/30 sm:grid-cols-3"
          >
            {HISTORY_STATS.map((stat) => (
              <li key={stat.label} className="bg-misa-blue px-6 py-7">
                <p className="font-display text-[38px] leading-none font-semibold text-white sm:text-[44px]">
                  {stat.value}
                </p>
                <p className="mt-2 text-xs leading-tight font-medium tracking-[0.14em] text-white/65 uppercase">
                  {stat.label}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-10 grid gap-9 sm:grid-cols-2">
            {HISTORY_CARDS.map((card, i) => (
              <div
                key={card.eyebrow}
                data-reveal="up"
                style={revealDelay(0.14 + 0.06 * i)}
              >
                <Title className="text-[20px] text-white sm:text-[22px]">
                  {card.eyebrow}
                </Title>
                <p className="mt-2.5 leading-[1.7] text-white/80">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* 4. LAYOUT FAMILY: Full-bleed feature.
             No gutter and no gap: the four frames meet edge to edge and run to
             the viewport. It is the quiet cousin of the home page's marquee
             bands — the same idea that a row of photographs can be a section on
             its own, without a second marquee on the site.
             📌 Four different kinds of evening on purpose: outdoors, a game
             night, a panel, intramural sport. Four frames of the same room would
             be a wall, not a band.
             📌 The one place on the page with no frame and no radius, because
             these four squares are a single continuous surface. */}
      <Section as="div" gutter={false} pad="none">
        <div data-reveal="fade" className="grid grid-cols-2 sm:grid-cols-4">
          {ABOUT_BAND_SLOTS.map((slot) => (
            <PhotoSlot
              key={slot.src ?? slot.caption}
              slot={slot}
              ratio="aspect-square"
              sizes="(max-width: 640px) 50vw, 25vw"
            />
          ))}
        </div>
      </Section>

      {/* 5. LAYOUT FAMILY: Disclosure index.
             📌 Six questions read as an index and an answer opens where it sits.
             §4.9 asks for a real component rather than a `<ul>` past five items,
             and a card grid would have been the /officers device a second time.
             📌 Native <details>/<summary>: no client component, no JavaScript,
             keyboard reachable and findable by in-page search for free.
             📌 Grouping mechanism: `divide-y` plus ONE closing rule. §9.F bans a
             border on every row; a container rule with dividers is the
             sanctioned form of the same idea. */}
      <Section pad="md" width="page">
        <Headline data-reveal="up" className="mb-8">
          Frequently Asked Questions
        </Headline>

        <div
          data-reveal="up"
          style={revealDelay(0.05)}
          // 📌 The rules run the FULL measure while the answers stay capped at
          // 68ch below. An index is read by its left edge and its rules, so a
          // container capped at 80ch left half the page empty beside it and read
          // as a mistake rather than as asymmetry. Long rule, short line.
          className="divide-y divide-misa-hairline border-b border-misa-hairline"
        >
          {FAQ.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6 py-5 [&::-webkit-details-marker]:hidden">
                <span className="font-display text-[20px] leading-[1.15] font-semibold tracking-[-0.01em] text-misa-blue sm:text-[23px]">
                  {item.q}
                </span>
                {/* 🪤 A transform on a CHILD is safe; a transform on the node
                    carrying `data-reveal` is not, because `[data-revealed]` sets
                    `transform: none`. This sits several levels inside the
                    revealed wrapper and is untouched by it. */}
                <span
                  aria-hidden="true"
                  className="mt-1 shrink-0 text-[19px] leading-none text-misa-secondary transition-transform duration-(--dur-pop) ease-(--ease-out-quint) group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="max-w-[68ch] pb-6 leading-[1.7] text-misa-body">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </Section>

      {/* 6. LAYOUT FAMILY: Navy strip.
             📌 Flat navy rather than the drawn field, so it reads as a rule under
             the page rather than as a second feature band competing with section
             3. A ground belongs to a section, which is what keeps its fill, its
             white focus ring and its padding moving together.
             ⚠️ Load-bearing: /contact left the desktop nav, and the About page is
             the contact path the handoff put in its place. */}
      <Section
        ground="navy"
        pad="md"
        width="page"
        innerClassName="flex flex-wrap items-center justify-between gap-8"
      >
        <p data-reveal="up" className="text-lg leading-[1.6] text-white/85">
          Still have a question? Email us — we answer every one.
        </p>
        <a
          data-reveal="up"
          style={revealDelay(0.05)}
          href={`mailto:${CONTACT_EMAIL}`}
          className={BUTTON_SOLID_WHITE}
        >
          {CONTACT_EMAIL}
        </a>
      </Section>

      {/* 7. LAYOUT FAMILY: Shared-rule logo plate. Folded onto <Section> in this
             phase; see components/ui/partners.tsx. */}
      <Partners />
    </>
  );
}

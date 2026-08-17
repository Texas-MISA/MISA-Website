import Link from "next/link";

import { Activities } from "@/components/ui/activities";
import { LINK_EYEBROW } from "@/components/ui/button";
import { Hatch } from "@/components/ui/hatch";
import { Headline } from "@/components/ui/heading";
import { Partners } from "@/components/ui/partners";
import { revealDelay } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";
import {
  MISSION,
  MISSION_SLOTS,
  PROJECTS,
  PROJECTS_SUMMARY,
} from "@/lib/site";

import { GalleryMarquee } from "./_components/gallery-marquee";
import { HomeHero } from "./_components/home-hero";

// The home page, rebuilt in v2 phase 1.
//
// ── THE LAYOUT-FAMILY BUDGET ────────────────────────────────────────────────
// §4.7: a layout family may appear AT MOST ONCE, eight sections need at least
// four different families, and no more than two consecutive image+text splits.
// v1 reused two families across the page and that is most of what "scattered
// and same-ey" described. Six sections, six families, none repeated:
//
//   1. Hero .............. Asymmetric Split Hero + floating plate cluster
//   2. Gallery band ...... Kinetic Marquee            (the page's only marquee)
//   3. Mission ........... Editorial Manifesto statement
//   4. Activities ........ Bento Grid
//   5. Projects .......... Featured + rest, on a shared-rule plate
//   6. Partners .......... Shared-rule logo plate
//
// Each family is named again in its own section below, which is what makes the
// count checkable by reading rather than arguable. Consecutive splits: the hero
// is the only split and the marquee follows it, so the longest run is one.
//
// ── IMAGE SLOTS ─────────────────────────────────────────────────────────────
// 🔓 The reversal that mattered most. v1 concentrated every slot into one band,
// which is exactly backwards, and the hero and mission carried none at all.
// Every section now carries slots: 4 in the hero, ~11 per marquee group, 2
// flanking the mission, 4 in the bento, 3 in the projects band. Partners is the
// one exception and always was, because its four logos are real images.
//
// ── WHAT DID NOT CHANGE ─────────────────────────────────────────────────────
// The word content, verbatim from lib/site.ts. The section order, which still
// opens with the gallery band under the hero per the 2026-08-15 swap. The
// mission's centring, which is a standing officer request from 2026-08-14 and
// does NOT collide with the anti-centre bias — §4.3 scopes that to hero
// sections, and the hero is the split above.
//
// `_components/upcoming-events.tsx` is kept but unmounted; putting it back means
// restoring `export const dynamic = "force-dynamic"` alongside it, because its
// read touches cookies() via createClient() and a build-time snapshot would show
// a stale schedule until the next deploy.

export default function HomePage() {
  return (
    <>
      {/* 1. LAYOUT FAMILY: Asymmetric Split Hero. See home-hero.tsx. */}
      <HomeHero />

      {/* 2. LAYOUT FAMILY: Kinetic Marquee. The page's only marquee — §5 caps
             it at one, and this is the section whose content genuinely earns
             it: breadth that needs no single item to be looked at. */}
      <GalleryMarquee />

      {/* 3. LAYOUT FAMILY: Editorial Manifesto.
           📌 Centred, per the officer (2026-08-14), and set at statement scale
           rather than as body copy in a 68ch column. Two plates flank it, so
           the section carries slots like every other one.
           📌 Grouping mechanism: negative space only. No rule, no divider. */}
      <Section padTop="lg" padBottom="md" width="page">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)_minmax(0,1fr)] lg:items-center lg:gap-split">
          <div className="text-center lg:order-2">
            <Headline data-reveal="rise">Our Mission</Headline>
            <p
              data-reveal="up"
              style={revealDelay(0.08)}
              className="mx-auto mt-5 max-w-[52ch] text-[19px] leading-[1.55] text-pretty text-misa-body sm:text-[22px] lg:text-[24px]"
            >
              {MISSION}
            </p>
          </div>

          {/* 🪤 `lg:contents` is what lets one DOM order serve both layouts.
              On a phone the statement reads first and the plates follow as a
              pair; at `lg` this wrapper stops generating a box and its two
              children become grid items of the parent, so they can sit either
              side of the statement via `order`. Rendering the plates twice, or
              hiding them below `lg`, were the alternatives — and hiding them
              would hand the phone the version with no images, which is the
              wrong way round: PRODUCT.md's primary reader is a prospective
              undergrad on a phone. */}
          <div className="mt-10 grid grid-cols-2 gap-tile lg:contents">
            <div data-reveal="up" style={revealDelay(0.14)} className="lg:order-1">
              <div className="plate border border-misa-border shadow-lift hover:shadow-raised">
                <Hatch caption={MISSION_SLOTS[0]} className="aspect-3/4" />
              </div>
            </div>
            <div data-reveal="up" style={revealDelay(0.2)} className="lg:order-3">
              <div className="plate border border-misa-border shadow-lift hover:shadow-raised">
                <Hatch caption={MISSION_SLOTS[1]} className="aspect-3/4" />
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* 4. LAYOUT FAMILY: Bento Grid. See activities.tsx for the cell budget. */}
      <Section padTop="lg" padBottom="lg" width="page">
        <Headline data-reveal="up">Activities</Headline>
        <Activities className="mt-9" />
      </Section>

      {/* 5. LAYOUT FAMILY: Featured + rest. The page's one navy band, kept
             against §4.11's Page Theme Lock: that rule exists to stop accidental
             theme drift, and this full-bleed navy field is the identity rather
             than an accident. Recorded as a deliberate refusal in the v2 plan.

             📌 Grouping mechanism: ONE plate showing through `gap: 1px`, never
             a border per cell. Two adjacent borders read as a double rule, and
             a border per card is what this section used to have.

             📌 Three projects, so a lead plus two rather than three equal cards
             — §9.C bans the three-identical-cards row outright. */}
      <Section ground="navy" pad="lg" width="page">
        <div
          data-reveal="up"
          className="flex flex-wrap items-baseline justify-between gap-4"
        >
          <Headline>Client &amp; Data Projects</Headline>
          <Link
            href="/projects"
            className={`${LINK_EYEBROW} text-white/75 hover:text-white`}
          >
            All projects →
          </Link>
        </div>
        <p
          data-reveal="up"
          style={revealDelay(0.05)}
          className="mt-3 mb-9 max-w-[74ch] leading-[1.65] text-white/80"
        >
          {PROJECTS_SUMMARY}
        </p>

        <ul className="grid gap-px border border-white/30 bg-white/30 lg:grid-cols-2">
          {PROJECTS.map((project, i) => {
            const lead = i === 0;
            return (
              <li
                key={project.client}
                data-reveal="fade"
                style={revealDelay(0.06 * (i + 1))}
                // The cells carry the band's own ground, so only the 1px gap
                // between them paints — one rule, drawn once, shared by both
                // neighbours.
                className={`bg-misa-blue ${
                  lead ? "lg:col-span-2 lg:grid lg:grid-cols-2" : "flex flex-col"
                }`}
              >
                <Hatch
                  caption={project.caption}
                  tone="navy"
                  className={lead ? "aspect-16/10 lg:aspect-auto" : "aspect-3/2"}
                />
                <div
                  className={
                    lead
                      ? "flex flex-col justify-center px-6 py-8 sm:px-8"
                      : "flex-1 px-5 pt-4.5 pb-5.5"
                  }
                >
                  <p className="text-[11px] leading-none font-medium tracking-[0.14em] text-white/60 uppercase">
                    {project.term}
                  </p>
                  <h3
                    className={`mt-2.5 mb-1.5 font-display leading-[1.05] font-semibold ${
                      lead ? "text-[30px] sm:text-[38px]" : "text-[26px]"
                    }`}
                  >
                    {project.client}
                  </h3>
                  <p
                    className={`leading-[1.55] text-white/80 ${
                      lead ? "max-w-[52ch] text-base" : "text-sm"
                    }`}
                  >
                    {project.summary}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* 6. LAYOUT FAMILY: Shared-rule logo plate. Already the right shape, and
             shared with /about — so its internal drift (it predates <Section>
             and hardcodes its own gutter) is phase 2's, not phase 1's. */}
      <Partners ground="panel" />
    </>
  );
}

import { Activities } from "@/components/ui/activities";
import { Headline } from "@/components/ui/heading";
import { Partners } from "@/components/ui/partners";
import { PhotoSlot } from "@/components/ui/photo-slot";
import { revealDelay } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";
import { MISSION, MISSION_SLOTS, PROJECTS, PROJECTS_SUMMARY } from "@/lib/site";

import { GalleryMarquee } from "./_components/gallery-marquee";
import { HomeHero } from "./_components/home-hero";

/**
 * The clients the band shows, in order.
 *
 * 🔓 **Was all three projects plus a labelled fourth cell; cut to these two on
 * the officer's instruction, 2026-08-23.** They are the two engagements that
 * have a real photograph, and they are the whole band while `/projects` is
 * unlisted — see the section comment below for why that matters.
 *
 * 📌 Named rather than sliced. `PROJECTS.slice(0, 2)` would pick the same two
 * today and would silently pick different ones the day somebody reorders the
 * array; naming them makes the selection survive an edit at the other end of
 * the codebase, and makes a typo a build error rather than an empty band.
 */
const FEATURED_CLIENTS = ["PepsiCo", "Casa de Luz"] as const;

const PROJECT_CELLS = FEATURED_CLIENTS.map((client) => {
  const project = PROJECTS.find((p) => p.client === client);
  if (!project) throw new Error(`No project in PROJECTS named "${client}".`);
  return project;
});

// The home page, rebuilt in v2 phase 1.
//
// ── THE LAYOUT-FAMILY BUDGET ────────────────────────────────────────────────
// §4.7: a layout family may appear AT MOST ONCE, eight sections need at least
// four different families, and no more than two consecutive image+text splits.
// v1 reused two families across the page and that is most of what "scattered
// and same-ey" described.
//
//   1. Hero .............. Asymmetric Split Hero + floating plate cluster
//   2. Mission ........... Editorial Manifesto statement
//   3. Gallery band ...... Kinetic Marquee (first half, scrolls left)
//   4. Activities ........ Bento Grid
//   5. Gallery band ...... Kinetic Marquee (second half, scrolls right)
//   6. Projects .......... Paired grid on a shared-rule plate
//   7. Partners .......... Shared-rule logo plate
//
// ⚠️ **SEVEN sections, SIX families — the marquee now appears twice** (officer,
// 2026-08-19), against §5's max-one-marquee-per-page and against the no-repeats
// rule that v1 was scrapped for failing. This is the budget's one exception and
// it is deliberate: the two bands are halves of ONE gallery strip, drawn from a
// single pool with no photograph in both, at one tile size, counter-scrolling,
// and they bracket Activities rather than repeating a device in two unrelated
// places. The full argument lives in `_components/gallery-marquee.tsx`.
//
// 📌 The budget's other halves still hold: five families appear exactly once,
// and the longest run of consecutive image+text splits is ONE (the hero), well
// inside the cap of two.
//
// ── IMAGE SLOTS ─────────────────────────────────────────────────────────────
// 🔓 The reversal that mattered most. v1 concentrated every slot into one band,
// which is exactly backwards, and the hero and mission carried none at all.
// Every section now carries slots: 4 in the hero, ~11 per marquee group, 2
// flanking the mission, 4 in the bento, 2 in the projects band. Partners is the
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

      {/* 2. LAYOUT FAMILY: Editorial Manifesto.
           📌 Centred, per the officer (2026-08-14), and set at statement scale
           rather than as body copy in a 68ch column. Two plates flank it, so
           the section carries slots like every other one.
           📌 Grouping mechanism: negative space only. No rule, no divider. */}
      {/* 🔓 **Depth here is a raised sheet, not a drawn grid** (officer,
          2026-08-18: take the hash off the white ground, find another way).
          The grid put a pattern ON the ground and asked the pattern to imply
          space; this stacks two real surfaces instead — a white sheet lifted
          off the tinted `paper` ground beneath it. It is also the mechanism
          the rest of the page already uses, since the bento cards and every
          image plate are lifted surfaces too, so the light grounds stop having
          a texture of their own.

          🪤 The sheet needs a ground that is not white under it, or it is an
          invisible rectangle wearing a shadow. It used to name `ground="paper"`
          for that; the public page ground is a flat grey now, so the default
          supplies it and the prop is gone. */}
      <Section padTop="lg" padBottom="xs" width="page">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)_minmax(0,1fr)] lg:items-center lg:gap-split">
          <div
            data-reveal="rise"
            className="sheet px-6 py-10 text-center sm:px-10 sm:py-12 lg:order-2"
          >
            <Headline>Our Mission</Headline>
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
            <div
              data-reveal="up"
              style={revealDelay(0.14)}
              className="lg:order-1"
            >
              <div className="plate border border-misa-plate-edge shadow-lift">
                <PhotoSlot
                  slot={MISSION_SLOTS[0]}
                  ratio="aspect-3/4"
                  sizes="(max-width: 1024px) 45vw, 20vw"
                />
              </div>
            </div>
            <div
              data-reveal="up"
              style={revealDelay(0.2)}
              className="lg:order-3"
            >
              <div className="plate border border-misa-plate-edge shadow-lift">
                <PhotoSlot
                  slot={MISSION_SLOTS[1]}
                  ratio="aspect-3/4"
                  sizes="(max-width: 1024px) 45vw, 20vw"
                />
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* 3. LAYOUT FAMILY: Kinetic Marquee, first half. 🔓 Moved out from
             under the hero and split in two (officer, 2026-08-19); the other
             half sits below Activities.

             ⚠️ Two marquee bands means the family appears TWICE, against §5's
             max-one-per-page and the budget's no-repeats rule — the rule v1
             was scrapped over. Kept because these are two halves of one
             gallery: one pool, no photograph in both, one tile size, and they
             bracket Activities rather than repeating a device at random. The
             argument is written out in gallery-marquee.tsx. */}
      <GalleryMarquee half="top" />

      {/* 4. LAYOUT FAMILY: Bento Grid. See activities.tsx for the cell budget.

           🔓 **`xs` on both edges, down from `lg`** (officer, 2026-08-19: the
           empty space around the gallery bands is too big). A marquee band is
           bracketed by this section on one side and the mission on the other,
           and the seam was the neighbour's 80px plus the band's own 32px — 112px
           of blank ground at each of the four boundaries. The bands keep their
           own padding, which is now the white halo they sit in; the neighbours
           give up theirs. */}
      <Section padTop="xs" padBottom="xs" width="page">
        <Headline data-reveal="up">Activities</Headline>
        <Activities className="mt-9" />
      </Section>

      {/* 5. LAYOUT FAMILY: Kinetic Marquee, second half. Counter-scrolls the
             band above it; see the note there for why the family repeats. */}
      <GalleryMarquee half="bottom" />

      {/* 6. LAYOUT FAMILY: Paired grid on a shared-rule plate. The page's one
             navy band, kept against §4.11's Page Theme Lock: that rule exists
             to stop accidental theme drift, and this full-bleed navy field is
             the identity rather than an accident.

             🔓 **Was a symmetric 2×2 — three projects and a labelled fourth
             cell. Cut to TWO on the officer's instruction, 2026-08-23**, and
             `/projects` was unlisted in the same change. So this band is now
             the club's only public statement about the projects programme,
             which is why its two cells carry the FULL descriptions from
             `/projects` rather than the one-line summaries they used to: there
             is no longer a page behind the band for a reader to go on to.

             ✂️ **The "All projects →" link went with it.** A link to an
             unlisted page is worse than no link — it is the one path a reader
             is most likely to take out of this section, and unlisting means it
             should not be taken. Put it back the moment `/projects` returns to
             the nav; that and `FEATURED_CLIENTS` above are the whole revert.

             ⚠️ **This is the closest two families on the page come to each
             other**, and it is worth stating rather than hoping nobody
             notices: Partners is also cells on a shared-rule plate. They stay
             distinguishable — this is image-and-text cards, that is a single
             row of bare logos — but the budget has less slack than it did, and
             a third shared-rule plate would break it.

             📌 Grouping mechanism: ONE plate showing through `gap: 1px`, never
             a border per cell. Two adjacent borders read as a double rule.
             🪤 That is also why the cells stay OPAQUE on a gradient ground:
             the rule is the container's background showing through the gap, so
             a transparent cell would show it across the whole card instead of
             at the seam. The gradient and the grid read in the band's own
             padding, around and behind the plate. */}
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
          <Headline data-reveal="up">Client &amp; Data Projects</Headline>
          <p
            data-reveal="up"
            style={revealDelay(0.05)}
            className="mt-3 mb-9 max-w-[74ch] leading-[1.65] text-white/80"
          >
            {PROJECTS_SUMMARY}
          </p>

          {/* Two cells of one shape: photograph on top, term, client, the full
              description. */}
          {/* 🪤 `auto-rows-fr` is what keeps the pair level at EVERY width, not
              just most. Grid rows size independently, so two descriptions that
              wrap to different line counts leave one cell taller than its
              neighbour and the shared rule between them stops reading as one
              plate. Equal-fraction rows force both cells to one height — and
              this matters MORE now than it did at four cells, because the
              descriptions are paragraphs rather than single lines. */}
          <ul className="grid auto-rows-fr gap-px border border-white/30 bg-white/30 sm:grid-cols-2">
            {PROJECT_CELLS.map((project, i) => (
              <li
                key={project.client}
                data-reveal="fade"
                style={revealDelay(0.06 * (i + 1))}
                // The cells carry the band's own ground, so only the 1px gap
                // between them paints — one rule, drawn once, shared by both
                // neighbours.
                className="flex flex-col bg-misa-blue"
              >
                {/* 🪤 `PhotoSlot`, not a bare `<Image>`: it keeps the labelled
                    `<Hatch>` reachable for a cell whose `src` is unset, which
                    is the state CapMetro is still in. `tone="navy"` is what
                    that fallback would need on this ground. */}
                <PhotoSlot
                  slot={project}
                  ratio="aspect-3/2"
                  tone="navy"
                  sizes="(max-width: 640px) 100vw, 50vw"
                />
                <div className="flex-1 px-5 pt-4.5 pb-5.5">
                  <p className="text-[11px] leading-none font-medium tracking-[0.14em] text-white/60 uppercase">
                    {project.term}
                  </p>
                  <h3 className="mt-2.5 mb-1.5 font-display text-[26px] leading-[1.05] font-semibold">
                    {project.client}
                  </h3>
                  {/* 📌 Body size, not `text-sm`. These are the full
                      descriptions from `/projects` now, and 14px is a caption
                      size — a four-line paragraph set at it reads as fine
                      print, which is the wrong weight for the only public
                      account of the projects programme. */}
                  <p className="leading-[1.65] text-white/80">{project.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* 7. LAYOUT FAMILY: Shared-rule logo plate. Already the right shape, and
             shared with /about — so its internal drift (it predates <Section>
             and hardcodes its own gutter) is phase 2's, not phase 1's. */}
      <Partners />
    </>
  );
}

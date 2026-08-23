import type { Metadata } from "next";

import {
  BUTTON_OUTLINE_WHITE,
  BUTTON_SOLID_WHITE,
} from "@/components/ui/button";
import { PageHero } from "@/components/ui/chevron-section";
import { Tag } from "@/components/ui/chip";
import { Headline } from "@/components/ui/heading";
import { PhotoSlot } from "@/components/ui/photo-slot";
import { Pill } from "@/components/ui/pill";
import { revealDelay } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";
import {
  CORPORATE_EMAIL,
  PROJECT_STATS,
  PROJECTS,
  PROJECTS_INTRO,
  WORK_WITH_MISA,
} from "@/lib/site";

export const metadata: Metadata = {
  title: "Projects",
  description: "Turning classroom knowledge into real-world impact.",
  // ✂️ **UNLISTED, temporarily (officer, 2026-08-23).** The page still renders
  // and the route still resolves; it is simply linked from nowhere. `noindex`
  // is the other half of that — a page dropped from the nav but left indexable
  // stays in search results for as long as the cache lives, which outlives the
  // deploy that unlisted it (the same reason `/leaderboard` carries this).
  //
  // 📌 `follow: false` too, because the page links out to `mailto:` and nothing
  // here needs crawling on its way somewhere else.
  //
  // 🔓 **Relisting is four places**: this key, `SITE_NAV` and `MOBILE_NAV` in
  // `components/site-header.tsx`, and the "All projects →" link on the home
  // page's projects band. All four carry a comment pointing at the others.
  robots: { index: false, follow: false },
};

// /projects, rebuilt from scratch in v2 phase 2.
//
// 🔴 **BUILT FROM THE HOME PAGE, NOT FROM THE OLD /projects.** The exact words
// are kept and nothing else is. What was here rendered the three projects as
// three CONSECUTIVE image+text splits alternating left and right, each
// `<article>` carrying `border-t border-misa-hairline … last:border-b`. That is
// two named failures in one section: §4.7 caps consecutive image+text splits at
// TWO and calls the third a pre-flight fail, and §9.F bans a border on every row
// of a list outright. "The layout and spacing is very scattered and same-ey. The
// lines separating sections are scattered" was the officer's verdict on v1, and
// this page was the clearest surviving example of it on `main`.
//
// ── THE LAYOUT-FAMILY BUDGET ────────────────────────────────────────────────
//
//   1. Hero .............. Page hero (field + chevron notch)
//   2. Intro ............. Statement on a raised sheet
//   3. The projects ...... Bento grid, 3 cells
//   4. Work with MISA .... Shared-rule stat plate on the navy field
//
// FOUR sections, FOUR families, none repeated, and ZERO image+text splits. The
// project cells carry their photograph ON TOP, the way the home page's bento
// cells do.
//
// 📌 **Bento cell count is EXACT: three projects, three cells.** §4.7 is blunt
// that a grid with an empty cell means the grid was planned wrong. One large
// lead spanning two of three columns and both rows, the other two stacked
// beside it — the large-plus-two rhythm `activities.tsx` uses, and deliberately
// NOT three equal cards, which §9 names as an AI tell and which the home page's
// symmetric 2×2 already occupies.
//
// 📌 The right column's two cells measure 631 + 20 + 546 = 1197px against the
// lead's 1197px, so the row closes exactly with no dangling gap.
//
// 🪤 **`Tag` fills with `bg-misa-panel`, which IS the page ground's colour.** On
// the grey ground a skill tag would be the same colour as what is behind it. The
// fix is that the tags sit inside a WHITE bento cell — never a recoloured
// primitive, since `chip.tsx` is shared with all of /admin, and not a
// `ground="white"` section either, which would flatten the cells' own lift.
//
// 📌 **Eyebrow count: ZERO**, against a cap of ceil(4 / 3) = 2. The `Pill`
// carrying each term is a data pill on a card and the stat labels are stat
// labels; neither is a micro-label above a section headline.
//
// 🔓 **TWO OF THE THREE PHOTOGRAPHS LANDED on 2026-08-23** (officer), which is
// the restore path this comment used to describe: give a `PROJECTS` entry a
// `src` and an `alt` and `PhotoSlot` swaps the labelled `<Hatch>` for the real
// image. CapMetro is still a `<Hatch>` and the page is correct either way — the
// mixed state is exactly what `PhotoSlot` exists to make survivable.
//
// 📌 What made the pairing acceptable is that these are photographs OF THE
// CLIENT rather than of the club: a PepsiCo campus sign, the Casa de Luz
// kitchen. The objection the placeholder answered was pairing a MISA photograph
// to a named client, which asserts something nobody supplied. See `PROJECTS` in
// `lib/site.ts`.
//
// 📌 This page renders exactly the projects that exist, and always did — the
// home page's fourth "project to be confirmed" cell was never here, and it no
// longer exists there either.

/** The lead commission, and the two beneath it. */
const [FEATURED, ...REST] = PROJECTS;

export default function ProjectsPage() {
  return (
    <>
      {/* 1. LAYOUT FAMILY: Page hero. */}
      <PageHero
        title="Client & Data Projects"
        subhead="Turning classroom knowledge into real-world impact."
      />

      {/* 2. LAYOUT FAMILY: Statement on a raised sheet.
             📌 One paragraph carrying the section, set at statement scale on a
             white sheet lifted off the grey. That is the home page's mission
             surface doing the same job here.
             🪤 The sheet needs a ground that is NOT white beneath it or it is an
             invisible rectangle wearing a shadow. The page ground supplies it.
             📌 Left-aligned, not centred: this is a long explanatory paragraph
             rather than a one-line thesis, and centred body copy past two lines
             costs the reader the left edge. */}
      <Section padTop="sm" padBottom="sm" width="page">
        <div data-reveal="rise" className="sheet px-6 py-10 sm:px-12 sm:py-12">
          <p className="max-w-[74ch] text-[17px] leading-[1.65] text-pretty text-misa-body sm:text-[19px]">
            {PROJECTS_INTRO}
          </p>
        </div>
      </Section>

      {/* 3. LAYOUT FAMILY: Bento grid, three cells.
             📌 THREE declared columns, and the tracks the layout actually has.
             A 12-column grid at the 56px gutter is eleven gaps, 616px of gutter
             before any content, and every track collapses on a phone; the home
             page's bento hit exactly that and declared six for four cells.
             📌 Grouping mechanism: the gap, plus each cell's own lift. No rules
             between cells, which is the whole point of the rebuild.
             📌 Mobile collapse is explicit: one column below `sm`, two at `sm`
             with the lead spanning both, and the bento only from `lg`. */}
      <Section padTop="none" padBottom="md" width="page">
        {/* 🐛 **The lead used to span all six columns with a 21:9 frame, and it
            was wrong.** At the 1400px page that is a 1284×550 cell, and while
            the photograph is still a placeholder it renders as 550px of bare
            hatch dominating the section — DESIGN.md already warns that the light
            hatch reads weakly on the grey ground, and at that size it reads as
            an error rather than as a pending photograph. Large-left with the two
            others stacked beside it is the shape `activities.tsx` uses, keeps
            the same three cells, and cuts the placeholder area by more than
            half. */}
        <div className="grid gap-card sm:grid-cols-2 lg:grid-cols-3">
          <article
            data-reveal="rise"
            className="plate flex flex-col border border-misa-plate-edge bg-white shadow-lift sm:col-span-2 lg:col-span-2 lg:row-span-2"
          >
            <PhotoSlot
              slot={FEATURED}
              // The bigger cell is what makes this one the lead. A bento varies
              // cell SIZE by design, which is the one property moving here.
              ratio="aspect-16/10"
              sizes="(max-width: 1024px) 100vw, 58vw"
            />
            <div className="grid gap-x-split gap-y-5 px-6 pt-6 pb-7 sm:px-8 sm:pb-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <div>
                <Pill tone="info" size="sm">
                  {FEATURED.term}
                </Pill>
                <h2 className="mt-3 mb-2 font-display text-[26px] leading-[1.05] font-semibold tracking-[-0.015em] text-misa-blue sm:text-[32px]">
                  {FEATURED.client}
                </h2>
                <p className="leading-[1.65] text-misa-secondary">
                  {FEATURED.body}
                </p>
              </div>
              <ul className="flex flex-wrap content-start gap-2 lg:pt-11">
                {FEATURED.skills.map((skill) => (
                  <li key={skill}>
                    {/* 🪤 On WHITE. `Tag` fills `bg-misa-panel`, the page
                        ground's own colour, so outside this cell it would be
                        invisible against what is behind it. */}
                    <Tag>{skill}</Tag>
                  </li>
                ))}
              </ul>
            </div>
          </article>

          {REST.map((project, i) => (
            <article
              key={project.client}
              data-reveal="up"
              style={revealDelay(0.08 + 0.06 * i)}
              className="plate flex flex-col border border-misa-plate-edge bg-white shadow-lift"
            >
              <PhotoSlot
                slot={project}
                ratio="aspect-3/2"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 46vw, 29vw"
              />
              <div className="flex flex-1 flex-col px-6 pt-6 pb-7">
                {/* 🐛 `self-start` is load-bearing. `Pill` is `inline-flex`, but
                    a flex COLUMN stretches its children across the cross axis by
                    default, so inside this card the term pill grew to the full
                    card width and read as a bordered banner rather than a chip.
                    The lead card above does not need it because its pill sits in
                    a plain block, which is exactly why the bug showed up in two
                    cells and not three. */}
                <Pill tone="info" size="sm" className="self-start">
                  {project.term}
                </Pill>
                <h2 className="mt-3 mb-2 font-display text-[24px] leading-[1.05] font-semibold tracking-[-0.015em] text-misa-blue sm:text-[26px]">
                  {project.client}
                </h2>
                <p className="leading-[1.65] text-misa-secondary">
                  {project.body}
                </p>
                <ul className="mt-5 flex flex-wrap gap-2 pt-1">
                  {project.skills.map((skill) => (
                    <li key={skill}>
                      <Tag>{skill}</Tag>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* 4. LAYOUT FAMILY: Shared-rule stat plate on the navy field.
             📌 The home page's closing device, carrying this page's ask. The
             four stats are ONE plate with the rule drawn once by `gap-px`; the
             invitation sits above them.
             📌 PRODUCT.md names corporate partners and recruiters as a real
             readership for this page rather than a hypothetical one, so the page
             ends on the single thing they came to do.
             🪤 The cells stay OPAQUE: the rule is the container's background
             showing through the 1px gap, so a transparent cell would show the
             field across the whole cell instead of at the seam. */}
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
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-split">
            <div>
              <Headline data-reveal="up">Work with MISA</Headline>
              <p
                data-reveal="up"
                style={revealDelay(0.05)}
                className="mt-4 max-w-[62ch] leading-[1.65] text-white/80"
              >
                {WORK_WITH_MISA}
              </p>
            </div>
            <div
              data-reveal="up"
              style={revealDelay(0.1)}
              className="flex flex-col gap-3"
            >
              {/* Both go to corporate relations. The address below is the
                  proposal channel, so the primary action is the same mailto with
                  a subject line rather than a form nobody would receive. */}
              <a
                href={`mailto:${CORPORATE_EMAIL}?subject=${encodeURIComponent(
                  "Project proposal for MISA",
                )}`}
                className={`${BUTTON_SOLID_WHITE} justify-between`}
              >
                Propose a project <span aria-hidden="true">→</span>
              </a>
              <a
                href={`mailto:${CORPORATE_EMAIL}`}
                className={BUTTON_OUTLINE_WHITE}
              >
                {CORPORATE_EMAIL}
              </a>
            </div>
          </div>

          {/* 🪤 `wipe` draws the plate on from the left rather than moving it in,
              which is the variant for a shared-rule surface. It animates
              `clip-path`, so it carries its own `[data-revealed]` rule, and
              NOTHING ROTATED may go inside it — a clip-path clips descendants
              and a rotated child always leaves its box. Four upright stat cells
              are safe. */}
          <ul
            data-reveal="wipe"
            style={revealDelay(0.16)}
            className="mt-11 grid auto-rows-fr grid-cols-2 gap-px border border-white/30 bg-white/30 sm:grid-cols-4"
          >
            {PROJECT_STATS.map((stat) => (
              <li key={stat.label} className="bg-misa-blue px-6 py-6">
                <p className="font-display text-[32px] leading-none font-semibold text-white sm:text-[36px]">
                  {stat.value}
                </p>
                <p className="mt-2 text-xs leading-tight font-medium tracking-[0.14em] text-white/65 uppercase">
                  {stat.label}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </>
  );
}

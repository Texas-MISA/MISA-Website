import Link from "next/link";

import { Activities } from "@/components/ui/activities";
import { LINK_EYEBROW } from "@/components/ui/button";
import { PageHero } from "@/components/ui/chevron-section";
import { Hatch } from "@/components/ui/hatch";
import { Headline } from "@/components/ui/heading";
import { Partners } from "@/components/ui/partners";
import { revealDelay } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";
import { MISSION, PROJECTS, PROJECTS_SUMMARY, TAGLINE } from "@/lib/site";

import { GalleryMarquee } from "./_components/gallery-marquee";

// The home page. Section order is the handoff's, with one deliberate departure
// that predates this file's current shape: the gallery band and the mission
// SWAPPED on 2026-08-15, by request, so the band opens the page under the hero.
//
// 📌 The rhythm now comes from <Section> rather than from ten hand-tuned
// paddings. What used to be `pt-14 pb-5 sm:pt-16 sm:pb-6` here, `pt-13` there
// and a bare `mt-12` on the projects band is one scale — and the `mt-12` in
// particular was a margin BETWEEN sections, which the Section Owns Its Padding
// Rule exists to prevent. The gallery band keeps `flush`, because the hero is
// the one neighbour that donates no spacing of its own: its `pb-28` is consumed
// by the chevron notch, so the next section begins at the notch's tip.
//
// 📌 Entrances vary by role rather than being `up` five times. The mission is
// the page's one `rise`; the project cards `fade` in a stagger, because a card
// that slides is a card the reader waits for before they can read it.
//
// `_components/upcoming-events.tsx` is kept but unmounted; putting it back means
// restoring `export const dynamic = "force-dynamic"` alongside it, because its
// read touches cookies() via createClient() and a build-time snapshot would show
// a stale schedule until the next deploy.

export default function HomePage() {
  return (
    <>
      <PageHero
        size="home"
        title={
          <>
            Management Information
            <br />
            Systems Association
          </>
        }
        tagline={TAGLINE}
      />

      <GalleryMarquee />

      {/* Mission. Centred by request (2026-08-14) — do not restore the
          two-column split the handoff had here. */}
      <Section padTop="sm" padBottom="xs" width="prose">
        <div className="text-center">
          <Headline data-reveal="rise">Our Mission</Headline>
          <p
            data-reveal="up"
            style={revealDelay(0.08)}
            className="mt-4 leading-[1.65] text-pretty text-misa-body"
          >
            {MISSION}
          </p>
        </div>
      </Section>

      <Section padTop="md" padBottom="flush" width="page">
        <Headline data-reveal="up">Activities</Headline>
        <Activities className="mt-9" />
      </Section>

      {/* Client & Data Projects — the page's one navy band. */}
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
        <ul className="grid gap-card sm:grid-cols-2 lg:grid-cols-3">
          {PROJECTS.map((project, i) => (
            <li
              key={project.client}
              data-reveal="fade"
              style={revealDelay(0.06 * (i + 1))}
              className="border border-white/30"
            >
              <Hatch
                caption={project.caption}
                tone="navy"
                className="aspect-3/2 border-b border-white/30"
              />
              <div className="px-5 pt-4.5 pb-5.5">
                <p className="text-[11px] leading-none font-medium tracking-[0.14em] text-white/60 uppercase">
                  {project.term}
                </p>
                <h3 className="mt-2.5 mb-1.5 font-display text-[26px] leading-[1.05] font-semibold">
                  {project.client}
                </h3>
                <p className="text-sm leading-[1.55] text-white/80">
                  {project.summary}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Partners ground="panel" />
    </>
  );
}

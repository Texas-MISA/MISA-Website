import Link from "next/link";

import { Activities } from "@/components/ui/activities";
import { LINK_EYEBROW } from "@/components/ui/button";
import { PageHero } from "@/components/ui/chevron-section";
import { Hatch } from "@/components/ui/hatch";
import { Partners } from "@/components/ui/partners";
import { revealDelay } from "@/components/ui/reveal";
import { MISSION, PROJECTS, PROJECTS_SUMMARY, TAGLINE } from "@/lib/site";

import { GalleryMarquee } from "./_components/gallery-marquee";

// The home page, per the design handoff's section order.
//
// Every section now renders from lib/site.ts constants, so there is nothing
// request-time left to force. `_components/upcoming-events.tsx` is kept but
// unmounted; putting it back means restoring `export const dynamic =
// "force-dynamic"` alongside it, because its read touches cookies() via
// createClient() and a build-time snapshot would show a stale schedule until
// the next deploy.

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

      {/* Mission, centred — the schedule column that sat beside it is out */}
      <section className="px-5 py-14 sm:px-14 sm:py-16">
        <div data-reveal="up" className="mx-auto max-w-[68ch] text-center">
          <h2 className="mb-4 font-display text-[30px] leading-none font-semibold tracking-[-0.02em] text-misa-blue sm:text-[42px]">
            Our Mission
          </h2>
          <p className="leading-[1.65] text-misa-body text-pretty">{MISSION}</p>
        </div>
      </section>

      <GalleryMarquee />

      <section className="px-5 pt-13 sm:px-14">
        <h2
          data-reveal="up"
          className="font-display text-[30px] leading-none font-semibold tracking-[-0.02em] sm:text-[42px]"
        >
          Activities
        </h2>
      </section>
      <section className="px-5 pb-2 sm:px-14">
        <Activities />
      </section>

      {/* Client & Data Projects */}
      <section className="on-navy mt-12 bg-misa-blue px-5 py-16 text-white sm:px-14">
        <div
          data-reveal="up"
          className="mb-2.5 flex flex-wrap items-baseline justify-between gap-4"
        >
          <h2 className="font-display text-[30px] leading-none font-semibold tracking-[-0.02em] sm:text-[42px]">
            Client &amp; Data Projects
          </h2>
          <Link
            href="/projects"
            className={`${LINK_EYEBROW} text-white/75 hover:text-white`}
          >
            All projects →
          </Link>
        </div>
        <p className="mb-8 max-w-[74ch] leading-[1.65] text-white/80">
          {PROJECTS_SUMMARY}
        </p>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PROJECTS.map((project, i) => (
            <li
              key={project.client}
              data-reveal="up"
              style={revealDelay(0.05 * (i + 1))}
              className="border border-white/30"
            >
              <Hatch
                caption={project.caption}
                tone="navy"
                className="aspect-3/2 border-b border-white/30"
              />
              <div className="px-5 pt-4.5 pb-5.5">
                <p className="text-[11px] leading-none font-medium tracking-[0.14em] uppercase text-white/60">
                  {project.term}
                </p>
                <h3 className="mt-2.5 mb-1.5 font-display text-[26px] leading-[1.05] font-semibold">
                  {project.client}
                </h3>
                <p className="text-sm leading-[1.55] text-white/80">{project.summary}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Partners ground="panel" />
    </>
  );
}

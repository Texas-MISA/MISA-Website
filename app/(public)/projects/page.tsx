import type { Metadata } from "next";

import { BUTTON_OUTLINE_WHITE, BUTTON_SOLID_WHITE } from "@/components/ui/button";
import { PageHero } from "@/components/ui/chevron-section";
import { Hatch } from "@/components/ui/hatch";
import { KpiPlate } from "@/components/ui/kpi-plate";
import { revealDelay } from "@/components/ui/reveal";
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
};

export default function ProjectsPage() {
  return (
    <>
      <PageHero
        title="Client & Data Projects"
        subhead="Turning classroom knowledge into real-world impact."
      />

      <section className="px-5 pt-16 pb-12 sm:px-14">
        <div data-reveal="up" className="mx-auto max-w-[900px]">
          <KpiPlate stats={PROJECT_STATS} align="center" />
        </div>
        <p
          data-reveal="up"
          style={revealDelay(0.1)}
          className="mx-auto mt-9 max-w-[900px] text-center text-[18px] leading-[1.65] text-misa-body"
        >
          {PROJECTS_INTRO}
        </p>
      </section>

      {/* Case studies, alternating sides */}
      <section className="px-5 pb-14 sm:px-14">
        {PROJECTS.map((project, i) => {
          const photoFirst = i % 2 === 1;
          return (
            <article
              key={project.client}
              data-reveal={photoFirst ? "right" : "left"}
              className="grid items-center gap-11 border-t border-misa-hairline py-10 last:border-b md:grid-cols-2"
            >
              <div>
                <p className="mb-3.5">
                  <span className="inline-block border border-misa-blue/35 px-2.5 py-1 text-[11px] leading-tight font-medium tracking-[0.12em] uppercase text-misa-blue">
                    {project.term}
                  </span>
                </p>
                <h2 className="mb-3 font-display text-[26px] leading-[1.02] font-semibold tracking-[-0.015em] sm:text-[34px]">
                  {project.client}
                </h2>
                <p className="mb-4.5 max-w-[48ch] leading-[1.65] text-misa-secondary">
                  {project.body}
                </p>
                <ul className="flex flex-wrap gap-2.5">
                  {project.skills.map((skill) => (
                    <li
                      key={skill}
                      className="bg-misa-panel px-[11px] py-[5px] text-xs leading-tight font-medium tracking-[0.1em] uppercase text-misa-secondary"
                    >
                      {skill}
                    </li>
                  ))}
                </ul>
              </div>
              <Hatch
                caption={project.caption}
                className={`aspect-16/10 border border-misa-border ${
                  photoFirst ? "md:order-first" : ""
                }`}
              />
            </article>
          );
        })}
      </section>

      {/* Work with MISA */}
      <section className="on-navy grid items-center gap-14 bg-misa-blue px-5 py-16 text-white sm:px-14 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h2 className="mb-3 font-display text-[30px] leading-none font-semibold tracking-[-0.02em] sm:text-[42px]">
            Work with MISA
          </h2>
          <p className="max-w-[60ch] leading-[1.65] text-white/80">{WORK_WITH_MISA}</p>
        </div>
        <div className="flex flex-col gap-2.5">
          {/* Both buttons go to corporate relations — the address below is the
              proposal channel, so the primary action is the same mailto with a
              subject line rather than a form nobody would receive. */}
          <a
            href={`mailto:${CORPORATE_EMAIL}?subject=${encodeURIComponent(
              "Project proposal for MISA"
            )}`}
            className={`${BUTTON_SOLID_WHITE} justify-between`}
          >
            Propose a project <span aria-hidden="true">→</span>
          </a>
          <a href={`mailto:${CORPORATE_EMAIL}`} className={BUTTON_OUTLINE_WHITE}>
            {CORPORATE_EMAIL}
          </a>
        </div>
      </section>
    </>
  );
}

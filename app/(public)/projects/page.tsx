import type { Metadata } from "next";

import {
  BUTTON_OUTLINE_WHITE,
  BUTTON_SOLID_WHITE,
} from "@/components/ui/button";
import { Tag } from "@/components/ui/chip";
import { PageHero } from "@/components/ui/chevron-section";
import { Hatch } from "@/components/ui/hatch";
import { Headline, Title } from "@/components/ui/heading";
import { KpiPlate } from "@/components/ui/kpi-plate";
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
};

export default function ProjectsPage() {
  return (
    <>
      <PageHero
        title="Client & Data Projects"
        subhead="Turning classroom knowledge into real-world impact."
      />

      <Section padTop="md" padBottom="sm" width="measure">
        {/* `wipe` rather than a translate: the plate is a 1px-gap grid over a
            hairline ground, so drawing it on from the left reads as the rules
            being ruled. This is the page's one authored moment. */}
        <div data-reveal="wipe">
          <KpiPlate stats={PROJECT_STATS} align="center" />
        </div>
        <p
          data-reveal="up"
          style={revealDelay(0.1)}
          className="mt-9 text-center text-lg leading-[1.65] text-misa-body"
        >
          {PROJECTS_INTRO}
        </p>
      </Section>

      {/* Case studies, alternating sides */}
      <Section padTop="none" padBottom="md" width="page">
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
                  <Pill tone="info" size="sm">
                    {project.term}
                  </Pill>
                </p>
                <Title as="h2" className="mb-3">
                  {project.client}
                </Title>
                <p className="mb-4.5 max-w-[48ch] leading-[1.65] text-misa-secondary">
                  {project.body}
                </p>
                <ul className="flex flex-wrap gap-2.5">
                  {project.skills.map((skill) => (
                    <li key={skill}>
                      <Tag>{skill}</Tag>
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
      </Section>

      {/* Work with MISA */}
      <Section
        ground="navy"
        pad="md"
        width="page"
        innerClassName="grid items-center gap-14 lg:grid-cols-[1.2fr_0.8fr]"
      >
        <div>
          <Headline data-reveal="up" className="mb-3">
            Work with MISA
          </Headline>
          <p
            data-reveal="up"
            style={revealDelay(0.05)}
            className="max-w-[60ch] leading-[1.65] text-white/80"
          >
            {WORK_WITH_MISA}
          </p>
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
      </Section>
    </>
  );
}

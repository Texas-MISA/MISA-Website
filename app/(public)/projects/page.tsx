import type { Metadata } from "next";

import { ChevronHero } from "@/components/ui/chevron-section";

// Recreation of txmisa.org/general-2 (docs/existing-site-inventory.md).
// Original slug was a Squarespace artifact; this uses /projects.

export const metadata: Metadata = {
  title: "Projects",
  description: "Turning classroom knowledge into real-world impact.",
};

const PROJECTS = [
  {
    client: "PepsiCo",
    body: "MISA teams partnered with PepsiCo to design a software solution that streamlined communication between on-site facility teams and corporate management. The tool enabled faster reporting and resolution of facility issues, improving operational efficiency and internal coordination.",
  },
  {
    client: "Casa de Luz",
    body: "MISA consultants partnered with Casa de Luz, a holistic vegan restaurant in Austin, to boost customer engagement and refine marketing strategies. The team analyzed customer feedback and social media performance, delivering actionable insights to expand outreach and strengthen community connections.",
  },
];

export default function ProjectsPage() {
  return (
    <>
      <ChevronHero>
        <div className="text-center">
          <h1 className="font-display text-4xl font-extrabold sm:text-6xl">Projects</h1>
          <p className="mt-4 text-lg text-foreground/80">
            Turning Classroom Knowledge into Real-World Impact.
          </p>
        </div>
      </ChevronHero>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-3xl font-extrabold sm:text-4xl">
            Past &amp; Current Projects
          </h2>
          <ul className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-2">
            {PROJECTS.map((project) => (
              <li key={project.client}>
                {/* Photo placeholder — the original shows a project photo
                    here. 3:2 box keeps the layout honest until one lands. */}
                <div
                  className="flex aspect-3/2 items-center justify-center bg-misa-panel text-sm text-foreground/40"
                  aria-hidden="true"
                >
                  Photo
                </div>
                <h3 className="mt-4 font-display text-lg font-bold">{project.client}</h3>
                <p className="mt-2 text-sm leading-6 text-foreground/80">{project.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

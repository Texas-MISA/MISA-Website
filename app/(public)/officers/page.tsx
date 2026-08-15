import type { Metadata } from "next";

import { BUTTON_SOLID_WHITE } from "@/components/ui/button";
import { PageHero } from "@/components/ui/chevron-section";
import { OfficerCard } from "@/components/ui/officer-card";
import { revealDelay } from "@/components/ui/reveal";
import { OFFICERS } from "@/lib/officers";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Officers",
  description: "Meet the MISA officer team.",
};

export default function OfficersPage() {
  return (
    <>
      {/* The handoff spells the count out ("Thirteen students"). It is derived
          from the roster instead, because a spelled-out number is a second
          place the roster size is recorded and it goes stale silently the
          first time an officer is added. */}
      <PageHero
        title="Meet the MISA Officers"
        subhead={`${OFFICERS.length} students running the organization this year. Reach out to any of us.`}
      />

      <section className="px-5 pt-14 pb-6 sm:px-14">
        <h2 className="mb-6 font-display text-[30px] leading-none font-semibold tracking-[-0.02em] sm:text-[42px]">
          2025–26 Officer Team
        </h2>

        {/* 🪤 A ten-column grid where every card spans two, so the trailing row
            of three centres under the two full rows of five: the eleventh card
            starts at column 3. Below xl the grid falls back to plain column
            counts and the offset is dropped — it only makes sense at five per
            row. */}
        <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-10">
          {OFFICERS.map((officer, i) => (
            <li
              key={officer.name}
              data-reveal="up"
              // Five per row at xl, so the stagger restarts each row.
              style={revealDelay(0.04 * (i % 5))}
              className={`xl:col-span-2 ${i === 10 ? "xl:col-start-3" : ""}`}
            >
              <OfficerCard officer={officer} />
            </li>
          ))}
        </ul>
      </section>

      <section className="on-navy mt-10 flex flex-wrap items-center justify-between gap-12 bg-misa-blue px-5 py-14 text-white sm:px-14">
        <div>
          <h2 className="mb-2.5 font-display text-[30px] leading-none font-semibold tracking-[-0.02em] sm:text-[42px]">
            Want to join the team?
          </h2>
          <p className="max-w-[56ch] leading-[1.65] text-white/80">
            Junior Director applications are open to freshmen and sophomores of all
            majors, and reopen Fall 2026. Officer elections run at the end of the spring
            semester.
          </p>
        </div>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className={`${BUTTON_SOLID_WHITE} whitespace-nowrap`}
        >
          Email an officer
        </a>
      </section>
    </>
  );
}

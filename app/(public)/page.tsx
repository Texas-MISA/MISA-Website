import { OfficerCard } from "@/components/ui/officer-card";
import { Partners } from "@/components/ui/partners";
import { Pillars } from "@/components/ui/pillars";
import { OFFICERS } from "@/lib/officers";
import { MISSION } from "@/lib/site";

import { UpcomingEvents } from "./_components/upcoming-events";

// Recreation of txmisa.org's home page (docs/existing-site-inventory.md), plus
// the live Upcoming Events section the original doesn't have.
//
// The events read touches cookies() via createClient(), which forces
// request-time rendering; declaring it keeps the intent explicit rather than
// incidental. A build-time snapshot would show a stale schedule until the next
// deploy.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <>
      {/* Black hero with the chevron notch at the bottom */}
      <section
        className="bg-black px-6 pt-28 pb-36 text-white sm:pt-36 sm:pb-44"
        style={{
          clipPath:
            "polygon(0 0, 100% 0, 100% calc(100% - 48px), 50% 100%, 0 calc(100% - 48px))",
        }}
      >
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="font-display text-4xl font-extrabold leading-tight sm:text-6xl">
            Management Information Systems Association
          </h1>
          <p className="mt-6 font-display text-lg font-bold italic sm:text-2xl">
            — Where Analytics, Innovation, and Leadership Converge —
          </p>
        </div>
      </section>

      {/* Four pillars */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <Pillars />
        </div>
      </section>

      {/* Scrolling "TEXAS MISA" band. Two copies of the list in one track, so
          translating -50% loops seamlessly. */}
      <div className="overflow-hidden border-y-2 border-black bg-misa-blue py-4">
        <div className="flex w-max animate-marquee" aria-hidden="true">
          {[0, 1].map((copy) => (
            <ul key={copy} className="flex">
              {Array.from({ length: 6 }, (_, i) => (
                <li
                  key={i}
                  className="px-6 font-display text-2xl font-extrabold whitespace-nowrap text-white sm:text-3xl"
                >
                  TEXAS MISA
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>

      {/* Mission */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-extrabold sm:text-4xl">
            Our Mission:
          </h2>
          <p className="mt-6 leading-7 text-foreground/85">{MISSION}</p>
        </div>
      </section>

      {/* Live schedule — this repo's addition */}
      <UpcomingEvents />

      <Partners heading="Our Amazing Partners" />

      {/* Officer grid — no LinkedIn buttons here, matching the original */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center font-display text-3xl font-extrabold sm:text-4xl">
            Meet the MISA Officers!
          </h2>
          <ul className="mt-12 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {OFFICERS.map((officer) => (
              <li key={officer.name}>
                <OfficerCard officer={officer} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

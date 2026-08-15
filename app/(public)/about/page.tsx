import type { Metadata } from "next";

import { BUTTON_SOLID_WHITE } from "@/components/ui/button";
import { PageHero } from "@/components/ui/chevron-section";
import { KpiPlate } from "@/components/ui/kpi-plate";
import { Partners } from "@/components/ui/partners";
import { PhotoFrame } from "@/components/ui/photo-frame";
import { revealDelay } from "@/components/ui/reveal";
import {
  CONTACT_EMAIL,
  FAQ,
  HISTORY_CARDS,
  HISTORY_STATS,
  MISSION,
  photo,
} from "@/lib/site";

export const metadata: Metadata = {
  title: "About Us",
  description: "Connecting technology with business.",
};

/** The full-bleed 1:1 band, four across with no gap. */
const BAND = ["fall-01", "fall-02", "fall-04", "fall-09"] as const;

export default function AboutPage() {
  return (
    <>
      <PageHero title="About Us" subhead="Connecting technology with business." />

      {/* Mission card beside the photo cluster. ⚠️ These photos are NOT
          duotoned — this cluster and the officer headshots are the two
          full-colour exceptions in the design. */}
      <section className="grid items-stretch gap-12 px-5 pt-14 pb-16 sm:px-14 lg:grid-cols-[1.05fr_0.95fr]">
        <div
          data-reveal="up"
          className="flex flex-col justify-center border border-misa-border px-10 pt-10 pb-11"
        >
          <h2 className="mb-4.5 font-display text-[30px] leading-none font-semibold tracking-[-0.02em] text-misa-blue sm:text-[42px]">
            Our Mission
          </h2>
          <p className="text-[17px] leading-[1.7] text-misa-body">{MISSION}</p>
        </div>

        <div data-reveal="up" style={revealDelay(0.1)} className="flex flex-col gap-4">
          <PhotoFrame
            photo={photo("banquet")}
            className="min-h-55 flex-[1.4]"
            position="center 40%"
            sizes="(max-width: 1024px) 100vw, 45vw"
            priority
          />
          <div className="grid flex-1 grid-cols-2 gap-4">
            <PhotoFrame
              photo={photo("fall-05")}
              className="min-h-35"
              sizes="(max-width: 1024px) 50vw, 22vw"
            />
            <PhotoFrame
              photo={photo("fall-07")}
              className="min-h-35"
              sizes="(max-width: 1024px) 50vw, 22vw"
            />
          </div>
        </div>
      </section>

      {/* History */}
      <section className="px-5 pb-16 sm:px-14">
        <div
          data-reveal="up"
          className="grid items-stretch gap-12 border-t border-misa-hairline pt-11 lg:grid-cols-[0.85fr_1.15fr]"
        >
          <div className="flex flex-col">
            <h2 className="mb-6 font-display text-[30px] leading-none font-semibold tracking-[-0.02em] sm:text-[42px]">
              History of MISA
            </h2>
            {/* 🪤 PhotoFrame renders the image with next/image's `fill`, which
                absolutely positions it. That is load-bearing here: with an
                intrinsically sized image the frame grows to the photo's own
                height and leaves a large void beside the column on the right. */}
            <PhotoFrame
              photo={photo("fall-10")}
              className="min-h-85 flex-1"
              position="center 25%"
              duotone
              sizes="(max-width: 1024px) 100vw, 35vw"
            />
          </div>

          <div className="flex flex-col gap-4.5">
            {HISTORY_CARDS.map((card) => (
              <div key={card.eyebrow} className="border border-misa-border px-7 py-6.5">
                <p className="text-xs leading-tight font-medium tracking-[0.14em] uppercase text-misa-blue">
                  {card.eyebrow}
                </p>
                <p className="mt-3 leading-[1.7] text-misa-body">{card.body}</p>
              </div>
            ))}
            <KpiPlate stats={HISTORY_STATS} />
          </div>
        </div>
      </section>

      {/* Full-bleed duotone band */}
      <section className="grid grid-cols-2 sm:grid-cols-4" aria-hidden="true">
        {BAND.map((id) => (
          <PhotoFrame
            key={id}
            photo={photo(id)}
            className="aspect-square"
            duotone
            border="none"
            sizes="(max-width: 640px) 50vw, 25vw"
          />
        ))}
      </section>

      {/* FAQ */}
      <section className="border-t border-misa-hairline bg-misa-panel px-5 py-16 sm:px-14 sm:pb-18">
        <h2
          data-reveal="up"
          className="mb-8 font-display text-[30px] leading-none font-semibold tracking-[-0.02em] sm:text-[42px]"
        >
          Frequently Asked Questions
        </h2>
        <dl className="grid gap-5 lg:grid-cols-2">
          {FAQ.map((item, i) => (
            <div
              key={item.q}
              data-reveal="up"
              // The <dl> fills left-to-right, so every second card is the
              // right-hand one of its row and trails it slightly.
              style={revealDelay(i % 2 === 1 ? 0.05 : 0)}
              className="border border-misa-border bg-white px-7 pt-6.5 pb-7"
            >
              <dt className="mb-3 border-b border-misa-hairline pb-3 font-display text-[26px] leading-[1.08] font-semibold tracking-[-0.01em] text-misa-blue">
                {item.q}
              </dt>
              <dd className="text-[15px] leading-[1.65] text-misa-secondary">{item.a}</dd>
            </div>
          ))}
        </dl>

        {/* The band that closes the list. The handoff puts it inside the <dl>
            spanning both columns; it sits just after instead, because a <div>
            in a <dl> may only hold a dt/dd pair and this holds neither. Same
            position on screen — the 20px gap becomes the same top margin. */}
        <div
          data-reveal="up"
          className="on-navy mt-5 flex flex-wrap items-center justify-between gap-6 bg-misa-blue px-7 py-6.5 text-white"
        >
          <p className="leading-[1.6] text-white/85">
            Still have a question? Email us — we answer every one.
          </p>
          <a href={`mailto:${CONTACT_EMAIL}`} className={BUTTON_SOLID_WHITE}>
            {CONTACT_EMAIL}
          </a>
        </div>
      </section>

      <Partners ground="white" />
    </>
  );
}

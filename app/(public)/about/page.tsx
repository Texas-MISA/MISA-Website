import type { Metadata } from "next";

import { BUTTON_SOLID_WHITE } from "@/components/ui/button";
import { PageHero } from "@/components/ui/chevron-section";
import { Hatch } from "@/components/ui/hatch";
import { Eyebrow, Headline } from "@/components/ui/heading";
import { KpiPlate } from "@/components/ui/kpi-plate";
import { Panel } from "@/components/ui/panel";
import { Partners } from "@/components/ui/partners";
import { revealDelay } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";
import {
  CONTACT_EMAIL,
  FAQ,
  HISTORY_CARDS,
  HISTORY_STATS,
  MISSION,
} from "@/lib/site";

export const metadata: Metadata = {
  title: "About Us",
  description: "Connecting technology with business.",
};

/** The full-bleed 1:1 band, four across with no gap. */
const BAND = [
  "social event photo",
  "workshop photo",
  "service day photo",
  "banquet photo",
] as const;

export default function AboutPage() {
  return (
    <>
      <PageHero
        title="About Us"
        subhead="Connecting technology with business."
      />

      {/* Mission card beside the photo cluster. ⚠️ When photography lands,
          this cluster is NOT duotoned — it and the officer headshots are the
          two full-colour exceptions in the design. */}
      <Section padTop="sm" padBottom="md" width="page">
        <div className="grid items-stretch gap-split lg:grid-cols-[1.05fr_0.95fr]">
          <Panel
            data-reveal="rise"
            pad="none"
            className="flex flex-col justify-center px-10 pt-10 pb-11"
          >
            <Headline>Our Mission</Headline>
            {/* 🪤 18px, not the 17px this carried. There is no 17px step —
                the ramp runs 18 / 16 / 15 — and the 1.7 line-height is the
                documented card variant of body, which this is. */}
            <p className="mt-4.5 text-lg leading-[1.7] text-misa-body">
              {MISSION}
            </p>
          </Panel>

          <div
            data-reveal="up"
            style={revealDelay(0.1)}
            className="flex flex-col gap-tile"
          >
            <Hatch
              caption="chapter photo"
              className="min-h-55 flex-[1.4] border border-misa-border"
            />
            <div className="grid flex-1 grid-cols-2 gap-tile">
              <Hatch
                caption="member photo"
                className="min-h-35 border border-misa-border"
              />
              <Hatch
                caption="member photo"
                className="min-h-35 border border-misa-border"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* History */}
      <Section padTop="none" padBottom="md" width="page">
        <div className="border-t border-misa-hairline pt-11">
          {/* 📌 The heading sits ABOVE the grid, not inside the left column.
              It reads as the left column's heading either way because it is
              left-aligned and the portrait is directly under it — but inside
              the column it also pushed the portrait down by its own height,
              so the first card on the right started ~66px higher than the
              image beside it. Out here both columns begin on the same line,
              and they stay aligned when the heading wraps or changes size at
              the sm breakpoint, which a hand-tuned offset would not. */}
          <Headline data-reveal="up" className="mb-6">
            History of MISA
          </Headline>

          <div className="grid items-stretch gap-split lg:grid-cols-[0.85fr_1.15fr]">
            {/* 🪤 When a photo lands here it must be sized with next/image's
                `fill`. With an intrinsically sized image the frame grows to
                the photo's own height and leaves a large void beside the
                column on the right — the handoff hit this in its prototype. */}
            <Hatch
              data-reveal="left"
              caption="chapter portrait"
              className="min-h-85 border border-misa-border"
            />

            <div
              data-reveal="right"
              className="flex flex-col gap-4.5"
            >
              {HISTORY_CARDS.map((card) => (
                <Panel key={card.eyebrow} pad="none" className="px-7 py-6.5">
                  <Eyebrow>{card.eyebrow}</Eyebrow>
                  <p className="mt-3 leading-[1.7] text-misa-body">
                    {card.body}
                  </p>
                </Panel>
              ))}
              <KpiPlate stats={HISTORY_STATS} />
            </div>
          </div>
        </div>
      </Section>

      {/* Full-bleed band — duotone photography in the design. No gutter and no
          gap: the four squares meet edge to edge and run to the viewport. */}
      <Section as="div" gutter={false} pad="none">
        <div data-reveal="fade" className="grid grid-cols-2 sm:grid-cols-4">
          {BAND.map((caption) => (
            <Hatch key={caption} caption={caption} className="aspect-square" />
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section ground="panel" rule="top" pad="md" width="page">
        <Headline data-reveal="up" className="mb-8">
          Frequently Asked Questions
        </Headline>
        <dl className="grid gap-card lg:grid-cols-2">
          {FAQ.map((item, i) => (
            <div
              key={item.q}
              data-reveal="fade"
              // The <dl> fills left-to-right, so every second card is the
              // right-hand one of its row and trails it slightly.
              style={revealDelay(i % 2 === 1 ? 0.05 : 0)}
              className="border border-misa-border bg-white px-7 pt-6.5 pb-7"
            >
              <dt className="mb-3 border-b border-misa-hairline pb-3 font-display text-[26px] leading-[1.08] font-semibold tracking-[-0.01em] text-misa-blue">
                {item.q}
              </dt>
              <dd className="text-[15px] leading-[1.65] text-misa-secondary">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>

        {/* The band that closes the list. The handoff puts it inside the <dl>
            spanning both columns; it sits just after instead, because a <div>
            in a <dl> may only hold a dt/dd pair and this holds neither. Same
            position on screen — the 20px gap becomes the same top margin. */}
        <div
          data-reveal="up"
          className="on-navy mt-card flex flex-wrap items-center justify-between gap-6 bg-misa-blue px-7 py-6.5 text-white"
        >
          <p className="leading-[1.6] text-white/85">
            Still have a question? Email us — we answer every one.
          </p>
          <a href={`mailto:${CONTACT_EMAIL}`} className={BUTTON_SOLID_WHITE}>
            {CONTACT_EMAIL}
          </a>
        </div>
      </Section>

      <Partners />
    </>
  );
}

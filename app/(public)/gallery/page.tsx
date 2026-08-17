import type { Metadata } from "next";

import { BUTTON_SOLID_WHITE } from "@/components/ui/button";
import { PageHero } from "@/components/ui/chevron-section";
import { Hatch } from "@/components/ui/hatch";
import { Headline } from "@/components/ui/heading";
import { revealDelay } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";
import {
  GALLERY_FEATURE,
  INSTAGRAM_HANDLE,
  INSTAGRAM_PROMPT,
  SOCIAL_LINKS,
} from "@/lib/site";

import { GalleryGrid } from "./_components/gallery-grid";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Socials, workshops, banquets and everything in between.",
};

export default function GalleryPage() {
  return (
    <>
      <PageHero
        title="Gallery"
        subhead="Socials, workshops, banquets and everything in between."
      />

      {/* The filter bar, the feature shot and the masonry are one unit: the
          bar sits above the feature in the handoff's order, and the bar has to
          live with the grid it filters. The figure is passed through so it
          stays server-rendered. */}
      <GalleryGrid
        feature={
          <Section as="div" pad="none" padBottom="xs" width="page">
            <figure data-reveal="rise">
              <Hatch
                caption={GALLERY_FEATURE.slot.caption}
                className="h-70 border border-misa-border sm:h-105"
              />
              <figcaption className="mt-2.5 text-[12px] leading-tight font-medium tracking-[0.14em] text-misa-muted uppercase">
                {GALLERY_FEATURE.caption}
              </figcaption>
            </figure>
          </Section>
        }
      />

      <Section
        ground="navy"
        pad="md"
        width="page"
        innerClassName="flex flex-wrap items-center justify-between gap-12"
      >
        <div>
          <Headline data-reveal="up" className="mb-2.5">
            Tagged us?
          </Headline>
          <p
            data-reveal="up"
            style={revealDelay(0.05)}
            className="max-w-[52ch] leading-[1.65] text-white/80"
          >
            {INSTAGRAM_PROMPT}
          </p>
        </div>
        <a
          href={SOCIAL_LINKS.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className={`${BUTTON_SOLID_WHITE} whitespace-nowrap`}
        >
          {INSTAGRAM_HANDLE}
        </a>
      </Section>
    </>
  );
}

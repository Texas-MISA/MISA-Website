import type { Metadata } from "next";

import { BUTTON_SOLID_WHITE } from "@/components/ui/button";
import { PageHero } from "@/components/ui/chevron-section";
import { Hatch } from "@/components/ui/hatch";
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
          <section className="px-5 pb-6 sm:px-14">
            <figure data-reveal="up">
              <Hatch
                caption={GALLERY_FEATURE.slot.caption}
                className="h-70 border border-misa-border sm:h-105"
              />
              <figcaption className="mt-2.5 text-xs leading-tight font-medium tracking-[0.14em] uppercase text-misa-muted">
                {GALLERY_FEATURE.caption}
              </figcaption>
            </figure>
          </section>
        }
      />

      <section className="on-navy flex flex-wrap items-center justify-between gap-12 bg-misa-blue px-5 py-14 text-white sm:px-14">
        <div>
          <h2 className="mb-2.5 font-display text-[30px] leading-none font-semibold tracking-[-0.02em] sm:text-[42px]">
            Tagged us?
          </h2>
          <p className="max-w-[52ch] leading-[1.65] text-white/80">{INSTAGRAM_PROMPT}</p>
        </div>
        <a
          href={SOCIAL_LINKS.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className={`${BUTTON_SOLID_WHITE} whitespace-nowrap`}
        >
          {INSTAGRAM_HANDLE}
        </a>
      </section>
    </>
  );
}

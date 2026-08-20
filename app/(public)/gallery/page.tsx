import type { Metadata } from "next";

import { BUTTON_SOLID_WHITE } from "@/components/ui/button";
import { PageHero } from "@/components/ui/chevron-section";
import { Hatch } from "@/components/ui/hatch";
import { Headline } from "@/components/ui/heading";
import { revealDelay } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";
import { galleryPhotoEntries } from "@/lib/gallery-photos";
import { INSTAGRAM_HANDLE, INSTAGRAM_PROMPT, SOCIAL_LINKS } from "@/lib/site";

import { GalleryGrid } from "./_components/gallery-grid";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Socials, workshops, banquets and everything in between.",
};

// /gallery, rebuilt from scratch in v2 phase 2.
//
// 🔴 **BUILT FROM THE HOME PAGE, NOT FROM THE OLD /gallery.** Exact words kept,
// nothing else. The tiles are the home page's floating `.plate`: 4px radius, an
// opaque `misa-plate-edge` hairline and a navy-tinted `shadow-lift`, so the
// photographs sit ON the grey ground rather than being punched into it.
//
// ── THE LAYOUT-FAMILY BUDGET ────────────────────────────────────────────────
//
//   1. Hero ................ Page hero (field + chevron notch)
//   2. The photographs ..... Card masonry
//   3. Tagged us? .......... Navy field band
//
// THREE sections, THREE families. Eyebrow cap would be ceil(3 / 3) = 1; the page
// uses zero.
//
// 🔓 **The page shows the real pool.** `galleryPhotoEntries()` reads
// `public/photos/gallery/` at BUILD time — 117 photographs, committed on
// 2026-08-19 — and hands the list to the client grid as a prop. 🪤 That module
// imports `node:fs`, so it can only be called from here, in a Server Component,
// and never from the grid itself.
//
// ✂️ **What this page stopped asserting.** The old composition opened with a
// `GALLERY_FEATURE` figure captioned "End-of-year banquet · Spring 2025", a
// filter bar of five category chips, and a live count reading "Fall 2025 — N
// photos to come", above eighteen placeholders carrying invented categories.
// Three separate claims about the club — a term, a date and a taxonomy — none of
// which anybody supplied. All three are deleted rather than corrected, because
// the photographs make the page without them.
//
// ⚠️ **THE ALT TEXT IS A HANDBACK ITEM.** Every tile carries one neutral string,
// "Photograph from a MISA event", which is true of all 117 and useful to nobody.
// Real descriptions need someone who was in the room; a generated one would be a
// confident guess about identifiable students, which is the failure this whole
// area of the codebase is built to avoid.

/**
 * The fallback grid, for a checkout with no `public/photos/gallery/`.
 *
 * 📌 Not dead code and not defensive programming. `galleryPhotoEntries()`
 * returning `[]` is a supported state — the directory was gitignored until
 * 2026-08-19 and could be again — and the rule it serves is the one that
 * replaced the no-photography rule: **a slot renders a photograph or a labelled
 * placeholder, never a hole.** Without this the section would be an empty band.
 */
const FALLBACK = [
  "social event photo",
  "general meeting photo",
  "workshop photo",
  "member photo",
  "banquet photo",
  "chapter photo",
  "networking night photo",
  "service day photo",
] as const;

export default function GalleryPage() {
  const photos = galleryPhotoEntries();

  return (
    <>
      {/* 1. LAYOUT FAMILY: Page hero. */}
      <PageHero
        title="Gallery"
        subhead="Socials, workshops, banquets and everything in between."
      />

      {/* 2. LAYOUT FAMILY: Card masonry.
             📌 The one family on the site that wants INTRINSIC heights rather
             than a frame ratio, which is why these tiles do not go through
             `PhotoSlot`: every other slot on the site is `fill` inside a shape
             the composition chose, and this is the documented exception.
             📌 Grouping mechanism: the gap. No rules, no captions, no overlaid
             labels — §9 bans a pill or a photo-credit line on top of an image,
             and a gallery is where that temptation is strongest. */}
      <Section padTop="md" padBottom="md" width="page">
        {photos.length > 0 ? (
          <GalleryGrid photos={photos} />
        ) : (
          <div className="grid grid-cols-2 gap-tile sm:grid-cols-3 lg:grid-cols-4">
            {FALLBACK.map((caption, i) => (
              <Hatch
                key={caption}
                caption={caption}
                className={`border border-misa-border ${
                  i % 3 === 1 ? "aspect-3/4" : "aspect-4/3"
                }`}
              />
            ))}
          </div>
        )}
      </Section>

      {/* 3. LAYOUT FAMILY: Navy field band.
             📌 The drawn radial under the 60×60 grid overlay, closing the page
             the way it closes the home page. */}
      <Section
        ground="field"
        pad="lg"
        width="page"
        className="relative overflow-hidden"
      >
        <div
          aria-hidden="true"
          className="hero-grid pointer-events-none absolute inset-0"
        />
        <div className="relative flex flex-wrap items-center justify-between gap-10">
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
            data-reveal="up"
            style={revealDelay(0.1)}
            href={SOCIAL_LINKS.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className={`${BUTTON_SOLID_WHITE} whitespace-nowrap`}
          >
            {INSTAGRAM_HANDLE}
          </a>
        </div>
      </Section>
    </>
  );
}

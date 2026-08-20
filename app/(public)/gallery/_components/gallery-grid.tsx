"use client";

import Image from "next/image";
import { useState } from "react";

import { BUTTON_OUTLINE_NAVY } from "@/components/ui/button";
import type { GalleryPhoto } from "@/lib/gallery-photos";
import { GALLERY_PAGE_SIZE } from "@/lib/site";

// The masonry and its Load more button.
//
// ── REBUILT IN v2 PHASE 2 ───────────────────────────────────────────────────
//
// 🔓 **It shows the REAL photographs now.** This used to render eighteen
// `<Hatch>` placeholders out of `GALLERY_ITEMS`, with hand-written pixel heights
// and a category on each one. All of that described a photo set that did not
// exist, while 117 real photographs sat committed in `public/photos/gallery/`
// and only the home page's marquee read them.
//
// ✂️ **The category filter went with it.** `GALLERY_ITEMS[].category` was
// flagged in `lib/site.ts` as "a statement of intent rather than a record", and
// the filter chips sorted on it — so the one control on the page was sorting
// invented metadata. Nothing maps a real file to a category, and inventing that
// mapping would be the same failure wearing a filter bar. 🪤 The filter section
// was also the page's only `ground="white"`, taken because `FilterChip`'s
// resting fill is `bg-misa-panel` — the page ground's own colour. With the chips
// gone the reason is gone; do not restore one without the other.
//
// 🪤 **`node:fs` cannot cross into this file.** `lib/gallery-photos.ts` reads
// the directory at build time and this is a Client Component, so the list
// arrives as a PROP from the page. Importing the module here would break the
// build.
//
// 📌 **This stays a client component for exactly one reason: Load more.** 117
// full-size tiles in one prerender is not a page anyone should be sent on a
// phone, and progressive disclosure is the whole of the state this holds.

export function GalleryGrid({ photos }: { photos: readonly GalleryPhoto[] }) {
  const [shown, setShown] = useState(GALLERY_PAGE_SIZE);
  const visible = photos.slice(0, shown);

  return (
    <>
      {/* CSS columns rather than a grid: the point of a masonry is that items
          keep their own heights and the column flows around them. A grid would
          have to force one row height and crop every photograph to it.

          🪤 **No `data-reveal` on these tiles, and it is not an oversight.** The
          observer scans once per pathname, so a tile appended by Load more is
          never observed — and the hidden start state is unconditional, so it
          would sit at `opacity: 0` permanently. An entrance animation that hides
          content on a button press is a worse failure than no entrance at all.
          The section around it is not revealed either, for the same reason: it
          would have to un-hide its own future children. */}
      <div className="columns-2 gap-tile sm:columns-3 lg:columns-4">
        {visible.map((photo, i) => (
          <div key={photo.src} className="mb-tile break-inside-avoid">
            <div className="plate border border-misa-plate-edge shadow-lift">
              {/* 🪤 **Intrinsic sizing here, and `fill` everywhere else on the
                  site.** This is the one documented exception: a masonry needs
                  the tile's own height, and `fill` needs a frame that already
                  has one. `width`/`height` come from the file's own header (see
                  `galleryPhotoEntries`), so the box is correct before the image
                  arrives and the column never reflows under the reader.

                  📌 `h-auto` is load-bearing next to `w-full`: without it
                  next/image's intrinsic height attribute wins and the aspect
                  ratio breaks at any column width but one. */}
              <Image
                src={photo.src}
                alt="Photograph from a MISA event"
                width={photo.width}
                height={photo.height}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 24vw"
                className="h-auto w-full"
                // The first screenful is above the fold on a phone; the rest
                // load as they are scrolled to, which is next/image's default.
                priority={i < 2}
              />
            </div>
          </div>
        ))}
      </div>

      {shown < photos.length && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => setShown((n) => n + GALLERY_PAGE_SIZE)}
            className={BUTTON_OUTLINE_NAVY}
          >
            Load more photos
          </button>
          {/* Derived, never typed. The prototype hardcoded "24 photos" and it
              had already drifted from the grid beneath it. */}
          <p
            aria-live="polite"
            className="text-[12px] leading-tight font-medium tracking-[0.14em] text-misa-secondary uppercase"
          >
            {visible.length} of {photos.length}
          </p>
        </div>
      )}
    </>
  );
}

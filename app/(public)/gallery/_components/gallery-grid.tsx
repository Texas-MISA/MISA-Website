"use client";

import { useMemo, useState } from "react";

import { BUTTON_OUTLINE_NAVY } from "@/components/ui/button";
import { Hatch } from "@/components/ui/hatch";
import { PhotoBlock } from "@/components/ui/photo-frame";
import {
  GALLERY_FILTERS,
  GALLERY_ITEMS,
  GALLERY_PAGE_SIZE,
  GALLERY_TERM,
  photo,
  type GalleryCategory,
  type GalleryItem,
} from "@/lib/site";

// The masonry, its filter chips and its Load more button.
//
// 📌 The chips and the button are presentational in the prototypes; the
// handoff says they need real behaviour, so this is the one client component
// on the gallery. Everything it filters is a static manifest in lib/site.ts —
// there is no photo table and no fetch.
//
// The count beside the chips is DERIVED from what is on screen rather than
// typed, so it cannot drift from the grid the way the prototype's hardcoded
// "24 photos" already had.

type Filter = "all" | GalleryCategory;

function categoryOf(item: GalleryItem): GalleryCategory {
  return item.kind === "photo" ? photo(item.id).category : item.category;
}

export function GalleryGrid({
  /** The feature figure, which the handoff puts between the bar and the grid.
      Passed in rather than rendered here so it stays server-rendered. */
  feature,
}: {
  feature: React.ReactNode;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(GALLERY_PAGE_SIZE);

  const matching = useMemo(
    () =>
      filter === "all"
        ? GALLERY_ITEMS
        : GALLERY_ITEMS.filter((item) => categoryOf(item) === filter),
    [filter]
  );

  const visible = matching.slice(0, shown);

  const choose = (next: Filter) => {
    setFilter(next);
    // A narrower filter with a carried-over offset would show a short grid and
    // a Load more button that reveals nothing, so the window resets with it.
    setShown(GALLERY_PAGE_SIZE);
  };

  return (
    <>
      <section className="flex flex-wrap items-center justify-between gap-6 px-5 pt-10 pb-6 sm:px-14">
        <ul className="flex flex-wrap gap-2.5">
          {GALLERY_FILTERS.map((chip) => {
            const active = filter === chip.value;
            return (
              <li key={chip.value}>
                <button
                  type="button"
                  onClick={() => choose(chip.value)}
                  aria-pressed={active}
                  className={`px-[18px] py-[9px] font-display text-[13px] leading-none font-semibold tracking-[0.1em] uppercase transition ${
                    active
                      ? "bg-misa-blue text-white"
                      : "border border-misa-border text-misa-secondary hover:border-misa-blue hover:text-misa-blue"
                  }`}
                >
                  {chip.label}
                </button>
              </li>
            );
          })}
        </ul>
        <p
          className="text-xs leading-tight font-medium tracking-[0.14em] uppercase text-misa-muted"
          aria-live="polite"
        >
          {GALLERY_TERM} — {matching.length}{" "}
          {matching.length === 1 ? "photo" : "photos"}
        </p>
      </section>

      {feature}

      {/* CSS columns rather than a grid: the point of a masonry is that the
          items keep their own heights and the column flows around them. */}
      <section className="columns-2 gap-4 px-5 pt-6 pb-16 sm:px-14 lg:columns-4">
        {visible.map((item, i) =>
          item.kind === "photo" ? (
            <div key={`${item.id}-${i}`} className="mb-4 break-inside-avoid">
              <PhotoBlock photo={photo(item.id)} />
            </div>
          ) : (
            <div key={`placeholder-${i}`} className="mb-4 break-inside-avoid">
              <Hatch
                caption={item.caption}
                className="border border-misa-border"
                style={{ height: item.height }}
              />
            </div>
          )
        )}
      </section>

      {shown < matching.length && (
        <section className="flex justify-center px-5 pb-16 sm:px-14">
          <button
            type="button"
            onClick={() => setShown((n) => n + GALLERY_PAGE_SIZE)}
            className={BUTTON_OUTLINE_NAVY}
          >
            Load more photos
          </button>
        </section>
      )}
    </>
  );
}

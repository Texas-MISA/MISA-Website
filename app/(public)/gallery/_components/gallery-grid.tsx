"use client";

import { useMemo, useState } from "react";

import { BUTTON_OUTLINE_NAVY } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/chip";
import { Hatch } from "@/components/ui/hatch";
import { Section } from "@/components/ui/section";
import {
  GALLERY_FILTERS,
  GALLERY_ITEMS,
  GALLERY_PAGE_SIZE,
  GALLERY_TERM,
  type GalleryCategory,
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
        : GALLERY_ITEMS.filter((slot) => slot.category === filter),
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
      {/* 🪤 `ground="white"` because `FilterChip`'s resting fill is
          `bg-misa-panel`, which is the public page ground's own colour since
          2026-08-19 — an inactive chip on the page ground is an invisible
          control. Only THIS section takes the white; the masonry below keeps
          the grey, since its tiles are framed images that read against it. */}
      <Section
        ground="white"
        padTop="sm"
        padBottom="xs"
        width="page"
        innerClassName="flex flex-wrap items-center justify-between gap-6"
      >
        <ul className="flex flex-wrap gap-2.5">
          {GALLERY_FILTERS.map((chip) => (
            <li key={chip.value}>
              <FilterChip
                active={filter === chip.value}
                onClick={() => choose(chip.value)}
              >
                {chip.label}
              </FilterChip>
            </li>
          ))}
        </ul>
        <p
          className="text-[12px] leading-tight font-medium tracking-[0.14em] text-misa-muted uppercase"
          aria-live="polite"
        >
          {GALLERY_TERM} — {matching.length}{" "}
          {matching.length === 1 ? "photo" : "photos"} to come
        </p>
      </Section>

      {feature}

      {/* CSS columns rather than a grid: the point of a masonry is that the
          items keep their own heights and the column flows around them.

          🪤 No `data-reveal` on these tiles, and it is not an oversight. The
          observer scans once per pathname, so a tile appended by Load more
          would never be observed — and its hidden start state is unconditional,
          so it would stay at `opacity: 0` permanently. An entrance animation
          that hides content on a button press is a worse failure than no
          entrance at all. */}
      <Section padTop="xs" padBottom="md" width="page">
        <div className="columns-2 gap-tile lg:columns-4">
          {visible.map((slot, i) => (
            <div
              key={`${slot.caption}-${i}`}
              className="mb-tile break-inside-avoid"
            >
              <Hatch
                caption={slot.caption}
                className="border border-misa-border"
                style={{ height: slot.height }}
              />
            </div>
          ))}
        </div>

        {shown < matching.length && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setShown((n) => n + GALLERY_PAGE_SIZE)}
              className={BUTTON_OUTLINE_NAVY}
            >
              Load more photos
            </button>
          </div>
        )}
      </Section>
    </>
  );
}

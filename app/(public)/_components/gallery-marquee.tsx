import Link from "next/link";

import { LINK_EYEBROW } from "@/components/ui/button";
import { Hatch } from "@/components/ui/hatch";

// The gallery band on the home page: two marquee tracks, the top one scrolling
// left and the bottom one scrolling right.
//
// 📌 The band sits on WHITE. It was a full-bleed navy field in the handoff and
// for the first day of this component's life; the navy was dropped by request
// on 2026-08-15. Everything that only made sense against navy went with it, per
// the "never mixed" rule on Hatch: the tiles are the light tone with the
// standard hairline frame, the "See all photos" link is navy, and `.on-navy`
// (which flips the focus ring to white) is gone because the default navy ring
// is now the correct one. Restoring the navy means changing all four together.
//
// 🪤 A MARQUEE NEEDS ENOUGH COPIES TO COVER THE VIEWPORT, and "duplicate the
// group twice and translate -50%" only does that when ONE GROUP IS WIDER THAN
// THE SCREEN. That was assumed here and never checked, and neither group is:
// measured on production at a 1646px viewport, the top track's group is 1360px
// and the bottom's 1272px. At the end of a cycle the track had translated a
// full group width, so its right edge sat at 1360px — 286px of bare ground
// (navy at the time), then a snap back. The gap is a function of the geometry
// and does not care what colour is behind it, so the measurements below still
// hold on white. The bottom track's hole opened at the START of its cycle
// instead (it runs in reverse), so the two rows broke at opposite moments and
// read as though they were changing direction rather than counter-scrolling.
//
// So the geometry is derived rather than assumed. Everything below falls out of
// GAP and TILE: the group width, how many copies are needed, and how far to
// translate. In particular the translate distance is now an exact pixel value
// passed to CSS as `--marquee-shift`, NOT a percentage — a percentage silently
// depends on the copy count, which is the coupling that made this fragile.

const GAP = 12;

const TILE = {
  lg: { w: 260, h: 170 },
  sm: { w: 200, h: 130 },
} as const;

/**
 * The widest viewport the loop has to stay seamless at.
 *
 * ⚠️ A real ceiling, not a safety margin. Past this width there are not enough
 * copies to cover the screen at the wrap point and the gap comes back — the
 * exact defect this file exists to describe. 4000px clears every ordinary
 * display including 3440px ultrawide; raising it costs only DOM nodes.
 */
const MAX_VIEWPORT = 4000;

// Every tile is a placeholder — see the note at the top of lib/site.ts. The
// design intends duotoned photography here; the tile counts and sizes are the
// handoff's, so dropping photos in later is a swap rather than a re-layout.

const TRACK_ONE = [
  "social event photo",
  "gallery photo",
  "workshop photo",
  "gallery photo",
  "banquet photo",
];

const TRACK_TWO = [
  "gallery photo",
  "general meeting photo",
  "gallery photo",
  "service day photo",
  "gallery photo",
  "chapter photo",
];

function Track({
  captions,
  size,
  direction,
}: {
  captions: string[];
  size: keyof typeof TILE;
  direction: "left" | "right";
}) {
  const tile = TILE[size];

  // One group is every tile plus its own trailing gap, which is what makes
  // consecutive groups butt together with exactly one gap between the last
  // tile of one and the first tile of the next.
  const groupWidth = captions.length * (tile.w + GAP);

  // At the extreme of the translate the track has moved one group width, so
  // the remaining (copies - 1) groups are what is left covering the screen.
  const copies = Math.ceil(MAX_VIEWPORT / groupWidth) + 1;

  return (
    <div className="overflow-hidden">
      <div
        className={`flex w-max ${
          direction === "left" ? "marquee-left" : "marquee-right"
        }`}
        style={{ "--marquee-shift": `${groupWidth}px` } as React.CSSProperties}
      >
        {Array.from({ length: copies }, (_, copy) => (
          <div
            key={copy}
            className="flex"
            style={{ gap: GAP, paddingRight: GAP }}
            // Only the first group is the content; the rest exist to make the
            // loop seamless and would otherwise be read out four more times.
            aria-hidden={copy > 0}
          >
            {captions.map((caption, i) => (
              <Hatch
                key={i}
                caption={caption}
                className="shrink-0 border border-misa-border"
                style={{ width: tile.w, height: tile.h }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function GalleryMarquee() {
  return (
    <section className="py-12 sm:pb-14">
      <div className="mb-[22px] flex justify-end px-5 sm:px-14">
        <Link
          href="/gallery"
          className={`${LINK_EYEBROW} text-misa-blue hover:text-misa-blue-dark`}
        >
          See all photos →
        </Link>
      </div>
      <div className="pb-3">
        <Track captions={TRACK_ONE} size="lg" direction="left" />
      </div>
      <Track captions={TRACK_TWO} size="sm" direction="right" />
    </section>
  );
}

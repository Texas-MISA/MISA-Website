import Image from "next/image";

import { Hatch } from "@/components/ui/hatch";
import { Section } from "@/components/ui/section";
import { galleryPhotos } from "@/lib/gallery-photos";
import type { ImageSlot } from "@/lib/site";

// The gallery band on the home page: two marquee tracks, the top one scrolling
// left and the bottom one scrolling right.
//
// 📌 The band sits on the GREY PAGE GROUND. It was a full-bleed navy field in the handoff and
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

/**
 * 🔓 **One tile size for both bands** (officer, 2026-08-19). They used to be
 * 260x170 and 200x130, which read as a hierarchy that was not meant — the two
 * strips are halves of one gallery, not a lead and a follow-up. They are told
 * apart by direction and speed now, which is the difference that was intended
 * all along.
 */
const TILE = { w: 260, h: 170 } as const;

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

/**
 * How many tiles each track takes from the gallery pool.
 *
 * ⚠️ **This is a cap and it truncates, so it is written down here rather than
 * buried at a call site.** The pool is currently 117 photographs; rendering all
 * of them, twice over, across two tracks would be several hundred `<img>`
 * elements for a strip that scrolls past. Truncating is honest for THIS
 * section in a way it would not be for data — the band is decorative breadth,
 * and it links to `/gallery` for the complete set.
 *
 * 🪤 The numbers are chosen against the marquee's own arithmetic, not picked.
 * `copies = ceil(MAX_VIEWPORT / groupWidth) + 1`, so MORE tiles per group means
 * FEWER copies: 10 lg tiles give a 2720px group and 3 copies (30 elements),
 * where the old hand-picked 5 gave a 1360px group and 4 copies (20). The
 * rendered element count therefore stays close to what it always was.
 */
const TILES_PER_BAND = 12;

/**
 * The captioned placeholders, used when there is no gallery to draw from.
 *
 * 📌 `public/photos/` is gitignored, so this is the PRODUCTION path, not a
 * failure path: a deploy builds from the repo and has no photographs at all.
 * The band keeps its shape and says what belongs in each frame.
 */
const FALLBACK_ONE: ImageSlot[] = [
  { caption: "social event photo" },
  { caption: "gallery photo" },
  { caption: "workshop photo" },
  { caption: "gallery photo" },
  { caption: "banquet photo" },
];

const FALLBACK_TWO: ImageSlot[] = [
  { caption: "gallery photo" },
  { caption: "general meeting photo" },
  { caption: "gallery photo" },
  { caption: "service day photo" },
  { caption: "gallery photo" },
  { caption: "chapter photo" },
];

/**
 * Split the pool across the two tracks.
 *
 * 🪤 **Interleaved, not sliced in half.** The pool is sorted by filename, and
 * filenames cluster by camera and by event — so taking the first N for one
 * track and the next M for the other would put one afternoon in the top row and
 * a different one in the bottom. Alternating gives each track a spread of the
 * library without introducing anything random.
 *
 * ⚠️ **No photograph appears in both tracks.** They scroll in opposite
 * directions at different speeds, so a repeat would drift into view alongside
 * itself.
 *
 * ⚠️ **`alt` is empty on purpose.** These frames are chosen by a directory
 * listing, so there is nothing truthful to say about any one of them; invented
 * alt text is worse than none, and an empty `alt` is the correct markup for
 * decorative imagery. The band's own "See all photos" link carries the meaning.
 */
function splitPool(pool: string[]): [ImageSlot[], ImageSlot[]] {
  const one: ImageSlot[] = [];
  const two: ImageSlot[] = [];
  for (let i = 0; i < pool.length; i++) {
    const target = i % 2 === 0 ? one : two;
    if (target.length < TILES_PER_BAND)
      target.push({ caption: "gallery photo", src: pool[i], alt: "" });
  }
  return [one, two];
}

function Track({
  slots,
  direction,
}: {
  slots: ImageSlot[];
  direction: "left" | "right";
}) {
  const tile = TILE;

  // One group is every tile plus its own trailing gap, which is what makes
  // consecutive groups butt together with exactly one gap between the last
  // tile of one and the first tile of the next.
  const groupWidth = slots.length * (tile.w + GAP);

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
            {slots.map((slot, i) => (
              // 🪤 The tile is sized in PIXELS, not by an aspect ratio, because
              // the marquee geometry is derived from `tile.w`: `groupWidth`, the
              // copy count and the exact `--marquee-shift` translate all come
              // off it. A ratio-sized tile would make the track width a
              // function of the image and the loop would stop being seamless.
              // That is why this does not use <PhotoSlot>, which is ratio-based.
              <div
                key={i}
                className="plate relative shrink-0 border border-misa-border"
                style={{ width: tile.w, height: tile.h }}
              >
                {slot.src ? (
                  <Image
                    src={slot.src}
                    alt={slot.alt ?? slot.caption}
                    fill
                    sizes={`${tile.w}px`}
                    className="object-cover"
                  />
                ) : (
                  <Hatch caption={slot.caption} className="h-full w-full" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * One half of the gallery strip.
 *
 * 🔓 **The strip is split across the page** (officer, 2026-08-19): the top
 * band sits below the mission, the bottom band between activities and
 * projects. It used to be both tracks stacked directly under the hero.
 *
 * ⚠️ **This puts a marquee on the page TWICE, and that is a rule the v2 plan
 * names.** §5's max-one-marquee-per-page exists because two of them usually
 * means lazy filler, and the layout-family budget says a family may appear at
 * most once — which is most of what v1 was scrapped for. The case for doing it
 * anyway: these are two halves of ONE gallery, drawn from one pool with no
 * photograph in both, at one tile size, and they bracket the activities
 * section rather than repeating a device in two unrelated places. Recorded
 * here rather than left for someone to find with a grep.
 *
 * 📌 The two bands share `splitPool`, so a photograph cannot appear in both.
 * They counter-scroll at different durations, which is now the ONLY thing
 * telling them apart since the tile sizes were equalised.
 */
export function GalleryMarquee({ half }: { half: "top" | "bottom" }) {
  // Read at build time. `galleryPhotos()` returns [] when there is no gallery
  // directory, which is the production case, and the fallbacks take over.
  const [drawnOne, drawnTwo] = splitPool(galleryPhotos());
  const top = half === "top";
  const drawn = top ? drawnOne : drawnTwo;
  const slots = drawn.length ? drawn : top ? FALLBACK_ONE : FALLBACK_TWO;

  return (
    // 📌 **The band owns its own rhythm, and the neighbours gave theirs up.**
    // This used to read "the neighbours own the rhythm", which stopped being
    // true on 2026-08-19: the seam either side of a band was the neighbour's
    // `lg` step (80px) plus this `xs` one (32px), and 112px of blank ground at
    // four boundaries is what the officer marked as too much. The mission and
    // Activities came down to `xs`, so every light seam is 64px at desktop.
    //
    // 🔓 **The band sits on the grey page ground and carries nothing but the
    // strip** (officer, 2026-08-19). Two things were tried and reversed the
    // same day: an explicit white band behind the tiles, and a "See all photos"
    // card riding the top band. Both are gone. `/gallery` is still one click
    // away in the header nav, which is where a destination that exists on every
    // page belongs — the band is decoration now, not a call to action.
    //
    // 🪤 `gutter={false}` is load-bearing: the tracks must reach both edges of
    // the viewport or the loop has a visible margin to wrap into.
    <Section
      gutter={false}
      padTop="xs"
      // 🔓 **The bottom band's lower inset is a step larger, and it is the one
      // asymmetry here that is deliberate** (officer, 2026-08-19: make the gap
      // either side of each band the same). Every other seam on this page is
      // built from TWO paddings, the band's and its neighbour's, 32px each at
      // desktop. Below the BOTTOM band there is no light neighbour to
      // contribute: the navy Projects field starts immediately, and its own
      // `lg` inset sits inside the navy where it reads as that band's padding
      // rather than as a gap. So this one edge has to bring the whole 64px.
      padBottom={top ? "xs" : "md"}
    >
      <Track slots={slots} direction={top ? "left" : "right"} />
    </Section>
  );
}

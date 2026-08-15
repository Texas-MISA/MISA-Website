import Link from "next/link";

import { LINK_EYEBROW } from "@/components/ui/button";
import { Hatch } from "@/components/ui/hatch";

// The navy gallery band on the home page: two marquee tracks, the top one
// scrolling left and the bottom one scrolling right.
//
// 🪤 Each track holds its tile group DUPLICATED EXACTLY TWICE, and each group
// carries a trailing padding equal to the flex gap. That is what makes the
// -50% translate in `mq` / `mqr` land seamlessly; drop either and the loop
// visibly jumps at the wrap. The animations themselves are in globals.css and
// pause on hover and under prefers-reduced-motion.
//
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
  size: "lg" | "sm";
  direction: "left" | "right";
}) {
  const box = size === "lg" ? "h-[170px] w-[260px]" : "h-[130px] w-[200px]";

  return (
    <div className="overflow-hidden">
      <div
        className={`flex w-max ${
          direction === "left" ? "marquee-left" : "marquee-right"
        }`}
      >
        {[0, 1].map((copy) => (
          <div
            key={copy}
            className="flex gap-3 pr-3"
            // The second copy exists only to make the loop seamless.
            aria-hidden={copy === 1}
          >
            {captions.map((caption, i) => (
              <Hatch
                key={i}
                caption={caption}
                tone="navy"
                className={`shrink-0 border border-white/28 ${box}`}
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
    <section className="on-navy bg-misa-blue py-12 sm:pb-14">
      <div className="mb-[22px] flex justify-end px-5 sm:px-14">
        <Link href="/gallery" className={`${LINK_EYEBROW} text-white hover:text-white/70`}>
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

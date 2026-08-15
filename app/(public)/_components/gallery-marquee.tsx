import Link from "next/link";

import { LINK_EYEBROW } from "@/components/ui/button";
import { Hatch } from "@/components/ui/hatch";
import { PhotoFrame } from "@/components/ui/photo-frame";
import { photo, type PhotoId } from "@/lib/site";

// The navy gallery band on the home page: two marquee tracks, the top one
// scrolling left and the taller-gapped bottom one scrolling right.
//
// 🪤 Each track holds its tile group DUPLICATED EXACTLY TWICE, and each group
// carries a trailing padding equal to the flex gap. That is what makes the
// -50% translate in `mq` / `mqr` land seamlessly; drop either and the loop
// visibly jumps at the wrap. The animations themselves are in globals.css and
// pause on hover and under prefers-reduced-motion.

type Tile = { kind: "photo"; id: PhotoId } | { kind: "placeholder" };

const TRACK_ONE: Tile[] = [
  { kind: "photo", id: "fall-10" },
  { kind: "placeholder" },
  { kind: "photo", id: "fall-02" },
  { kind: "placeholder" },
  { kind: "photo", id: "fall-08" },
];

const TRACK_TWO: Tile[] = [
  { kind: "placeholder" },
  { kind: "photo", id: "fall-01" },
  { kind: "placeholder" },
  { kind: "photo", id: "event-01" },
  { kind: "placeholder" },
  { kind: "photo", id: "event-02" },
];

function Track({
  tiles,
  size,
  direction,
}: {
  tiles: Tile[];
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
            {tiles.map((tile, i) =>
              tile.kind === "photo" ? (
                <PhotoFrame
                  key={i}
                  photo={photo(tile.id)}
                  className={`shrink-0 ${box}`}
                  duotone
                  border="light"
                  sizes="260px"
                />
              ) : (
                <Hatch
                  key={i}
                  caption="gallery photo"
                  tone="navy"
                  className={`shrink-0 border border-white/28 ${box}`}
                />
              )
            )}
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
        <Track tiles={TRACK_ONE} size="lg" direction="left" />
      </div>
      <Track tiles={TRACK_TWO} size="sm" direction="right" />
    </section>
  );
}

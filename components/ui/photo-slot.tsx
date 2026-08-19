import Image from "next/image";

import { Hatch } from "@/components/ui/hatch";
import type { ImageSlot } from "@/lib/site";

// One image slot: the real photograph if there is one, the labelled hatch if
// there is not.
//
// 🔓 **This is the restore path the no-photography decision always described**,
// taken for the first time (officer, 2026-08-18). `lib/site.ts` has said since
// 2026-08-14 that restoring a photo means "add the file, give the slot a `src`,
// and swap its `<Hatch>` for an `<Image>`" — this component is that swap, done
// once instead of at every call site, so the two states stay one decision.
//
// 📌 **The `<Hatch>` fallback is deliberate and stays.** Deleting a `src` puts
// the labelled placeholder back rather than leaving a hole, which means the
// no-photography state is still reachable — for a slot that has no good photo
// yet, for a page that is not ready, or if the officer changes their mind about
// publishing faces at all. A component that only knew how to render photographs
// would have made that a rewrite.
//
// 🪤 **`fill`, never an intrinsically sized `<img>`.** This is written down in
// `lib/site.ts` as a trap the design handoff already hit: an intrinsic image
// makes its frame grow to the photo's own height, and the About history portrait
// then leaves a large void beside the column next to it. `fill` needs a
// positioned, sized parent, which is what the ratio wrapper below is for.
//
// ⚠️ **`alt` describes the photograph, not the slot.** The old caption named the
// shot that *belonged* there ("service day photo"); once a real image lands, the
// caption becomes alt text, and alt text that describes a different event than
// the one on screen is worse than none. So `ImageSlot` carries both, and they
// are allowed to disagree.

export function PhotoSlot({
  slot,
  ratio,
  sizes,
  tone = "light",
  priority = false,
}: {
  slot: ImageSlot;
  /** Aspect-ratio utility, e.g. `aspect-3/2`. Owns the frame's shape. */
  ratio: string;
  /** Rendered width per breakpoint, so next/image picks a sane source. */
  sizes: string;
  tone?: "light" | "navy";
  priority?: boolean;
}) {
  if (!slot.src) {
    return <Hatch caption={slot.caption} tone={tone} className={ratio} />;
  }

  return (
    <div className={`relative ${ratio}`}>
      <Image
        src={slot.src}
        alt={slot.alt ?? slot.caption}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}

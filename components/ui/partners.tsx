import Image from "next/image";

import { Headline } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import { PARTNERS } from "@/lib/site";

// The partner plate, shared by the home and About pages. Four cells with a
// 1px grid gap over a hairline background, so the shared hairline reads as a
// rule. Logos are full colour, never greyscaled.
//
// ── FOLDED ONTO <Section> IN v2 PHASE 2 ─────────────────────────────────────
//
// 🔓 This file predates `<Section>` and had drifted into carrying its own copy
// of everything the section primitive exists to own. Phase 1 found the drift
// and deferred the fix here rather than fixing it in a phase that was not
// reviewing `/about`, which is the other caller. What went:
//
//   - its own gutter (`px-5 sm:px-14`), now `<Section>`'s `px-gutter-sm sm:px-gutter`
//   - its own vertical rhythm (`py-20 sm:pb-22` — 88px, matching no pad step),
//     now `pad="lg"` (56 / 80px)
//   - its own `border-t`, now `rule="top"`
//   - its own three-key ground map duplicating three of `<Section>`'s five, and
//     the `ground` prop that selected from it. Both non-`page` options were dead
//   - a verbatim copy of `Headline`'s class string, now `<Headline>`
//
// 🪤 It also had NO width cap, so the logo row kept spreading past 1400px while
// every other band on both pages stopped there. `width="page"` is the fix and it
// is a visible change above ~1500px.
//
// 📌 **The shared-rule plate itself is unchanged and must stay that way**: ONE
// background showing through `gap-px`, never a border per cell, because two
// adjacent borders read as a double rule. The cells stay opaque white for the
// same reason — a transparent cell shows the hairline across the whole card
// instead of at the seam.

export function Partners() {
  return (
    <Section ground="page" rule="top" pad="lg" width="page">
      <Headline data-reveal="up" className="mb-11 text-center">
        Our Amazing Partners
      </Headline>
      {/* 🪤 `wipe` is the variant for a shared-rule plate: it draws the rule on
          rather than moving the plate in. It animates `clip-path`, so it keeps
          its own `[data-revealed]` rule in globals.css — and nothing rotated may
          go inside it, because a clip-path clips descendants and a rotated child
          always leaves its wrapper's box. Four upright logos are safe. */}
      <ul
        data-reveal="wipe"
        className="grid grid-cols-2 gap-px border border-misa-hairline bg-misa-hairline sm:grid-cols-4"
      >
        {PARTNERS.map((partner) => (
          <li
            key={partner.name}
            className="flex items-center justify-center bg-white px-7 py-10"
          >
            <Image
              src={partner.logo}
              alt={partner.name}
              width={1000}
              height={1000}
              sizes="(max-width: 640px) 40vw, 20vw"
              className="h-21 w-auto object-contain"
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}

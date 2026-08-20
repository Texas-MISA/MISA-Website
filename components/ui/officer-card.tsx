import { PhotoSlot } from "@/components/ui/photo-slot";

import type { Officer } from "@/lib/officers";
import type { ImageSlot } from "@/lib/site";

// One officer. Every card is identical — there is no separate exec-board
// treatment in the design.
//
// The card is a lifted white plate and a flex column, with the LinkedIn link at
// `margin-top: auto`, so the links align across a row no matter how many lines
// a role title wraps to.
//
// 🔓 **The headshot goes through `PhotoSlot` as of v2 phase 2**, where it used
// to hardcode a `<Hatch>`. Nothing about the decision changed — it still renders
// the labelled placeholder, because the slot below carries no `src` — but the
// restore path now exists in the one place the swap is supposed to happen. A
// hardcoded `<Hatch>` is a slot a photograph can never reach without an edit.
//
// ⚠️ **Officer headshots stay placeholders for a reason photography does not
// answer.** The rest of the site got its photographs on 2026-08-19; these did
// not, and would not have. The design handoff ships headshots but records that
// the photo-to-name pairing "was never supplied", and a real student's face
// under another real student's name is a worse failure than an empty labelled
// square. `Officer` has no `photo` field, deliberately — adding one answers
// only half the question. ⚠️ When a pairing does land, an officer headshot is
// NOT duotoned; it and the About mission cluster are the full-colour exceptions.
const HEADSHOT: ImageSlot = { caption: "officer headshot" };

export function OfficerCard({ officer }: { officer: Officer }) {
  return (
    <div className="plate flex h-full flex-col border border-misa-plate-edge bg-white shadow-lift">
      <PhotoSlot
        slot={HEADSHOT}
        ratio="aspect-square"
        // Five across the 1400px page at `xl`, three at `sm`, two on a phone.
        sizes="(max-width: 640px) 45vw, (max-width: 1280px) 30vw, 18vw"
      />

      <div className="flex flex-1 flex-col px-4 pt-3.5 pb-4">
        {/* 🪤 **Hand-rolled rather than `<Title>`, and stated rather than
            hidden.** `Title` bases at 26 → 34px and `activities.tsx` overrides it
            down by appending a second `text-[Npx]`. That works there because the
            gap is small; here the card wants 19 → 21px, and two competing
            `text-*` utilities are resolved by Tailwind's own stylesheet order
            rather than by the order they appear in the string — `<Section>` and
            the heading components merge with a plain join, not `tailwind-merge`.
            A name silently rendering at 34px in a 13-cell grid is not a risk
            worth taking for one import. */}
        <h3 className="mb-1 font-display text-[19px] leading-[1.05] font-semibold tracking-[-0.01em] text-balance sm:text-[21px]">
          {officer.name}
        </h3>
        {/* 🪤 **Deliberately NOT the `Eyebrow` component**, even though the type
            is now the Eyebrow row of the ramp (12px / 0.14em). An eyebrow is a
            label ABOVE a headline, and §4.7's eyebrow cap is counted
            mechanically by grepping for exactly this class signature — using the
            component for thirteen role labels sitting BELOW a name would inflate
            that count against a page that has no eyebrows at all. It is also
            muted rather than navy: thirteen navy labels in one grid is the Rare
            Navy Rule being spent on nothing. #6f7275 on white is 5.06:1. */}
        <p className="text-[12px] leading-[1.3] font-medium tracking-[0.14em] text-misa-muted uppercase">
          {officer.role}
        </p>
        <a
          href={officer.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto pt-3 font-display text-xs leading-none font-semibold tracking-[0.1em] text-misa-blue uppercase transition-colors duration-(--dur-hover) hover:text-misa-blue-dark"
        >
          LinkedIn →<span className="sr-only"> profile for {officer.name}</span>
        </a>
      </div>
    </div>
  );
}

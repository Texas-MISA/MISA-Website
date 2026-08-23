import { PhotoSlot } from "@/components/ui/photo-slot";

import { SHOW_OFFICER_LINKEDIN, type Officer } from "@/lib/officers";
import type { ImageSlot } from "@/lib/site";

// One officer. Every card is identical — there is no separate exec-board
// treatment in the design.
//
// The card is a lifted white plate and a flex column, with the LinkedIn link at
// `margin-top: auto`, so the links align across a row no matter how many lines
// a role title wraps to.
//
// 🔓 **The headshot goes through `PhotoSlot` as of v2 phase 2**, and as of
// 2026-08-23 it actually carries a photograph for twelve of the thirteen.
//
// 🔓 **The rule that kept these blank is SATISFIED, not waived.** It was never
// "no faces on officer cards" — it was that the design handoff shipped headshots
// while recording that the photo-to-name pairing "was never supplied", and a
// real student's face under another real student's name is a worse failure than
// an empty labelled square. The officer has now supplied the pairing, from the
// live site's own page; `lib/officers.ts` documents how it was read off that
// page's grid geometry rather than its DOM order.
//
// 🔴 **So `photo` is OPTIONAL and the `<Hatch>` fallback is load-bearing, not
// legacy.** Two officers share one image file on the source page and neither can
// be attributed, so both still render the placeholder. A card that could only
// draw a photograph would have forced a guess there.
//
// ⚠️ An officer headshot is NOT duotoned; it and the About mission cluster are
// the full-colour exceptions.
function headshot(officer: Officer): ImageSlot {
  return {
    caption: "officer headshot",
    src: officer.photo,
    // ⚠️ The alt describes the photograph, and the only thing known about it is
    // who it is of — these came out of the saved page with an EMPTY alt on every
    // one. "Headshot of <name>" is the honest whole of it.
    alt: officer.photo ? `Headshot of ${officer.name}` : undefined,
  };
}

export function OfficerCard({ officer }: { officer: Officer }) {
  return (
    <div className="plate flex h-full flex-col border border-misa-plate-edge bg-white shadow-lift">
      <PhotoSlot
        slot={headshot(officer)}
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
        {/* 🪤 **The link is CONDITIONAL, and the `mt-auto` moved off it onto a
            spacer for that reason.** It used to be the flex column's last child
            and carried `mt-auto`, which is what pushed every card's link to the
            same baseline regardless of how many lines a role wrapped to. Drop
            the link on a card with no LinkedIn and that alignment leaves with
            it, so the six link-less cards would let their role text float
            instead of settling at the bottom. The spacer keeps the column's
            shape whether or not there is a link in it.
            📌 The updated officers page carries no per-officer LinkedIn at all;
            see the note in `lib/officers.ts` for why six of thirteen have
            none and why a plausible-looking URL is not an acceptable filler. */}
        <div className="mt-auto" />
        {/* 🔓 Gated by SHOW_OFFICER_LINKEDIN, which is OFF (officer, 2026-08-23).
            The flag lives in lib/officers.ts beside the URLs it hides, and the
            URLs are still there — see the note on the constant. */}
        {SHOW_OFFICER_LINKEDIN && officer.linkedin && (
          <a
            href={officer.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="pt-3 font-display text-xs leading-none font-semibold tracking-[0.1em] text-misa-blue uppercase transition-colors duration-(--dur-hover) hover:text-misa-blue-dark"
          >
            LinkedIn →
            <span className="sr-only"> profile for {officer.name}</span>
          </a>
        )}
      </div>
    </div>
  );
}

import { Hatch } from "@/components/ui/hatch";

import type { Officer } from "@/lib/officers";

// One officer. Every card is identical — there is no separate exec-board
// treatment in the design.
//
// The card is a flex column with the LinkedIn link at `margin-top: auto`, so
// the links align across a row no matter how many lines a role title wraps to.
//
// The headshot is a placeholder like every other image slot on the site (see
// the note at the top of lib/site.ts). Two separate reasons converge on the
// same square here, and both would have to be answered before a face goes in:
// the design handoff ships headshots but says the photo-to-name pairing "was
// never supplied", and no photography is published at all. ⚠️ When one does
// land, an officer headshot is NOT duotoned — it and the About mission cluster
// are the two full-colour exceptions in the design.
export function OfficerCard({ officer }: { officer: Officer }) {
  return (
    <div className="flex h-full flex-col">
      <Hatch
        caption="officer headshot"
        className="aspect-square border border-misa-border"
      />

      <h3 className="mt-3 mb-[3px] font-display text-[22px] leading-[1.05] font-semibold">
        {officer.name}
      </h3>
      <p className="text-[11px] leading-[1.3] font-medium tracking-[0.12em] uppercase text-misa-muted">
        {officer.role}
      </p>
      <a
        href={officer.linkedin}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto pt-2.5 font-display text-xs leading-none font-semibold tracking-[0.1em] uppercase text-misa-blue hover:text-misa-blue-dark"
      >
        LinkedIn →<span className="sr-only"> profile for {officer.name}</span>
      </a>
    </div>
  );
}

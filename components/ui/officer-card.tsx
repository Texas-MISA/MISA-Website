import Image from "next/image";

import { Hatch } from "@/components/ui/hatch";

import type { Officer } from "@/lib/officers";

// One officer. Every card is identical — there is no separate exec-board
// treatment in the design.
//
// The card is a flex column with the LinkedIn link at `margin-top: auto`, so
// the links align across a row no matter how many lines a role title wraps to.
//
// ⚠️ Headshots are NOT duotoned; they stay full colour. The About mission
// cluster is the other exception, and everything else brand-facing is duotoned.
export function OfficerCard({ officer }: { officer: Officer }) {
  return (
    <div className="group flex h-full flex-col">
      {officer.photo ? (
        <div className="relative aspect-square overflow-hidden border border-misa-border">
          <Image
            src={officer.photo}
            alt={officer.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover transition-transform duration-500 ease-[cubic-bezier(.2,.7,.3,1)] group-hover:scale-105"
          />
        </div>
      ) : (
        // See lib/officers.ts: the handoff's photo-to-name pairing was never
        // confirmed, and a real face against the wrong real name is worse than
        // no face at all.
        <Hatch
          caption="officer headshot"
          className="aspect-square border border-misa-border"
        />
      )}

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

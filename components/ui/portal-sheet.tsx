import type { ReactNode } from "react";

import { Title } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";

// The portal's page surface — v2 phase 3, the Portal Rebuild.
//
// 🔴 **It REPLACES `PortalBand`, which the officer removed from every portal
// page on 2026-09-20.** The instruction was "the navy header at the top of each
// page should be removed for all pages in the portal"; this is the replacement
// the design step proposed and the officer adopted ("the sheet is the page").
// `portal-band.tsx` is deleted rather than left orphaned, because DESIGN.md is
// explicit that **a primitive with no call sites has not ended the drift it was
// written to end** — and phase 4 found three such components sitting unused.
//
// 📌 **The idea: a portal page is an OBJECT, not a band on a ground.** The
// public pages are stacked full-bleed sections — a navy hero, then bands. That
// vocabulary is what made the portal read as more marketing site, and a navy
// hero on a page whose whole job is a form was applying a *brochure* device to a
// *tool*. So the portal stops being a page with a header on it and becomes one
// white document lying on the grey ground, titled at its top under a rule.
//
// 🔓 **`.sheet` is the system's own surface for exactly this and it already
// existed** (`DESIGN.md` §Surfaces, `app/globals.css:594`): white, a 1px Plate
// Edge frame, the 4px plate radius and `shadow-lift`. Nothing new was invented.
// It also satisfies DESIGN.md's second idea on its own terms — *"structure is
// square; objects are softened; only a thing that reads as an object lying on
// the page takes the 4px plate radius"* — which is the argument for the radius
// here and against it everywhere else in the portal.
//
// 🪤 **A `.sheet` MUST sit on a ground that is not white**, or it is an
// invisible rectangle wearing a shadow. That is why this component owns its
// `<Section ground="page">` rather than leaving the ground to the caller: the
// one mistake that would make it vanish is the one a caller could make.
//
// 🪤 **ONE max-width declaration, deliberately.** `<Section width="narrow">`
// plus `innerClassName="max-w-xl"` emits two `max-width` utilities of equal
// specificity, and which one wins is decided by Tailwind's emission order — the
// same tie that made `<Title className="text-[22px]">` render at 26px for as
// long as it existed. `width="none"` here, with the measure on this component's
// own wrapper, cannot lose that race.
//
// 🔴 **There is deliberately NO back link, and that was a measured decision
// rather than an omission.** The adopted concept showed one ("← Member portal"
// above the title on the three leaf pages), and it was built and then removed:
// **the site header already carries a MEMBER PORTAL button that links /portal
// and is visible on every page**, so an in-sheet back link duplicated an
// always-available control — for **40px** (36px target plus its gap) on the one
// page in the codebase gated on a fold position. The hub's own gate had already
// flagged the same duplication from the other side, as its h1 restating the
// button 90px above it. What makes the portal read as one place instead is the
// sheet: the same surface, with the same masthead, on all four pages.
//
// 🪤 **No `data-reveal`, ever.** The officer's anti-goal for the portal is
// "slower to check in", and `html.js [data-reveal]` starts at `opacity: 0` and
// waits for the IntersectionObserver — a sheet the member cannot read on first
// paint is that anti-goal expressed in CSS.

const MEASURE = {
  /** A form. Wide enough for a label above a field, narrow enough to scan. */
  form: "max-w-xl",
  /** The default: a list, a set of rows, a page of prose. */
  page: "max-w-3xl",
  /** Tabular data that wants the room. */
  wide: "max-w-5xl",
} as const;

export function PortalSheet({
  /**
   * The page's `<h1>`. Every portal page needs one — the band used to own it,
   * and removing the band without rehoming it would leave the document outline
   * headless.
   */
  title,
  measure = "page",
  children,
}: {
  title: ReactNode;
  measure?: keyof typeof MEASURE;
  children: ReactNode;
}) {
  return (
    <Section ground="page" padTop="xs" padBottom="md" width="none">
      <div className={`mx-auto ${MEASURE[measure]}`}>
        {/* `.sheet` is a global class (globals.css), not a utility set: white,
            Plate Edge, 4px radius, shadow-lift. The padding is this
            component's, because the rule below has to bleed through it. */}
        {/* 🔴 `px-4` at phone, not `px-5`, and it buys 8px of content column on
            the one page in the codebase gated on a fold position.
            **Measured, and the number cost a wrong comment first:**
            check-in's content column is 272px here against 305px when the form
            sat directly on a white section, and its box reassurance line
            therefore wraps to THREE lines rather than two. It needs a 272px
            *text* column to take two, and the text sits inside the checkbox's
            flex row — so it gets column minus 28px (the 16px box plus the 12px
            gap), i.e. 244. No realistic padding closes that: two lines would
            need a content column of 300, which leaves 1.5px a side.

            🪤 **So the third line is ACCEPTED, not fixed.** It costs 20px and
            the bar is still met with 32px to spare (button bottom 607.7 against
            a 640 fold). Re-measure the TEXT column, not the content column, if
            this is ever revisited — measuring the wrong one is what produced
            the first version of this comment. */}
        <div className="sheet px-4 py-5 sm:px-8 sm:py-7">
          <Title as="h1">{title}</Title>
          {/* 🔓 The rule bleeds to the sheet's edges rather than sitting inside
              its padding, which is what turns the title into a MASTHEAD — a
              titled band at the top of a document — instead of a heading with a
              decorative underline. The negative margins must track the padding
              above; changing one without the other leaves a rule that stops
              short and reads as a mistake. */}
          <hr className="mt-4 -mx-4 border-0 border-t border-misa-hairline sm:-mx-8" />
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </Section>
  );
}

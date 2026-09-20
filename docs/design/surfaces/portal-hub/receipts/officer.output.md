# Officer instruction, 2026-09-20 — remove the navy header from the portal

## What was asked

Delivered against a screenshot of **this page** on the deployed preview
(`misa-website-git-design-toolkit-…vercel.app/portal`), the navy band circled:

> "the redesign can continue but with this change: the navy header at the top of
> each page should be removed for all pages in the portal. the design skills can
> come up with a replacement."

Scope: all four portal pages. The replacement was delegated to the design step.

## Context

It followed the officer saying `/portal` and `/portal/attend` "both look similar
to what existed before", and asking what had changed given they had given
permission for a broader overhaul. The honest answer was that the phase changed
how the portal *behaves and measures* — height, states, focus, contrast, outcome
coding — inside a visual language `DESIGN.md` pinned before the phase began, and
that the adopted concept was the more conservative of the two offered.

🪤 **A bolder concept had been on the table for this surface and was never put
to the officer.** Concept B, "the field console", placed the whole hub on the
drawn navy field — a small h1, three full-width white buttons, the notch closing
under the last — and estimated a check-in bottom of ≈198px against A's ≈311. Its
diverge receipt says in as many words: *"recorded for the officer, who may
overrule at the brief review."* It was recorded and not escalated. **A rejected
concept whose receipt flags it for the officer should be put to them**, not left
in the file for someone to find.

## The replacement: "the sheet is the page"

The hub becomes one white `.sheet` lying on the grey page ground: the title is a
masthead above a rule that bleeds to the sheet's edges, the three destination
rows are the document's body, and the officer line sits inside the sheet rather
than stranded on the grey below it.

The plate **bleeds** to the sheet's edges rather than sitting inside its padding
— `-mx-4 sm:-mx-8`, tracking the sheet's own padding, with `border-y` instead of
a full frame. A framed plate inside a framed sheet is the doubled rule that
`Panel`'s `frameless` prop exists to avoid, and bleeding makes the rows read as
the document's contents rather than as a card inside a card.

🔓 **`.sheet` already existed** (`DESIGN.md` §Surfaces, `app/globals.css:594`):
white, 1px Plate Edge, the 4px plate radius, `shadow-lift`, and its own rule
that it must sit on a ground that is not white. It already ships on `/about`.
Nothing was invented, and the radius is earned on DESIGN.md's own terms — *"only
a thing that reads as an object lying on the page takes the 4px plate radius."*

The rejected alternative, **"title and rule"**, kept the title on the grey page
ground with a hairline under it and the plate as a separate surface below. It
was the smaller change, and it left the portal reading as a page with a header
on it — which is what the officer had just said looked unchanged.

## Measured

| | before the rebuild | at the gate | now |
|---|---|---|---|
| Check-in row bottom, 360×640 (bar ≤ 424) | 423 | 325 | **265.5** |
| Layout families | 2 | 2 | **1** |
| `.chevron-notch` / `.ground-field` in `<main>` | 1 | 1 | **0** |

All three destinations and the officer line remain on the first screen at
360×640. `npm test` 41 files / 1142 green; `npm run test:ui` 41 pass / 1 fail,
unchanged, and the one failure is `/portal/lookup`'s `definition-list`.

## Consequences recorded elsewhere

🗑️ **`components/ui/portal-band.tsx` is deleted.** With both callers converted
it would have had zero call sites, and DESIGN.md is explicit that a primitive
with no call sites has not ended the drift it was written to end — phase 4 found
three such components sitting unused, which is why that rule exists.

🔓 **Deferred question A3 is moot.** It recorded the band's h1 restating the
header's MEMBER PORTAL button 90px above it. The band is gone. The third
deferred question — the 360 row-height rake of 93 / 118 / 144px, driven by the
officer's own copy rather than by formatting — stays open.

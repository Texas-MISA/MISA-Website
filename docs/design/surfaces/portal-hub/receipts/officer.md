---
skill: officer
command: officer instruction, 2026-09-20 — "the navy header at the top of each page should be removed for all pages in the portal. the design skills can come up with a replacement."
date: 2026-09-20
commit: "30bcec5"
output: officer.output.md
findings:
  - id: O1
    summary: "Remove the navy band (`PortalBand`) from `/portal`. The officer gave the instruction against a screenshot of this very page on the deployed preview, with the band circled, scoped to every page in the portal."
    disposition: adopted
    fix_commit: "ca5cd06be488d085cebeed009aece22c8144b971"
  - id: O2
    summary: "The replacement, proposed by `frontend-design` and adopted by the officer: the sheet is the page — the hub becomes one white `.sheet` on the grey ground, its title a masthead above a bleeding rule, with the shared-rule plate as the document's body. The rejected alternative kept the title on the page ground with the plate as a separate surface below."
    disposition: adopted
    fix_commit: "ca5cd06be488d085cebeed009aece22c8144b971"
  - id: O3
    summary: "The destinations plate now BLEEDS to the sheet's edges (negative margins tracking the sheet's padding, `border-y` rather than a full frame) and the officer line moved inside the sheet, so the hub is one object rather than a framed plate inside a framed sheet — the doubled rule `Panel`'s `frameless` prop exists to avoid."
    disposition: adopted
    fix_commit: "ca5cd06be488d085cebeed009aece22c8144b971"
---

The officer's own review, taken after `portal-hub` was already `rebuilt`. This
receipt exists so `scripts/design/receipts.mjs` can tell an officer-requested
change from drift: without it, `ca5cd06` reads as **stale** against all seven
review steps. 📌 An officer receipt never counts as "a skill changed the
outcome" — the twelve findings the hub's gate adopted still carry that.

📌 **This page is where the instruction came from.** The screenshot the officer
marked up was `/portal` on the deployed preview, with the navy band circled. The
instruction was scoped to all four portal pages, so `/portal/attend` carries the
same receipt and the two un-rebuilt surfaces took the header removal alone.

## The hub got faster

Its bar is the check-in row's bottom edge at 360×640, "at or above 424". It was
**423** before the rebuild and **325** after it. With the band gone and the plate
bleeding inside the sheet, it is **265.5** — and all three destinations plus the
officer line still sit on the first screen.

The layout-family budget dropped from two to one: the band and the plate were
two stacked sections, and the hub is now a single object.

## What this change also settled

🔓 **The hub's second deferred officer question is moot.** `critique.md` A3
recorded that `PortalBand title="Member Portal"` rendered directly under the
header's current-marked **MEMBER PORTAL** button — two identical phrases within
90px, costing 130.5px on the page whose named anti-goal is height. The band is
gone, so the restatement is gone with it. The h1 remains "Member Portal", which
is the officer's approved copy, but it now sits inside the sheet as a masthead
rather than in a 131px navy band.

🪤 The **third** deferred question is NOT settled: at 360 the destination rows
still rake 93 / 118 / 144px because their bodies wrap to one, two and three
lines, and that is driven by the officer's copy rather than by formatting. It
stays open.

## What is NOT claimed

The seven review steps ran against `23fab67` / `ab3f6c9`. This change alters the
page's composition after them, and the measurements here are the lead's, re-run.
The `design-reviewer`, the critique and the audit have not seen the sheet. If the
officer wants the surface re-gated rather than amended, it goes back through
`/design-gate`; this receipt records the instruction, the concepts, the adoption
and the numbers that moved, and claims nothing further.

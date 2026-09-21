---
skill: design-reviewer
command: design-reviewer agent on surface portal-hub at http://localhost:3000/portal (320 / 360 / 768 / 1280)
date: 2026-09-20
commit: "a660ada662ead1f827746d68f57421a98084c5b2"
output: design-review.output.md
findings:
  - id: DR1
    summary: "High — destination row focus-visible at every width: the row's focus ring is 1.00:1 for the 48px it crosses the navy key, because the key's white ring is painted over by the row link's own navy outline on every edge they share. A pixel scan down the key's centre reads rgb(22,48,92) with no white band at the top edge; the only white segment that survives is the key's LEFT edge, which abuts the white cell and is invisible too. The indicator visibly stops at the seam — the exact defect the page's own comment claims was fixed."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: DR2
    summary: "Medium — default at every width: the row text column never aligns with the masthead and the offset flips sign between phone and desktop (h1 289 / titles 281 at 1280; h1 37 / titles 45 at 360). The plate bleeds by exactly the sheet padding and each cell then re-pads px-6 = 24, which equals neither. Three different left edges in one 320px-wide document."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: DR5
    summary: "Nit — the officers sign-in link's hit area is 44.9 x 32.0px at every width, the only interactive target on the page under the 48px floor this surface sets for itself; the three rows are 92.7-143.9px and the header's portal button is 48px. WCAG 2.2 SC 2.5.8 passes; the page's own EV1 bar does not."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: DR7
    summary: "Nit — two numbers in the page's own comment no longer match the build: `Lowest ratio anywhere on the route is 7.60:1` while the same paragraph names the header and footer muted ink at 4.84:1, and the officers line called `--misa-secondary, 7.60:1 on this grey ground` when it now sits on the sheet's white at 8.51:1."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: DR3
    summary: "Nit — at 360 and 320 the three identically-formatted rows measure 92.7 / 118.3 / 143.9px because the bodies wrap to 1, 2 and 3 lines, a 51.2px spread that reads as a staircase; at 768 and 1280 all three are exactly 96.9px, so the officer's equal-formatting rule only looks equal above `sm`. Titles themselves do not wrap at 320, so the brief's stated 360 risk is met."
    disposition: deferred
    reason: "The same finding as critique A4/B3 and deferred with it, to the same officer conversation, for the same reason: the fix is a trim of the officer's approved copy, and the bodies are conspicuously absent from the officer's `may change` list while the titles are on it. 🔴 Re-measured AFTER this gate's DR2 fix, which widened the phone text column 222 to 238px and which Assessment A predicted might collapse the rake: it does not. The bodies still wrap 1 / 2 / 3 and the rows still rake 92.7 / 118.3 / 143.9. Recorded so that no part of this is mistaken for quietly fixed."
  - id: DR4
    summary: "Nit — press is indistinguishable from hover on a pointer device: hover and active both compute rgb(13,29,56) on the title and the key, with transform and box-shadow `none` in all three states. On touch the state does read, and `[-webkit-tap-highlight-color:transparent]` removes the platform's own flash, so the ink swap is the only press feedback a phone gets."
    disposition: rejected
    reason: "Correct as built, and the reason is the design rather than an oversight. On a device that can hover, the hover swap has ALREADY happened by the time the press begins, so a distinct press state would have to be a third colour — and DESIGN.md's Rare Navy Rule refuses any tint outside Pressed and Drafting, so there is no third step available without breaking a named rule. On a device that cannot hover, which is this surface's primary persona, the swap fires on press and IS the acknowledgement — verified live on an emulated `hover: none` / `pointer: coarse` device. A transform is refused by DESIGN.md's `nothing in this system moves on interaction`, which the previous gate's motion step already argued out as M2."
  - id: DR6
    summary: "Nit — the header MEMBER PORTAL button's focus ring FADES IN from invisible: sampled immediately after the Tab press the 2px ring is rgb(149,161,181), navy at 45.4% over the white header, reaching rgb(22,48,92) at 13.03:1 only after ~900ms. `transition-colors` covers `outline-color` and the unfocused outline-color is currentColor = white, so the ring animates white to navy. The destination rows do NOT have this: their ring reads navy on the first frame."
    disposition: deferred
    reason: "Shared chrome — `components/ui/button.tsx` and `components/site-header.tsx`, outside this surface's registered files. It is a real defect and a genuinely good catch (Emil's rule is never to animate a keyboard-initiated action, and this animates the indicator ON a keyboard action), but `button.tsx` renders on nine public pages and every `/admin` screen, so it is a site-wide change that this gate cannot measure the blast radius of. Goes to the officer with the other chrome finding, critique A2, and belongs to round 6, which owns work outside the four portal surfaces."
  - id: DR8
    summary: "Nit — the sheet and its rows are separated from their grounds by boundaries below 3:1: the `.sheet` frame is #bfbfc2 on the #f2f2f3 page ground = 1.64:1, carried by shadow-lift at 6-8% navy, and the plate's border-y and 1px seams are rgba(29,31,32,0.16) = 1.38:1 on white. The object-on-a-ground conceit rests on a 1.64:1 edge plus a shadow that forced-colors mode removes."
    disposition: rejected
    reason: "Same finding as critique A7 and rejected on the same grounds. SC 1.4.11 is not engaged — a container boundary is neither a UI-component boundary nor a graphic required to understand the content, and axe returns 0 violations at all three widths. `.sheet` and `--misa-plate-edge` are shared: the token is DEFINED as Frame resolved over Vellum Shade, so moving it repaints every plate, panel and photograph on the site. And the degradation is benign — if the sheet is invisible the member still sees a title, a rule, three rows and a line at 8.51:1 minimum. Recorded so the fragility is on the record before it is reported as a bug."
---

Run with **Playwright (bundled Chromium), headless, `deviceScaleFactor: 1`**.
The Chrome extension was connected but unusable for geometry: this machine's
1.75 device pixel ratio left `document.documentElement.clientWidth` at **1646**
when the window was resized to 1280, so the agent abandoned it after using it
only to validate the contrast formula on the WCAG reference pairs. Every
Playwright context reported `clientWidth` equal to the width asked for. 📌 The
same constraint was hit independently at the 2026-09-19 gate, by two different
reviewers — it is a property of this machine and should be expected again.

## 🔴 DR1 is the finding this re-gate exists for

The 2026-09-19 gate found that the row's navy focus ring measured 1.00:1 over
the navy key. It adopted a fix — a white ring on the key — and the file then
argued the point at length and correctly: the row spans two grounds, `.on-navy`
cannot help because what is focused is the row rather than the key, so the key
redraws the ring in white over its own 48px. Every sentence of that is true of
the CSS.

**It never painted.** `getComputedStyle` reports the key's outline as
`solid 2px rgb(255,255,255)` at `-2px` — present, correct, matching the row's
inset. The pixels say the parent's navy outline wins on every edge the two
share, so what a keyboard user saw was a ring around the white cell, capped at
the seam by a white bar, with the 48px key outside the indicator that names it.

⚠️ **This is the second time on this surface that a confident, well-measured
verification tested a different proposition than the one it appeared to
settle.** The 2026-09-19 critique's Assessment B reported the ring "visible on
all three rows, drawn fully inside its own cell, not clipped" — it had measured
bounds and never colour. This gate's predecessor measured colour and never
paint. The lead reproduced DR1 independently with a focused-vs-unfocused pixel
diff before adopting it, and measured three candidate fixes rather than
reasoning about them: `relative`, `relative` + `z-index` and `isolation:
isolate` all close the ring, and an inset `box-shadow` does not.

## The gate bar, verified independently

At 360×640, settled, under the 61px sticky header, the check-in row's bottom
edge is **267.2px** against a bar of ≤424 — **156.8px of margin** — and all three
destinations, the officers line and the whole sheet sit inside the 640 fold. The
path is still two taps. This is the third independent measurement of 267.2 at
this gate, and none of the three reproduces the 265.5 the receipts recorded.

## Verified and passing, recorded so it is not re-derived

No horizontal overflow at 320, 360, 768 or 1280. Zero console errors and zero
warnings at every width, no hydration diff. JavaScript off: identical geometry,
`opacity: 1`, three rows present, zero `[data-reveal]` nodes in `main` — so
reduced motion is a no-op. Tab order matches visual order at both widths. The
masthead rule and the plate bleed to the sheet's padding box precisely at both
breakpoints. Type ramp clean, no 14px anywhere in the sheet, zero
`--misa-muted` in `main`, lowest in-sheet ratio 8.51:1. At 360 the header's 48px
button clears the centred wordmark by 10.4px — tight, and still not a collision.

## What the review could not verify

Forced-colors / Windows High Contrast, real touch input (press was simulated
with `mouse.down`), and an actual phone. DR8's severity assumes `shadow-lift`
renders. Nothing here is cross-checked in a second engine.

## One claim the reviewer set out to reproduce and could not

A first read of the header button's focus ring said `rgb(255,255,255)` at
`outline-offset: 2px` on a white header — a 1.00:1 invisible ring. **It was
wrong: a mid-transition read.** The settled value is `rgb(22,48,92)` at 13.03:1.
What survives from it is only DR6, the fade-in. The lead independently made the
same class of error in the other direction on the same day, reading the row's
hover colour inside its 150ms transition and nearly filing a dead-hover finding.
**Two reviewers, one machine, one afternoon, the same trap twice** — on this
surface a colour read is worthless until the transition has settled, and that is
now the second entry in this receipt saying so.

# `/impeccable audit app/(public)/portal/page.tsx` — re-gate 2026-09-20

Code-level technical audit, five dimensions, against the build at `a660ada` —
the sheet build, which no previous audit had seen.

## Audit Health Score

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | **3 → 4** | AU1: the focus indicator did not enclose the 48px navy key at all. `getComputedStyle` said it did. |
| 2 | Performance | **4** | Static Server Component; nothing to optimise (AU6). |
| 3 | Theming | **4** | Full token system, zero hard-coded values (AU7). |
| 4 | Responsive | **3 → 4** | AU2: the row text column aligned with nothing and the miss inverted across `sm`. AU4: one target under the floor the page cites. |
| 5 | Implementation integrity | **2 → 4** | AU5: three factual claims in the comments that the build contradicts, one of them self-contradictory within seven lines. |

## 1. Accessibility

**AU1 — the focus indicator excluded 48px of its own target, and the file's
comment said the opposite.** The row `<Link>` spans a white cell then a 48px
navy key. The key carries `group-focus-visible:outline-2 -outline-offset-2
outline-white` precisely so the indicator survives the ground change. Measured
by screenshotting a focused row and diffing it against the same row unfocused —
the changed pixels are the indicator and nothing else:

    navy top run     x0-717   stops dead at the key's left edge
    navy bottom run  x0-717   same
    navy left run    x0-1     full height
    row right edge   nothing painted at all
    white            x718-719 only — a 2px bar at the seam

The ring did not change colour at the seam. **It ended there**, capped by a
white bar, with the key outside it. `position: relative` on the key fixes it —
an outline is painted in its element's own paint step, and a non-positioned
in-flow child does not get one that survives over its parent's. After: the key's
top edge and the row's right edge measure `rgb(255,255,255)` at 13.03:1 on the
navy, where both measured *no change* before. An inset `box-shadow` does **not**
work (it paints with the child's background, still under the parent's outline);
`relative`, `relative` + `z-index` and `isolation: isolate` all do.

Contrast: h1 16.55:1, row titles 13.03:1, row bodies and the officers line
8.51:1, its link 13.03:1. **Lowest ratio in the page's own content: 8.51:1.**
Zero `--misa-muted` in `<main>`.

Semantics: `<div>` not `<span>` around each `<h2>`; accessible names are the
titles alone via `aria-labelledby`, descriptions via `aria-describedby`; the key
is `aria-hidden`; H1 → H2 × 3 with no skipped level; tab order check-in →
leaderboard → lookup → officers sign in at 360 and 1280, matching reading order.
JavaScript off: three rows present and usable, `<html>` carries no `js` class.
Reduced motion: geometry identical, nothing translates. **axe-core wcag2a +
wcag2aa + wcag21a + wcag21aa + wcag22aa: 0 violations and 0 incomplete at 360,
768 and 1280.**

## 2. Performance

**AU6 — a passing dimension, recorded so the score is auditable rather than
asserted.** Static Server Component: no client bundle, no images, no layout
reads in render, no `will-change`, no expensive animation, one tree-shaken
`lucide-react` icon, `<Link>` at Next 16's default prefetch. Zero console errors
or warnings at every width, and no hydration diff.

## 3. Theming

**AU7 — a passing dimension.** Every fill and ink is a token: `--misa-blue`,
`--misa-blue-dark`, `--misa-secondary`, `--misa-hairline`, `--misa-ink`,
`bg-white`. No hard-coded colour anywhere. The only arbitrary values are
`leading-[1.6]` (which *is* the ramp's Body leading) and
`[-webkit-tap-highlight-color:transparent]`, a property with no token. Dark mode
is refused site-wide by DESIGN.md and that refusal is recorded as settled.

## 4. Responsive

**AU2 — the row text sat on no margin, and the sign of the miss inverted across
`sm`.** The plate bleeds outward by exactly the sheet's padding
(`-mx-4 sm:-mx-8`); the cell then re-padded by a flat `px-6` = 24, compared
against nothing. Measured left edges:

| width | sheet padding | h1 / officers line | row title | offset |
|---|---|---|---|---|
| 320 / 360 / 390 | 16 | 37 | 45 | rows **+8px in** |
| 768 | 32 | 89 | 81 | rows **−8px out** |
| 1280 | 32 | 289 | 281 | rows **−8px out** |

No single intent produces +8 on a phone and −8 on a desktop. On a document whose
whole idea is a masthead above a body, the left margin is the strongest
alignment line on the page. `px-4 sm:px-8` puts every left edge on 37 / 89 / 289
respectively, and widens the phone text column 222 → 238px.

**AU3 — two 16px paragraphs at two leadings, 20px apart.** The officers line
carried no leading class and inherited 1.5 (a 24px line box) beside row bodies
at `leading-[1.6]` (25.6px). DESIGN.md §The ramp's Body row is 16px / 1.6.

**AU4 — one target under the floor the page itself cites.** "sign in" measured
**44.9 × 32px**. It clears WCAG 2.2 §2.5.8 (24 × 24), and the comment beside it
invokes EV1's 44pt iOS / 48dp Android on *"a page whose every other target is
48px+"* — which is true: the rows are 92.7–143.9px, and the header's MEMBER
PORTAL button is 48px on phones since round 1a. `min-h-12` takes it to 44.9 × 48.

No horizontal overflow at 320, 360, 390, 768 or 1280. Titles stay one line in a
182px column at 320, so the brief's stated wrap risk is met.

## 5. Implementation integrity

**AU5 — three claims in the comments that the build contradicts.**

1. The layout-family block still declared *"1. Band … Short portal field band
   (field + chevron notch)"* and *"TWO sections, TWO families"*. `ca5cd06`
   deleted that band from every portal page; the page renders **one** section,
   and there is zero `.chevron-notch` and zero `.ground-field` anywhere on the
   route. DESIGN.md §Layout families makes these comments the enforcement —
   *"so the count is a grep rather than a memory"* — so this was a wrong count
   in the only place the count is kept. The same file contradicts it 90 lines
   later: *"The band and the plate used to be two stacked sections; the hub is
   now a single sheet."*
2. *"the officer line uses `--misa-secondary`, which is 7.60:1 there"* — 7.60 is
   that token on the **grey**, and `ca5cd06` moved the officers line inside the
   sheet. It is on white, at **8.51:1**.
3. *"Lowest ratio anywhere on the route is 7.60:1"* — stated two lines after the
   same paragraph correctly named the footer's `txmisa@gmail.com` at **4.84:1**.
   The paragraph refuted itself inside seven lines. True values: the page bottoms
   out at 8.51:1 and the route at 4.84:1.

**Detector:** `[]`, exit 0, with and without `--no-advisory`. Not pre-suppressed
— `.impeccable/config.json` has empty `ignoreRules` and `ignoreFiles`, and all
three `ignoreValues` scope to `app/globals.css` and
`tests/design-detector.test.ts`, neither of which is this surface.

**Design specificity: grounded in this product, not interchangeable** — and the
reasoning is worth keeping. The 48px full-height navy key is an unusual,
confident choice: the three keys stack into one continuous navy stripe down the
plate's edge, so the affordance is visible at rest on a device that never
hovers. The shared-rule plate is the project's own device, reused from
`KpiPlate` rather than reinvented. The bleeding masthead rule is what turns a
heading-with-an-underline into a document masthead. 📌 The honest caveat: strip
the site header and footer and this page would not identify itself as MISA's —
the only product-specific token in its own content is the word "MISA", three
times, which is exactly the word the deferred A4 proposes to delete.

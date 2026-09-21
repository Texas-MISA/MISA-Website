---
skill: impeccable
command: /impeccable audit app/(public)/portal/attend/
date: 2026-09-20
commit: "77d2c568ed093f78a6b437e053bbef0533eff9e4"
output: audit.output.md
findings:
  - id: T1
    summary: "Accessibility, P2. The busy state drops focus and announces nothing. Measured with the POST throttled: at the moment of submit the button sets `disabled`, which removes it from the tab order, `document.activeElement` becomes `<body>` for the whole request, and the always-mounted `role=\"status\"` region reads \"\". `aria-busy=\"true\"` rides on the unreachable control — the same shape as CLAUDE.md's \"a `title` on a DISABLED button reaches nobody\". EV7, which this surface adopted, asks a loading state to preserve layout, focus AND busy status; only layout was built (286.0 x 48.0 at 360, 208.0 x 48.0 at 1280, identical idle and pending)."
    disposition: adopted
    fix_commit: "b2900e15681b949b3e551a86a836f13f153d04c9"
  - id: T2
    summary: "Responsive / content handling, P2. `ResultPanel`'s content wrapper carries `min-w-0` with no `break-words`, and `present` interpolates an officer-entered event title into it (`events.title` has no length limit). Measured at 360 with a 76-character unbroken title: the `<strong>` painted 622.1px wide with its right edge at 720.1 — 380px past the sheet's 340 — and `document.scrollWidth` went to 720 against a 360 client width. The wrapper's BOX held at 200px throughout, which is exactly the half-fix `Row`'s own comment documents eighty lines below: box geometry calls it fixed while the text paints past the viewport. Raised independently by web-design-guidelines (G1) against its `min-w-0` / long-content rule pair."
    disposition: adopted
    fix_commit: "b2900e15681b949b3e551a86a836f13f153d04c9"
  - id: T3
    summary: "Accessibility, P3. The focus ring on the Check in button is animated and fades in from invisible. `components/ui/button.tsx`'s `BASE` carries `transition-colors duration-150`; Tailwind v4 puts `outline-color` inside that shorthand (resolved on the button: `color, background-color, border-color, outline-color, ...` at 0.15s); and an unfocused element's `outline-color` computes to `currentColor`, which on `bg-misa-blue` is white. Sampled on the page: rgb(255,255,255) at t~1ms — 1.00:1 against the white sheet — rgb(214,219,226) at ~31ms, rgb(148,160,180) at ~62ms, navy at ~151ms (13.03:1). The indicator for the page's primary action does not clear 3:1 until roughly 70-90ms after the key. The three text inputs are unaffected: their `currentColor` is Graphite, so their ring fades dark-to-dark."
    disposition: deferred
    reason: "Not fixable at this surface. Every Tailwind `transition-*` utility sets `transition-property` at equal specificity, so appending a narrower list to the submit's className ties with `BASE` and the winner is Tailwind's emission order — the same tie `Title`'s and `Banner`'s `size` props both exist to avoid. The fix has to change `BASE`, which is one string shared by ~40 public call sites and every /admin button. Tracked for v2 phase 3 part 6; full timing table and the contrast at each sample in `motion.output.md` M1, which reached it independently. 📌 The portal-hub re-gate raised the identical mechanism on the header's MEMBER PORTAL button and left it as an open officer question — the two are one fix and are recorded together in `officer.md` O5."
  - id: T4
    summary: "Accessibility, P3. There is no `scroll-padding-top` anywhere in `app/globals.css`, and `components/site-header.tsx` is `sticky top-0 z-50` with a measured 61.0px shell. On the idle form nothing scrolls — every control is inside the first screen — but on `unmatched` the Check in button sits 122px below the fold at 360, and a Shift+Tab back up a scrolled document lands its target at the viewport's top edge, under the header."
    disposition: deferred
    reason: "Site-wide chrome: `scroll-padding-top` belongs on `html` in `app/globals.css` and would change scroll-into-view behaviour on every route, including all 25 /admin screens. Raised independently by web-design-guidelines (G3) against \"sticky headers must not cover the focused element\". Tracked for part 6, which owns the shared primitives on the grounds the portal now puts them on. Not reproduced as a live failure on this surface's idle path, and recorded with that caveat rather than as a measured defect."
  - id: T5
    summary: "Implementation integrity, P2. Five specific measurements the surface asserts about ITSELF no longer reproduce, or reproduce only under a viewport convention the text does not name — the gate bar, the band's saving, the box row at three widths, `--misa-secondary`'s ratio, and `PortalSheet`'s two column figures. This is a `rebuilt` surface, so its files are frozen and read rather than re-measured, and part 4 derives `/portal/lookup` from one of them next."
    disposition: adopted
    fix_commit: "b2900e15681b949b3e551a86a836f13f153d04c9"
---

Code-level technical checks across the five dimensions. Scores, and what each
dimension actually measured, in `audit.output.md`.

| Dimension | Score |
|---|---|
| Accessibility | 3 |
| Performance | 4 |
| Theming | 4 |
| Responsive design | 4 |
| Implementation integrity | 3 |
| **Total** | **18 / 20 — Excellent (minor polish)** |

## The two findings this surface deferred at its own gate are DONE

Verified here rather than assumed:

| deferred 2026-09-19 | shipped | measured now |
|---|---|---|
| **T4 / DR3** — the text inputs had no boundary meeting WCAG 1.4.11's 3:1 | `f2e41d6` | `border: 1px solid rgb(133,134,135)` = `#858687`: **3.65:1** against the white sheet, **3.26:1** against their own `#f2f2f3` fill. Hover `/55` composites to 3.36 and 3.24. All four match `field.tsx`'s claim exactly. |
| **DR4** — the header's MEMBER PORTAL button was 29.0px tall at 360 | `b01dc6a` | **48.0px** below `sm`, inside a header shell that measures **61.0px at all nineteen widths tested** — so this surface's bar is unaffected by it. |

⚠️ **DR4's second half is not closed.** It also recorded the button's left edge
3.0px from the wordmark at 360. Re-measured this round: **10.4px at a true 360
layout and 3.0px at 345** — the older figure was the scrollbar case, unlabelled,
which is the same defect as T5. It stays with the officer question in
`officer.md` O5.

## Focus indicators were checked by diffing pixels, not by reading computed style

Ten focusable elements, across four states, screenshotted focused and unfocused
and diffed. **Every ring paints, and every changed-pixel count matches the ring's
geometry to within one pixel.** Table in `audit.output.md`. 📌 And the surface has
no two-ground focusable element at all, so the hub's paint-order defect cannot
occur here — worth stating rather than leaving implicit.

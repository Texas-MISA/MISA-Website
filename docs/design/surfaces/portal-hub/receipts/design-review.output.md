# `design-reviewer` agent — raw output

Surface `portal-hub`, route `/portal`, local dev server. Reviewed at 360, 768
and 1280px. Settled state: `js` class removed from `<html>`.

```yaml
findings:
  - id: DR1
    summary: "Medium — /portal @ 360/768/1280, keyboard focus state: the row focus ring is invisible where it crosses the navy key. The outline computes to rgb(22,48,92) and the key's background is rgb(22,48,92) — identical, 1.00:1 — so with -outline-offset-2 the ring is drawn inside the 48px key and simply vanishes there. The focused row reads as a box around the white cell that stops dead at the seam (confirmed visually on the Event Check-In row at 1280). WCAG 2.2 focus-appearance wants the whole indicator to contrast with what it sits on."
    disposition: deferred
    reason: awaiting the lead's decision
  - id: DR2
    summary: "Medium — /portal @ 360, default state: the officers' 'sign in' link is a 39.3 x 17px tap target (font-size 14px, no padding), against the 44/48px the brief sets for this surface's targets and the 24px WCAG 2.2 floor. It also lands at y 632.6-652.6 on a 640px screen, i.e. entirely below the fold, so the only way to hit it is to scroll and then hit a 17px target."
    disposition: deferred
    reason: awaiting the lead's decision
  - id: DR3
    summary: "Nit — /portal @ 1280, hover state: the title's hover swap is #16305C -> #0D1D38 (13.03:1 -> 16.4:1 on white), two dark navies that are near-indistinguishable at 34px; the key swaps between the same two values. The hover therefore reads almost entirely as the key block darkening. Not a defect against EV14 (the affordance is visible at rest), just an ink swap that is doing less than it looks like in code."
    disposition: deferred
    reason: awaiting the lead's decision
  - id: DR4
    summary: "Nit — /portal @ 1280, default state: the plate is 768px wide and each row is 104.3px tall, so ~490px of the row (from the body text's right edge at x=688 to the key at x=975) is empty white. The brief's '1280 without the column turning into a sparse strip' is met in the sense that the plate is not a thin strip, but the rows are visibly hollow at desktop width."
    disposition: deferred
    reason: awaiting the lead's decision
```

## Measured geometry

Settled — `js` class removed from `<html>`; no `data-reveal` present in `main`
at all, so nothing to force.

| Width | Header | Band (top–bottom) | Check-In row | Leaderboard row | Lookup row | Officer line | h-scroll |
|---|---|---|---|---|---|---|---|
| 360×640 | 61px sticky | 61–191.5 (130.5 tall) | 232.5–**328.6** (96.1) | 329.6–451.3 (121.7) | 452.3–599.6 (147.3) | 632.6–652.6 | none (scrollWidth 360) |
| 768×1024 | 61px | 61–215.7 (154.7) | 272.7–376.9 (104.3) | 377.9–482.2 | 483.2–587.5 | 620.5–640.5 | none |
| 1280×800 | 61px | 61–215.7 (154.7) | 272.7–376.9 (104.3) | 377.9–482.2 | 483.2–587.5 | 620.5–640.5 | none |

**The bar is verified.** At 360×640, settled, under the 61px sticky header, the
check-in row's bottom edge is **328.6px** against a bar of "at or above 424" —
95px of margin, and the build's reported 328 is accurate. All three
destinations sit fully in the first 640px screen (lookup bottom 599.6). Row
height is 96.1px at 360 and 104.3px elsewhere, comfortably over the 48px target
floor; the navy key measures exactly 48px wide at every width.

## Everything else checked

**Zero muted ink:** no element in `main` computes to `--misa-muted` (#6f7275),
and every ink was measured on the ground it actually sits on — h1 white on the
navy field 16.80:1, row titles #16305C on white 13.03:1, row bodies #4A4D50 on
white 8.51:1, the officer line #4A4D50 on Vellum rgb(242,242,243) 7.60:1, "sign
in" 11.65:1. Lowest ratio on the page is 7.60:1.

**Keyboard:** tab order is skip link → (menu button at 360 / nav items at 1280)
→ wordmark → MEMBER PORTAL → Event Check-In → Points Leaderboard → My
Attendance → sign in, matching reading order exactly, every stop in view, every
stop with a 2px ring. The row rings are correctly `-2px` offset and do **not**
cross the 1px seam onto the neighbouring cell — DR1 is about their colour, not
their placement.

**Motion / JS off:** no `data-reveal` anywhere in `main`, so reduced-motion and
JS-off are identical to the default; with JavaScript disabled all three
destinations render and are usable at `opacity: 1`.

**Console:** completely clean — zero errors, zero warnings, zero hydration
messages at all three widths.

**Header clearance at 360** is 10.4px between the wordmark's right edge (221)
and the MEMBER PORTAL button's left (231.4) — tight, but no collision, and the
header is out of this surface's scope.

**Tooling note.** I used Playwright (the repo's own install) rather than Chrome,
because this machine's 1.75 device-pixel ratio made the extension's window
sizing give a 643px CSS viewport when asked for 360.

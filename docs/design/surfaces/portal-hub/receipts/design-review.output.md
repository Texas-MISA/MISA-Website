# `design-reviewer` agent — surface `portal-hub` at http://localhost:3000/portal

Re-gate, 2026-09-20, against `a660ada`. 360 / 768 / 1280 (and 320).

**Browser: Playwright (bundled Chromium), headless, `deviceScaleFactor: 1`.** The
Chrome extension was connected but unusable for geometry — `resize_window` to
1280 left `document.documentElement.clientWidth` at **1646** (screen width 1646,
DPR 1.75, window already maximized), so the agent abandoned it after using it
only to validate the contrast formula on the WCAG reference pairs (`#767676` on
white = **4.54**, black on white = **21.00**, white on `#16305c` = 13.03). Every
Playwright context reported `clientWidth` equal to the width asked for and
`devicePixelRatio: 1`. The `js` class was removed from `<html>` before every
geometry read, so the layout is settled and no reveal transition is in flight.
📌 The same 1.75-DPR constraint was hit independently at the 2026-09-19 gate.

## Findings

- **DR1 — [High] destination row `focus-visible`, 1280 and 360.** The row's focus
  ring is 1.00:1 for the 48px it crosses the navy key. The key's white ring is
  painted over by the row link's own navy outline on all three edges they share.
  A pixel scan down the key's centre at 1280 (keyboard focus, settled 900ms)
  reads `rgb(22,48,92)` for `key.y..key.y+43` with **no white band at the top
  edge**; the same scan over the white cell shows the navy ring at 13.03:1. The
  only white segment that survives is the key's **left** edge (x 975–976,
  `rgb(255,255,255)`), which abuts the white cell and is therefore invisible too.
  Net: **the indicator visibly stops at the seam** — the exact defect
  `app/(public)/portal/page.tsx` claims was fixed ("the two segments meet at the
  seam and read as one continuous indicator").
- **DR2 — [Medium] default, every width.** The row text column never aligns with
  the masthead, and the offset flips sign between phone and desktop. At 1280 the
  h1 and the officers line start at x=289 while the three h2 titles start at
  x=281 (8px left); at 360 the h1/officers line start at x=37 and the titles at
  x=45 (8px right). Cause: the plate bleeds by exactly the sheet padding
  (−16 / −32) and each cell then re-pads `px-6` = 24, which equals neither.
  **Three different left edges in one 320px-wide document.**
- **DR3 — [Nit] default, 360 and 320.** The three identically-formatted rows
  measure 92.7 / 118.3 / 143.9px (bodies wrap to 1, 2 and 3 lines), a 51.2px
  spread that reads as a staircase; at 768 and 1280 all three are exactly 96.9px.
  The officer's equal-formatting rule only looks equal above `sm`. Titles
  themselves do not wrap at 320 (each stays one line in a 182px column), so the
  brief's stated 360 risk is met.
- **DR4 — [Nit] row active/press, 1280 and 360.** Press is indistinguishable from
  hover on a pointer device: hover and active both compute title
  `rgb(13,29,56)` and key background `rgb(13,29,56)`; `transform` stays `none`
  and `box-shadow` `none` in rest, hover and active alike. On touch the state
  does read (no hover precedes the tap), though
  `[-webkit-tap-highlight-color:transparent]` removes the platform's own flash,
  so the ink swap is the only press feedback a phone gets.
- **DR5 — [Nit] officers sign-in, 360 / 768 / 1280.** The "sign in" link's hit
  area measures **44.9 × 32.0px** at every width (`inline-block py-1` = 4px top
  and bottom on a 24px line box). It is the only interactive target on the page
  under the 48px floor this surface sets for itself: the three rows are
  92.7–143.9px and the header's portal button is 48px. WCAG 2.2 §2.5.8 (24px)
  passes; the page's own EV1 bar does not.
- **DR6 — [Nit] header MEMBER PORTAL button `focus-visible`, 1280 and 360.** The
  focus ring **fades in from invisible**. Pixel-sampled immediately after the Tab
  press the 2px ring is `rgb(149,161,181)` (navy at 45.4% over the white header);
  after 900ms it is `rgb(22,48,92)` at 13.03:1. `transition-colors` on the button
  covers `outline-color`, and the unfocused `outline-color` is `currentColor` =
  white, so the ring animates white → navy. **Shared chrome**
  (`components/ui/button.tsx` / `components/site-header.tsx`), not this surface's
  file, but it is the control the hub's no-back-link decision leans on. The
  destination rows do **not** have this: their ring reads navy on the first frame.
- **DR7 — [Nit] all widths.** Two numbers in the page's own comment no longer
  match the build: *"Lowest ratio anywhere on the route is 7.60:1"* while the
  same paragraph names the header/footer muted ink at 4.84:1 — measured, the
  lowest on the route is **4.84:1** and the lowest inside the sheet is **8.51:1**.
  And the officers line is called `--misa-secondary` "7.60:1 on this grey ground"
  in one comment; it now sits on the sheet's white and measures 8.51:1.
- **DR8 — [Nit] all widths.** The sheet and its rows are separated from their
  grounds by boundaries below 3:1. The `.sheet` frame is `#bfbfc2` on the
  `#f2f2f3` page ground = **1.64:1**, carried by `shadow-lift` at 6–8% navy; the
  plate's `border-y` and its 1px seams are `rgba(29,31,32,0.16)` = 1.38:1 on
  white. Non-text, and each row is still identified by its title and navy key, so
  SC 1.4.11 is arguably not engaged — but the object-on-a-ground conceit rests on
  a 1.64:1 edge plus a shadow that forced-colors mode removes.

## The gate bar passes, with 156.8px to spare

At 360×640, settled, scroll 0, under the 61px sticky header: the Event Check-In
row's bottom edge is **267.2px** against a bar of "at or above 424". All three
destinations are on the first screen — bottoms at **267.2 / 386.5 / 531.4** — and
so are the officers line (588.4) and the whole sheet (top 85, bottom 609.4). The
path is still two taps: the header's MEMBER PORTAL button carries
`aria-current="page"` and the row is a `next/link` to `/portal/attend`. The
brief's 2026-09-19 table (check-in 384–423) is superseded by a build that is
156px faster, not slower.

## Verified, passing, and worth recording

No horizontal overflow at any width — `scrollWidth === clientWidth` at 1280, 768,
360 and 320. **Zero console errors and zero warnings** at all four widths, and no
hydration diff. JavaScript off: identical geometry, `opacity: 1` on all three
rows, three rows present; `main` contains **zero** `[data-reveal]` nodes, so the
reveal is not in play and reduced motion is a no-op. Tab order at both 1280 and
360 is check-in → leaderboard → lookup → officers sign in, matching visual order
exactly, with the row ring inset (`outline-offset: -2px`) so it does not straddle
the seam onto the neighbouring cell — that part of the design holds. The masthead
rule and the plate bleed to the sheet's padding box precisely: at 1280 the
sheet's border box is 256→1024 and both the `<hr>` and the `<ul>` are 257→1023;
at 360, 20→340 and 21→339. Type ramp clean: h1 26→34, h2 22→26, all bodies 16px —
**no 14px anywhere in the sheet**. Contrast inside `<main>`: h1 16.55:1, row
titles 13.03:1, row bodies 8.51:1, officers line 8.51:1, its link 13.03:1,
chevron 13.03:1 — **zero `--misa-muted` in main**, lowest in-sheet ratio 8.51:1.
The navy key reaches the sheet's inner edge exactly and is 48px wide on every
row. The header does not collide with the wordmark: at 360 the wordmark is
centred (139–221) and the 48px button starts at 231.4 — a **10.4px** gap, tight
but clear; at 320 the button wraps to two lines in a 65.9 × 48px box with a
33.1px gap. The page still orients without a back link.

## Not verified

Forced-colors / Windows High Contrast, real touch input (press was simulated with
`mouse.down`), and an actual phone. DR8's severity assumes `shadow-lift` renders.
The Chrome extension could not be used for any measurement, so nothing here is
cross-checked in a second engine.

## One claim set out to reproduce and could not

A first reading of the header button's focus ring said `rgb(255,255,255)` at
`outline-offset: 2px` on a white header — a 1.00:1 invisible ring. **That was
wrong: it was a mid-transition read.** The settled computed value is
`rgb(22,48,92)` and the painted pixels are 13.03:1. What survives from it is only
DR6, the fade-in. Conversely DR1 is the claim this surface wrote down about
itself that does not hold: the reviewer read the comment, expected the white ring
to work, and the pixels say the parent's navy outline wins.

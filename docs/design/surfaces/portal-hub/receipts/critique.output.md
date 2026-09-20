# `/impeccable critique app/(public)/portal/page.tsx` — raw output

Two isolated parallel sub-agents. Assessment A saw no detector output;
Assessment B was told not to editorialise in A's place.

---

# Assessment A — Design Review (independent director pass)

Mode: Operate. Inspected live at `http://localhost:3000/portal`, settled state
(removed `js` from `<html>`; no forced `data-revealed`).

**Measurements taken (for the record, not detector work):**
- 360: band 61→191 (130px); rows Event Check-In 232–328 (h 96), Points
  Leaderboard 329–450 (h 122), My Attendance 451–599 (h 147); officer line top
  631; scrollHeight 865; no h-overflow.
- 1280: rows 272–376 / 377–481 / 482–587, all h 104; plate 768px wide.
- Type: h1 26px@360 / 34px@1280; all three row titles 26px / 34px — **identical
  to the h1 at both widths**.
- Ink: titles `rgb(22,48,92)`, bodies `rgb(74,77,80)`; zero `--misa-muted`
  inside `<main>`.
- Check-in bottom edge at 360 = **328px** against a bar of ≤424.

## 1. Design-specificity verdict

**Grounded in this product, not interchangeable.** The chevron notch at the
band's foot rhymes with the chevron key at each row's end, so the page's one
repeated mark is the same glyph doing two different jobs. The shared-rule plate
is this system's existing device, the field band is the site's own drawn navy,
and the display face at 26/34 is the site's ramp. Swap in another club's
palette and this page does not still work.

Where it loses a little specificity: once the notch scrolls past, the three
rows are a generic "title + sentence + chevron" list. That is a deliberate
officer constraint, so not a finding; but it means the specificity lives almost
entirely in the 130px band, which is also the part most under height pressure.

## 2. Nielsen heuristics

| # | Heuristic | Score | Note |
|---|---|---|---|
| 1 | Visibility of system status | **2** | No press/active feedback on any row. On the touch device this surface is designed for, a tap produces no acknowledgement at all. |
| 2 | Match to the real world | **4** | "My Attendance" in particular beats the route's own "Lookup". |
| 3 | User control and freedom | **3** | Three exits plus the header; nothing trapped, nothing destructive. |
| 4 | Consistency and standards | **3** | Docked for the type ramp collapse (Issue 2) and the band restating the header button (Issue 3). |
| 5 | Error prevention | **4** | Three unambiguous targets, ≥96px tall — well over EV1's 48px. |
| 6 | Recognition over recall | **4** | Every destination names and explains itself in one read. |
| 7 | Flexibility and efficiency | **3** | Default prefetch (EV7), one tap to check-in, first in order. |
| 8 | Aesthetic and minimal design | **3** | Held back by three titles at h1 scale and the ragged 96/122/147 rhythm. |
| 9 | Help users recover from errors | **n/a** | No error states of its own (brief §States). |
| 10 | Help and documentation | **n/a** | A help affordance here would be the orienting line the officer excluded. |

## 3. Cognitive load

**Low, and honestly so.** Three choices, one decision, no state to hold. The
one real cost is scale-driven: because the row titles render at the same size
as the page title, the eye has no cue about which level of the page it is
reading, so the first fixation lands somewhere in the middle of the plate
rather than on the first row. At 360 that is compounded by the height rake —
"My Attendance" is the biggest object on the screen and pulls the eye
last-to-first.

Reading burden: 19 words of body copy for 3 destinations, three of which are
the word "MISA" on a MISA-only page.

## 4. Emotional journey

Arrival is **confident** — the notched navy field lands immediately, above the
fold. Then a small **stall**: the h1 repeats the button just tapped, so the
first 130px confirm rather than advance. Then **relief**: the plate is
unmistakably three things and nothing is hidden or delayed. The tap itself is
the flat note — nothing happens under the thumb, and on a slow venue
connection that half-second of nothing is the one moment the page feels
unfinished. Departure is clean.

Arc: **assured → slightly redundant → decisive → momentarily dead → gone.**
Fixing the press state converts the whole arc to assured.

## 5. Strengths

1. **The no-reveal decision is the best call on the page, and it is enforced
   structurally rather than remembered.** Both files write down *why*, and the
   measurement trap (the 18px `translateY`) is recorded alongside it.
2. **Equal formatting is made structural, not disciplinary.** One `.map` over
   one shape, so making check-in louder requires breaking the loop — a change a
   reviewer can see in a diff.
3. **The whole-row link with `aria-labelledby`/`aria-describedby` and the inset
   focus ring** is the correct answer to three problems at once: no nested tap
   target, no run-on accessible name, no ring straddling the seam.

## 6. Priority issues

**1 — No press/active state.** `page.tsx:145` and `:167`. The brief promises
"hover and press only swap ink" and the file's own comment says the same, but
there is no `active:`/`group-active:` anywhere. **Fix:** add
`group-active:text-misa-blue-dark` and `group-active:bg-misa-blue-dark`. Colour
swap only, same `duration-150` — fully within DESIGN.md.

**2 — Page title and destination titles are the same ramp step.** Both use
`Title`; measured identical at both widths. **Fix:** step the destination
titles down one rung of the ramp — a ramp step, never a one-off size.

**3 — The band restates the header button and charges 130px for it.**
Measured 61→191 at 360, directly under the header's current-marked MEMBER
PORTAL button. The brief permits change here. **Fix:** either shorten the band
to the notch and grid with no h1, or re-title it. Not a request to change
`PortalBand` — it is the hub's `title` prop.

**4 — At 360 the row heights rake 96 / 122 / 147.** Equal *formatting* is
preserved; what is unequal is the copy. **Fix (needs officer sign-off):** trim
each body to one line at 360. The word "MISA" appears in all three bodies on a
MISA-only page.

**5 — The page scrolls at 360 although all three destinations fit**, and the
officer line sits at 631 on a 640 screen. **Fix:** `mt-6` at `:176`.

## 7. Persona red flags, minor observations, questions

- The dead tap is the one that will be *felt*. A member who gets no press
  feedback taps again — the harm is confusion rather than data, but it reads as
  "the site is broken" at the worst moment.
- The hub's traffic depends entirely on a header control this surface does not
  own.
- `slug` and the "`useId` is not available in a Server Component" reasoning are
  correct for Next 16.
- At 1280 the plate reads as a deliberate centred object, not a sparse strip.
  No action.
- Keyboard order matches reading order (EV5).
- *Question:* three destinations formatted identically costs nothing at three
  and a lot at five (houses, bingo). Is the rule about equality, or about not
  making check-in a primary button? The answer determines whether the later
  re-layout inherits the constraint.
- *Question:* the hub has already solved the `--misa-muted`-on-Vellum failure
  for itself. Should it be the reference implementation for the other three
  surfaces, written into the plan rather than rediscovered per surface?

---

# Assessment B — Detector + Browser Evidence

## 1. Detector — JSON verbatim

`detect.mjs --json "app/(public)/portal/page.tsx"` (advisory included): `[]`, exit 0.
`detect.mjs --json "components/ui/portal-band.tsx"`: `[]`, exit 0.

**Verified this is a real clean result, not a silent no-op:** the same detector
on a planted fixture (`border-l-4` + `from-purple-500`) returns two findings
and exit 2. `.impeccable/config.json` carries three `ignoreValues` entries,
none scoping to either portal file; `ignoreRules` and `ignoreFiles` are empty.

## 2. Browser evidence

Playwright (Chromium, deviceScaleFactor 1, exact viewports), `js` class removed
before every read, scroll 0. The Chrome extension could not produce a 360px
viewport on this machine (dpr 1.75; it reported success but `innerWidth` stayed
658), so it was not used for geometry.

### Rendered geometry (px from viewport top, scroll 0)

| | 360×640 | 768×1024 | 1280×900 |
|---|---|---|---|
| Sticky header | 0 → **61.0** | 0 → 61.0 | 0 → 61.0 |
| Band | 61 → 191.5 (h 130.5) | 61 → 215.7 | 61 → 215.7 |
| Row 1 **Event Check-In** | 232.5 → **328.6** (h 96.1) | 272.7 → 376.9 | 272.7 → 376.9 |
| Row 2 Points Leaderboard | 329.6 → 451.3 (h **121.7**) | 377.9 → 482.2 | 377.9 → 482.2 |
| Row 3 My Attendance | 452.3 → 599.6 (h **147.3**) | 483.2 → 587.5 | 483.2 → 587.5 |
| "Officers: sign in" | 632.6 → 652.6 | 620.5 → 640.5 | 620.5 → 640.5 |

**Build claim verified.** Check-in bottom edge at 360×640 = **328.6px**,
matching the claimed 328, comfortably at or above 424. Band 130.5px vs the
documented "~131px". Header exactly 61.0px.

**Unclaimed measured fact:** at 360 the three rows are **not equal height** —
96.1 / 121.7 / 147.3 — because the bodies wrap to 1, 2 and 3 lines. Formatting
is identical; the rendered rhythm is a stepping stack. Handed to Assessment A
as a fact, not a verdict.

### Horizontal overflow

360 / 768 / 1280: `scrollWidth` == `innerWidth` at every width. **None.** The
only negatively-positioned node is `a.skip-link` at `left: -9999px`, by design.

### Contrast — every text node, against the background it actually renders on

| Text | Size | Colour | On | Ratio | AA |
|---|---|---|---|---|---|
| H1 "Member Portal" | 26 / 34px | `#ffffff` | `#0d1d38` band | 16.80 | pass |
| H2 row titles ×3 | 26 / 34px | `#16305c` | `#ffffff` cell | 13.03 | pass |
| Row bodies ×3 | 16px | `#4a4d50` | `#ffffff` cell | 8.51 | pass |
| "Officers:" | 14px | `#4a4d50` | `#f2f2f3` ground | **7.60** | pass |
| "sign in" link | 14px | `#16305c` | `#f2f2f3` ground | 11.65 | pass |
| **Desktop nav ×4** (1280) | 13px | **`#6f7275`** | `#ffffff` | 4.84 | pass |
| **Footer `txmisa@gmail.com`** | 13px | **`#6f7275`** | `#ffffff` | 4.84 | pass |

**Nothing on this route falls below 4.5:1.** The `--misa-muted`-on-Vellum
4.33:1 failure does **not** occur here.

**But the "ZERO muted ink" claim is false as rendered.** `#6f7275` *is*
present: four desktop nav items at 1280 and the footer email at every width.
Both come from shared header/footer chrome, not from `page.tsx`. The page's own
content is genuinely muted-free; the comment states the stronger,
rendered-scope claim and that one does not hold — the same "grep hit vs.
render" error it accuses the earlier count of making, inverted.

### Font sizes vs. the ramp

| Node | 360 | 768 | 1280 | Ramp row |
|---|---|---|---|---|
| H1 | 26 | 34 | 34 | Title ✅ |
| H2 row titles | 26 | 34 | 34 | Title ✅ |
| Row bodies | 16 | 16 | 16 | Body ✅ |
| "Officers: sign in" (`text-sm`) | **14** | **14** | **14** | **on no ramp row** ❌ |
| Header/footer chrome | 13 | 13 | 13 | **on no ramp row** (not this file) |

Note for Assessment A: the row titles render at **exactly the same size as the
page H1**. Both on-ramp, but there is no type-size step between the page title
and the three things under it.

### Console

0 errors, 0 warnings at all three widths. No `pageerror`, no hydration diff,
no `validateDOMNesting` warning — the `<h2>`-inside-`<span>`-inside-`<a>` shape
does not trip React's nesting validator.

### Focus ring

| Row | `:focus-visible` | outline | offset | ring bounds | cell bounds | clipping ancestor |
|---|---|---|---|---|---|---|
| Event Check-In | yes | `solid 2px rgb(22,48,92)` | **−2px** | 234.5 → 326.6 | 232.5 → 328.6 | none |
| Points Leaderboard | yes | `solid 2px rgb(22,48,92)` | −2px | 331.6 → 449.3 | 329.6 → 451.3 | none |
| My Attendance | yes | `solid 2px rgb(22,48,92)` | −2px | 454.3 → 597.6 | 452.3 → 599.6 | none |

Ring visible on all three rows, drawn inside its own cell, not clipped, does
not cross the seam. (My first pass flagged "crossesSeam: true" — a sign error
in my own offset arithmetic, corrected above.)

## 3. Verified defects

**Real:**
1. Off-ramp font size, this file's own: the officer line at **14px**.
2. The "renders ZERO muted ink" comment is false as rendered.
3. Unequal row heights at 360 (96.1 / 121.7 / 147.3).

**False positives / claims that check out:** detector clean (confirmed against
a planted control); check-in bottom 328.6 and at-or-above-424 verified; 61px
header and ~131px band verified; focus ring crossing the seam **not
reproduced**; `--misa-muted` on the `#f2f2f3` ground **not present**; no
horizontal overflow; no console errors or DOM-nesting warnings.

No files modified; temporary script removed; `git status` unchanged.

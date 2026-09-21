# `/impeccable audit app/(public)/portal/attend/` — code-level technical checks

Run at `77d2c568ed093f78a6b437e053bbef0533eff9e4`, against the running page on
the local stack. Five dimensions, scored 0–4.

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | **3** | The busy state delivers neither of EV7's last two thirds: focus drops to `<body>` and the live region stays empty for the whole request |
| 2 | Performance | **4** | No layout reads in render, no images, uncontrolled inputs, four icons imported individually |
| 3 | Responsive design | **4** | Zero horizontal overflow at 320 and 360 on every state, including a 117-character unbroken email; every target ≥ 48px |
| 4 | Theming | **4** | Every colour is a token; `color-scheme: light` is set site-wide |
| 5 | Implementation integrity | **3** | Five measurements the surface asserts about itself no longer reproduce, and the surface is frozen — so they are the record |
| **Total** | | **18/20** | **Excellent (minor polish)** |

## Implementation Integrity verdict — PASS, with a qualification

The implementation is unmistakably this product's. Nothing here is a generic
form: the twelve states are enumerated in a discriminated union with an
exhaustive `never` guard, the outcome tone is chosen by *what the server found*
rather than by success/failure, the honeypot and the pre-hydration path are
real, and every shared shape goes through `components/ui/`. Zero raw class
dialects; zero hard-coded colours. There is no interchangeable-with-another-
product structure to flag.

**The qualification is documentary, not structural.** This is a `rebuilt`
surface, which means its files are frozen and read rather than re-measured — and
five of the specific numbers it asserts about itself stopped being true when the
navy band came off. They are listed in `lead.md` (L1–L5). In a frozen surface a
wrong measurement in a comment is not a cosmetic problem: it is the record the
next build is derived from, and part 4 derives `/portal/lookup` from one of them
next.

---

## 1. Accessibility

### Focus indicators — PIXEL EVIDENCE, not `getComputedStyle`

🔴 **This is the check the portal-hub gate got wrong on 2026-09-19.** It "fixed"
a two-ground focus ring and verified it with `getComputedStyle`, which reported
the outline present, correct and inset. It never painted. So every focus
indicator here was screenshotted focused and unfocused and **diffed**; the
changed pixels are the indicator and nothing else.

| element | state | rect | changed px | ring's geometric area | changed-pixel colour |
|---|---|---|---|---|---|
| `input[name=fullName]` | idle | 510 × 50 | 3404 | 3404 | 100% `rgb(22,48,92)` |
| `input[name=eid]` | idle | 510 × 50 | 3404 | 3404 | 100% `rgb(22,48,92)` |
| `input[name=email]` | idle | 510 × 50 | 3404 | 3404 | 100% `rgb(22,48,92)` |
| `input[name=firstTime]` | idle | 16 × 16 | 176 | 176 | 100% `rgb(22,48,92)` |
| Check in | idle | 208 × 48 | 1072 | 1072 | 100% `rgb(22,48,92)` |
| `input[name=firstTime]` | unmatched | 16 × 16 | 176 | 176 | 100% `rgb(22,48,92)` |
| Check in | unmatched | 208 × 48 | 1072 | 1072 | 100% `rgb(22,48,92)` |
| Confirm and check in | review | 200 × 48 | 1040 | 1040 | 100% `rgb(22,48,92)` |
| Edit details | review | 137.3 × 48 | 788 | 789 | 100% `rgb(22,48,92)` |
| See your points and attendance | present | 217.3 × 48 | 1108 | 1109 | 100% `rgb(22,48,92)` |

`(w + 8)(h + 8) − (w + 4)(h + 4)` is the area of a 2px ring at 2px offset. **Every
row matches to within one pixel**, and every changed pixel is the navy. So all
ten indicators paint, in full, on their whole perimeter.

📌 **And the surface has no two-ground focusable element at all**, which is why
the hub's defect cannot occur here: the navy submit's ring is drawn *outside* the
button at `offset 2`, entirely on the white sheet, and the checkbox's is drawn on
white too. Worth stating rather than leaving implicit — the rule DESIGN.md wrote
yesterday is about an element that *spans* two grounds, and none does.

⚠️ **The ring's timing is a separate matter and it is not clean.** See
`motion.output.md` M1: `outline-color` rides inside `transition-colors`, so on
the navy submit the ring animates from white and is invisible for the first
~30ms. Deferred to part 6 with the mechanism measured.

### Focus placement, per state — measured `document.activeElement`

| state | focus lands on | correct? |
|---|---|---|
| idle | `<body>` | yes — first render, nothing has happened |
| submitting | **`<body>`** | **no — see T1** |
| invalid | the first `[aria-invalid="true"]` input | yes (EV1) |
| unmatched | the `[role="alert"][tabindex="-1"]` banner | yes (EV1) |
| needs_confirmation (both) | the `<h2 tabindex="-1">` | yes — the screen continues the task |
| present / pending / duplicate / refused | `<body>` | yes, deliberately — the screen ends the task and `StatusRegion` announces it |

### Announcements — measured `[role="status"]` contents

| state | region text |
|---|---|
| idle, invalid, unmatched, needs_confirmation | `""` — each announced by something else |
| **submitting** | **`""`** — **nothing announces it (T1)** |
| present | "You're checked in. Your attendance at … is recorded." |
| pending | "Check-in received. No event window is open, so an officer will match it to the right event." |
| duplicate (was present) | "Already recorded. You're already checked in to this event." |
| duplicate (was pending) | "Already recorded. Your check-in is awaiting officer review." |
| refused | "No event around this time. Nothing was recorded." |

The region is `<p role="status" aria-atomic="true" class="sr-only">`, present
from first paint, text-only changes. Correct by the invariant it exists for.

### Contrast — every text node, every state, on the ground it actually sits on

Formula self-checked on the WCAG reference pairs each run: `#767676` on white =
**4.54**, black on white = **21.00**. Alpha composited against the real ground.

**Lowest ratio anywhere in `<main>`, in any state: 8.51:1** — Secondary Graphite
`rgb(74,77,80)` on the sheet's white, which is the box reassurance and the review
step's `<dt>`s. Nothing on this surface is below 4.5:1 in any state. The terminal
panels bottom out at 9.79:1 (Body Graphite on the critical wash), 9.88 (affirm)
and 9.98 (caution).

### Semantics, ARIA and forms

- `<h1>` masthead → `<h2>` outcome/review. One `<h1>`, no skipped level.
- The checkbox's accessible name is the label span alone (`aria-labelledby`),
  with the reassurance as `aria-describedby` — the accname split
  `components/ui/field.tsx` documents.
- The Lucide mark is `aria-hidden="true"`; every word of the outcome is in text.
- Three field errors carry `role="alert"`; three banners carry `role="alert"` and
  `tabIndex={-1}`.
- The honeypot is `aria-hidden` + `tabIndex={-1}` and off-screen.
- All three inputs are `required`; nothing marks them visually, which is correct
  here because *all* of them are — there is no optional field to distinguish.
- `prefers-reduced-motion`: nothing moves. See `motion.md` M5 for why not gating
  the colour transitions is right rather than an omission.

## 2. Performance

No layout reads in render — the two `useEffect`s are the only DOM access and
they `querySelector` + `focus` once per state change. No images. No
`will-change`. Uncontrolled inputs driven by `defaultValue` from echoed server
state. Four Lucide icons imported by name. Zero console errors on every state
driven, at 320, 360 and 1280.

## 3. Responsive design

`scrollWidth − clientWidth = 0` on all fifteen states captured — fourteen at 360
or 1280 and one at 320 — including three driven with a **65-character** name, a
**32-character** EID and a **111-character** unbroken email. (An earlier draft of
this receipt said 64 and 117; the second critique assessment counted the
fixtures.)

**Tap targets.** Check in 48.0, Confirm and check in 48.0, Edit details 48.0, the
three inputs 50.0, the lookup link 48.0 at 1280 and 72.0 at 360 (its label wraps
to two lines there). 🪤 **The one control smaller than 48px is the checkbox
`<input>` itself, at 16 × 16** — `CHECKBOX` is `size-4`. That is by design and
the mitigation is measured: the wrapping `<label>` carries `min-h-12`, is the tap
target, and measures **84.0px at 360, 64.0 at 375–1280 and 104.0 at 320**. Stated
this way because an earlier draft wrote "every target ≥ 48px", which is false of
the element and true only of the row.

## 4. Theming

Every colour reaches the page through a token — `text-misa-secondary`,
`text-misa-blue`, `text-foreground`, `bg-misa-panel`, `border-misa-control-edge`,
the four `Banner` tones. No literal colour in either file (the detector's colour
rule, the one rule it *can* run here, agrees — see `detector.md`). The site is
light-only with `color-scheme: light` set in `globals.css`, so there is no dark
variant to be missing.

## 5. The two findings this surface deferred at its own gate — both now DONE

| deferred | now | verified here |
|---|---|---|
| **T4 / DR3** — text inputs had no boundary meeting WCAG 1.4.11's 3:1 | `f2e41d6` introduced `--misa-control-edge` | the three inputs render `border: 1px solid rgb(133,134,135)` = `#858687`: **3.65:1** against the white sheet, **3.26:1** against their own `#f2f2f3` fill |
| **DR4** — the header's MEMBER PORTAL button was 29.0px tall at 360 | `b01dc6a` added `max-sm:min-h-12` | the button is 48.0px below `sm`, inside a header shell that measures **61.0px at all nineteen widths tested** — so this surface's bar is unaffected |

⚠️ **DR4's second half is not closed.** It also recorded the button's left edge
3.0px from the wordmark at 360. That is nav-clearance territory and still
`components/site-header.tsx`; it stays with the officer question in `officer.md`
O5.

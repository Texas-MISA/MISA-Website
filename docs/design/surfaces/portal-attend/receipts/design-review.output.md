# design-reviewer — `/portal/attend`

Run 2026-09-20 against `a38a2b3d3fb740cc9565fdfb2036dfee72449efb`, in Chrome
against the local dev server, at 360 / 768 / 1280.

🪤 **This is the SECOND run. The first was killed after an hour with no
output**, and the cause is worth recording because it will recur: the lead was
driving the same Chrome tab at the same time, and two CDP clients on one browser
wedged the renderer — two of the lead's own calls had already timed out
(`Page.captureScreenshot` at 30s, `Runtime.evaluate` at 45s) before the agent
stalled. The second run was given the browser to itself, an event left open so
it needed no database work, an explicit ban on `requestAnimationFrame` loops (a
background tab never advances rAF), and a ~15-minute budget. It returned in ten.
**Only one agent may drive the browser at a time.**

---

## The bar, verified independently

At a true 360×640 viewport (iframe with the scrollbar suppressed, so
`documentElement.clientWidth === scrollWidth === 360`), idle, scroll 0, under
the 60.6px sticky header:

> Check in button — top **562.5**, **bottom 610.5**, height 48.0. **29.5px of
> slack under the fold.**

Fields at 239.1–288.2, 328.2–377.4, 417.4–466.5 (49.1px each); box row
482.5–546.5; 16px between the box row and the button. The lead's independent
measurement was 611 with a classic scrollbar present. **The bar is met.**

One number recorded rather than raised as a finding: **unmatched pushes the
button to bottom 731.7** — the banner is 105.1px and with its 16px gap that is
+121.2px on idle's 610.5, where the brief anticipated "roughly 90px". Measured
at 360 with a classic scrollbar (content 345px), so on a true 360 the banner may
lose a line and land nearer +100. The bar is IDLE-ONLY by decision, so this
reports rather than gates.

## Findings

### DR1 · Medium · the box row is 44px at ≥ `sm`

`label:has(input[name=firstTime])` measures **44.0px at 1280×800 and 44.0px at
768×900** — four pixels under the 48px floor the brief commits to (EV4: *"the
whole box row is the checkbox's target and is at least 48px tall"*). At 360 the
label wraps to two lines and the row is 64.0px, so only ≥`sm` is short.

The label at `checkin-form.tsx:389-401` carried no min-height, and **the comment
at `:383` declined `min-h-12` on a figure that could not be reproduced at any
width** — it claimed "the block is already 87px" against measurements of 64.0 at
360 and 44.0 at 768 and 1280. Adding the floor costs the 360 bar nothing,
because 360 already clears it.

### DR2 · Medium · the unmatched alert is painted the same colour as the empty inputs below it

The neutral `<Banner>` at `checkin-form.tsx:302` computes
`backgroundColor: rgb(242, 242, 243)` — and `input[name=fullName]` directly
below computes `rgb(242, 242, 243)`. **Identical**, because `Banner`'s `info`
tone and `controlClass` both fill with `--misa-panel`.

Against the sheet's `rgb(255,255,255)` that wash is 1.12:1, and its
`border-misa-blue/35` hairline composites to ≈`rgb(173,183,198)` = 2.03:1 on
white. Confirmed in a 360 screenshot: **the banner reads as a fourth, empty form
control rather than as an alert.**

Text contrast inside it is fine (body ink on Vellum, no failure in the scan), it
keeps `role="alert"` and it takes focus — so this is salience, not
comprehension. But it is the one screen the rebuild exists to rescue.

### DR3 · Medium · the text inputs have no boundary meeting 1.4.11's 3:1

On the white sheet the Vellum fill is 1.12:1 (`rgb(242,242,243)` vs
`rgb(255,255,255)`) and the hairline `rgba(29,31,32,0.2)` composites to
≈`rgb(210,210,210)` = **1.53:1 against white** and ≈1.36:1 against the fill it
encloses. Measured with `getComputedStyle` on `input[name=fullName]` and its
`section`.

Scope caveat from the reviewer, quoted because it is the interesting part: *"the
fill comes from `controlClass` in `components/ui/field.tsx`, which you excluded
as a ui/ internal — I raise it because the composite is created by this
surface's `ground="white"` (`page.tsx:77-82`), and because the comment at
`page.tsx:63-70` offers that pairing as the fix for the inputs being 'the colour
of what is behind them'. On white they are 1.12:1 from what is behind them.
Site-wide, so probably not this gate's blocker."*

### DR4 · Medium · the header's MEMBER PORTAL button is 29px tall at 360

Rect top 15.5, bottom 44.5 — under the 44px phone tap-target floor — and its
left edge sits **3.0px** from the wordmark's right edge (wordmark 131.6–213.6,
button 216.6–325.1). No collision, but 3px of it. Measured on the rendered
header inside a 360px iframe.

`components/site-header.tsx`, site-wide and outside this surface's registered
files. CLAUDE.md records the nav clearance as re-measured 2026-09-18 **at 1280
only**, and this is the 360 case that measurement did not cover — the same case
CLAUDE.md's own note anticipates: *"on a phone the tight spot is that button
beside the centred wordmark."*

### DR5 · Nit · the caution outline renders as a single device pixel

Computed outline on the box label:
`oklab(0.50854 0.033691 0.0968719 / 0.6) 0.571429px solid`, offset 4px —
**0.571px CSS is one device pixel at this dpr 1.75**, at 60% alpha, held 4px off
a 64px block. Paired with DR2, the two faintest marks on that screen were the
alert and the pointer to the control it names (`checkin-form.tsx:397-399`).

## What passed

**No Blockers and no Highs.** A full composited-contrast scan of every text node
across all six states at all three widths found **zero** failures and **zero**
`--misa-muted`-on-Vellum occurrences:

- review-step `<dt>` labels **8.51:1 on white** (was 4.33 on Vellum)
- lookup link **11.78:1** on the affirm wash
- field errors **8.63:1**
- band h1 **16.8:1** on navy
- the only sub-5 text anywhere on the route is the footer's `txmisa@gmail.com`
  at 4.84:1 on white, which passes and is shared chrome this surface does not own

Also verified: **EV7 holds exactly** — button width 208.0px for both "Check in"
and "Checking in…" at 768 and 1280, full-width at 360, so it cannot resize.
**No focusable element sits inside the navy band (0), and none straddles the
band/white boundary at y = 191.1** — so the hub's two-grounds ring rule was
checked here and does not bite. No horizontal scroll in any state at any width.
No `data-reveal` nodes and no animations, only the 150ms colour transitions.
The console across a full load and six submissions held 28 messages, all
`[HMR] connected` or the React DevTools notice — **no errors, no hydration
warnings**. Outcomes are never colour alone: each pairs a wash with a naming
heading and a 24px `aria-hidden` mark, and present and duplicate use different
icons.

🔓 **One refinement of the lead's own long-content finding.** A 109-character
*name* wraps to three lines in the review `<dd>` with no overflow, because it
has spaces — so the defect is specifically an **unbroken token**, and a
long-content check written with a realistic name would have passed and found
nothing.

## Coverage — what this run did not reach

States walked at 360: idle, `needs_confirmation` (new, `zz9998`, and again with
a 109-character name), `present` (`ab8049`), `duplicate` (repeat of `ab8049`,
prior `present`, affirm), `unmatched` (`zz9999`), `invalid` (empty submit). Idle
also at 768 and 1280.

Not reached by this agent:

- `refused`, `pending`, `rate_limited`, `error` — **excluded from its scope on
  purpose**, because each needs the database pushed off its happy path. The lead
  drove all four (`error` by revoking the check-in RPC's execute grant,
  `rate_limited` by filling the throttle bucket; both restored) and reports them
  in `lead.output.md`.
- `needs_confirmation, already on file` — the lead verified this variant
  separately; heading and announcement both correct.
- The pre-hydration / no-JS submit path — the lead verified it from the server
  HTML (`method="POST"`, `$ACTION_REF_1`, `$ACTION_KEY`, and `StatusRegion`
  present from first paint).
- Real `:focus-visible` pixel rendering: **Chrome would not match
  `:focus-visible` inside a background iframe**, so the ring was verified
  structurally — the global `2px solid var(--misa-blue)` at offset 2, one
  `.on-navy` element on the page, nothing focusable inside it — rather than by
  screenshot.

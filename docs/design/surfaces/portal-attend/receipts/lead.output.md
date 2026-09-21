# `/impeccable polish app/(public)/portal/attend/` — the lead's own pass

`impeccable`, Operate mode, against the craft floor. Run at
`77d2c568ed093f78a6b437e053bbef0533eff9e4` on the local dev server
(`http://localhost:3000`, `.env.development.local`, local Supabase stack).

## Why this pass is not a repeat of 2026-09-19

The seven review steps in this folder ran against `a38a2b3` — **a build whose
hero was a navy band**. On 2026-09-20 the officer removed the navy header from
every portal page (`ca5cd06`) and the replacement shipped without any review
step seeing it. `receipts/officer.md` says so in its own words:

> "The `design-reviewer`, the critique and the audit have **not** seen the
> sheet."

So the `.sheet` composition, the masthead and its bleeding rule, the sheet's
padding at each width, the absent back link and the content column it leaves
had never been reviewed by anybody. Three further commits landed after that:
`f2e41d6` (a new `--misa-control-edge` on every form control — **raised at this
surface's own gate** as DR3/T4), `b01dc6a` (the header's MEMBER PORTAL button to
48px on phones — raised here as DR4) and `539a5f0` (`heading.tsx`, comments
only). None of them had been seen here either.

Everything below is measured on the running page.

---

## THE BAR, re-measured — and it is two numbers, not one

**A true 360×640 — a phone, overlay scrollbars, 360 CSS px of layout — gives
591.5px, with 48.5px of slack.** `clientWidth` 360, `scrollWidth` 360, idle,
settled, under the sticky header:

| | top | bottom | height |
|---|---|---|---|
| header shell | 0 | **61.0** | 61.0 |
| `.sheet` | 85.0 | 612.5 | 527.5 |
| `<h1>` masthead | 106.0 | 132.5 | 26.5 |
| `<hr>` (bleeding rule) | 148.5 | 149.5 | 1.0 |
| Full name input | 197.5 | 247.5 | 50.0 |
| UT EID input | 287.5 | 337.5 | 50.0 |
| Email input | 377.5 | 427.5 | 50.0 |
| first-time box row | 443.5 | 527.5 | 84.0 |
| **Check in** | 543.5 | **591.5** | 48.0 |

Off the CSS chain, browserless:
`61 + 24 (Section pt-6) + 1 (.sheet border) + 20 (py-5) + 26.52 (Title h1,
26 × 1.02) + 16 (mt-4) + 1 (hr) + 24 (mt-6) + 3 × (20 label + 4 gap-1 + 50
input) + 4 × 16 (the form's four gap-4 gaps) + 84 (box row) + 48 (button
min-h-12) = **591.52**.`
🪤 **Four gaps, not three.** The first draft of this chain, written into
`page.tsx`, said `3 × 16` under a total of 591.52 — an expression that reaches
575.52. The critique's assessment B caught it within the hour. The same file's
own comment at the form already said *"the idle form has four gaps"*: the wrong
term was written two hundred lines from the right one, by the pass that was
correcting somebody else's arithmetic.

---

## 🔴 RETRACTION — what this section said first, and why it was wrong

**This pass originally concluded that the receipts' 607.7 "reproduces at no
viewport."** It offered three derivations (mobile-emulated, a "desktop" context,
and the `js` class stripped), a nineteen-width sweep from 320 to 1280 that never
produced 607.7, and a decomposition of the 16.16px gap into `Title`'s
`sm:text-[34px]` (+8.16) plus one 8px `sm:` vertical step — written up as *"the
signature to look for in a suspect measurement."*

**The arithmetic worked and the diagnosis was numerology.** The
`design-reviewer` (DR2) reproduced **607.66 in real Chrome** at a genuine
360×640 window and named the cause. Re-derived here and confirmed:

| layout width | sheet | content col | text col | label lines | box row | Check in bottom |
|---|---|---|---|---|---|---|
| 320 | 280 | 246 | 218 | 2 | 104.0 | 611.5 |
| 340 | 300 | 266 | 238 | 2 | 104.0 | 611.5 |
| 345 | 305 | 271 | 243 | 2 | 104.0 | 611.5 |
| **346** | 306 | **272** | **244** | 2 | 104.0 | **611.5** |
| 347 | 307 | 273 | 245 | 2 | 104.0 | 611.5 |
| **348** | 308 | **274** | **246** | **1** | **84.0** | **591.5** |
| 360 | 320 | 286 | 258 | 1 | 84.0 | 591.5 |
| 640–1280 | 576 | 510 | 482 | 1 | 64.0 | 595.7 |

**At ≤347px of layout the checkbox's own LABEL wraps to a second line**, taking
that row 84 → 104 and the button 591.5 → 611.5. A 360px-wide desktop window on
Windows leaves 345–346px of layout once a classic 14–15px scrollbar is taken
out — so 607.7 is the classic-scrollbar reading, and real Chrome's sub-pixel
metrics (header 60.57, inputs 49.14) put it a few tenths under the headless
611.5. **272 and 244, which this pass had called an arithmetic error in
`portal-sheet.tsx`, are exactly the 346 row of that table.**

**Why three derivations proved nothing: headless Chromium uses overlay
scrollbars in every context**, mobile-emulated or not — which this pass had
already seen and misread, noting that `clientWidth` stayed 360 in a "desktop"
context. All three held fixed the one variable that mattered. **Three
derivations that hold one variable fixed are one derivation.**

### What the bar therefore is

- **591.5, 48.5px of slack** — the phone, and the reading the bar's own words ask
  for ("at a true 360×640").
- **611.5 headless / 607.66 real** — a 360px desktop window, the conservative
  reading, and the one the receipts recorded.
- **Met under both**, and now written down with the convention attached, so that
  nobody later "discovers" a 20px regression that is a scrollbar.

The original gate had already measured both and said so — *"the lead at 611 with
a classic scrollbar and the `design-reviewer` at 610.5 with it suppressed"* —
without ever saying which one the bar is held to. That is the finding.

**And nothing has moved this layout since `ca5cd06`.** `git diff ca5cd06 HEAD --
components/ app/globals.css` is: the control-edge colour, comment-only edits to
`heading.tsx` and `chevron-section.tsx`, `activities.tsx` (the home page),
`app/(public)/portal/page.tsx` (the hub) and `site-header.tsx`'s
`max-sm:min-h-12`. The header shell measures **61.0px at all nineteen widths**,
so `b01dc6a` did not move this bar either.

---

## Findings

### L1 — the bar is two numbers and nothing said which

Above. The surface is **frozen** carrying bar figures with no viewport
convention attached to any of them — 610.5 and 611 in `DESIGN.md` and
`build-log`, 607.7 in `officer.md`, `officer.output.md`, `portal-sheet.tsx`,
CLAUDE.md, the plan and `tasks.md`. Both readings are real and both clear the
fold; what was missing is the sentence that says which is which, and a 20px
cliff at 348px of layout width sits between them.

### L2 — `page.tsx` says removing the band "gives back most of another 131px"

It gave back **19px** at a true 360 (610.5 → 591.5) and **about zero** at a 346
layout (611 → 611.5). `PortalBand` was 131px of chrome, and the sheet's masthead,
bleeding rule and margins spent essentially all of it. The sentence's
conclusion — "so the bar stops being tight" — is true at the phone reading and
not at the desktop one, and the number offered as its evidence is wrong under
both. What the header removal bought was composition, not height, which is what
the officer asked for.

### L3 — the box-row measurement is wrong at every width it names

The comment read: *"Measured on the running page: **64px at 360** (two lines),
but **44px at 768 and 1280**, where the label fits on one line."*

Measured, by **layout** width:

| layout | label | reassurance | row |
|---|---|---|---|
| ≤ 347px | 2 lines | 3 lines | **104.0px** |
| 348 → 639 | 1 line | 3 lines | **84.0px** |
| ≥ 640px | 1 line | 2 lines | **64.0px** |

So 84 on a phone at 360, 64 at 768 and 1280, and 104 in a 360px desktop window.
Every number in the sentence is wrong and the direction is inverted — 360 is
the tall case now, not the short one.

The cause is `ca5cd06`. The comment was written when the form sat on a white
section at a 305px content column; the sheet narrowed that to **286** (272 at a
346 layout) and the reassurance's own text column — inside the checkbox's flex
row, after a 16px box and a 12px gap — to **258** (244).

🔓 **What the comment was defending still holds.** `min-h-12` was added because
the row measured 44px at ≥`sm`, four pixels under EV4's floor. It is now 64.0 at
worst, so the floor is cleared everywhere by 16px. The fix is the number, not
the class. *(The `design-reviewer` filed the inertness separately as DR4.)*

### L4 — Secondary Graphite is stated at 7.60:1 on white, twice, and on white it is 8.51:1

Both call sites — the box reassurance and the review step's `<dt>`s — name a
**white** ground and quote **7.60:1**.

7.60:1 is Secondary Graphite on the **grey page ground**. That is where
DESIGN.md records it — §Accessibility, in the paragraph that moved three public
occurrences off `--misa-muted`: *"now use `--misa-secondary` (`#4a4d50`,
**7.60:1**)"*, about text on grey. On Paper the same ink is **8.51:1**.

Measured on the running page across every reachable state, with a formula
self-checked on the WCAG reference pairs (`#767676` on white = **4.54**, black
on white = **21.00**): `rgb(74,77,80)` on `rgb(255,255,255)` = **8.51**, at both
sites. DESIGN.md's own row for this surface already said *"lowest ratio anywhere
in its `<main>` … is **8.51:1**"*, so the file disagreed with DESIGN.md about
its own numbers.

📌 It is the same mistake Annotation Grey made, with the ink that was brought
in to fix it: **a ratio without a ground is not a measurement.**

### L5 — `portal-sheet.tsx` gives 272 and 244 with no viewport named

Both figures are **correct at a 346px layout** — the 346 row of the table above,
to the pixel — and neither is correct on a phone, where the content column is
**286** and the reassurance's text column **258**. The chain is
`viewport − 2 × 20 gutter` → sheet, then `− 2 border − 2 × 16 px-4`.

⚠️ **This pass first called them an arithmetic error** — "272 is `320 − 2 × 24`,
a `px-6` that is not in the class list, with the border unaccounted" — and that
was wrong, for the same reason L1's diagnosis was wrong. The correction is the
convention, not the number. The paragraph's conclusion was never in doubt: at
either column the reassurance still takes three lines, and two would need about
272px of *text*, which no realistic padding reaches.

It matters more than a comment usually does because **part 4 builds
`/portal/lookup` out of this component next**, and would have built against one
of the two columns without knowing there were two.

### L6 — the lookup link's "exactly 48px" is width-dependent — *not a defect*

`checkin-form.tsx:790` says `py-3` "takes it to exactly 48px". Measured
**217.3 × 48.0 at 1280** — exactly as claimed — and **200.0 × 72.0 at 360**,
where "See your points and attendance" wraps to two lines. EV4's floor is met at
every width and the claim is a floor, not a ceiling, so there is nothing to fix.
Recorded because the comment states an exact number and the next reader will
measure 72.

### L7 — the outcome mark is Body Graphite beside a Graphite heading — *not a defect*

`ResultPanel`'s Lucide mark computes `rgb(58,61,64)`; the `<h2>` beside it
computes `rgb(29,31,32)` since L1 was fixed at the original gate. They sit on one
optical line, so it looks like the same miss.

The lead's reasoning, left as written: *"L1's argument was that a **heading** was
wearing the paragraph's ink, and DESIGN.md wrote the clarification down as scoped
to headings. A decorative, `aria-hidden` mark is neither a heading nor the
message; it belongs with the body ink, and darkening it would make the one drawn
element on the screen louder than the sentence it introduces."*

🔴 **THE REJECTION WAS WRONG AND THE CRITIQUE OVERTURNED IT** — see
`critique.md` A2, fixed in `b2900e1`. The lead argued from the mark's ROLE and
never measured the rest of the tone encoding. Assessment A did: on this white
sheet the **affirm wash is 1.11:1** against the sheet it lies on, caution 1.10,
critical 1.12, with the hairlines at 2.14–2.38. So the wash and the rule were
carrying almost nothing, the heading was carrying the outcome in words, and the
mark — the third of EV9's three cues, added *because* colour must never be the
only channel — was drawn in the sentence's ink on all four outcomes. The tone
inks measure 7.20 / 5.40 / 7.73:1 on their own washes, so the fix was already in
the palette.

📌 Left as `rejected` rather than rewritten: a receipt edited to agree with
the outcome stops being evidence that the six steps disagreed, and this is the
second round running in which the lead's own reading of its own work was not the
last word on it.

---

## What the pass verified and found correct, with numbers

- **No horizontal overflow at any width tested**, including 320 and 360 with a
  **111-character** unbroken email, a 32-character EID and a **65-character**
  name (the exact fixture lengths — an earlier draft of this receipt said 117
  and 64, which the second critique assessment counted):
  `scrollWidth − clientWidth = 0` on every state. G1/T2's `min-w-0 break-words`
  pair holds.
- **Layout is preserved across the busy state** (EV7's first third): the button
  is 286.0 × 48.0 at 360 and 208.0 × 48.0 at 1280, **identical** idle and
  pending; `aria-busy` flips to `true`; the label swaps to "Checking in…".
- **Every focus indicator paints** — pixel-diffed, not read off
  `getComputedStyle`. See `audit.output.md`.
- **The pre-hydration path works.** With JavaScript disabled the form posts
  (`method="POST"` plus React's `$ACTION_REF_1` / `$ACTION_KEY` hidden fields)
  and returns the `present` screen as a full document. `<html>` carries no `js`
  class, which is what keeps the reveal's hidden state off a no-JS page.
- **The honeypot adds no phantom gap.** It is `position: absolute`, so it is not
  a flex item: the gaps above and below it measure 16.0 and 16.0.
- **Zero console errors** on every state driven.
- **The three inputs' new boundary is real**: `border: 1px solid
  rgb(133,134,135)` — `#858687`, **3.65:1** against the white sheet and
  **3.26:1** against its own `#f2f2f3` fill. DR3/T4, deferred at this surface's
  own gate to part 6, is **done** (`f2e41d6`).
- **The header button is 48px on phones**: DR4, also deferred here, is **done**
  (`b01dc6a`), and the header shell is unchanged at 61.0px at all nineteen
  widths measured.

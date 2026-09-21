# `design-reviewer` agent — `/portal/attend`, 2026-09-20

Branch `design-toolkit`, HEAD `77d2c568`. Browsers: **Playwright Chromium** for
scripted measurement and pixel diffs, **real Chrome (MCP)** for the cross-check
of the gate bar and the painted-pixel sample. Local dev server and local
Supabase only. The reviewer deleted the attendance rows its walk created and
left the fixture event open; no repo writes.

## ⚠️ The surface moved under the review

Git was clean at 21:49. At 22:00–22:01, while the state walk was running,
`app/(public)/portal/attend/page.tsx`, `_components/checkin-form.tsx` and
`components/ui/portal-sheet.tsx` were modified in the working tree (HEAD
unchanged) by the lead, writing this gate's fix. The reviewer diffed it rather
than guessing:

- **Exactly five code-like lines changed**, one functional change:
  `announcement(state)` → `announcement(state, pending)`, the busy early return,
  and the call site.
- **Everything else was comments**, largely rewritten — and rewritten to numbers
  *identical to ones the reviewer had independently measured minutes earlier*:
  286px content column, 258px text column, button bottom 591.5, 48.5px slack,
  checkbox row 104 / 84 / 64 / 64, 8.51:1 for Secondary Graphite on white.

Every layout, contrast, focus and state measurement below is therefore valid for
both trees, **except** the sr-only status text during `submitting`, which the
reviewer re-measured after the edit.

---

## THE BAR — measured from scratch, two ways, and both are real

Header shell **61.0px** (Playwright) / **60.57px** (real Chrome). Nothing on the
page carries `data-reveal` (`main [data-reveal]` count = 0), so it settles on
first paint; nothing was forced.

| | layout width | content col | text col | box row | **Check in bottom** | slack |
|---|---|---|---|---|---|---|
| a phone — overlay scrollbars | **360** | 286 | 258 (3 lines) | 84px | **591.5** | 48.5 |
| a 360px desktop window — classic 15px scrollbar | **345** | 272 | 244 (3 lines) | **104px** (the label wraps) | **607.66** | 32.3 |

**Bar met either way.** The receipts' 607.7 is the conservative of the two, and
it is what you get the most likely way anyone would have taken it.

🔴 **This overturns the diagnosis the lead had written an hour earlier.** That
paragraph said 607.7 "reproduces at no viewport" and attributed the 16.16px gap
to `Title`'s `sm:text-[34px]` plus an 8px `sm:` step — "a reading taken where
the media query did not apply". **At 345 the `h1` computes 26px: no `sm:` is
applied.** The delta is the checkbox label's wrap (+20px) net of real Chrome's
sub-pixel row heights (inputs 49.14 rather than 50, header 60.57 rather than
61). The decomposition added up and described nothing.

---

## FOCUS INDICATORS — pixel evidence, Tab-driven

Screenshot focused, screenshot unfocused, diff per pixel (threshold 8/channel).
Every ring **paints**, and every changed-pixel count matches the ring geometry
arithmetically:

| element | width | changed px | bbox | accounting |
|---|---|---|---|---|
| text inputs | 1280 | **3404** | 518 × 58 | 2288 ring band + 1116 for the 1px control edge flipping to navy (`focus:border-misa-blue`, perimeter 2 × (510 + 50) = 1120). Both effects paint. |
| text inputs | 360 | **2060** | 294 × 58 | 1392 ring + 672 border |
| checkbox | 360 and 1280 | **176** | 24 × 24 | exactly 24² − 20². Exact ring, no extras. |
| Check in | 1280 | **1072** | 216 × 56 | exactly 216·56 − 212·52 |
| Check in | 360 | **1324** | 294 × 56 | ring 1384 less corner anti-aliasing |
| Confirm and check in / Edit details | 360 | **1384** each | 294 × 56 | |
| See your points and attendance | 360, present | **1136** | 208 × 80 | exactly 208·80 − 204·76 |

🪤 **The instrument that would have missed it, recorded.** Programmatic
`.focus()` on the checkbox and the buttons returns
`matches(':focus-visible') === false` and paints **0 changed pixels**. That is
why the Tab-driven numbers above are the evidence and `getComputedStyle` was
never used as proof.

---

## CONTRAST — formula validated on the WCAG reference pairs every run

`#767676` on white = **4.54**; black on white = **21.00**. Backgrounds
composited up the ancestor chain from white; alpha foregrounds composited too.

**Lowest ratio anywhere in `<main>`, across every state and width reached:
8.51:1** — Secondary Graphite `#4a4d50` on the white sheet, being the 14px
reassurance line and the review step's three 16px `<dt>` labels. AA needs 4.5.
**Zero failures at any width in any state reached.**

Others: banner body on the caution wash **9.98:1**; body on the affirm wash
**9.88:1**; the lookup link's navy on the affirm wash **11.78:1**; field errors
critical on white **8.63:1**; button ink on navy **13.03:1**; `h1` **16.55:1**;
the unmatched state's caution outline **5.91:1** on white.

**The two muted-on-Vellum occurrences the brief owns are gone** — no
`--misa-muted` (`rgb(111,114,117)`) paints anywhere in `<main>` in any state.

Painted pixels sampled from the PNG to confirm the computed values: labels
**[29,31,32]**, banner body **[58,61,~66]**, page ground **[242,242,243]**,
sheet **[255,255,255]**.

---

## `--misa-control-edge` — the reason that fix exists, checked here

| | measured | vs the white sheet | vs the `#f2f2f3` fill |
|---|---|---|---|
| rest | `rgb(133,134,135)` = `#858687`, 1px | **3.65:1** | **3.26:1** |
| hover | `oklab(0.314884 -0.0144003 -0.08381 / 0.55)` | **3.36:1** | **3.24:1** |
| `aria-invalid` | `rgb(143,35,35)` | 8.63:1 | 7.72:1 |
| focus | solid navy | 13.03:1 | |

**All four of the first two rows match `field.tsx`'s claim exactly.**

---

## LAYOUT

No horizontal scroll at any width in any state (`scrollWidth − innerWidth = 0`
everywhere). **The 254-character-email regression is fixed**: with a
143-character unbroken email, a 32-character EID and a 120-character name,
`hScroll = 0` at 360 and the review panel wraps.

The sheet: `px-4 py-5` at 360 (content 286), `sm:px-8 sm:py-7` at ≥640 (content
510, sheet 576 = `max-w-xl`), `border-radius: 4px`, `shadow-lift`. **The masthead
rule bleeds to the sheet's inner edges at every width** — at 360 the rule spans
21→339 inside a 20→340 sheet; at 1280, 353→927 inside 352→928.

Tap targets: the whole checkbox *row* is the label and measures 84–104px at 360
and 64px at ≥768; Check in 48px; both review buttons 48px; the lookup link 48px
at ≥768 and 72px at 360. **The bare 16 × 16 checkbox is the only sub-44 box and
it is not the target.**

---

## STATES

Reached and walked at 360, 768 and 1280: **idle, invalid, unmatched,
needs_confirmation (new), needs_confirmation (already on file), present,
duplicate, submitting, long-values**, plus **pre-hydration**.

Focus placement after each replacement screen: invalid → the first
`aria-invalid` field ✅; unmatched → `p[role=alert][tabindex=-1]` ✅; both
confirmations → `h2[tabindex=-1]`, and Tab from there goes straight to *Confirm
and check in* ✅; the four terminal screens → `<body>`, which is the brief's
settled choice — they announce through `StatusRegion` instead, verified
non-empty and correct in both `present` and `duplicate`.

Tab order is sane at both widths: 360 → skip link, hamburger, wordmark, MEMBER
PORTAL, then the form; 1280 → skip link, four nav items, wordmark, MEMBER PORTAL,
three inputs, checkbox, Check in, footer. (One extra stop, `nextjs-portal`, is
the dev overlay and is not in production.)

**Console: zero errors and zero warnings**, every state, every width, including
the no-JS load and the throttled pending window. No hydration warnings.

### States NOT reached, and not guessed at

`pending`, `refused`, `rate_limited`, `error`. The first two need the shared
local fixture event closed or removed, which would have broken the fixture the
caller set up; `rate_limited` needs 200 submissions in ten minutes
(`RATE_LIMIT_MAX = 200`), which would have written 200 rows. **So the reviewer
measured no contrast, layout or focus number for the `critical` banner wash or
the `caution` terminal panel.** Nearest evidence it did have: the `caution` wash
at 9.98:1 on the `unmatched` banner (same component, same size, same ink as
`rate_limited`), and the `affirm` wash at 9.88:1 on `present` / `duplicate`.

---

## ACCESSIBILITY WIRING, verified on the running page

One `<main>`, one `<h1>`, correct heading order. The checkbox's accessible
**name** is *"I haven't checked in with this form before"* alone and its
**description** is the reassurance, while the `<label>` still wraps both so the
row stays one tap target — the accname split works. The honeypot is
`aria-hidden="true"`, `tabindex="-1"`, `left: -9999px`. `StatusRegion` is
`role="status" aria-atomic="true"`, `sr-only`, present and empty from first
paint. **No `robots` meta, so the page stays indexable as the brief requires.**
The caution outline on the box row in `unmatched` renders `2px solid
rgb(138,90,18)` at `offset 4px`, **5.91:1** on white. The pre-hydration submit
works end to end: JS disabled → POST → the success screen.

## MOTION

Nothing animates except `transition-colors duration-150` on the control edge —
a colour swap, which is what DESIGN.md allows. No `data-reveal` in `<main>`.

---

## THE FINDINGS, in the reviewer's own framing

**DR1 — Medium — focus is lost for the whole pending window.** Measured at
360×640 with the POST throttled to 3.5s: `"Checking in…"`, `aria-busy="true"`,
`disabled` true, box **286 × 48, bottom 591.5 — byte-identical to idle**, and
`document.activeElement` = **BODY**. Mitigation the 22:01 edit supplied: the
status region now says "Checking in…", so something is spoken — and because
focus is on body, the button's own label change is *not* also announced, so
there is exactly one announcement (measured). A full fix means
`aria-disabled={pending}` plus an early return in the submit path instead of
`disabled`, so the control keeps focus.

**DR2 — Medium — the bar's recorded figure reproduces, and the new diagnostic
comment was wrong twice.** Above.

**DR3 — Nit — the outcome sentence is read twice on the no-JS path.** Measured
with `javaScriptEnabled: false` at 360: after submit, `main`'s innerText begins
*"Event Check-In You're checked in. Your attendance at … is recorded. You're
checked in! Your attendance at … is recorded."* Both the sr-only `StatusRegion`
and the visible `ResultPanel` carry it in the initial DOM. With JavaScript the
region is a live update and the panel is silent, which is correct; only the
full-page-POST path duplicates.

**DR4 — Nit —** `min-h-12` never binds: 104px at a 345 layout, 84px at 360, 64px
at 768 and 1280, against a 48px floor. Inert but harmless.

**DR5 — Nit —** the brief's "roughly 90px" for the unmatched push is **+82px** at
768 and 1280 (595.7 → 677.7) and **+122px** at 360 (591.5 → 713.5). Non-gating by
officer decision; the recorded figure understates the phone case by 32px.

**DR6 — Nit —** the three marks the sheet composition rests on are the faintest
on the page: sheet fill vs page ground **1.12:1**, sheet border `rgb(191,191,194)`
vs ground **1.64:1**, masthead rule `rgb(219,219,219)` vs sheet **1.38:1**. No
WCAG rule applies — all decorative. Recorded because nothing had reviewed this
composition before.

**DR7 — Nit —** `py-3` "takes it to exactly 48px" holds at 768/1280 (217.3 × 48)
but the link is 200 × 72 at 360, where it wraps. Exceeds the floor everywhere;
the comment is width-silent.

**DR8 — Nit —** box clearance between the centred wordmark and the MEMBER PORTAL
button is **10.4px at a true 360 layout and 3.0px at a 345 layout**. No collision
at either. `components/site-header.tsx`, not this surface's file.

## Withdrawn

A finding that *"Secondary Graphite … (7.60:1)"* was quoted against white in two
comments where the measured value on white is 8.51:1 (7.60:1 is that ink on
Vellum). The 22:01 edit had already corrected both sites. Withdrawn rather than
filed.

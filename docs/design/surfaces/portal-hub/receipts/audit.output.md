# `/impeccable audit app/(public)/portal/page.tsx` — raw output

Web platform. Code-level technical audit across five dimensions; findings are
documented, not fixed here (they are dispositioned in `audit.md`). Scored
against the rubric in `reference/audit.md`.

## 1. Accessibility — **2**

**Contrast.** Every ink measured on the ground it actually renders on:

| Text | Colour | Ground | Ratio |
|---|---|---|---|
| Band h1 | `#ffffff` | `#0d1d38` | 16.80 |
| Row titles | `#16305c` | `#ffffff` | 13.03 |
| Row bodies | `#4a4d50` | `#ffffff` | 8.51 |
| Officer line | `#4a4d50` | `#f2f2f3` | 7.60 |
| Officer link | `#16305c` | `#f2f2f3` | 11.65 |

No text falls below 4.5:1. `--misa-muted` (4.33:1 on Vellum) does not appear in
this file.

**Focus indicator — FAIL.** `app/globals.css:318` sets `:focus-visible` to
`outline: 2px solid var(--misa-blue)` (`#16305c`). The row link carries
`focus-visible:-outline-offset-2`, so the ring is drawn 2px inside the link's
border box. That box spans the white cell **and** the 48px navy key
(`bg-misa-blue`, also `#16305c`). Contrast of the indicator against what it is
drawn on:

- over the white cell — 13.03:1 ✅
- over the navy key — **1.00:1** ❌ (identical colour)

The rendered result is an indicator that appears to stop at the seam. The
`.on-navy` flip at `globals.css:323-326` cannot reach it: those selectors match
a focused element *inside* a navy section (`.on-navy :focus-visible`) or a
focused navy section itself (`.on-navy:focus-visible`), and here what is
focused is the whole row, not the key.

**Semantic HTML — FAIL.** Rendered markup:

    <a class="group flex items-stretch …">
      <span class="flex-1 px-6 py-5">
        <h2 …>Event Check-In</h2>
        <span class="mt-1 block …">Check in to a MISA event.</span>
      </span>

`<span>` is phrasing content and may not contain `<h2>`. React's
`validateDOMNesting` does not warn on this shape — console is clean at all
three widths — so nothing in the toolchain reports it.

**Passing.** Heading hierarchy h1 → h2 ×3, no level skipped. Decorative chevron
and the hero grid both `aria-hidden="true"`. The row link's accessible name is
its title alone via `aria-labelledby`, with the body as `aria-describedby`, so
rows do not announce as run-on sentences. Tab order matches reading order.
No forms, no images, no live regions, no keyboard traps. `prefers-reduced-
motion`: the only transitions are colour, which reduced motion should keep.

## 2. Performance — **4**

Static Server Component. No `"use client"`, so no client bundle for this route
beyond the shared chrome. No images. No layout reads (`getBoundingClientRect`,
`offsetHeight`) anywhere. No `will-change`. No keyframes, no blur, no filter,
no shadow. `transition-colors` is compositor-cheap and scoped to two
properties — not `transition: all`. One icon, a tree-shaken `lucide-react`
import. `<Link>` at Next 16's default `prefetch="auto"`, which serves the
brief's speed bar (EV7). Three list items, so no virtualization question.

Nothing to fix.

## 3. Theming — **4**

Every colour is a token: `text-misa-blue`, `text-misa-blue-dark`,
`bg-misa-blue`, `text-misa-secondary`, `border-misa-hairline`,
`bg-misa-hairline`, `bg-white`. No raw framework scale (`blue-700` etc.), no
hex literal, no `rgb()`. The Rare Navy Rule holds — navy and its dark end are
the only accent on the page.

Dark mode is out of scope by decision, not omission: `DESIGN.md` §Design
toolkit lists dark mode among the skill conflicts "settled here and not
relitigated — Refused".

Nothing to fix.

## 4. Responsive — **3**

**Fixed widths.** One: the navy key's `w-12` (48px). Intentional and
`shrink-0`, which is correct — it is the brief's 48px target and it must not
compress.

**`min-w-0` missing — FAIL.** The text wrapper is `flex-1` with no `min-w-0`.
A flex item's `min-width` computes to `auto`, i.e. its min-content size, so a
sufficiently long single-word title cannot shrink and would push the row past
its container rather than wrapping. The brief's §States asks for "each title
wrapping cleanly inside its row beside the key" at 360. Not currently
reproducible with the officer's three titles — it is a latent defect against
copy this page does not yet have, and a one-class fix.

**Touch targets.** Rows measure 96.1 / 121.7 / 147.3px tall at 360 and 104.3px
at ≥768, all far over EV1's 48px floor. **The officers sign-in link does not:
39 × 17px**, under even WCAG 2.2's 24px minimum. It is a secondary-audience
control, which is why it is not a blocker, but 17px is a miss on a page that
otherwise gets this right three times.

**Horizontal overflow.** None at 360, 768 or 1280 — `scrollWidth` equals
`innerWidth` at every width.

**Text scaling.** No fixed heights on any text container; rows are content-
sized, so a larger text setting grows them rather than clipping.

## 5. Implementation integrity — **3**

Detector: `[]` on both `page.tsx` and `portal-band.tsx`, advisory included,
exit 0 — verified against a planted-fixture control, so the clean result is
real. See `detector.md`.

**Two type-ramp breaks the detector structurally cannot see:**

1. `text-sm` (14px) on the officer line. `DESIGN.md` §The ramp has 12 (Eyebrow)
   and 16 (Body) and nothing between. The detector reads arbitrary
   `text-[Npx]` values against the ramp; `text-sm` is a named Tailwind utility,
   so it is neither caught nor catchable by that rule.
2. The three destination titles render at the *same* ramp step as the page h1
   (26px at 360, 34px at ≥768) — both are `Title` at its default. Both values
   are on the ramp, so no single class is wrong; what is wrong is the
   relationship between two of them, which no per-class scan can express.

**No drift otherwise.** The layout-family budget is declared in-file and spent
at two of three. Shared primitives are reused rather than re-implemented
(`Section`, `Title`, `PortalBand`), and the plate follows DESIGN.md's
shared-rule device rather than introducing a component. Radius 0 throughout,
correct for structure. The equal-formatting constraint is held by a single
`.map` over one shape, so breaking it requires breaking the loop — structure
doing the work of a rule.

**Not interchangeable with an unrelated product:** the chevron notch and the
chevron key are the same glyph in two roles, and both are this system's own.

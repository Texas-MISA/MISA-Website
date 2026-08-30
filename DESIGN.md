---
name: Texas MISA
description: A navy-and-white institutional drawing set, now with depth — a drawn navy field, a flat grey page, and white surfaces lifted off it. Square structure, softened plates, hairline rules.
version: 2.0
status: Written from what phase 1 of the v2 redesign actually shipped (2026-08-19). Sections marked NOT YET REBUILT describe surfaces still running the v1 system.
colors:
  drafting-navy: "#16305c"
  pressed-navy: "#0d1d38"
  graphite: "#1d1f20"
  body-graphite: "#3a3d40"
  secondary-graphite: "#4a4d50"
  annotation-grey: "#6f7275"
  vellum: "#f2f2f3"
  vellum-shade: "#e7e7ea"
  paper: "#ffffff"
  hairline: "rgba(29, 31, 32, 0.16)"
  frame: "rgba(29, 31, 32, 0.2)"
  plate-edge: "#bfbfc2"
  poche-light: "#2c4b7c"
  poche-dark: "#26436f"
  caution: "#8a5a12"
  caution-wash: "#faf4e8"
  critical: "#8f2323"
  critical-wash: "#fbf0ef"
  affirm: "#1f5c34"
  affirm-wash: "#eff5f0"
elevation:
  lift: "0 1px 2px rgb(22 48 92 / 0.06), 0 4px 12px rgb(22 48 92 / 0.08)"
  raised: "0 2px 4px rgb(22 48 92 / 0.07), 0 10px 26px rgb(22 48 92 / 0.13)"
  overlay: "0 8px 20px rgb(22 48 92 / 0.12), 0 24px 56px rgb(22 48 92 / 0.18)"
  sticky: "0 1px 0 rgb(22 48 92 / 0.08), 0 6px 16px rgb(22 48 92 / 0.07)"
radius:
  structure: "0"
  plate: "4px"
durations:
  press: "140ms"
  hover: "150ms"
  pop: "200ms"
  overlay: "260ms"
easing:
  reveal: "cubic-bezier(0.2, 0.7, 0.3, 1)"
  out-quint: "cubic-bezier(0.23, 1, 0.32, 1)"
  in-out-quint: "cubic-bezier(0.77, 0, 0.175, 1)"
---

# Design System: Texas MISA — v2

**This file is the design source of truth for the whole site.** It records the
system that phase 1 of the v2 redesign actually built, not the system that was
planned. Every value here was read off the running application on 2026-08-19.

- [`docs/frontend-redesign-v2-plan.md`](docs/frontend-redesign-v2-plan.md) is the
  **plan** — what is built, what is next, and the argument for each decision.
- [`docs/design-v1-superseded.md`](docs/design-v1-superseded.md) is the **v1
  system**, kept verbatim for its reasoning. ⚠️ It is historical. Where the two
  disagree, this file wins.
- The design handoff (`docs/Texas MISA website UI mockups/`) set the identity and
  remains the only home of the duotone image-treatment spec. It is desktop-only,
  draws five of the site's twenty-odd screens, and defines no focus, hover, empty
  or error states. Never port its inline styles.

## What is on this system, and what is not

| Surface | State |
|---|---|
| Home page, site header, site footer | ✅ **v2.** Everything below describes it. |
| `/about`, `/projects`, `/gallery`, `/officers`, `/contact` | ✅ **v2** (phase 2, 2026-08-19). Rebuilt from the home page's vocabulary, not evolved from their own v1 layouts. |
| `/attend`, `/leaderboard`, `/lookup` | ⏳ **NOT YET REBUILT** (phase 3, deferred). Never had a design; they wear the shared primitives. ⚠️ They still carry the `--misa-muted`-on-Vellum AA failure. |
| `/admin` | ✅ **v2** (phase 4, 2026-08-29), governed by scanability rather than expression. Ground, surfaces and the shared vocabulary; **not** a re-composition. |

🪤 **The grounds already changed site-wide, ahead of the rebuilds.** Every public
page sits on the v2 page ground today, so a page can be un-rebuilt and still not
look like v1. Do not read "it has the grey background" as "it has been done."

---

## The three ideas

Everything below follows from these. If a decision does not serve one of them,
it is decoration and needs an argument.

1. **The page is a ground, and things sit on it.** v1 was flat by inheritance —
   white behind everything, 1px borders, no shadows. v2 has a **drawn navy
   field**, a **flat grey page**, and **white surfaces lifted off** it. Depth
   comes from real stacked planes, never from a drawn texture pretending to be
   space.
2. **Structure is square; objects are softened.** Sections, tables, inputs,
   buttons and any cell whose corner is defined by a 1px seam stay at radius 0.
   Only a thing that reads as an *object lying on the page* — an image plate, a
   raised sheet — takes the 4px plate radius.
3. **One varying property reads as a set; four read as scatter.** The hero's
   three plates share one aspect ratio, one frame and one radius, and vary only
   in position and a mirrored angle. This is the rule that survived three
   rejected arrangements.

---

## Colors

Unchanged from v1 in value. Two additions and one clarification.

### Primary

| Token | Value | Use |
|---|---|---|
| Drafting Navy | `#16305c` | Brand bands, primary buttons, headings on light, eyebrows |
| Pressed Navy | `#0d1d38` | The hover/pressed end of the navy ramp; base of the drawn field |

### Neutral

| Token | Value | Use |
|---|---|---|
| Paper | `#ffffff` | **Cards, sheets, control-bearing sections.** No longer the page. |
| Vellum | `#f2f2f3` | **The public page ground.** Also chip fills and input fills. |
| Vellum Shade | `#e7e7ea` | The light hatch's second stripe, and nothing else |
| Graphite | `#1d1f20` | Ink — body headings |
| Body Graphite | `#3a3d40` | Long-form paragraphs |
| Secondary Graphite | `#4a4d50` | Card body copy |
| Annotation Grey | `#6f7275` | Meta labels, placeholder captions |
| Hairline | `rgba(29,31,32,0.16)` | Section rules, shared-plate grid gaps |
| Frame | `rgba(29,31,32,0.2)` | Card and image frames on a **known** ground |
| **Plate Edge** | `#bfbfc2` | 🆕 Frames on an **unknown** ground |

🪤 **Frame is alpha; Plate Edge is its opaque twin, and the difference is not
pedantry.** A floating plate crosses the navy field, another plate, and white —
`--misa-border` composited to a clear hairline on one and to nothing on another,
so one border read as two weights. Plate Edge is exactly `rgba(29,31,32,0.2)`
resolved over Vellum Shade, so the edge looks the same whatever passes beneath.
**Use Frame when you know what is behind; use Plate Edge when you do not.**

### Tertiary (the hatch)

`#2c4b7c` / `#26436f` navy, `#f2f2f3` / `#e7e7ea` light. Placeholder fill only.

### Status

`caution #8a5a12`, `critical #8f2323`, `affirm #1f5c34`, each with a wash.
Desaturated earth inks, not signal lights — a drafting set annotates in red
pencil and has no warning LED. Each is ≥4.5:1 on Paper and on its own wash.
**Feedback only. Never decoration, never a category colour.**

### Named Rules

- 🔓 **The Two Grounds Rule is RETIRED.** v1 allowed white and navy, "never a
  third, never a gradient." v2 has **five**, and they are a closed set — see
  *Grounds* below. Adding a sixth is a change to this file, not a prop.
- 📌 **The Rare Navy Rule still binds.** Navy is the colour of everything that is
  merely true. A second accent, or a tint of navy outside the Pressed↔Drafting
  ramp, is still refused.
- 📌 **No raw framework colour scales.** `red-700`, `amber-600`, `green-800` are
  banned; reach for a named status token. This is how a palette that forbade a
  third colour quietly acquired three.

---

## Grounds

**Five, and they are a closed set.** `<Section ground="…">`
(`components/ui/section.tsx`) is the only sanctioned way to apply one — it moves
the fill, the focus-ring answer and the section's own padding together.

| Ground | Renders | Focus ring | Use |
|---|---|---|---|
| `page` | *(nothing — inherits)* | default navy | **The default.** Almost every section. |
| `white` | `bg-white` | default navy | Sections carrying **controls or tabular data** |
| `panel` | `bg-misa-panel` | default navy | The same grey, declared on the section itself |
| `navy` | `bg-misa-blue` + `.on-navy` | **white** | Solid brand band |
| `field` | `.ground-field` + `.on-navy` | **white** | The drawn navy radial — heroes, feature bands |

**The page ground itself is `bg-misa-panel` on the public layout's `<main>`** — and,
since phase 4, on the **admin shell's `<main>` too.** One ground, two layouts,
both on `<main>` rather than on `body`.

🪤 **`<Section>` still has ZERO admin call sites and keeps them.** It owns the
public gutter and vertical rhythm, which `/admin` does not share. On the officer
side the surface is `Panel` (or a `bg-white` frame where a `<form>` needs its own
`action`, which `Panel` does not forward), and the shell owns the ground.

🔓 **`PageHero` moved from a flat `bg-misa-blue` to `ground="field"` in phase 2**,
so the site has ONE navy hero treatment rather than two. ⚠️ **Eight pages render
it** — the five phase-2 pages plus `/attend`, `/lookup` and `/leaderboard`, which
are phase 3. Those three inherit any change to it and were measured at the phase-2
gate rather than assumed. Its dead `size="home"` and `tagline` props were deleted.
🔓 **It is CENTRED as of 2026-08-23 (officer), reversing phase 2's
left-alignment.** Phase 2 left-aligned it because §4.3's anti-centre bias binds
at `DESIGN_VARIANCE 8` and a centred hero repeated across eight pages was the
largest v1 tell still standing. That argument is recorded rather than deleted,
because this is a reversal and not drift. 📌 The bias is a bias, not a
prohibition: the home page's hero is a **split** and stays uncentred, so the
site's front door does not open on a centred stack — what changed is the interior
pages, which now read as one family. 🪤 Centring is `text-center` **plus**
`mx-auto` on both the headline and the subhead: each carries a `max-w` measure,
and centred text inside an off-centre column reads as a bug rather than a choice.

- 🪤 **It is on `<main>`, not on `body`.** `body` is shared with `/admin`, which
  still runs v1 and must stay white until phase 4. `<Section>` has zero admin
  call sites, which is what makes this containable.
- 🪤 **`--background` stays `#ffffff` and must.** `.sheet`, the bento cards and
  the partner cells are *lifted white surfaces*, and a surface only reads as
  lifted off a ground that is not its own colour. **The grey is the background;
  cards stay white.**
- 🐛 **`ground="white"` is a correctness control, not a taste one.** **Five**
  shared primitives fill with `bg-misa-panel` — `controlClass` (every input),
  `table.tsx`'s sticky `<THead>`, `chip.tsx`'s resting `FilterChip`,
  `banner.tsx`'s neutral variant, and `Tr`'s `hover:bg-misa-panel/70`. On the
  page ground each is **the same colour as what is behind it**: inputs
  disappear, the sticky head stops separating from the rows scrolling under it,
  and row hover does nothing. The fix is a white surface under them, never a
  recoloured primitive — all five are shared between `/admin` and the public
  pages.
  - 📌 **`Table` carries its own `bg-white` since phase 4**, rather than every
    caller remembering to supply one. Three of the five live inside that
    component and both page grounds are the same grey, so the surface belongs to
    the component: it is the fix that cannot be forgotten on the next screen.
  - 🪤 **The order this lands in is load-bearing.** Wrap the screens in white
    surfaces FIRST and flip the ground LAST. A white surface on a still-white
    page is invisible and harmless, so every intermediate commit stays
    shippable; the reverse order gives a branch that looks finished and is
    measurably broken. Phase 4 moved `/admin` this way and the flip was one line.

### `.ground-field` — the drawn navy field

Pressed Navy base plus two radial lobes, built only from colours the palette
already owns. The base colour is declared **separately** from the image, because
`background-image` alone leaves the element transparent wherever the radials fall
off. ⚠️ A gradient is not one ground, so **contrast is measured at both ends of
it**.

### Retired grounds

- ✂️ **`paper` / `.ground-paper`** — a gray-to-white radial. Deleted 2026-08-19:
  once the page went flat grey it said nothing `panel` does not, and a variant
  with nothing distinct behind it gets deleted rather than aliased.
- ✂️ **`.paper-grid`** — a drawn navy hash on light grounds. Replaced by `.sheet`
  (stacked planes) in iteration 2.

---

## Elevation

**Four steps, each with a job.** A shadow that does not match one of these jobs
does not get added; a fifth step is a change to this list.

| Step | Job |
|---|---|
| `shadow-lift` | A resting element that is nonetheless above the page — a card, a floating image plate |
| `shadow-raised` | The same element under the pointer. **The only hover elevation.** Currently unused. |
| `shadow-overlay` | Menus, popovers, dialogs. Things that genuinely float. |
| `shadow-sticky` | A bar pinned over scrolling content, proving content passes underneath |

- 🪤 **Shadows are tinted to the background hue, never black.** All four are navy
  at low alpha. `rgba(0,0,0,…)` anywhere in this codebase is a bug.
- 🪤 **A shadow tinted to the ground composites to nothing on a ground of that
  hue.** This is why the hero's plates are a *light* hatch on the navy field —
  the frame could not rescue them and the shadow had no surface to fall on.
- 🪤 **To check a step is live, probe the UTILITY on a real element, never the
  variable.** Tailwind tree-shakes a theme value reached only through its
  utility, so `getComputedStyle(root).getPropertyValue('--shadow-lift')` returns
  an empty string while `shadow-lift` paints perfectly.

---

## Shapes

- **Structure is square.** `--radius: 0`. Sections, tables, inputs, buttons,
  panels, chips, and any cell whose corner is defined by a 1px seam.
- **Objects take `--radius-plate: 4px`.** Image plates and raised sheets only.
  4px is deliberately almost nothing — at 8px the page becomes a different design
  system.
- **1px is the only border weight.** A coloured border-left above 1px is refused.
- ✂️ **"The wordmark's exclamation dot is the one rounded thing" no longer
  applies** — the real logo replaced the CSS construction on 2026-08-23, and the
  dot is now the robot glyph inside a raster mask rather than a `rounded-full`
  span. The mark still has curves; they are simply not a CSS radius any more, so
  the radius rule above has no exception left.

### Named Rules

- 📌 **The Shape Consistency Lock holds, with one written exception.** A mixed
  radius system is permitted exactly when the rule is written down and followed
  everywhere. This is that rule and the whole of it: *only a thing that floats is
  rounded.*
- 🪤 **A radius needs a clip.** `.plate` carries `overflow: hidden` because
  `Hatch` paints a hard-edged repeating gradient that squares the corners back
  off without it.

---

## Surfaces

Three named surfaces. Each is a CSS class in `app/globals.css`.

### `.plate` — a floating image plate

`transform: rotate(var(--plate-tilt, 0deg))` + `border-radius` + `overflow:
hidden`. **The frame is a `border` at the call site** (`border
border-misa-plate-edge`, or `border-misa-border` where the ground is known),
plus `shadow-lift`.

- 🪤 **The tilt goes on `.plate`, never on the node carrying `data-reveal`** —
  `[data-revealed]` sets `transform: none` on every revealed node.
- 🪤 **A tilt must be breakpoint-scoped** (`lg:[--plate-tilt:4deg]`), because
  below `lg` plates are grid cells and a lean grows each cell into its neighbour.
  An inline `style` cannot carry a breakpoint.
- 🪤 **A rotated plate needs more room than it occupies**: `w·cosθ + h·sinθ` by
  `w·sinθ + h·cosθ`. Solve it against the container on all four sides.
- 🪤 **A plate that looks unframed is a CLIPPING bug, not a border bug.** See
  *Motion* below. Do not reach for an outline or an inset shadow.
- ⚠️ **Nothing focusable goes inside a plate on a navy field.** `.on-navy` flips
  the ring to white, and a white ring on a near-white plate is no ring at all.

### `.sheet` — a raised white surface

`background: #fff` + 1px Plate Edge + plate radius + `shadow-lift`. Depth from
**two real surfaces at two real heights**, which replaced a drawn grid that asked
a pattern to imply space.

🪤 **It must sit on a ground that is not white**, or it is an invisible rectangle
wearing a shadow. The page ground supplies that everywhere; the one place it does
not is `<Section ground="white">`.

### `.hatch-light` / `.hatch-navy` — the placeholder

45°, 7px stripes. **Light on light grounds, navy on navy ones, never mixed** —
with one recorded departure: the hero's plates are a *light* hatch on the navy
field, because a navy plate on a navy field had no separation and its shadow
composited to nothing.

⚠️ **On the grey page ground the light hatch is weaker than it was on white**,
because its lighter stripe *is* `#f2f2f3`. A placeholder now reads as half-visible
stripes inside a frame rather than a distinct box. Legible via the darker stripe,
the hairline and the caption. Open; possibly moot once photography ships.

---

## Typography

Barlow (`--font-sans`) and Barlow Condensed (`--font-display`). Unchanged.

### The ramp

| Role | Size | Weight / leading / tracking |
|---|---|---|
| Hero headline | `34 / 44 / 38 / 48 / 56` px at base/`sm`/`lg`/`xl`/`2xl` | 600, `0.94`, `-0.02em` |
| Page-hero headline | `34 → 44 → 52` px at base/`sm`/`lg` | 600, `0.96`, `-0.02em`, `text-balance`, **centred** |
| `Headline` | `30 → 42` px at `sm` | 600, `1`, `-0.02em` |
| `Title` | `26 → 34` px at `sm` | 600, `1.02`, `-0.015em` |
| Card title | `22 → 26` px | 600, `1.05` |
| `Lead` | `18` px | `1.65`, max `74ch` |
| Body | `16` px | `1.6` |
| `Eyebrow` | `12` px | 500, `0.14em`, uppercase |

### The officer ramp

`/admin` is denser than any public page and has three heading levels rather than
two. `components/ui/page-header.tsx` owns all of it.

| Role | Size | Where |
|---|---|---|
| `PageHeader` title | `30 → 34` px at `sm` | Every admin screen opens with one |
| `SectionHeading` | `22` px | A region of a screen |
| `SectionHeading level="sub"` | `18` px | Inside a panel or a form |

📌 **34 → 22 → 18 is a 1.55 then 1.22 ratio, and the tightness is the point.** A
dense screen carries more type roles than a brand page, and exaggerated contrast
between them reads as noise rather than hierarchy. **The 18px step is admin-only**
and is the one step the public ramp above does not contain.

🪤 **The hero ramp DIPS at `lg` (44 → 38) and that is not a typo.** Type size
there is a function of the **type column**, not the viewport, and the column is
narrowest exactly where the split first engages. Change the split ratio and this
must be re-measured.

### Named Rules

- 📌 **Headings are ground-aware via a variant, not a prop.** `Headline` carries
  `[.on-navy_&]:text-white`. A `dark` prop would be a second source of truth for
  a fact the ground already knows.
- 🪤 **`text-balance` and an explicit `<br />` fight, and balance wins.** The hero
  headline sets its own break and must not carry `text-balance` — it re-wrapped
  to a four-line headline, which §4.7 calls a font-size error, never a
  copy-length one.
- 📌 **Monospace means an identifier**, and only in `/admin`. An EID is
  transcribed by hand off a phone screen; monospace separates `l` from `1`.

---

## Layout

### Spacing scale

Roles, not sizes. `components/ui/section.tsx` owns the vertical rhythm.

| Token | Value | Role |
|---|---|---|
| `rule` | 1px | The shared-hairline grid gap |
| `gutter-sm` / `gutter` | 20 / 56px | Page gutters, phone / `sm`+ |
| `tile` | 16px | Tile and image-grid gaps |
| `card` | 20px | Card-grid gaps |
| `split` | 48px | Two-column split gaps |
| `section-sm` / `section` / `section-lg` | 56 / 64 / 80px | Section padding steps |

### `<Section>` padding steps

`none` · `flush` (8/12) · `xs` (24/32) · `sm` (40/56) · `md` (48/64) · `lg`
(56/80), each phone/`sm`+.

### Widths

`page` `max-w-[1400px]` · `narrow` `max-w-3xl` · `prose` `68ch` · `measure` 900px.

### Named Rules

- 🪤 **Space between sections belongs to the sections, never to a margin between
  them.** `<Section>` owns ground + gutter + rhythm together, which is what makes
  this structural rather than remembered. Removing a band's ground once left
  112px of dead air behind because its padding had been sized for a field.
- 📌 **A seam is built from two paddings**, one from each neighbour. The home
  page's light seams are 32 + 32 = **64px** at desktop. Where a neighbour cannot
  contribute — the marquee's bottom edge, where a navy field starts immediately —
  **the one side brings the whole 64px**.
- 🪤 **A shared-rule plate is one background showing through `gap: 1px`, never a
  border per cell.** Two adjacent borders read as a double rule. Cells stay
  **opaque**, or the container shows through the whole card instead of the seam.
- 📌 **The nav cannot grow without measuring.** The wordmark is absolutely centred
  and wins the z-order, so an overflowing item silently disappears. 🔓
  **Re-measured 2026-08-23 at 1280: 342px left, 295px right** (was 285 / 312).
  Two changes moved it in opposite directions — `/projects` left the nav, and the
  wordmark became the real logo and grew 48px → 82px wide. ⚠️ **The right is now
  the tighter side**; it was the looser one before, and it lost exactly half the
  wordmark's growth because the mark is centred.

---

## Layout families

**§4.7: a family may appear at most once per page; eight sections need at least
four families; no more than two consecutive image+text splits.** v1 was scrapped
largely for failing this. Declare the family in a code comment per section so the
count is a grep rather than a memory.

The home page, as built:

| # | Section | Family | Ground |
|---|---|---|---|
| 1 | Hero | Asymmetric Split Hero + floating plate cluster | `field` |
| 2 | Mission | Editorial Manifesto on a `.sheet` | `page` |
| 3 | Gallery band | Kinetic Marquee (scrolls left) | `page` |
| 4 | Activities | Bento Grid, 4 cells | `page` |
| 5 | Gallery band | Kinetic Marquee (scrolls right) | `page` |
| 6 | Projects | Paired grid (2 cells) on a shared-rule plate | `field` |
| 7 | Partners | Shared-rule logo plate | `page` |

⚠️ **Seven sections, six families — the marquee appears twice**, which is the
budget's one exception. Allowed because the two bands are halves of **one**
gallery: one pool, no photograph in both, one tile size, counter-scrolling, and
they bracket Activities rather than repeating a device in two unrelated places.

⚠️ **Projects and Partners are the closest two families come to each other** —
both are cells on a shared-rule plate. A **third** shared-rule plate breaks the
budget.

### The five content pages, as built in phase 2

**The budget is PER PAGE, not per site.** A family used on the home page may be
reused on `/about`; a family may not appear twice on `/about`. Every section
names its family in a comment at the top, so the count is a grep rather than a
memory.

🔴 **Phase 2 built these from the HOME PAGE's vocabulary rather than evolving
each page's own v1 layout** (officer, mid-phase: keep the exact words and nothing
else). The shared devices are the drawn navy `field` under the grid overlay,
floating `.plate` photographs leaning only at `lg`, the raised white `.sheet`,
the bento grid, and one shared-rule plate per page.

| Page | Sections | Families | Consecutive splits |
|---|---|---|---|
| `/about` | 7 | page hero · plate cluster over a sheet · shared-rule plate on the field · full-bleed feature · disclosure index · navy strip · shared-rule logo plate | 0 |
| `/projects` | 4 | page hero · statement on a sheet · bento (3 cells) · shared-rule stat plate on the field | 0 |
| `/gallery` | 3 | page hero · card masonry · navy field band | 0 |
| `/officers` | 3 | page hero · uniform plate grid · navy field band | 0 |
| `/contact` | 3 | page hero · shared-rule plate (3 cells) · form on white beside a leaning plate | 1 |

**Eyebrow count is ZERO on all five**, against caps of 3/2/1/1/1. Two components
were corrected to keep that honest rather than to game it: `/about`'s
`HISTORY_CARDS` labels are `<Title>` (they head a paragraph), and the role label
in `OfficerCard` plus `/contact`'s channel labels are plain `<dt>`-style data
labels rather than `<Eyebrow>` — which also removed a real bug, since
`<Eyebrow className="text-misa-muted">` put two competing `text-*` utilities on
one element.

⚠️ **`/about` carries two shared-rule plates** (the history stats and Partners).
That is the same tight spot the home page records between Projects and Partners.
They stay distinguishable — navy stat cells on a drawn field against white logo
cells on grey — and a third would break the budget.

📌 **Families still unspent, for phase 3:** stacked editorial, split-screen
scroll, sticky-stack, horizontal pan.

---

## Motion

`emil-design-eng` wins on motion, including over other skills.

### Durations and easing

`press 140ms` · `hover 150ms` · `pop 200ms` · `overlay 260ms`. UI response stays
under 300ms. Entrances are longer (0.6–0.9s) because a scroll entrance is not a
UI response. Easing: `--ease-reveal` for entrances, `--ease-out-quint` and
`--ease-in-out-quint` from emil. **There is no ease-IN curve on purpose** — an
ease-in start reads as lag on anything a person is waiting for.

### The scroll reveal

`data-reveal="up|rise|left|right|fade|wipe"` on any element, plus
`revealDelay(seconds)`. `components/ui/reveal.tsx` is the **server-safe** half and
must never gain `"use client"`; the observer is `reveal-observer.tsx`, mounted
once in the public layout.

- 🪤 **The hidden state is scoped to `html.js`**, set by an inline script during
  HTML parsing. Without the scoping, JavaScript-off gets a blank page; with an
  effect instead of the inline script, content paints and then blanks.
- 🪤 **`[data-revealed]` sets `transform: none`.** Anything transform-based on a
  child belongs on the child, never on the node carrying `data-reveal`.
- 🐛 **`[data-revealed]` sets `clip-path: none`, NOT `inset(0 0 0 0)`.**
  `inset(0 0 0 0)` looks like "no clip" and means *clip to my own axis-aligned
  border box* — and a clip-path clips **descendants**. A rotated child always
  sticks out of its unrotated wrapper, so the reveal wrapper was slicing all four
  corners off the hero's tilted plates; they rendered as polygons and their frame
  was cut with them. ⚠️ **`wipe` keeps its own `inset()` rule**, because it
  animates `clip-path` and `none` is not interpolable from `inset(0 100% 0 0)`.
- ⚠️ **Adding a variant means adding its reset to BOTH the `[data-revealed]` rule
  and the reduced-motion block.** A variant that animates a property neither
  resets stays stuck in its start state forever — silently, and only for the
  people it hurts most.

### Hover

- 📌 **No hover state on any plate or card**, because none of them is
  interactive. A hover affordance on a `<div>` advertises something that does not
  exist. When a plate becomes a link, the cue comes back **with** the
  interaction, not before.
- 📌 **Colour swaps are the only hover this system has**, at `--dur-hover`.
- 📌 **No pause-on-hover on the marquee.** The tracks are full-width, so a resting
  mouse froze a row and read as breakage.

### The marquee

- 🪤 **A marquee needs enough copies to cover the VIEWPORT.** "Duplicate twice,
  translate −50%" only works when one group is wider than the screen, and neither
  home track is. Copies come from `ceil(MAX_VIEWPORT / groupWidth) + 1`.
- 🪤 **The translate distance is one group width in PIXELS** (`--marquee-shift`),
  never a percentage — a percentage silently couples the distance to the copy
  count.

---

## Components

Every shared primitive lives in `components/ui/`. **Reaching for a class string
instead is how the last drift happened**: before the 2026-08-17 rework `/admin`
imported exactly two things from here and had three button dialects, eleven
copies of an input class and nine copies of the same local `Field`.

🔴 **A primitive with no call sites has not ended the drift it was written to
end.** Phase 4 opened by counting, and found `PageHeader` and `SectionHeading` at
**zero call sites anywhere in the repository** — both authored *for* `/admin`,
whose doc comments named the exact duplication they were meant to replace, while
25 pages went on repeating one h1 class string verbatim and 45 h2s repeated
another. `Table` was the same story against 11 raw tables and 47 copies of one
head-cell string; `Panel` had one call site, on `/attend`. **Extracting the
component is half the job; the adoption is the other half, and only the second
half is worth anything.**

| Group | Modules |
|---|---|
| layout | `section.tsx` (public only), `panel.tsx`, `page-header.tsx` |
| type | `heading.tsx` (Headline/Title/Eyebrow/Lead), `chevron-section.tsx` (PageHero) |
| controls | `button.tsx` (`buttonClass` + named constants), `field.tsx`, `chip.tsx` |
| feedback | `banner.tsx` (Banner + ReadError), `pill.tsx`, `empty-state.tsx` |
| data | `table.tsx` |
| content | `partners.tsx`, `kpi-plate.tsx`, `activities.tsx`, `officer-card.tsx`, `hatch.tsx`, `photo-slot.tsx`, `wordmark.tsx` |
| motion | `reveal.tsx` (server-safe) + `reveal-observer.tsx` (client) |

- 📌 **Buttons are class strings, not components**, because every call site is
  already an `<a>`, a `<Link>` or a `<button>`.
- 📌 **`PageHeader` owns the title, the badge, the back link and the
  description**, in that visual order. 🪤 **The back link renders ABOVE the
  title**, reversing where all eleven admin screens had it: a back link is an
  ancestor pointer, and below the h1 it arrived after the line that assumed you
  already knew where you were. It is a prop rather than a component so the
  position is enforced once instead of remembered eleven times.
- 🪤 **A status pill beside a title is `badge`, never `action`.** `action` is
  pushed to the far right of the column, which on a laptop puts a pill an arm's
  length from the thing whose status it reports.
- 📌 **`Pill` is the only badge.** Phase 4 found the same drift `pill.tsx` was
  written to end, still live in five places: two dues badges one row apart at
  `text-[11px]` and `text-[0.7rem]` — 11px and 11.2px, two sizes reading as one
  — and the member page's three-state attendance mark at three different
  treatments.
- 🪤 **`Banner` takes `as="div"` when it carries block content.** A `<p>` cannot
  contain a `<p>` or a `<ul>`: the parser closes the outer one at the child's
  start tag, so the ground and frame end early and the rest renders bare. That
  is a DOM rewrite, not a styling preference.
- 📌 **Icons are drawn, from Lucide.** Phase 4 retired the sort header's `▲`/`▼`
  characters, which inherited the header's uppercase label type and had been
  shrunk to 9.6px to stop them out-weighing the header they annotate. An
  inactive sortable column now shows a faint two-way chevron rather than
  nothing — with an indicator only on the active column, the only way to
  discover the directory sorted at all was to click a header and watch.
- 📌 **`PhotoSlot` is the one image slot**: renders the photograph if the slot has
  a `src`, the labelled `<Hatch>` if not. 🪤 Always `fill`, never an intrinsically
  sized `<img>` — an intrinsic image makes its frame grow to the photo's own
  height. The gallery masonry is the one place that wants intrinsic heights.
- 📌 **`empty-state.tsx` is never a `<Hatch>`.** A hatch means "a photograph
  belongs here"; an empty state means "there is no data."
- 🏗️ **shadcn/ui components write to `components/shadcn/`**, never
  `components/ui/`. `shadcn init` used the default alias once and overwrote this
  project's own `button.tsx`, which 45 files import.

---

## Photography

🔓 **The no-photography decision is LIFTED, conditionally** (2026-08-18/19).
Real photographs are live on the home page **locally only**.

- `pictures/` (the officer's library) and `public/photos/` (web-sized
  derivatives) are **gitignored**, and the code carrying the `src` values is
  uncommitted alongside them.
- 🔴 **They ship together or not at all.** Committing the code while the images
  stay ignored serves broken images instead of placeholders. The repository is
  public, so publishing faces is an officer decision, not a git command.
- **Pipeline:** drop a photo in `pictures/<page>/`, run `node
  scripts/build-photos.mjs`, refresh. `scripts/organise-pictures.mjs` sorts a
  messy library into one folder per page.
- 🪤 **HEIC needs `heic-convert`.** libvips ships HEIF for AVIF only, and
  `.metadata()` succeeds on a file that cannot be decoded — a probe will not
  reveal the failure. 40% of the library is HEIC.
- 🔓 **Officer headshots landed 2026-08-23 — eleven of thirteen — and the rule
  was SATISFIED, not waived.** It was never "no faces on officer cards": the
  handoff shipped headshots while recording that the photo-to-name pairing "was
  never supplied", and a real face against another student's name is worse than
  an empty labelled square. The officer supplied the pairing, off the live site's
  own officers page. 🔴 **All thirteen carry one as of 2026-08-23** — the two
  that waited did so because the page showed a single image file on both cards
  with nothing attributing it, and both were resolved out of band: one attributed
  by the officer, the other supplied as a genuine separate photograph. So
  `Officer.photo` STAYS OPTIONAL and the fallback stays load-bearing even with
  nothing currently using it — a card that could only draw a photograph would
  force a guess the moment a fourteenth officer arrives without one.
- 🔓 **Project cells got photographs on 2026-08-23**, and the distinction that
  made it acceptable is the useful part. The objection was never "a photograph
  next to a client name"; it was pairing a **MISA** photograph to a named client,
  which asserts that this team did this work for these people — a factual claim
  nobody supplied. These are photographs **of the client** (a PepsiCo campus
  sign, the Casa de Luz kitchen), where the pairing is the subject rather than a
  claim laid over it. CapMetro has no photograph and still renders its `<Hatch>`;
  the mixed state is what `PhotoSlot` is for.
- ⚠️ **The two project photographs are the lowest-resolution images on the
  site** — 1048px and 850px wide, against a 699 CSS px slot. Fine at 1× and soft
  at 2×. They were sized for the 4-up band's ~350px cells and the band is now
  2-up. Higher-resolution originals are the fix; nothing in code helps.
- **Treatment spec** (duotone: `grayscale(1) contrast(1.05)` plus a navy
  `mix-blend-mode: color` overlay) lives in the handoff README. Not currently
  applied.

---

## Accessibility

- **A focus ring must be visible on every ground it can land on.** Today that is
  the `.on-navy` flip to white. **Any new ground answers this in the same
  commit.** A navy ring on a navy field is not subtle — it is no indicator.
- **Contrast is measured per pairing, on the ground the text actually sits on,
  compositing any alpha.** Annotation Grey passed everywhere until a field's
  ground changed under it.
- 🐛 **`--misa-muted` (`#6f7275`) on the grey page ground measures 4.33:1 and
  FAILS AA. This file previously recorded it as 4.63:1 and called it "the
  smallest margin in the system"; both halves were wrong.** Recomputed in phase 2
  against a formula validated on the WCAG reference pairs (`#767676` on white =
  4.54, black on white = 21.00). The three public places it had landed on grey —
  `/gallery`'s count, `/about`'s FAQ marker and the public error boundary — now
  use `--misa-secondary` (`#4a4d50`, **7.60:1**).
  ⚠️ **Muted is still fine on white** (4.84:1) and that is where the header, the
  footer, `KpiPlate` and `OfficerCard` use it. The rule is narrow and worth
  stating exactly: **`--misa-muted` may sit on Paper, never on Vellum.**
  ⚠️ `/attend`, `/lookup`, `/leaderboard` and `officer-invite` also put muted on
  grey in places. They are phase 3 and were left standing rather than touched
  from outside their phase; the smallest margin on the five phase-2 pages is now
  **4.84:1**.
  🔴 **The same pairing bit again in phase 4, and that is the useful part: the
  rule is about a GROUND MOVING UNDER INK, not about a list of pages.** Making
  the admin ground Vellum re-created the failure in four new places that had been
  correct on white — the member editor's field labels, the custom-field form's
  hints, and both admin error boundaries' digest line. **Any commit that changes
  a ground re-measures every grey sitting on it.**
- 📌 **Phase 4 measured `/admin` the same way phase 2 measured the public
  pages**: 20 screens, 166 pairings, composited per pairing on the ground each
  text actually sits on. **0 failures, smallest 4.84:1.** It also found the
  disabled "Audit" nav item at **3.39:1** on the navy bar — WCAG exempts an
  inactive control, but that item exists so the shape of the section is visible
  to everyone, so the exemption did not apply to its own purpose. `white/55`
  (**5.05:1**) is the first ramp step that passes, solved rather than picked.
- **A gradient is not one ground.** Measure at both ends.
- **Reduced motion** is honoured: all reveals resolve, marquees stop.
- **The skip link** is the first focusable thing in the document.
- Pre-ship: run `web-design-guidelines`. Its findings override aesthetic
  preference on conflict.

---

## Do / Don't

### Do

- Reach for `<Section>` for every band. Ground, gutter and rhythm move together.
- Give a new ground its focus-ring answer in the same commit.
- Declare the layout family in a comment at the top of each section.
- Put the rotation on `.plate` and the reveal on the wrapper.
- Use `ground="white"` for any section carrying inputs, chips or a table.
- Write the arithmetic down when a composition depends on it.
- Vary **one** property across a set.

### Don't

- Don't use `paper` / `.ground-paper` / `.paper-grid`. All three are deleted.
- Don't put a `border` and `overflow: hidden` and a `transform` on one element and
  then blame the border when the frame disappears.
- Don't recolour a shared primitive to fix one page's ground. Give the **section**
  a ground instead — the primitives are shared with `/admin`.
- Don't reach for a raw framework colour scale.
- Don't add a hover affordance to something that is not interactive.
- Don't add a fifth elevation step, a sixth ground, or a third radius without
  changing this file.
- Don't put an aspect-ratio-sized tile in the marquee; its geometry is derived
  from pixel widths.
- Don't animate `box-shadow`. Animate the opacity of a pseudo-element.
- Don't add a `loading.tsx` **and** granular `<Suspense>` to one route.
- Don't ship photography to git without the officer.

---

## Relationship to v1

What is unchanged: the palette, the two typefaces, the hatch, the wordmark, the
1px border weight, square structure, light-only, the status colours, the
component inventory, and every engineering rule in *Accessibility*.

What changed: the page ground (white → flat grey), the number of grounds (2 → 5),
elevation (none → four steps), radius (0 everywhere → 0 plus a 4px plate), depth
(flat → stacked planes), photography (banned → live locally), and the home page's
entire composition.

⚠️ **`docs/invariants.md` has not yet been fully reconciled with this file.**
That is scheduled for phase 5. Its *Design, rendering and the public UI* section
still describes v1 aesthetics for the surfaces v2 has not reached — now just the
three phase-3 pages. 📌 **Phase 4 added its own section there rather than waiting**
(*The officer UI, and moving a page ground*), because the three rules it carries
are engineering rather than taste and bind immediately.

---

## Design invariants (moved from CLAUDE.md, 2026-08-25)

Rules about photography, headshots, the marquee, gallery, the nav, and design
skill precedence. Engineering/correctness rules (cascade layer, clip-path, reveal
scope) stayed in `CLAUDE.md`; invariants with evidence are in `docs/invariants.md`.

### Photography and image slots

- 🔓 **THE NO-PHOTOGRAPHY RULE IS LIFTED, CONDITIONALLY** (2026-08-18/19). Real photographs are **committed and live** on the home page, `/about`, `/contact`, `/gallery`, the project cells, and all 13 officer headshots since 2026-08-23. 🔴 The repository is public and a face in its history cannot be taken back — a removal request is a git history rewrite, not a delete. What replaces the rule: **a slot renders a photograph or a labelled `<Hatch>`, never a hole**, and `components/ui/photo-slot.tsx` is the single place that swap happens.
- ⚠️ **`public/photos/projects/` (4 files) is the one set that is NOT students** — they are the clients' own premises and staff. Two of the four are live; `cap-metro.jpg` and `chicago-crime.jpg` are built and unreferenced. The irreversibility applies to those faces with none of the club's consent behind them.
- 🔓 **Officer headshots landed 2026-08-23 for ALL THIRTEEN.** The pairing was read off the live Squarespace page's **CSS grid geometry** (not DOM order). 🔴 Sanya Pillai keeps her placeholder — the shared photograph is attributed to Daniel Chen, and it must never be copied onto her entry. 🔓 All thirteen cards now carry a photograph; `Officer.photo` stays optional so the fourteenth officer arrives without one.
- ✂️ **Per-officer LinkedIn links are HIDDEN temporarily** (`SHOW_OFFICER_LINKEDIN` in `lib/officers.ts`). The seven URLs stay in the data.
- 🪤 **Officer headshots are cropped SQUARE BY THE PIPELINE, not by the card.** `scripts/build-photos.mjs` crops with `position: "north"`. `CROPS` in the same file is the per-officer escape hatch for framing problems. 🔴 A rect is tied to the exact file it was measured against — replace the file and delete the entry.
- 🪤 **`withoutEnlargement: true` silently defeats `fit: "cover"`.** The square edge is computed per image as `min(width, height, max)`.
- 🪤 **When photography returns, size framed slots with `next/image`'s `fill`.** An intrinsically sized `<img>` makes the frame grow to the photo's own height.
- ✂️ **`GALLERY_ITEMS`, `GALLERY_FILTERS`, `GALLERY_FEATURE` and `GALLERY_TERM` were DELETED in v2 phase 2.** Do not reintroduce a category filter without a real file-to-category mapping.

### Marquee geometry

- 🪤 **A marquee needs enough copies to cover the VIEWPORT.** `Math.ceil(MAX_VIEWPORT / groupWidth) + 1`; `MAX_VIEWPORT` (4000) is a real ceiling. The translate distance is `--marquee-shift`, one group width in pixels — never a percentage. No pause on hover. Verify by pausing animation across a full cycle, not by watching it.

### Nav clearance

- 🪤 **The site header's nav cannot grow without measuring at 1280.** The wordmark is absolutely centred and wins the z-order; an overflowing item disappears silently. 🔓 **RE-MEASURED 2026-08-23: 342px clearance left, 295px right.** Left group 225px, right cluster 272px, wordmark 82px, 32px gutter. Right is now the tighter side. Relisting `/projects` spends part of the left; any sixth item needs a fresh measurement.

### Design skill precedence

- **The Invariants in `CLAUDE.md` outrank all four skills, without exception.**
- 📌 **`DESIGN.md` is the design source of truth for the WHOLE site.** The handoff is historical reference — desktop-only, no breakpoints, no interaction states.
- 🔓 **`design-taste-frontend` IS PRIMARY for the public visual UI during the v2 redesign** (officer's call, 2026-08-17). It owns composition, layout family, image strategy, and its §14 Final Pre-Flight gate. `DESIGN.md` constrains the skill: it does not re-pick grounds, elevation, radii, or palette.
- **No aesthetic skill is primary anywhere** outside the active redesign. `impeccable`'s "redesign replaces" path is out of scope for the whole site.
- ⚠️ **Skill conflicts are settled in `DESIGN.md`; don't relitigate them.** Refused: dark mode, real imagery, eyebrow ban, mono-as-costume, 65–75ch measure, one-marquee-per-page, em-dash ban, "no oversized H1". Adopted: no coloured border-left above 1px, entrance variety, themed browser surfaces, emil's easing and durations.
- **Animation and motion: `emil-design-eng` always wins** on easing, duration, and whether to animate at all. The scroll reveal is the house pattern.
- **Pre-ship review: run `web-design-guidelines`.** Its accessibility findings override aesthetic preference.
- **`impeccable`'s hook** runs after every Edit/Write (`.claude/settings.local.json`, machine-local, gitignored). It injects context only.
- If two skills conflict and nothing above settles it, ask. Don't average them.

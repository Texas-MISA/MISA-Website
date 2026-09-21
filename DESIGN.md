---
name: Texas MISA
description: A navy-and-white institutional drawing set, now with depth — a drawn navy field, a flat grey page, and white surfaces lifted off it. Square structure, softened plates, hairline rules.
version: 2.4
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
  control-edge: "#858687"
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
| `/portal/attend` | ✅ **v2 — REBUILT 2026-09-20** (phase 3, the Portal Rebuild, part 3; `rebuilt` in `docs/design/surfaces.json`, all seven receipts passing). Concept A, “Fit the first screen”, then the officer’s 2026-09-20 header removal: the page is one white `.sheet` on the grey ground (`PortalSheet`), the form at the `xs` rhythm with 16px gaps, every label visible above its field, a 48px full-width Check in. 🔓 **Its bar is a fold position and was the tightest number in the phase, and it is TWO NUMBERS** — established at the 2026-09-20 re-gate, which found that no record had ever said which convention it used. At a **true 360×640** (a phone, overlay scrollbars, 360 CSS px of layout) under the 61px sticky header, IDLE, the Check in button’s bottom edge is **591.5px, 48.5px of slack**. In a **360px-wide desktop window**, where a classic 14–15px scrollbar leaves 345–346px of layout, the checkbox’s own **label** wraps to a second line and the same build measures **611.5 headless / 607.66 in real Chrome** — the figure the receipts recorded. 🪤 **The step is a cliff at 348px of layout width, not a slope:** one pixel moves that row 20px (104 → 84) and the button with it. **Met under both**; it was cut at 668 and measured 610.5 at its 2026-09-19 gate. Removing the navy band was worth **+19px at a true 360 and about zero at 346** — not the “most of another 131” a comment claimed; it bought composition, not height. All **twelve** states are designed and gated, not just the happy path, and **both** of its muted-on-Vellum occurrences are gone — lowest ratio anywhere in its `<main>`, measured on every state, is **8.51:1**. 🪟 `/portal/attend` stays **indexable**; robots is per page and must never move to a portal layout. |
| `/portal/leaderboard`, `/portal/lookup` (were `/leaderboard`, `/lookup` until 2026-09-18; the old paths 308 here) | ⏳ **NOT YET REBUILT — phase 3’s parts 4 and 5 are next.** Never had a design; they wear the shared primitives. ⚠️ They still carry the `--misa-muted`-on-Vellum AA failure — nine occurrences on `/portal/lookup`, one on `/portal/leaderboard` — plus the `definition-list` axe fault on `/portal/lookup`’s result, which is the one check `npm run test:ui` still fails. 🧰 **Rebuilt through §Design toolkit**: both are registered in `docs/design/surfaces.json` with a brief, two concepts, evidence and an officer-adopted concept each; the builds and their gates are what remain. |
| `/portal` (the member portal hub) | ✅ **v2 — REBUILT 2026-09-19** (phase 3, the Portal Rebuild; `rebuilt` in `docs/design/surfaces.json`, all seven receipts passing). Concept A, "the title block", then the officer’s 2026-09-20 header removal: one white `.sheet` on the grey ground (`PortalSheet`) whose body is a shared-rule plate whose three cells are each a whole-row `<Link>` with a 48px navy key. Equal formatting is structural — one `.map` over one shape. No `data-reveal` anywhere, deliberately. The header's MEMBER PORTAL button is still the site's one way in. 🔓 Its bar, measured settled at 360×640 under the 61px sticky header: the check-in row's bottom edge at **267.2px** against "at or above 424" (re-derived at the 2026-09-20 re-gate three ways — the lead, the `design-reviewer` agent and the critique's assessment B, the last from the box model rather than a browser; the 265.5 recorded on 2026-09-20 does not reproduce). 🔴 **No navy header** — zero `.chevron-notch` and zero `.ground-field` in any portal `<main>`; the only navy left in the portal body is the three key columns and the submit buttons, which are controls. |
| `/admin` | ✅ **v2** (phase 4, 2026-08-29), governed by scanability rather than expression. Ground, surfaces and the shared vocabulary; **not** a re-composition. |

🪤 **The grounds already changed site-wide, ahead of the rebuilds.** Every public
page sits on the v2 page ground today, so a page can be un-rebuilt and still not
look like v1. Do not read "it has the grey background" as "it has been done."

📌 **From 2026-09-18 a rebuild's status also lives in `docs/design/surfaces.json`**
(§Design toolkit), which the tests read. This table is for people; that file is
for the checks. **They must agree** — a surface is ✅ here only once it is
`rebuilt` there and its receipts pass. 🔓 **Two of the four portal surfaces are
`rebuilt` as of 2026-09-20 — `portal-hub` and `portal-attend`, seven receipts
each.** The other two are `in-progress`: each has a brief, two concepts and its
evidence, and the officer has adopted a concept for each (`/design-brief` steps
1–3), so the builds and `/design-gate` are what remain. The phase 1, 2 and 4
surfaces predate the toolkit and are not registered.

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
| **Control Edge** | `#858687` | 🆕 The boundary of a **form control**, and only that |

🪤 **Frame is alpha; Plate Edge is its opaque twin, and the difference is not
pedantry.** A floating plate crosses the navy field, another plate, and white —
`--misa-border` composited to a clear hairline on one and to nothing on another,
so one border read as two weights. Plate Edge is exactly `rgba(29,31,32,0.2)`
resolved over Vellum Shade, so the edge looks the same whatever passes beneath.
**Use Frame when you know what is behind; use Plate Edge when you do not.**

🔓 **Control Edge is neither of those, and it is a CONTRAST floor rather than a
shade** (v2 phase 3, round 1a). WCAG **1.4.11** asks 3:1 of the visual
information that identifies a user interface component, measured against the
colours adjacent to it — and a text input has two adjacent colours at once: the
surface it sits on and its own Vellum interior. Frame cleared neither. The
numbers, re-derived against a formula validated on the WCAG reference pairs:
Frame over a control's own fill is `#c7c7c8`, **1.69:1** against a white sheet
and **1.51:1** against the fill; over white it is `#d2d2d2`, **1.51:1** and
**1.35:1**; and the fill is **1.12:1** from a white sheet. An empty input was a
rectangle with no measurable edge. Control Edge measures **3.65:1 on Paper and
3.26:1 on Vellum** — one value, because Vellum is both the interior of every
control and `/admin`'s page ground.

🪤 **It is deliberately NOT a move of Frame.** Darkening Frame repaints every
card, panel and photograph on the site, and it would break Frame's own
definition-by-derivation of Plate Edge, so the two would stop reading as one
weight. 1.4.11 does not ask it of them either: a card frame encloses content
that is already legible, while an empty input has no text of its own and its
boundary is the only thing saying a control is there. 📌 Built the way Plate
Edge was built — Graphite (`#1d1f20`) resolved opaque, here at 54% over white —
so it joins the neutral family rather than introducing a hue.

⚠️ **A control's INTERACTION states are held to the same 3:1.** The hover
border was `--misa-blue/50`, which composites to **2.95:1** on a white sheet and
**2.85:1** on the fill — so a control that passed at rest dropped below the bar
exactly when it was pointed at. It is `/55` (**3.35:1** and **3.24:1**), the
smallest step that clears both. Focus (solid navy, 13.03:1) and `aria-invalid`
(Critical, 8.63:1) were already clear.

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
so the site has ONE navy hero treatment rather than two. 🔓 **FIVE pages render
it, and they are exactly the five phase-2 pages** — `/about`, `/projects`,
`/gallery`, `/officers`, `/contact`. Counted by call site 2026-09-20. 🪤 **It
was NINE until that day**: the four `/portal` surfaces all inherited this hero
without having been designed around it, so a change here was silently a change
to four out-of-scope pages. The officer's removal of the navy header from every
portal page (§Components, `PortalSheet`) ended that coupling — **the blast
radius of a change here is now the five content pages and nothing else.** Its
dead `size="home"` and `tagline` props were deleted.
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

- 🪤 **It is on `<main>`, not on `body`** — and that stayed true when `/admin`
  took the same ground in phase 4: the admin shell paints its *own* `<main>`.
  `body` keeps `--background: #ffffff` on both sides, which is what every white
  surface is lifted off. `<Section>` still has zero admin call sites, which is
  what kept the two grounds independent while only one of them had moved.
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

🪤 **The card title is `<Title size="card">`, never `<Title className="text-[22px]
sm:text-[26px]">`.** Both are plain arbitrary-value utilities, so they tie on
specificity and Tailwind v4 emits them ascending — the LARGER always wins, and
the override silently renders the `Title` default (26 → 34) instead. The class
is in the attribute, so a grep confirms the intent and only `getComputedStyle`
shows the result. `components/ui/activities.tsx` shipped exactly that on the
HOME page from the bento grid's build until v2 phase 3 round 1a; the row above
is what it renders now, measured at **22px below `sm` and 26px at and above it**.
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

🪤 **`level="sub"` renders an `<h3>`, not a smaller `<h2>`.** Three visual levels
have to be three semantic ones or the document outline lies: a heading inside a
panel is a child of the section heading above it, not its sibling.

⚠️ **`/admin/login` is the one screen that does NOT use `PageHeader`, and its h1
is off this ramp** — `text-3xl` at `-0.02em`, with no `sm:` step. It is a centred
card outside the shell, so the component's left-aligned title-and-action row is
the wrong shape for it. Recorded as an exception rather than left as undocumented
drift; the honest fix is a centred variant, and nothing needs one yet.

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
  **Re-measured 2026-09-18 at 1280: 342px left, 450px right.** Everything right
  of the wordmark — Leaderboard, My Attendance and the Check In button — became
  one navy MEMBER PORTAL button, so the right side fell from 272px to 117px and
  gained 155px. ⚠️ **The left is the tighter side again** on desktop; on a phone
  the tight spot is that button beside the centred wordmark. History: 342 / 295 on 2026-08-23, when `/projects`
  left the nav and the wordmark became the real logo (48px → 82px wide — the
  right lost exactly half that, because the mark is centred), and 285 / 312
  before that.

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
| type | `heading.tsx` (Headline/Title/Eyebrow/Lead), `chevron-section.tsx` (PageHero), `portal-sheet.tsx` (PortalSheet) |
| controls | `button.tsx` (`buttonClass` + named constants), `field.tsx`, `chip.tsx` |
| feedback | `banner.tsx` (Banner + ReadError), `pill.tsx`, `empty-state.tsx`, `status-region.tsx` (StatusRegion) |
| data | `table.tsx` |
| content | `partners.tsx`, `kpi-plate.tsx`, `activities.tsx`, `officer-card.tsx`, `hatch.tsx`, `photo-slot.tsx`, `wordmark.tsx` |
| motion | `reveal.tsx` (server-safe) + `reveal-observer.tsx` (client) |

- 📌 **Buttons are class strings, not components**, because every call site is
  already an `<a>`, a `<Link>` or a `<button>`.
- 🔓 **Button labels are written in SENTENCE CASE; `button.tsx`'s `BASE` applies
  `uppercase`.** The caps are a *presentation* decision and live in exactly one
  place. Writing them in the markup as well is pure duplication — identical on
  screen, but it reaches assistive technology, translation and the clipboard as
  caps, and some screen readers spell short all-caps strings out letter by
  letter. Normalised across `/admin` on 2026-08-31 (55 labels, 22 files).
  🪤 A caps grep has two false positives here: **`EID` is an acronym**, not a
  styled label, and **`INITIAL` is a constant identifier**.
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
- 🔴 **`PortalSheet` is the portal's page surface, and THE PORTAL HAS NO NAVY
  HEADER** (v2 phase 3, officer 2026-09-20: *"the navy header at the top of each
  page should be removed for all pages in the portal"*). Every `/portal` page is
  one white **`.sheet`** lying on the grey page ground, its title a masthead
  above a rule that bleeds to the sheet's edges. 🔓 **The point is composition,
  not colour:** the public pages are stacked full-bleed sections, and a navy
  hero on a page whose whole job is a form applied a *brochure* device to a
  *tool*. Making each portal page an **object** is what stops the portal
  resembling the marketing site.
  - It reuses `.sheet` (§Surfaces) rather than inventing a surface, and earns
    its 4px radius on this file's own terms: *only a thing that reads as an
    object lying on the page takes the plate radius*.
  - 🪤 **A `.sheet` must sit on a ground that is not white**, so the component
    owns its `<Section ground="page">` — the one mistake that would make it
    vanish is the one a caller could make.
  - 🪤 **ONE `max-width` declaration.** `width="narrow"` plus an
    `innerClassName` measure emits two equal-specificity utilities and the
    winner is Tailwind's emission order — the tie that made
    `<Title className="text-[22px]">` render at 26px.
  - 🪤 **No back link, measured rather than forgotten.** The adopted concept had
    one; the site header's MEMBER PORTAL button already links `/portal` from
    every page, so it duplicated an always-visible control for **40px** on the
    surface gated on a fold position.
  - **Four callers** — the hub, check-in, the leaderboard and lookup.
  🗑️ **It replaced `PortalBand`, which is DELETED.** The band was built in part
  1 and removed in the same phase; with both callers converted it would have had
  zero call sites, and a primitive with no call sites has not ended the drift it
  was written to end. Its reasoning survives in the hub's and check-in's
  `receipts/officer.md`.
- 🔴 **A focus ring must contrast with every ground the FOCUSED ELEMENT spans,
  not just the one its section sits on** (v2 phase 3, found at the portal-hub
  gate). `app/globals.css:318` draws `:focus-visible` as `2px solid
  var(--misa-blue)`, and `.on-navy :focus-visible` flips it to white — but that
  selector answers "a focused element *inside* a navy section". The hub's row
  link is the first thing in this system to span **two grounds inside one
  focusable element**: a white cell, then a 48px `bg-misa-blue` key. Its single
  navy ring measured 13:1 across the cell and **1.00:1 over the key**, so the
  indicator appeared to stop dead at the seam. The fix is that the navy child
  redraws the ring in white over its own box, at the same inset, so the two
  segments meet and read as one indicator that changes colour with the ground.
  🪤 **Any future portal surface that puts a navy element inside a link hits
  this again.** And note what made it hard to see: the hub had already reasoned
  carefully and correctly about *where* the ring is drawn (`-outline-offset-2`,
  so it does not cross the 1px plate seam onto the neighbouring cell) — a
  thorough argument about the right half of the problem.
  - 🔴 **THE CHILD MUST BE POSITIONED, or its ring does not paint at all**
    (portal-hub re-gate, 2026-09-20). The fix above shipped on 2026-09-19 and
    was verified with `getComputedStyle`, which reports the child's white
    outline as present, correct and inset by the matching 2px. **It never
    painted.** Screenshotting a focused row and diffing it against the same row
    unfocused isolates the indicator exactly: the parent's navy runs stopped
    dead at the child's left edge, the parent's right-hand run painted nothing
    at all, and the child's white ring contributed only a 2px bar at the seam.
    The ring did not change colour at the seam — it **ended** there, with the
    48px key outside the indicator that named it. An outline paints in its own
    element's paint step, and a non-positioned in-flow child does not get one
    that survives over its parent's. `position: relative` on the child fixes it;
    `relative` + `z-index` and `isolation: isolate` also work; an inset
    `box-shadow` does **not**, because it paints with the child's background and
    is still under the parent's outline. All four were measured rather than
    reasoned about.
  - ⚠️ **The rule this leaves behind is about instruments, not about rings: a
    fix verified by the same instrument that would have missed the defect is not
    verified.** Computed style cannot see paint order. A focus ring on a
    two-ground element is checked by diffing a screenshot, or it is not checked.
  - 🔴 **A FOCUS RING ON A FILLED BUTTON FADES IN FROM INVISIBLE, AND NOBODY
    CHOSE IT** (v2 phase 3, found at the portal-attend re-gate, 2026-09-20).
    **Tailwind v4 puts `outline-color` inside `transition-colors`** — resolved
    on a real button, `transition-property` reads `color, background-color,
    border-color, outline-color, …`. `components/ui/button.tsx`'s `BASE`
    carries `transition-colors duration-150`, and an unfocused element's
    `outline-color` computes to `currentColor`. So on any control whose own text
    is white — `variant: "primary"`, `"onNavy"`, and `danger` once filled — the
    ring animates **white → navy over 150ms, on a white ground**. Sampled on
    `/portal/attend`'s Check in button: `rgb(255,255,255)` at t≈1ms (**1.00:1**
    against the sheet), `rgb(214,219,226)` at ≈31ms, `rgb(148,160,180)` at
    ≈62ms, navy at ≈151ms (13.03:1) — **the indicator does not clear 3:1 until
    roughly 70–90ms after the key**. A control whose text is dark (every text
    input, whose `currentColor` is Graphite) fades dark-to-dark and is fine.
    🪤 **It cannot be fixed at a call site**: every `transition-*` utility sets
    `transition-property` at equal specificity, so an appended override ties and
    loses on emission order — the same tie as `Title`'s below. The fix belongs in
    `BASE`. 📌 The header's MEMBER PORTAL button is the same defect, raised at
    the portal-hub re-gate from the other end; the two are one officer question.
- 🔴 **`Title` takes `size`, because appending a smaller size class DOES NOT
  WORK** (v2 phase 3). Both sizes are arbitrary-value utilities, so they tie on
  specificity (0,1,0) and the winner is whichever Tailwind emits last — and
  Tailwind v4 sorts arbitrary values **ascending**, so the **larger always
  wins**. `<Title className="text-[22px] sm:text-[26px]">` has therefore always
  rendered at the component's own `26 → 34`. 🐛 **This is a live defect on a
  phase-1 surface:** `components/ui/activities.tsx:98` uses exactly that form,
  and the home page's activity titles measure **34px at 1280** where the code
  asks for 26. No test and no detector sees it — the class IS in the attribute,
  so a grep confirms the intent and only `getComputedStyle` shows the result.
  **This is the "measure rendered class attributes, not grep hits" rule with
  teeth: here even the rendered attribute lies.** Fixing `activities.tsx` is
  phase 3 part 6's, not any portal surface's.
- 🔓 **`StatusRegion` is one always-mounted atomic announcer** (v2 phase 3), for
  `/portal/attend` and `/portal/lookup`. 🪤 It exists because **a live region
  must be in the DOM BEFORE its contents change**: a node that mounts already
  carrying its text is not an announcement, which is what check-in's result and
  review panels do today. So it is a separate `sr-only` region, never a `role`
  on the message node and never a wrapper around conditional siblings — an empty
  wrapper in a `flex … gap-*` row is still a flex item and still adds a gap.
  Render it unconditionally with an empty string, never `{msg && <StatusRegion>}`.
- 🔓 **`buttonClass({ touch: true })` raises a control to the 48px native
  minimum** (v2 phase 3). No size reached it — `md` is **39px** and `lg` is
  **43px** — and 39px is the figure all three portal briefs measured. 🪤 It is a
  separate axis from `size`, not a fourth size: a hit-area floor and a type step
  compose rather than compete. `min-h`, so a wrapping label grows rather than
  clips.
- 🔓 **`Banner` takes `size`, and a heading may sit inside it** (v2 phase 3
  part 3). `size="md"` is `px-6 py-6 text-base`, for the one shape that needs
  it: an outcome sheet that is not a notice beside the task but the screen that
  ends it, whose sentence is body copy rather than the 14px a notice is set in.
  🪤 **A prop, not an appended `px-6 py-6`** — equal-specificity utilities are
  decided by emission order, the same tie that made `<Title className="text-[22px]">`
  render at 26px. `sm` is the default and all 24 existing call sites are
  byte-identical. It also takes `tabIndex={-1}`, for the error-summary pattern:
  after a failed submit, focus moves to the explanation. 🐛 **And the tone rule
  needed one clarification the day a heading first went inside one:** *"the text
  stays body-coloured"* was written about the **message**. A heading in a banner
  takes Graphite like every other heading — `/portal/attend`'s outcome `<h2>`
  inherited Body Graphite and rendered a different ink from the review step's
  heading two screens earlier.
- 🔴 **A neutral `Banner` and a text input are THE SAME COLOUR, and on a white
  ground that matters** (v2 phase 3 part 3). `Banner`'s `info` tone and
  `controlClass` both fill with `--misa-panel`, so on `ground="white"` an
  `info` banner above a stack of empty inputs computes the identical
  `rgb(242,242,243)` at 1.12:1 against the sheet — and reads as one more empty
  control rather than as a message. `/portal/attend`'s unmatched alert, the one
  screen its redesign existed to rescue, shipped that way until the gate
  measured it. **On a white ground, an alert that matters takes a status tone**;
  `info` is for "nothing to do here".
- 🔓 **`HeadlineProps` takes `tabIndex?: -1`** (v2 phase 3 part 3), typed to
  `-1` so no heading can enter the tab order. For one case: a screen that
  replaces another in place, where the element the person was focused on has
  been unmounted and focus would otherwise fall to `<body>` — so the next Tab
  restarts above the site header. 🪤 **Only for a screen that CONTINUES a
  task.** A terminal outcome asks nothing, so a polite `StatusRegion` is correct
  there and moving focus is an interruption. That split is also what keeps the
  announcement rule down to one line: *the region carries only what nothing else
  announces*, and a focused heading announces itself.
- 🔓 **`Table` has two kinds of sticky head, and they stick to different
  things.** `<THead sticky>` sticks inside the table's own scrollport and pairs
  with `maxHeight` (the officer directory). **`<THead sticky="page">` sticks to
  the VIEWPORT** and requires `<Table scroll={false}>` — inside the
  `overflow-x-auto` wrapper there is no viewport to stick to, because
  `overflow-x: auto` computes overflow-y to `auto` and the head then sticks to a
  box as tall as the table. 🐛 **The page variant fills WHITE**: `Th` is
  `--misa-muted`, 4.84:1 on Paper but **4.33:1 on Vellum**, so a Vellum sticky
  head would have introduced the exact AA failure phase 3 exists to remove.
  🪤 `scroll={false}` is only for a table that genuinely cannot overflow — the
  wrapper is also what makes an overflowing table keyboard-scrollable (2.1.1).
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
- 🔴 **A FOLD MEASUREMENT IS NOT A NUMBER, IT IS A NUMBER AND A LAYOUT WIDTH**
  (v2 phase 3, the portal-attend re-gate, 2026-09-20). A 360px-wide desktop
  window on Windows is a **345–346px layout**, because a classic scrollbar takes
  14–15px; a phone at 360 is a **360px layout**, because its scrollbars are
  overlays. `/portal/attend` crosses a wrap cliff between the two — its checkbox
  label wraps at ≤347px and the row grows 20px — so its bar reads **591.5** one
  way and **607.7** the other. Both were recorded, in six documents, with no
  convention attached to any of them. 🪤 **And headless Chromium uses overlay
  scrollbars in EVERY context**, `isMobile` or not, so a headless "desktop" run
  is not the desktop case and three headless derivations are one derivation.
  Write the layout width beside the number, and cross-check a fold figure in a
  real browser.
- 🐛 **`--misa-muted` (`#6f7275`) on the grey page ground measures 4.33:1 and
  FAILS AA. This file previously recorded it as 4.63:1 and called it "the
  smallest margin in the system"; both halves were wrong.** Recomputed in phase 2
  against a formula validated on the WCAG reference pairs (`#767676` on white =
  4.54, black on white = 21.00). The three public places it had landed on grey —
  `/gallery`'s count, `/about`'s FAQ marker and the public error boundary — now
  use `--misa-secondary` (`#4a4d50`, **7.60:1**).
  🪤 **7.60:1 is Secondary on the GREY ground. On Paper the same ink is
  8.51:1** — write the ground down beside the ratio, always. `/portal/attend`
  quoted 7.60 for a white ground in two comments until the 2026-09-20 re-gate
  measured them, which is the same mistake as Annotation Grey's, made with the
  ink that was brought in to fix it.
  ⚠️ **Muted is still fine on white** (4.84:1) and that is where the header, the
  footer, `KpiPlate` and `OfficerCard` use it. The rule is narrow and worth
  stating exactly: **`--misa-muted` may sit on Paper, never on Vellum.**
  ⚠️ `/attend`, `/lookup`, `/leaderboard` and `/officer-invite/[token]` also put
  muted on grey in places. They are phase 3 and were left standing rather than
  touched from outside their phase; the smallest margin on the five phase-2 pages
  is now **4.84:1**. 📌 **RE-COUNTED 2026-09-19, AGAINST THE RENDERED PAGES: 13
  occurrences across FOUR files** — lookup 9 (page 1, form 8), attend 2 (the
  2026-09-14 disclosure hotfix removed two of the four), leaderboard 1,
  officer-invite 1 — **not all of them fail**,
  only the ones on grey, so each is measured on the ground it actually sits on
  rather than swapped wholesale.
  🐛 **The `/portal` hub renders NONE, and the earlier count of 1 was a grep
  hit on a COMMENT** — `app/(public)/portal/page.tsx:42`, the note explaining
  why the hub's officer line uses `--misa-secondary` in the first place.
  `tasks.md` had this right ("The new `/portal` hub adds none") and this file
  did not. **Count rendered class attributes, not grep hits**, and the same
  pass found attend at 2 where `tasks.md` still said 4. Neither document was
  wholly right; both are corrected. 🪤 **All four live under `app/(public)/`,
  `officer-invite` included** — it is outside `/admin` (see `proxy.ts`), which
  makes `app/officer-invite` a plausible-looking path that does not exist.
  Tracked in `tasks.md`.
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
- 🔓 **NON-TEXT contrast is a separate bar from AA text contrast, and the system
  had never been measured against it** (WCAG **1.4.11**, v2 phase 3 round 1a).
  It wants 3:1 of whatever identifies a control, against **each** adjacent
  colour — for an input that is the surface outside AND its own fill inside.
  Every form control on the site failed it: 3 on `/portal/attend` and **77
  across nine `/admin` screens**, all at 1.51:1 or below. Fixed with
  `--misa-control-edge`; see §Colors for the derivation. ⚠️ **States count** —
  the hover border failed at 2.95:1 while the rest state passed. 📌 A bordered
  BUTTON or chip is a different case: its visible text label identifies it, so
  its border is not load-bearing the way an empty input's is, and `FilterChip`
  and the `quiet` button keep Frame deliberately.
- **A touch target on a phone is measured, not assumed.** The header's Member
  portal button measured **29.0px** tall at 360 — under the 44px floor, on the
  site's one door to the portal — and now takes the 48px floor below `sm`
  (`max-sm:min-h-12`). 🪤 Scoped to the phone: the `xl` bar was measured and
  signed off at 29px in an `h-15` shell, and raising it there is a change to
  chrome rather than a fix to a failure.
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

- 🪤 **The site header's nav cannot grow without measuring at 1280.** The wordmark is absolutely centred and wins the z-order; an overflowing item disappears silently. 🔓 **RE-MEASURED 2026-09-18: 342px clearance left, 450px right** (342 / 295 on 2026-08-23). Left group 225px; the right side is now ONE navy MEMBER PORTAL button, 117px (was 272 — Leaderboard, My Attendance and Check In); wordmark 82px, 32px gutter. **The left is the tighter side again.** Relisting `/projects` spends part of the left; any sixth item needs a fresh measurement. 🪤 **On a phone the button sits beside the centred wordmark alone, and it is the tight spot**: `px-3` below `sm` (10px clear at 360), stacked onto two lines below 360px.

### Design toolkit (2026-09-18) — the roster, the pipeline, and what enforces them

Replaces "Design skill precedence". v1 failed because it "treated the installed skills as advisory and hand-rolled everything" (`docs/frontend-redesign-v2-plan.md`); this section makes skill use **checkable**. The skills, agent, hooks and the `/design-brief` + `/design-gate` skills are **committed** (`.claude/`), so every clone carries the same toolkit. Licences: `.claude/third-party-licenses/`.

**Precedence:**
- **The Invariants in `CLAUDE.md` outrank every skill, without exception.** Then this file. Then the skill that owns the concern below.
- 📌 **`DESIGN.md` is the design source of truth for the WHOLE site, and it is hand-written.** No skill re-picks grounds, elevation, radii, palette or the type ramp. Outside a surface's pipeline, no aesthetic skill is primary.
- 🔴 **Forbidden, because each one writes a rival source of truth:** impeccable's "redesign replaces DESIGN.md" path (every redesign here is new work *inside* this world), `/impeccable init`, and `/impeccable document` writing DESIGN.md — overwrite or merge (PRODUCT.md exists; DESIGN.md is not regenerated from code). Its **sidecar-only refresh**, which by its own reference "preserve[s] DESIGN.md and write[s] only `.impeccable/design.json`", is allowed; `ui-ux-pro-max --design-system` and `--persist` (it writes `design-system/…/MASTER.md`, "the Global Source of Truth"), and `shadcn init`. `tests/design-receipts.test.ts` fails if a `design-system/` directory appears or DESIGN.md loses its hand-written sections.
- ⚠️ **Skill conflicts settled here are not relitigated.** Refused: dark mode, real imagery, eyebrow ban, mono-as-costume, 65–75ch measure, one-marquee-per-page, em-dash ban, "no oversized H1". Adopted: no coloured border-left above 1px, entrance variety, themed browser surfaces, emil's easing and durations.
- If two skills conflict and nothing here settles it, ask the officer. Don't average them.

**The roster — one owner per concern:**

| Concern | Owner | Limits |
|---|---|---|
| Lead, **Persuade** surfaces (home, the five content pages) | `design-taste-frontend` | Owns composition, layout family, image strategy, its `## 14. FINAL PRE-FLIGHT CHECK`. |
| Lead, **Operate** surfaces (`/portal/*`, `/admin`) | `impeccable` (Operate mode, craft-floor) | Officer, 2026-09-18, for the portal; `/admin` already ran this way in phase 4. Its `shape` interview writes every surface's brief. |
| Divergence | `frontend-design` — the Apache-2.0 skill from `anthropics/skills`, not the commercially licensed plugin | Exactly two concepts per surface, for the lead to adopt or reject. **Never writes shipped code.** |
| Reference data | `ui-ux-pro-max` | **Lookups only** (`search.py "<q>" --domain ux`), each cited in the brief by id. Never overrides a token, the ramp or the palette. |
| Motion | `emil-design-eng` | Always wins on easing, duration, and whether to animate at all. Reviews in its required format. |
| Components | shadcn MCP (`.mcp.json`) | Search and view through the MCP; `shadcn add … --dry-run` before any add, never `--overwrite`; it lands in `components/shadcn/` (the `ui` alias) and is wrapped in `components/ui/`; then run the MCP's `get_audit_checklist`. 🔴 `shadcn init` stays forbidden — it overwrote `button.tsx` once. |
| Code review | `web-design-guidelines` | Its accessibility findings override aesthetic preference. |
| Rendered review | `design-reviewer` agent (`.claude/agents/`) | Claude in Chrome, or Playwright when the extension is absent. Local stack only — previews write to production. |
| Fixed checks | impeccable detector, Playwright + axe, token contrast | See enforcement. |

**The pipeline, per surface** (a page or hub registered in `docs/design/surfaces.json` — registering one is how its redesign starts):
1. **Brief** — `/design-brief <surface>`: impeccable's `shape` interview with the officer, written from `docs/design/templates/brief.md` and persisted with impeccable's `surface-brief.mjs` at `.impeccable/surfaces/<slug>.md` — **impeccable's own brief, so the lead loads it on every command** rather than a document nothing reads.
2. **Diverge** — `frontend-design`, two concepts; the lead adopts or rejects each, with reasons.
3. **Evidence** — `ui-ux-pro-max` lookups (EV1, EV2…); every adopted one cited in the brief.
4. **Build** — the lead drives; the shadcn MCP sources components; emil on any motion.
5. **Review** — `/design-gate <surface>`: the lead's self-review, `impeccable critique` + `audit`, `web-design-guidelines`, the `design-reviewer` agent at 360/768/1280, the detector, emil if it moves.
6. **Gate** — the checkers green, then the officer. Changes the officer asks for are recorded in `receipts/officer.md` with their commits.

**What enforces it:**
- 🔓 **A brief before any edit.** `.claude/settings.json` runs `scripts/design/brief-guard.mjs` as a PreToolUse hook: an Edit/Write to a registered surface's files is **refused** until its brief exists. The human-only bypass, for an urgent non-design fix, is `MISA_DESIGN_GUARD=off` in the environment Claude Code is launched with.
- 🔓 **Receipts that prove use, not presence.** Each step writes `docs/design/surfaces/<surface>/receipts/<step>.md` (template `docs/design/templates/receipt.md`) plus the skill's raw output. `scripts/design/receipts.mjs`, run by `tests/design-receipts.test.ts`, fails a surface once it is `rebuilt` (and its brief once it is `in-progress`) when:
  - the brief is missing, unfilled, or declares a different mode than the registry;
  - a receipt is missing or names the wrong skill, a finding has no disposition, or anything not adopted has no reason;
  - diverge has fewer than two concepts; an adopted evidence lookup is never cited in the brief; the detector's JSON has a hit the receipt does not dispose of;
  - **no REVIEW finding was adopted in a commit that touches the surface** — the skills ran but changed nothing. Adopting a concept does not count; that is how every build starts;
  - **a surface commit lands after a review step and no receipt names it** (stale). The pre-build steps are exempt, since the build is their purpose;
  - a SHA is unquoted — 🪤 YAML reads `1836e72` as the float 1.836e+75 — or is not in the branch's history. **Merge a branch that carries receipts; never squash it.**
- **Token contrast** — `tests/design-tokens.test.ts` measures the sanctioned pairings from `app/globals.css`, and asserts muted-on-Vellum still fails so the rule is re-read if the palette moves.
- **Detector regression** — `tests/design-detector.test.ts` fails on any finding in `app/` or `components/` outside `.impeccable/baseline.json` (empty, 2026-09-18). impeccable's PostToolUse/Stop hooks still advise during edits.
- **Rendered** — `npm run test:ui` (`tests/ui/`, Playwright + axe, local stack, not part of `npm test`): WCAG 2.0–2.2 A/AA, no overflow at 360px, no reveal hidden without JS, on every public route (plus `/admin/login` and the 404) and every registered surface — **and the states a first render never shows**: `/portal/lookup`'s result and miss, and `/portal/attend`'s field errors, miss and both first-timer confirmations, reached against a short-lived local event. Each state test asserts it reached its state before axe runs. It reuses a running `npm run dev` (found through Next's `.next/dev/lock`) and never anything else on a port. Red on a `legacy` surface is expected; a `rebuilt` one must be green.

**What it cannot catch, stated so nobody assumes it does:**
- 🪤 The hook sees Edit/Write only; a shell edit is not intercepted. The receipts test is the backstop that cannot be walked around.
- A change to a shared primitive in `components/ui/` does not make any surface stale. It is reviewed by the gate of whatever surface it was made for, and seen by `test:ui` everywhere.
- Axe cannot judge hierarchy, clarity or taste. That is the design-reviewer's and the officer's job, and a green `test:ui` is not a design review.
- A receipt records a decision; it cannot prove the decision was good. The officer's gate still exists.

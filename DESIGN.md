---
name: Texas MISA
description: A navy-and-white institutional drawing set — square corners, hairline rules, and hatched volumes where photography has not been taken.
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
  poche-light: "#2c4b7c"
  poche-dark: "#26436f"
  caution: "#8a5a12"
  caution-wash: "#faf4e8"
  critical: "#8f2323"
  critical-wash: "#fbf0ef"
  affirm: "#1f5c34"
  affirm-wash: "#eff5f0"
typography:
  display:
    fontFamily: "Barlow Condensed, system-ui, sans-serif"
    fontSize: "clamp(44px, 5vw, 72px)"
    fontWeight: 600
    lineHeight: 0.96
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Barlow Condensed, system-ui, sans-serif"
    fontSize: "42px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.02em"
  headline-sm:
    fontFamily: "Barlow Condensed, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Barlow Condensed, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.015em"
  card-title:
    fontFamily: "Barlow Condensed, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.01em"
  card-title-sm:
    fontFamily: "Barlow Condensed, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.05
  body-large:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.65
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.14em"
  button:
    fontFamily: "Barlow Condensed, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.1em"
  nav:
    fontFamily: "Barlow Condensed, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.06em"
  caption:
    fontFamily: "ui-monospace, Menlo, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1
rounded:
  none: "0"
spacing:
  rule: "1px"
  tile-gap: "16px"
  card-gap: "20px"
  gutter-mobile: "20px"
  column-split: "48px"
  gutter: "56px"
  section-sm: "56px"
  section: "64px"
  section-lg: "80px"
easing:
  reveal: "cubic-bezier(0.2, 0.7, 0.3, 1)"
  out-quint: "cubic-bezier(0.23, 1, 0.32, 1)"
  in-out-quint: "cubic-bezier(0.77, 0, 0.175, 1)"
duration:
  press: "140ms"
  hover: "150ms"
  pop: "200ms"
  overlay: "260ms"
components:
  button-primary:
    backgroundColor: "{colors.drafting-navy}"
    textColor: "{colors.paper}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "14px 24px"
  button-primary-hover:
    backgroundColor: "{colors.pressed-navy}"
    textColor: "{colors.paper}"
  button-primary-sm:
    backgroundColor: "{colors.drafting-navy}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  button-outline-navy:
    backgroundColor: "transparent"
    textColor: "{colors.drafting-navy}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "14px 30px"
  button-outline-navy-hover:
    backgroundColor: "{colors.drafting-navy}"
    textColor: "{colors.paper}"
  button-on-navy:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.drafting-navy}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "14px 30px"
  button-outline-on-navy:
    backgroundColor: "transparent"
    textColor: "{colors.paper}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "16px 22px"
  chip-filter:
    backgroundColor: "transparent"
    textColor: "{colors.secondary-graphite}"
    rounded: "{rounded.none}"
    padding: "9px 18px"
  chip-filter-active:
    backgroundColor: "{colors.drafting-navy}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "9px 18px"
  chip-tag:
    backgroundColor: "{colors.vellum}"
    textColor: "{colors.secondary-graphite}"
    rounded: "{rounded.none}"
    padding: "5px 11px"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.secondary-graphite}"
    rounded: "{rounded.none}"
    padding: "26px 28px"
  input:
    backgroundColor: "{colors.vellum}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.none}"
    padding: "12px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.annotation-grey}"
    typography: "{typography.nav}"
  nav-item-active:
    textColor: "{colors.graphite}"
---

# Design System: Texas MISA

## Overview

**Creative North Star: "The Drawing Set"**

This is a set of construction documents, not a brochure. Every decorative
element in the system is borrowed from architectural drafting and does a
drafting job: the 60×60px grid laid over each navy hero is graph paper showing
through; the 45° 7px stripe fill is poché, the convention for marking a volume
that exists in the plan but has not been built; the mono captions under and
inside those volumes are drawing annotations; the 1px hairlines are rule
weights, not decoration. Corners are square because a drawing has none.

That metaphor is not applied to the system after the fact — it is the honest
description of what the system already had to become. The organization
publishes no photography, so eighteen gallery slots, four activity rows, three
project cards, thirteen officer headshots and the About cluster all render as
hatched boxes captioned with the shot that belongs there. A system that treated
those as missing assets would read as broken. A drawing set treats them as
specified-but-unbuilt, which is exactly true, and the caption is the
specification. **The hatch is not a missing photograph; it is the drawing of
one.**

The register that follows is institutional and unhurried: navy on white,
condensed uppercase for anything structural, Barlow at 1.65 line-height for
anything that has to be read at length, and hairlines instead of shadows to
separate one thing from the next. Density is generous rather than tight — a
56px page gutter and 64–80px section padding — because the pages are read once,
by a student deciding whether to show up, and comprehension outranks
information density everywhere except `/admin`.

**Key Characteristics:**

- Square corners everywhere — no radius token exists above `0`.
- Two grounds only: white and navy `#16305c`. Never a third, never a gradient.
- Hairline rules carry every separation; the system is flat at rest.
- Barlow Condensed for structure, Barlow for reading. Nothing else.
- Hatched, captioned placeholders wherever a photograph would go.
- Motion is entrance-only: reveal on scroll, two marquee tracks, no hover lift.

## Colors

A two-value palette — one navy, one white — with a graphite ramp for text and a
single light panel for alternation; the greys exist to keep the navy rare.

### Primary

- **Drafting Navy** (`#16305c`): the entire brand in one value. Hero fields,
  full-bleed section bands, primary button fills, eyebrow labels, KPI numerals,
  every link, and headings that sit on a white ground. It is the only saturated
  color in the system.
- **Pressed Navy** (`#0d1d38`): the far end of the navy ramp, and only that.
  Button hover and pressed fills, link hover. It never appears as a ground, a
  heading color, or a border.

### Neutral

- **Graphite** (`#1d1f20`): body headings and the active nav item. Not pure
  black — pure black is not in the system.
- **Body Graphite** (`#3a3d40`): long-form paragraphs, the mission text, FAQ
  and history prose.
- **Secondary Graphite** (`#4a4d50`): card body copy and unselected filter chip
  text. One step lighter than body because a card already has a frame doing
  some of the separating.
- **Annotation Grey** (`#6f7275`): meta labels, dates, venue lines, placeholder
  captions, inactive nav items, the footer email. Everything that annotates
  rather than states.
- **Vellum** (`#f2f2f3`): the alternating section ground, skill-chip fills, and
  form-field interiors. The system's only non-white ground on a light page.
- **Vellum Shade** (`#e7e7ea`): the second stripe of the light hatch. It exists
  for the hatch and nothing else.
- **Paper** (`#ffffff`): the default ground, and the text and button color on
  navy.
- **Hairline** (`rgba(29,31,32,.16)`): section rules, the header's bottom edge,
  the footer's top edge, and the 1px gaps in KPI and partner plates.
- **Frame** (`rgba(29,31,32,.2)`): the border around cards, image slots and
  hatched boxes. Marginally heavier than Hairline because it encloses rather
  than divides.

### Tertiary

- **Poché Light** (`#2c4b7c`) / **Poché Dark** (`#26436f`): the two stripes of
  the navy hatch, used only inside a placeholder box that sits on a navy
  ground. They are structural, not expressive; nothing else may use them.

### Status (added 2026-08-17)

Three earth inks and their washes. **They are not a second accent** — the Rare
Navy Rule is about expression and these are feedback.

- **Caution** (`#8a5a12`) on **Caution Wash** (`#faf4e8`): needs review,
  pending, unsaved, about to change data.
- **Critical** (`#8f2323`) on **Critical Wash** (`#fbf0ef`): failed, refused,
  destructive, voided.
- **Affirm** (`#1f5c34`) on **Affirm Wash** (`#eff5f0`): saved, approved,
  resolved.

📌 **They exist because the system already had three undocumented status
colours.** Roughly forty sites reached for raw Tailwind — `text-red-700`,
`border-amber-700`, `text-green-800` — so a palette that forbids a third colour
had acquired three, in whatever hue Tailwind happened to ship, differing between
`/admin` and `/lookup`. Naming them is what makes them governable.

⚠️ They are deliberately desaturated and dark. A drafting set annotates in red
pencil; it does not have a warning LED. Each is ≥4.5:1 on Paper and on its own
wash, so either may carry text.

**The tone lives in the rule and the ground, never in the sentence.** A status
panel is a 1px frame in the status colour over its wash, with the text left at
Body Graphite. Setting the whole message in the status colour reads acceptably
for one line and badly for four, and several of these panels carry a paragraph,
an amount and a link.

### Named Rules

**The Two Grounds Rule.** A surface is either white or Drafting Navy, and
everything on it moves together: on navy, the hatch is Poché, borders are
`rgba(255,255,255,.28–.45)`, paragraphs are `rgba(255,255,255,.8)`, eyebrows
are `rgba(255,255,255,.6–.7)`, and the section carries `.on-navy` so the focus
ring flips to white. Change the ground and you change all five — including the
section's own padding, since a navy band's inset was sized to a field that is
no longer there. Mixing a light hatch onto a navy ground, or a navy hatch onto
white, is always a bug.

**The Rare Navy Rule.** Navy is a ground or an accent, never a texture. On a
white page it appears in headings, eyebrows, links, KPI numerals and buttons —
and nowhere else. Its scarcity on the page is what makes a full-bleed navy band
land when one arrives.

**The Poché Rule.** The hatch means *specified, not yet built*. It is reserved
for image slots awaiting real photography and must never be used as decoration,
as a texture behind live content, or as an empty state for data.

## Typography

**Display Font:** Barlow Condensed (600 for everything structural, 500 for nav)
**Body Font:** Barlow (400 body, 500 for uppercase meta labels)
**Label/Mono Font:** `ui-monospace, Menlo` — placeholder captions only

**Character:** One superfamily, two widths. Barlow Condensed compresses
headlines so a 72px hero title fits on two lines without shouting, and its
uppercase letterspaced setting gives buttons, nav and chips a stamped,
institutional weight. Barlow at 1.65 does the reading. The two share skeletons,
so the pairing reads as one voice at two pressures rather than as a contrast
pairing. Italic exists exactly once on the site — the home page tagline — and
is loaded for that alone.

### Hierarchy

- **Display** (Barlow Condensed 600, 44px → 56px → 72px, .96, `-.02em`): the
  hero `h1` on all five designed pages. One per page, never elsewhere.
- **Headline** (Barlow Condensed 600, 30px mobile → 42px, 1, `-.02em`): section
  headings — "Our Mission", "Activities", "Our Amazing Partners". Navy on white
  grounds, white on navy.
- **Title** (Barlow Condensed 600, 34px, 1.02, `-.015em`): activity and case
  study row titles.
- **Card Title** (Barlow Condensed 600, 26px, 1.08, `-.01em`): project cards and
  FAQ questions. A 22px/1.05 step exists for officer names and event rows.
- **KPI Numeral** (Barlow Condensed 600, 34px, 1, navy): the plate figures on
  About and Projects.
- **Body Large** (Barlow 400, 18px, 1.65): page intros and hero subheads
  (20px). Max 74ch.
- **Body** (Barlow 400, 16px, 1.65 — 1.7 inside cards): paragraphs. Activity
  copy is capped at 46ch, case study copy at 48ch.
- **Body Small** (Barlow 400, 15px, 1.6): FAQ answers, card summaries.
- **Label** (Barlow 500, 12px, 1.2, `.14em`, uppercase): eyebrows, meta rows,
  KPI labels. An 11px/`.12em` step carries officer roles and semester tags.
- **Button** (Barlow Condensed 600, 13–15px, 1, `.08–.1em`, uppercase).
- **Nav** (Barlow Condensed 500, 13px, 1, `.06em`, uppercase).
- **Caption** (mono 400, 10–11px): the text inside a hatched box, and nothing
  else. Annotation Grey on light, `rgba(255,255,255,.65)` on navy.

### Named Rules

**The Two-Width Rule.** Barlow Condensed is for structure — headings, buttons,
nav, chips, KPI numerals, officer names. Barlow is for reading — every
paragraph, every label, every meta line. A condensed paragraph or a
non-condensed button is always wrong, and no third family is ever introduced.

**The Mono-Means-Placeholder Rule.** On the public pages, monospace appears in
exactly one context: the caption naming a shot that does not exist. Using it for
prose, data or timestamps there would make the placeholder convention
unreadable.

⚠️ **Scoped to the public pages, and the scoping was wrong when this rule was
first written.** `/admin` sets EIDs and error digests in monospace, and has
since Stage 4 — so the rule as originally stated described the five designed
pages while claiming to describe the system. It is kept for identifiers in
`/admin` on a functional argument rather than an aesthetic one: an EID is
transcribed by hand off a phone screen, and a monospace face is what separates
`l` from `1` and `0` from `O`. The two uses never meet, because `/admin`
renders no `<Hatch>` and the public pages render no identifiers. Monospace for
*prose*, or for a heading, remains wrong everywhere.

**The Tight-Top Rule.** Negative tracking (`-.01em` to `-.02em`) belongs to
large condensed type only; positive tracking (`.06em` to `.14em`) belongs to
small uppercase type only. Nothing in between is tracked at all.

## Layout

A single centered column with a **56px page gutter** (`sm:px-14`), stepping to
**20px** on phones (`px-5`). Sections are full-bleed and stack directly against
each other, separated by a hairline top border or a ground change rather than
by margin — vertical rhythm is section padding, typically 56–80px, and the
padding belongs to the section, not the gap.

Content maxima are per-role rather than global: the hero caps at 900px, the
Projects KPI plate and intro at 900px, prose at 46–74ch depending on column
width. There is no single container width the whole site shares.

Multi-column splits are asymmetric on purpose and stated as ratios: About's
mission cluster is `1.05fr .95fr`, its history row `.85fr 1.15fr`, and Projects'
"Work with MISA" band `1.2fr .8fr`, each with a 48px gap and `align-items:
stretch` so the framed image column and the text column end level. The home
page's mission/events split is two equal columns at 56px.

Grid gaps carry meaning: **1px** for plates (KPI, partners), **16px** for tile
and masonry grids, **20px** for card grids, **44–56px** for two-column splits.

**Responsive** behavior is this codebase's addition — the handoff prototypes are
desktop-only fixed layouts with no breakpoints authored. Every multi-column grid
collapses to one column (plates to two), the masonry drops 4 → 2 columns, the
hero steps 72 → 56 → 44px and section headings 42 → 30px. The nav switches at
`xl` (1280) rather than `lg`, because below that width the absolutely centered
wordmark and the two nav groups cannot coexist; underneath it, everything moves
into a stacked sheet.

### Named Rules

**The Hairline Grid Rule.** A plate is a grid with `gap: 1px` over a Hairline
*background*, with white cells. The background shows through the gaps, so one
shared rule reads between cells instead of two adjacent borders. Never build a
plate by giving each cell its own border.

**The Section Owns Its Padding Rule.** Space between sections comes from the
sections themselves, never from a margin between them — which is why removing a
band's navy ground also means resizing its padding. A ground change without a
padding change leaves the inset that belonged to a field that is gone.

**The Wordmark Clearance Rule.** The header wordmark is absolutely centered and
wins the z-order, so an overflowing nav item disappears behind it silently
instead of breaking the layout. Measured at 1280: 285px clearance left of the
wordmark, 312px right. Adding a nav item requires re-measuring both, at 1280 and
at a wide viewport.

## Elevation & Depth

The system is flat: no `box-shadow` anywhere, and depth is carried entirely by
the Hairline/Frame pair and by the white ↔ navy ground swap. A card is a white
rectangle with a 1px Frame border; a section is separated by a rule or by
becoming navy. Nothing floats.

**This is the default and the current state, not an invariant.** Flatness was
inherited from the handoff rather than chosen as doctrine, and adding depth
where a screen genuinely needs it — a dropdown, a modal, a sticky bar in
`/admin` — is a legitimate design decision, not a violation. Two constraints
bound that flexibility:

1. **Flatness is now this document's rule rather than the handoff's.** As of
   2026-08-17 the handoff is historical reference and DESIGN.md is the design
   authority for the public pages (see *Relationship to the design handoff*
   below), so adding depth is a decision recorded here — it no longer requires
   revising a document nobody edits.
2. **Introduce a shadow vocabulary before introducing a shadow.** One-off
   `shadow-md` on a single component is how a flat system stops being a system.
   If depth arrives, define its steps and their meaning here first.

Until then, prefer the two tools already in the system: change the ground, or
add a rule.

## Light only

There is no dark mode, and there will not be one until somebody argues for it
here first. This is a decision, not an omission:

- **The Two Grounds Rule is load-bearing.** Every hatch tone, border opacity,
  text opacity and focus-ring flip in this system is defined against *white or
  navy*. A dark ground is a third ground, and it does not simply invert — navy
  stops reading as an accent the moment the page around it is dark, which is the
  whole mechanism of the Rare Navy Rule.
- **The north star is ink on paper.** A drawing set is not lit from behind.
- The audience is a student deciding whether to show up, reading one page once,
  usually in daylight on a phone. Nobody is living in this interface at night.

⚠️ `design-taste-frontend` calls dark mode mandatory for consumer-facing pages
and will raise it again. It is refused here on the reasoning above (confirmed
with the officer, 2026-08-17), not overlooked.

## Shapes

**Every corner is square.** There is no radius scale — the frontmatter carries a
single `rounded.none: 0` because a token that is only ever zero should still be
named, so a future component asks for it explicitly rather than inventing one.

Form language is rectilinear and framed. Image slots are framed rectangles at
fixed ratios: 16:10 for activity and case-study rows, 3:2 for project cards,
1:1 for officer headshots and the About photo band, and free-height in the
gallery masonry, which is the one place that wants intrinsic heights. Borders
are 1px and only 1px; there is no 2px weight in the system.

Two clipped shapes exist, both CSS rather than assets so they scale:

- **The chevron notch** — `clip-path: polygon(0 0, 100% 0, 100% calc(100% -
  48px), 50% 100%, 0 calc(100% - 48px))`, cut from the bottom edge of every
  hero. It is the one form carried over from the previous site and is the
  system's single most recognizable silhouette.
- **The hero grid** — two 1px `linear-gradient` rules at
  `rgba(255,255,255,.06)`, tiled at 60×60px across the navy hero field.

### Named Rules

**The Square Corner Rule.** No radius, anywhere, on any element — buttons,
cards, inputs, chips, images, avatars.

**The drift this rule recorded is now corrected (2026-08-17).** `/admin` had
been shipping the pre-overhaul skin — `rounded-full` pill buttons (37 of them
across 26 files), `border-black/70` form fields, and a second "Stage 6
brutalist" dialect of `border-2 border-black` frames with `bg-black` fills —
because the identity swap moved the colour tokens without touching the admin's
form language. All three dialects now resolve to `components/ui/button.tsx`,
`field.tsx`, `panel.tsx` and `table.tsx`. There is one button vocabulary, one
control skin and one frame weight across both halves of the application.

⚠️ **One deliberate exemption, and it is not a corner.** `components/ui/
wordmark.tsx` draws the dot of its exclamation glyph with `rounded-full`. That
is a typographic mark — a full stop — not a UI element with a rounded corner,
and squaring it would make the wordmark wrong. It is the only `rounded-*` in
the codebase and it should stay the only one.

## Components

### Buttons

Stamped, not raised. Controls read as printed onto the surface rather than
sitting above it, and every state change is an ink change — the fill darkens,
the outline fills in — with nothing ever moving toward the reader.

- **Shape:** square (`0` radius), no shadow, uppercase Barlow Condensed 600
  with `.1em` tracking.
- **Primary (on white):** Drafting Navy fill, white text, `14px 24px`. Hover
  swaps the fill to Pressed Navy. A compact `8px 16px` / 13px variant carries
  the header's Check In.
- **Outline (on white):** 1px Drafting Navy border, navy text, `14px 30px`.
  Hover *fills* navy and flips the text white — the outline is not tinted, it is
  completed.
- **Primary (on navy):** white fill, navy text, `14px 30px`; hover drops the
  fill to 85% white.
- **Outline (on navy):** `rgba(255,255,255,.45)` border, white text, `16px
  22px`; hover fills white with navy text.
- **Focus:** a 2px Drafting Navy outline at 2px offset on every interactive
  element, flipped to white inside `.on-navy`. This is the codebase's addition —
  the prototypes define no focus state at all.
- **Eyebrow link:** the `See all photos →` / `All projects →` section links —
  13px condensed 600, `.08em`, uppercase, navy on white and white on navy. Not a
  button; no fill, no border.

### Chips

- **Filter chip (Gallery):** unselected is a 1px Frame border with Secondary
  Graphite text; hover turns border *and* text navy. Selected is a solid
  Drafting Navy fill with white text — the same stamped logic as the buttons.
  `9px 18px`, 13px condensed 600, `.1em`, uppercase, `aria-pressed` carries the
  state.
- **Tag chip (Projects skills):** Vellum fill, no border, 12px uppercase,
  `5px 11px`. Static — it labels, it doesn't act.
- **Semester tag:** 1px `rgba(22,48,92,.35)` border, navy 11px uppercase,
  `4px 9px`.

### Cards / Containers

- **Corner style:** square.
- **Background:** Paper on white sections; on navy bands a card is transparent
  with a `rgba(255,255,255,.3)` border.
- **Shadow strategy:** none — see Elevation & Depth.
- **Border:** 1px Frame (`rgba(29,31,32,.2)`).
- **Internal padding:** 22–40px depending on scale; FAQ cards sit at `26px 28px`,
  the About mission card at `40px 44px`, project cards at `18px 20px` under a
  full-bleed image.
- Cards that sit in a row are `display: flex; flex-direction: column` with the
  trailing link at `margin-top: auto`, so links align across a row regardless of
  how many lines a title wraps to.

### Inputs / Fields

Currently the admin-only surface, and the least resolved part of the system.

- **Style:** Vellum fill, 1px border, square, `12px` padding, 16px Barlow.
- **Focus:** the global 2px navy `:focus-visible` ring at 2px offset.
- **Error:** the message sits under the field in 12px, with `aria-invalid` on
  the control and `role="alert"` on the text. Form-level errors render as a
  Vellum panel with a 4px navy left border.
- **Drift:** the shipped fields use `border-black/70`, which is heavier than the
  Frame weight the rest of the system uses. New work should use Frame.

### Navigation

- **Header:** 60px tall, white, sticky, 1px Hairline bottom border. Three zones
  — a five-item left nav (About · Projects · Gallery · Officers · Admin), an
  absolutely centered wordmark, and a right group of two member links plus the
  navy Check In button.
- **Item states:** inactive is Annotation Grey and darkens to Graphite on hover;
  active is Graphite with a 1px Drafting Navy bottom border at 2px padding, plus
  `aria-current="page"`. The home page deliberately has no active item.
- **Mobile:** below `xl` (1280) both nav groups collapse into a stacked sheet
  under the header, which has no wordmark to clear and therefore carries one
  extra item (Contact) that the desktop nav has no room for.
- **Footer:** 1px Hairline top border, `space-between` — a 22px-gap row of
  About · LinkedIn · LinkTree · Instagram · Slack in navy 13px on the left, the
  contact email in Annotation Grey on the right.

### The Hatch (signature component)

The system's defining component: a 45° `repeating-linear-gradient` at 7px
stripes, filling a framed rectangle, with a mono caption centered inside it
naming the shot that belongs there. Two tones that are never mixed — Vellum /
Vellum Shade on white grounds, Poché Light / Poché Dark on navy — and the
caption color follows the tone.

It appears in every image position on the site: marquee tiles, the About
cluster and photo band, the gallery feature and masonry, project cards, activity
rows, officer headshots. A labelled box reads as a commission; an empty frame
reads as a bug. That is the whole argument for it.

### The Wordmark

Drawn in CSS, not an asset: lowercase "misa" in Barlow 600 24px at `-.02em`,
with a hand-built exclamation glyph overlaying the second stem (an absolutely
positioned column at `left: 1.72em; top: -.3em` holding a `.16em` circle above a
`.05em × .14em` bar), and "TEXAS" beneath in Barlow 500 8px at `.42em` tracking
with matching `text-indent` so it optically centers. It renders in
`currentColor`, so the same component works navy on white and white on navy.

### Motion

Entrance-only, and always through one of two house patterns.

- **Scroll reveal:** elements carry `data-reveal` and start hidden,
  transitioning to rest — opacity on `ease`, everything else on
  `{easing.reveal}`. Sibling groups stagger in .04–.06s steps via
  `--reveal-delay`. The hidden state is scoped to `html.js`, a class set by an
  inline script during HTML parsing, so a visitor without JavaScript is never
  shown a blank page.

  **There are five entrances, and the variant is chosen by what the element is
  rather than by where it sits** (2026-08-17). One identical entrance on every
  element is not an authored moment; it is a page-wide effect, and it read as
  one.

  | Variant | Start state | For |
  |---|---|---|
  | `rise` | `translateY(32px)`, .9s | A section's lead element. **At most one per section** — this is the moment. |
  | `up` | `translateY(18px)`, .7s | Ordinary blocks following a lead. |
  | `left` / `right` | `translateX(∓24px)`, .8s | The alternating two-column rows, entering from their own side. |
  | `fade` | opacity only, .6s | Dense content — tables, standings, card grids. A row that slides is a row the reader waits for. |
  | `wipe` | `clip-path: inset(0 100% 0 0)`, .8s | Hairline rules and plates, drawn on rather than moved in. |

  🪤 **The lateral travel is desktop-only.** Below `md`, `left` and `right` fall
  back to `up`. Inside the 20px phone gutter a 24px X-offset put the element 4px
  past the viewport, so every un-revealed row widened the document and a phone
  got a horizontal scrollbar that vanished as the reader scrolled past —
  measured at 390px as `scrollWidth` 379 against `clientWidth` 375. It is also
  right compositionally: those rows are a single column on a phone, so there is
  no "own side" to enter from.

  🪤 **Never put `data-reveal` on a node that mounts after first paint.** The
  observer scans once per pathname, so anything appended by a state change — a
  Load-more tile, a check-in result panel — is never observed, and its
  unconditional `opacity: 0` becomes permanent. The two places this would bite
  carry comments saying so.
- **Marquee:** two opposed tracks on the home page gallery band, 38s left and
  46s right, linear and infinite. The translate distance is one group width **in
  pixels** (`--marquee-shift`), measured by the component, and enough copies are
  rendered to cover the viewport. No pause on hover — the tracks are full-width,
  so a resting mouse froze a row and read as breakage.
- `prefers-reduced-motion: reduce` disables both, and content renders at rest.

## Do's and Don'ts

### Do:

- **Do** keep every corner square (`0` radius) on every element, `/admin`
  included. The one exemption is the wordmark's exclamation dot, which is a
  typographic mark rather than a corner.
- **Do** reach for `components/ui/` before writing a class string. Button,
  field, table, panel, banner, pill, chip, section and heading all exist; the
  reason the admin drifted for four stages is that they did not.
- **Do** move the whole set together when a section changes ground: hatch tone,
  border color, text opacities, the `.on-navy` focus flip, **and the padding**.
- **Do** build plates as `gap: 1px` grids over a Hairline background with white
  cells, so one shared rule reads between them.
- **Do** put every global CSS rule inside a Tailwind cascade layer — `base` for
  element defaults, `components` for decorative classes. An unlayered rule beats
  every layered utility regardless of specificity, which is how a bare
  `a { color }` once rendered navy text on a navy button.
- **Do** give every interactive element a visible `:focus-visible` ring (2px
  navy, 2px offset; white inside `.on-navy`). The prototypes define none — this
  system adds them.
- **Do** cap prose by role: 46ch in activity rows, 48ch in case studies, 74ch in
  page intros.
- **Do** re-measure wordmark clearance at 1280 and at a wide viewport before
  adding a nav item.
- **Do** state a translate distance in pixels when a track's copy count can
  change; a percentage silently couples the distance to the number of copies.

### Don't:

- **Don't** add photography, stock imagery, or generated imagery to any image
  slot. The site publishes none — every slot is a captioned `<Hatch>`, and
  `public/photos/` was deleted rather than unlinked. Restoring a photo is a
  deliberate three-part change (add the file, give the slot a `src`, swap the
  `<Hatch>` for an `<Image>` sized with `fill`), never a design proposal.
- **Don't** use the hatch as texture, decoration, or a data empty state. It
  means *specified, not yet built*, and nothing else.
- **Don't** mix hatch tones against their ground — light hatch on navy, or navy
  hatch on white, is always wrong.
- **Don't** introduce a third font family, set a paragraph in Barlow Condensed,
  or set a button in Barlow.
- **Don't** add a one-off `box-shadow`. If a surface genuinely needs depth,
  define the vocabulary here first.
- **Don't** introduce a second accent color, a gradient, or a tint of navy other
  than Pressed Navy for hover. Poché belongs to the hatch alone, and the three
  status inks are feedback rather than accents.
- **Don't** reach for raw Tailwind colour scales (`red-700`, `amber-700`,
  `green-800`). If it is feedback, it is Caution / Critical / Affirm; if it is
  anything else, it is on the navy-and-graphite ramp.
- **Don't** animate on hover with a lift, a scale on a control, or a shadow.
  Hover is an ink change; motion is entrance-only. `:active` may darken; it may
  not move.
- **Don't** use monospace for prose, headings, or anything on the public pages
  except a placeholder caption. Identifiers in `/admin` are the scoped
  exception.
- **Don't** add a dark mode without arguing it into the *Light only* section
  first.

## Relationship to the design handoff

**As of 2026-08-17 this document is the design authority for the whole site,
and `docs/Texas MISA website UI mockups/` is historical reference.**

The handoff earned that position and then outgrew it. It is five desktop-only
`.dc.html` prototypes with no breakpoints authored, no focus states, no hover
states on nav items or buttons, no empty states, no error states, and no
coverage at all of `/admin`, `/attend`, `/leaderboard` or `/lookup` — which is
most of the application. Its own README says mobile is undesigned and asks for
the missing states to be added. Holding it as the source of truth meant the
majority of the interface had no source of truth at all.

What that changes, and what it does not:

- **Kept, and not up for renegotiation:** the palette, the Barlow pair, square
  corners, hairlines, the chevron hero, the 60×60 grid, the marquee geometry,
  the `<Hatch>` convention, and the no-photography decision.
- **Now owned here:** composition and section rhythm, the spacing scale, the
  state vocabulary (hover, focus, active, disabled, loading, empty, error), the
  status palette, responsive behaviour, and every surface the prototypes never
  drew.
- **Still true of the prototypes:** they remain the best record of the intended
  *identity*, and the image-treatment spec (duotone, and its two exemptions)
  lives only in their README. Read them before changing anything in the first
  list.

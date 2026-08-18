# Frontend redesign v2 — plan

**Status: NOT BUILT.** Written 2026-08-17, after v1 was built and scrapped.
Supersedes [`frontend-redesign-plan.md`](frontend-redesign-plan.md) wherever the
two disagree; that document's decision table is partly reversed below.

The v1 attempt lives on the abandoned branch `redesign-stage-1` (four commits,
tip `60ca71d`). `main` was never touched. Read that branch for what not to do
again; nothing from it is being carried forward.

---

## Why v1 was scrapped

The officer's verdict, verbatim: *"the redesign is bland and lacks depth. there
should be many placeholders for images, not just in one section. the layout and
spacing is very scattered and same-ey. the lines separating sections are
scattered."*

All four are accurate, and each maps onto a rule in `design-taste-frontend` that
v1 either did not read or read too late:

| Defect | The rule that names it |
|---|---|
| Bland, lacks depth | §4.4 Materiality. v1 shipped zero elevation and called it identity. §4.8: a text-only page "is not minimalism. It is incomplete work." |
| One image section | §4.8 Image Strategy. v1 *concentrated* every slot into one band, which was exactly backwards. |
| Scattered, same-ey | §4.7 Section-Layout-Repetition Ban: a layout family may appear **at most once**, and 8 sections need **≥4 different families**. v1 reused two. |
| Scattered section rules | §4.4: group with `border-t` **or** `divide-y` **or** negative space. v1 mixed all three. |

**The root cause is a process failure, not a taste failure.** v1 treated the
installed skills as advisory and hand-rolled everything. §2 is explicit: *"Do not
invent CSS for things that have an official package."* v1 invented all of it.

---

## What this reverses

| # | Was | Now |
|---|---|---|
| Skill precedence | "No aesthetic skill is primary anywhere" (`CLAUDE.md`) | 🔓 **`design-taste-frontend` is PRIMARY** for the public visual UI. Amend `CLAUDE.md` in the first commit. |
| 1 | Keep Barlow + Barlow Condensed | 🔓 **Open.** Type is a v2 decision, reviewed before it ships. |
| 7 | The frozen four inherit the skin | 🔓 **Reversed.** `/attend`, `/leaderboard`, `/lookup`, `/admin` are full visual redesigns. |
| Flatness | "no `box-shadow` anywhere" (`DESIGN.md`) | 🔓 **An elevation vocabulary is introduced**, which is what `DESIGN.md` itself asks for before any shadow ships. |
| Image slots | Concentrated into one plate section (a v1 decision) | 🔓 **Reversed. Many slots, in every section.** |
| The Annual Report direction | Locked, seed `5b321c13` | **Dropped with v1.** v2 takes its direction from the skill, not from a concept roll. |

**Unchanged and non-negotiable:** the word content, verbatim, from `lib/site.ts`
and `lib/officers.ts`; the navy `#16305c` and white **colour scheme**; no
photography.

🔓 **"Colour scheme" is not "flat white ground."** Clarified with the officer on
2026-08-17: the *palette* is locked, the *grounds* are not. Gradients, tinted
fields, shapes, and drawn backgrounds are all in play as long as they are built
from navy and white. This loosens `DESIGN.md`'s Two Grounds Rule, which reads
"two grounds only … never a third, never a gradient" — that clause is retired for
v2 and its replacement is argued at phase 5. A plain white page behind everything
is a large part of why v1 read as bland.

---

## `DESIGN.md` is retired for v2, except one set

🔓 **Officer decision, 2026-08-17: every aesthetic rule in `DESIGN.md` is open.**
The Two Grounds Rule, the Rare Navy Rule, the Poché Rule, the Two-Width Rule, the
Mono-Means-Placeholder Rule, the Tight-Top Rule, the Square Corner Rule, the
Wordmark Clearance Rule, the flatness, the light-only decision, the fixed image
ratios, the 1px-only border weight, the one-Display-per-page rule, the ban on a
second accent or a tint of navy, and the ban on hover motion are **all retired
for the duration of v2**. The frontmatter tokens are not binding either.

📌 **Why wholesale rather than rule by rule:** v1 relaxed constraints one at a
time and ended up half-committed, which is most of what "bland" described. A new
`DESIGN.md` is written at phase 5 from what actually ships.

⚠️ Two of these were already blocking things the officer has asked for, which is
how the decision surfaced: **"Don't animate on hover with a lift, a scale on a
control, or a shadow"** forbids the floating-card hover-enlarge, and **"Don't
introduce … a tint of navy other than Pressed Navy"** forbids a navy-to-navy
gradient.

### The engineering set, which still binds

These read as design rules and are not. Each prevents a specific failure this
codebase has already shipped, and each is stated as its **principle** rather than
its current implementation, because v2 may not keep the implementation.

1. **A focus ring must be visible on every ground it can land on.** Today that is
   the `.on-navy` flip to white; a navy ring on a navy field is invisible. Any
   new ground needs its own answer in the same commit.
2. **Space between sections belongs to the sections, never to a margin between
   them.** Removing a band's ground once left 112px of dead air behind because
   the padding had been sized for a field that was gone.
3. **A shared-rule plate is one background showing through `gap: 1px`, never a
   border per cell.** Two adjacent borders read as a double rule.
4. **Contrast is measured per pairing, on the ground the text actually sits on,
   compositing any alpha.** Annotation Grey passed everywhere until the day a
   field's ground changed under it; v1's nav numeral measured 3.35:1 this way.
5. **Identifiers in `/admin` are monospace.** An EID is transcribed by hand off a
   phone screen, and monospace is what separates `l` from `1` and `0` from `O`.
6. **Feedback colours are named, never raw framework scales.** Reaching for
   `red-700` at ~40 sites is how a palette that forbade a third colour quietly
   acquired three, in whatever hue the framework shipped.
7. **No photography.** This is `PRODUCT.md`, not `DESIGN.md` — the organization
   has not taken the photographs. Slots stay slots.

The markup-level invariants under *What must not regress* below bind equally and
are a separate list.

---

## Skill routing

`design-taste-frontend` is primary. The others serve it:

| Skill | Role | Wins on |
|---|---|---|
| **`design-taste-frontend`** | **Primary.** Dials, design-system choice, layout families, image strategy, §14 pre-flight gate | Everything not listed below |
| `emil-design-eng` | Motion decisions | Easing, duration, whether to animate at all |
| `web-design-guidelines` | Pre-ship review | Accessibility and interaction, over aesthetics |
| `impeccable` | `craft-floor` mechanics, `critique`/`audit` self-review | Nothing by default; it no longer sets direction |

⚠️ **The project Invariants still outrank all four**, without exception. Where a
skill and an invariant collide, the collision is resolved in this document with a
reason, never silently.

---

## Foundation and packages

Per §2.A and Appendix A. **Verify `package.json` before every install (§3.F).**
Current state: no component library, no animation library, no icon library.

```bash
npx shadcn@latest init -d -y    # §2.A: "modern SaaS where you own the components"
npm install motion              # §3.A: import from "motion/react"
```

✅ **Phase 0 ran these on 2026-08-17.** What it actually took:

🪤 **`shadcn init` is destructive here, and must never be run unsupervised
again.** It **overwrote `components/ui/button.tsx`** — the project's
`buttonClass` module, imported by **45 files** — with its own Button. It also
deleted `--background` and `--foreground` from `globals.css`, left a dangling
comment where they had been, flattened its additions onto one line, injected
Geist into `layout.tsx`, and wrote `--font-sans: var(--font-sans)` into
`@theme inline`, a circular definition that resolves to nothing.

The recovery, and the standing procedure if it is ever re-run: keep
`components.json`, `lib/utils.ts` and the `package.json` dependencies; **revert
everything else** and hand-apply the CSS. `components.json`'s `ui` alias now
points at **`components/shadcn/`**, so a future `add` cannot collide with this
project's own `components/ui/` again.

🔓 **The icon family is Lucide, not Phosphor.** shadcn's presets and its
components' internals are Lucide, and §3.C bans mixing families while permitting
Lucide "when the project already depends on it" — which adopting shadcn makes
true. Stripping Lucide out of every generated component would be friction for no
gain.

- **shadcn/ui** — chosen because the stack is already Next 16 + Tailwind v4 +
  RSC, and because owning the code is what lets it be re-skinned to navy/white
  without fighting a vendor theme. 🔴 **§9.E: never ship it in default state.**
  Radius, colour, shadow and type all move to this project's system on install.
- **motion** — `motion/react`. ⚠️ §3.A: any component using it is an isolated
  leaf with `"use client"`. Server Components stay server components.
- **Phosphor** — one icon family for the whole project, one `strokeWidth`.
  Retires the hand-rolled hamburger SVG, which §3.C bans.

**One system per project.** No mixing shadcn with Radix Themes or Material.

---

## References, pulled from online

Appendix B is a list of canonical sources. Fetch these at build time rather than
working from memory:

- **shadcn/ui** — <https://ui.shadcn.com/docs>, and the component pages for each
  primitive actually used.
- **Tailwind v4** — <https://tailwindcss.com/blog/tailwindcss-v4> for the theme
  and `@theme` semantics this project already depends on.
- **Radix** — <https://www.radix-ui.com/themes/docs/components/theme> for the
  primitives shadcn wraps.
- **Native CSS** — MDN on `backdrop-filter`, `prefers-reduced-motion`, CSS Grid,
  and **scroll-driven animations**; plus <https://drafts.csswg.org/scroll-animations-1/>.

§10's **Reference Vocabulary** is the pattern language for the layout-family
budget below: Asymmetric Split Hero, Editorial Manifesto Hero, Bento Grid,
Masonry, Split-Screen Scroll, Sticky-Stack Sections, Kinetic Marquee, and the
rest. Name the family being used in each section's code comment.

---

## Dials (§1)

Mode is **Redesign–Overhaul** (§11.A): greenfield visuals, preserved content and
IA. §1.A gives overhaul `+2 / +2 / match`. The incumbent site reads as
`VARIANCE 5 / MOTION 3 / DENSITY 3`.

**`DESIGN_VARIANCE: 8` · `MOTION_INTENSITY: 5` · `VISUAL_DENSITY: 5`**

- Variance goes to 8, not 7, because "bland" is the headline complaint and §4.3's
  anti-centre bias binds above 4: centred hero sections are out.
- Motion 5 rather than 6 because `emil-design-eng` owns motion and the audience
  is a student on a phone on campus wifi. ⚠️ §14: if `MOTION_INTENSITY > 4` the
  page must actually animate, not merely claim to.
- Density 5 because v1's real gain was density and it should not be given back.

---

## The four defects, and what fixes each

### 1. Depth — an elevation vocabulary

Named steps, defined before any shadow is used, with a stated meaning each.
§4.4: **shadows are tinted to the background hue; no pure black on light.** With
a navy-and-white palette that means navy-tinted shadow, never `rgba(0,0,0,…)`.

Depth also comes from things that are not shadows and should be used first:
overlap, scale contrast, full-bleed fields against contained ones, and the
white ↔ navy ground swap the system already has.

### 2. Image slots everywhere

🔴 **This is the reversal that matters most.** §4.8's priority order is
image-gen, then real web images, then — the path this project is on — *"leave
clearly-labeled placeholder slots and at the end say: this page needs real images
at \[list\]."* That third path is sanctioned by the skill and is what the officer
asked for.

So: **every section carries image slots**, sized and captioned with the shot that
belongs there. Not one plate section. The handback list of needed photography is
a deliverable of each phase.

⚠️ Still binding: no stock imagery, no generated imagery, no gradient standing in
for a photo. **`picsum.photos` is refused here** despite §4.8 naming it, because
`PRODUCT.md` forbids imagery the organization has not taken. Slots stay slots.

### 3. Layout families — a budget, not a habit

§4.7: a layout family appears **at most once**; 8 sections need **≥4 families**;
**max 2 consecutive** image+text splits. Each section declares its family from
§10's vocabulary in a code comment, and the count is checked mechanically before
each review gate.

⚠️ §4.7 also bans the **split-header** pattern (big headline left, small
explainer right) as a default — which is precisely what v1's `DocSection` was.
Do not rebuild it.

### 4. One grouping mechanism per section

§4.4: `border-t` **or** `divide-y` **or** negative space. Pick one per section
and do not mix. §9.F additionally bans `border-t` + `border-b` on every row of a
long list. This is the fix for "the lines separating sections are scattered."

Plus the **Shape Consistency Lock** (§4.4): one corner-radius scale for the whole
page. The incumbent is all-sharp at radius 0; if v2 keeps that, shadcn's defaults
must be overridden everywhere, and if it changes, it changes everywhere.

---

## The plan stays open to new components

📌 **This document is a direction, not a fixed component list.** The officer's
standing instruction is that v2 should be able to absorb ideas like the one
below as they arrive, rather than treating the plan as closed. New patterns are
proposed, reviewed, and folded in.

### Floating image cards (officer reference, 2026-08-17, not binding)

A landing page the officer shared as *"a possible component, not a binding
reference"*: captioned image cards scattered around the hero at slight
rotations, each lifted off the page with a shadow, enlarging slightly on hover,
over a background carrying a soft radial field rather than flat white.

**Why it earns a place here rather than being a borrowed look:** this site has
more image slots than content, and its central problem is that empty slots read
as unfinished. A scattered arrangement of captioned frames turns "we have not
photographed this yet" into a deliberate composition. It is also §10's
vocabulary already: cards with a hover-scale, over a **Mesh/Radial Gradient
Background**.

What to take, and what not to:

- **Take:** the floating, rotated, captioned frame; the slight hover scale; the
  non-flat ground behind it; the idea that image slots can be the composition
  rather than holes in it.
- **Do not take the reference's skin.** It is rounded-corner, hard-shadowed, and
  lime-accented. Radius is governed by the **Shape Consistency Lock** and the
  accent is navy. ⚠️ `craft-floor` refuses hard offset shadows outside a world
  that is genuinely neobrutalist, and §4.4 requires shadows **tinted to the
  background hue** — so these lift on a navy-tinted, blurred shadow, not a black
  block offset.
- ⚠️ **A rotated card is a horizontal-overflow risk**, and v1 already shipped one
  of those. Any rotation is measured at 390px before it lands.
- **`emil-design-eng` owns the hover.** Whether it scales, how far, and on what
  curve is its call, and `prefers-reduced-motion` disables it.

---

## Open conflicts, for the officer

Recorded rather than settled, because each trades a skill rule against a project
invariant:

1. **§4.11 Page Theme Lock vs. the Two Grounds Rule.** §4.11 bans a section
   flipping to inverted mid-page; this system's identity is a full-bleed navy
   band among white ones. **Recommendation: keep the navy band, refuse §4.11**,
   and record it — the navy field is the identity, and §4.11 exists to stop
   accidental theme drift rather than deliberate two-ground systems.
2. **§9.G em-dash ban vs. the org's tagline.** Already refused on record in
   `CLAUDE.md`: the ban would reject *"— Where Analytics, Innovation, and
   Leadership Converge —"*, which is real copy the officer has locked. Stays
   refused.
3. **§8 dark mode.** Refused on record in `DESIGN.md`, *Light only*. Unchanged.
4. **§4.8 "hero needs a real visual."** Cannot be satisfied. The hero gets a
   labelled slot and goes on the handback list.

---

## Phases

Each ends at a review gate. **Nothing proceeds past a gate without the officer.**

| Phase | Scope |
|---|---|
| **0** | Amend `CLAUDE.md` precedence. Install the three packages. Re-skin shadcn out of default state. Define the elevation vocabulary and the radius scale. Read §0, §4, §5, §10, §12 in full. |
| **1** | ✅ **BUILT, at the GATE.** Home page + header. Record below. |
| **2** | `/about`, `/projects`, `/gallery`, `/officers`, `/contact`, error and not-found boundaries |
| **3** | `/attend`, `/leaderboard`, `/lookup` — visual only, behaviour untouched |
| **4** | `/admin` under scanability rules, screen by screen, suite green between screens |
| **5** | Replace `DESIGN.md` from the built result; update `docs/invariants.md` for every invariant retired, each with its replacement argued; record in `build-log.md` and `tasks.md` |

📌 **Do not pre-suppress detector findings.** v1 added ten `design-system-font-size`
ignores to `.impeccable/config.json` as it went; that set died with the branch and
must not be recreated up front. The type ramp is being re-authored, so every
off-ramp size is a finding worth *seeing* during the rebuild. Suppress at phase 5,
against the ramp that actually ships, or not at all.

⚠️ There is **pre-existing drift on `main`** the detector will report from the
first scan, and it is not v2's doing: `app/(public)/_components/upcoming-events.tsx:87`
sets `text-[21px]`, which is off the documented ramp today. Leave findings like
this standing until the section that owns them is rebuilt.

---

## Phase 1 record (2026-08-17) — home page + header

Built, measured, and waiting on the officer. Six files; `app/actions/`, `supabase/`
and `proxy.ts` untouched, and the only `lib/` change is 29 lines of slot captions.

**Officer decisions taken at the start of the phase:** keep **Barlow + Barlow
Condensed** (retune the ramp only); stay **all-sharp at `--radius: 0`**; and build
the hero as an **Asymmetric Split with floating captioned plates** over a navy
radial field, taking the reference's floating frame, hover lift and non-flat
ground while refusing its radius, its hard block shadow and its accent.

### The layout-family budget

| # | Section | Family | Ground | Slots | Grouping |
|---|---|---|---|---|---|
| 1 | Hero | Asymmetric Split Hero + plate cluster | `field` | 4 | negative space |
| 2 | Gallery band | Kinetic Marquee (the only one) | white | ~11/group | negative space |
| 3 | Mission | Editorial Manifesto | `paper` | 2 | negative space |
| 4 | Activities | Bento Grid, 4 cells / 4 items | white | 4 | gap |
| 5 | Projects | Quadrant grid (2×2) | `field` | 4 | one plate through `gap: 1px` |
| 6 | Partners | Shared-rule logo plate | `paper` | 0 (4 real logos) | one plate through `gap: 1px` |

⚠️ **Sections 5 and 6 are the closest two families come to each other**, and it is
worth stating rather than hoping nobody notices: both are four cells on a
shared-rule plate. They stay distinguishable — one is a 2×2 of image-and-text
cards, the other a single row of bare logos — but the budget has less slack than
it did, and **a third shared-rule plate would break it.**

**Six sections, six families, none repeated.** Longest consecutive-split run is 1
against a cap of 2. Eyebrows above section headlines: **0**, against a budget of
`ceil(6/3) = 2`; the crude `uppercase tracking` grep finds one hit, the per-card
`term` label, which is card metadata rather than a section eyebrow.

### What the diagnosis actually was

Three of the six sections failed a *named* rule before anything was designed: a
centred hero at VARIANCE 8 (§4.3), Activities as **four consecutive** image+text
rows against §4.7's cap of two with `border-t` + `last:border-b` on every row
(§9.F), and Projects as **three equal cards** (§9.C). "Scattered and same-ey" was
countable, not vague.

### Iteration 1 (2026-08-17, officer review of the built page)

Four notes, all addressed.

- 🔓 **"Add more of that depth to the rest of the page."** The hero's field and
  grid were the parts that read well, so both were generalised: `.ground-paper`
  is the light counterpart of `.ground-field` (Vellum glowing off the top edge,
  clearing to Paper) and `.paper-grid` is `.hero-grid`'s 60px rhythm in navy at
  low alpha, since the white version is invisible on anything but navy. Grounds
  now run **field → white → paper → white → field → paper**, so no section is a
  flat rectangle except the two that are deliberately a rest.
  - 🪤 **`.ground-paper` and `.paper-grid` cannot both sit on one element.** Both
    set `background-image`, so stacking them is not two layers, it is a
    collision, and the later rule in the cascade erases the earlier one — you
    silently get the grid with no gradient. The grid is an absolute overlay, the
    way the hero already did it.
- 🪤 **"The photos that can be hovered over just shift slightly instead of
  expanding."** Correct, and the gesture was wrong: a 4px translate reads as a
  twitch. Plates now `translateY(-8px) scale(1.045)` on `--dur-pop` (200ms, since
  150ms is a colour-swap duration and reads clipped on something that changes
  size). ⚠️ Transform functions apply **right to left**, so `rotate` must come
  last or the plate slides along its own tilted axis. And `hover:z-40` belongs on
  the absolutely-positioned **wrapper**, not on `.plate` — a z-index on the
  statically-positioned inner element does nothing, and the enlarging plate grows
  *underneath* its neighbours.
- 🪤 **"Make the corners/borders of the pictures at the top consistent."** They
  genuinely were not, and the cause is worth keeping: `--misa-border` is an
  **alpha** colour. The hero's plates cross two backdrops — each other and the
  navy field — so one border resolved to a clear grey hairline over a plate and
  to nothing at all over the field. `--misa-plate-edge` is that same colour
  resolved once (`#bfbfc2`, exactly `rgba(29,31,32,.2)` over the light hatch), so
  it holds whatever passes beneath. Every `.plate` on the page now uses it.
- 🔓 **Projects became a symmetric 2×2** (was one wide lead plus two). The fourth
  cell is `PROJECT_PLACEHOLDER`, on the officer's instruction to use a
  placeholder for now: it names no client, term or scope, because a plausible
  fourth client is **inventing a fact about the club** and is the one error here
  nobody would ever catch. Replacing it is adding a fourth entry to `PROJECTS`
  and deleting the constant; the band renders whatever the array holds.
  - 🪤 `auto-rows-fr` is what makes "symmetric" true at every width. Grid rows
    size independently, so at 768 the summaries wrapped to different line counts
    and the top row came out 22px taller than the bottom — left/right symmetry
    held and the quadrant still read lopsided.

**Re-measured after the iteration:** overflow 0 at 390/640/768/1024/1280/1646,
hero 716/533/576/628/668/668, headline 2 lines everywhere, header 61px, nav one
line, clearance unchanged at 277/304 and 461/487, **0 of 21 reveals hidden with
JS off**, all four project cells uniform at every width. Lint, `tsc`, build clean;
**1022 tests pass**.

### Iteration 2 (2026-08-18, officer review)

- **Depth on light grounds is a raised sheet, not a drawn grid.** `.paper-grid`
  is deleted. `.sheet` is a white surface, hairlined and lifted off the tinted
  `paper` ground — stacked planes rather than a picture of depth, and the same
  mechanism the bento cards and image plates already used. 🪤 It needs a
  non-white ground beneath it or it is an invisible rectangle wearing a shadow.
- **No hover state on any plate or card.** The reason it was wrong is that none
  of them is interactive: `<div>`s and `<article>`s with nothing to click were
  advertising an affordance that does not exist. ⚠️ `--shadow-raised` is unused
  as a result; it stays in the vocabulary as the named answer for the first real
  interactive surface, in phases 3–4.
- 🔓 **A second radius, documented.** `--radius-plate: 4px` on floating plates
  and sheets; `--radius: 0` everywhere else, including any cell whose corner is
  a 1px seam. This is the Shape Consistency Lock's permitted mixed system and
  the sentence above is the entire rule. 🪤 It needs `overflow: hidden`, or
  `Hatch`'s hard-edged gradient squares the corners back off.
- 🔓 **The hero cluster is a uniform, larger 2×2**, replacing four aspect ratios
  at four widths in an absolute scatter. Tilt is 0: at ±1.5° in a tight grid two
  plates leaning opposite ways make the gap between them a wedge, so
  "hand-placed" read as "misaligned". `--plate-tilt` is kept, so it is one value
  to bring back.
- 🪤 **The type ramp now DIPS at `lg`** (44 → 38 → 48 → 56px). Headline size is a
  function of the type COLUMN, not the viewport, and the column is narrowest
  where the split first engages. Widening the cluster to enlarge the images
  pushed the headline to three lines at 1024 and 1280 until this landed.
  **Re-measure whenever the split ratio changes.**

Re-measured: overflow 0 at 390/640/768/1024/1280/1440/1646, headline 2 lines
everywhere, hero fits the fold at every width (766px at its tallest, header
included), plates uniform to 0.009px, project cells uniform, 0 of 22 reveals
hidden with JS off, 1022 tests pass.

### Iteration 3 (2026-08-18, officer review)

**The hero plates keep their size and shape but are layered again.** The flat
2×2 fixed the inconsistency and flattened the depth out with it. Size, aspect
ratio, frame and radius are identical across all four; only POSITION varies.

📌 The principle that survived all three arrangements is the one worth keeping:
**vary one property and it reads as a deliberate set, vary four and it reads as
scatter.** The original varied shape, size and position at once.

- 🪤 Positions are percentages of a cluster box carrying its own aspect ratio,
  so the arrangement scales as a single object. Pixel offsets would need
  re-tuning per breakpoint and would drift apart the first time one was missed.
- 🪤 **Trap 2 is still live at tilt 0.** `[data-revealed]` sets
  `transform: none`, so transform-based offsets must stay on the inner element.
  `left`/`top` are safe on the reveal wrapper only because they are not
  transforms — a `translate` offset there would be erased on entry.
- 📌 Overlapping buys height back: four layered plates occupy less vertical
  space than four gridded ones, so the hero is 702px against the grid's 705px
  with the plates at the same 376×251.
- Below `lg` it stays a grid. A layered cluster at phone widths is four
  thumbnails on top of each other.

Measured: overflow 0 and zero offending elements at
390/640/768/1024/1280/1440/1646, headline 2 lines everywhere, hero fits the
fold at every width (763px at its tallest), all four plates identical in size,
5 overlapping pairs at `lg`+ and 0 below, 0 of 22 reveals hidden with JS off.

### Decisions that need the officer

1. 🔓 **A light hatch on the navy field**, departing from `hatch.tsx`'s
   "never mixed" rule. The plates overlap, overlap is where the cluster's depth
   comes from, and navy-on-navy gave no plate-to-plate separation — nor could the
   frame rescue it, because **a shadow tinted to the background hue composites to
   nothing on a ground of that hue**, which is what every shadow here is by
   design. A light plate separates from the field *and* gives `shadow-lift` a
   light surface to land on. Fallback is navy tone plus `border-white/25`, at the
   cost of most of the depth.
2. **No hero CTA**, refused with a reason rather than omitted: the sticky header
   carries Check In above the fold at every scroll position, and adding one means
   authoring a string on a page whose copy is locked. Reversible if the officer
   supplies a locked label.
3. **`Partners` drift deferred.** It predates `<Section>`, hardcodes its own
   gutter and duplicates `Headline`'s class string — but it is shared with
   `/about`, so it belongs to phase 2 rather than to a phase that is not
   reviewing that page.

### Premises this phase falsified

- ⚠️ **"Phase 1 is the first `shadcn add`" is wrong.** Zero components were added
  and that is the honest answer: the home page has no dialog, popover, select or
  form control, and `Button` would collide with the `buttonClass` module 45 files
  import. Phase 0's deliverable was the theme, and it is live. First real
  candidates are phase 2 and phase 4.
- 🪤 **"A plain `@theme` emits `--shadow-*` onto `:root`" is wrong.** Tailwind
  still tree-shakes: a step used only through its utility is inlined and its
  custom property never appears, so `--shadow-lift` reads as an **empty string**
  while `shadow-lift` paints correctly. Probe the utility, never the variable.

### Measured at the gate

`scrollWidth − clientWidth === 0` at **390 / 768 / 1024 / 1280 / 1646**, document
and body. Hero **716 / 576 / 628 / 668 / 668px**, fitting the viewport at every
width. Headline **2 lines everywhere**. Header **61px** (cap 80), nav on **one
line**, wordmark clearance **277 / 304 at 1280** and **461 / 487 at 1646**. No-JS:
**0 of 21** reveals hidden. Contrast on the composited field at its lightest
point: white H1 **11.2:1**, tagline **7.83:1**, focus ring **11.2:1**; page
minimum 4.84:1 (pre-existing nav muted). Lint, `tsc`, build clean; **1022 tests
pass**; detector 5 findings, all `design-system-font-size` against the retired
ramp, all left standing.

⚠️ **A real-device mobile check is still outstanding.** Those widths were measured
in same-origin iframes, which is a layout probe and not a device.

### Photography this phase needs (handback)

Six new slots, all captioned from the vocabulary already in `lib/site.ts`:

| Slot | Caption | Shape |
|---|---|---|
| Hero, back-left | chapter photo | landscape 4:3, ≥1600×1200 |
| Hero, tall right | general meeting photo | portrait 3:4, ≥1200×1600 |
| Hero, square | workshop photo | square, ≥1200×1200 |
| Hero, low right | banquet photo | landscape 3:2, ≥1500×1000 |
| Mission, left | member photo | portrait 3:4, ≥1200×1600 |
| Mission, right | service day photo | portrait 3:4, ≥1200×1600 |

The Activities and Projects slots keep their existing captions and are unchanged
in number.

---

## What must not regress

**Markup may be rebuilt. Behaviour, data flow and the invariants may not.** No
route, Server Action, query, migration, view or schema change anywhere.

The invariants that live *in markup*, and that a visual rebuild can break:

- **React 19 resets an uncontrolled `<form action={…}>`** once the action
  resolves. Every `defaultValue` comes from echoed server state and is a
  **string, never `undefined`**; the reset clears checkboxes, so mirrored
  selection state resets with it.
- **Never put `formAction` on a submit button whose `name`/`value` is read**, and
  **one carrier per field name**.
- **A member's CAS token is row-level**, held in state in `directory-row.tsx` and
  `member-editor.tsx`, re-adopted from each save.
- **Selection is two modes** — `filter` sends no ids at all.
- **Never put `data-reveal` on a node that mounts after first paint.**
  `/attend`'s result panel and the gallery's Load-more tiles are the two that
  would render blank forever.
- **`/leaderboard` keeps `force-dynamic` + noindex; `/lookup` keeps noindex.**
- Global CSS stays inside a Tailwind cascade layer. `reveal.tsx` stays
  server-safe. The `html.js` scoping stays.

---

## Verification

Run **§14 Final Pre-Flight in full** before every gate. It is not optional and it
caught two shipped failures in v1 the moment it was finally run.

| Check | How |
|---|---|
| Layout-family count | ≥4 distinct families per 8 sections; no family twice; max 2 consecutive splits |
| Eyebrow count | ≤ `ceil(sections / 3)`, counted mechanically |
| Nav | One line at desktop, ≤80px |
| Horizontal overflow | `scrollWidth − clientWidth === 0` at 390 / 768 / 1280 / 1646 |
| Contrast | Per pairing, on the ground each text actually sits on, alpha composited |
| No-JS | Drop the `js` class; assert zero `[data-reveal]` nodes hidden |
| Empty / error | Both branches **forced**, never reasoned about |
| Behaviour | `npm test` green between screens in phases 3–4 |
| Frozen layer | `git diff --stat` clean under `app/actions/`, `supabase/`, `lib/` beyond copy |
| Gates | `npm run lint`, `npx tsc --noEmit`, `npm run build`, `detect.mjs --json` |

🪤 **Two measurement traps, both hit in v1.** `resize_window` does not reach the
CSS viewport on this display, so breakpoints are measured in same-origin iframes
— which are *not* a real-device check. And **settle entrance motion before every
capture**: a screenshot taken mid-reveal reads as missing content and gets
"fixed" into a regression.

🪤 **`grid-cols-12` with a large `gap-x` is eleven gaps.** At `gap-x-gutter`
(56px) that is 616px of gutter before any content, which collapses every track to
zero on a phone. v1 shipped this. Declare the tracks the layout actually has.

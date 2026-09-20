# Frontend redesign v2 — plan

**Status: PART-BUILT.** ✅ Phases 0, 1, 2 and **4** are complete and recorded
below. 🏗️ **Phase 3 is IN PROGRESS** (officer, 2026-09-18): the UI redesign of the
member portal and every page in it, run through the design toolkit (`DESIGN.md`
§Design toolkit, 2026-09-18). ✅ **All four surfaces were briefed on 2026-09-19 —
interview, two concepts and evidence each, with the officer adopting a concept
and approving the copy for every one. The builds are what remain**; start at
*Phase 3 brief* below. An earlier phase-3 build on `v2-phase-3-member-pages` was
scrapped unmerged by the officer on 2026-09-18 and must not be reused. Phase 5
is outstanding. *Written 2026-08-17 as "NOT BUILT", after v1 was built
and scrapped — the phase records below are the history since.*
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
time and ended up half-committed, which is most of what "bland" described.

✅ **THE RETIREMENT IS OVER as of 2026-08-19.** `DESIGN.md` was rewritten from
what phase 1 actually shipped and is the design source of truth again, site-wide.
It was scheduled for phase 5; it moved up because **phase 2 rebuilds five pages
and cannot be executed consistently against an undocumented system.** The v1 file
is kept verbatim at [`design-v1-superseded.md`](design-v1-superseded.md) for its
reasoning. ⚠️ What phase 5 still owes is `docs/invariants.md`, which has not been
reconciled and still describes v1 for every surface v2 has not reached.

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
7. 🔓 **~~No photography.~~ SUPERSEDED 2026-08-18/19 — the organization *had*
   taken the photographs.** The rule's premise was factual, not aesthetic, and
   the fact changed. What replaces it is narrower and still binding: **a slot
   renders a photograph or a labelled placeholder, never a hole**
   (`components/ui/photo-slot.tsx` is the single swap), and 🔴 **image files and
   the code carrying their `src` values are committed together or not at all** —
   the repository is public, so publishing faces is an officer decision. Officer
   headshots and project cells stay placeholders for a second reason: pairing a
   face or a photo to a named person or client is a factual claim nobody
   supplied.

The markup-level invariants under *What must not regress* below bind equally and
are a separate list.

---

## Skill routing

⬅️ **SUPERSEDED 2026-09-18 by `DESIGN.md` §Design toolkit**, which gives each of
six skills one concern, adds `frontend-design`, `ui-ux-pro-max`, the shadcn MCP
and a `design-reviewer` agent, makes `impeccable` the lead on Operate surfaces
(`/portal`, `/admin`), and adds the receipts and tests that fail when a skill was
skipped. The table below is the phase 0–4 routing, kept for the reasoning.

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

## Design toolkit research (2026-09-18) — what was considered, and why

The officer asked for a site-wide system around the prominent UI skills and
plugins, one that makes sure they are actually used. The survey below is what
the roster in `DESIGN.md` §Design toolkit was chosen from. It is recorded so the
choices are not relitigated from scratch: anything not adopted has a reason, and
a reason can be revisited when its premise changes.

| Candidate | Disposition | Why |
|---|---|---|
| `impeccable` (pbakaus, Apache-2.0) | ✅ kept — **Operate lead** | Its Operate mode and craft-floor already governed `/admin` in phase 4; its `shape` interview writes the surface brief it then loads on every command; its detector is a deterministic check. |
| `design-taste-frontend` (Leonxlnx, MIT) | ✅ kept — **Persuade lead** | Led phases 1–2; §14 is a real pre-flight. |
| `emil-design-eng` (Emil Kowalski, MIT) | ✅ kept — motion | Narrow and complementary; already wins on motion. |
| `web-design-guidelines` (Vercel, MIT per README) | ✅ kept — code review | Fetches the current guidelines per run; recorded only in phase 4 until now. |
| `frontend-design` — the Apache-2.0 **skill** in `anthropics/skills` | ✅ added — divergence only | Pushes a single committed aesthetic, which is exactly what conflicts with a fixed identity — so it is confined to proposing two concepts. The **plugin** of the same name in `anthropics/claude-code` is under Anthropic's commercial terms and was not vendored. |
| `ui-ux-pro-max` (nextlevelbuilder, MIT) | ✅ added — evidence only | A searchable guideline database, useful as cited evidence. 🪤 Its installer adds six companion skills (removed), and its `--persist` writes a rival "source of truth" (forbidden, and tested). |
| shadcn MCP (official) | ✅ added | Search/view/add against `components.json`'s registries. Configured by hand; `init` stays forbidden. |
| Playwright + `@axe-core/playwright` | ✅ added | The de-facto rendered a11y check; runs locally, no CI needed. |
| OneRedOak's `design-review` agent | ♻️ adapted | Became `.claude/agents/design-reviewer.md`, driving Claude in Chrome (already connected) with Playwright as the fallback, instead of adding Playwright MCP. |
| Playwright MCP, Chrome DevTools MCP | ❌ not adopted | Overlap with Claude in Chrome and the Playwright suite. Chrome DevTools MCP's performance traces are the reason to revisit if performance becomes a design concern. |
| Figma MCP | ❌ not adopted | There is no Figma source; the design lives in `DESIGN.md` and the code. |
| pa11y / pa11y-ci | ❌ not adopted | axe through Playwright does the same job and can reach states. |
| Lighthouse CI | ❌ not adopted | Needs CI, which the officer chose not to add (tests + receipts instead). |
| `bergside/awesome-design-skills` | ❌ not installed | A style-preset registry; presets are the opposite of a fixed identity. Named in the original install doc, §2.5. |
| Vercel `react-best-practices` | ❌ not adopted (yet) | React/Next performance, not UI design. A candidate if performance work starts. |

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
- ~~**Phosphor**~~ **Lucide** (see the 🔓 note above) — one icon family for the
  whole project, one `strokeWidth`. Retires the hand-rolled hamburger SVG, which
  §3.C bans.

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
| **1** | ✅ **COMPLETE, gate passed 2026-08-19.** Home page + header. Record below. |
| **2** | ✅ **LIVE.** `/about`, `/projects`, `/gallery`, `/officers`, `/contact`, error and not-found boundaries. Record below. |
| **3** | ⏭️ **NEXT (officer, 2026-09-18): the UI redesign of the member portal and EVERY page in it** — the `/portal` hub, `/portal/attend`, `/portal/leaderboard`, `/portal/lookup`, and anything added under `/portal` later. It follows the merge of [member portal phase 1](member-portal-plan.md). *(Was: ⏸️ DEFERRED, not skipped.)* Originally `/attend`, `/leaderboard`, `/lookup` — visual only, behaviour untouched, and that constraint stands. Taken out of order on the officer's instruction (2026-08-27): phase 4 was asked for first. 🔓 **The `--misa-muted`-on-Vellum AA failure on those three pages was FOLDED INTO THIS PHASE by the officer on 2026-09-01**, rather than patched standalone first — so it is now a gate condition here, and **the failure stays live on member-facing pages until this phase ships**, which was the accepted cost. The 13 occurrences (re-counted 2026-09-19 against the rendered pages) and the measurement rule are in [`../tasks.md`](../tasks.md) §the `--misa-muted` AA contrast failures. 🪤 It is a ground question before it is a token swap — check what ground each page renders on first. 📌 **The three pages live under `/portal` since 2026-09-18** ([`member-portal-plan.md`](member-portal-plan.md) phase 1: `app/(public)/portal/attend`, `…/leaderboard`, `…/lookup`, with the old URLs as permanent redirects), and the phase now also covers the `/portal` hub, which was built from shared primitives only so as not to pre-empt this phase's design. 🧰 **It runs through `DESIGN.md` §Design toolkit** (built 2026-09-18 on `design-toolkit`, stacked on `portal-phase-1`), with `impeccable` (Operate) as lead: `/design-brief` per surface → build → `/design-gate`. **Its gate:** all four portal surfaces `rebuilt` in `docs/design/surfaces.json` with passing receipts, `npm run test:ui` green on their routes and states (it fails three of those states today), then the officer. ✅ **Both prerequisites are done (2026-09-19):** PRODUCT.md's member-identity line is corrected and the sidecar is refreshed from v2 (`f0cb15a`). ✅ **And all four briefs are written** — see *Phase 3 brief* below for the adopted concepts, the per-surface gate bars and the approved copy. |
| **4** | ✅ **MERGED AND LIVE 2026-08-31.** `/admin` under scanability rules, screen by screen, suite green between screens. Its five held-back accessibility findings were decided by the officer and built the same day, then walked in a browser. Brief below. 🔓 **Shipping it required pushing migration 29 to production first** — the branch was cut from the roster-terms commit, so its code depends on a schema the remote did not have. |
| **5** | ~~Replace `DESIGN.md`~~ ✅ **done early, 2026-08-19.** What remains: reconcile `docs/invariants.md` for every invariant retired, each with its replacement argued; final record in `build-log.md` and `tasks.md` |

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

## Phase 3 brief — the Portal Rebuild (BRIEFS DONE 2026-09-19, BUILD NEXT)

**Start here for the build.** Each surface's own brief is the binding document,
and `impeccable` loads it automatically on every command against that route:

| Surface | Route | Brief | Receipts |
|---|---|---|---|
| `portal-hub` | `/portal` | `.impeccable/surfaces/route-portal.md` | `docs/design/surfaces/portal-hub/receipts/` |
| `portal-attend` | `/portal/attend` | `.impeccable/surfaces/route-portal-attend.md` | `…/portal-attend/receipts/` |
| `portal-leaderboard` | `/portal/leaderboard` | `.impeccable/surfaces/route-portal-leaderboard.md` | `…/portal-leaderboard/receipts/` |
| `portal-lookup` | `/portal/lookup` | `.impeccable/surfaces/route-portal-lookup.md` | `…/portal-lookup/receipts/` |

All four are `in-progress` in `docs/design/surfaces.json`, so **the brief guard
no longer blocks their files** — steps 1–3 of the pipeline are complete and
committed (`9c8cb63`, `52771c2`, `24c2680`, `11beda2`, plus the officer's
approvals).

### 🧭 Where the build stands (2026-09-19)

**Branch `design-toolkit`**, stacked on `portal-phase-1`. Parts 0, 1 and 2 are
committed and **`portal-hub` is `rebuilt`** — the first surface through the
toolkit end to end. The other three are still `in-progress`, so
`tests/design-receipts.test.ts` now checks the hub's **receipts** and the other
three's **briefs** only.

| Part | State | Commit |
|---|---|---|
| 0 — Baseline | ✅ done | `debeca2` |
| 1 — Shared vocabulary | ✅ done | `fa7c2e5` |
| 2 — `/portal` hub | ✅ **done — built, gated, `rebuilt`** | `d827ac7` build · `ab3f6c9` fixes · `e67acb8` receipts · `30bcec5` flip |
| 3–7 | ⏭️ not started | — |

🔒 **`portal-hub`'s files are now FROZEN.** `receipts.mjs` fails a `rebuilt`
surface as **stale** on any commit touching `app/(public)/portal/page.tsx` that
no receipt names as a `fix_commit`. Parts 3–5 must not edit it. (Shared
primitives in `components/ui/` are exempt by DESIGN.md and may still change.)

**Suite state, re-confirmed at part 0 and unchanged since:** `npm test` 41 files
/ 1142 tests green; `npm run test:ui` **39 pass / 3 fail**, and the three are
`/portal/lookup`'s member result (`definition-list (1): dl`) and both of
`/portal/attend`'s first-timer confirmations (`color-contrast (3): … > dt`).
Parts 3 and 4 own all three.

⏭️ **The immediate next step is part 3, `/portal/attend`** — the surface with
the most states (twelve, plus pre-hydration), the new box label and review
copy, and **both** of its muted-on-Vellum occurrences. Its bar is IDLE-ONLY.
🔴 It carries the one **open officer question** listed under *Needs the
officer* below: changing the check-in checkbox label orphans the unmatched
banner at `checkin-form.tsx:143-146`, which points at the box using the OLD
label's words. Draft replacement copy and show it before shipping.

✅ **Part 2 is closed.** What its gate produced, kept here because parts 3–5
inherit both:
- 🔴 **A focus ring must contrast with every ground the FOCUSED ELEMENT spans**,
  not just the one its section sits on. The hub's row link was the first thing
  in this system to span two grounds inside one focusable element, and its navy
  ring measured **1.00:1** over the navy key. `DESIGN.md` §Components carries
  the rule. **Check-in and lookup both adopt the band and the row idiom, so the
  next navy-element-inside-a-link hits this again.**
- 🔴 **`<Title className="text-[22px] …">` silently does nothing** — arbitrary
  values tie on specificity and Tailwind v4 sorts them ascending, so the larger
  always wins. Use the new `size="card"` prop. 🐛 The same bug is live on the
  **home page** via `activities.tsx:98` (renders 34px where the code asks 26);
  **part 6 owns that fix**, not a portal surface.
- 📌 **Three officer questions are open and none blocks a bar** — see *Deferred
  to the officer* at the end of this section.

🪤 **Two gate rules make the per-surface order mandatory rather than stylistic.**
The checker fails a surface with *"no review finding was adopted in a commit
touching this surface"* if the gate changed nothing, and fails it as **stale** if
any commit touches it after a review without a receipt naming that commit as a
`fix_commit`. **Once a surface is `rebuilt`, stop touching its files.**

📌 **The gate bars are NOT in the suite.** `playwright.config.ts` has no
`projects` array and no viewport matrix — one Desktop Chrome project at
1280×720, plus a per-test `setViewportSize({ width: 360, height: 800 })` used
only for the overflow check. Every bar in the four briefs is a **fold position**
at 360×640 or 1280×720, so "green `test:ui`" and "the bar is met" are different
claims and only the second needs a person or the `design-reviewer` agent.

🪤 **Measuring method, learned the hard way at part 0.** To read a settled
layout, load the page and **remove the `js` class from `<html>`** — that drops
the reveal transition along with the rule, so the geometry snaps. Forcing
`data-revealed` is what `design-gate.spec.ts` does and is correct *in
Playwright*, but it starts a 0.7s transition and **a background browser tab
never advances it**, so an interactive read appears frozen and even an
`!important` override looks as though it did not apply. An un-settled read of a
`[data-reveal="up"]` node is **18px low**.

### 📛 The name: **the Portal Rebuild**

Refer to this work as **the Portal Rebuild**. It is v2 phase 3, it covers the
four `/portal` surfaces and nothing else, and it changes presentation only.
Its brief is this section; its per-surface briefs are the table above.

### The build, in parts — ✅ REVISED AND UNDER WAY (2026-09-19)

🔓 **The skeleton below was revised by the planning session and parts 0–2 are
built.** Three changes, each forced by something measured rather than preferred:

1. **Part 1 widened** from "the band, 48px controls, the stacked-row pattern" to
   *every* shared-primitive addition the phase needs. The leaderboard's sticky
   head turned out to require a `components/ui/table.tsx` change (see *Three
   stale claims* → the sticky-head entry, and `member-table.tsx`'s own note on
   why a head cannot stick inside the scroll wrapper). Left in part 5 that
   change would land **after three surfaces were gated and `/admin`'s eleven
   tables were live**. Done once, additively, up front, the surface order stops
   depending on it.
2. 🔴 **Part 6 LOST the contrast sweep for the four surfaces.** Each surface's
   muted-ink fix now lands **inside that surface's own build part, before its
   gate**. `scripts/design/receipts.mjs` fails a surface as **stale** when a
   commit touches its files after a review step and no receipt names that commit
   as a `fix_commit` — and the old part 6 touched lookup, attend and leaderboard
   after all of them had been gated. **As written, the skeleton would have
   failed `npm test` the moment the surfaces were marked `rebuilt`.** Part 6
   keeps only what is *outside* the four: `/officer-invite`, the shared
   primitives re-measured, and the suite.
3. **Part 0 gained a receipts dry-run.** `node scripts/design/receipts.mjs
   <surface>` prints each surface's required set, and whether `motion.md` is
   required is *computed* from a grep of the surface's own files. It differs per
   surface — **hub, attend and leaderboard need one; lookup does not** — and
   concept A changes those files, so the set can move under the build.

Each part ends somewhere demonstrable, which is the same rule the stages use.

| Part | Scope | Ends when |
|---|---|---|
| **0 — Baseline** ✅ `debeca2` | Local stack up, dev server on the local env, re-measure each surface at 360×640 / 768 / 1280×720 / 1280×800, record the numbers, and run the receipts dry-run per surface. Confirm `npm test` and `npm run test:ui` are at their known state. | ✅ **Done.** `npm test` 41 files / 1142 tests green; `test:ui` 39 pass / 3 fail, exactly the documented three. Briefs re-confirmed or corrected; the muted counts fixed in three documents. |
| **1 — Shared portal vocabulary** ✅ `fa7c2e5` | *(Widened — see above.)* Every shared-primitive addition the phase needs, all additive, all opt-in, no default moved. | ✅ **Done.** `portal-band.tsx` (PortalBand), `buttonClass({ touch })` for the 48px floor, `table.tsx`'s `scroll={false}` + `<THead sticky="page">`, `status-region.tsx` (StatusRegion). Suite unchanged at 39/3. |
| **2 — `/portal` hub** ✅ `d827ac7` → `30bcec5` | The smallest surface, and it sets the row-link and key-column pattern the others borrow. | ✅ **DONE AND `rebuilt`.** Bar met with **99px** to spare (check-in row bottom **423 → 325** at 360×640, bar ≤424; all three destinations on the first screen), verified independently by the `design-reviewer` agent and by critique Assessment B. Seven receipts pass: 12 findings adopted, 8 rejected against a named rule, 3 deferred to the officer. |
| **3 — `/portal/attend`** | The most states: twelve, plus pre-hydration. The new box label and review copy land here, **and both of its muted-on-Vellum occurrences** (`:336` and `:364`). | Its bar is met **in the idle state**, every state is designed and gated — not just the happy path — and the two red `color-contrast` checks are green. |
| **4 — `/portal/lookup`** | The most complex result, and the surface carrying 9 of the 13 muted occurrences. Stacked event rows below `sm`, the `definition-list` fix, the announced result, the stale sentence removed, the contradictory dues comment corrected. | Its bar is met; axe is green on the result and the miss; no sideways scroll to read whether you attended. |
| **5 — `/portal/leaderboard`** | The odd one out: no hero, its own type scale, the column head made genuinely sticky (using part 1's white page-sticky variant), **and its two stale `active member` comments corrected**. | Its bar is met — **ten rows** on the first screen at 1280×720 — including the projector measurement. |
| **6 — Outside the four surfaces, and the suite** | *(Narrowed — see above.)* `/officer-invite/[token]`'s one muted line; the shared primitives re-measured on the grounds the portal now puts them on; the full suite. **Touches no registered surface's files**, which is the point. | No muted ink on Vellum anywhere in `/portal` or `/officer-invite`; `npm test` green and `test:ui` green on all 42. |
| **7 — Records, merge and handoff** | `DESIGN.md`'s surface table and `docs/design/surfaces.json` agree; `PageHero`'s "NINE pages render this" corrected to five; `tasks.md` and `build-log.md` record what the phase found; the officer's gate. | Merged (**never squashed** — receipts name commits), with `portal-phase-1` merged first. |

**Order, fixed: 2 → 3 → 4 → 5.** Part 1 retires the shared-primitive risk up
front, so the order follows the **bars** rather than the dependencies:

- **Hub first** — the only surface where the band is the *only* new thing, and
  its bar was soft (≤424 was *today's* number, against an estimate of 311). The
  cheapest place to discover what the band actually measures, and the band's
  height is the input to check-in's slack.
- **Check-in second** — the band's tightest consumer and the one bar that can
  fail on a handful of pixels. It must be built when the band's height is a
  measured fact rather than an estimate.
- **Lookup third** — takes the band as given (the third caller proves the
  primitive), reuses check-in's announce-and-focus answer, and carries the most
  work of the four.
- **Leaderboard last** — it shares nothing, so its position is free; and it is
  the only surface whose concept **drops the navy hero**, the largest visual
  departure and the likeliest thing an officer revisits at a gate. Better that
  conversation happens with the other three settled. It can move earlier or run
  in parallel without disturbing anything.

### ✅ Decisions taken by the planning session (2026-09-19)

- ✅ **`/officer-invite/[token]`: fix the contrast line in part 6, do NOT
  register it.** Four measured reasons, not a preference:
  - `tests/ui/design-gate.spec.ts` builds its route list **from
    `surfaces.json`** and calls `page.goto(route)` on each. Registering puts
    the literal string `/officer-invite/[token]` into that list, and there is
    no fixture that mints a visitable token.
  - 🔓 **"Only `sha256(token)` is stored; never return it from a read"** means
    a Playwright fixture cannot recover a raw token from the database. It would
    have to mint one through the officer UI — a signed-in fixture, for a page
    carrying one muted line.
  - `brief-guard.mjs` keys off **`surface.brief` existing, not `status`**.
    Registering it would block *any* edit, the one-line fix included, until an
    officer interview happened.
  - It is neither `/portal` nor `/admin`, and the Portal Rebuild "covers the
    four `/portal` surfaces and nothing else".

  🪤 **But it is more than one line of debt, and part 6 must say so rather than
  leave it silent.** It uses a raw `<section className="px-6 py-16">` instead of
  `<Section>`, an h1 at `34 → 42px` which is on no ramp row, and a hand-rolled
  `border-misa-caution/45` banner instead of `Banner`. Part 6 fixes the contrast
  and **records the rest in DESIGN.md's surface table as a named exception** —
  an unrebuilt v1-idiom surface with its drift listed. Phase 5 places it.
- 🔓 **The muted-ink count has moved since DESIGN.md recorded it.** ✅
  **RE-COUNTED 2026-09-19 against the RENDERED pages: 13 occurrences across
  FOUR files** — `/portal/lookup` 9 (page 1, form 8), `/portal/attend` 2 (the
  disclosure hotfix removed two of the four), `/portal/leaderboard` 1, and
  `/officer-invite` 1. Not all of them fail; each is measured on the ground it
  actually sits on. 🐛 **The `/portal` hub renders ZERO** — the count of 1 was a
  grep hit on `portal/page.tsx:42`, the comment explaining why the hub's officer
  line uses `--misa-secondary`. `tasks.md` had the hub right and the attend
  count wrong; `DESIGN.md` had attend right and the hub wrong. Both corrected.
  **Count rendered class attributes, not grep hits.**
- ✅ **The short band is ONE component: `components/ui/portal-band.tsx`,
  exporting `PortalBand`.** Built in part 1, adopted by the hub in part 2.
  - Three callers. `CLAUDE.md`: a primitive is justified by a **second** caller
    — and phase 4's lesson was the opposite case, `PageHeader`,
    `SectionHeading` and `Table` sitting at zero call sites while 25 pages kept
    their copies.
  - `tests/design-receipts.test.ts` asserts **"no file belongs to two
    surfaces"**, so a band inside any one surface's `files` entry could not be
    shared. `components/ui/` belongs to none.
  - DESIGN.md states it outright: **"a change to a shared primitive in
    `components/ui/` does not make any surface stale."** A hub-local file could
    not be edited in part 3 or 4 without reopening the hub's receipts.
  - 🪤 **It must never become a `PageHero` variant.** Full reasoning in
    `DESIGN.md` §Components.
- ✅ **The three bars are settled** (2026-09-19), each recorded in its own
  brief: check-in's first-screen bar is **IDLE-ONLY** (the unmatched state is
  measured and reported, but does not gate); the leaderboard's is **TEN ROWS**
  at 1280×720, with a boundary tie at rank 10 a *named accepted overflow*; and
  lookup's link to the leaderboard **goes with the stale sentence** — nothing
  replaces it, the hub is the junction, and the pair is one-way by decision.
- ⏭️ **`emil-design-eng` runs at each surface's gate, not before the build.**
  Nothing in the four concepts adds motion; the hub and the leaderboard *remove*
  a reveal, and removal needs no motion design. 🪤 But the receipts checker
  computes whether `motion.md` is required from a grep of the surface's own
  files, so **removing the last `data-reveal` can change the required set under
  the build** — re-run `node scripts/design/receipts.mjs <surface>` before
  assuming. Today it requires `motion.md` for hub, attend and leaderboard, and
  **not** for lookup.

### ⚠️ Open items that need the officer

📌 **Three, none of which blocks a bar or a gate.** The first is part 3's and
must be answered before that surface ships; the two from the hub's gate are
*deferred* findings — recorded with reasons in
`docs/design/surfaces/portal-hub/receipts/critique.md` (A3, A4/B3) — and the
hub is `rebuilt` without them. 🔒 **Either one, if adopted, edits a frozen
surface**, so each needs a receipt naming its fix commit or `receipts.mjs`
fails `portal-hub` as stale. Ask them together at the officer's gate.

**2. The band's h1 restates the header button that was just tapped.**
`PortalBand title="Member Portal"` renders 61→191 at 360, directly under the
header's current-marked **MEMBER PORTAL** button — two identical phrases within
90px, costing 130.5px on the page whose named anti-goal is height. The brief
permits change here ("the hub may drop or shrink its use of the shared hero"),
but **the officer approved concept A *as proposed*, and what was proposed was
"a short hub-only field band carrying only the centred h1"** — so dropping or
re-titling it reopens the thing they said yes to. 🪤 It is also the page's
specificity: the notch is what makes the hub unmistakably this site's, so
shrinking it trades identity for pixels the bar does not currently need (99px
of margin). *Not a change to `PortalBand` — it is the hub's `title` prop.*

**3. At 360 the destination rows rake 93 / 118 / 144px.** The bodies wrap to
one, two and three lines, so the least-urgent destination is the largest object
on the phone screen and the navy key reads as one slab on the bottom row.
Equal *formatting* is untouched — what is unequal is the copy, which is the
officer's (each body is its destination page's own `metadata.description`).
The fix is subtraction, which "nothing else is added" permits: the word "MISA"
appears in all three bodies on a MISA-only page. 🪤 The alternative — a
one-line clamp — truncates and is worse. Part 2's type-ramp fix shortened every
row but left the ratio unchanged, so the finding stands.

---

**1. Changing the check-in checkbox label orphans the unmatched banner.**
`checkin-form.tsx:143-146` points at the box using the *old* label's words — "if
this is your first MISA event or your first time checking in here, tick the box
below" — and the approved copy replaces that label with *"I haven't checked in
with this form before"*. The brief permits changing "the four banners" but the
approved-copy list has **no replacement**. Part 3 drafts one and shows it to the
officer before it ships, per the brief's own rule. **This is the only place in
the phase that generates member-facing copy the officer has not already seen.**

### What the officer settled in the interviews (2026-09-19)

- **Hub:** members arrive mostly on a phone at an event; **all three
  destinations stay equal and in order** (check-in, leaderboard, lookup);
  design for three, not five; **nothing else is added**; the one anti-goal is
  *slower to check in*.
- **Check-in:** the failure at the door is **first-timer confusion over the
  checkbox's wording**; the success screen is read by the member alone; **the
  capture disclosure stays removed** (§9 #15, v1.83).
- **Leaderboard:** three real audiences — the race at the top, members finding
  themselves, and **the page itself projected at meetings**; 50–150 members;
  **top 10 recognised**; no name filter.
- **My Attendance:** members come for **points, dues, then events**, on a phone
  straight after check-in; the stale "Both have to match the same member"
  sentence is **removed, not replaced**; the anti-goal is the portal reading as
  several different products.

### The adopted concept per surface, and its gate bar

Every surface adopted **concept A**; the rejected B and its reasons are in each
`receipts/diverge.md`, and the officer may still overrule.

| Surface | Adopted shape | Measured bar for the gate |
|---|---|---|
| Hub | One shared-rule plate, three whole-row links, a navy key column, under a short hub-only field band | Check-in row's bottom **≤ 424px at 360×640** (today 424, estimated ≈311); still two taps from the header |
| Check-in | The same short band, the form on white at a tighter rhythm, the box label plus an inline reassurance, a 48px full-width button | Check in button **fully on the first screen at 360×640** (today cut at 671; estimated ≈628), with 8px the floor on any gap |
| Leaderboard | **No navy hero**: a white title row with the term set large, one table, recognised places larger, a navy cut line after rank ≤ 10, compact rows below | **The whole top 10 on the first screen at 1280×720** (today 6 rows), names never below 16px (today 14px) |
| My Attendance | Short band, then one sheet in the officer's order: name, the four numbers, pending, dues, events, grants | Field **and** button on the first phone screen; **no sideways scroll to read whether you attended**; the `definition-list` axe fault gone |

### Copy the officer approved, to be built verbatim

- **Check-in box:** *"I haven't checked in with this form before"*, with *"Not
  sure? Tick it. If we already have you, we'll use your existing record, never a
  second one."* beneath. Review step: *"Check your details before we add you"* /
  *"We found you. Confirm to check in."*, buttons *"Confirm and check in"* and
  *"Edit details"*. Result link: *"See your points and attendance"*.
- **Leaderboard:** all-zero banner *"Nobody has points yet this term, so
  everyone is tied at zero. Totals appear after the first event."*; lookup line
  *"Want to see how your total adds up? Look up your attendance."*
- **My Attendance:** band line *"Enter your UT EID to see where you stand this
  term."*; reset button *"Look up another EID"*; unpaid dues *"You're not paid up
  for {term} yet. Dues are worked out from payments we've matched to you — if
  you've paid recently, ask an officer."* 🔓 **The officer cut "rather than
  paying twice" from the proposal**; the sentence ends at "ask an officer".

### Three stale claims the briefs found, for the build to correct

Each was found by measuring rather than reading, and none is a behaviour change:
1. 🐛 **The leaderboard's column head is NOT sticky**, though the page's comment
   says it is — `THead`'s `sticky` is opt-in and paired with `Table`'s
   `maxHeight`. The brief makes it stick, below the 61px site header.
2. 🐛 **`/portal/lookup`'s result carries a comment arguing the opposite of the
   page's own header** — it says dues status is allowed *because* the gate is the
   EID alone, where the header records that the EID-alone gate removed the
   argument that justified it.
3. 🐛 **The `definition-list` axe fault is in the stat block**: each stat's group
   puts a `<p>` note inside the `<dl>`'s `<div>`. The note becomes a second
   `<dd>`.

### How to run a build

1. Read the surface's brief (impeccable loads it; `node
   .claude/skills/impeccable/scripts/surface-brief.mjs read route:/portal/...`
   prints it).
2. Build only that surface's files, against `DESIGN.md`. **Do not** run
   `/impeccable init`, `/impeccable document` onto `DESIGN.md`, or
   `ui-ux-pro-max --persist`.
3. `/design-gate <surface>` writes the review receipts (lead self-review,
   impeccable critique and audit, `web-design-guidelines`, the `design-reviewer`
   agent, the detector, `emil-design-eng` for motion), then run the checkers:
   `node scripts/design/receipts.mjs <surface>` and `npx vitest run
   tests/design-receipts.test.ts`.
4. `npm run test:ui` must be green on the surface once it is `rebuilt` (it needs
   a running `npm run dev` on the local stack).
5. Flip `status` to `rebuilt` in `docs/design/surfaces.json`, and update
   `DESIGN.md`'s surface table in the same commit — they must agree.
6. 🪤 **Merge the branch, never squash it**: the receipts name commits that must
   stay in the branch's history.

---

## Phase 4 brief — `/admin` (IN PROGRESS)

**Scope:** every screen under `app/admin/`, plus `/admin/login` and the two admin
error boundaries. Presentational only — no route, Server Action, `lib/`, view or
schema change. Branch `v2-phase-4-admin`, cut from the roster-terms commit so the
screens being styled are the **term-aware** ones migration 29 produced.

### Mode is Operate, not Persuade

📌 `DESIGN.md` already says it: `/admin` is *"governed by scanability rather than
expression."* `PRODUCT.md` says who and where — **~13 officers, at a desk, on a
laptop, between classes, all semester.** That settles most of the arguments this
phase could otherwise have. Density is a feature; wide tables and multi-column
filter bars are correct; brand lives in precise details, not in composition.

⚠️ **`design-taste-frontend` is NOT primary here.** It is primary for the *public
visual UI* (`DESIGN.md` §Design skill precedence), and `/admin` is not that. The
layout-family budget, the eyebrow cap and the image-slot strategy are public-page
instruments and do not apply to a filter bar. What governs instead: `DESIGN.md`'s
grounds/elevation/type/shape system, the `CLAUDE.md` Invariants above it, and
`impeccable`'s Operate + craft-floor mechanics for the table and form work.

🪤 **Two craft-floor rules are overridden here, both already settled in
`DESIGN.md` and not to be relitigated.** Its blanket eyebrow ban is **refused**
(the `Th` label style and `Eyebrow` are load-bearing), and its
"monospace as costume" refusal does not reach `/admin`'s identifiers — an EID is
transcribed by hand off a phone screen, which is data, not flavour.

### What the audit found before anything was designed

⚠️ **Every count below is AS THE PHASE OPENED and is now history** — the phase is
what changed each one. The "after" column is the point.

📌 Counts are **JSX instances** under `app/`, measured the same way on both
sides so the columns are comparable.

| Counted when phase 4 opened | After |
|---|---|
| 🐛 `PageHeader` — **0 call sites in the entire repository** | 25, all admin |
| 🐛 `SectionHeading` — **0 call sites in the entire repository** | 46, all admin |
| 🐛 `Table` — **0 admin call sites** (2 public) | 17 (13 admin) |
| `Panel` — **1 call site**, on `/attend` | 23 (21 admin) |
| `Section` — 0 admin call sites | **0 admin, deliberately** (28 public) |
| 25 admin pages repeating **one identical h1 class string, verbatim** | 1 raw `<h1>` (`/admin/login`, a recorded exception) |
| 42 h2s: 38 at `text-[22px]`, plus 3 `text-xl` and 1 `text-lg` | 0 raw `<h2>`, 0 `text-[22px]` |
| 11 raw `<table>`, 47 copies of one head-cell string | 0 of each |
| 43 of 76 admin `.tsx` files importing from `components/ui/` | 71 of 76 |

`PageHeader` and `SectionHeading` were both written *for* `/admin` — their own
doc comments say "thirteen admin pages open with the same three elements …
written out longhand every time" and "the `font-display text-xl font-bold` that
appears 38 times" — and neither was ever wired up. **Three primitives were built
to end this drift and the drift was never ended.**

📌 The one h1 that stays raw is `/admin/login`'s: a centred card outside the
shell, recorded as a ramp exception in `DESIGN.md` rather than left as drift.

### The ground, and the ordering constraint that governs the phase

`/admin` moves onto the v2 system the same way the public side did: **the page
ground becomes Vellum `#f2f2f3` and content regions become white surfaces.**
`DESIGN.md`'s sentence carries over unchanged — *the grey is the background;
cards stay white.*

🔴 **This CANNOT land before the screens are wrapped, and the reason is a bug
rather than a preference.** Five shared primitives fill with `bg-misa-panel` —
`controlClass` (every input), `table.tsx`'s sticky `<THead>`, `chip.tsx`'s
resting `FilterChip`, `banner.tsx`'s neutral variant, and `Tr`'s
`hover:bg-misa-panel/70`. On a Vellum page ground **every one of them is the same
colour as what is behind it**: inputs disappear, the sticky head stops separating
from the rows scrolling under it, and row hover does nothing. `--misa-muted` also
measures **4.33:1 on Vellum and fails AA** — the defect phase 2 found and fixed on
three public pages.

📌 So the order is fixed, and it is the opposite of the tempting one:
**wrap every screen in white surfaces FIRST, flip the ground LAST.** A white panel
on the still-white page is invisible and harmless, so every intermediate commit
stays shippable; the flip is then one line and every screen is already correct.
🪤 The reverse order gives a branch that looks finished and is measurably broken.

### Constraints specific to this phase

- 🔴 **The markup invariants under *What must not regress* bind hardest here**,
  because `/admin` is where every one of them lives: the React 19 form reset and
  its string `defaultValue`s, one carrier per field name, no `formAction` on a
  submit button whose `name` is read, the row-level CAS token in
  `directory-row.tsx` and `member-editor.tsx`, and selection's two modes.
- 🪤 **`<Section>` has ZERO admin call sites and keeps them.** It owns the public
  gutter and vertical rhythm, which `/admin` does not share. `Panel` is the admin
  surface; the shell owns the ground.
- **Identifiers stay monospace.** Engineering-set rule #5.
- 🪤 **`/admin` has no scroll reveal and gains none.** `reveal-observer` is
  mounted in the *public* layout only, so a `data-reveal` on an admin node would
  sit at `opacity: 0` forever. Operate mode bans page-load choreography anyway.
- **`npm test` green between screen groups**, per the phase table.

### The gate

`npm run lint`, `npx tsc --noEmit`, `npm run build`, the full suite, zero
horizontal overflow at 1024/1280/1646 (admin is a laptop surface — 390 is not a
target, but nothing may overflow), every contrast pairing measured on the
composited ground it actually sits on, and a browser walkthrough of every screen
against local seed data. Then `web-design-guidelines` as the pre-ship review.
Then stop for the officer.

---

## Phase 4 record (2026-08-29) — `/admin`

**Built and measured; waiting on the officer.** Three commits on
`v2-phase-4-admin`, cut from the roster-terms commit so the screens are the
term-aware ones. Presentational only: `app/actions/`, `supabase/`, `proxy.ts` and
`lib/` are untouched.

### What the phase actually was

📌 **Adoption, not composition.** The audit came back with the answer before
anything was designed: `PageHeader` and `SectionHeading` had **zero call sites in
the repository**, `Table` had zero admin ones, and `Panel` had one. All four were
written *for* `/admin` — their doc comments name the exact duplication they were
meant to replace — and none was ever wired up. Meanwhile 25 pages repeated one h1
class string verbatim, 45 h2s repeated another, and 11 raw tables carried 47
copies of one head-cell string.

So the work was three passes, in an order chosen for safety:

1. **Headers** — every screen onto `PageHeader` / `SectionHeading`.
2. **Tables and states** — every table onto `Table`, every badge onto `Pill`,
   every notice onto `Notice`.
3. **The ground** — Vellum on the shell's `<main>`, one line, landing last.

🔴 **The ordering is the finding worth keeping.** Five shared primitives fill
with `bg-misa-panel`, and that is exactly the colour the page was about to
become. Wrapping the screens in white surfaces first meant every intermediate
commit stayed shippable (a white surface on a still-white page is invisible and
harmless) and the flip itself was trivial. The reverse order produces a branch
that looks finished and is measurably broken.

### What measuring found that looking did not

- 🐛 **36 controls on the directory were the exact colour of the page behind
  them** after the flip — the whole filter row, plus every inline custom-field
  select. Found by comparing each control's computed fill against its composited
  ground, which is a loop, not a squint at a screenshot.
- 🐛 **The loading skeleton went invisible.** Its lighter bars were
  `bg-misa-panel`; the screen degraded to two lonely dark bars on an empty page.
  Both weights are alpha over the ground now, so the next ground change cannot
  erase them.
- 🐛 **`--misa-muted` on Vellum, again — 4.33:1, failing AA.** Phase 2 found this
  on three public pages and the fix there was per-page. It recurred in four new
  places the moment the admin ground moved. 📌 **The rule is about a ground
  moving under ink, not about a list of pages**, and that is now written into
  `DESIGN.md`.
- 🐛 **The disabled "Audit" nav item measured 3.39:1.** WCAG exempts an inactive
  control — but that item's own comment says it sits in the nav so the shape of
  the section is visible to everyone, and 3.39:1 undercuts its stated reason.
  `white/55` is **5.05:1**, solved against the composited navy rather than picked.
- 🐛 **Three notices were the empty-vs-error conflation, alive and well.**
  `RecentCheckins` rendered a failed read in the neutral blue `info` panel,
  identical to "no check-ins yet"; the bulk-assign result's three failure states
  shared one local `Banner` hardcoded to caution; and several `role="alert"`
  failures elsewhere ("that didn't work", "can't publish", a failed sign-in) wore
  the same neutral skin. Stage 8 phase 3 corrected this in the *page* logic;
  these were the interactive states it did not reach.
- 🐛 **The same badge drift `pill.tsx` was written to end, in five places** —
  including two dues badges one row apart at 11px and 11.2px, two sizes reading
  as one.
- 🪤 **`Banner` renders a `<p>`, and one report carries paragraphs and a list.**
  A `<p>` cannot contain either; the parser closes it at the child's start tag,
  so the frame ends early and the rest renders bare. `as` fixes it.

### 🔴 Three screens were throwing outright, and it was not the redesign

`members.active` was dropped by **migration 29** and three queries still selected
it, so PostgREST answered `column members_1.active does not exist` and the
**submission detail, dues detail and points ledger** all rendered the error
boundary. Nothing read the value — it was a leftover.

📌 **This is the argument for walking the screens.** No test covers a PostgREST
column list, the suite was green across all 1094 tests with the bug live, and
`tsc` cannot see inside a `.select()` string. It was found by loading pages.

### Decisions taken in the phase

- **`design-taste-frontend` is not primary here.** It is primary for the *public
  visual UI*; `/admin` is not that. The layout-family budget, the eyebrow cap and
  the image-slot strategy are public-page instruments and do not reach a filter
  bar. `impeccable`'s **Operate** mode and craft-floor governed instead, under
  `DESIGN.md` and the `CLAUDE.md` Invariants.
- **`<Section>` keeps its zero admin call sites.** It owns the public gutter and
  rhythm, which `/admin` does not share. `Panel` is the officer surface.
- **`Table` carries its own white ground** rather than each caller remembering.
- **A `<form>` that needs its own `action` stays a `<form>` with a `bg-white`
  frame** — `Panel` does not forward `action`, and threading a form's action
  through a surface component would make the surface responsible for something it
  has no business knowing.
- **`SectionHeading` gained `level="sub"`** for the 18px step /admin genuinely
  uses seven times, and `id` because five call sites point an `aria-labelledby`
  at it. Dropping that would have unlabelled five landmarks.
- **The back link moved above the title** on all eleven screens that carry one.

### The accessibility review, and what it left standing

`web-design-guidelines` was run over the branch and returned **28 findings**.
Everything landing on a component this phase created or changed was fixed (see
the commit); two of those **undercut earlier work on the same branch**, which is
the part worth keeping:

- The Audit nav item was still **keyboard-unreachable** — `disabled` takes an
  element out of the tab order, so raising it to 5.05:1 was contrast work spent
  on something nobody could focus. It was the exact defect the file's own
  comment claimed to have fixed, surviving the fix.
- The loading skeleton's `sr-only` "Loading…" sat **inside** its `aria-hidden`
  wrapper, so the one accessible announcement on the screen was the single thing
  assistive technology was told to ignore.

📌 **Also fixed because they were in shared primitives:** `SectionHeading
level="sub"` rendered a second `<h2>` rather than an `<h3>`; `Field` put the
hint inside the `<label>`, making it part of the control's accessible name;
`Table`'s scrollport was not focusable, so tables with no focusable cell could
not be scrolled from the keyboard at all (WCAG 2.1.1).

⬅️ **Left standing, deliberately, and NOT silently absorbed.** Each is
pre-existing behaviour rather than presentation, and this phase is
presentational:

1. **No unsaved-changes guard** on the member notes editor or the event form —
   `Cancel` is a `<Link>` that discards silently.
2. **"CANCEL WHOLE SERIES" submits immediately**, with no confirm step and no
   undo, while every comparable destructive control on the branch uses the
   documented two-click pattern.
3. **`title`-only explanations** on `OriginPill`, the self-registered badge, and
   two disabled submit buttons whose `title` is the one sentence explaining why
   the control is dead — mouse-only in every case, and fixing them properly
   means new visible copy, which is an officer decision.
4. **Missing `aria-live`** on the export toolbar's clipboard feedback and the
   inline field cell's save states.
5. **ALL-CAPS button labels in the DOM** at ~25 sites, where `buttonClass`
   already applies `uppercase` — so the caps are redundant and reach assistive
   technology, translation and the clipboard as caps. Real, but it is a
   user-visible copy change across the whole officer side and belongs in its own
   commit.

### ✅ All five resolved by the officer's decision (2026-08-31)

Five commits, `b4898f4` → `cf00cfb`, one per finding, cheapest and most
defect-like first with the largest mechanical diff isolated last.

📌 **This is the first phase-4 work that is NOT presentation-only.** It changes
behaviour and user-visible copy by decision, which is exactly why these five
were held back for an officer rather than absorbed.

| # | Decision | Commit |
|---|---|---|
| 1 | Event form only, guarding in-app nav **and** browser unload. Notes editor deliberately left alone. | `8f7c222` |
| 2 | Two-click confirm **naming the count**. | `b4898f4` |
| 3 | All four disabled buttons get visible copy. | `7192dab` |
| 4 | Invite-link copy **and** the export toolbar. | `d69265d` |
| 5 | Stripped, in its own commit. | `cf00cfb` |

🔴 **Two of the recorded findings above were WRONG about the code, and both
errors pointed the work at the wrong file.** Worth keeping, because the review
was read as an inventory when it was a set of claims:

- **#4 named the inline field cell. It already announced** — `member-field-cell.tsx`
  has carried `role="status"` all along. The real second gap was the **export
  toolbar**, whose "Copied 40 addresses." was visible-only.
- **#3 named `OriginPill` and the self-registered badge plus "two" disabled
  buttons. There are FOUR disabled buttons** (`resolution-form`, `review-queue`,
  `event-lifecycle`, `grant-form`), and the two non-disabled badges are a
  separate case the officer scoped out. A `title` on a *non*-disabled element is
  at least reachable by hover; on a disabled one it is reachable by nothing,
  because `disabled` removes the element from the tab order.

🔴 **The cancel was worse than #2 described, and the confirm had to say so.**
`setSeriesStatus` updates `.eq("series_id", …)` with **no status filter and no
date filter**, so it cancels drafts, published occurrences and **past** ones
alike — and there is no series-level un-cancel: once `draftCount` hits 0 the
publish control stops rendering and recovery is per-event. The confirm therefore
names the count rather than saying "the whole series". 📌 **Narrowing the action
itself was offered to the officer and NOT chosen** — recorded here as a
deliberate non-change, not an oversight.

📌 **The count is exact rather than truncated, and that is load-bearing** because
the confirm states it as fact: `seriesSchema` caps a series at
`MAX_SERIES_EVENTS` (60), under `fetchEvents`' `.limit(200)`, so a series view
always holds every occurrence. Raising either bound past the other silently turns
the sentence into a lie.

🔓 **`<Link onNavigate>` is how App Router cancels a client-side navigation**
(verified in the installed build: `node_modules/next/dist/docs/01-app/
03-api-reference/02-components/link.md:451`, and a **"Blocking navigation"**
section at l.1092 whose stated use case is verbatim *"when a form has unsaved
changes"*). ⚠️ **There is no global navigation blocker in this version** —
`useRouter` has no router events and no `beforePopState`, which is a Pages-only
API. So the guard is honestly partial and the commit says so: **Cancel and
browser unload only**. Not covered: the admin nav links (would need Next's
Context recipe, and would move the confirm away from the control it belongs to)
and **browser Back/Forward, which is not achievable at all here**.

🪤 **Next's own recipe for `onNavigate` calls `window.confirm`; this codebase
forbids that**, so the armed state is the two-click control instead. And
`beforeunload` is *not* that forbidden dialog — the rule is about the app opening
a blocking native dialog as its own UI, where a two-click control is strictly
better. `beforeunload` opens nothing, and there is no in-app alternative for a
tab close.

🪤 **The confirm inside the event form cannot copy `preset-row`'s shape
verbatim.** That pattern nests a `<form>`; this one sits *inside* the event
`<form>`, so every button in it must be `type="button"` or it submits the form
it was meant to guard.

🪤 **Only a `"saved"` state clears the dirty flag.** `needs_confirmation`,
`invalid`, `overlap`, `conflict` and `error` all stay dirty: nothing was written,
the officer's values are echoed back into the fields, and losing them is
precisely the harm being guarded.

🪤 **The caps strip is a grep with two traps in it.** `EID` (×8) is an acronym,
not a styled label, and `INITIAL` (×4) is a constant identifier — both look like
hits. Final scope was **55 labels across 22 files**, more than the ~25 sites the
finding estimated, and the diff is 40 insertions / 40 deletions with no
structural change. 📌 It **finished a migration that was already half-done**:
`preset-row`, `merge-panel`, `export-toolbar` and `invite-create-form` were
already sentence case.

⚠️ **`npm test` cannot see ANY of this.** `tests/` is entirely server/lib/db;
there are no component or DOM tests. 1094 pass before and after, which proves
only that nothing server-side regressed — the same blind spot that let the
`members.active` defect ship with a green suite. **The browser walkthrough is the
verification.**

### ✅ Walked in a browser, and it found a defect (2026-08-31)

Local stack, local-only officer, revoked afterwards. Every one of the five was
exercised rather than inspected:

- **Guard:** armed on Cancel with the typed title intact, "Keep editing" restored
  it, "Discard" navigated — and it did **not** arm on a clean form. `beforeunload`
  proved itself by refusing the automation's own navigation while dirty. The
  confirm's buttons did not submit the form, so the `type="button"` trap holds.
- **Series:** a 6-event series with one already-cancelled occurrence read
  **"Cancel all 5 events in this series? This cannot be undone."** — the
  discrimination the whole fix exists for — beside "Publish all 3 drafts".
- **Disabled buttons:** all four disabled, `title` absent, reason on screen, and
  APPROVE selected the correct branch for the row's state.
- **Announcements:** the export toolbar's region went `""` → `"Working…"` outside
  any `aria-hidden` wrapper, with the visible copy `aria-hidden` so it is not
  read twice; the invite copy announced *"Invitation link copied to the
  clipboard."* from its own region while the panel's pre-existing one sat
  separate, exactly as designed.
- **Caps:** DOM `Sign out` / `Assign` under computed `text-transform: uppercase`.

🐛 **One defect, and only a browser could have found it.** The new DELETE
explanation rendered **"20 check-insrecorded"**: a space that is present in the
source at byte level did not survive into the server-rendered output
(`check-ins<!-- -->recorded`). Fixed with an explicit `{" "}`. 🪤 **A structurally
identical block in `series-actions.tsx` rendered correctly**, so it does not
reproduce by reading the source. Rule recorded in `docs/invariants.md`.

🪤 **Most of the session went to a local trap that was not a code defect at
all:** browsing the dev server on **`127.0.0.1` rather than `localhost`** makes
Next 16 treat `/_next/*` as cross-origin and block it, so **nothing hydrates** —
every control renders and none respond, with no console error. It is
indistinguishable from a broken branch until you read the dev-server log, which
says so plainly. Use `localhost`, or set `allowedDevOrigins`.

### Measured at the gate

**20 screens** — every officer route including all six detail pages — probed in
same-origin iframes at 1280. **166 contrast pairings, 0 failures**, smallest
**4.84:1**, each composited on the ground its text actually sits on. **0 controls
colliding with their ground** (was 36). **0 horizontal overflow.** **0 screens
throwing.** `npm run lint`, `npx tsc --noEmit` and `npm run build` clean; **1094
tests pass across 37 files**.

🪤 **One flake, recorded rather than hidden:** `tests/ratelimit.test.ts`'s
"a full window later" case failed once, mid-session, on a run that spanned local
midnight; it passed on both re-runs and on the final gate. It exercises
`lib/ratelimit` against the local stack and touches nothing this phase changed.

⚠️ **Phase 3's debt is still outstanding and phase 4 did not absorb it.**
`/attend`, `/leaderboard` and `/lookup` still carry the `--misa-muted`-on-Vellum
failure, and they were left standing rather than touched from outside their phase.
📌 **The officer confirmed that disposition on 2026-09-01:** it is fixed inside
phase 3, not before it.

---

## Phase 2 brief — the five content pages (BUILT — record follows this section)

**Scope:** `/about`, `/projects`, `/gallery`, `/officers`, `/contact`, plus the
error and not-found boundaries. Presentational only — no route, action, `lib/` or
schema change. `/attend`, `/leaderboard`, `/lookup` and `/admin` are **out of
scope** and must not be touched.

### Read first

1. [`../DESIGN.md`](../DESIGN.md) — the built v2 system, top to bottom. It is the
   source of truth again, and phase 2's job is to execute it, not extend it.
2. `CLAUDE.md`'s Invariants. They outrank every design skill without exception.
3. `app/(public)/page.tsx` and `_components/home-hero.tsx` — the worked example
   of a page on this system, including how families are declared in comments.

### Where the five pages actually are today

⚠️ **This subsection describes the pages BEFORE the phase ran, and two of its
instructions were reversed by it.** `/gallery`'s filter section did not keep its
`ground="white"` — the chips were deleted along with the invented categories they
sorted, so the reason for the white ground went with them. And the pages were
rebuilt from the home page's vocabulary rather than restyled in place. Read the
Phase 2 record below for what actually shipped.

All five still use **`PageHero`** (`components/ui/chevron-section.tsx`) and a
stack of `<Section>`s. They already sit on the v2 grey page ground, so **do not
read "it has the grey background" as "it has been done."**

| Page | Today | Notes |
|---|---|---|
| `/about` | `PageHero` + mission + history + FAQ + `<Partners />` | `Hatch` slots throughout; the FAQ band is a contact path, since `/contact` left the nav |
| `/projects` | `PageHero` + summary + project list + CTA | ⚠️ **Descriptions and photographs are coming later** (officer, 2026-08-19). Build the shape; leave the placeholders. |
| `/gallery` | `PageHero` + `GalleryGrid` (the one client component: filter chips + load more) | 🪤 Its filter section already carries `ground="white"` — `FilterChip` fills with the page grey. Keep it. |
| `/officers` | `PageHero` + a card grid | ⚠️ Headshots stayed `Hatch` **through phase 2**. 🔓 Superseded 2026-08-23: the roster was replaced and 11 of 13 now carry a photograph; `Officer.photo` exists and is optional. Two unattributable cards still render `<Hatch>`. |
| `/contact` | `PageHero` + contact details | 📌 **Routed but unlinked** from the desktop nav; still in the mobile sheet. |

### What phase 2 has to decide

- 🔴 **`PageHero` is the one shared thing all five carry, and phase 1 left it
  untouched on purpose.** Its `size="home"` branch is already unreachable — the
  home page uses `HomeHero` now. Phase 2 either rebuilds `PageHero` once (and
  every page inherits it) or replaces it per page. **Retire the dead `size="home"`
  branch either way.**
- **The layout-family budget applies per page, not per site.** A family used on
  the home page may be reused on `/about`; a family may not appear twice on
  `/about`. Families still unspent are listed in `DESIGN.md`.
- **`/about` and `/projects` are the two at real risk of the v1 failure** — both
  are long stacks of alternating image+text rows, which is exactly the ≤2
  consecutive splits cap and the `border-t` + `last:border-b` pattern §9.F bans
  outright.

### Constraints specific to this phase

- 🔴 **No new page may invent a fact about the club.** Copy comes from
  `lib/site.ts` and `lib/officers.ts`. `PRODUCT.md`: testimonials, member counts,
  placement stats, awards and press **do not exist**. Any new string is reviewed
  by the officer before it ships.
- ⚠️ **`GALLERY_ITEMS[].category` is a statement of intent, not a record.** The
  gallery filter sorts on it and it describes shots that do not exist yet.
- 🪤 **Any section carrying controls, chips or a table needs `ground="white"`** —
  four shared primitives fill with the page grey. This already bit once.
- 🪤 **`/contact` stays out of the desktop nav.** The nav cannot grow without
  re-measuring the wordmark clearance.
- **Error and not-found boundaries:** `app/(public)/error.tsx`,
  `app/(public)/not-found.tsx`, `app/error.tsx`, `app/not-found.tsx`,
  `app/global-error.tsx` all exist. 🪤 Boundaries use `unstable_retry`, not
  `reset`, and render `error.digest`. 🪤 One `loading.tsx` per route **or**
  granular `<Suspense>`, never both.

### The gate

Same bar phase 1 was held to: zero horizontal overflow at 390/768/1024/1280/1646,
every contrast pairing measured on the composited ground, 0 reveals hidden with
JS off, `npm run lint`, `npm run build` and the full suite green, and a browser
walkthrough of all five pages. Then stop for the officer.


---

## Phase 2 record (2026-08-19) — the five content pages

**Built and measured; waiting on the officer.** 15 files, presentational only.
`app/actions/`, `supabase/` and `proxy.ts` untouched; the only `lib/` changes are
copy constants and one build-time read.

### The instruction that changed the phase halfway through

🔴 **"These pages should follow the home page, not each existing page. The exact
words only are kept, not any formatting."** The first pass evolved each page from
its own v1 composition, which was the wrong reading. Every page was then rebuilt
out of the home page's vocabulary: the drawn navy `field` under the 60×60 grid,
the floating `.plate` leaning only at `lg`, the raised `.sheet`, the bento, and
one shared-rule plate per page. `DESIGN.md` carries the per-page family tables.

### What was decided in the phase

- **`PageHero` is rebuilt once, not replaced per page.** It has EIGHT call sites,
  not five: `/attend`, `/lookup` and `/leaderboard` render it too. They inherit
  the new hero and were added to every measurement at the gate; they were not
  redesigned. Its `size="home"` and `tagline` props were provably dead and are
  deleted.
- **`Partners` folded onto `<Section>`.** Phase 1 deferred it here because
  `/about` shares it. It had its own gutter, an off-scale `sm:pb-22` (88px,
  matching no pad step), a duplicate three-key ground map and a verbatim copy of
  `Headline`'s class string. It also had no width cap, so the logo row spread
  past 1400px while every other band stopped there.
- 🔓 **`/gallery` shows the 117 real photographs.** `GALLERY_ITEMS`,
  `GALLERY_FILTERS`, `GALLERY_FEATURE` and `GALLERY_TERM` are deleted along with
  the `Slot` and `GalleryCategory` types. Between them they asserted a term, a
  date and a taxonomy nobody supplied, and the filter chips sorted on the
  invented one. **Do not restore a category filter without a real
  file-to-category mapping.**
- **`/about` and `/contact` got real photographs**; the slot-to-filename table is
  the handback below. **Officer headshots and project cells stay placeholders**,
  for the reason photography does not answer.

### Defects found by measuring rather than looking

- 🐛 **`--misa-muted` on the grey page ground is 4.33:1 and fails AA.**
  `DESIGN.md` recorded 4.63:1 and called it the smallest margin in the system;
  both halves were wrong. Found by recomputing against a formula validated on the
  WCAG reference pairs. Three public sites moved to `--misa-secondary` (7.60:1).
  ⚠️ Phase 3's pages carry the same pairing in places and were left standing.
- 🐛 **The `/about` plate cluster's rotated boxes came out 1px apart.** At ±3° in
  a 3:2 frame each plate's bounding box grows `0.0168w` per side, so two
  neighbours ate the whole 16px `gap-tile`. This is the home-page hero's "two
  pixels by accident" repeating in a different section. `lg:gap-x-12` and the
  arithmetic are now written above the cluster; measured 33/34px after.
- 🐛 **`/projects`' lead bento cell was a 1284×550 sheet of bare hatch.** A 21:9
  frame at full page width, while the photograph is still a placeholder, reads as
  an error rather than as a pending shot. Reshaped to large-left plus two
  stacked, which closes the row exactly: 631 + 20 + 546 = 1197 against the lead's
  1197.
- 🐛 **The term `Pill` stretched to the full card width** in the two stacked
  cells. A flex COLUMN stretches its children across the cross axis and `Pill` is
  `inline-flex`; `self-start` fixes it. It appeared in two cells and not the
  third, which is what made it findable at all.
- 🐛 **The root `app/not-found.tsx` was still rendering on white.** The page
  ground lives on `(public)/layout.tsx`'s `<main>` and that file is outside it,
  so since 2026-08-19 it had been the one public-looking page on the wrong
  ground.
- 🐛 **The 404 recovery nav's `hover:bg-misa-panel` had silently stopped doing
  anything** the day the page ground became that same colour. Extracted to
  `components/ui/recovery-nav.tsx`, which also de-duplicates a destination list
  that was written out verbatim in two files.
- **`/officers`' trailing-row centring was a hardcoded `i === 10`**, hand-tuned
  for thirteen officers, sitting beside a comment that read "Fourteen cards". It
  is derived from `OFFICERS.length` now.

### Premises this phase falsified

- ⚠️ **"Presentational only" did not survive `/gallery` intact.** A masonry has
  to know each tile's height before the image loads. There are three ways to get
  that number: invent it (what the page did, and what phase 2 deleted everywhere
  else), force one ratio and crop (measured against the real pool: 62 of 117 are
  portrait, 39 landscape and 16 near-panoramic, so any single ratio crops the
  majority against their own grain), or read the file. `galleryPhotoEntries()`
  reads the JPEG/PNG header at build time — 25 lines, `node:fs` only, and
  deliberately **not `sharp`**, which is not a declared dependency of this
  project. Measured after: 0 of 24 tiles disagree with their file's real ratio.
- 🪤 **The browser automation tab runs at `visibilityState: "hidden"`, and that
  invalidates any reveal measurement taken through it.** A hidden tab fires no
  IntersectionObserver callbacks and advances no CSS transition, so a first pass
  reported "17 of 22 reveals stuck hidden" on the *shipped* home page. The reveal
  system was fine. **Measure the revealed-state CONTRACT instead**: inject
  `transition: none`, set `data-revealed`, read computed styles. Layout
  measurements (`scrollWidth`) stay valid in a hidden tab; anything time-based or
  paint-based does not.

### Measured at the gate

`scrollWidth − clientWidth === 0`, document and body, at **390 / 768 / 1024 /
1280 / 1646** on all five pages, plus `/`, `/attend`, `/lookup`, `/leaderboard`
and the 404 — every page that inherits the rebuilt `PageHero` or `Partners`.
No-JS: **0 of 57** reveals hidden across the five. Revealed-state contract: **0
of 57** fail. Contrast: every pairing at or above 4.5:1 on the composited ground,
smallest **4.84:1**. Gallery: 0 of 24 tiles mis-sized; Load more 24 → 48 → "48 of
117", with 0 appended tiles hidden and 0 carrying `data-reveal`. Lint, `tsc` and
`build` clean; **1024 tests pass across 34 files**.

⚠️ **A real-device mobile check is still outstanding.** The widths above are
same-origin iframe probes, which are a layout measurement and not a device.

### Photography this phase needs (handback)

**Confirm or swap these eight pairings.** ⚠️ They are inferred from the
photographs, not supplied. Nobody said which event any frame is from, and the alt
text is a careful reading of what is visible that deliberately asserts no date,
no term and no person.

| Slot | File |
|---|---|
| About, mission plate 1 | `misa-banquet-group-photo.jpg` |
| About, mission plate 2 | `11-6-25-misa-makenna-morgan-06.jpg` |
| About, mission plate 3 | `9-21-25-misaphotos-makennamorgan-075.jpg` |
| About, band 1 | `100-1253.jpg` |
| About, band 2 | `img-9880.jpg` |
| About, band 3 | `20241015-180617.jpg` |
| About, band 4 | `img-2848.jpg` |
| Contact | `20260411-103131-295ec3.jpg` |

🔴 **`/gallery`'s 117 photographs share ONE alt string**, "Photograph from a MISA
event". It is true of all of them and useful to nobody. Real descriptions need
somebody who was in the room; a generated one would be a confident guess about
identifiable students.

⚠️ **Project photographs and descriptions**, per the officer's 2026-08-19 note.
Giving a `PROJECTS` entry a `src` and an `alt` is the whole of filling each cell.

⚠️ **Officer headshots** remain blocked on the photo-to-name pairing, not on
photography.

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

⚠️ **The Ground column below is as of iteration 1 and is superseded by
iteration 4** — `paper` was retired, the light page ground became a flat grey,
the marquee band became the only declared `white`, and the strip was split in
two so it brackets Activities. The families and slot counts are unchanged.

| # | Section | Family | Ground | Slots | Grouping |
|---|---|---|---|---|---|
| 1 | Hero | Asymmetric Split Hero + plate cluster | `field` | 3 | negative space |
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

### Iteration 4 (2026-08-19, officer review) — and the ground the site now has

- 🐛 **`[data-revealed]` set `clip-path: inset(0 0 0 0)` on every revealed node**,
  which is not "no clip" but *clip to my own axis-aligned border box* — and a
  clip-path clips descendants. The reveal wrapper was slicing the corners off
  the hero's rotated plates, so they rendered as polygons rather than
  rectangles. Now `clip-path: none`; `wipe` keeps its own `inset()` rule
  because it is the one variant that animates the property.
  ⚠️ A first pass misread the same symptom as a border problem and moved the
  frame to an `outline`; **that was reverted** — a plain `border` is fine on a
  rotated plate once nothing is clipping it.
- **The hero cluster's overlap, tilt and stagger were arithmetic accidents.**
  Two pixels of overlap, 0.4px of stagger, a 1° lean. The angle went 15° → 8° →
  **4°** across review rounds, and **the arithmetic is written out above
  `PLATES`** so the next change has to answer it. 🪤 The rotated bounding box
  (`w·cosθ + h·sinθ`) is solved against the box on all four sides, which is why
  the box ratio came *down* as the angle did and the hero never got taller.
- ✂️ **All four seams around the gallery bands are 64px**, down from 112px, and
  the bands carry nothing but tiles — the "See all photos" card and the white
  band under it were both tried and reversed the same day.
- 🔓 **The light ground is a FLAT GREY, site-wide, and `paper` is retired.**
  `bg-misa-panel` on the public layout's `<main>` — not on `body`, which is what
  kept `/admin` white *(⚠️ until phase 4, which put the same grey on the admin
  shell's own `<main>`; `body` still is not the carrier, and that is what keeps
  white surfaces liftable on both sides)*. `Section`'s `white` was renamed `page` (paints nothing,
  inherits the grey) and a real `white` took the name, used only by the four
  sections that carry controls. Grounds run **field → grey → grey → grey → grey
  → field → grey**, with white reserved for cards and forms.
  - 🐛 **The audit that made it safe.** `controlClass`, the sticky `<THead>`,
    `FilterChip` and the neutral `Banner` all fill with `bg-misa-panel` — the
    exact colour the page became. They were **not** recoloured (all four are
    shared with `/admin`); the four sections that carry them took
    `ground="white"` instead. The officer's rule: *the grey is the background,
    cards stay white.*
  - ⚠️ `<Hatch tone="light">`'s lighter stripe **is** `#f2f2f3`, so a
    placeholder reads as half-visible stripes in a frame on the grey rather than
    a distinct box. Still legible; open, and possibly moot if photography ships.

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

### Iterations 4–5 (2026-08-18/19) — photographs, and the asset pipeline

🖼️ **The home page renders real photographs, locally only.** `pictures/` and
`public/photos/` are gitignored and the code carrying the `src` values is
uncommitted with them. They move together or production gets ~30 broken
images. See the build log for the two commit paths.

- **One folder per page.** `pictures/{home,about,projects,officers,gallery,_saved-site}`.
  `scripts/organise-pictures.mjs` sorts it (moves, never overwrites);
  `scripts/build-photos.mjs` renders `public/photos/` (clears output first).
- 🪤 **HEIC needs `heic-convert`.** libvips ships HEIF for AVIF only, and
  `.metadata()` reads the header fine — so a probe will NOT reveal the failure.
  40% of the library is HEIC. This falsified a premise in the plan for the round.
- 🔓 **The marquee draws from `public/photos/gallery/`** via `lib/gallery-photos.ts`,
  read at build time, **hash-ordered** (alphabetical clustered near-identical
  frames; random would break build reproducibility), capped at 12 per band, and
  falling back to `<Hatch>` when the directory is absent — which is production.
- ⚠️ **The marquee is split in two and therefore appears TWICE**, against §5 and
  against the no-repeats budget. Seven sections, six families. Argued in
  `_components/gallery-marquee.tsx`; the rest of the budget still holds.
- **Activities** is Leadership (small) / Professional (large) over Social (large) /
  Workshops (small). `ACTIVITIES` and `CELLS` are index-locked.
- **Hero**: three plates, overlap cut to a quarter, pair fanned +1°/−1°.
  ⚠️ That grew the hero to 764px, so it no longer fits a 790px viewport at 1440+.

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

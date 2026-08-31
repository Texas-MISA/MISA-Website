# Tasks

Short-horizon working list. The full plan lives in [`docs/student-org-website-architecture.md`](docs/student-org-website-architecture.md); section refs (§) point there. Refill **Later** as stages are reached.

**Stages 0–8 are ALL COMPLETE. ⬅️ Stage 9 (launch) is the next task** — see the state table below, which is authoritative. *(This line said "Stage 7 is next" until 2026-08-29; stages 7 and 8 closed long before that and the header simply never moved.)* The stage was re-planned on 2026-08-01 after four design decisions landed on top of phase 1. Carry-over chores from Stage 0 are collected under Loose ends.

---

## 🏗️ IN PROGRESS — v2 visual redesign of the whole site (2026-08-17)

Plan in [`docs/frontend-redesign-v2-plan.md`](docs/frontend-redesign-v2-plan.md). **✅ Phase 0 complete. ✅ Phase 1 (home page + header) COMPLETE — gate passed 2026-08-19 after four rounds of officer review. ✅ Phase 2 (the five content pages) BUILT and measured, awaiting officer review. ✅ Phase 4 (`/admin`) BUILT and measured 2026-08-29, awaiting officer review. ⏸️ Phase 3 is DEFERRED, not skipped — see below.**

🌿 **PHASE 4 LIVES ON THE BRANCH `v2-phase-4-admin`**, cut from the roster-terms
commit rather than from `main`, so the screens it styles are the term-aware ones
migration 29 produced. ⚠️ **Do not merge it without the officer.**

### ✅ Phase 4 — `/admin`. BUILT, awaiting review. (2026-08-29)

Taken out of order on the officer's instruction: phase 4 was asked for before
phase 3. Three commits, presentational only — no route, action, `lib/`, view or
schema change.

📌 **The phase was ADOPTION, not composition.** `PageHeader` and `SectionHeading`
had **zero call sites in the whole repository**, `Table` had zero admin ones, and
`Panel` had one — all four written *for* `/admin` and never wired up, while 25
pages repeated one h1 class string verbatim and 11 raw tables carried 47 copies
of one head-cell string.

🔴 **The ordering is the part worth remembering: wrap the screens in white
surfaces FIRST, flip the ground LAST.** Five shared primitives fill with
`bg-misa-panel`, which is exactly what the page ground became — so the reverse
order gives a branch that looks finished and is measurably broken. Done this way
every intermediate commit stayed shippable and the flip was one line.

**What measuring found that looking did not:** 36 controls the exact colour of
the page behind them; a loading skeleton that went invisible; `--misa-muted` on
Vellum failing AA in four new places (📌 **the rule is about a ground moving
under ink, not a list of pages**); the disabled Audit nav item at 3.39:1; and the
empty-vs-error conflation still alive in the interactive states Stage 8 phase 3
never reached.

🔴 **Three screens were throwing outright, and it was NOT the redesign.**
`members.active` was dropped by migration 29 and three `.select()` strings still
named it, so the submission detail, dues detail and points ledger all rendered
the error boundary. **The full suite was green with the bug live** — no test
covers a PostgREST column list and `tsc` cannot see inside a select string. It
took loading the pages.

**Gate:** 20 screens, 166 contrast pairings, **0 failures**, smallest 4.84:1;
0 control/ground collisions; 0 overflow; 0 screens throwing; lint, `tsc`, build
clean; **1094 tests pass**.

**The accessibility review returned 28 findings.** Everything in a component this
phase created or changed was fixed — including two that **undercut earlier work
on the same branch**: the Audit nav item was still keyboard-unreachable
(`disabled` removes an element from the tab order, so the contrast fix was spent
on something nobody could focus), and the loading skeleton's `sr-only`
announcement sat inside its own `aria-hidden` wrapper.

✅ **The five findings that wanted the officer are ALL DECIDED AND BUILT
(2026-08-31)**, five commits `b4898f4` → `cf00cfb`, one per finding:

1. ✅ Unsaved-changes guard — **event form only** (officer's call; the notes
   editor is deliberately left alone). Guards **Cancel and browser unload only**;
   the admin nav and browser Back/Forward are honestly out of reach.
2. ✅ "CANCEL WHOLE SERIES" now has the two-click confirm, **naming the count**.
3. ✅ Visible copy on **all four** disabled buttons; the `title`s are removed so
   each sentence has one source rather than two that can drift.
4. ✅ `aria-live` on the invite-link copy **and the export toolbar**.
5. ✅ Caps stripped — **55 labels, 22 files**, its own commit, 40 insertions /
   40 deletions and no structural change.

🔴 **Two of the five were wrong about the code, and finding out cost more than
fixing them.** #4 named the inline field-cell saves, which have had
`role="status"` all along — the real gap was the export toolbar. #3 said "two"
disabled buttons; there are **four**. A review is a set of claims, not an
inventory.

🔴 **The series cancel was worse than recorded:** it updates on `series_id` with
no status *and no date* filter, so it cancels past and already-cancelled events
too, with no series-level undo. Narrowing the action was offered and **not
chosen** — a deliberate non-change, not an oversight.

✅ **VERIFIED IN A BROWSER (2026-08-31)**, against the local stack behind a
local-only officer that was revoked afterwards. All five exercised for real:
the event-form guard armed on Cancel and **did not** arm on a clean form, and
`beforeunload` fired (the automation's own navigation was refused); the series
confirm read **"Cancel all 5 events in this series?"** on a 6-event series
holding one already-cancelled occurrence — the count the fix exists to get
right; all four disabled buttons showed their reason on screen with the `title`
gone; the invite copy announced *"Invitation link copied to the clipboard."* in
its own region; and the caps strip proved out as sentence-case DOM under
`text-transform: uppercase`.

🐛 **The walkthrough found one defect, and nothing else could have.** The new
DELETE explanation rendered **"20 check-insrecorded"** — a space that is present
in the source did not survive into the server-rendered output. Fixed with an
explicit `{" "}`. **lint, `tsc`, `build` and 1094 tests were all green with it
live**, which is the same lesson as the `members.active` defect: a green suite
is not verification of a UI change.

🪤 **A local trap that cost most of the session and is not a code defect:**
browsing the dev server on **`127.0.0.1` instead of `localhost`** makes Next 16
block `/_next/*` as cross-origin, so **no page hydrates** — every control
renders and nothing responds. It looks exactly like a broken build. Use
`localhost`, or set `allowedDevOrigins`.

⏸️ **Phase 3 is deferred and its debt is NOT absorbed.** `/attend`,
`/leaderboard` and `/lookup` still carry the `--misa-muted`-on-Vellum AA failure;
they were left standing rather than touched from outside their phase.

🌿 **PHASE 2 LIVES ON THE BRANCH `v2-phase-2`, NOT ON `main`** (officer, 2026-08-19). It is ahead of `main` and 0 behind, so it merges as a fast-forward. ⚠️ **Do not merge it without the officer** — a merge to `main` replaces the live club website at https://www.txmisa.org.

### 🔓 Officer roster replaced, real logo, centred page heroes (2026-08-23)

Three officer instructions, same branch, same day as the projects change below.

- **The officer roster is REPLACED WHOLESALE**, from the officer's saved copy of
  the live Squarespace page. Full turnover: six new people, seven returning in
  different roles, six gone. Two new roles — **Client Project Lead** and **Data
  Project Lead** — replace Project Vice President and Junior Director Vice
  President.
- 🪤 **The name→photo pairing came off the page's CSS GRID GEOMETRY, not its DOM
  order**, and that is the part worth remembering. A Squarespace fluid-engine
  page positions the image, the name and the role as three *sibling* blocks with
  `grid-area` rules in a `<style>` tag; document order does not match reading
  order. Every `alt` was empty. It was then checked by eye against a rendered
  contact sheet.
- ✅ **RESOLVED the same day — two officers shared ONE photograph on the source
  page.** Daniel Chen and Sanya Pillai, the same asset uuid referenced twice.
  One was wrong and nothing attributed it, so both rendered the labelled
  `<Hatch>` rather than putting a real student's face under another student's
  name. **The officer settled it out of band**, naming the shared file as
  Daniel's and supplying a genuinely different photograph for Sanya. Both cards
  now draw a real, distinct image; all thirteen officers have one. See the two
  comment blocks in `lib/officers.ts`.
  📌 **`photo` stays OPTIONAL even so** — the optionality IS the rule, not a
  leftover of it: the next officer added arrives without a photograph and must
  render `<Hatch>` rather than borrow somebody else's.
  *(This bullet claimed both were still placeholders until 2026-08-31. They had
  not been since 2026-08-23; the line simply never moved.)*
- ⚠️ **The new page carries NO per-officer LinkedIn links** — only MISA's own
  company page. `linkedin` is optional now: the seven returning officers keep the
  URLs the old roster had (same people), and the six new ones have none. A
  plausible-looking URL would point a public link at a stranger.
- ✂️ **"2025–26 Officer Team" lost its year.** The new roster makes it false and
  the source page names no year anywhere. ⬅️ **Tell me the academic year** and it
  goes back in one line.
- 🔓 **The real logo replaced the CSS wordmark**, which had said "swap in the
  real asset when it lands" since Stage 2. 🪤 The file is **white artwork on
  alpha** and the site needs the mark in navy *and* white, so it is applied as a
  CSS **mask** over `background: currentColor` — an `<img>` would have forced
  either a second recoloured file or a `tone` prop, and both move the colour
  decision away from the caller. Sized by height (43px, matching what it
  replaced); width grew 48 → 82px.
- 🔓 **`PageHero` is CENTRED**, reversing phase 2's left-alignment. One component,
  so all eight pages that render it moved together.
- **Verified:** `tsc`, lint and `npm run build` clean; all 13 officer cards
  render with the right role; the logo confirmed navy on the public header and
  white on the admin login; all eight chevron heroes centred.

### ✂️ Home-page projects band cut to two, and `/projects` UNLISTED (2026-08-23)

Officer instruction, on the same branch. **Temporary** — every part of it is
written to be reversed.

- **`/projects` is unlisted, not deleted.** The route resolves, the page renders,
  it is linked from nowhere, and it carries `robots: { index: false, follow: false }`.
  🔓 **Relisting is exactly four places**, each commented and each naming the
  others: `SITE_NAV` and `MOBILE_NAV` in `components/site-header.tsx`, the
  `robots` key in `app/(public)/projects/page.tsx`, and the "All projects →" link
  on the home page's band.
- **The band went from four cells to two** — PepsiCo and Casa de Luz. The fourth
  was `PROJECT_PLACEHOLDER`, which is deleted; `lib/site.ts` keeps a comment
  recording what it was and why it named no client, because that reasoning still
  binds if a filler cell is ever needed again. CapMetro is still in `PROJECTS`
  and still on `/projects`.
- **The cells carry the FULL `/projects` descriptions**, not the one-line
  summaries, and `summary` is deleted from `PROJECTS` rather than left to rot on
  one side. 🪤 With `/projects` unlisted, this band is the club's only public
  statement about the projects programme — there is no page behind it to go on
  to, which is the whole reason the longer text belongs here.
- 🔓 **The project cells got real photographs, which reverses a standing rule** —
  see the photography invariant in `CLAUDE.md`. The distinction is that these are
  photographs **of the client**, not of MISA.
- 🐛 **`MOBILE_NAV` was `SITE_NAV.slice(0, 4)`, and unlisting a page broke it
  silently.** The slice meant "without Admin" only because Admin sat at index 4;
  one item shorter, it swept Admin in and the panel rendered it twice. It now
  drops Admin by href.
- ⚠️ **The two photographs are the lowest-resolution images on the site** —
  1048px and 850px wide into a 699 CSS px slot. Fine at 1×, soft at 2×. They were
  adequate for the 4-up band's ~350px cells. **Higher-resolution originals are
  the only fix**; nothing in code helps. `cap-metro.jpg` (1600px) and
  `chicago-crime.jpg` (1140px) are built and unreferenced.

### ✅ Phase 2 — the five content pages. BUILT, awaiting review.

`/about`, `/projects`, `/gallery`, `/officers`, `/contact`, plus the error and
not-found boundaries. 15 code files plus 3 docs. No route, action, migration or
schema change; the only `lib/` changes are copy constants and one build-time read.

🔴 **The instruction that shaped it: rebuild each page FROM THE HOME PAGE, not
from its own v1 layout. The exact words are kept and nothing else is.** A first
pass evolved each existing composition and was thrown away. The shared devices
are the drawn navy `field` under the 60×60 grid, floating `.plate` photographs
leaning only at `lg`, the raised white `.sheet`, the bento grid, and one
shared-rule plate per page. `DESIGN.md` carries the per-page family tables.

**What it decided:**

- **`PageHero` rebuilt ONCE**, on `ground="field"` and left-aligned *(⚠️ the
  alignment was reversed to CENTRED on 2026-08-23 — see the entry above; the
  rest of this bullet still holds)*, with its
  dead `size="home"` and `tagline` props deleted. ⚠️ **Eight pages render it** —
  the five above plus `/attend`, `/lookup` and `/leaderboard`, which are phase 3.
  They inherit it, were not redesigned, and were measured at the gate.
- **`Partners` folded onto `<Section>`**, which phase 1 deferred here because
  `/about` shares it.
- 🔓 **`/gallery` shows the 117 real photographs.** `GALLERY_ITEMS`,
  `GALLERY_FILTERS`, `GALLERY_FEATURE` and `GALLERY_TERM` are deleted with the
  `Slot` and `GalleryCategory` types: they asserted a term, a date and a taxonomy
  nobody supplied, and the page's one control sorted on the invented one.
- **`/about` and `/contact` got real photographs.** Officer headshots and project
  cells stay placeholders, for the reason photography does not answer.

**Seven defects found by measuring rather than looking:**

- 🐛 **`--misa-muted` on the grey page ground is 4.33:1 and FAILS AA.**
  `DESIGN.md` recorded 4.63:1 and called it the smallest margin in the system;
  both halves were wrong. The rule that replaces the number: **muted may sit on
  Paper, never on Vellum.** Three public sites fixed. ⚠️ `/attend`, `/lookup`,
  `/leaderboard` and `/officer-invite` have the same pairing in places and were
  left standing — **that is phase 3's to fix.**
- 🐛 `/about`'s rotated plates came out **1px apart**: at ±3° in a 3:2 frame each
  plate's bounding box grows `0.0168w` per side and ate the whole 16px gap. The
  home hero's "two pixels by accident", recurring. Arithmetic now written down.
- 🐛 `/projects`' lead bento cell was **550px of bare hatch** at full page width.
- 🐛 The term `Pill` stretched to full card width — a flex COLUMN stretches its
  children across the cross axis and `Pill` is `inline-flex`.
- 🐛 The root `app/not-found.tsx` was still rendering **on white**, since the page
  ground lives on `(public)/layout.tsx`'s `<main>` and that file is outside it.
- 🐛 The 404 recovery nav's `hover:bg-misa-panel` had silently stopped doing
  anything the day the page ground became that colour.
- 🐛 `/officers`' trailing-row centring was a hardcoded `i === 10` beside a
  comment reading "Fourteen cards"; it is derived from `OFFICERS.length` now.

**Measured at the gate:** `scrollWidth − clientWidth === 0` at 390/768/1024/1280/1646
on all five plus `/`, `/attend`, `/lookup`, `/leaderboard` and the 404. **0 of 57**
reveals hidden with JS off; **0 of 57** fail the revealed-state contract. Every
contrast pairing ≥ 4.5:1, smallest **4.84:1**. Gallery: 0 of 24 tiles mis-sized,
Load more 24 → 48 with 0 appended tiles hidden. Lint, `tsc`, `build` clean;
**1024 tests, 34 files.**

🪤 **The browser automation tab runs at `visibilityState: "hidden"`, which
invalidates any reveal measurement taken through it** — no IntersectionObserver
callbacks, no CSS transitions. An early pass reported "17 of 22 reveals stuck
hidden" on the *shipped* home page. Measure the revealed-state CONTRACT instead:
inject `transition: none`, set `data-revealed`, read computed styles. Layout
measurements stay valid in a hidden tab; anything time- or paint-based does not.

⚠️ **A real-device mobile check is still outstanding.** The widths are
same-origin iframe probes, which are a layout measurement and not a device.

🔴 **Handback, needing the officer:** eight `/about` and `/contact`
slot-to-filename pairings to confirm or swap (inferred from the photographs, not
supplied); `/gallery`'s 117 photographs share ONE generic alt string, and real
descriptions need somebody who was in the room; project photographs and
descriptions; officer headshots, still blocked on the photo-to-name pairing
rather than on photography.

⚠️ **A v1 redesign was built and SCRAPPED.** It survives on the abandoned branch `redesign-stage-1` (tip `60ca71d`) as a record; `main` was never touched. It was rejected as bland, lacking depth, with image slots concentrated into one section and a scattered, same-ey layout. Each of those turned out to be a named rule in `design-taste-frontend` that v1 read too late or not at all. The root cause was process: v1 treated the skills as advisory and hand-rolled everything, against §2's *"do not invent CSS for things that have an official package."* The v1 plan, [`docs/frontend-redesign-plan.md`](docs/frontend-redesign-plan.md), is **superseded**.

| | |
|---|---|
| Primary design authority | **`design-taste-frontend`**, for the duration |
| Locked | The **word content**, verbatim, and the **navy + white colour scheme** |
| Open | Type, layout, depth, shape, grounds, motion, components |
| Scope | **Every surface**, `/admin` included |
| Foundation | **shadcn/ui** (+ `motion`, Lucide icons) |
| `DESIGN.md` | ✅ **The design source of truth again** — rewritten 2026-08-19 from what phase 1 shipped. *(This row read "Retired, except seven engineering rules" during the v2 retirement; that ended when the file was rewritten.)* |

📌 **"Colour scheme" is not "flat white ground."** Gradients, tinted fields and drawn backgrounds are in play so long as they are built from the palette. A plain white page behind everything is a large part of why v1 read as bland.

📌 **Many image slots, in every section** — the reverse of v1. This is §4.8's sanctioned path for a project that cannot ship photography, and each phase hands the officer a list of the shots needed.

🪤 **`shadcn init` is destructive here and must not be run unsupervised.** It overwrote `components/ui/button.tsx`, which **45 files** import, deleted `--background`/`--foreground` from `globals.css`, injected Geist into `layout.tsx`, and wrote a circular `--font-sans: var(--font-sans)`. If re-run: keep `components.json`, `lib/utils.ts` and the dependencies, revert everything else, hand-apply the CSS. Components now write to `components/shadcn/`.

🔴 **No new page may invent a fact about the club**, and per the officer any new copy is **reviewed before it ships**. `PRODUCT.md`: testimonials, member counts, placement stats, awards and press do not exist.

**Phase 1 is built and waiting on the officer.** Six files, presentational only. The layout-family budget was declared before any markup and is named per section in code comments: Asymmetric Split Hero → Kinetic Marquee → Editorial Manifesto → Bento Grid → Featured-plus-rest → Shared-rule logo plate. **Six sections, six families, none repeated.** Image slots now sit in every section (four in the hero, two flanking the mission) rather than concentrated in the marquee band.

Measured at the gate: zero horizontal overflow at 390/768/1024/1280/1646, hero fits the viewport at every width, headline 2 lines everywhere, nav one line at 61px with 277/304px wordmark clearance at 1280, **0 of 21 reveals hidden with JS off**, every contrast pairing ≥4.5:1 on the composited ground, 1022 tests green.

🖼️ ~~**REAL PHOTOGRAPHS ARE LIVE ON THE HOME PAGE — LOCALLY ONLY, AND NOTHING IS COMMITTED.**~~ ✅ **RESOLVED THE SAME DAY: the officer took path 1 and the photographs were COMMITTED (2026-08-19).**

`public/photos/` now holds **141 tracked images** — home 9, projects 4, officers 11, gallery 117 — live on the home page and, since v2 phase 2, on `/about`, `/contact` and `/gallery`, plus the project cells and the officer headshots since 2026-08-23. `pictures/` (the officer's raw library) stays gitignored and nothing serves from it. ⚠️ The 4 files in `public/photos/projects/` are the **clients'** premises and staff rather than students — the same irreversibility applies to those faces, with none of the club's consent behind them.

The two paths this entry was weighing, kept because the reasoning still applies to the next batch:

1. **Commit the photographs too.** ✅ **This is what happened.** It needed the officer's sign-off on the people in them, because **the repository is public** and a face in a public git history is not something a later commit takes back. 🔴 **That half is permanent: a removal request is a history rewrite and a force-push, and even that does not reach forks or caches.**
2. ~~**Commit the plumbing with every `src` stripped.**~~ Not taken. Production would have kept `<Hatch>` placeholders and the photographs would have stayed a local preview.

**The workflow, once it is set up:** drop a photo in `pictures/<page>/`, run `node scripts/build-photos.mjs`, refresh. `scripts/organise-pictures.mjs` sorts a messy `pictures/` into one folder per page and pools anything unnamed into `gallery/`.

🪤 **HEIC does not decode without `heic-convert`, and `.metadata()` will not warn you** — the header read succeeds and only a real decode fails. 40% of the library is HEIC. This is written up in `docs/build-log.md`.

**Where the home page stands (iteration 4, 2026-08-19):** hero is three plates — one wide at the front, a fanned pair below leaning **±4°**, genuinely overlapping and staggered, with the bounding-box arithmetic written out above `PLATES` because the previous overlap was two pixels by accident; the mission sheet sits on the grey page ground; the gallery strip is **split into two counter-scrolling bands**, both on the grey and carrying nothing but tiles; Activities is a four-cell bento ordered Leadership/Professional over Social/Workshops; Projects is a symmetric 2×2 that **still uses placeholders**, because pairing a photo to a named client is a factual claim.

🐛 **The defect this iteration existed to find: `[data-revealed]` set `clip-path: inset(0 0 0 0)` on every revealed node.** That is not "no clip" — it is *clip to my own axis-aligned border box*, and a clip-path clips descendants, so the reveal wrapper was slicing the corners off the rotated plates. They rendered as polygons, not rectangles, and their frame was cut with them. Now `clip-path: none`, with `wipe` keeping its own `inset()` rule because it actually animates the property. ⚠️ **A first pass misdiagnosed the missing frame as a border-vs-rasterised-layer problem and moved it to an `outline`; that was reverted** — a plain `border` renders perfectly on a rotated plate once nothing is clipping it.

🔓 **The public page ground is a flat grey (`#f2f2f3`) site-wide.** `bg-misa-panel` on the public layout's `<main>` — 🪤 not on `body` — and that still holds now that `/admin` has the same ground: the admin shell paints its OWN `<main>` (phase 4), and `body` stays `#ffffff` on both sides so white surfaces have something to lift off. `Section`'s `white` ground was renamed `page` and a real `white` took the name; `paper` and `.ground-paper` were retired. 🐛 The audit that made it safe: `controlClass`, the sticky `<THead>`, `FilterChip` and the neutral `Banner` all fill with the *same* `bg-misa-panel`, so `/attend`, `/lookup`, `/leaderboard` and the gallery filter bar took `ground="white"` rather than those four shared primitives being recoloured. **The grey is the background; cards stay white.**

✂️ **All four seams around the gallery bands are 64px at desktop**, down from 112px. The mission and Activities gave up their `lg` steps. 📌 The bottom band's `padBottom` is one step larger than its `padTop`, because below it the navy Projects field starts immediately and there is no light neighbour to bring the other half.

⚠️ **Open, minor (1):** `<Hatch tone="light">`'s lighter stripe is `#f2f2f3`, the grey's own colour, so a placeholder now reads as half-visible stripes in a frame rather than a distinct light box. Legible via the darker stripe, the hairline and the caption; possibly moot if the photography ships.

🪤 **The hero's middle overlap must be measured ALONG THE SEAM, not read off the `left` values.** At ±4° the two tilted edges swing ±8px about their own centres, so a nominal 15px of overlap was really −2px at the bottom tip — a visible sliver of field. A 15px nudge on the bottom-left plate closed it; the seam now runs 45px at the top to 13px at the bottom. The lower pair also swapped stacking order (bottom-right over bottom-left), so `PLATES`' source order no longer matches paint order.

⚠️ **Two things the officer should look at:**
1. **The marquee now appears twice**, against §5's max-one-per-page and the budget's no-repeats rule. Argued and recorded, but it is the one exception on the page.
2. **The hero no longer fits a 790px-tall viewport at 1440+** (764px tall). Reducing the plate overlap is what cost it; more overlap or a shorter plate is the only way back.

✂️ ~~`PROJECT_PLACEHOLDER` in `lib/site.ts` is still a placeholder and still needs a real fourth project.~~ **Resolved by deletion on 2026-08-23**: the band was cut to two cells, so there is no fourth cell to fill. `lib/site.ts` keeps a comment recording what the constant was and why it named no client.

🔄 **Iteration 1 landed** (officer review of the built page): depth generalised to the rest of the page (`ground-paper` + `paper-grid`, grounds now run field → white → paper → white → field → paper); the hero plates now **enlarge** on hover rather than nudging; plate borders made consistent via an opaque `--misa-plate-edge`, because `--misa-border` is an alpha colour and resolved differently over a plate than over the field; and Projects is a symmetric 2×2 with `PROJECT_PLACEHOLDER` in the fourth cell.

🔴 **`PROJECT_PLACEHOLDER` in `lib/site.ts` is a placeholder and must be replaced.** It names no client, term or scope on purpose. Adding a fourth entry to `PROJECTS` and deleting the constant is the whole swap; the band renders whatever the array holds.

🔴 **Three things need the officer before phase 2 starts:**
1. **A light hatch on the navy hero field**, which departs from `hatch.tsx`'s never-mixed rule. The reason is that the plates overlap and navy-on-navy gave no separation — and a navy-tinted shadow composites to nothing on a navy ground, so the frame could not rescue it either.
2. **No hero CTA.** Refused because the sticky header carries Check In above the fold at all times and adding one means authoring a string on a page whose copy is locked. Reversible if the officer supplies a locked label.
3. **A real-device mobile check.** The breakpoint numbers are same-origin iframe probes, which are a layout measurement and not a device.

⚠️ **Zero shadcn components were added**, which falsifies the plan's premise that phase 1 would be the first `shadcn add`. The home page has no dialog, popover, select or form control to own; the first genuine candidates are phase 2 and phase 4.

**Next after the gate: phase 2** — `/about`, `/projects`, `/gallery`, `/officers`, `/contact`, error and not-found boundaries. `PageHero` and `Partners` are both deliberately untouched by phase 1 and belong to it. §14 Final Pre-Flight is a gate before every review, not advice.

---

## 📋 Requested, planned, NOT STARTED — RSVP events (2026-08-19)

A second kind of event: members RSVP through a shareable link instead of using `/attend`, and officers tick people off the list to write their attendance. Full plan, with the schema, the six phases and the test list, in [`docs/rsvp-events.md`](docs/rsvp-events.md). **Nothing is built** — no migration, no route, no action.

**Three things to settle before any code**, all in the plan's *Open decisions*:

1. 🔴 **Does the no-show penalty involve points?** The plan recommends **no** for v1. A published "you may lose points" is the first thing in this system that makes points *cost* something, which is the explicit trigger to re-read §9 #5, #6, #9, #10 and #12 together. Officer discretion + future RSVP access is the version that keeps the premise intact.
2. 🔴 **There is no officer-facing "create a member" screen** — verified, `/admin/members/new` does not exist. An RSVP from a genuine newcomer has nowhere to land. The plan recommends building it as phase 0.
3. **Do RSVP events count in the attendance-rate denominator?** Recommend yes (unchanged), unless the event is capacity-limited.

🪤 **The part most likely to be got wrong:** "members cannot use `/attend` for an RSVP event" is **three SQL changes** — `open_event_at()`, `nearby_events()` *and* the `events_no_overlapping_checkin` predicate. Doing only the first leaves the rule holding on the happy path and leaking through the pending queue.

⚠️ **The disclaimer copy is a fact about the club** and the officer authors it; it lives in `lib/site.ts`. And there is **no SMTP**, so nobody gets a confirmation email — the on-screen state is the whole receipt.

---

## Done — Site-wide visual rework; DESIGN.md is now the design authority (2026-08-17, doc v1.67)

Requested as "a comprehensive rework of the misa website — core logic remains, just visuals are edited". **No migration, no Server Action, no route, no query, no schema change.** ~90 files, presentational only.

🔓 **The design authority moved, reversing v1.58.** The handoff is five desktop-only prototypes with no breakpoints authored, no focus/hover/disabled/empty/error states, and nothing for `/admin` (75 files), `/attend`, `/leaderboard`, `/lookup`, `/contact` or `/officer-invite`. So most of the interface had no source of truth, and that is where the drift was. `DESIGN.md` now covers all of it; the identity is unchanged. **`DESIGN.md`, `PRODUCT.md` and `.impeccable/design.json` are committed** — the binding spec was living on one laptop.

📌 **The drift, measured, which is the case for the whole exercise.** `/admin` imported **two** things from `components/ui/`. It had **37 `rounded-full` pills** across 26 files against a system whose first rule is `rounded: none`, **three** button dialects, a local `Field` **redefined verbatim in nine files**, an input class redeclared in **eleven files with four distinct values**, the status pill reimplemented **four times plus ~15 inline**, and the `notice.tsx` literal written out **26 times across 20 files** while 12 files imported the component that already existed.

📌 **New in the system, not merely tidied:** a spacing scale and easing/duration tokens (`@theme` had none at all); a three-ink **status palette** with washes, replacing ~40 uses of raw Tailwind `red-700`/`amber-700`/`green-800`; **five reveal variants** chosen by what an element is; themed browser surfaces (selection, caret, scrollbar, underline offset); **row hover** in the shared `Table` component (⚠️ NOT on the admin tables themselves — none of them used the component until v2 phase 4, so the hover shipped unreachable and this line overstated it for twelve days); one disabled threshold where three were in use; and a keyboard-reachable disabled nav item where a `<span>` had been invisible to assistive tech.

🪤 **Two defects found by measuring rather than looking.**
- A lateral reveal offset of 24px against the 20px phone gutter gave every phone a horizontal scrollbar until the rows revealed — 390px: `scrollWidth` 379 vs `clientWidth` 375, on `/`, `/about` and `/projects`. The travel is now `md`-and-up, which is also right compositionally since those rows are one column on a phone.
- **`data-reveal` on a node that mounts after first paint never gets observed**, so its unconditional `opacity: 0` is permanent. `/attend`'s terminal result panel — the one screen whose job is telling a member their attendance was recorded — would have rendered blank. Both sites now carry a comment.

⚠️ **Mobile is measured for the first time.** v1.58 shipped breakpoints that were "reasoned rather than measured" and flagged it as a launch blocker; zero horizontal overflow is now confirmed on all nine public routes at 390 and 768. **A real-device check is still outstanding.**

📌 **Skill conflicts are settled in `DESIGN.md`, with reasons, so they are not relitigated each turn.** Refused: dark mode, real imagery, the eyebrow ban, mono-as-costume, the 65–75ch measure, one-marquee-per-page, the em-dash ban, "no oversized H1". Adopted: no coloured border-left above 1px, entrance variety, themed browser surfaces, emil's easing and durations.

**Verified:** `npm run lint`, `npx tsc --noEmit`, `npm run build` and `tests/docs.test.ts` all clean; `npx supabase start` rebuilt the stack from migrations + seed; browser pass over the nine public routes plus `/admin/login`; nav wordmark clearance re-measured at 1646 (left group ends x=331, wordmark starts x=791 — unchanged).

✅ **CLOSED by v2 phase 4 (2026-08-29).** `/admin`'s authed screens were walked in a browser against local seed data — 20 screens, 166 contrast pairings, 0 failures — behind a **local-only dev officer created for the walkthrough and revoked after**, which is how the sign-in problem was solved without anyone typing a real password. `web-design-guidelines` was run: 28 findings, the ones in phase-4 primitives fixed and five listed above for the officer. ⬅️ **Still open:** `.impeccable/design.json`'s `components` array carries pre-rework demos (hand-synced rather than regenerated, because `/impeccable document` would overwrite DESIGN.md's hand-written reasoning).

---

## Done — UI design skills installed (2026-08-16, doc v1.66)

Requested by pointing at `docs/install-ui-skills.md` and saying to execute it. Tooling only — no application code, no migration, no route. Four skills in `.claude/skills/`: `emil-design-eng`, `design-taste-frontend`, `web-design-guidelines`, `impeccable`. One skill taken from each bundle, not all 10 / 13 / 9.

📌 **The precedence rule is the deliverable, not the install.** It is in `CLAUDE.md` under *Design skill precedence*, and it splits on **designed vs. undesigned surfaces** rather than the install doc's "one primary aesthetic skill per project" — the handoff already governs the five prototyped public pages, so the skills lead only on `/admin`, `/attend`, `/leaderboard` and `/lookup`.

⚠️ **Expect every one of them to propose photography.** The no-photography invariant outranks them; the `<Hatch>` placeholder is the answer, and the suggestion recurring is not a defect.

🪤 **Impeccable's hook is live** — after every `Edit`/`Write` and at end of turn, context injection only, cannot block or write. Rollback is deleting `.claude/settings.local.json`.

**Closed 2026-08-17:** `/impeccable init` and `/impeccable document` were both run, writing `PRODUCT.md`, `DESIGN.md` and `.impeccable/design.json`. All three are now **committed** — see the v1.67 entry above, where `DESIGN.md` also became the design authority for the whole site.

---

## Done — Gallery band and mission swapped on the home page (2026-08-15, doc v1.65)

Requested directly. Two files. The band opens the page under the hero; the mission follows it.

🪤 **The padding moved with them, because the hero donates none.** Its `pb-28` is consumed by the chevron notch, so the next section starts at the notch's tip. The band takes `pt-14 sm:pt-16` — the mission's old padding for that slot — and the mission drops to `pb-5 sm:pb-6` since Activities still brings `pt-13`. Measured: **64px hero → link, 76px tiles → mission heading, 76px mission → Activities heading.**

📌 Moving the JSX alone would have jammed the tiles under the chevron and left 108px below the mission — v1.62's defect arriving from the other side. Second deliberate departure from the handoff's home page, noted in `page.tsx`.

---

## Done — /about's history row starts level (2026-08-15, doc v1.63)

Reported with a screenshot: the portrait began ~66px below the first text card beside it. One file.

📌 **A heading inside a grid column offsets that column and nothing else.** "History of MISA" was the left column's first child, so it pushed the portrait down while the right column started at the row top. It is now a sibling above the grid — visually identical, both columns level. Measured: tops 982/982, bottoms 1490/1490.

⚠️ **Structural, not a hand-tuned `lg:mt-[66px]`** — the heading changes size at `sm` and wraps on narrow screens, so an offset is right at exactly one width. `flex-1` came off the portrait with the move; `items-stretch` already does that job for a grid child.

---

## Done — Navy ground removed from the home-page gallery band (2026-08-15, doc v1.62)

Requested directly. One component file, no migration, and the marquee geometry is untouched.

📌 **A background is a four-part edit here.** `Hatch`'s never-mixed rule means dropping `on-navy bg-misa-blue` also moves the tiles to the **light** tone, their `border-white/28` frames to `misa-border` hairlines, and the "See all photos" link from white to navy — plus `.on-navy` comes off, since its only job is a white focus ring. The component header lists all four so the navy can be restored as one decision.

⚠️ **The page now runs white from the hero chevron to the projects band.** Requested outcome, but the handoff used this navy as the mid-page contrast — a deliberate divergence, recorded rather than assumed.

🪤 **The padding had to follow the background too** (caught by the officer straight after). `py-12 sm:pb-14` was the navy field's inset; with no field it stacked on the neighbours' and left 112px of dead air above the tiles and 108px below. Now `pb-2 sm:pb-3`, rhythm from the sections either side — measured at **81px above and 82px below**. Restoring the navy means restoring the inset.

Verified in a browser on the production build: section background computes transparent, tiles are `hatch-light` + `border-misa-border`, `.on-navy` down to the hero and the projects band. Lint and build clean.

---

## Done — Upcoming events off the home page, mission centred (2026-08-14, doc v1.61)

Requested directly — "remove the upcoming events tab (it may be added back later) and have the mission statement be centered". One file, no migration.

📌 **`_components/upcoming-events.tsx` is kept and unmounted**, not deleted — only the `<UpcomingEvents />` call and its import are gone. Unlinking is enough here: an unrendered Server Component has no URL of its own, unlike the `public/photos/` case.

🪤 **`export const dynamic = "force-dynamic"` went with it**, because the events read was the whole reason for it, and `/` now prerenders static. **Remounting the section must restore the directive** or the page will serve a deploy-time snapshot of the schedule and look fine doing it. The comment left in its place says so.

The mission was the left half of a two-column grid; it is now a centred `max-w-[68ch]` column. Lint and build clean.

---

## Done — Home page marquee made genuinely seamless (2026-08-14, doc v1.60)

Reported as "it stops or moves left to right interchangeably, and has a noticeable end". Three symptoms, two causes, no migration.

🪤 **"Duplicate the group twice and translate -50%" is seamless only when one group is wider than the viewport** — a precondition the code never stated. Measured at 1646px: groups of **1360px** and **1272px**, so each cycle ended **286px** and **374px** short and snapped. The lower track runs in reverse, so its hole opened at the *start* of its cycle and the upper track's at the *end* — that mismatch is what read as the rows changing direction. The opposed directions are the handoff's spec and were confirmed with the officer as correct before anything was touched.

**Separately, the hover pause is gone.** Full-width tracks froze under any resting mouse. `prefers-reduced-motion` still stops both.

**Now derived, not assumed:** `GAP` and `TILE` are constants; `groupWidth`, copies (`ceil(MAX_VIEWPORT / groupWidth) + 1`) and the translate distance all come from them, and the distance reaches CSS as an exact pixel value (`--marquee-shift`) rather than a percentage — a percentage is implicitly a function of the copy count. ⚠️ `MAX_VIEWPORT` (4000px) is a ceiling, not a margin.

🪤 **The lesson is the verification.** The original shipped after being watched; a 38s loop hides a two-second defect. Pause the animation across a full cycle and assert the right edge never falls left of the viewport — 40 steps, both tracks now pass with 2468px and 3442px of surplus. ⚠️ Real-time motion is **not** confirmable in the automation browser (the tab suspends frames), so that half rests on the bug report.

---

## Done — All photography removed from the frontend (2026-08-14, doc v1.59)

Requested hours after the UI overhaul shipped it. Every image slot on every public page is now a hatched placeholder captioned with the shot that belongs there. The layout is untouched — same frames, aspect ratios and tile counts — so real photography later is a swap, not a re-layout.

🔓 **`public/photos/` was deleted rather than unlinked.** A file under `public/` is served at its own URL whether or not a page links it, so dropping the `<Image>` tags alone would have left thirteen photographs of identifiable students fetchable by anyone who had seen the old markup. The officer was given the choice and took deletion. ⚠️ The originals remain in the handoff bundle under `docs/`, which is also public — surfaced in the same question and accepted.

**The four partner logos stayed** — the instruction was photography, confirmed rather than assumed.

Removed with them, so nothing dangles: `PHOTOS` / `photo()` in `lib/site.ts`, `components/ui/photo-frame.tsx`, `Officer.photo`, and the duotone CSS. 🪤 The `fill` rule is kept as **guidance** in `lib/site.ts`'s header — the void-beside-the-column failure will be rediscovered the day photography returns otherwise.

**Verified:** lint and build clean, all six public pages fetched and grepped (0 `/photos/` references, 4 partner-logo references), browser pass over home, About and gallery.

**Still open, unchanged:** activity and project imagery, officer headshots (which carry a *second* blocker — the handoff's photo-to-name pairing was never supplied), the real MISA logo, and a mobile check on a real device.

---

## Done — Public UI overhaul (2026-08-14, doc v1.58)

**No migration. No Server Action, RLS or schema change.** The public pages were rebuilt against the design handoff in `docs/Texas MISA website UI mockups/design_handoff_misa_website/` — five prototypes plus a token/type/spacing spec. Navy `#16305c` on white, Barlow + Barlow Condensed, square corners, hairline borders, the chevron hero preserved, real photography and partner logos committed to `public/`.

Decisions confirmed with the officer before starting, and each one diverges from something:

- **Follow the mockup nav exactly** — `Admin` is a header nav item now (→ `/admin/login`) and the footer sign-in link is gone. 🔓 **This reverses a documented invariant**, so it is rewritten in `CLAUDE.md` and argued in doc v1.58 rather than left to go stale. The footer link existed because the header had no room; the redesign frees it by moving the socials down and dropping Contact from the nav. **Re-measured: 285px clearance at 1280, 460px at 1646.**
- ⚠️ **`/contact` stays a route but leaves the desktop nav.** The handoff has no Contact page. The mobile sheet still carries it.
- ⚠️ **Officer headshots stay placeholders** *(true through phase 2 only — 🔓 superseded 2026-08-23, when the officer supplied the pairing and 11 of 13 got a photograph; see the entry at the top)*. The bundle ships them; its README says the pairing was never supplied. `Officer.photo` is optional and unset.
- **The design language extends to the pages the handoff never drew** — `/attend`, `/lookup`, `/leaderboard`, `/contact`, `/officer-invite`, plus the public error and not-found boundaries. Logic untouched: `/leaderboard` keeps `force-dynamic` and its noindex, `/lookup` keeps its noindex, the invite page keeps no help text and no client-side length rule. `/admin` inherits the new tokens only.

Two traps found by breaking, both now invariants:

- 🪤 **Unlayered global CSS beats every Tailwind v4 utility.** A bare `a { color }` overrode `text-white` and rendered the header's Check In button navy-on-navy — a solid rectangle with nothing in it. Element defaults belong in `@layer base`, decorative classes in `@layer components`.
- 🪤 **`revealDelay()` cannot be exported from a `"use client"` module** — `/about` failed to prerender with "Attempted to call revealDelay() from the server". The helper is `components/ui/reveal.tsx` (server-safe) and the observer is `reveal-observer.tsx`, mounted once in the public layout; that split is what keeps every animated section a Server Component.

**Verified:** `npm run lint` and `npm run build` clean, `tests/docs.test.ts` green, all ten public routes 200, and a browser pass over the five designed pages plus `/attend`, `/leaderboard` and `/admin/login` against the remote.

**Still open:** the real MISA logo (`misa.zip - 1.png`) is named in the handoff README but **not in the bundle**, so the wordmark is still CSS. Activity and project photography are still hatched placeholders. `PHOTOS[].category` in `lib/site.ts` is a provisional guess and the gallery filter sorts on it. Mobile breakpoints are reasoned rather than measured — the prototypes are desktop-only with no breakpoints authored, and the browser tool could not resize the window; **check a real phone before launch.**

---

## Done — Documentation reorganisation (2026-08-14)

`CLAUDE.md` was 169 KB and most of it was history, so an agent paid for the whole build log on every session before reading a line of code. It is now the working brief — current state, the invariants in short form, the traps — at 46 KB, and the material it carried moved out **verbatim**:

- [`docs/build-log.md`](docs/build-log.md) — the stage-by-stage record that was `## Repository status`.
- [`docs/invariants.md`](docs/invariants.md) — the long form of every invariant, with the measurement or failure behind it. **The short form in `CLAUDE.md` is the rule; that file is why.** Keep them in step; if they ever disagree, fix the disagreement rather than picking a side.
- [`docs/operations.md`](docs/operations.md) — the dev-server, Supabase CLI and test-suite traps in full.

⚠️ **`tests/docs.test.ts` constrains what may be trimmed from `CLAUDE.md` and it was re-run against the rewrite.** The `## Layout` block must still name every `lib/*.ts` and `app/actions/*.ts` module, and both `## Layout` and `## Working agreements` must remain as headings in that order — `section()` throws on a missing one. Layout annotations were cut to a line each; §10 keeps the full reasoning, which is the split the test already assumes.

---

## Done — Officer invite links (2026-08-10, migration 24, doc v1.56)

Officers are added from `/admin/officers` by an expiring link instead of a `scripts/create-officer.mjs` run needing the production service role key. The script stays: it is the bootstrap path on a fresh project and the recovery path when nobody can sign in. **Nothing is emailed** — there is no SMTP, which is also what makes Supabase's own `inviteUserByEmail` unusable; the officer copies the link and sends it themselves.

🔓 **This opens the privilege-escalation path §6's risk register said did not exist.** That row is rewritten rather than left stale, and §9 gains **#13**. The decisions: any officer may invite (§9 #6's reasoning, applied to privilege for the first time), 72 hours fixed, and the page does full roster management.

**Walkthrough, 2026-08-10 (local, dev banner confirmed showing `.env.development.local`):**
- ✅ Invite created; email folded `New.Treasurer@Example.edu` → `new.treasurer@example.edu`; link shown once; row appeared under Outstanding invitations reading "expires in 3 days".
- ✅ **Only the digest is stored** — the stored `token_hash` equalled `sha256(token)` computed independently, and `to_jsonb(row)::text like '%<token>%'` was **false**.
- 🔓 **The tampering case was run for real, not argued.** Hidden `role=admin` and `email=attacker@example.edu` inputs were injected into the live form with devtools and submitted. Result: the account was created as **`officer`** for **`new.treasurer@example.edu`**, and `select count(*) from auth.users where email='attacker@example.edu'` returned **0**. Both values come off the stored invite row; `inviteAcceptSchema` has no key for either, so there is nothing to reach.
- ✅ Auto sign-in landed on `/admin` as the new officer. Re-opening the link → "already been used" with a sign-in link; changing the last character → the generic "not valid".
- ✅ Inviting `dev@example.edu` (an address that already has an account) was refused and pointed at Restore — **`select count(*) from officer_invites where email='dev@example.edu'` = 0**, so nothing was written and it was never turned into a password reset.
- ✅ Audit: `invite.created`, `invite.accepted`, `officer.access_granted`, with the accepted/granted rows attributed to the new account.

⚠️ **Withdraw / Remove access / Give access were NOT confirmed by clicking**, and the reason is worth recording because it wasted an hour. Every page under `app/admin/(shell)/` began rendering only the `loading.tsx` skeleton: the content was present in the DOM inside React's `<div hidden id="S:0">` with `$RC` defined, but the trailing reveal script never executed. **It is not this feature** — `/admin` and `/admin/members` failed identically while `/leaderboard` (no `loading.tsx` above it) rendered fine, and all three had rendered correctly earlier in the same session. Fetching `/admin/officers` from the page proved the server was correct: **200, 49KB, ends `</html>`, contains the officer rows and `$RC("B:0","S:0")`**. A browser-side artifact, and a fresh tab plus a restarted dev server did not clear it. The three actions are covered by their statement sequences in `tests/officer-invites.test.ts` instead; **confirm them by hand at the next opportunity.**
- 📌 The generalisable bit, and the reason CLAUDE.md's "curl the server before believing the screen" rule keeps earning its place: the symptom read exactly like a hanging Server Component, and the first instinct was to go looking for an unresolved promise in the new page.

**Tests: 1017 across 34 files** (35 new), lint, `tsc --noEmit` and `npm run build` clean, and `db reset` rebuilds migration 24 from the repo alone.

---

### Amended the same day — migration 25, and the page stripped back

🔓 **The invited address became OPTIONAL (migration 25), which weakens the above on purpose.** Requested directly, after the pinned-only version shipped. Blank means an **open invite**: the link works for whoever opens it, they choose the mailbox, and the row records no intended recipient until it is redeemed. That makes an open link a **bearer credential**. §6's row, §9 #13 and the CLAUDE.md invariants are all amended rather than left asserting the stronger rule — this is the second time in one day that a claim in §6 had to be rewritten instead of quietly going stale, which is the habit worth keeping.
  - **It exists because pinned-only failed in a real way**, not for convenience: an officer frequently does not know which mailbox somebody actually reads, and a wrong guess produced "this invitation can't be used" with no way for the recipient to self-correct.
  - 🔓 **The ROLE stays pinned in both cases**, and that is what makes it survivable. An open invite lets the holder choose *who they are*, never *what they may do* — so the worst case is an unintended **officer** account, visible in the audit trail and revocable. ⚠️ Not nothing: an officer can invite others and remove anyone's access, including yours.
  - **The two paths are structurally apart, not merged behind a `??`.** `inviteAcceptSchema` still has no email key at all, so the pinned branch has no parsed address in scope to reach for; `openInviteEmailSchema` is separate and parsed only when the row pinned nothing. The source assertion covering this says explicitly which half weakened.
  - **Open invites neither supersede nor get superseded.** An open link is not "for" anybody, so two are independent and revoking one must not revoke the other. `createInvite`'s existing-account check does not vanish either — it **moves** to redemption, the only point an address exists.
  - 🐛 **Two defects surfaced only once the regenerated types landed**, both invisible while `lib/types/database.ts` still described migration 24: `revokeInvite` declared a non-null email (it now logs `"an open invite (no address)"` rather than a null note, which would have read as missing data), and the insert would not typecheck at all. **Regenerate types in the same breath as applying a migration**; a stale type file turns a schema change into a pile of unrelated-looking errors.

✂️ **The redemption page was stripped to heading, labels and fields**, and the password floor dropped 12 → **6**.
  - ⚠️ **6 rather than none, and the reason is a data-loss path rather than policy.** GoTrue rejects anything shorter, and `createUser` runs **after** the claim — so a 4-character password would burn a single-use link, grant nothing, and strand the recipient with an error they cannot act on. The floor mirrors the platform so the rejection happens before the claim, next to the field, with the link still usable. A genuinely lower minimum is a Supabase Auth setting (`config.toml` **and** the remote dashboard), not app code.
  - 📌 `scripts/create-officer.mjs` still enforces 12, so the two officer-creation paths deliberately disagree. Change the script if that is unwanted; do not put a floor back here that GoTrue does not share.
  - **Removing the copy removed the client-side `minLength` too**, so validation is now entirely server-side — no client floor that can drift from the schema. The `role` prop went with it, since every string that used it was copy.

🪤 **A deploy was reported as not landed when it had.** The check fingerprinted the alphabetically-first built chunk, which does not change when its content does not. **Confirm a deploy with `gh api repos/Texas-MISA/MISA-Website/deployments` and its `statuses` — not a fingerprint guessed off the HTML.** Both migration 24 and 25 are deployed, state `success`. 🪤 **The four single-use guards were confirmed to go red** by deleting the claim predicate and re-running — the concurrency case genuinely races, returning two winners without it.

⚠️ **Local is at migration 25, the remote at 24.** `npx supabase db push` has not been run.

---

## 🔖 Picking this up cold (as of 2026-08-09)

Read this before touching anything; it is the state no file can tell you on its own.

| | |
|---|---|
| **Branch** | ✅ **Everything is merged, pushed and deployed; the working tree is clean.** `main` is at **`904adf5`** — the seed reproducibility fix and the demo Venmo statement, no application code. Stage 8 shipped as `95d1aad`.<br>📌 **Stage 8 is CLOSED, all three phases.** Start Stage 9 from a fresh branch off `main`.<br>📌 A docs-only commit still triggers a Vercel build, so the deployed commit and this row can differ by one whenever the last change was paperwork.
| **Production** | ✅ **All of Stage 8 is live** (deployed 2026-08-10 as `95d1aad`). Schema at **`…000023`** — phase 3 needed no migration.<br>**Verified after the phase-3 deploy:** an unmatched URL returns a real **404** carrying the site header, section links and footer (it used to be Next's bare page); all seven public routes **200**; `/admin` **307**.<br>Earlier, phases 1 and 2 (`9f33123`): the `archive` entity type is on the remote CHECK, verified by querying the constraint.<br>All three export routes answer **307** to an anonymous request — that is `proxy.ts` gating them, and the route's own **403** was verified locally against a valid session with no `admin_profiles` row, which is the case proxy cannot catch. `/`, `/attend`, `/leaderboard`, `/lookup`, `/officers` all **200**.<br>Earlier: ✅ **All of Stage 7 was live** on https://www.txmisa.org (deployed 2026-08-09 as `90f3aba`). Schema level at **`…000021`**.<br>**Both new routes verified live by rendered response.** `/leaderboard`: 200, `<meta name="robots" content="noindex, nofollow">`, heading Fall 2026, 29 distinct members, tied ranks sharing a number. `/lookup`: 200, same robots meta, and the gate exercised against production data — `pn8571` with **another member's** email returns the generic miss and says nothing about dues, while the correct pair returns Priya Nair / 27 points and **echoes back neither the EID nor the email**. All nine public routes 200; the Member nav renders on `/`.<br>Anon re-checked after the push: `leaderboard` returns exactly `id` / `full_name` / `total_points` / **`term`** and no identifier, **401** on `member_directory`, empty **200**s on `members` and `dues_payments`, empty **200** on `app_settings` — migration 21's definer function exposes the term and nothing around it.<br>Earlier: phase 1 was live as `24797d5`; everything through Stage 6 phase 9 as `2c38084`.<br>📌 **Phase 9 changed no application behaviour** — it is docs plus `seed.sql`, and `seed.sql` does not ship — so there was no new route to verify by rendered response. What was checked is that nothing regressed: `/`, `/attend`, `/officers`, `/about` all **200**; `/leaderboard` **404**, correct until Stage 7.<br>Anon re-checked: **401** on `member_directory`, **200** on `leaderboard` carrying only `id` / `full_name` / `total_points`, empty **200**s on `members`, `member_filter_presets` and `dues_payments`.<br>✅ **Superseded 2026-08-19: production was WIPED, not re-seeded** — see the "Production is EMPTY" row. The stray `shirt_size` definition this used to warn about is gone with everything else; production holds 0 field definitions.<br>Earlier: everything through phase 8 was live as `9aac732`.
| ✅ **Database — local and remote LEVEL** | **30 migration files, through `…000029`, on LOCAL; the remote is still at `…000027`.** Migrations 28 and 29 are applied locally and **NOT YET PUSHED** — the code that reads them is not deployed either, so the two are in step. Next number is **30**, unclaimed.<br>🔓 **Migration 29 (`member_directory_terms`) makes the roster TERM-SCOPED and DROPS `members.active`** (officer, 2026-08-25). `member_directory` becomes **one row per (member, term)**, and every aggregate on a row — points, events attended, the rate, dues — belongs to that row's term; `dues_paid_current_term` is renamed **`dues_paid_term`** because the old name becomes a lie on any other term's row. ⚠️ **A DROP and CREATE, not `create or replace`** (replace can only append columns), so the migration **re-issues the revokes** — a recreated view re-inherits migration 12's default privileges, which is how anon reached this view in production once already. 📌 **Membership is DERIVED, not ticked**: a member is on a term's roster if they were marked present at one of its events, were granted points in it, their dues cover it, or they joined during it. `joined_at` is NOT NULL, so **every member always has at least one row** and nobody falls off the roster entirely. 🪤 **The consequence to expect in week one**: before a term's first event, its roster is only whoever joined during it or has already paid — that is the rule working, and the directory's empty state says so. ⚠️ **`leaderboard` lost `where m.active`** and is now defined **over `member_directory`** scoped to `current_term()`, so the board and the directory cannot disagree about who is in the club — and the board **can now be empty**, where the old LEFT JOIN made that impossible. 📌 Adds **`member_terms()`**, the term list the roster control offers, as an rpc rather than a `select term from member_directory` deduped in JS: that read is members × terms and PostgREST's `max_rows` would silently shorten it. Reserves `term` and `dues_paid_term` as custom-field keys; `active` and `dues_paid_current_term` **stay reserved** although neither is a column any more.<br>🔴 **Dropping `members.active` reached far past the directory** — the attendance-review candidate scan and its −20 inactive penalty, the `member_inactive` resolution warning, `fetchMemberOptions`' active-only filter and its `includeId` escape hatch, the roster import's `active` column and `parseActive`, the export catalogue's **Active** field (now **Term**), and the inactive badges on the dues, points and merge screens. All removed. ⚠️ **The candidate scans now read the WHOLE roster**, so `MEMBER_SCAN_LIMIT` (400) bites sooner than it did.<br>🔓 **Migration 28 is check-in location verification** (spec: [`docs/checkin-location-verification.md`](docs/checkin-location-verification.md)). One new table, `checkin_origin`, plus `events.verify_origin` (boolean, **default true**). It stores a peppered, event-scoped digest and a four-value network label, and **never an IP address**. ⚠️ It carries `checkin_origin_unknown_has_no_digest`, which is load-bearing rather than tidy: an `unknown` kind with a digest beside it would fall through the review screen's precedence to **off-network** and flag a member on the strength of a parse failure or a gap in the prefix table.<br>📌 **`public` now holds THIRTEEN tables**, so `scripts/wipe-remote.sh`'s accounting and `seed.sql`'s wipe list both name `checkin_origin` — it cascades from `attendance` and inserts nothing, but a table that vanishes by cascade is exactly the kind that goes unnoticed.<br>Earlier: **28 migration files, through `…000027`, on both** — 26 and 27 pushed 2026-08-19 and verified with `migration list --linked` (all matched) and by reading `events_category_valid` back off the remote. Next number is **28**, unclaimed.<br>🔓 **Migration 27 (`event_categories`) replaces the event vocabulary the admin UI was built with.** `general_meeting` / `workshop` / `social` / `flagship` / `other` become **projects · academic · social · professional_dev · corporate · special_events · general_and_other** (officer request, 2026-08-19). ⚠️ **`events.category` is a CHECK constraint, not free text** — migration 22 pinned it, so the vocabulary now lives in the schema **and** in `EVENT_CATEGORIES`, and moving one without the other hands the officer a select box that takes a **23514** on save. 🪤 **`general_meeting` is the lossy step in the remap**: the new list has no seat for a weekly general meeting, so it folds into `general_and_other`. Production held 0 events, so the remap exists for local seeds and for any drifted database, not for real data.<br>📌 **Migration 26 (`dues_price_increase`) — $30/$50 became $40/$70.** It sets the column DEFAULT *and* updates the singleton row, because a default only applies to an INSERT and `app_settings` is never inserted into again; either statement alone is a silent local-vs-production disagreement about what a $40 payment buys.<br>🪤 **26 and 27 both claimed number 26 for a few minutes on 2026-08-19**, written by two sessions at once. The collision surfaced as a **23505 on `schema_migrations_pkey`** partway through `db reset` — loud, and recoverable only because nothing had been pushed yet. This is what the "next unclaimed number" line in this row is for.<br>**26 migration files, through `…000025`, on both** — pushed 2026-08-10 and verified by reading the remote schema back (`officer_invites.email` nullable, `rls=true`, 0 rows). Next number is **26**, unclaimed.<br>🔓 **Migration 25 (`open_invites`) WEAKENS migration 24 deliberately** and its header is where that is argued: `email` becomes nullable, and a null means an OPEN invite — a bearer credential redeemable by whoever holds the link, into any mailbox they control. Allowed because an officer often does not know which address somebody actually reads, and a wrong guess used to produce a link that simply did not work. **The role stays pinned in both cases**, which is what makes it survivable.<br>⚠️ **The remote DATABASE is again ahead of the deployed CODE** until `main` reaches origin. Safe in this direction: dropping a NOT NULL only accepts more, so the deployed code keeps working unchanged.<br>**25 migration files, through `…000024`, on both** — pushed 2026-08-10 and confirmed with `migration list --linked` showing all 25 matched, then by reading the remote schema back (`officer_invites` present, `rls=true`, **`policies=0`**, the `admin_audit` check carrying `officer_invite`). Next number is **25**, unclaimed.<br>⚠️ **The remote DATABASE is ahead of the deployed CODE** until `main` is pushed to origin — production has the table and no page that reads it. That ordering is the safe one and was deliberate: migration 24 is purely additive, so nothing deployed today touches it, whereas deploying the code first would 500 on a missing table.<br>🔓 **Migration 24 (`officer_invites`) is the officer invite link**, and its header is the place the security trade is argued. It adds one table and **two** `admin_audit` entity types (`officer`, `officer_invite`) — the SQL CHECK and `AuditEntityType` moved in the same commit, which is the rule that exists because they have drifted twice. Nothing in it grants any API role anything: the table is RLS deny-all with zero policies, and the service-role client is the only reader.<br>📌 **Migration 23 adds one `admin_audit` entity type, `archive`** — nothing else. The SQL CHECK and `AuditEntityType` moved in the same commit, which is the rule that exists because they have drifted twice.<br>🔓 **Migration 22 (`hardening`) closes a live production hole** — `member_directory` was granted to `authenticated`, which any signed-up user holds. It also narrows anon/authenticated to `select` (TRUNCATE was in `grant all` and RLS cannot restrain it) and adds the constraints six older tables were missing. **Push it promptly.**<br>📌 **This row used to say "next number is 22" while the highest was `…000020`** — it was counting *files* (21, including `00000000000000_stage0_check.sql`) rather than the sequence. Phase 1 correctly took **21**. Count files for the file count; read the highest suffix for the next number.<br>**Migration 21 (`current_term_visibility`)** makes `current_term()` `security definer` and appends `term` to `leaderboard`. Two `create or replace` statements, no data touched, no drop — so grants survived and none are restated.<br>🔓 **`seed.sql`'s wipe list gained `member_field_definitions` and `member_filter_presets` in phase 9**, and both are now asserted by the seed's own check block. That is the fix for the `shirt_size` drift recorded two rows down — but **production has not been re-seeded**, so the stray definition is still there until someone authorises one. |
| 🧹 **Production is EMPTY — it is NO LONGER the seed** | **WIPED 2026-08-19** with `bash scripts/wipe-remote.sh`, on the officer's explicit authorisation, ahead of the real Fall 2026 schedule being entered. **0 members / 0 events / 0 attendance / 0 adjustments / 0 dues / 0 field definitions / 0 presets**; `leaderboard` and `member_directory` both **0 rows**; `app_settings.current_term` still **unpinned**, deriving **Fall 2026**. Kept by design: the **3 real officer logins** (`auth.users` + `admin_profiles`, roles intact), all **4 `officer_invites`**, and the **8 `admin_audit` rows** whose `entity_type` is `officer_invite` or `officer` — the record of who was granted access. The other 13 audit rows and the fabricated `seed.officer@example.edu` account were deleted. Verified independently of the script's own output, including `admin_audit_no_delete` back to `tgenabled = 'O'`.<br>⚠️ **It had DRIFTED from the seed before the wipe and nothing said so** — 33 members, 16 events, 209 attendance and **9 dues payments** against a documented 0, from walkthroughs. **A documented count about the remote is a claim, not a fact.**<br>🔴 **Clearing is `wipe-remote.sh`, NOT `seed-remote.sh --force`** — `--force` skips only the guard and then re-inserts all 32 fabricated members, so it would have left production holding the seed again.<br>⚠️ **Local was deliberately not touched**: `seed.sql` is the test fixture and stays the fabricated 32/15/208.<br>📌 Everything from here down is history from when production carried the seed.<br>Earlier: **Reset 2026-08-07 with the officer's explicit authorisation.** The "real member" this row used to warn about (`Christian A Gonzales / cag7284`) was their own test row, and the database is due another reset when the term begins. Production now matches the seed exactly — **32 members, 15 events, 202 present + 5 pending + 1 rejected, 6 adjustments, 2 audit, 29 leaderboard, 0 dues** — with `app_settings.current_term` **unpinned** and `current_term()` = **Fall 2026**, the same as local.<br>✅ **"Exactly" had one exception and it is now closed — the other way round.** Production carried a live `shirt_size` field definition (8 options, directory column, editable inline) from the phase-4 walkthrough that the seed knew nothing about, because `seed.sql` had no `delete from member_field_definitions`. Phase 9 added the delete — which meant the next re-seed would have **removed a column somebody was using**. **Decided 2026-08-09: keep it, so the seed creates it.** Local and the remote now agree at **1 definition**, and the assert block expects 1. 📌 **Nothing was applied to the database** — production already had the row; the *seed* changed to match it. 🪤 The generalisable part is sharper than the original note: **the wipe list is the definition of "matches the seed", so adding a table to it is also a claim that the seed should be the only source of those rows** — fixing the list did not fix the drift, it converted it into a decision, and the answer the fix implied (delete) was the wrong one. First time the two have held the same data since the check-in form went live.<br>📌 **Re-seeding a project with a real officer on it is `bash scripts/seed-remote.sh --force`**, added the same day, and it is the *only* sanctioned route — the old instruction ("never work around the guard; use a targeted migration, as 17 does") is superseded, because migration 17 existed to protect a real row and there is none. `--force` skips only the guard chunk: it still wipes everything, names the project ref and prints current row counts **before** deleting, and makes you type the ref back. **Officer logins are not deleted** — the wipe removes only the seed officer's `auth.users` row, and `admin_profiles` cascades from it, so `cgonztx@gmail.com` kept role `admin` (verified after).<br>📌 `checkin_throttle` is deliberately **not** wiped: IP-keyed rate-limit state with a 10-minute window, not seed data, and it expires on its own. Don't "fix" that. |
| 🔁 **Resetting after a demo — the path is proven, 2026-08-10** | **`bash scripts/seed-remote.sh --force`, then type the project ref back.** That is the whole procedure; officer logins survive it and every table a demo can touch is wiped. Rehearsed end to end against a local stack deliberately dirtied the way a demo dirties one — new members, a new event, check-ins, a grant, a custom field, a saved view, a dues payment, audit rows, and a **real** (non-seed) officer account. After five consecutive resets: all seed asserts passed, every trace of the junk was gone, and the officer still **signed in over the auth API** — checked by actually authenticating, not by confirming the row still existed.<br>🔓 **Two seed fixtures were NOT reproducible on a re-seed until this was rehearsed, and `db reset` is why nobody saw it.** Both hand-placed attendance rows were guarded by `not exists`, so each skipped itself whenever the bulk draw filled its slot — and the draw is stable only on a **virgin** table. `order by last_name` pins physical order when the table is fresh (the `db reset` case); a re-seed re-inserts into a table with a free space map and real statistics, so scan order and join plan can both differ. Measured over six re-seeds: the rejected-duplicate fixture appeared 4 times, vanished twice, and **the seed's own assert failed on the runs that lost it**. Fixed by reserving both slots out of the bulk draw and making the fixtures unconditional — a WHERE predicate does not care about row order, which is why reserving works where pinning cannot. 📌 The draw's *count* was never unstable (setseed + one `random()` per candidate row); **which pairs got which value** was.<br>⚠️ **The `admin_manual` fixture had been losing silently and production still shows it — `manual = 0` on the remote.** Its guard had no status filter and it skipped on all six measured runs; unlike the rejected row it was **not asserted**, and an admin_manual row is `present` like any other so the count absorbed it. Asserted now. **An unasserted fixture is an optional fixture.**<br>📌 **Counts did not move** — 202 present / 5 pending / 1 rejected / 29 leaderboard, plus 1 admin_manual — and `db reset` and a repeated re-seed now agree. 11 consecutive runs. |
| ✂️ **The directory no longer paginates** | **Changed 2026-08-07, on request** — `/admin/members` renders every member matching the filter; no filter means the whole roster. No migration. `page` left `MemberFilter` (the phase-3 rule: retiring a filter means deleting the field, so a bookmarked `?page=3` narrows nothing), `pagination.tsx` was deleted, and `PAGE_SIZE`/`pageRange`/`pageCount` gave way to `READ_CHUNK` (1000) + `chunkRange()`.<br>⚠️ **Rendering everything is not the same as asking for everything in one request.** The page now loops `.range()` exactly as the export route does, because the hosted project applies its own PostgREST `max_rows` — one unbounded request comes back complete locally and short in production. **There is deliberately no ceiling**: the count and the rows are the same set and cannot disagree. If 500+ members ever feels slow, virtualize the table; do not start trimming.<br>🔓 **The header checkbox had to change with it, and this one bites.** It used to enumerate 25 ids into the export URL; unpaginated it would enumerate all of them. Measured in the walkthrough: **28 members = a 1,257-character URL**, so a real roster would overrun request-header limits and the download would just fail. It now sets `filter` mode, which sends **zero** ids — verified live at 29 members / 0 `ids` params / 109 characters. The two selection modes still exist and must not be merged.<br>🪤 **The sticky header needed a bounded scrollport.** `overflow-x-auto` alone makes the wrapper a scroll container in *both* axes, so with no height limit the page scrolls instead of it and `sticky top-0` has nothing to stick to. `max-h-[70vh] overflow-auto` on the wrapper plus sticky cells (border on the cells, not the row). |
| **Next task** | **Stage 9 — launch.** ✅ **Stages 0–8 are all COMPLETE.**<br>🔴 **BEFORE MIGRATION 28 GOES OUT: set `CHECKIN_ORIGIN_PEPPER` in Vercel, and push the migration and the code TOGETHER.** Both are local-only right now and in step with each other; deploying the code without the migration 500s on a missing table, and applying the migration without the code is harmless. ⚠️ **A missing pepper is SILENT** — no digest is computed, no check-in fails, and every review row reads *origin unknown*, so the feature looks like it works and finds nothing. The event page names the variable when it is absent, which is the only thing between that and a mystery. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`; never reuse the dev value and never commit it. 📌 Also worth doing before the first real event: re-run `node scripts/build-network-table.mjs` so the carrier table is fresh, and read `VENUE_MIN_COUNT` / `VENUE_MIN_SHARE` against the actual room — they shipped as unmeasured placeholders.<br>📌 §7 scopes it as: custom domain + DNS to Vercel (and the Supabase redirect URLs with it), the officer walkthrough and a one-page handoff guide, and a soft launch at one event with a paper backup sign-in sheet. **1–2 days.**<br>🔓 **No historical data is migrated — the system starts fresh** (decided 2026-08-10, doc v1.55). That removed the one unestimable piece of this stage. `/admin/members/import` covers the roster as *current* membership; there is deliberately no importer for historical attendance or adjustments.<br>✅ **Production was CLEARED on 2026-08-19** with `bash scripts/wipe-remote.sh` — this Stage 9 item is DONE. Empty of club data, officer access intact. **Next up: the real Fall 2026 schedule, then the real roster import** via `/admin/members/import`.<br>🔴 **This line used to prescribe `bash scripts/seed-remote.sh --force`, which would have RE-SEEDED rather than cleared.**<br>⚠️ **`RATE_LIMIT_MAX = 90` is a room capacity, not a security number** — size it against the actual venue before the first event, not after somebody is turned away. See Capacity ceilings.<br>⚠️ **The free tier pauses after inactivity** and needs a manual dashboard resume. That is the "semester wake-up check" the handoff-guide bullet names, and §2.2 calls it the single most likely operational surprise.<br>📌 **Two dashboard settings Stage 8 surfaced, both outside the repo and both the officer's call:** `enable_signup = true` with no product use, and MFA off on accounts that reach every EID and email.<br>🪤 **The seed expires 1 January 2027** — irrelevant once production carries real data, but it still bites any fresh local stack. See the carried-out items.
| ✅ **Stage 6.5 — COMPLETE, all 4 phases** | **Dues & membership status** (planned 2026-08-05 doc v1.34; phases 1–3 built 2026-08-06 doc v1.40; **phase 4 built 2026-08-07, doc v1.44**). Spec: [`docs/dues-and-membership.md`](docs/dues-and-membership.md). Built: migration 19, the term arithmetic, `lib/dues.ts`, the view column and the reserved keys (phase 1); `app/actions/dues.ts`, `lib/dues-roster.ts` and `/admin/dues/import` (phase 2); the ledger at `/admin/dues`, the editor at `/admin/dues/[id]`, `savePayment` / `voidPayment` (phase 3); and **the roster-facing half — the `dues` filter and sort, the Paid / Not Paid column, the detail page's Dues section, and one export catalogue entry (phase 4, no migration)**. 📌 Phase 3 shipped **two** corrections where the spec named three — see the phase-3 block for why the row-level CAS token forces that. |
| ✅ **Stage 6 phase 5c — built 2026-08-07** | **Filter the directory by categorical fields** — custom fields, dues status and `source`. Requested 2026-08-06, built the next day, **no migration**. The dues third shipped early with Stage 6.5 phase 4. 📌 It renamed `customSortColumn` → `customFieldColumn` (and the two key helpers with it), because the guard now escapes **two** positions — the `order=` term and the `cf:` filter predicates — and a security control named after one call site invites a second copy for the other. Full entry under Phase 5c below. |
| 🔑 **What is NOT in any file** | Two things, both deliberate. **The local dev officer's password** — see the Local database row; it is disposable, so set a new one rather than hunting for it. And **the Supabase database password and the GitHub 2FA recovery codes**, which live in the MISA Bitwarden organization (§2.5) and are the one part of the handoff that is officer-attested rather than checkable from this repo. Re-confirm both at turnover.
| **Local database** | **Reset 2026-08-09**, most recently after seeding `shirt_size` — which doubles as the proof that all 22 migrations replay cold from the repo alone. Verified straight after: **32 members, 15 events, 208 attendance (202 present + 5 pending + 1 rejected), 6 adjustments, 29 leaderboard rows, 1 field definition (`shirt_size`, no member holding a value), 0 saved views, 0 dues payments**, and `current_term()` = **Fall 2026**.<br>✅ **`seed.sql` asserts every one of those itself** and aborts if one drifts. 📌 The field-definition assertion is **1** rather than 0 as of 2026-08-09 and still does the same job: 0 means the insert was lost, more than 1 means the wipe stopped clearing the table. **No walkthrough fixtures remain**; the phase-8 merge fixtures went with the reset.<br>📌 **`/admin/members` renders a SHIRT SIZE column locally now**, as it always has on production. That is the two finally agreeing, not new drift.<br>⚠️ **`admin_audit` only ever climbs** and is currently **22** against the seed's 2: `cleanup()` leaves audit rows behind and they cannot be deleted (P0001, append-only). Running `npm test` adds more. Members stay at 32 — the suite is member-neutral.<br>⚠️ **A `db reset` wipes local `auth.users`, so re-create the dev officer before signing in** — command below. It exists as `dev@example.edu` (role admin). 🔑 **The password is not written down anywhere and must not be** — this repo is public. It is local-only and disposable: just re-run the command with any `OFFICER_PASSWORD` you like and use that.<br>🪤 **The seed expires 1 January 2027** — `current_term()` becomes Spring 2027, every seeded event falls out of scope, and the leaderboard and directory go empty with nothing on screen to explain why. That is this file's dates needing to move forward a term, not a bug. See the carried-out items near the end of this file.<br>🪤 **The twelve completed events are packed into 1–5 August**, the only elapsed part of Fall 2026. Spread them out once more of the term has passed. **Consequence to expect:** every orphan sits inside the 48-hour grace window of *several* events, so `nearby_events()` returns a ranked list (8 for the seeded Luca Moretti orphan) rather than one confident suggestion.<br>📌 **Date any dues fixture into the CURRENT term** (Aug–Dec 2026). A payment outside it covers a term the directory is not scoped to, and every Paid/Not Paid assertion then reads as a bug.
| **Tests** | **1,111 across 37 files**, lint, build and `npx tsc --noEmit` all clean.<br>Migration 28 added `tests/network-classify.test.ts` (24), `tests/checkin-origin.test.ts` (38) and `tests/checkin-origin-capture.test.ts` (12), plus targeted `checkin_origin` probes in `tests/security.test.ts`.<br>🪤 **The generic write sweep in `tests/security.test.ts` passed on `checkin_origin` for the WRONG REASON.** Every probe filters on `id`; that table's primary key is `attendance_id`, so the DELETE probe came back **42703** (column does not exist), which satisfies `error !== null` while proving nothing about permissions. Verified by hand that the real answer is **42501**, and a targeted probe now asserts it. Same family as the empty-payload trap the file already warns about: **assert the refusal you mean.**<br>🪤 **A `runIf` gate that skips everything skips it SILENTLY.** Six digest cases are gated on `CHECKIN_ORIGIN_PEPPER` being set (`vitest.config.ts` sets it); removing that line would have skipped all six with the suite still green. There is now a case asserting the gate itself.<br>⚠️ **A green suite proved the feature ran, not that it was right** — a review of migration 28 found **six defects** in code that had already passed 1,098 tests, lint, `tsc` and a clean build. See `docs/build-log.md`.<br>Earlier: **972 across 33 files**.<br>Stage 7 added `tests/leaderboard.test.ts` (11) and `tests/lookup.test.ts` (23). ⚠️ **`tests/leaderboard.test.ts` PINS `app_settings.current_term` and restores it in a `finally`** — `tests/global-setup.ts` un-pins for the suite, so a crash between the two would leave every later file asserting against the wrong term, and the seed's own data would fall out of scope. There is an `afterAll` un-pin as a second guard.<br>📌 **`tests/docs.test.ts`'s guard-the-guard case had to change**: it named `/lookup` as the documented-but-unbuilt route, and Stage 7 built it. It names `/admin/audit` now. Whoever builds that picks another planned route rather than deleting the test.<br>Earlier: 838 across 27 after Stage 6 phase 9.<br>Phase 9 added `tests/docs.test.ts` (102) — a standing guard rather than coverage of a feature: every route in §5, every `lib/` and `app/actions/` module in §10 **and** `CLAUDE.md`'s Layout. It found 14 omissions on its first run, one of them a **Stage 5** route.<br>⚠️ **It asserts a name is PRESENT and cannot assert the prose is true** — phase 8's inverted claim would pass it. Green means nothing is undocumented, not that the docs are right.<br>🪤 It also had a false pass until it was deliberately broken: `toContain("merge.ts")` is satisfied by `member-merge.ts`. Boundary matching now, pinned by its own test.<br>Earlier: 736 across 26 after phase 8; 695 across 24 after phase 7. |

**Before running anything:** Docker Desktop must be up, then `npx supabase start`. `npx supabase db reset` wipes local `auth.users`, so re-create a local officer afterwards with `node scripts/create-officer.mjs --local --email dev@example.edu --role admin` (password via stdin or `OFFICER_PASSWORD` — **never commit one; this repo is public**).

🪤 **`.env.local` points at the REMOTE project, so `npm run dev` reads production by default.** That is correct for `vercel env pull` and for builds, and completely wrong for a local walkthrough — you get a working admin UI full of real data and no signal that anything is off, because the remote carries the same seed. `.env.development.local` (gitignored via `.env*.local`, created 2026-07-31) pins dev to `http://127.0.0.1:54321` with the CLI's published local keys; Next loads it ahead of `.env.local` in dev, and the dev server prints `Environments: .env.development.local, .env.local` when it is working. **Check that line before trusting anything you see at localhost:3000.** Delete the file to point dev back at the remote.

**Five things that will waste your time if you don't know them:**

- **`npm test` needs `fileParallelism: false`**, already set in `vitest.config.ts`. Don't "optimize" it back on — see the note in `CLAUDE.md`.
- **`supabase gen types --local` omits the `__InternalSupabase` block** that `--linked` emits. Restore it by hand or the diff looks like a regression.
- **Only `npm run build` works locally on Windows**; `vercel build` fails with `EPERM … symlink`.
- **A stale dev server survives an env change.** Env files are read at process start, so adding `.env.development.local` does nothing until you restart — and the old process keeps serving production. Kill it by port rather than trusting that `npm run dev` grabbed 3000; it silently falls back to 3001 and leaves the original running.
- 🪤 **Never run `npm run dev` as a background task whose stdout nobody keeps reading.** When the pipe closes, the next request-log write kills Next with an **uncaught `EPIPE`** — and the process does not exit. It spins (measured at 1080s CPU / 2 GB RSS) while every request hangs forever, so the browser keeps showing a **stale DOM that reads exactly like an application bug**, and the dev log's last line is the request *before* the failure rather than an error. Redirect to a file instead (`npm run dev > dev.log 2>&1`, detached). **Corollary worth internalising: if the UI shows something impossible, `curl` the server before believing the screen.** This cost half an hour and produced a confident, entirely wrong defect report during the phase-4 walkthrough.

---

## Done — Stage 0: Foundations

*Goal: a deployed skeleton, so deployment is never the thing that blocks a feature. Exit: a live URL that reads one row from Postgres. ~half a day.*

- [x] `git init`; add `.gitignore` (`.env*.local`, `node_modules`, `.next`, `.vercel`); commit `docs/`, `CLAUDE.md`, `tasks.md`
- [x] `npx create-next-app@latest` — TypeScript, Tailwind, App Router, ESLint, **no `src/` directory** (§10 puts `app/` and `lib/` at the root). Landed Next **16.2.12** + React 19.2.4 + Tailwind 4. `npm run lint` and `npm run build` both pass.
- [x] Create the GitHub repo and push `main` — now [Texas-MISA/MISA-Website](https://github.com/Texas-MISA/MISA-Website), **public**, owned by the org (transferred from the personal account 2026-07-29, per §2.3)
- [x] Import the repo into Vercel — scope `txmisa-jds-projects` (the MISA email's personal **Hobby** account; Vercel Teams are Pro-only, so there is no Texas-MISA team). Connected to `Texas-MISA/MISA-Website`. Production alias was **`misa-website-beta.vercel.app`** (`misa-website.vercel.app` is taken by someone else). ⚠️ **No longer true — that hostname is dead and 404s.** Production is now the club's real domain **https://www.txmisa.org**; see the warning at the top of `CLAUDE.md`. The lines below that cite the old alias are dated evidence and are left as history.
- [x] Deployment Protection no longer SSO-gates production — it defaulted to "All Deployments" on import and now returns 200.
- [x] Confirm push-to-`main` deploys — every commit this session triggered a build
- [x] Create the Supabase project — `misa-website`, ref **`gbxypeofjnhrhotlhyzs`**, region **us-east-2 (Ohio)**, under the MISA account. CLI is linked and `supabase/` is initialized, so migrations go through `db push`.
  - Region chosen as the closest Supabase region to Austin (~1,700 km, vs us-east-1 ~2,000 and us-west-2 ~2,900). Neither AWS nor Vercel has a Texas region. **Regions are fixed at creation** — changing later means recreating the project.
  - Replaces the original `sqgqaxegeawtlccaxdij` in us-west-2, created and discarded the same day.
- [x] **Delete the old `MISA Website` project** (ref `sqgqaxegeawtlccaxdij`, us-west-2) — done; `projects list` now shows only `misa-website`.
- [x] `.env.local` written with `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the new `sb_publishable_…` key format; template committed as `.env.example`). Confirmed gitignored. Service role key unused so far — server-only when it is, never `NEXT_PUBLIC_`.
- [x] **Update the two Vercel env vars to the us-east-2 project** — done in settings.
  - `NEXT_PUBLIC_SUPABASE_URL` = `https://gbxypeofjnhrhotlhyzs.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_CnJ934Lcn_TSFLN02--J2Q_aPa_VEfZ`
  - ⚠️ **`NEXT_PUBLIC_*` values are inlined at build time**, so editing them in Vercel settings changes nothing until a rebuild. Changing an env var always needs a redeploy — a restart won't do it.
  - ⚠️ This cost ~45 minutes across three failed dashboard edits. Root cause: the vars are stored **Sensitive**, so `vercel env pull` returns empty strings and nobody — including the dashboard — can read back what's actually stored. Each edit layered onto invisible state. Symptoms along the way: values in each other's slots, then a stray `│` (U+2502) copied out of a rendered markdown table giving 48 chars instead of 46.
  - ✅ **Fix env vars via the CLI, not the dashboard.** `vercel env rm` all copies, then `printf '%s' "$VALUE" | vercel env add NAME <env>` — no clipboard, no invisible characters. Correct lengths: URL 40 chars, anon key 46 chars, both pure ASCII. `/db-check` prints both lengths, which is what finally made this diagnosable.
- [x] `lib/supabase/server.ts` and `lib/supabase/client.ts` (§10) — `@supabase/ssr` 0.12 pattern, async `cookies()`, lint/build clean
- [x] Throwaway verification page `/db-check` written and **passing locally** (HTTP 200, row renders, RLS-gated via an explicit anon select policy)
- [x] Confirm `/db-check` passes **on the deployed URL** — ✅ https://www.txmisa.org/db-check returns 200 and renders the row. Verified request-time (timestamps differ across requests, `X-Vercel-Cache: MISS`), so the Vercel env vars are correct. **Stage 0 exit criteria met.**
- [x] Update the Commands section of `CLAUDE.md` with the verified `dev` / `build` / `lint` invocations and drop the "not yet verified" caveat

**Noted during the scaffold** — carry into later stages:

- `npm audit` reports 12 high-severity advisories, all transitive dev/build-time deps of `eslint` and `next` (`brace-expansion`, `postcss`, `sharp`). **Never run `npm audit fix --force`** — npm's proposed "fix" downgrades Next to 9.3.3. Revisit when `eslint-config-next` supports eslint 10.
- `create-next-app` generated `AGENTS.md` warning that Next 16 diverges from model training data, and a `CLAUDE.md` that was just `@AGENTS.md`. Merged: the project `CLAUDE.md` now imports `AGENTS.md` at the top. Read `node_modules/next/dist/docs/` before writing App Router / caching / Server Action code.
- §10's layout predates Next 16. Where the doc and the framework disagree, the framework wins — record the divergence in the doc.
- First divergence found and recorded (doc v1.3): **`middleware.ts` is deprecated in Next 16, renamed `proxy.ts`**, exported function `proxy()`. The Stage 4 admin gate builds on `proxy.ts`. Note the bundled docs call Proxy a last resort — when Stage 4 arrives, do the session-refresh in `proxy.ts` but keep the real authorization check in the admin layout/server code, not only at the proxy.

---

## Done — schema decisions

§9 listed 11 open decisions. **All eleven are now resolved** — five before Stage 1, the other six on 2026-07-31. Kept in full rather than collapsed to a summary, because the reasoning is what a future officer needs when one of them stops fitting.

**✅ All five schema-affecting decisions resolved 2026-07-29.** Recorded in §9 with the schema in §4 updated to match.

| # | Decision | Resolution |
|---|---|---|
| 2 | Roster policy | **Self-registering, confirmed by the member** (revised doc v1.22). Look up by `normalized_student_id`, then `lower(email)`. Both miss: ticked "first time" → review screen, then create with `source = 'self_checkin'`, active, no officer approval; unticked → nothing written, re-prompt. |
| 3 | Points weighting | Per-event `points`, default 1. |
| 4 | Semester boundaries | **One leaderboard, current term only; terms derived from dates.** One row per member, `total_points` only (no split), ties alphabetical. `events.term` generated from `starts_at` → `'Fall 2026'` / `'Spring 2027'`, half-open at Aug 1 / Jan 1, anchored America/Chicago. Rollover automatic; `app_settings.current_term` is a nullable override. |
| 5 | Excused absences | Deferred post-v1. Rate stays raw `attended / possible`. |
| 7 | Orphan grace window | 48h as one exported constant (`ORPHAN_WINDOW_HOURS`) feeding `nearby_events()`. |

**✅ The remaining six resolved 2026-07-31** — #6, #8, #9, #10 while building Stage 5, and #1 and #11 alongside them. **All eleven §9 decisions are now closed.** New questions belong in Stage 10's backlog rather than here.

The first four share one premise, and the consistency matters more than any single one: **the audit log and the ledger are the control, not a gate.** Revisit all four together if points ever decide something material — officer eligibility, a funded trip, a leadership slot — because that premise is what would change, not the individual arguments.

| # | Decision | Proposed default | |
|---|---|---|---|
| 1 | Leaderboard visibility | **✅ Resolved 2026-07-31 — public, but never indexed.** Full name + points only; no student IDs or emails. `/leaderboard` must set `robots: { index: false, follow: false }` — copy the pattern from `app/admin/(shell)/layout.tsx`. A search cache outlives the deploy that filled it, so this is the one part that can't be walked back. Display-name field or opt-out is the escalation if someone objects. | [x] |
| 6 | Override authority | **✅ Resolved 2026-07-31 — any officer may approve.** The audit log is the control, not a role gate; a gate funnels every correction through whoever is busiest, and the misuse it guards against shows up in `admin_audit` either way. | [x] |
| 8 | Resolution deadline | **✅ Resolved 2026-07-31 — none enforced in v1.** The dashboard pending badge and the oldest-first default sort (both built in phase 1) are the mitigation. A hard deadline would destroy credit for someone who did attend, which is the one outcome §4.2 exists to prevent. | [x] |
| 9 | Point grant caps | **✅ Resolved 2026-07-31 — no restrictions.** Any officer, any amount, no `admin` threshold. A cap invites splitting a grant in two: same total, less readable ledger. `MAX_POINTS_PER_GRANT = 500` in `lib/points.ts` stays a fat-finger guard and is **not** this policy — don't let it drift into being cited as one. | [x] |
| 10 | Self-grants | **✅ Resolved 2026-07-31 — allowed**, always visible in the ledger with the granting officer named. Blocking relocates it to "could you grant me these", which is harder to audit. `grantPoints` carries no self-grant check, and no officer↔member linkage is needed. | [x] |
| 11 | Bonus points publicly | **✅ Resolved 2026-07-31 — a single total, attendance and bonus added silently.** This confirms §4.4 rather than changing it, and closes the contradiction the row carried since v1.16 (it was written expecting a separate public column). The split stays officer-only, in `member_directory` and the `/admin/points` ledger. Accepted cost: a member sees a number and can't tell which part was granted. | [x] |

---

## Done — Stage 1: Data Layer

*Goal: the schema exists and enforces its own rules. Exit: invalid data is rejected by the database, verified by hand in the SQL editor. 1–2 days — don't rush this; schema changes get expensive once UI depends on them.*

**Before starting:** install **Docker Desktop** (decided 2026-07-29) so `supabase db reset` can wipe, re-run all migrations, and re-seed locally. Without it every mistake needs a corrective migration against the remote.

**✅ Stage 1 schema complete 2026-07-29.** Eight migrations applied to `gbxypeofjnhrhotlhyzs` and pushed. Files are named by concern rather than the numbering sketched here, because dependency order forced it: `terms` (defines `term_of`, `app_settings`, `current_term`) must precede `events`, which generates `term`, and `point_adjustments`, which defaults to `current_term()`.

- [x] `20260730000001_terms.sql` — `term_of()`, `app_settings` (single row), `current_term()`
- [x] `20260730000002_members.sql` — `normalized_student_id` generated + unique, `source`, `lower(email)` unique index, not-blank checks
- [x] `20260730000003_events.sql` — `valid_window`, `valid_checkin_window`, generated `term`, `updated_at` trigger, and the overlap **exclusion constraint** (resolved in favour of the constraint over an app-level check; needs no `btree_gist`, since gist handles `tstzrange &&` natively)
- [x] `20260730000004_attendance.sql` — generated `normalized_student_id`, `present_requires_resolution`, partial unique index excluding `rejected`
- [x] `20260730000005_point_adjustments.sql` — `points <> 0`, non-blank `reason`, `void_is_complete`
- [x] `20260730000006_admin.sql` — `admin_profiles`, `admin_audit` + both indexes + append-only triggers
- [x] `20260730000007_resolution_functions.sql` — `open_event_at()`, `nearby_events()`
- [x] `20260730000008_views.sql` — `leaderboard` (total only, anon-readable), `member_directory` (split retained, authenticated only)
- [x] RLS enabled on every table (deny-all until Stage 8) — not in the original plan, but Supabase exposes public tables through PostgREST, so leaving it off would have opened a window with seed data in it

**Departures from the doc, all deliberate:**

- **Check-in windows are half-open `[)`** in both the exclusion constraint and `open_event_at()`. The doc's inclusive `<=` would have made back-to-back events unpublishable — a 6–7 workshop and a 7–8 social collide at exactly 19:00. Verified that adjacent events now coexist.
- Not-blank checks on required text, since `NOT NULL` alone accepts `''`.
- An `updated_at` trigger on `events`; the column existed with nothing maintaining it.

**Types and seed:**

- [x] `lib/types/database.ts` generated — all nine relations and four functions present
- [x] `supabase/seed.sql` — 32 members (3 inactive, 3 self-registered, IDs in mixed formats), 15 events across categories/statuses including one cancelled and two still upcoming, 208 attendance rows (202 present, 5 pending covering all three orphan shapes, 1 rejected), 6 adjustments including one voided and one negative, 2 audit rows. All identities fabricated on `example.edu` (RFC 2606, unresolvable) — **never replace with a real roster; this repo is public**
  - ⚠️ **Moved from Spring 2026 to Fall 2026 on 2026-08-06**, and the `app_settings.current_term` pin was dropped with it. The twelve completed events are compressed into 1–5 August because that is the only elapsed part of Fall 2026; the header comment on the events block carries the full reasoning and the instruction to spread them out again later. Every count above survived the move.
- [x] `scripts/seed-remote.sh` — applies the seed without Docker. `supabase db query` reads only the first line of its SQL argument and Windows caps command lines near 8k, so the script strips full-line comments, flattens each `-- @chunk` to one line, and sends them separately. **seed.sql must therefore never use trailing inline comments.**

**✅ Exit criteria met — every rejection verified against the live database by SQLSTATE, not by assumption:**

- [x] `23514` — `ends_at` before `starts_at`; `present` with either link null; `points = 0`; blank reason; incomplete void; blank student_id
- [x] `23P01` — overlapping published check-in windows
- [x] `23505` — duplicate check-in on `(event_id, normalized_student_id)`; members differing only by ID formatting or by email case
- [x] `428C9` — writing the generated `term` column
- [x] `P0001` — `UPDATE` or `DELETE` on `admin_audit`
- [x] Term boundaries: Jul 31 23:59 → `Spring 2026`, Aug 1 00:00 → `Fall 2026`, Dec 31 23:59 → `Fall 2026`, Jan 1 00:00 → `Spring 2027`, and **Jul 31 7pm Central → `Spring 2026`** (the case a UTC anchor would have filed under Fall)
- [x] Behaviours that must *work*: corrected re-entry after a rejection; back-to-back published events; cancelled events keeping attendance history while contributing no points; `open_event_at()` matching during a window and not after; `nearby_events()` returning a suggestion 2h out and **nothing in June**, so a summer submission is refused rather than queued

**Known caveat:** the `admin_audit` append-only trigger does not stop a table owner — cleaning up test rows required disabling it. It blocks the app and every client role; the service-role and dashboard paths are governed by Stage 8's RLS work. §6 currently claims append-only slightly more strongly than the trigger alone delivers.

## Loose ends — all closed 2026-07-30

Carried over from Stage 0; none blocked Stage 2, and all are now resolved. Kept rather than deleted because several record traps worth not rediscovering. The three Bitwarden sub-items are officer-attested; everything else was verified by API or by live HTTP response.

- [x] ~~**Install WSL** (`wsl --install`, needs a reboot) **then Docker Desktop**~~ — **done 2026-07-29; neither install was actually needed.** WSL 2.7.11 (kernel 6.18.33.2) and Docker Desktop 29.6.2 were both already present; Docker had simply never been launched, so the engine pipe didn't exist. No reboot. Two misleading signals cost time: Docker installs to the **user-level** path `%LOCALAPPDATA%\Programs\DockerDesktop`, so a `C:\Program Files\Docker` check reports it missing, and `wsl --list` reported *no distributions* because Docker Desktop brings its own `docker-desktop` distro, created on first launch.
  - **`db reset` then failed for an unrelated reason:** `failed to read profile: Unsupported Config Type ""` / `LegacyGoChildExitError`. Cause was a dangling `~/.supabase/profile` holding the bare name `misa` — no extension, and no `profiles` subcommand or config file defining it — which the legacy Go child hands to viper. `start` and `db query --linked` were unaffected, so it presented as a `db reset`-only fault. Deleted it; `--profile misa` does **not** work around it. Verified afterwards that remote auth is unchanged: still the **MISA** org, still `gbxypeofjnhrhotlhyzs` linked and `ACTIVE_HEALTHY`, so the profile was redundant.
  - ✅ `npx supabase db reset` now wipes, replays all nine migrations, and re-runs `seed.sql`. Local counts match the documented seed exactly — 32 members, 15 events, 208 attendance, 6 adjustments, 2 audit rows, 29 leaderboard rows (32 less the 3 inactive), `current_term()` = `Spring 2026`. This also independently proves the §2.3 handoff path: `migrations/` alone rebuilds the database.
  - Local `config.toml` pins `major_version = 17`; the remote reports 17.6, so local and production agree.
- [x] **Set the Vercel function region to `cle1`** — done 2026-07-29 as **`vercel.json`** (`{"regions": ["cle1"]}`), *not* the dashboard setting the original note assumed. Deliberate divergence: a dashboard-only value is invisible to the repo and lost if the project is ever recreated, which is exactly the §2.3 `create project → link → db push` handoff path. In `vercel.json` it is version-controlled and travels with the code.
  - `cle1` is **us-east-2 (Cleveland)** — the *same AWS region* as the Supabase project, so this is co-location with the database, not merely "closest to Austin." Default for new projects is `iad1`.
  - Hobby allows a **single** function region, which is what this is; multi-region is Pro+ and `functionFailoverRegions` is Enterprise-only, so neither was used. Over-plan region counts fail *before* the build step — `vercel build` got well past that and emitted all functions, so the config is accepted.
  - ✅ **Live in production.** Confirmed by `vercel inspect` on the deployment holding the `misa-website-beta.vercel.app` alias: every function is built into `[cle1]`. Like any build-time setting it took effect only on the next deploy, so a future change to `vercel.json` needs a redeploy too.
- [x] **Confirm Deployment Protection reads Standard Protection**, not Disabled — ✅ confirmed 2026-07-29 **empirically rather than by reading the dashboard label**, which is stronger: the production alias `misa-website-beta.vercel.app` returns **200**, while per-deployment URLs return **302 → `vercel.com/sso-api`**. That pair is the unique signature of Standard Protection — under Disabled the per-deployment URLs would be 200, under "All Deployments" the alias would gate too. No change needed.
  - ~~Worth knowing: **all 22 deployments to date are `Production`, and zero are `Preview`**~~ — **stale as of 2026-07-31.** Preview deployments now exist (the `stage-5-attendance-review` branch has been pushed several times), so the §6 preview exposure is real rather than theoretical. Standard Protection is what contains it: per-deployment URLs return 302 → `vercel.com/sso-api`, so a preview is reachable only by someone signed into the Vercel account. Re-verify that gate before ever sharing a preview URL.
- [x] **Move the DB password** out of the plaintext file in the home directory — **§2.5 resolved 2026-07-30: Bitwarden.** The vault holds the GitHub 2FA recovery codes and the Supabase database password, and §2.4's inventory is filled in. Two follow-ups below; neither is verifiable from this machine, so both are on you.
  - [x] **Original plaintext file deleted.** Copying into the vault was only half of "move"; the original is gone.
  - [x] **Vault is a Bitwarden *organization*, not a personal account** — two users, shared collections, so it satisfies §2.5's "survives one person graduating" and "hand to a successor as a unit."
  - [x] **Bitwarden's own recovery path is not the MISA email**, so the vault holding that mailbox's 2FA recovery codes is not circular.
  - *These three are confirmed by the officer, not machine-verifiable from the repo — unlike the GitHub and Vercel items above, which were checked by API. Re-confirm at handoff.*
- [x] **Add a second GitHub org Owner** to `Texas-MISA` — ✅ **done and verified 2026-07-30.** `gh api /orgs/Texas-MISA/members?role=admin` returns exactly two Owners: **`TXMISA-JD`** (the MISA email) and **`cgonztx-gif`** (officer personal account). They are also the org's only two members. This closes what §2.4 called the one live single point of failure. Re-check at every turnover — a graduating officer's personal account must be *replaced*, not just removed, or the org drops back to a single owner.
- [x] **Narrow org base permissions from Admin to Read** — ✅ **done and verified 2026-07-30.** `default_repository_permission` now reads `read`. No effect on current access (both members are Owners, who keep admin regardless); it shapes what the next officer who joins as a plain member inherits. The local `gh` token now holds `admin:org` (scopes: `admin:org, gist, repo, workflow` — `admin:org` subsumes the old `read:org`).
- [x] **Require 2FA org-wide** — ✅ **done and verified 2026-07-30.** `two_factor_requirement_enabled` now reads `true`. Both Owners survived the flip (`cgonztx-gif`, `TXMISA-JD`), `filter=2fa_disabled` returns 0, and the repo is still reachable — checked explicitly, because enabling the requirement *removes* non-compliant members.
  - 🪤 **Worth keeping: `two_factor_requirement_enabled` is read-only in the REST API.** It exists in the *response* schema of `GET /orgs/{org}` but is **not** a settable body parameter of `PATCH /orgs/{org}`. The PATCH returns success and changes nothing — no error, no effect. Three attempts were lost to this before it was root-caused. **The web UI is the only route:** Organization settings → **Authentication security** → *Require two-factor authentication…*
  - Before adding officers, re-check `filter=2fa_disabled` — a member without 2FA cannot join while the requirement is on.

  - 🔗 **This is now coupled to §2.5, which changes its priority.** `TXMISA-JD` is the shared mailbox account — the recovery root for Supabase, Vercel, and the registrar (§2.4). Binding 2FA to it without storing the **recovery codes** somewhere durable makes handoff *worse*, not better: it is the classic student-org failure where 2FA lives on one person's phone and that person graduates. §2.5 also rules out keeping the codes inside the MISA Google account, since that account is the recovery path for the others.
  - **So pick the vault (§2.5) before enabling 2FA here**, and store the recovery codes as you generate them. The DB password can then move into the same vault in one pass.

**Fixed in passing (2026-07-29):** `npm run lint` started failing with 154 errors in minified code after `supabase start` ran — it writes `supabase/.temp/start-secrets/.../main/index.ts` (the edge-runtime entrypoint), and ESLint flat config does **not** read `.gitignore`, so a gitignored path is still linted. Added `supabase/.temp/**` and `.vercel/**` to `globalIgnores` in `eslint.config.mjs`. This would have hit every officer who runs the local stack. Do not "fix" such errors with `--fix`; the code is vendored, not ours.

## Done — Stage 2: Public landing page (2026-07-30)

*Goal: something worth showing people. Exit: a stranger understands what the org does and when it meets. 2–3 days, mostly content and design rather than logic.*

**Built 2026-07-30**, then immediately **rebuilt as a recreation of the existing site**, [txmisa.org](https://www.txmisa.org/) — all six of its pages, similar UI, real copy. Surveyed page-by-page into [`docs/existing-site-inventory.md`](docs/existing-site-inventory.md), which is the reference for what was reproduced and what was deliberately left out. Expected to be edited heavily later; this is a starting point, not a final design.

- [x] **Real copy** — no longer placeholder: mission, four pillars, MISA history, seven FAQs, both project write-ups, all 13 officers with roles and LinkedIn URLs, and the real emails/socials all came from the live site. `lib/site.ts` and `lib/officers.ts` hold the content; `docs/existing-site-inventory.md` records provenance.
  - Still placeholders, on purpose: **photography** (officer headshots, gallery, project photos) and **partner logos**. Real photos of real people and trademarked logos don't belong in a public repo without permission — cards show initials, gallery/projects show sized tiles. Drop assets into `public/` and swap them in.
  - The **contact form renders but is disabled** — the original posts to Squarespace and there's no replacement backend. Emails are the working path; wiring the form means a Server Action plus a delivery mechanism (§3), which is a later decision.

**Pages** (original Squarespace slugs in parentheses): `/` , `/about` (`/about-us-1`), `/gallery`, `/officers`, `/projects` (`/general-2`), `/contact` (`/contact-us`). Shared chrome in `components/site-header.tsx` (sticky slate-blue bar, centred text wordmark, socials, active-link underline, mobile menu — a Client Component only for `usePathname` and the menu toggle) and `components/site-footer.tsx`. Brand tokens (`--misa-blue`, `--misa-panel`) and the marquee keyframes live in `app/globals.css`; fonts are Roboto Slab + Poppins, approximating the original's slab-serif/geometric-sans pairing.
- [x] Upcoming events pulled live from `events where status = 'published'` and `starts_at > now()` — verified on the rendered page: `Fall Kickoff` appears; the draft `Fall Info Session`, the cancelled `Rained Out Tabling`, and past published events do not. Times render in **America/Chicago** via `Intl.DateTimeFormat` (the server runs in UTC — never format without an explicit zone).
  - This needed one RLS policy **pulled forward from Stage 8**: `20260730000009_events_public_read.sql` — anon/authenticated `select` where `status = 'published'`, which is exactly the §6 grant (doc v1.16). Verified at the PostgREST boundary with the anon key: 13 published rows, no draft, no cancelled. Everything else stays deny-all; all writes stay deny-all.
  - First use of the generated types: `Database` is now threaded through both `createServerClient` and `createBrowserClient`.
- [x] Officer roster — all 13 real officers, `/officers` cards carry LinkedIn buttons, the home grid doesn't (matching the original)
- [x] Mobile-first responsive layout — everything single-column first, grids widen at `sm`/`lg`, nav collapses to a hamburger below `lg`. Sets the conventions §1.2's 20-second check-in inherits.
- [x] Replace the `create-next-app` boilerplate — `app/page.tsx` deleted in favour of `app/(public)/page.tsx`, all five `public/*.svg` boilerplate assets dropped, root layout metadata now TEXAS MISA with a title template
- [x] Stage 0 scaffolding torn down: `app/db-check/` deleted; `_stage0_check` dropped in `20260730000010_drop_stage0_check.sql` (the original `00000000000000_stage0_check` migration stays so `db reset` replays cleanly)

**Verified 2026-07-30:** all six routes return 200 and were eyeballed in the browser; `Fall Kickoff` still shows on the home page and the draft still doesn't; `npm run lint` and `npm run build` both clean (`/` dynamic, the other five static).

## Low priority — deferred, not blocking anything

Cosmetic and content polish on the public site. None of it gates Stage 3 or any
later stage; pick it up between stages or when someone hands over the assets.

- [ ] **Add real photography** — officer headshots (`/officers` and the home grid), gallery photos, project photos. Cards currently show initials; gallery and projects show correctly-sized placeholder tiles, so the layout won't shift much. Drop files in `public/` (e.g. `public/officers/`, `public/gallery/`), then swap the placeholder `div`s for `next/image` — `components/ui/officer-card.tsx`, `app/(public)/gallery/page.tsx`, `app/(public)/projects/page.tsx`. Add a `photo` field to the `Officer` type in `lib/officers.ts` rather than deriving filenames from names.
  - ⚠️ **The repo is public.** These are photos of identifiable students, so get the officers' okay before committing them, and prefer images the org already publishes on the live site.
  - `next/image` needs no config for files served from `public/`; only remote hosts need `images.remotePatterns` in `next.config.ts`.
- [ ] **Add partner logos** — currently rendered as styled wordmarks in `components/ui/partners.tsx` (KPMG, pwc, ConocoPhillips, Credera). Real logos are trademarked; the safe route is the versions each company publishes in its own brand/press kit, used per those guidelines. Worth confirming the partner list is current before spending effort on it.
- [ ] **Decide whether the contact form gets a backend** — it renders disabled with email as the working path. Wiring it means a Server Action plus somewhere to deliver the message (§3: all writes go through Server Actions). Doing nothing is a legitimate answer; the emails work.
- [ ] **The heavier redesign** this recreation is a starting point for.

## Done — Stage 3: Attendance capture (2026-07-30, deployed & smoke-tested)

*The core feature (§7). Code, tests, docs, deploy, and production smoke test all complete.*

- [x] **Vitest chosen** (the Stage 3 decision) — 37 tests in 4 files, integration-first against the **local stack**: real Postgres, timestamps injected into `open_event_at()`/`nearby_events()`, no clock mocking. `npm test` needs Docker Desktop + `npx supabase start`; single test: `npx vitest run tests/checkin.test.ts -t "<name>"`.
- [x] `lib/checkin.ts` — `resolveCheckin()` core (§4.2/§4.3 order), `ORPHAN_WINDOW_HOURS = 48` (the §9 #7 exported constant), `normalizeStudentId()` JS mirror of the SQL expression (lockstep-tested), `checkRateLimit()`. No `next/*` imports, so tests inject clients and time.
- [x] `app/actions/attendance.ts` — `submitCheckin` Server Action: honeypot → zod (`lib/validation.ts`) → per-IP rate limit → resolve. Service-role client only here + `lib/supabase/admin.ts` (`server-only`-guarded).
- [x] `/attend` — three-field, phone-first form (`useActionState`, works pre-hydration); distinct present/pending/duplicate/refused/invalid/rate-limited/error states; in the nav as **Check In** and linked from the home events section.
  - [x] **First-time checkbox + conditional confirmation** (doc v1.22, spec `docs/attend-confirmation-flow.md`). Two more states — `unmatched` (re-prompt, nothing written) and `needs_confirmation` (review screen) — on the same `useActionState` machine, so both steps work pre-hydration. `submitCheckin` stays a single export and takes a `step` field; the confirm pass re-runs honeypot, zod, throttle, and resolution from scratch. Nothing persists between passes, so **no migration**. `RATE_LIMIT_MAX` 30 → 90, since a first-timer now spends two slots.
- [x] **Duplicate rule decided and recorded** (doc v1.18): index on `(event_id, normalized_student_id)` + app check on `(event_id, member_id)` + orphan-resubmission check. Pending orphan never blocks a later resolved check-in; rejected never blocks re-entry.
- [x] Migrations: `…000011_checkin_throttle` (rate-limit table, deny-all RLS) and `…000012_api_role_grants` — **the trap find of the stage**: newer stacks grant the API roles only `TRUNCATE/REFERENCES/TRIGGER` on new tables, so a fresh `create → link → db push` would be silently broken; codified the classic grants, RLS stays the boundary. Types regenerated.
- [x] **§7 exit criteria verified in a real browser** against the local stack: during-window ⇒ `present` on the correct event + member self-registered (`source='self_checkin'`); 1h after close ⇒ `pending` orphan; nothing within 48h ⇒ refused, zero rows. Lint + build green (`/attend` static, action request-time).
- [x] **Deployed 2026-07-30.** `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (the pasted value needed cleaning — leading space + curly quotes from the clipboard, the recurring Stage 0 trap; verified working with a service-role read before use) and in Vercel Production + Preview via CLI. `…000012_api_role_grants` pushed to the remote; migration history in sync.
- [x] **Production smoke test passed**: synthetic published event, fake identity (`T3-777001`) submitted through the live form ⇒ "You're checked in!", row `present` with both links, member self-registered (`source='self_checkin'`, active). Cleaned up in FK order (attendance → member → event → throttle row); remote counts back to the exact documented seed (208/32/15/0).

**§7 exit criteria met in production and locally; Stage 3 complete.** Next: Stage 4 (admin foundation & event management) — until Stage 5 ships, pending orphans accumulate with no UI to resolve them, which is by design for now.

## Done — Stage 4: Admin foundation & event management (2026-07-30, verified locally)

*Officers run the schedule from the UI; every mutation is audited. Doc v1.19. 97 tests across 6 files.*

- [x] **Auth end to end.** `proxy.ts` (session refresh + optimistic redirect), `lib/auth.ts` DAL (`getOfficer`/`requireOfficer`), `app/actions/auth.ts`, `/admin/login`, and `app/admin/(shell)/` carrying the authed chrome.
  - **Session refresh was verified deliberately**, not assumed: `jwt_expiry` dropped to 10s locally, then the token chain checked across several navigations — each request's outgoing cookie became the next request's incoming one, unbroken past three expiries. Restored to 3600 afterwards.
  - 🪤 **`supabase db reset` does NOT re-read `config.toml`.** Container env is baked at `supabase start`, so a changed `jwt_expiry` needs a full `stop` + `start`. Half an hour went into a "session keeps dying" hunt that was really a 10-second token lifetime still live in the auth container. Check `docker inspect supabase_auth_… | grep GOTRUE_JWT_EXP` before believing a config change took.
- [x] **Officer bootstrap** — `scripts/create-officer.mjs` (`--local`, `--reset-password`, `--revoke`). Password comes from stdin or `OFFICER_PASSWORD`, never argv. Only a local dev officer was created; **the production officer is yours to create.**
  - 🪤 **Fixed a latent seed bug:** the stand-in officer in `seed.sql` left eight `auth.users` token/change columns NULL. GoTrue deserializes them into non-nullable Go strings, so `auth.admin.listUsers()` failed with a bare 500 — breaking any lookup-by-email. They are now `''`.
- [x] **Read-only screens** — dashboard (recent check-ins, pending-review badge) and `/admin/events` with term/status/category/series filters, defaulting to `current_term()`. Officers see drafts; the public site still doesn't.
- [x] **`lib/events.ts`** — the pure core: Central wall-clock conversion, half-open window helpers, `expandSeries`, `duplicateDraft`, `previewEventEdit`, `impactToken`, `findWindowConflicts`. No `next/*` imports.
- [x] **Single-event CRUD + lifecycle + audit** — create, edit, publish/unpublish/cancel, duplicate, delete-blocked-with-attendance. `app/actions/audit.ts` is the shared writer.
- [x] **Edit-impact warnings (§4.6)** — points, times moved, term crossed, window narrowed; two-step confirm whose token doubles as an `updated_at` compare-and-set.
  - 🪤 **React 19 resets an uncontrolled `<form action>` after the action resolves.** The first build silently reverted the officer's edits when the warnings rendered, so "save anyway" would have saved the *old* values. Fixed by echoing the submitted values back in the action's state and driving every `defaultValue` from them. Worth remembering for every future admin form.
- [x] **Recurring series + duplicate** — `createSeries`, `publishSeries` with the conflict pre-flight and "publish the rest", `setSeriesStatus`, `duplicateEvent`.
- [x] **Vitest**: `tests/events.test.ts` (pure: DST, half-open windows, impact maths) and `tests/event-actions.test.ts` (integration: 23P01 atomicity, CAS, append-only audit, `term_of`). `vitest.config.ts` aliases `server-only` to a stub so server modules are importable under test.

**Verified against the local stack:** a 12-week Tuesday series spanning the 2026-11-01 DST change generated 12 drafts all reading 18:00 Central while UTC shifted 23:00→00:00; publishing with one deliberate collision named the exact occurrence and refused, then "publish the rest" published 11 and left that week a draft; editing a seeded meeting to 3 points and August warned "19 members' totals change by +2 each (+38 overall)" and "Spring 2026 → Fall 2026" before saving, and the `admin_audit` before/after matched. Lint and build clean.

**Deployed 2026-07-30** (`ebe3233`, plus `64d29e2` making draft-vs-publish an explicit button on the create form). No new env vars and no migrations were needed. The production officer account is registered and `/admin/login` is live; admin routes return 307 to it when signed out, including paths that don't exist, so the gate leaks no route names. **Stage 4 complete.**

## Done — Stage 5: Attendance review & manual adjustments (closed 2026-08-01)

*Officers can see every submission, correct any of them, and award points that never came from a check-in (§7 Stage 5). 5–6 days, shipped in five phases so each ends with something demonstrable. Branch: `stage-5-attendance-review`.*

### ✅ Phase 1 — schema, pure core, read-only queue (2026-07-31, `de352a1`)

- [x] **Migration 13** — `attendance.updated_at` + trigger reusing `set_updated_at()`, and `point_adjustments.void_requires_reason`. **Applied to both local and the remote** (`gbxypeofjnhrhotlhyzs`); migration history in sync. Types regenerated.
  - Checked the remote for violating rows *before* pushing (`(voided_at is null) <> (void_reason is null)` → 0). A constraint that fails mid-migration is a bad way to find out.
  - ⚠️ `supabase gen types --local` omits the `__InternalSupabase` block that `--linked` emits. Restore it by hand or the diff looks like a regression.
- [x] **`lib/attendance.ts`** — interval parsing, `describeGap`, member-candidate scoring with bounded Damerau-Levenshtein, `diffStudentId`, `previewResolution`, `canApprove`. Pure, same contract as `lib/events.ts`.
- [x] **`lib/points.ts`**, six zod schemas, `AuditAction` extended by seven verbs, `seed.sql` audit actions aligned to the union.
- [x] **`/admin/attendance`** — read-only queue, URL-driven filters (status / event / date range / sort), pending + oldest-first by default. Nav unlocked; dashboard badge links in; `StatusPill` extracted for its third caller.
- [x] **59 new tests** (156 total), lint and build clean, verified in a real browser against the local stack: 5 pending rows covering all three orphan shapes, 208 on `status=all` matching the documented seed exactly.

**Two traps found, both now recorded as invariants:**

- 🪤 **Date-range filters must be Central-anchored and half-open.** `to=2026-04-07` has to include the seed's 8:15 PM CT orphans, which are `01:15` **UTC the next day**. A bare `.lte("submitted_at", "2026-04-07")` returns zero rows and looks entirely reasonable.
- 🪤 **`Intl.DateTimeFormat` in a Client Component is a hydration mismatch.** Node and Chrome ship different ICU data for the space before "PM", so React's diff shows two apparently identical strings. Server Components own date formatting.

**And one that predated Stage 5:** `npm test` was failing intermittently at roughly a 50% rate — a different test each run, always a Kong 502 under parallel workers sharing the one local stack. `fileParallelism: false` fixes it; 0 failures across repeated runs, still ~4s.

### ✅ Phase 2 — submission detail (read-only) · verified in the browser 2026-07-31

- [x] `/admin/attendance/[id]` — raw form data as typed, timestamp to the minute in Central, current links, `previewResolution()` warnings
- [x] Ranked event suggestions from `nearby_events()` with the window-relative headline and the event-relative number beside it
- [x] Ranked member candidates with the first differing ID character marked; nothing preselected, empty state says so
- [x] `lib/admin-profiles.ts` → `fetchOfficerNames()`, and the shared `AuditTrail` with a computed before/after diff
- [x] **Verified in the browser** against the local stack, one seeded row per shape (ids are local-only and change on every `db reset` — re-query with `select id, submitted_name from attendance where status <> 'present' order by submitted_at;`):
  - `Luca Moretti` — orphan, member linked, no event ⇒ one suggestion, `General Meeting #6`, "check-in closed 1 hour 15 minutes before this submission (event ended 1 hour 15 minutes before)", `CLOSEST` badge, member section correctly hidden
  - `Rowan Pike` `UT-100999` / `Sage Delacroix` `ut 100998` — event linked, unknown ID ⇒ member suggestions, event section hidden
  - `Toby Vance` — neither link ⇒ the only row rendering **both** sections; `Interview Prep` at 14 hours past close
  - `Bela Kovacs` on the cancelled `Rained Out Tabling` ⇒ the warnings block, "This event is cancelled, so approving here credits nobody"
  - `Mira Petrova` rejected ⇒ the only attendance row with history: "Rejected by **Seed Officer**", note, and the diff `status: pending → rejected` — `fetchOfficerNames()` and `AuditTrail`'s `Diff` both confirmed
  - edges: unknown id ⇒ 404; signed out ⇒ 307 to `/admin/login` with `next` preserved; the Event link reaches the real `/admin/events/[id]`
- [x] 🪤 **Fixed: the near-miss highlight marked the formatting, not the digit.** `diffStudentId` compared the **raw** ID strings, so `ut 100998` vs `UT100028` "first differed" at index 0 — the case of the `u` — and the page rendered `roster `**`U`**`T100028`. The seed stores IDs in four formats precisely because members type them four ways, so this fired on most real pairs and pointed the officer at the one character that carries no information. Now compared on `normalizeStudentId()` with the index mapped back onto the raw string, and null when the two ids are the same person's in different formats. Five tests added; the old ones all used same-format IDs, which is exactly why it survived phase 1. **160 tests** (the "156" recorded earlier was one over the real 155).
- [x] **Deferred to phase 3, and built there** as `lib/event-options.ts`: the independent all-status event picker. `nearby_events()` is published-only and returns nothing beyond 48h, so suggestions alone cannot express every assignment — but the picker is a form control, so it belongs with the mutations rather than on a read-only page.

**Two findings left open at the time — both closed in phase 3:**

- ✅ **Member suggestions surfaced unrelated people at exactly the score floor.** `Rowan Pike` `UT-100999`, on no roster at all, was offered `Dara Nolan`, `Farid Haddad`, and `Omar Silva` (IDs ending `…019`, `…009`, `…029`), each scoring exactly `MIN_SUGGESTION_SCORE` on `id_near_miss` distance 2 alone. Six-digit IDs issued in sequence put three members within distance 2 of *any* number, so that similarity is a coincidence rather than a signal. Distance 2 now scores below the floor and needs corroboration; distance 1 still stands alone. Rowan Pike renders the empty state.
- ✅ **The queue's filters are no longer lost on the round trip** — see phase 3.

**Confirmed as correct, not a bug:** the window-relative and event-relative gap numbers read identically on every seeded row. `describeGap` separates them on purpose, but no seeded event sets `checkin_opens_at`/`checkin_closes_at`, so `effectiveWindow` falls back to `starts_at`/`ends_at` and the two genuinely coincide. Set a late close on an event to see them diverge.

### ✅ Phase 3 — mutations (2026-07-31, browser-verified)

- [x] `app/actions/attendance-review.ts` — `saveSubmission` (one save per officer intent: edit the typed fields, set both links, and approve in a single write and a single `attendance.approved` audit row), `rejectSubmission`, `reopenSubmission`, `bulkAssignEvent`, `createManualAttendance`. CAS on `updated_at` for every single-row mutation; `redirect()` outside the try/catch throughout.
- [x] Approve disabled until both links are set, with a `title` naming the missing one; `canApprove()` re-checked server-side and `present_requires_resolution` still the guarantee
- [x] Bulk assign — explicit selection only, `planBulkAssign()` in `lib/attendance.ts` does the deduping, two statements, auto-approve opt-in and never default, partial success reported with a reason per skipped row
- [x] Manual entry at `/admin/attendance/new` (`source = 'admin_manual'`) — **this also fixed a live 404**: the queue has linked to that route since phase 1 and nothing was there
- [x] The all-status event picker deferred out of phase 2, now `lib/event-options.ts` and shared by the queue filter, the resolution form, and manual entry
- [x] Queue filters survive the round trip — row links, the back-link, and the post-mutation redirect all carry the `searchParams`. Approve and reject return to the *filtered* queue (the drain loop); a plain save stays on the row.
- [x] `createCurrentTermEvent()` and `Tracker.attendanceIds` closed — see below
- [x] **182 tests** (10 new pure, 12 new integration in `tests/attendance-review.test.ts`), lint and build clean

**Verified in the browser against the local stack**, every one a real write: assign + approve in one click wrote exactly one `attendance.approved` row whose before/after showed `member_id` null → set and `pending` → `present`, and returned to the filtered queue with the row drained; a bulk assign of two submissions from the same person assigned one and reported *"Toby Vance — the same person as another row you selected; the earlier submission was kept"* with no 23505; manual entry for Spring Kickoff at 6:15 PM Central stored `2026-01-28 00:15Z` (CST, correctly); reopening a rejected row put it back in the queue.

**Three defects found and fixed during that walkthrough** — none would have been caught by the tests:

- 🪤 **APPROVE stayed disabled after picking an event.** Its enabled state was derived from the server's copy of the row rather than the live `<select>`, so the officer had to SAVE, wait for the round trip, and only then approve — two writes for one intent, defeating the entire one-save design. The link values are now tracked in component state.
- 🪤 **The bulk bar's count outlived its checkboxes.** React resets the form when the action resolves, so after an assign the bar read "2 selected" above six empty boxes. Cleared on completion by resetting state during render.
- 🪤 **Every ordinary officer was credited as "a former officer".** `create-officer.mjs` left `admin_profiles.display_name` null unless `--display-name` was passed, and `fetchOfficerNames` dropped nameless rows — collapsing "current officer, no display name" into "profile deleted, i.e. revoked". In the one log that exists to say who did what (§6), that is the exact opposite of the truth. The map now distinguishes absent from null, the trail says "an officer" for the middle case, and the script defaults the name to the email's local part.

**One doc correction:** the note that the seed's `Mira Petrova` row is the live 23505-on-reopen case is **wrong**. `seed.sql` inserts that rejected row only `where not exists` a non-rejected row for the same member and event, so its slot is by construction free and it reopens cleanly. The collision is real and covered by `tests/attendance-review.test.ts`, which builds the contested pair explicitly — but it cannot be reproduced from seed data.

### ✅ Phase 4 — `/admin/points` (2026-07-31, browser-verified)

- [x] ~~Decide §9 #9 and #10 first~~ — both resolved 2026-07-31: no grant restrictions, self-grants allowed. `grantPoints` carries **no** role check and **no** self-grant check, and says so in its header so neither gets added back as an "oversight".
- [x] `app/actions/points.ts` — `grantPoints` (multi-member, **one atomic insert**, `term` in the `.select()` only and never in the payload) and `voidAdjustment` (guarded on `.is("voided_at", null)`, no CAS token — the table has no `updated_at` and needs none). Two exports and no more: there is no update path and no delete.
- [x] Ledger at `/admin/points` with officer / category / member / date-range / state filters; grant at `/admin/points/new`; adjustment detail at `/admin/points/[id]` with the void form and the shared `AuditTrail`. Nav entry unlocked in the same commit as the page.
- [x] `lib/member-options.ts` — extracted first, in its own commit. `fetchMemberOptions` was duplicated in `attendance/new/page.tsx` and `attendance/[id]/page.tsx` and the copies had drifted; the grant picker was the third caller.
- [x] **26 new tests** (208 total), lint and build clean

**The member picker does NOT carry selection in the URL.** The `?q=…&sel=…` scheme sketched here previously is superseded. Its whole purpose was to survive a navigation — but the roster already arrives as a bounded scan (`MEMBER_SCAN_LIMIT`, and *why* it is a scan rather than an ILIKE probe is recorded on that constant), so the filter runs in the browser and **there is no navigation to survive**. The URL scheme would also have put a 50-uuid list in the address bar and made every keystroke a server round trip. Two things the client-side version must get right instead, both of which produce *a partial grant that reports success*:

- **The payload rides on hidden inputs, not the roster list's checkboxes.** Filtering unmounts rows, and an unmounted input is not in the FormData — so typing a new search term after picking would silently drop the earlier picks.
- **One carrier per id:** the roster list excludes anyone already selected, so no member can be mounted twice (two rows, double points, and no constraint to catch it). `grantPoints` dedupes server-side as the backstop, not as the fix.

**Three defects found in the walkthrough, none of which a test would have caught:**

- 🪤 **The void's audit diff invented changes.** `before` selected more columns than `after`, and `AuditTrail` renders a key missing from one side as `—`, so voiding logged `reason: "Staffed the info booth" → —` and `awarded_by: <uuid> → —` — as though the void had erased the reason and the awarding officer. Both sides now share `AUDITED_ADJUSTMENT_COLUMNS`.
- 🪤 **An oversized selection was truncated rather than refused.** The dedupe sliced to `MAX_GRANT_MEMBERS` *before* validation, so a hand-rolled POST of 60 ids would have granted silently to the first 50 — the exact partial-grant failure the atomic insert exists to prevent.
- 🪤 **`AUDITED_ADJUSTMENT_COLUMNS` must be one unbroken literal with `as const`.** PostgREST types the returned row off the string *literal*; `"a, b" + "c"` widens to `string` and collapses the result to an untyped error shape.

### ✅ Phase 5 — docs (2026-08-01)

- [x] Architecture doc → **v1.20**, `CLAUDE.md` invariants, this file
- [x] Architecture doc → **v1.23** and the `CLAUDE.md` amendments for phase 4 — the atomic-grant exception to the partial-success invariant, the audit-column-symmetry invariant, and the client-side picker superseding `?q=&sel=`
- [x] README replaced — it was still `create-next-app` boilerplate on a **public** repo, telling visitors to edit `app/page.tsx`, which Stage 2 deleted
- [x] Route table and phase table in the architecture doc; two stale `tasks.md` headings (Stage 2 marked "Now"; the `/attend` checkbox filed as "not built")
- [x] **Merged to `main` and deployed 2026-08-01** (`0fe85d2`)
- [x] **Final read-through of the whole stage** — done 2026-08-01, doc → **v1.24**. Re-verified against the running system rather than taken on trust: **208 tests / 10 files pass**, lint and build clean, all **14 migrations identical local and remote**, and every Stage 5 route present in the production build output. Four pieces of drift found and fixed, none of them code:
  - The architecture doc's Stage 5 heading still read *"phases 1–3 of 5 built"* and its status line *"in progress"*, two versions after phase 4 shipped.
  - §5's route table was missing `/admin/events/series` — a live route since Stage 4 — and §10's layout was missing six modules that exist (`/admin/points`, `app/actions/auth.ts`, `lib/event-options.ts`, `lib/member-options.ts`, `lib/admin-profiles.ts`, `lib/supabase/admin.ts`). §10 is the first map a new officer reads.
  - `CLAUDE.md` carried a stale status paragraph — *"Stage 2 (public site) in progress"* — four lines below one saying Stage 5 was complete. Its layout block also listed `lib/filters.ts` and `lib/export.ts` as though they existed, and filed the built `/attend` under "later".
  - The Stage 7 revalidation carry-forward existed only here, in a stage section that gets archived. It is now in the doc's Stage 7 checklist too (see below).
- [x] **Two claims checked against the live databases, both true.** The remote `admin_audit` does carry exactly two pre-Stage-5 rows with the bare verbs `reject` and `void`, permanently uncorrectable — so the "readers must tolerate unknown action values" invariant is load-bearing, not hypothetical. And on the seeded roster `leaderboard.total_points` equals `member_directory.attendance_points + bonus_points` for every member, with the negative adjustment reducing the total and the voided one contributing nothing (§4.4, §9 #11).

**Carry into Stage 7 — now recorded in the architecture doc's Stage 7 section as well, which is where it will actually be read.** `revalidatePoints` in `app/actions/points.ts` deliberately does **not** revalidate `/admin` (nothing on the dashboard aggregates points) and cannot yet revalidate `/leaderboard` (the route doesn't exist). Granting and voiding both move public standings, so **that path must be added the day `/leaderboard` ships** — otherwise it is a stale-cache bug discovered three stages later.

**✅ Both test-harness gaps closed in phase 3** — each would have made green tests that prove nothing:

- **The 2030 fixtures cannot exercise the views.** `helpers.ts` puts fixture events in 2030, so `events.term` is `"Spring 2030"`, and both views filter `e.term = current_term()`; every leaderboard assertion would have passed vacuously at zero. `createCurrentTermEvent()` now places the event a few hours in the past, reads back the generated `term`, compares it to `current_term()`, and throws if they differ — so a run straddling Aug 1 / Jan 1 fails loudly rather than silently asserting nothing. Both values come from the database; no term string is typed (§4.7).
- **`cleanup()` leaked attendance rows with neither link** — it deleted only by `event_id` or `member_id`, and that is the queue's most important fixture shape. `Tracker.attendanceIds` plus a `createTestAttendance()` helper closes it; a full run is now member-neutral (verified 33 → 33). (`point_adjustments` needs no pass: `member_id` cascades.)

## Done — `/attend` first-time checkbox (built in Stage 3, doc v1.22)

Spec: [`docs/attend-confirmation-flow.md`](docs/attend-confirmation-flow.md). Decided **and built** 2026-07-31 — kept here because the reasoning is what a future officer needs when one of these decisions stops fitting, not because anything is outstanding.

A check-in optionally declares "this is my first time". A returning member whose details match is written immediately and sees the same success screen as today — the fast path is unchanged. An unmatched submission from someone who did **not** tick the box is **re-prompted and not written at all**; a first-timer gets a review screen and is written only on confirm.

Three things not to rediscover the hard way:

- **This narrows the "nothing is ever dropped on the floor" invariant** — the amendment is recorded under that invariant in `CLAUDE.md`, and landed with `lib/checkin.ts`.
- **It needed no migration** — nothing is persisted between steps, which is what made it much smaller than it sounded.
- **The membership oracle is accepted**, deliberately and against the stance §6 takes for the officer login. The reasoning is in the spec; don't "fix" it.

## Done — Stage 6: Member directory (closed 2026-08-08, all 9 phases)

*The screen officers will actually live in (§7 Stage 6). **Re-planned 2026-08-01**, after phase 1 had already shipped — see "What changed and why" below. Nine phases now, same shape as Stage 5: each ends in something demonstrable, and each merges to `main` as it lands rather than waiting for the stage. Branch: `stage-6-member-directory` off current `main`.*

**Exit criterion, and the thing to build toward:** an officer filters the directory to members who have **not paid dues for the current term**, sees an accurate count, clicks copy-emails, and pastes a complete list — **every** matching member, not just the visible page.

⚠️ **Where that lands moved on 2026-08-05 (doc v1.34).** It used to be reachable at the end of phase 5, when "Paid Dues" was a custom field an officer ticked by hand. Dues is now a **calculated** column built by **Stage 6.5**, which interrupts this stage between phases 5 and 6 — so phase 5 ships the export machinery, 6.5 makes dues real, and the criterion is demonstrated against the real column at the end of 6.5. Meeting it against a hand-ticked dropdown in the interim would prove the export works and prove nothing about the question officers actually ask.

The criterion used to read "attended fewer than three events this term". That query no longer fits the screen: `events_attended` is not a directory column any more, and filtering now narrows to what is displayed. It moves to the relational filters in phase 6.

### What changed and why (2026-08-01)

Four decisions, taken after phase 1 was built, merged, and deployed. Together they invalidated enough of phases 2–6 to be worth re-planning rather than patching.

1. **"Student ID" becomes "EID"** — and not merely as a label. The identifier itself becomes a real UT EID (alphanumeric, `abc1234`), replacing the `UT` + six-sequential-digit format the seed and the suggestion ranker were built around.
2. **The directory shrinks to four columns** — Name, Email, EID, Total Points — plus officer-defined custom fields. Everything else moves to a per-member detail page.
3. **Officers can define their own member fields**, primarily dropdowns (T-shirt size → S/M/L, Major, Committee). Non-calculated fields are editable inline from the directory, and inline-editability is chosen when the field is created.
   - ⚠️ **This read "Paid Dues → Yes/No, T-shirt size → S/M/L" until 2026-08-05.** Dues left the custom-field mechanism entirely — see Stage 6.5 below — and the `dues` key is now reserved so it cannot come back as a second, conflicting answer beside the calculated column. The mechanism is unchanged and still right; dues was the wrong thing to build on it.
4. **Sorting and filtering narrow to what is displayed**, custom fields included.

**Two structural consequences drove the new phase order.** Neither is obvious and both are expensive to find late:

- **The detail page can no longer wait until phase 3.** Removing six columns from the directory before their new home exists makes that data unreachable. The column reduction and `/admin/members/[id]` must land in the same phase, and now do.
- 🪤 **`create or replace view` cannot rename an output column.** `member_directory` pins `student_id` as an output name (`20260730000008_views.sql:48`, re-pinned at `20260730000014_member_directory.sql:61`). Renaming it to `eid` needs `drop view` + recreate + re-`grant select … to authenticated`. Migration 14 chose `create or replace` *specifically to avoid* dropping the grant on a §6 security boundary — so this reverses a written rule and is recorded as an exception in `CLAUDE.md` rather than done quietly.

### Schema gaps — three closed by migration 14, three opened by the re-plan

The original four were found by reading `20260730000008_views.sql` and `20260730000002_members.sql` against §7's feature list. **Three are closed:** `member_directory.attendance_rate` exists, `members.notes` exists, and `admin_audit`'s `entity_type` check now carries `'roster'` so an export can be its own receipt row. The fourth is still open, and the re-plan adds two more. Each is cheap now and expensive once the UI depends on it — §7's "don't rush Stage 1" applies again here.

- **`AuditAction` still has no `member.*` verbs.** Phase 4 adds `member.updated`, `member_field.created`, `member_field.updated`, `member_field.archived`; phase 5 adds `roster.exported`; phase 7 adds `member.imported` and phase 8 `member.merged`. The SQL column is free text, so the TypeScript union is the only thing enforcing them — extend it in the same commit as the first mutation that uses one, and add a matching entry to `formatAuditAction`'s `LABELS` or the trail renders the raw verb.
- **`members` has no `updated_at`, so member edits have no compare-and-set anchor.** `events` and `attendance` both carry one; `members` never needed one because nothing edited a member. Inline editing changes that. Phase 4 adds the column and the `set_updated_at()` trigger.
- **Custom field values have nowhere to live, and the storage choice is forced by sorting.** PostgREST orders by column, never by a computed expression — the exact wall migration 14 hit with `attendance_rate` — and a `create or replace` view cannot grow a column per officer-defined field. An EAV values table cannot be sorted from the parent under pagination at all. Phase 4 resolves this with a JSONB column; the reasoning and the fallback are recorded there.

**One inconsistency to decide rather than inherit:** `pending_count` and `last_seen_at` in `member_directory` are **not** term-scoped, while every column beside them is. That is defensible — a pending row from last term still needs review, and "last seen" is a genuinely all-time question — but sitting next to term-scoped point columns they will be read as term-scoped by whoever uses them. **Resolved by the re-plan:** both move to the detail page (phase 3), where they are labelled all-time explicitly and sit apart from the term-scoped block. The "not seen since" filter in phase 6 must carry the same label.

### ✅ Phase 1 — schema, `lib/filters.ts`, read-only `/admin/members` (2026-08-01)

*Numbering note: this is **migration 14** (`20260730000014_member_directory.sql`). The plan above called it "migration 15" by counting files rather than following the existing convention, where `…000013` is "migration 13".*

⚠️ **Partly superseded by the 2026-08-01 re-plan.** Three things built here are replaced in phase 3: the ten-column table, the ten-entry `MEMBER_SORTS` allow-list, and the six view-column filters. **Migration 14 itself stands unchanged** — `attendance_rate`, `members.notes`, and the `'roster'` entity type are all still correct, and `attendance_rate` now backs the detail page instead of a directory column. `lib/filters.ts` keeps its shape (total parse, round-tripping params, pagination outside `applyMemberFilter`, structural query typing); what changes is which columns it knows about.

- [x] **Migration 14** — `attendance_rate` on `member_directory`, `members.notes`, and `admin_audit`'s `entity_type` widened with `'roster'`. **Applied to local and the remote**; types regenerated from `--linked`, so the `__InternalSupabase` block is intact and the diff is purely additive.
  - The view is `create or replace`, not drop-and-create: dropping would take the `authenticated` grant with it, and this view is a §6 security boundary. The replace form can only *append* columns, which is why `attendance_rate` sits last rather than beside the counts it comes from.
  - `events_possible` moved into a CTE. It never depended on the member, and it is now read twice — once as its own column and once as the rate's denominator — so computing it once is what stops the two from ever disagreeing.
- [x] **`lib/filters.ts`** — `parseMemberFilter` (total: every input yields a usable filter), `memberFilterToParams` (round-trips), `applyMemberFilter`, `pageRange`/`pageCount`. Pure, and the query builder is typed **structurally** rather than imported from supabase-js, so the tests hand it a recording fake.
- [x] **`/admin/members`** — server-side sort on all ten columns, pagination, and the six view-column filters. The table is a **Server Component**: phase 1 has no interactivity beyond navigation, so sort headers are links and every date arrives pre-formatted, which sidesteps the hydration trap rather than working around it.
- [x] Nav entry unlocked in the same commit as the page
- [x] **30 new tests** (238 total, 12 files), lint and build clean

**Verified against the local stack** — the whole suite runs member-neutral, leaving the seed at exactly 32/15/208 with the term pin restored:

- **31 fixture members across two pages**: `count` reports 31 while the page returns 25, the two pages together contain all 31 ids exactly once, and repeated reads return the identical split. That last one is the real test — every fixture is tied on points and most share a `joined_at`, so without the `id` tie-break the split drifts between requests and a member vanishes between pages.
- **A member who joined 10 PM Central on the last day of the range is included** — the UTC-midnight cut this invariant exists to prevent.
- `attendance_rate` agrees with the two counts beside it; a member who attended nothing reads a real `0`, not null.
- `minRate=100` becomes `0.5`-style fraction arithmetic, not `100.0` — a unit error there returns an empty list and looks like a legitimately empty result.

🪤 **The `AUDITED_ADJUSTMENT_COLUMNS` trap caught the build again, in a new file.** The directory's column list was written wrapped across three lines with `+`, which widens the literal to `string`, so PostgREST typed the row as `GenericStringError` and `row.id` stopped existing. Same fix, same reason: one unbroken literal with `as const`. It is worth assuming this will happen once per screen that selects more than a handful of columns.

🪤 **`memberFilterToParams` had to learn that `undefined` means "no opinion".** The sort headers pass `{ sort, dir, page }` overrides, and an early version spread `dir: undefined` straight into the filter, which put a literal `dir=undefined` in every column link. Overrides now skip undefined values, and there is a test for it.

**Not done in this phase, deliberately:** the browser walkthrough. Every Stage 5 phase was verified in a real browser and each one found something the tests could not, so this is a genuine gap rather than a skipped formality — see the note under phase 2.

### ✅ Phase 2a — the anon exposure on `member_directory` (2026-08-02, deployed)

*Found while reading the schema to write the EID migration, and split out because it outranked the rename and needed to ship in minutes rather than after a wide refactor. **Migration 15**; the EID rename becomes migration 16.*

- [x] 🔓 **The anon key could read every member's student ID and email**, on local **and production**. Verified at the PostgREST boundary before and after, not inferred — production answered `206` with `Content-Range: */33` and now answers `401 permission denied for view member_directory`.
- [x] **Cause, which is structural and will recur.** `20260730000012_api_role_grants.sql` grants `all privileges on all tables in schema public` to anon and argues it is safe because "RLS is the security boundary". True for tables; **false for views** — `grant all on all tables` includes views, and `member_directory` deliberately runs as owner (`security_invoker` off) so it can aggregate *past* the deny-all tables beneath it. That is what makes it useful and what made an unguarded select on it a total bypass.
- [x] **Why it survived review, which is the part worth remembering:** `members` itself denies correctly (anon gets `[]`), RLS is enabled everywhere, and there are no policies. Every check aimed at the table came back clean. Checking a table proves nothing about a view over it.
- [x] **Migration 15** — `revoke all on public.member_directory from anon`, plus restating the intended grant set for `authenticated` (select only; the write privileges were inert on a non-updatable aggregate view but implied someone had considered them). Applied to local and remote.
- [x] **`tests/security.test.ts`** — enumerates every view the migrations declare, by parsing `supabase/migrations/*.sql`, and asserts anon can select from none but `leaderboard`. Deliberately not a test for this one view: the point is that the **next** view fails here instead of in production. Also asserts `leaderboard` exposes exactly `id`/`full_name`/`total_points`, so it cannot quietly become the next `member_directory`.
  - Needed an anon client in the harness, which did not exist — every other test runs as service_role and therefore cannot observe whether the boundary holds. `global-setup.ts` now exports `ANON_KEY`, and `helpers.ts` has `anonClient()`. The non-local guard is unchanged.
  - **Verified the test fails against the unpatched schema first** (it named `member_directory` as readable), then passes after. 256 tests total.
- [x] ⚠️ **Carry into the EID rename:** `alter default privileges … grant all on tables` means a newly *created* view inherits anon access. `create or replace` does not re-trigger it; **`drop` + `create` does** — and migration 16 must drop and recreate this view to rename its output column. **The recreate must re-issue the revoke**, and re-running the anon check afterwards is the step that catches forgetting it.

### ✅ Phase 2 — the EID switch (2026-08-02, deployed)

*Cross-cutting, mechanical, and wide — **39 code / SQL / test files carrying 480 occurrences**, plus 4 markdown files, measured 2026-08-01 with `grep -riE "student_?id"` excluding `.next` and `node_modules`. Deliberately first and deliberately alone: it touches the public check-in path, the attendance review screens, and the suggestion ranker, and mixing it with the directory rework would leave both unreviewable. First also means every later phase writes `eid` from the start instead of renaming twice.*

- [x] **Walked phase 1 through a browser, 2026-08-01** — against the local stack, signed in as `dev@example.edu`. **It found the fourth defect of exactly the kind Stage 5 kept finding, and no test caught it.**
  - ✅ **Passed:** pagination (29 active over `PAGE_SIZE` 25 ⇒ `1–25 of 29` then `26–29`, no overlap, `← Prev` disabled on page 1); the **total-order tie-break** under the hardest case available — sorted by `joined_at` with 25 members sharing Jan 20, the alphabetical secondary sort continues cleanly across the page boundary (Viktor → Wren); all ten sort headers, `total_points` defaulting descending with ties alphabetical, filters preserved in every sort href, page reset to 1, and **no `dir=undefined` anywhere**; `minRate=50` ⇒ 22 of 32, correctly excluding the 0% inactive members, which is the `0.5`-not-`50.0` arithmetic; `INACTIVE`/`SELF` badges; inactive members reading `0 / 12`, `0%`, `never` — a real zero, not null; a negative bonus (−2 ⇒ total 4); the auth gate preserving `next`.
  - 🪤 **Defect found and fixed: the filter boxes displayed values that were not being applied.** Repro: set *Rate at least* 50 → CLEAR → type 15 into *Points min*. The URL became `?minPoints=15`, but the screen still read *Rate at least: 50* above "9 matching members" — and those 9 were points ≥ 15 alone. **The count did not mean what the screen said it meant.** On this seed the two sets coincide, which is how it would have shipped.
    - **Cause:** the five numeric boxes were `defaultValue` + `onBlur`, i.e. uncontrolled, and React reads `defaultValue` only at mount. CLEAR is a `router.push` with no remount, so they kept the officer's typed text. The selects and date inputs were already controlled and never had the bug. A hard reload hid it, which is why URL-driven checks and the whole test suite missed it.
    - **Fix:** the boxes are controlled off `memberFilterFields(filter)`, resynced with the reset-during-render pattern from `review-queue.tsx`; and `update()` now goes through `memberFilterUrl(filter, changes)` instead of hand-assembling from `new URLSearchParams(searchParams)`. Both live in `lib/filters.ts`, which is what makes them testable and honours "one filter object, one translation".
    - **Why it mattered beyond cosmetics:** this is directly upstream of phase 5's export. "Copy emails for these 9" would have copied a list matching a different filter than the one on screen — the partial-list failure the stage's invariants exist to prevent, arriving through the filter rather than through pagination.
    - **12 new tests** (250 total). Nine are pure; three are a deliberate **source assertion** over `member-filters.tsx`, because the bug lived in JSX and `vitest.config.ts` runs `environment: "node"` — nothing here can render a component, so no behavioural test would fail if someone typed `defaultValue` back. Verified the guard by reintroducing the bug: 2 tests fail, restored, 33 pass.
  - 🪤 **The `—` rate case is not observable on either database, so it was NOT ticked off.** `events_possible` is a term-wide scalar, identical for every member, so `attendance_rate` is null for everyone or for no one. Local and the remote both have 12 completed published Spring 2026 events and **zero** null rates. Seeing `—` requires pinning `app_settings.current_term` to a term with no completed events — a write, so local only. **Still outstanding.**
- [x] **Migration 16 — the rename** (numbered 16, not 15: the anon revoke took 15). Columns, constraints, and indexes renamed; generated-column expressions and CHECK bodies follow a rename by attnum, so only the object *names* needed restating. Applied to local; **remote still pending — see the note at the end of this phase.**
  - [x] **Normalization folded `upper()` → `lower()`** via PG17 `alter column … set expression as (…)`. Both databases are 17.6. Case folding is a bijection on the equivalence classes, so the unique index could not gain a collision.
  - [x] **`member_directory` dropped and recreated** to rename its output column, with the grant restated. ⚠️ **And the anon revoke re-issued** — a recreate re-inherits anon access from `alter default privileges`. Verified after the fact: anon now holds *no* privileges on the view and `authenticated` holds exactly `SELECT`.
  - [x] Types regenerated. `--local` really does omit the `__InternalSupabase` declaration (it survives only in the `Omit<>` reference), so it was spliced back by hand.
- [x] **Retuned the suggestion ranker**
  - [x] **`id_contains` (+35) removed**, along with its `MatchReason` kind and the UI label. Its own comment said it existed for a dropped `UT` prefix; there is no prefix to drop, and `includes` on short alphanumerics clears the floor on its own.
  - [x] **Distance 1 still stands alone; distance 2 stays below the floor.** Kept, but the *reason* changed and that is the part to carry forward: EIDs are derived from name initials, so the near-miss population is **correlated with the roster** rather than spread across a numeric range. Same problem as sequential IDs, from the other direction, and arguably worse — a typo now lands on a plausibly-confusable real person more often.
  - [x] **Recalibrated empirically, and then locked.** `tests/seed-fixtures.test.ts` runs the real ranker over the real seeded roster and asserts Rowan Pike, Sage Delacroix, and Toby Vance each produce **no** suggestions, while an exact EID and a case-variant EID still rank their member first. It also guards the guard: if the seed ever drifts so `rp8571` is far from everyone, the empty-list assertion would pass vacuously, so the distances are asserted too.
- [x] **Code and copy** — `normalizeEid`, both `lib/validation.ts` blocks (floor 2 → 3), `MEMBER_SORTS`, every table header and form label, `tabular-nums` dropped from the EID cell, `/attend` switched to `autoCapitalize="none"` + `autoCorrect="off"`. `tests/attendance-review.test.ts` now **imports** the normalization instead of re-implementing it — the inline copy hardcoded `toUpperCase()` and the fold to `lower()` turned it into a silent no-match, which is exactly the failure that motivated the note.
- [x] **Seed and fixtures regenerated.** EIDs are initials + four digits, written per person rather than generated, because the fixtures depend on exact distances. Case is the format axis now; two rows keep a stray space/hyphen since the generated column still strips them.
  - [x] The three unmatched fixtures were **computed, not guessed** — `rp8571`, `Sd 4390`, `tv7140`, each distance ≥2 from every member and distance 1 from none, with `rp8571` deliberately within distance 2 of three members so the floor has something to reject.
  - ⚠️ **Accepted, at the decision's request:** with no fake-marker block, the fabricated names and `example.edu` mailboxes are the only signals these are invented — weaker than `UT-100023` was on a public repo. Said so in the seed header.
- [x] 🪤 **The seed silently lost a fixture, and now cannot again.** Regenerating the EIDs changed the physical row order of `members`, which changed the seeded `random()` draw in the bulk attendance insert, which filled the slot the rejected-duplicate fixture needed — and its `not exists` guard *skips* rather than fails. Result: still 208 attendance rows, but 203 present / 0 rejected instead of 202 / 1, one review-queue fixture gone and one audit row with it. Fixed by making the member insert `order by last_name` (load-bearing, commented as such) and by adding a **`@chunk assert`** that verifies every documented count and aborts the seed if one drifts. Verified the assertion raises.
- [x] Docs: architecture doc → **v1.27** with §4 DDL, `CLAUDE.md`, `docs/attend-confirmation-flow.md`, `README.md`
- [x] **264 tests** across 14 files, lint and build clean

- [x] **Deployed 2026-08-02.** `db push` then merge in one window, because the rename breaks the deployed build until the code ships with it. The gap was ~40 seconds, measured by polling `/attend` for the `UT EID` label; production is pre-launch so nobody was in it. Verified after: public pages 200, anon **401** on `member_directory`, leaderboard 200.
- [x] 🪤 **The remote re-seed was refused, correctly, and the plan changed because of it.** `bash scripts/seed-remote.sh` aborted at chunk one with `P0001: Refusing to seed: auth.users contains real accounts`. Nothing was deleted or inserted — the script has `set -euo pipefail` and exits per chunk, which is the only reason a partial seed did not land on top of live data. **Do not work around that guard.** Instead, **migration 17** backfills the remote's pre-rename values: idempotent (keyed on `normalized_eid like 'ut1000%'`, which no new EID matches), a no-op on a fresh database (migrations run before `seed.sql`), and it leaves accounts, audit rows, and links untouched.
- [x] 🔴 **The guard was right for a reason nobody had noticed.** The remote holds a **real member** — `Christian A Gonzales / cag7284`, self-registered through the live form — not just a real officer account. A wipe would have destroyed a real person's row. Migration 17 deliberately skips it (already in real EID format). See the cold-start table.
  - 📌 **Superseded 2026-08-07, and worth keeping as written.** That row turned out to be the officer's own test check-in, and they authorised wiping it; production is the seed again. The *reasoning* stands and is the reason this entry is annotated rather than deleted — at the time nobody knew whose row it was, and "there is an unexplained real person in the database" is exactly when you stop and use a targeted migration. What changed is the fact, not the judgement. `scripts/seed-remote.sh --force` is now the sanctioned override, so the "hand-edit the guard" temptation this entry was warning against has a proper answer.
  - **This is also the concrete subject of the phase-2a exposure.** The anon read of `member_directory` was returning a real name, email, and EID, not only fabricated seed rows.

### 🔎 Open questions raised in phase 2, deliberately not acted on

Neither blocks phase 3. Both were found by reading the code and would otherwise be lost.

- **The member-less attendance row is nearly unreachable now, and the seed pretends otherwise.** Under the v1.22 confirmation flow, all three `attendance` inserts in the codebase write a **non-null `member_id`** (`lib/checkin.ts:220` and `:264`, `app/actions/attendance-review.ts:655`) — a submission matching no roster member is re-prompted and never stored. So the check-in form can no longer produce the shape the review screen's member-suggestion half exists for. It is **not** dead code; three paths remain:
  1. an officer clears the picker (`memberId: optionalUuid("member")` in `lib/validation.ts`, written straight into `saveSubmission`'s patch);
  2. `member_id … on delete set null` — deleting a member silently orphans their rows;
  3. rows predating v1.22, which production may hold.
  - **What is actually wrong is the seed:** the three unmatched fixtures omit `source`, so they default to `'self_checkin'`, asserting a provenance the code cannot produce. A reader would reasonably conclude the form still does that. Fix is a comment or an explicit `source`, not a behaviour change.
- ⚠️ **`on delete set null` turns a merge-tool bug into silent data loss** (phase 8). Merge repoints `attendance.member_id` and `point_adjustments.member_id`, then deletes the losing member. If it misses a row, Postgres will **not** raise — it nulls the link, and the attendance survives while the credit does not. That is the §4.2 failure mode arriving through the back door. Decide before phase 8 whether the FK should be `on delete restrict` with an explicit repoint-then-delete, so a miss fails loudly.

### ✅ Phase 3 — the reshaped directory and `/admin/members/[id]`

*These landed together, or the displaced data would have become unreachable. **No migration** — the first Stage 6 phase that needed none, which is what migration 14 was for.*

- [x] **Directory down to four columns** — Name (linking to the detail page), Email, EID, Total Points. `active` and `source` are still selected but are not columns: they drive the INACTIVE / SELF badges beside the name.
- [x] `MEMBER_SORTS` shrinks to `name`, `email`, `eid`, `total_points`. **`email` is newly sortable** — it was displayed in phase 1 but not sortable.
- [x] **Filters trim to the displayed columns**: a total-points range, plus the two exceptions below.
  - ⚠️ **The six retired fields left `MemberFilter` entirely rather than just losing their controls** — a decision taken deliberately, not a shortcut. A filter that still applies with no control on screen is the phase-1 defect arriving from the other direction: a count the officer cannot account for. An old bookmark carrying `minRate=50` now narrows nothing, which is visible and safe, and `memberFilterToParams` does not put it back in the URL. There is a test for exactly that.
  - **`state` (active/inactive) stays, framed as a scope selector rather than a column filter.** It is not a displayed column, but dropping it would strand inactive members with no route to them at all — they are excluded from `leaderboard` too.
  - **Free-text search across name / email / EID moved up from phase 6.**
- [x] `parseMemberFilter` **tolerates** the removed params — it reads by key and is total, so this is free; the test makes it explicit rather than incidental.
- [x] **No column removed from the view.** The detail page needs every one of them.
- [x] **`/admin/members/[id]` — read-only**; mutations arrive in phase 4. Joined, source, active, events attended / possible, attendance rate, attendance points, bonus points, pending count, last seen, the adjustment history, read-only officer notes, and the shared `AuditTrail` with `entityType="member"`.
  - `pending_count` and `last_seen_at` sit in their own **All-time** block, apart from the term-scoped figures and labelled as such — this is where that ambiguity stops. The pending submissions are listed individually and link to `/admin/attendance/[id]`; the queue has no member scope to link to instead.
  - `notes` is **not on the view** until phase 4 appends it, so it takes its own small read against `members`. Rendering it read-only means no column in the schema is unreachable from the UI at the end of this phase.
- [x] **The events grid — current term only**, term named on the grid, published events only.
  - **Three states, not two: attended, missed, and _upcoming_**, in `classifyTermEvents` (`lib/members.ts`, new). `now` is an argument so it is testable without touching the clock, and the boundary is the same half-open one the view uses.
  - Two queries joined in the Server Component, not a PostgREST embed
- [x] `.order("id")` last for a total order, `nullsFirst: false`, `applyMemberFilter` never paginating, one unbroken `as const` select literal — all unchanged
- [x] **283 tests across 15 files** (from 264/14), lint, build and `tsc --noEmit` all clean

**Browser walkthrough (local stack, dev officer, seed at exactly 32/15/208/6/2).** The first phase in five where the walkthrough found **no defect** — worth saying plainly rather than quietly, since the run is only worth keeping if its result is reported honestly either way.

- ✅ Four columns; `29 matching members — showing 25 on page 1 of 2`; SELF badges; names linking through and carrying the live filter params (and only those).
- ✅ **The phase-1 defect shape, run deliberately:** search `nair` → 1 result → CLEAR → type `15` into points min. URL became `?minPoints=15`, the search box was **empty**, and the 9 rows were all ≥15. The screen and the count agreed.
- ✅ **A phase-1 bookmark** — `?minRate=50&source=self_checkin&joinedFrom=2026-01-01&minEvents=3&sort=attendance_rate&dir=desc` — returned all 29 active members, populated no control, showed no CLEAR, and put none of it back in the URL. The retired sort key fell back to `name` while the explicitly-valid `dir=desc` was honoured, which is correct.
- ✅ `email` sorts (newly), page 2 of 2 reads `Members 26–29 of 29` with NEXT disabled; uppercase `PN8571` matches `pn8571`; a **full dotted email** (`priya.nair@example.edu`) matches exactly one member — the `or`-group quoting working in the real app, not only in the test.
- ✅ Detail pages: **Priya Nair** 8 of 12 / 67% / 17 + 10 = 27 with the +10 competition grant; **Wren Abbott** bonus `0` with the voided +8 struck through and badged; **Hana Sato** pending `1` with the orphan listed as "no event matched" and linking to the submission; **Ayo Balogun** INACTIVE, `0 of 12`, `0%` as a real zero. Every grid summed to exactly `events_possible`.
- ✅ Unknown id ⇒ 404; signed out ⇒ 307 to `/admin/login` with `next=%2Fadmin%2Fmembers` preserved.

🎯 **The `—` rate case is finally ticked off, and the *upcoming* grid state with it.** Both were unreachable from Spring 2026 — every seeded event has ended, and no Spring event *can* end after August. Pinning `app_settings.current_term` to `'Fall 2026'` (where Fall Kickoff is published and has not ended) produced both at once: `0 of 0 completed`, the rate as `—` with "no events have finished in this term yet" beside it, and a one-row grid reading `0 attended, 0 missed, 1 still to come`. The draft Fall Info Session was correctly absent. **This is the technique** — phase 2 recorded the `—` case as outstanding because it is null for everyone or for no one, and a term pin is the only way to see it. Restore the pin to `'Spring 2026'` afterwards.

📌 **Half of this is now obsolete, and the better half in a good way (2026-08-06).** The seed moved to Fall 2026, so the ***upcoming* grid state is reachable natively** — Fall Kickoff on 1 September is published, in the current term, and has not ended, so a real member page reads `8 attended, 4 missed, 1 still to come` with no pin and no fixture. The **`—` rate case still needs the technique above**: `events_possible` is a term-wide scalar, so it is null for everyone or no one, and with twelve completed events in the term nobody has a null rate. Pin to a term with no completed events — `'Spring 2027'` now — and unpin (to `null`, not to Spring 2026) afterwards.

**Four things worth carrying forward:**

- 🪤 **`npx supabase db query --linked=false` silently queries the REMOTE.** There is no such negation — the flag is a boolean and the value is discarded, so it reads as `--linked`. The correct flag is **`--local`**. This cost real time and produced two confident wrong conclusions before it was caught: a member id fetched "from local" 404'd on a local page (it was a production id), and a row-count check reported the local database had drifted a row past the seed (it was reading production's documented 33/16/209/12). **Verify which database answered before believing a surprising result** — the fastest check is an id or a count you already know. Nothing was written to production; the queries were selects.

- 🪤 **Free-text search needs a quoted PostgREST value, and no pure test can prove it.** The `or` group is built as `full_name.ilike."*q*",email.ilike."*q*",eid.ilike."*q*"`. Unquoted, `.` and `,` are filter syntax — and every email is full of both, so `email.ilike.*a.person@example.edu*` parses as a malformed operator rather than as a search. Sanitizing happens once, in `parseMemberFilter` (strips `%`, `*`, `"`, `\`; deliberately keeps `.`, `,`, `@`, `-`, `_`), so nothing downstream needs a second escape pass. `tests/member-directory.test.ts` asserts the dots, a comma, case-insensitivity, and that the group composes with the roster scope as a conjunction rather than replacing it.
- **`tests/member-directory.test.ts` isolates its 31 fixtures on the `t3q` EID marker now**, not on a `joined_at` in 2035 — that filter left with the trim. The marker is the better handle anyway: it selects the fixtures by something deliberately put there rather than by a date they happen to hold, and it puts the new `.or()` in front of real PostgREST, which is the only place a quoting bug can surface. Coverage that left with the retired filters is named in the file header so it is not silently forgotten.
- 🪤 **`tsc --noEmit` had never actually checked the test suite.** `tests/filters.test.ts` declared `type Recorder = FilterableQuery<Recorder> & { calls: Call[] }`, which is circular to tsc — so it inferred `any` for every callback parameter in the file and stopped checking it. An `interface Recorder extends FilterableQuery<Recorder>` resolves lazily and does not. Fixing it immediately surfaced a real latent error in `tests/event-actions.test.ts`, where a `.select()` omitted `ends_at` from a row passed to `effectiveWindow()` — harmless only because that fixture sets an explicit `checkin_closes_at`. Both fixed; the whole repo is now `tsc` clean. Neither `npm run build` nor `npm run lint` covers `tests/`, so run `npx tsc --noEmit` to keep it that way.

### ✅ Phase 4 — custom fields (shipped 2026-08-05, merge `3931d99`)

- [x] ⚠️ ~~**Spike first, before any UI.**~~ **Done 2026-08-02 — the JSONB plan holds; the `custom_1 … custom_n` fallback is not needed.** 20/20 checks passed against a throwaway `_spike_members` table + `_spike_view` on the local stack (both dropped afterwards; seed verified back at 32/15) and, read-only, against the hosted project. **Local and remote both run `postgrest/14.5`**, so there is no version gap to worry about here. What was actually confirmed, rather than assumed:
  - `.order("custom_fields->>tshirt_size")` is accepted **on a table and through a view** — the view is the case that matters, since the directory reads `member_directory` and not `members`.
  - `{ ascending }` and `{ nullsFirst }` both work on a JSON path, with Postgres' ordinary null placement (asc ⇒ nulls last, desc ⇒ nulls first). A member with the key absent sorts as null, which is the wanted behaviour and matches the `attendance_rate` "null is not zero" rule.
  - It survives `.range()` pagination, **and only with the `.order("id")` tiebreak** — paging 30 rows at 7/page with four distinct sizes returned 30 rows but **29 distinct, one duplicate and therefore one row never shown**. That is the existing "a paginated list needs a total order" invariant reproducing itself exactly, on the new sort key. With the tiebreak: 30/30, and the order holds across every page boundary.
  - `count: "exact"` composes with a JSON-path order, so the count beside the button is unaffected.
  - `.eq("custom_fields->>key", value)` also works — phase 6 can filter on custom fields, not just sort by them.
  - 🪤 **The `^[a-z][a-z0-9_]*$` key constraint is load-bearing, not cosmetic — it is the escape for a sort-injection surface.** The key is interpolated into the `order` parameter, and PostgREST parses what comes out. A key containing `,` breaks out of the order term and is read as **a second order column**: `custom_fields->>a,b` came back `42703 column _spike_view.b does not exist`, i.e. an arbitrary column name would have been accepted. `.` and `)` fail as PGRST100 parse errors, but a **space and a `"` were accepted silently with no error at all**. So enforce the regex in the migration's `check` *and* in the zod schema, and never build an order string from anything but a key that has been through it. Ordering by a hidden column leaks no values, but it is not a door to leave open.
  - **The GIN index does not serve the sort** — `explain (analyze)` on `order by custom_fields->>'tshirt_size', id` is a seq scan + sort. That is fine and expected (GIN is for containment, which phase 6 wants); index-backing a sort would need a btree expression index *per key*. At 33 members against §2.2's 500-member worst case there is nothing to do here — noted so nobody later assumes the GIN made sorting cheap.
- [x] **Migration 18 — `member_field_definitions`** *(the line below said "migration 16" when phase 4 was planned; 16 and 17 were spent on the EID rename and its backfill, so phase 4 opens at **18**)* — **written and applied to LOCAL ONLY; not pushed to the remote.** Every rejection verified by SQLSTATE against the live local database rather than assumed (43 checks): `23514` for a malformed key, a key colliding with a built-in, an empty / blank / null / duplicate / over-long / over-count option list, a blank label, an unknown `kind`, and a `custom_fields` that is not a JSON object; `23505` for a duplicate key. Option-list validation is an immutable `valid_field_options()` function because a CHECK cannot hold a subquery. Contents: `key` (stable machine key, `^[a-z][a-z0-9_]{0,39}$`, unique, rejected if it collides with a built-in sort key), `label`, `kind` (`check (kind in ('select'))` — dropdown only for now, with room to add `text`/`boolean` later without a data migration), `options text[]` (non-empty, no blank entries, bounded), `editable_inline boolean` (**the "option when creating the field"**), `show_in_directory boolean` (otherwise every field ever created widens the table forever), `sort_order`, `archived_at`, plus the house `created_by` / `created_at` / `updated_at` + trigger. RLS enabled, no policies, per every other table.
- [x] **Values live in `members.custom_fields jsonb not null default '{}'`**, keyed by definition `key`, with a GIN index. The reason is sorting, not taste: PostgREST orders by column and an EAV values table cannot be sorted from the parent under pagination — the same wall migration 14 hit with `attendance_rate`, and a `create or replace` view cannot grow a column per officer-defined field. A `jsonb_typeof(...) = 'object'` check came with it: jsonb accepts a bare scalar or an array as a valid document, and nothing downstream would survive one.
- [x] `members.updated_at` + the `set_updated_at()` trigger — the CAS anchor inline editing needs, and `members` has none today
- [x] Append `custom_fields` and `notes` to `member_directory` (`create or replace` suffices — appending only), and widen `admin_audit.entity_type` with `'member_field'`
- [x] **`app/actions/members.ts`** — `setMemberFieldValue`, `saveMemberNotes`, `saveFieldDefinition`, `setFieldArchived`. House shape throughout: `getOfficer()` guard, CAS on `members.updated_at` as the **raw PostgREST string**, `writeAudit`, a private `revalidateMembers`/`revalidateFields`, `redirect()` outside the try/catch, `fieldErrorsOf` duplicated locally (a `"use server"` module may only export async functions).
  - The option check is **server-side against the stored definition**, not in zod — the schema does not know the definition, so a value that is not an option is judged against the field as it actually is rather than as the form claimed.
  - **`editable_inline` is deliberately NOT checked in the action**, and the file says so: it decides where a field is *offered*, not who may set it, and the detail page edits `editable_inline = false` fields through the same action.
  - A **no-op short circuit** before the write: a save that changes nothing would still bump `updated_at` and log an audit row whose diff is empty.
  - `withoutToken()` strips `updated_at` from **both** audit sides in one expression — it moves on every save and `acted_at` already records when. Never by narrowing one side's `.select()`.
  - **Restoring an archived field is filed as `member_field.updated`, not a new verb.** The diff already reads `archived_at: <ts> → —`, and `admin_audit` is append-only, so a verb added carelessly can never be corrected out of the rows written under it.
- [x] **`lib/members.ts` custom-field core** — `FIELD_KEY_PATTERN` and `isValidFieldKey`, `RESERVED_FIELD_KEYS`, the `cf:` namespace helpers, `fieldValue` / `setFieldValue` (clearing DELETES the key rather than storing `""`), `isAllowedFieldValue`, and `AUDITED_MEMBER_COLUMNS` as one unbroken `as const` literal for **both** sides of the audit before/after. Plus `lib/member-fields.ts` for the read, and four zod schemas in `lib/validation.ts` — `fieldDefinitionSchema`, `fieldDefinitionEditSchema` (the key is **omitted**: renaming one would orphan every stored answer), `memberFieldValueSchema`, `memberNotesSchema`.
- [x] New `AuditAction` verbs — `member.updated`, `member_field.created`, `member_field.updated`, `member_field.archived` — each with a matching entry in `formatAuditAction`'s `LABELS`. **Also filled three pre-existing gaps in `LABELS` while there:** `series.created` / `series.published` / `series.cancelled` were in the union with no label, so they rendered as the raw verb in an ordinary event's trail.
- [x] 🐛 ~~**Fix a latent bug while here:**~~ **Done.** `AuditEntityType` was missing `'roster'` (added to the SQL check by migration 14 and never to the TS union), so phase 5's export receipt could not have been written without a cast. `'member_field'` landed alongside it.
- [x] `parseMemberFilter` gains a definitions argument so it can validate custom sort keys while staying pure (tests pass a fake list). Sort keys are namespaced **`cf:<key>`** so a custom field can never collide with a built-in, and an unrecognized key falls back to `name`.
  - **The definitions argument is optional on `parseMemberFilter` and REQUIRED on `applyMemberFilter`**, which was not in the plan and is the more important half. Defaulting on the parser keeps ~40 existing pure-test call sites honest — "no definitions" is exactly the world they test — while requiring it on the query builder makes a page that forgets to load definitions a **compile error** rather than a directory that silently sorts by name. A `cf:` key naming an archived field, or one with `show_in_directory = false`, falls back to `name`.
  - `sortColumn()` is the new seam and it re-checks the key format rather than trusting the caller, because it is the one place a key becomes part of a query string.
- [x] **`/admin/members/fields`** — list (Live / Archived), `new/`, and `[id]/` with the edit form, the archive-or-restore form, and the shared `AuditTrail` (whose `entityType` union gained `'member_field'`). Separate pages rather than inline forms, mirroring `events/` and `points/`: the key exists on create and is *absent* on edit, so it is one prop-driven form exactly like `EventForm`. **Archiving never deletes a definition or a stored value.** The `[id]` page reports how many members hold a value before offering the archive — 🔓 that count interpolates the key into a filter string, the same surface as an `order=` term, so it goes through `customSortColumn()` rather than being trusted for having come out of the database.
  - **Linked from the directory header, not the admin nav.** `admin-nav.tsx` marks an entry active with `pathname.startsWith`, so a Fields entry would light "Members" up alongside it.
- [x] **Inline editing in the directory.** The row markup moved wholesale into `directory-row.tsx` and `member-table.tsx` stayed a Server Component, exactly as its phase-3 note anticipated. One small `<form>` per cell, so "one carrier per field name" holds by construction and no `formAction` appears anywhere.
  - **Auto-submit on change** (the officer's call this session): picking *is* the save, and the audit log is the undo. A nameless `sr-only` submit button is the pre-hydration and keyboard path — without it the cell does nothing at all until hydration.
  - The `<select>` is **controlled**, not `defaultValue`: React 19 resets an uncontrolled `<form action>` when the action resolves, so the cell would visibly snap back to the pre-edit option for the length of the round trip. The phase-1 filter-box bug, one screen over.
- [x] Detail page gains the full field set (including `show_in_directory = false` fields — that flag governs the *directory column*, not this page) and the officer-notes editor, on the same `member.updated` plumbing. Archived definitions the member still holds a value for render read-only with an ARCHIVED badge; a value nobody can see is a value nobody can audit. The separate `members.select("notes")` read is gone — migration 18 put `notes` on the view, which is what that read's own comment anticipated.
- [x] **Decided and written down: any officer, both.** Consistent with §9 #6 — the audit log is the control, not a role gate. `app/actions/members.ts` carries no role check and says so in its header, so nobody re-adds one as an "oversight". Nothing in the codebase branches on `admin_profiles.role`, and this is not the thing to make it start.
- [x] **Tests: 369 total** (+56). `tests/member-actions.test.ts` is new (14 integration); `tests/validation.test.ts` gained the four phase-4 schemas; `tests/members.test.ts` gained `fieldOptions`, `withoutToken`, the audited-column guards, and source assertions pinning the client boundary and the no-`Intl` rule; `tests/filters.test.ts` gained the `memberFilterUrl` regression block.
  - The integration file earns its place on things a pure test cannot reach: that the `updated_at` trigger is wired at all; that `.eq("updated_at", raw)` matches while `new Date(raw).toISOString()` does **not** (the phantom-conflict-on-every-save trap); that the token read from `member_directory` is byte-identical to the one on `members`; and — documenting a gap rather than a guarantee — **that the database happily accepts a value which is not one of the definition's options**.
  - ⚠️ Field definitions need explicit `afterAll` teardown: `cleanup()` has no pass for them and the key index deliberately spans archived rows, so a leftover collides with the next run on 23505.

### ✅ Phase 4 — walked through a browser 2026-08-03

Everything below was driven against the **local** stack signed in as `dev@example.edu`. **No application defect was found** — the first time a Stage 6 phase has come through a walkthrough clean.

- [x] Create a `dues_paid` dropdown at `/admin/members/fields` → appears as a directory column with a sortable header (`?sort=cf%3Adues_paid`), header count goes to `Custom fields (1)`
- [x] Set a value inline → cell shows `saved`, only on that row; the member's trail reads **`Dues paid`** as its heading with `custom_fields {} → {"dues_paid":"Paid"}` and **no `updated_at`** — `withoutToken` stripping both sides, confirmed against the stored row
- [x] **Two fields on the same row, back to back** — the sibling-token case. Both cells reported `saved`, no phantom conflict, and the second write preserved the first (`{"dues_paid":"Unpaid","shirt_size":"L"}`). The token-lifted-to-the-row design is doing its job
- [x] Sort by the custom column, then type in the search box → URL became `?q=a&sort=cf%3Adues_paid`. **The `memberFilterUrl` regression is dead in the browser as well as in the tests**
- [x] Drop an in-use option → Bela's cell renders `Unpaid (no longer an option)` with `value="Unpaid"`, appended after the live options; Amara's, still valid, gains no orphan
- [x] Archive → column leaves the directory, `Custom fields (1)`, the value survives on the member page as `Unpaid [ARCHIVED]` read-only, and a bookmarked `?sort=cf:dues_paid` degrades to name with no error
- [x] Restore → filed as **Field updated** with note `restored from the archive` and `archived_at: <ts> → —`, exactly as designed rather than as a new verb
- [x] Officer notes save → `Saved.`, trail reads `officer notes` with only the `notes` diff
- [x] **Show as a column** off → absent from the table, present and editable on the member page
- [x] **Editable inline** off → present in the table as read-only text, editable on the member page
- [x] anon still 401 on `member_directory` after the view recreate; `tests/security.test.ts` green

🪤 **Two traps from the walkthrough itself, neither an application bug — both cost real time:**

- **Do not run `npm run dev` as a harness background task.** When the harness stops reading its stdout, the next request-log write hits a dead pipe and Next dies on an **uncaught `EPIPE`**. The process does not exit: it spins (measured at 1080s CPU / 2 GB RSS) while every request hangs, the browser shows a **stale DOM that looks like a rendering bug**, and the dev log's last line is the request *before* the failure. Half an hour went into "the select reverts after saving" that was entirely this. Start it detached with output redirected to a file instead, and **if the UI looks impossible, `curl` the server before believing the screen**.
- **Coordinate clicks drift.** Several saves silently did nothing because the page had scrolled between the screenshot and the click, which reads exactly like a broken action. Click by element ref, and verify a mutation against the database rather than against the banner.

### Phase 5 — selection and extraction

*Scope grew 2026-08-02 (doc v1.30): a real `.xlsx` download and a field picker, in addition to CSV. Requested directly — officers want a spreadsheet file of certain or all members with selected fields.*

*⚠️ **This phase used to be labelled "exit criteria met here" and no longer is** (doc v1.34). The criterion names a dues filter, and dues became a calculated column built by Stage 6.5 — which slots in immediately after this phase. Everything in phase 5 is unchanged; what moved is the finish line.*

*Split into **5a** (selection, catalogue, clipboard, CSV) and **5b** (the xlsx workbook) on 2026-08-06, mirroring the mid-stage 2a/2 split. CSV is the format that survives if the xlsx writer is ever pulled, so it ships first and stands alone; xlsx then lands on plumbing already proven in a browser.*

### ✅ Phase 5a — selection, catalogue, clipboard, CSV (2026-08-06)

**Which rows**
- [x] Row checkboxes plus **"select all N matching this filter"**, visibly distinct from "the 25 rows on this page". Two *modes* rather than one set that happens to be full (`selection.tsx`): in `filter` mode the export sends **no ids at all** and the route re-runs the same filtered query, so "all N" is provably all N rather than whatever was rendered. Unchecking a row in `filter` mode drops back to this page's rows minus that one — keeping "all N minus one" would need a not-in list the export cannot express while still reading as "all N".
  - Selection **resets on filter change and not on paging**. `filterKey` is `memberFilterToParams(filter)` with `page` deleted, which does double duty as the export's query string. Paging is not a filter change: three rows checked on page 1 survive a look at page 2.

**Which columns — the field picker, new in v1.30**
- [x] An **exportable field catalogue** in `lib/export.ts` — 15 built-ins plus every non-archived custom field. It is ONE namespace, and that is already guaranteed upstream: every built-in key is in `RESERVED_FIELD_KEYS` and in migration 18's `key_not_builtin` CHECK, so a custom field structurally cannot claim `email`. ⚠️ The `cf:` prefix is the *sort* namespace and deliberately does **not** appear here — a catalogue key is bare.
- [x] Default the selection to the displayed columns plus email.
- [x] The chosen field list is part of the export request and part of the audit row.
  - 🐛 **Found in the walkthrough:** the receipt logged the *picker's* selection even for `emails` and `names`, which emit one column regardless — "emails export of 3 members (4 fields)". Over-reporting is still misreporting, and a receipt nobody can reason from is the failure §6 is trying to prevent. `exportedFields(format, chosen)` now owns it, in `lib/export.ts` rather than the route, because it is a decision (the `planBulkAssign` rule).

**Clipboard**
- [x] Copy emails (comma-separated), copy names, copy TSV — all through the **same Route Handler** as the download, because it is the same egress and earns the same receipt. Only `Content-Disposition` differs.
- [x] Confirmation states the count that was actually **copied**, derived from the response body. It legitimately differs from the selection: `toEmailList` skips members with no address, so "Copied 40 addresses" from 42 selected is the honest answer and the one that tells the officer something is missing.
- [x] ⚠️ The formula guard is deliberately **not** applied to TSV — it lands in a sheet the officer already controls, and a paste that silently gained apostrophes would be the surprising outcome. Tabs and newlines inside a value are stripped instead, since TSV has no quoting to escape them with.

**Files**
- [x] **CSV** — pure string formatting, no dependency. RFC 4180 quoting, CRLF, and a **UTF-8 BOM added in the route** (not the pure writer, which returns a string and has no opinion about bytes): without it Excel on Windows decodes the file as the system codepage and mangles every accented name on the roster.
- [x] The export goes through `applyMemberFilter` and pages through explicitly. **`pageRange()` is never called** — it is a separate function precisely so the export can apply the identical filter without it, which is what makes the file provably the same query as the count beside it (§4.5). Paging is in chunks of 1000, because the hosted project applies its own `max_rows` that local does not.
- [x] **`MAX_EXPORT_ROWS = 5000`**, which **refuses and never truncates** — the `grantPoints` rule. Sized ~10× §2.2's 500-member worst case and far under Vercel's **4.5 MB** non-streaming response limit (checked 2026-08-06, not assumed).

**Serving it — `app/admin/(shell)/members/export/route.ts`, the first Route Handler in the codebase**
- [x] `GET`, opening with `getOfficer()` and returning **403** — not `requireOfficer()`, whose `redirect()` would answer a download with a login page.
  - ⚠️ **Route Handlers do not participate in layouts**, confirmed against the shipped Next 16 docs, so `(shell)/layout.tsx`'s `requireOfficer()` never runs here. The group is colocation and grants nothing. `proxy.ts`'s `/admin/:path*` matcher *does* cover the path, so an unauthenticated request 307s to login before reaching the handler (verified: `?next=%2Fadmin%2Fmembers%2Fexport`) — a convenience, not the boundary. The 403 catches a signed-in user with no `admin_profiles` row and survives matcher drift. Both are required.
- [x] `Content-Disposition: attachment` with a dated filename (`misa-members-YYYY-MM-DD.csv`, Central date); clipboard formats return `text/plain` with **no** disposition.
- [x] The `admin_audit` row is written **before** the body is built, so a cancelled download still leaves a receipt.
- [x] Entity type `'roster'`, a generated receipt uuid, and `after` carrying the filter, the fields actually exported, the format, the row count, the scope (`selected` / `filter`), and `wholeRoster` from `isDefaultFilter`.
- [x] 🐛 The `AuditEntityType` gap was already closed in phase 4, so no cast was needed. Added the `roster.exported` verb and its `LABELS` entry — the only verb in the union that is not a mutation, because reading is exactly what makes this the largest PII egress point.
- [x] 🪤 An id from the URL is interpolated into a PostgREST `in.(…)` list, so ids are **uuid-checked before the query is built** — the same discipline `FIELD_KEY_PATTERN` applies to a sort key. Explicit ids **narrow** the filtered query rather than replacing it, so a stale checkbox cannot smuggle in a row the filter excludes (pinned by an integration test).
- [x] **Settled: any officer, no role gate**, and both `lib/export.ts` and the route say so in their headers. §9 resolved four adjacent questions the same way on one premise — the audit log is the control, not a gate — and nothing in this codebase branches on `admin_profiles.role`. §6's "consider restricting it" was weighed along with the one argument that genuinely does not apply to approving (a downloaded file outlives the session); it did not win. Changing this means changing §9.

### ✅ Phase 5a — walked through a browser 2026-08-06

Driven against the **local** stack as `dev@example.edu`, on the seeded 29 active / 32 total roster — which is the useful shape here, because 29 matching against a page size of 25 is exactly the gap the phase exists to close.

- [x] Toolbar renders with `0 selected` and every action disabled
- [x] Three row checkboxes → `3 selected` → COPY EMAILS → **`Copied 3 addresses.`**, receipt `scope: selected`
- [x] **`Select all 29 matching this filter`** offered and worded distinctly from the 25 on the page; taking it → `All 29 matching selected` → COPY TABLE → **`Copied 29 rows.`**, receipt `scope: filter`. **This is the headline case: the export returned 29, not the 25 rendered.**
- [x] Header checkbox → `25 selected` (the page), then COPY EMAILS → `Copied 25 addresses.` with the receipt correctly reading **1 field**, not the picker's four
- [x] Roster filter `Active only` → `All` with rows checked → selection cleared to `0 selected`
- [x] CSV downloaded by direct navigation → real file `misa-members-2026-08-06.csv`, **UTF-8 BOM (`ef bb bf`)**, **CRLF**, headers in catalogue order
- [x] 🔓 A member named `=HYPERLINK("http://x","c")` inserted on local → the CSV cell came back `"'=HYPERLINK(""http://x"",""c"")"` — guarded — while `Bonus points` in the same row stayed a bare `0`. **The guard fires on text and not on numbers, end to end.** Fixture deleted afterwards.
- [x] Unauthenticated `GET` of the export path → **307** to `/admin/login?next=%2Fadmin%2Fmembers%2Fexport`

🪤 **Two things from the walkthrough itself, neither an application bug:**

- **An `attendance_rate` of `0` in the CSV looked like the §4.5 null-as-zero violation and was not.** The view returned a real `0.0000` — `events_possible` is 12 and the fixture attended none. Checked against the database rather than inferred from the file, which is the rule that has now paid off twice. The genuine null case is not observable without pinning `current_term` (a write), so it stays covered purely.
- **Browser automation degraded mid-session** — screenshots began timing out with `Page.captureScreenshot` and ref clicks silently stopped landing. `dev.log` settled it in one look: after the last recompile there were only `GET /admin/members` entries and **no export request at all**, so the clicks never fired. The app was fine. Reading the server log beats re-clicking, and a direct navigation to a `text/plain` format is a click-free way to exercise the route.

### ✅ Phase 5b — the xlsx workbook (2026-08-06)

**Decided 2026-08-06: hand-rolled, zero dependencies.** The candidates were checked rather than remembered, as the spec insisted:

- **SheetJS (`xlsx` on npm) — no.** The npm package is stuck at **0.18.5, last published ~4 years ago**; SheetJS moved real releases to `cdn.sheetjs.com` after a dispute with npm. Adopting it means either a four-year-old build or a CDN tarball URL pinned in `package.json` that a plain `npm ci` depends on. This is the trap the spec warned about by name.
- **`exceljs` — no.** No meaningful release since **Oct 2023**; the community has forked it (`@protobi/exceljs`). Inactive upstream or a fork with uncertain governance, on a project that turns over officers annually.
- **`@office-kit/xlsx`** is the healthiest maintained option if a dependency is ever wanted — actively developed, MIT, TypeScript-first, no paywalled tier.
- **Hand-rolled wins** because an xlsx is a zip of ~6 XML parts, `node:zlib` is built in, and the shape here is the easy case: a flat table, no formulas or merged cells. It keeps the zero-dependency-beyond-framework-and-Supabase property the next officer inherits.

- [x] `lib/xlsx.ts` — CRC32 + local file headers + central directory + EOCD over `deflateRawSync`; the six parts. Inline strings (`t="inlineStr"`), so there is no shared-strings table to keep in step. **A fixed DOS timestamp**, so the same roster produces byte-identical bytes — two exports diff cleanly and the tests have something stable to assert.
- [x] **Numbers as numbers, dates as dates** via serials plus a `numFmt`. An empty cell omits the `<c>` element entirely — a null `attendance_rate` never becomes `0`.
- [x] Consumes the **same `projectRow` output as CSV**; only the formatting differs. ⚠️ There is **no formula guard** in the xlsx writer and its absence is asserted: an xlsx cell carries its type and is never re-parsed, so copying the CSV apostrophe here would corrupt a legitimate name for no gain.
- [x] Sheet named for the filter (`sheetLabelOf` in the route → `sheetName` in the writer), sanitized to ≤31 chars with `[]:*?/\` stripped.
- [x] Polish that serves the stated purpose rather than decoration: **bold header, `<autoFilter>` over the used range, a frozen top row, and content-sized column widths.** "Opens ready to sort" is the entire argument for this format over CSV; an autofilter is that, literally.
- [x] `format=xlsx` joins `EXPORT_FORMATS`, first in the list because it is the default the toolbar offers. **DOWNLOAD XLSX is the filled primary button; Download CSV stays beside it**, outlined — never behind a menu, because it is the format that keeps working if this writer is ever pulled.
- [x] `tests/xlsx.test.ts` — **26 cases**, with a ~40-line ZIP reader written in-test so the suite stays dependency-free too. That reader makes the container part of what is under test: a malformed central directory fails here rather than in Excel.

🪤 **Four traps, all of which surface as the same thing — Excel's "we found a problem with some content" repair prompt, with no hint which one is wrong.** All four are asserted:

1. **Fills 0 and 1 are reserved** and must be exactly `none` then `gray125`. Omitting the second is the most common cause of the prompt.
2. **`numFmts` must be the first child of `<styleSheet>`**, and the order `numFmts, fonts, fills, borders, cellStyleXfs, cellXfs` is required.
3. **Every `count` must equal the real child count** — hand-written counts are hand-wrong by default, so they are derived from the arrays and the test recomputes them.
4. **The date epoch is `1899-12-30`, not `1900-01-01`.** Excel keeps a February 29, 1900 that never existed (inherited from Lotus 1-2-3 in 1985), and that base absorbs both the phantom day and the 1-based count. Custom `numFmtId` must be **≥ 164**.

Also: `<autoFilter>` goes **after** `<sheetData>`, not with the other sheet-level settings where it reads like it belongs. And the XML escaper strips illegal C0 control characters — officer notes are free text pasted from anywhere, and one control character makes Excel reject the whole package rather than the cell.

### ✅ Phase 5b — walked through a browser 2026-08-06

- [x] Toolbar shows **DOWNLOAD XLSX** (filled) beside **DOWNLOAD CSV** (outlined), both correctly disabled at `0 selected`
- [x] Row checkbox → the header checkbox renders **indeterminate**, which is the one piece of that control React cannot set declaratively
- [x] Clicking DOWNLOAD XLSX → `GET …?format=xlsx&…&ids=…` 200, receipt `xlsx | 1 | selected | 1 member (4 fields)`
- [x] A 32-member / 7-column workbook generated through the real route and opened from the outside: **`unzip -t` passes all six parts**, no CRC errors
- [x] `styles.xml` verified against all four traps — `numFmts` first, `numFmtId="164"`, fills `none`/`gray125`, every count matching
- [x] `total_points` is `<v>13</v>` — a **number**, not an inline string; `attendance_rate` `<v>50</v>`; `joined_at` `s="2"` with serial **46042**
- [x] 🪤 Serial 46042 → 2026-01-20, checked against the database: Amara Osei's `joined_at` is `2026-01-20 12:00 Central`. **The Central conversion survives into the serial** — a UTC slice would have been a day out for anyone who joined at an evening event.
- [x] `dimension`/`autoFilter` both `A1:G33` (32 rows + header), frozen pane present, seven `<col>` widths sized from content
- [x] ✅ **Opened in real Excel by an officer — no repair prompt**, Total points sorts numerically with no conversion step, the date column is a genuine serial. This was the one check no test could make, and passing it is what confirms the four `styles.xml` traps above were all handled.

📌 **Two things that look wrong in Excel's ribbon and are not**, both raised on that open and worth writing down so nobody "fixes" them:

- **`Total points` reports its type as `General`, and that is what a plain number IS in Excel.** The cells carry no number format at all, deliberately — imposing one on a point total is not the export's business. The proof it is numeric rather than text is that it sorts without a conversion step and that Excel **right-aligns** it, which is its own tell.
- **`Joined` reports `Custom` rather than `Date`, and it is still a real date.** The cell is `<c r="F2" s="2"><v>46042</v></c>` — no `t` attribute, so numeric, with `numFmtId="164"` applied. Excel says "Custom" only because `yyyy-mm-dd` is not one of its built-in *named* formats. Setting the column to General shows `46042`.
  - **Decided 2026-08-06: the ISO format stays**, rather than switching to built-in `numFmtId` 14 (`mm-dd-yy`). ISO is unambiguous across locales — `2026-03-10` can only be March 10, where `03-10` is October 3 to half the world — it survives being pasted elsewhere, it still sorts chronologically if anyone re-exports the column as text, and it **matches what the CSV writer emits**, so the two formats do not disagree about what a date looks like. The cosmetic "Custom" label is the entire cost.

🪤 **An environment trap that cost real time, and is not an application bug:**

- **Windows Smart App Control silently began blocking `supabase.exe` mid-session.** `npx supabase` had worked minutes earlier; then every invocation died with `spawnSync … UNKNOWN` (errno -4094) and a direct run reported *"An Application Control policy has blocked this file"*. Because `tests/global-setup.ts` shells out to `npx supabase status` for the local keys, **the entire suite was blocked — pure tests included** — while the stack itself was perfectly healthy (12 containers up, PostgREST answering 200). Confirmed via `VerifiedAndReputablePolicyState = 1` and CodeIntegrity events 3077/3033 naming the binary. Resolved by the officer disabling Smart App Control (a one-way change — it cannot be re-enabled without reinstalling Windows). **The transferable part: when the Supabase CLI dies but the containers are fine, `docker exec supabase_db_MISA-Website psql -U postgres -d postgres -tAc "…"` reaches the database with no CLI at all** — and it takes multi-line SQL, unlike `db query`.

### ✅ Phase 5c — filter by categorical fields (2026-08-07)

*Requested directly: **"filter the members to those with M size and export as an Excel file."** Phase 5 built the export half of that sentence; this is the missing half. Scoped by the officer to **all categorical fields, not only custom ones** — explicitly including paying-member status.*

**No migration.** Everything filtered here was already a column.

- [x] **Custom fields** — one dropdown per `show_in_directory` definition, options from the definition. The phase-4 spike had proved the JSON path *orders*; this needed it to *filter*, which is a different clause and is asserted against real PostgREST rather than assumed.
- [x] **`dues_paid_current_term`** — shipped early, with Stage 6.5 phase 4. Its block is above.
- [x] **`source`** — admin-created vs self-registered, labelled **Added by**. §4.2's roster-cleanup query has somewhere to live again.
- [x] **Every predicate in `applyMemberFilter` and nowhere else.** "Filter to M, then export" is provably the same query as the count on screen.
- [x] 🔓 **The key goes through `customFieldColumn()` at the point it enters the filter string**, not trusted for having come from the database.
- [x] ⚠️ **Archived or non-directory fields are not filterable**, same fallback the `cf:` sort keys take.
- [x] Tests: 18 pure cases and 7 integration.

**📌 The helpers were renamed, and the rename is the point rather than tidying.** `customSortColumn` → **`customFieldColumn`**, `customSortKey` → `customFieldKey`, `parseCustomSortKey` → `parseCustomFieldKey`, `CUSTOM_SORT_PREFIX` → `CUSTOM_FIELD_PREFIX`. The guard is now the escape for **two** positions — the `order=` term and the `cf:` filter predicates — and a security control named after only one of its call sites invites someone to write a second copy for the other. The spike's finding (PostgREST accepts a space and a `"` **silently, with no error at all**) is a property of a key reaching the query string, not of which clause it lands in.

**📌 `cf:` is now a param NAME as well as a sort VALUE**, and deliberately the same spelling in both: `?sort=cf:shirt_size` and `?cf:shirt_size=M`. One namespace, one meaning. `URLSearchParams` percent-encodes the colon to `cf%3Ashirt_size`, which is already how the sort value has looked since phase 4 — cosmetic, and consistent.

**⚠️ `parseMemberFilter` builds `custom` by walking the DEFINITIONS, not the params.** An unknown or archived `cf:` param is therefore ignored by construction, exactly as every retired phase-1 key is — there is no list of bad keys to keep current. The corollary is that the export route needs the definitions or it reads *no* custom filter at all: it would export the whole roster while the screen showed twelve members, with nothing on either side to say why. It already passed them for the sort; the header there now says why it is load-bearing.

**📌 A filter value is NOT checked against the definition's live option list, and that is a decision.** Editing an option list orphans every member still holding the value that left it (by design — the database has no such coupling either), and *"find everyone still on the retired size"* is precisely the cleanup query an officer needs afterwards. Restricting the filter to live options would make orphans the one thing the directory cannot show. The control copes by rendering through `fieldOptions`, which appends an unmatched value as a trailing entry rather than letting the `<select>` go blank — the defect that has now bitten twice elsewhere. Verified live: `?cf:shirt_size=XXL` renders **"XXL (no longer an option)"** in the filter bar and finds the one member holding it.

**⚠️ The value is not character-stripped either, unlike a search term.** It becomes a PostgREST `eq` operand rather than part of a quoted `or` group — data, not syntax — and stripping `.` or `,` would make a legitimate option like `S/M` or `Yes, with notes` unfilterable. `MAX_FIELD_VALUE_LENGTH` (80, mirroring the option cap) is the whole guard. Both punctuated values are asserted against real PostgREST, because the difference between an `eq` operand and an `or` operand is exactly what a pure test cannot see.

**🪤 One existing test failed, and its premise was what had changed.** *"tolerates a phase-1 bookmark without letting it narrow anything"* passed `source=self_checkin` among the six retired keys — and 5c un-retires `source`, so that bookmark narrows again. Correctly: the invariant was never "an old bookmark cannot narrow", it is **"nothing narrows without a control."** `source` now has one. The other five stay in the test.

### ✅ Phase 5c — walked through a browser 2026-08-07 · **no application defect**

Local, as `dev@example.edu`, with a `shirt_size` definition (`XS`–`XL`) and answers on six members — one of them deliberately set to **`XXL`, which is not in the option list**, to exercise the orphan.

- [x] Both controls render: **Added by** (Anyone / An officer / Self-registered) and **Shirt Size** (Any + the definition's options)
- [x] ✅ **The original request**: Shirt Size → M gives **3 matching**, all M, at `?cf%3Ashirt_size=M`
- [x] 📌 **The orphan**: `?cf:shirt_size=XXL` renders **"XXL (no longer an option)"** in the filter bar rather than blank, and returns the 1 member — the cleanup query the design argues for, working
- [x] **Added by → Self-registered** returns exactly the 3 rows carrying the SELF badge (§4.2)
- [x] 🪤 **The `memberFilterUrl` re-parse trap, with everything at once**: from `?cf:shirt_size=M&source=admin&sort=cf:shirt_size`, changing the Dues control produced `?dues=unpaid&source=admin&cf%3Ashirt_size=M&sort=cf%3Ashirt_size` — **all four survived**, filter and sort alike
- [x] ✅ **Filter reaches the export**: with all 3 selected, DOWNLOAD XLSX pointed at `/admin/members/export?cf%3Ashirt_size=M&format=xlsx&…` with **zero `ids` params** — *"filter to M size and export as an Excel file"* wired end to end
- [x] The `roster.exported` receipt recorded `filter: "cf%3Ashirt_size=M"`, `scope: filter`, `rowCount: 3` — the new predicate audited for free
- [x] Fixtures removed afterwards: definition deleted, `custom_fields` back to `{}` on all 32 members, **0 definitions** locally

🪤 **The browser harness kept dropping clicks and typed text** — the same flakiness as the phase-4 pass, worse this time. Two header-checkbox clicks and two attempts at the search box registered as no-ops with the page unchanged. It is **not** an application fault: the same actions worked by `ref` moments later, and the server and database agreed throughout. Where a control would not take input, driving the *same* `update()` through a different control proved the identical property. Budget for this, and prefer `ref` clicks plus a `find` to confirm state over coordinate clicks.

### ✅ Phase 6 — the relational filters (2026-08-07)

**No migration.** Three of the four are plain columns on the view; only the event filter needed anything new.

- [x] **Attended *or* missed a specific event** — the one filter that cannot be expressed on `member_directory` as a column.
- [x] Has-pending-submissions, and not-seen-since (labelled **all-time**, matching the detail page).
- [x] The "attended fewer than N events this term" query displaced from the phase-3 trim, back as `minEvents`/`maxEvents`.
- [x] `FilterableQuery` gained **`is` and `not` — and nothing else.** 📌 This entry used to predict `in`, `not` **and** `lt`; that came from assuming a uuid-list approach, which the spike rejected. Both were added to the recorder fake in the same commit, which is what that file's structural type exists to force — it stopped compiling the moment the interface widened.
- [x] ⚠️ The tension is flagged in the UI: an **Attendance filters** panel of its own, saying in a sentence that these narrow the list without being columns.

**🪤 Two spikes decided the event filter, and the numbers are worth keeping even though one approach was rejected.**

*Rejected — resolve attendees to a uuid list and narrow with `.in()`.* It 414s at Kong's 8 KB header buffer:

| ids | URL chars | result |
|---|---|---|
| 150 | 5,615 | 200 |
| 210 | 7,835 | 200 |
| **220** | **8,205** | **414** |
| 300 | 11,165 | 414 |

§2.2's worst case is **150 attendees an event** — a ~1.4× margin, and the effective ceiling is *lower* still because the id list shares the URL with the search term and the `cf:` filters. An officer could hit a 414 by adding a search term to an event filter. Unpredictable beats tight as a reason to reject.

*Chosen — PostgREST resolves the `member_directory` → `attendance` relationship, so **one** `!left` embed expresses both halves with no list at all:*

```
select=<COLUMNS>,attendance!left(event_id)
  &attendance.event_id=eq.<uuid>&attendance.status=eq.present
  &attendance=not.is.null   -> attended   (count=exact -> 15)
  &attendance=is.null       -> missed     (count=exact -> 17)
  (no event chosen)         -> inert      (count=exact -> 32)
```

15 + 17 = 32: the two modes **partition** the roster exactly, and `count=exact` is right in every case. An anti-join through an embed is not something a pure test can check, so `tests/member-directory.test.ts` pins the partition against real PostgREST.

**🪤 The embed has to be in the SELECT, and a dynamic select literal is a build break.** PostgREST types the row off the string *literal*, so `COLUMNS + ", attendance!left(…)"` widens it to plain `string` and collapses every field access — the `GenericStringError` trap for the third time. So each caller holds **two `as const` literals and one branch**, and `needsAttendanceEmbed` in `lib/filters.ts` owns the *decision* even though the literal cannot live there. ⚠️ The page and the export route must branch **the same way**; an export that forgot the embed would answer PGRST100 on exactly the filters that work on screen, which is why an integration test runs the export's chunked read against the same filter.

**📌 The page's row type had to move too.** `query` is now a union of two row shapes, so `raw: NonNullable<Awaited<typeof query>["data"]>` stopped compiling. It is typed off a `narrowSelect()` helper instead — used for real in the common branch *and* for its type in both — which keeps the COLUMNS literal the single source of the shape rather than restating it.

**⚠️ `status = 'present'` on the embed is load-bearing.** A member whose check-in is still in the queue did not attend as far as any credit goes, and counting them as present here would disagree with the leaderboard. Pinned: a pending fixture lands in *missed*.

**⚠️ Not-seen-since includes members never seen at all** (decided with the officer). `last_seen_at` is null for anyone never marked present, and a bare `.lt()` drops nulls silently — so the question "who has gone quiet?" would come back with the quietest members missing. It emits `or(last_seen_at.is.null,last_seen_at.lt.<instant>)`, which is the **second** `or` group on the query when a search is also active. Separate `or=` params **AND** together, which is what two independent concerns want; the failure the search's own comment warns about is splitting *one* concern across several calls. Both are pinned.

**⚠️ Central-anchored, like every other date range here.** A bare `.lt("last_seen_at","2026-09-01")` is a UTC-midnight cut that drops five hours of a Central day. A test asserts the emitted instant is `2026-09-01T05:00:00.000Z` — September is CDT, so the offset is part of the assertion rather than a constant.

**📌 The resync in `member-filters.tsx` now compares every key** rather than three named ones. Three new boxes arrived in this phase, and a hand-written comparison list is exactly the thing that gets a field added to one side and not the other — leaving the new box not resyncing on CLEAR, which is the phase-1 defect rebuilt by hand.

### ✅ Phase 6 — walked through a browser 2026-08-07 · **no application defect**

Local, as `dev@example.edu`, against the seeded roster plus one fixture member who had never been seen.

- [x] The panel renders **collapsed with no badge** when nothing in it is set
- [x] ⚠️ **It opens by itself whenever one of its filters is applied**, with an `N ACTIVE` badge — checked on every load below, and the reason it is `<details open={hasRelationalFilter(filter)}>` rather than component state
- [x] ✅ **The partition, on screen and against SQL**: Semester Kickoff attended = **15**, missed = **14**, active roster = **29**. SQL agreed on all three
- [x] Has-pending → **Hana Sato and Luca Moretti**. 📌 There are *five* pending rows but only two carry a `member_id`; the other three are orphans, which correctly cannot appear in a member-scoped filter
- [x] ⚠️ **Not seen since 2026-08-05 → 5 members, including `Zzz Neverseen`** — the null branch working end to end, and matching the SQL count exactly
- [x] Three predicates composed (missed the kickoff + unpaid + not seen since Aug 6) → **15**, and SQL agreed
- [x] ✅ Select all → the export URL carried **event, eventMode, notSeenSince and dues, with zero `ids` params** in 185 characters → COPY EMAILS → *"Copied 15 addresses"*
- [x] The `roster.exported` receipt recorded the full filter string including `event=…&eventMode=missed` and `rowCount: 15` — which also proves the export route's conditional select fires, since it would have answered PGRST100 otherwise
- [x] Fixture member deleted; local back to **32 members, 0 field definitions, 0 dues payments**

🪤 **The browser harness dropped clicks again** — three times on the header checkbox. Same as 5c, same conclusion: not an application fault. Verified by a coordinate click after `ref` clicks failed, and by reading the audit receipt rather than the clipboard.

### ✅ Phase 7 — saved presets and CSV import (2026-08-08)

*Split into **7a** and **7b** before building, mirroring 2a/2 and 5a/5b: presets need migration 20 and the import needs no schema, so the push is isolated from the wider work and each half got its own walkthrough and merge.*

#### ✅ 7a — saved filter presets (migration 20)

- [x] **Migration 20** — `member_filter_presets` (RLS deny-all), a case-insensitive unique index on `name`, the `set_updated_at` trigger, and `'member_preset'` in `admin_audit.entity_type`. **Applied from scratch via `db reset`** before anything was written against it, then pushed to the remote **before** the merge.
  - 📌 **The entity-type widening and `AuditEntityType` moved in one commit**, which is the third time this pair has come up and the first time it has not drifted. `'roster'` (migration 14) and `'dues_payment'` (migration 19) both landed in SQL first and TypeScript later.
  - 📌 **This is a TABLE, so migration 12's blanket anon grant is genuinely safe** — the migration-15 hazard is specifically about views, which have no RLS. `tests/security.test.ts` scans for views and correctly does not pick it up; the anon-reads-it-empty check lives in `tests/presets.test.ts` instead.
- [x] **A preset stores the canonical query string, not a jsonb copy of `MemberFilter`.** `memberFilterToParams` sorts its keys and omits defaults, so the string is a function of the filter rather than of the order the officer clicked — which is exactly what lets the chip row mark the active preset by **string equality**. Verified live: a URL with the params reordered and carrying a redundant `state=active` still lit the chip.
- [x] `lib/presets.ts` (pure — `canonicalPresetQuery`, `storableFields`, `presetSummary`), `lib/member-presets.ts` (the read), `app/actions/presets.ts` (`savePreset` / `deletePreset`), the chip row on `/admin/members`, and the manage screen at `/admin/members/presets`.
  - **`deletePreset` is a real delete**, unlike archiving a field definition: nothing is keyed to a preset, so there is nothing to orphan. `event.deleted` is the precedent for an audit row naming a row that no longer exists.
  - **No CAS token**, matching `saveFieldDefinition` and for the same reason — one full-page form, no inline surface, no queue.
  - ⚠️ **"Update this view to what I am looking at now" lives on the DIRECTORY, not the manage screen**, because that operation needs a current filter to read and the manage page has none. It is the "Replace …" option on the one save form.

**🐛 Two defects found in the browser walkthrough, and the first is the interesting one.**

- 🪤 **"Canonicalise on write, never on read" is not sufficient on its own, because a RENAME is a write.** The manage screen posts the row's stored query straight back, so canonicalising it against the **live** definitions re-derived a filter the officer never touched — dropping any `cf:` clause whose field was archived or hidden, permanently on the next save. The fix is `storableFields` over `fetchFieldDefinitions(db, { includeArchived: true })`: **storage is permissive, application stays strict**. The directory still parses with live, in-directory definitions, so an archived field narrows nothing while archived and works again if restored.
  - **The symptom was worse than silent, and only by accident.** A preset whose *only* clause was the archived one canonicalised to `""`, tripped `presetSaveSchema`'s `min(1)`, and the row rendered **"Check that name"** — a message about the one thing that was fine. A preset with a second live clause would have saved cleanly and lost the first with no signal at all. Both halves fixed; the error rendering now surfaces a `query` failure rather than mislabelling it.
  - ✅ **Verified as a full cycle:** field live → 3 rows and the summary reads *"Shirt Size: M"*; archived → **29 rows** and the summary reads **"Everyone"**; rename while archived → the clause survives in the stored query; restored → 3 rows again.
- 🐛 **The save form's two `<input name="name">` branches were reconciled as one input changing mode** — uncontrolled (`defaultValue`) to controlled (`value`) — so React reused the DOM node and carried a half-typed name into the hidden field. Caught by a **console warning**, not by anything on screen. Distinct `key`s on both branches; console clean after, verified by clearing the buffer and repeating the toggle.
- ⚠️ Both fixes are pinned by **source assertions**, because vitest runs `environment: "node"` and can neither render a component nor call a `"use server"` export.

#### ✅ 7b — CSV roster import (no migration)

- [x] **Two shared modules extracted first, each so there is one implementation rather than two.** `lib/csv.ts` takes `parseCsv` out of `lib/dues.ts` — the multi-line-quoted-field tokenizer is precisely what a hand-rolled copy gets wrong, and the roster importer should not pull the dues domain in behind it. `lib/dues-roster.ts` became **`lib/roster-index.ts`**, returning `{memberId, normalizedEid, emailLower}` with the same discriminated error and the same explicit 1000-row paging.
- [x] **`lib/member-import.ts`** (pure) — `importColumns`, `matchHeaders`, `planRosterImport`, `parseActive`, `describeOutcome`; **`app/actions/member-import.ts`** (`previewRosterImport` / `commitRosterImport`, sharing one plan path, commit re-parses); `/admin/members/import`.
- [x] **`importColumns` is built from `exportCatalogue`**, so the export's own labels are the import's headers and a downloaded CSV round-trips. Migration 18's `key_not_builtin` CHECK already makes the catalogue one namespace, so a custom field structurally cannot claim `Email`.
- ⚠️ **Create-only, decided with the officer before building.** A row matching an existing member is counted, shown and never written. A stale spreadsheet must not overwrite an officer's correction, and it is what makes re-importing a no-op.
- ⚠️ **Both unique indexes, and the file against itself.** `members` carries `members_normalized_eid` *and* `members_email_lower`, so an importer checking only the EID shows a clean preview and then takes a 23505. The within-file check is the "a pre-flight must dedupe within the selection too" invariant applied to a file naming the same person twice.
- 🪤 **One atomic insert, NOT the upsert the dues import uses.** PostgREST's `onConflict` takes one target and there are two indexes, so an upsert cannot express "skip if either matches" — and unlike dues, a roster is not *designed for* overlapping re-imports. All-or-nothing is safe here precisely because the preview recomputes: a retry reclassifies anything already written as `existing`. A 23505 is reported as a race, with nothing written.
- ⚠️ **A bad dropdown value invalidates the ROW rather than importing the field blank**, and an empty cell leaves the key **absent** rather than `""` (the `setFieldValue` rule). An unrecognisable `active` cell invalidates too — guessing would silently reinstate somebody the officer meant to archive.
- **One `member.imported` audit row per member**, the entity being the member (as `dues.imported` is per payment); the file name and counts travel in `note`. **No `import_batch_id` column** — `members` has none and this half deliberately carries no migration.
- 📌 **`source` stays `'admin'`.** Widening the CHECK to add `'import'` would touch the filter, the SELF badge, the export catalogue and the seed, and the audit row already answers the only question a third value would have.

**✅ Walked through a browser 2026-08-08 — no application defect.** One CSV carrying every outcome, against the local stack:

- [x] Preview reported **3 new / 2 already on the roster / 1 repeated in the file / 4 need fixing**, adding to the 10 rows uploaded, with **"Ignored 2 columns: Total points, Attendance rate (%)"**
- [x] Every classification correct, including the two that matter most: a row with an invented EID but **Amara Osei's real email** read *"Already on the roster (same email)"* — the axis a single-index check misses — and `AL-1815` read *"Same EID as line 2"*, matched through the generated column's case-and-punctuation fold
- [x] A quoted name containing a comma (`"Hopper, Grace"`) parsed cleanly; `Active = no` imported as inactive and showed the INACTIVE badge in the preview
- [x] Commit → *"3 members added, 2 already on the roster and skipped"*; the database showed 35 members with the right names, `source = admin`, and `custom_fields` set from the Shirt Size column
- [x] **Re-uploading the same file → 0 new / 6 already on the roster**, the button disabled reading *"Add 0 members"*. Line 7 correctly flipped from *"Same EID as line 2"* to *"Already on the roster"*. Members unchanged at 35, which also proves **preview writes nothing**
- [x] `/admin/members/[id]` renders the trail as **Imported**, `imported from "roster.csv" — 3 of 10 rows`, every column as `— → value` and **no `updated_at`** in the diff
- [x] Fixtures deleted; local back to **32 members, 0 definitions, 0 presets, 0 dues payments**

### ✅ Phase 8 — the merge tool (2026-08-08)

*The one part of this stage with real domain logic in it. **No migration.***

- [x] **`lib/merge.ts`** (pure) — `planMerge` shaped after `planBulkAssign`, `mergeNotes`, `mergedCustomFields`, `isOfferedChoice`, `rankDuplicateCandidates`. **`app/actions/member-merge.ts`** — `previewMerge` / `commitMerge`, sharing one derivation; the commit **re-derives** and re-validates every posted choice. The merge panel is a `<details>` on `/admin/members/[id]`, **closed by default** (rare and destructive, unlike phase 6's panel which opens when active), with a two-click confirm rather than `window.confirm`.

**🔓 The roadmap's central claim about this phase was WRONG, and correcting it IS the design.**

Every version of this file said a merge "can hit `attendance_one_per_event` when both identities attended the same event — a real conflict to decide, not to swallow." It **cannot**. The index is keyed on **`(event_id, normalized_eid)`** — the *submitted* EID — and **not on `member_id`**. Two identities have different EIDs by construction, so repointing `member_id` never touches an indexed column and the guard is structurally unreachable from a merge.

- **So the failure is silent, not loud.** The survivor keeps two `present` rows for one event; both views aggregate per row (`count(*)`, `sum(e.points)`), so the event is counted twice and `events_attended` can exceed `events_possible`.
- 📌 **Asserted against real Postgres before the fix was written.** `tests/member-merge-actions.test.ts` opens by *proving the hazard* — a naive repoint returns no error and yields `events_attended = 2` for one distinct event with doubled points — then proves the reject-first sequence yields 1. Had the claim been wrong the rest of the phase would have been over-engineering, so it is measured rather than argued.
- **The resolution is the doc's own** — keep one, reject the other. A rejected row leaves the partial index *and* stops counting for points, so the double count is prevented rather than reported.

**⚠️ Only one of the three foreign keys fails loudly, and the dangerous one cascades.**

| Table | On delete | What a delete-before-repoint does |
|---|---|---|
| `attendance.member_id` | `set null` | Silently orphans every check-in |
| `point_adjustments.member_id` | **`cascade`** | **Silently destroys every grant** |
| `dues_payments.member_id` | `restrict` | Blocks the delete — the only loud one |

The note that the restrict makes a forgetful merge fail loudly is true *for dues* and false for the other two. So `commitMerge` **re-counts all three and refuses to delete unless every count is zero**, and both silent behaviours are pinned by their own tests.

- ⚠️ **Not atomic and it cannot be** — PostgREST has no cross-statement transaction, the gap `writeAudit` records. The order is chosen so every partial failure is **recoverable**: repointed-but-not-deleted is a visible duplicate holding no data, which the officer merges again. The irreversible step is last and is guarded.
- **One `member.merged` row, on the SURVIVOR.** The loser's row is deleted, and there is no page for a member that does not exist, so its own history becomes unreachable — this row is the only surviving record and carries the loser's name, EID, **id** and the counts in `note`. Each collision also writes its own `attendance.rejected`, so the queue's history explains a rejection nobody in the queue made.

**🪤 The ranker's calibration does not carry over, and the seed cannot supply a new one.**

Between two *members*, `email_exact` (+100) and `id_exact` (+100) are impossible — `members_email_lower` and `members_normalized_eid` are unique indexes — so the two decisive signals the weights were built around can never fire. Measured: the seeded roster produces **zero** member-vs-member pairs scoring 15 or above across all 496 pairs, because it is a clean roster of deliberately distinct people and contains no duplicate to calibrate against. So the shapes were **constructed and measured** instead: real duplicates land at 65–110 on two axes, every different-person shape tops out at 50. `MIN_DUPLICATE_SCORE` is **60**, plus `MIN_DUPLICATE_AXES` of **2**.

- ⚠️ **"Same name, nothing else" (50, one axis) is deliberately NOT offered.** Two students can share a name and the consequence of acting on a wrong suggestion is a deleted member. The picker sits beside the suggestions for the officer who knows better — which is why it exists.
- **`fetchMergeCandidates` includes INACTIVE members**, unlike every other picker: a ghost is usually the half somebody switched off, because that was the only thing they could do before this phase.

**✅ Walked through a browser 2026-08-08 · three defects found.**

- [x] Duplicate of a seeded member (typo'd EID, personal email, deactivated) carrying one **shared** event, one unshared, a pending orphan, an adjustment, a payment, a conflicting shirt size and notes on both sides
- [x] The ranker offered it as the only suggestion, reading **"same email name, different domain · EID off by 1 · same name"** — three axes
- [x] Preview: **2 moved / 1 rejected as duplicate / 1 adjustment / 1 payment**, the collision named, the conflict offered, the deletion stated
- [x] Committed choosing the **duplicate's** value, to exercise the choice rather than the default. After: `events_attended` **7 not 8** (the shared event counted once), `attendance_points` 9, bonus 11, total 20, rate **58% ≤ 1**, dues **true**, `joined_at` the earlier date, notes concatenated, `shirt_size` = **L** (the officer's choice), the duplicate gone, one rejected row kept as history
- [x] The trail reads **Merged**, `merged Amara Osei (ao4472) [d5e86765-…] — 2 check-ins, 1 rejected as duplicate, 1 adjustment, 1 payment`
- [x] A second merge exercised the zero-counts path and a field the survivor did not hold, which transfers with no decision
- [x] `db reset` afterwards, so local is exactly the seed: **32 members, 15 events, 208 attendance, 0 definitions, 0 presets, 0 dues**

🐛 **Defect 1 — the audit diff did not record `joined_at`, which a merge changes.** A merge takes the earlier of the two joined dates, so it writes the column; `AUDITED_MEMBER_COLUMNS` did not carry it and the rendered trail showed only notes and custom_fields moving. §4.2 asks a mutation to record what it changed. Added — and it costs the other callers nothing, because `AuditTrail` renders only keys whose values differ.

🐛 **Defect 2 — the member picker emptied itself after the preview.** React 19 resets a `<form action={…}>` when the action resolves, and `form.reset()` snaps a `<select>` back to its first option **without re-rendering**, because React's own state never changed. The box read *"Choose a member…"* above a preview for a specific member until the next interaction healed it. Fixed by moving the picker **out of the form** and posting the id as a hidden input — a reset then has nothing to reach. Pinned by a source assertion, since vitest cannot render a component.

🐛 **Defect 3 — "1 field disagree".** Cosmetic, fixed.

📌 **One reading that looked like a defect and was not**, worth recording because it cost a detour: `get_page_text` showed Shirt Size as `—` and the notes box empty while the database plainly held `M` and a note. Flat text extraction cannot express a `<select>`'s *selection* or a `<textarea>`'s *value*. A screenshot settled it in one call. The lesson points the other way from the usual one: verify against the server **and** against a rendering before believing either.

### ✅ Phase 9 — docs and the closing read-through (2026-08-08)

*The pass Stage 5 proved was worth doing, and phase 8 proved again at worse severity. **No migration.***

- [x] **`tests/docs.test.ts`** — the durable half. Walks `app/` and asserts every route appears in the doc's §5 table; asserts every `lib/*.ts` and `app/actions/*.ts` module appears in §10 **and** in `CLAUDE.md`'s Layout. Modelled on `tests/security.test.ts`, and for the same reason: **the next route fails there instead of being missed for months.**
  - 🪤 **Scoped to those blocks, never a whole-file grep.** A name can sit in a changelog while the map a reader navigates by never gains a line — which is exactly how six modules hid in plain sight.
  - ⚠️ **It checks that a name is PRESENT. It cannot check that the sentence around it is true.** Phase 8's inverted `attendance_one_per_event` claim would sail straight past every assertion in it. Said so in the file header, because a green run here must never be mistaken for a read-through.
  - **It found `/admin/attendance/new` missing from §5** — built in **Stage 5** and undocumented ever since — plus `/admin/members/import`, `/admin/members/presets`, the two `fields/` sub-forms, six `lib/` modules and three action modules. 14 failures on the first run.
  - 🐛 **The guard had a false pass, and only breaking it on purpose showed that.** `expect(layoutDoc).toContain("merge.ts")` is satisfied by `member-merge.ts`, and `presets.ts` by `member-presets.ts` — four pairs in this repo differ only by a `member-` prefix, so renaming `merge.ts` out of the layout left the test green. It matches on a boundary now, and that behaviour is pinned by its own assertion. **A guard never seen red is a guard nobody knows works** — the same check phase 2a ran on `tests/security.test.ts`.

**What the read-through found in the architecture doc**, checking claims against code rather than reading for typos:

- 🐛 **§4.1 quoted `members_normalized_id`, an index renamed by migration 16.** The sharpest find after phase 8's, and the same shape: both the merge tool and the roster import reason about *"the two unique indexes on `members`"* **by name**, so a reader checking that reasoning against the DDL would have found one of the two does not exist.
- 🐛 **§4.1 was missing two whole tables** — `member_field_definitions` (migration 18) and `member_filter_presets` (migration 20). The data-model section did not describe two tables the application depends on. Both added, with `checkin_throttle`'s deliberate absence now stated rather than left ambiguous.
- 🐛 **`admin_audit`'s documented `entity_type` check was missing `'member_preset'`.** The TypeScript union had it; the DDL in the doc did not. That union has now drifted from this check three times, so the note about treating both as one edit moved into the DDL itself.
- 🐛 **The Stage 6 heading still read "phases 1, 2a, 2 and 3 of 9 built"** — five phases stale.
- **§6 gained two rows**, for the two most consequential new operations: the roster import as PII *ingress* (never persisted, create-only) and the merge as the only officer action that permanently deletes a row.
- **§2.2's `MEMBER_SCAN_LIMIT` list gained a fifth caller.** ⚠️ The merge picker is the sharpest of the five and the newest: the other four truncate a list of people you are *choosing among*, this one truncates the list a duplicate has to be **found** in — and `fetchMergeCandidates` includes inactive members, so it reaches the cap sooner.
- 📌 **One paragraph was checked and deliberately NOT changed.** §7's item 1a still says a confirmed first-timer can trip `attendance_one_per_event`, and that is **correct** — both rows carry the same *submitted* EID, which is what the index is keyed on, unlike a merge. A note now says so, because a reader who has just absorbed phase 8's correction would otherwise "fix" a true sentence.

**Elsewhere:**

- 🐛 **`CLAUDE.md` asserted `lib/dues-roster.ts` in the present tense**, a file renamed to `lib/roster-index.ts` a phase earlier. The *rule* was right the whole time; the file it pointed at had not existed for a day. A good illustration of what this pass is for.
- 🐛 **`docs/dues-and-membership.md` said phase 4 was unbuilt.** It shipped 2026-08-07. Status corrected, and the two names that moved after the document was written (`dues-roster.ts`, and `scoreMemberCandidates` which never existed) are now flagged at the top and inline, rather than only in a corrections section a reader may reach second.
- 🐛 **`README.md`'s map omitted two whole admin sections** — members and dues — and the dues spec was missing from its documentation list. It is the front door.

**🔓 The seed's wipe list was missing two tables**, and this is the one code-adjacent fix in the phase because it is the confirmed cause of real production drift:

- `seed.sql` never named `member_field_definitions` or `member_filter_presets`, and `scripts/seed-remote.sh` can only clear what the list names — which is why production carried a `shirt_size` definition from the phase-4 walkthrough, long after "production IS the seed" was recorded as true. `db reset` hid it locally because it drops the whole database rather than running these deletes.
  - 📌 **Follow-up, 2026-08-09: the fix converted the drift into a decision, and the decision went the other way.** With the delete in place the next re-seed would have removed a column an officer was using, so `shirt_size` is now *seeded* and the assert expects 1 definition rather than 0. Adding a table to the wipe list is also a claim that the seed should be the only source of those rows — worth checking that claim is true before adding one.
- ⚠️ **`member_filter_presets` goes before the `auth.users` delete**: `created_by` references it with no cascade, so a preset saved by the seed officer would block that delete and abort the re-seed — the same shape as the `dues_payments` note already there, and the same failure.
- **Both are now asserted in the seed's own check block**, so "0 definitions, 0 presets" is verified rather than claimed. Proven to fire by inserting a probe row and watching the assertion raise.
- 📌 The generalisable rule, now in the file header: **the wipe list is the definition of "matches the seed", and a table missing from it is invisible drift.** Any migration that adds a table has to decide whether it belongs there.
- ⚠️ **Production was NOT re-seeded.** That is a destructive operation the officer authorises separately; this fix makes the *next* authorised re-seed correct.

**No browser walkthrough, deliberately** — the phase changes no application behaviour. The one behavioural change (`seed.sql`) is verified by `db reset` plus its own assertions.

### 🪤 Traps specific to this stage

- **`create or replace view` cannot rename an output column** — only append. This is why phase 2 needed an explicit `drop view` and a re-`grant`, reversing what migration 14 wrote down. A migration that drops and forgets the re-grant leaves `member_directory` unreadable by `authenticated` with no error at migration time. Phase 4 appends `custom_fields` and `notes`, which `create or replace` handles — do not reach for a drop.
- **Date filters left `lib/filters.ts` in phase 3 and come back in phase 6.** `joinedFrom`/`joinedTo` were the only Central-anchored half-open range this module carried, so its `centralWallTimeToInstant` / `addCivilDays` import went with them. "Not seen since" needs the same shape back; copy the awarded-date range in `app/admin/(shell)/points/page.tsx`, not a bare `.lte(date)`, which is a UTC-midnight cut that drops five hours and looks reasonable.
- **A JSONB text sort is lexicographic** — `"10"` sorts before `"2"`. Harmless for categorical dropdowns, and a real defect the day someone defines numeric-looking options. Decide then whether to store an explicit `sort_order` per option rather than sorting on the value.
- **An unvalidated `order=` value must never reach the query.** Custom sort keys are validated against the live definition list, never passed through from the URL. This is the one place the `cf:` namespacing is load-bearing rather than cosmetic.
- **The near-miss recalibration is empirical, not analytical.** The existing constants were set by looking at a real review screen offering three strangers, not by reasoning about edit distance. The new ones must be set the same way, against the new seed.
- **Seed EIDs must stay obviously fake.** The repo is public, and EID-shaped values *look* like real credentials in a way `UT-100001` did not.
- **The select-all bug is invisible against the seed.** The roster is **32 members, 29 active** — smaller than two pages at any sensible page size, so "copy emails" will look perfectly correct while silently returning one page. Either seed enough members to exceed the page size or drop the page size in the test; asserting 60 addresses from a 60-row filter across a 25-row page is the whole point of the coverage §7 asks for.
- 🔓 **A CSV cell beginning `=`, `+`, `-`, or `@` is a formula when the officer opens it in Excel — and member names are attacker-supplied.** Anyone who can check in during an open window picks their own name (§6's self-registration row), so this is reachable by design, and the victim is the officer's machine rather than the server. Escape it in the CSV writer — prefix with `'` or refuse the leading character. **The xlsx path is not exposed**, because cells are written as typed strings; that asymmetry is a reason the two writers must not share a "join it with commas" shortcut, and a reason not to implement xlsx as CSV-with-an-extension.
- **An xlsx is buffered whole, not streamed** — a workbook is a zip, so there is no incremental path worth having. Bounded by function memory and Vercel's response-size limit, which is fine for a few hundred members and is the argument for a hard export row cap rather than against one. Check the current limit before assuming a number.
- **Numbers and dates have to be written as numbers and dates.** The whole reason to ship xlsx over CSV is that it opens ready to sort and pivot; a workbook full of text cells is a CSV with extra steps, and the officer still runs "convert to number" on every column. Corollary: a null `attendance_rate` is an *empty* cell, never `0` — the §4.5 rule does not stop at the screen.
- **A row cap can truncate an export silently, and local and hosted may not agree.** `config.toml` sets no `max_rows`, but the hosted project applies its own — so an export that is complete locally can come back short in production, which is the same partial-list failure wearing a different hat. Verify the effective cap on **both**, and page through explicitly rather than trusting one request.
- **Don't reuse `fetchMemberOptions` for the directory query.** It is an active-only bounded scan built for pickers (`MEMBER_SCAN_LIMIT`, and the reason it is a scan and not an `ilike` probe is recorded on that constant). The directory needs its own paginated query over `member_directory`, including inactive members.
- **Date filters stay Central-anchored and half-open** — `joined_at` and `last_seen_at` both, wherever they survive the phase-3 trim or return in phase 6. The existing `centralWallTimeToInstant` / `addCivilDays` pattern is the one to copy; a bare `.lte(date)` is a UTC-midnight cut that drops five hours and looks reasonable.
- **Server Components own the date formatting** for `joined_at` and `last_seen_at`. Pass formatted labels down as props — and this gets sharper in phase 4, when the directory table becomes a Client Component for the inline `<select>` cells.
- **Admin pages read through `createAdminClient()` behind `requireOfficer()`**, as every existing admin screen does. `member_directory` is granted to `authenticated` only and carries emails and EIDs — never read it from a Client Component with the anon key, and never loosen that grant to make one work.
- **Whether export should be `admin`-role-only is still open.** §6 says "consider restricting it"; §9 #6 decided any officer may *approve*, which is a different question. Decide it in **phase 5** and write down which way and why.

### Carried in from earlier stages — the three §4.2 consequences this screen inherits

All three are the deliberate exact-match design's bill coming due, not defects. Reasoning is in the doc's Stage 6 section (v1.21, revised v1.22).

- 🪤 **Duplicate members still accumulate and nothing merges them — but far fewer of them** (revised v1.22). The main source of ghosts is gone: a double typo used to create a member silently, and now it is refused and re-prompted. What remains is someone who ticks "this is my first MISA event" *and* types badly, which is a narrower and mostly one-shot failure. Ghosts are still findable via `members.source = 'self_checkin'`. A merge must repoint `attendance.member_id` and `point_adjustments.member_id` and can hit `attendance_one_per_event` when both identities attended the same event — a real conflict to decide, not to swallow. Preview-and-confirm, one audit row naming both sides. Smaller in expectation, so it can follow the directory rather than gate it.
- 🪤 **A valid-but-wrong EID silently credits the wrong member — and got slightly *more* likely** (v1.22). The EID lookup runs before the email lookup, so mistyping into *another member's* real EID records you as them even though your own email would have matched. The one path where exact matching attributes attendance to the wrong human with nothing surfaced, and a confident typo that happens to hit a real EID now sails straight through as a matched member. Reordering just trades one silent mis-credit for another, so this is recorded rather than fixed — but merge tooling should assume mis-credits exist, and flagging a submitted-vs-matched email mismatch at check-in is the cheap partial mitigation. **This is the one the member detail page in phase 3 is the mitigation for** — it is where someone finally asks "why does this member have an event they didn't attend?"
  - ⚠️ **The EID switch makes this worse, and the reason is not obvious.** UT EIDs are derived from name initials, so students with similar names hold similar EIDs — the near-miss population is *correlated with the roster* rather than spread across a numeric range the way `UT-1000xx` was. A one-character typo is now meaningfully more likely to land on a real person, and more likely to land on someone plausibly confusable with you. Weigh this again when recalibrating the ranker in phase 2.
- 🪤 **A confirmed first-timer can leave a member row with no attendance.** If an officer already queued a manual row carrying that EID for the event, the member is created and the attendance insert then fails on `attendance_one_per_event`. Pre-existing, rare, and deliberately not fixed in v1.22: the pre-check that would catch it is a fourth duplicate check against the "three checks, not one" invariant. Another `source = 'self_checkin'` row for the directory to surface — a member with zero attendance and a self-registered source is the shape to look for.

## Done — Stage 6.5: Dues & membership status (closed 2026-08-07, all 4 phases)

*Attendees split into **official** and **unofficial** members on whether they have paid dues (§7 Stage 6.5, doc v1.34). Planned 2026-08-05; **phases 1 and 2 of 4 built 2026-08-06** — the schema and pure core, then the import. Phase 3 (the ledger and the editor) is next. It **interrupts Stage 6 between phases 5 and 6**: phase 5 ships the export machinery, this makes dues real, and Stage 6's exit criterion is then demonstrated against the real column. Numbered 6.5 rather than renumbering Stages 7–10, which would touch every stage reference in three files for no gain.*

**Full spec, including the parse decision table: [`docs/dues-and-membership.md`](docs/dues-and-membership.md).** Read it before phase 1 — the decision table is the thing the tests are written from.

**Exit criterion:** upload two overlapping Venmo statements back to back; the second reports the earlier payments as duplicates and adds only what is new. A payment whose note carried a typo'd EID sits in the review queue, gets assigned in one action, and that member's directory row flips to **Paid**.

### What changed and why (2026-08-05)

"Paid Dues → Yes/No" was this project's canonical example of a phase-4 custom field — a dropdown an officer ticks by hand, forty times, from a Venmo screen open in another tab. It is now a **calculated** column derived from real payments. The custom-field mechanism is unchanged and still right; dues turned out to be the wrong thing to build on it, and that is a change of kind rather than of detail.

Four decisions taken with the officer, all settled — do not re-litigate while building:

1. **Official status gates nothing** (§9 #12). A column, a filter, and a line on the member's own `/lookup`. Check-in, points, and the leaderboard are untouched. It is the reversible choice — a gate later is application logic over a column that already exists.
2. **The dedupe key is Venmo's transaction ID.** Not a content fingerprint. See the traps.
3. **$50 covers the next two terms from the payment date**, and prices live in `app_settings` in cents, read at import time only.
4. **The payer's Venmo name and handle are stored**, because without them an unresolved row is an amount and a date and nothing an officer can act on.

### ✅ Cleared before phase 1 (2026-08-05)

- [x] **The Venmo export carries a transaction ID column** — checked against a real monthly statement. The entire de-duplication design rested on it, and it is the one thing that could have invalidated the plan. The fingerprint fallback (`datetime, amount, payer handle, note`) never has to be built; it stays recorded in the spec doc only so nobody reaches for it as an obvious substitute if the export format ever changes.
- [x] **The `dues_paid` walkthrough fixture is deleted from the local database** — the definition row plus the held values on Amara Osei and Bela Kovacs, with `shirt_size` left intact. Migration 19's reserved-key CHECK now has nothing to trip over. 📌 Worth keeping the reason: archiving would **not** have worked around it, because migration 18's unique key index spans archived rows on purpose.
- [x] ✅ **Done at the top of phase 1 (2026-08-06):** the export's exact column names and amount format are recorded — see the phase-1 block below and the spec doc. Every part of the real shape was a surprise.

### ✅ Phase 1 — schema and the pure core (2026-08-06)

- [x] **Migration 19** — `dues_payments`, the two `app_settings` price columns, `term_index` / `term_at_index` / `next_term` / `terms_from`, `'dues_payment'` in `admin_audit.entity_type`, and the three dues keys added to the reserved-key check. Applied from scratch via `db reset`, so it is proven to rebuild from the repo alone.
- [x] ✅ **The `dues_paid` walkthrough fixture is gone from the local database** (2026-08-05) — done ahead of the migration rather than discovered by it.
- [x] **`dues_paid_current_term` appended to `member_directory`** via `create or replace`, last in column order, with the anon revoke restated. `tests/security.test.ts` auto-scans the migrations for views, so it re-probed this one and passed — the cheap proof the grants survived.
- [x] **`RESERVED_FIELD_KEYS` gains the same three keys in the same commit as the SQL check**, and both are asserted: `tests/members.test.ts` proves the keys are *well-formed* yet rejected, and `tests/dues-schema.test.ts` proves the **database** refuses them, not merely zod.
  - 🪤 **The concrete cost of the reservation, which only the suite finds:** five test files used `dues` / `dues_paid` as their sample custom-field key. Renamed to `committee` in the same commit. `t3q_dues*` keys in the integration files are prefixed and stayed valid.
- [x] **`lib/dues.ts`** — pure: `parseCsv`, `parseVenmoStatement`, `parseAmountCents`, `parseVenmoDatetime`, `matchNote`, `termsForAmount`, `planPayment`, and the `termIndex` / `nextTerm` / `termsFrom` / `isLaterTerm` mirrors of the SQL. Cents, never floats.
- [x] **No EID regex.** Tokenize, fold, look for a token that *is* some member's normalized EID.
- [x] Regenerated `lib/types/database.ts` — 🪤 and the `--local` trap is real: the `__InternalSupabase` declaration block is dropped while line ~615 still *references* it in `DatabaseWithoutInternals`. Restore it by hand or the file does not typecheck.
- [ ] Seed fixtures with obviously fake Venmo handles — deferred to phase 2, which is where the import that consumes them lands. The parser is already tested against a hand-built fixture reproducing the real shape.

**📌 The real Venmo export format, recorded from an actual statement 2026-08-06.** Every one of these changed the parser, and none of them was guessable:

- **The header is on line 3.** Lines 1–2 are `Account Statement - (@handle)` and `Account Activity`. There is a **leading empty column**; 22 fields; the ones that matter are `ID, Datetime, Type, Status, Note, From, To, Amount (total)`. Columns are located **by name**, so a Venmo reorder cannot silently shift every value one to the left.
- **`Amount (total)` is `- $18.50`** — the sign is a *separate token before the currency symbol*, so `parseFloat` returns `NaN` and stripping non-numerics without reading the sign first turns a withdrawal into a payment.
- 🪤 **`Datetime` is `2026-09-03T19:22:00` with NO offset.** `new Date(raw)` reads that as local — UTC on the server — landing a 9pm Central payment five hours early. **This is the `new Date("2026-09-01T18:00")` trap arriving through a new door.** Decided: treat it as **Central wall time** and attach the zone via `centralWallTimeToInstant`. Bounded cost if wrong: a payment near a term boundary lands one term out, which is exactly why `start_term` is a default rather than a generated column.
- ⚠️ **The footer is a quoted field spanning multiple lines**, so a `split("\n")` parser breaks on the last record of every file. `parseCsv` is a real tokenizer.
- **Rows with no `ID` are not transactions** — balance rows and the footer both. Skip on the empty id, never on line position.
- 🔒 The statement read was real financial data. Nothing from it is in the repo; the test fixture reproduces the *shape* with invented values.

**🐛 Two corrections to the spec, found while building:**

- **`scoreMemberCandidates` does not exist.** The spec names it for phase 2's ranked suggestions; the real exports are `scoreMemberMatch` and `rankMemberSuggestions` in `lib/attendance.ts`.
- 🪤 **"Tokenize on whitespace *and punctuation*" is wrong**, and the test caught it. Splitting on punctuation breaks `rp-8571` into `rp` and `8571` and matches neither — destroying the very thing `members.normalized_eid` strips `-` for. Split on **whitespace only**, then strip punctuation *within* each token. Accepted consequence: `rp 8571` with a real space does not match, which is correct — two words are genuinely ambiguous and "don't auto-resolve near-misses" says queue it.

### ✅ Phase 2 — the import (2026-08-06)

- [x] **`/admin/dues/import`, two steps, CSV text held in the browser between them.** `FileReader` in `import-form.tsx`; the text lives in component state and nowhere else. 🔓 No staging table, no temp file — a statement is every dues transaction for a month.
- [x] **`commitImport` re-parses server-side and does not accept the preview's output.** Both actions call one shared `planImport`, so the commit runs the identical code path the preview did and cannot diverge from what the officer was shown; the only thing it adds is the write.
- [x] **A Server Action, not a Route Handler.** ⚠️ Next caps a Server Action request at **1MB by default** — confirmed in the shipped docs, not assumed — so `MAX_IMPORT_BYTES` (512 KB) sits below it and the officer gets a sentence naming the limit instead of an opaque framework error. `MAX_IMPORT_ROWS` is 2000. Both **refuse; neither truncates**.
- [x] **Flagged May–July payments** via `isSummerTerm`, as a warning only — the rows import with `start_term = term_of(paid_at)` and phase 3's detail page corrects them. 📌 **Decided 2026-08-06:** a per-row override in the preview was rejected because it would make the preview an *input* to the commit, which is exactly what the re-parse rule exists to prevent.
- [x] **Nav entry added** — "Dues" pointing at `/admin/dues/import` until phase 3 builds the ledger. `startsWith` marks it active for every `/admin/dues/*` path, which is wanted here (unlike the `members/fields` case, where a second entry would have lit two).
- [x] 🔓 **The write is `.upsert(..., { onConflict: "venmo_txn_id", ignoreDuplicates: true })`** — the first use of upsert in application code, and justified in the header: it makes "re-importing is a no-op" a **database** guarantee rather than an app-level pre-check a concurrent import could race past. The `.select()` then returns only the rows actually inserted, so **requested − returned is the duplicate count** with no second query and no window for the two to disagree. The pre-flight probe drives the *preview's* number only.
- [x] **`lib/dues-roster.ts`** — an uncapped `{memberId, normalizedEid}` roster. ⚠️ **NOT `fetchMemberOptions`**, for three reasons the header records: it caps at `MEMBER_SCAN_LIMIT` (a picker's payload bound — matching against a truncated roster reports `unmatched` for someone who *is* on the roster, which is silent truncation landing on money), it filters `active.eq.true` (a deactivated member can still have paid), and it never selects `normalized_eid` at all. 🪤 **But uncapped ≠ one unbounded request** — the hosted project applies its own `max_rows`, so it pages in chunks of 1000 like the export. A failed read returns a discriminated `error` rather than `[]`, because an empty roster and a failed one are indistinguishable to the caller and the difference marks a whole statement unmatched.

**📌 Two deliberate divergences from the spec, both recorded there too:**

- **One audit row per PAYMENT, not one receipt per import.** The spec asked for a single receipt carrying the batch id, file name and counts. The house invariant is *"one audit row per adjustment — the entity is the adjustment, not the grant"*; per-payment rows are what makes phase 3's payment-detail `AuditTrail` work, and `import_batch_id` on the row already answers "which upload was this" without a second row. Batch context travels in `note`.
- 🐛 **`AuditEntityType` was missing `'dues_payment'`** — migration 19 widened the SQL check and phase 1 never widened the TypeScript union. That is the **second** time this exact drift has happened (the first was `'roster'`, and the file's own comment warns about it). Caught before any row was written. Treat widening the check and widening the union as one edit.

### ✅ Phase 2 — walked through a browser 2026-08-06 · **two defects found**

Driven against the **local** stack as `dev@example.edu`, with a hand-built fake statement carrying one row of each decision-table outcome plus the real export's shape (line-3 header, leading empty column, an id-less balance row, a multi-line quoted footer, an outgoing transfer, a pending payment).

- [x] Preview reported **6 new / 0 recorded / 3 need review / 4 not payments**, and every row classified correctly: matched·1 term, matched·2 terms, `AMOUNT NEEDS A DECISION` ($42), `NO MEMBER IN THE NOTE`, `NAMES TWO MEMBERS`, and the June row flagged `(Spring)`
- [x] The multi-line quoted footer and a comma inside a quoted note both parsed cleanly — the two things a `split("\n")` parser gets wrong
- [x] Commit → `6 payments recorded. 3 still need an officer to resolve.`; database showed **members unchanged at 32** (the §4.2 guarantee), 6 payments, 6 audit rows, note `imported from "…csv" — 6 of 6 new`
- [x] Re-uploading the same file → **0 new / 6 already recorded**, every row greyed, the commit button disabled and reading `Import 0 payments`, with "Everything in this statement is already recorded". Database unchanged, which also proves **preview writes nothing**

🐛 **Defect 1 — `start_term` was taken from the import time, not the payment date.** The preview told the officer a June payment counted as **Spring** and the stored row said **Fall**: the UI and the database disagreeing about the same payment.

Root cause is in the DDL and could not have been fixed there. `start_term`'s default is `term_of(now())` while the column's own comment claims `term_of(paid_at)` — and **a Postgres column default cannot reference another column**, so the default can only ever ask "what term is it now". Those differ for *every statement uploaded after a term boundary*, which is the ordinary case, not an edge one. Fixed by setting `start_term` explicitly from `termOf(payment.paidAt)` — a new mirror of the SQL function in `lib/dues.ts`, so the term is still **derived** rather than typed (§4.7). Pinned by three pure tests including the Central-anchoring case.

🐛 **Defect 2 — "Import another statement" did nothing.** `useActionState` has no reset, so `commit.status` stays `"done"` forever; the button cleared the held text while the Done panel kept rendering and the file chooser stayed hidden. Fixed with a `dismissed` flag un-set whenever the action speaks again — the render-phase derived-state idiom already used in `grant-form.tsx` and `directory-row.tsx`, not an effect.

📌 **Both are the same shape of bug and worth generalising: a default that cannot express what it means, and a state machine with no reset.** Neither is reachable by a unit test — the first needs the clock and the database to disagree, the second needs a second interaction after a success.

### ✅ Phase 3 — the ledger and the editor (2026-08-06)

**No migration.** Migration 19 already carried everything: `dues_payments_review_idx` is a partial index on exactly the queue's predicate, and the three `dues.*` correction verbs went into `AuditAction` with the import.

- [x] **`/admin/dues`** modelled on `/admin/points`: state (needs review / live / voided / everything), term, member, date range. Needs-review count in the header as its **own `head: true` count**, because behind a filter it would answer "how many of the rows you are looking at need review", which is not the question.
- [x] **`/admin/dues/[id]`** — reassign, correct `start_term` and `terms_covered`, void with a reason, shared `AuditTrail`. CAS on `updated_at` as the **raw PostgREST string**.
- [x] **Ranked suggestions on unmatched rows, nothing preselected.** 📌 The spec's `scoreMemberCandidates` still does not exist (phase 1 already recorded that); the real exports are `scoreMemberMatch` / `rankMemberSuggestions`. `rankPaymentSuggestions` in `lib/dues.ts` is a new **caller** of them.
- [x] Date range filters **Central-anchored and half-open**, copied from the awarded-date range in `points/page.tsx`.
- [x] Both sides of every audit before/after select the **same column list** — and `updated_at` is stripped from **both** by `auditable()`, so the diff neither prints `t1 → t2` on every save nor invents a `→ —`.
- [x] **Nav re-pointed** from `/admin/dues/import` to `/admin/dues`; the ledger links on to the import.
- [x] **`describeReason` lifted out of `attendance/[id]/_components/suggestions.tsx`** into `lib/attendance.ts` as `describeMatchReason` — two screens render suggestions now, and the same reason must read the same way in both.

**📌 Two actions, where the spec named three — and the reason generalises.** `assignPayment` + `setPaymentTerms` shipped as one `savePayment`. `dues_payments.updated_at` is a **row**-level token, so two forms on one page would each hold their own copy: the first save moves it and strands the second, and the officer's next edit reports a phantom conflict. That is the `directory-row.tsx` defect, and building it deliberately would be a strange way to honour the lesson. Only the audit verb branches — `dues.assigned` when `member_id` actually moved, `dues.updated` otherwise. `voidPayment` stayed separate and carries **no** CAS token, matching `voidAdjustment`: voiding is one-way, so `.is("voided_at", null)` is a complete guard rather than an approximation.

**📌 `paymentReviewState` deliberately says less than the parser did.** `unmatched` and `ambiguous` are two parse outcomes and one storage outcome — nothing persists which happened — so the ledger reports **"no member"** for both rather than inventing a distinction the row cannot support. It also keeps voided rows out of the queue entirely: they count for nothing and no officer action will change that, so leaving them there would be work that can never be finished.

**📌 `startTermOptions` keeps §4.7 true through a POST.** The picker's options are stepped off `termOf(paid_at)` by term index (one back, two forward — enough for the summer override and a midnight-boundary miss), and the action re-checks membership of that list rather than trusting what arrived. It appends the row's stored value when that sits outside the window: ⚠️ a `<select>` whose value matches no `<option>` renders **blank**, so the row would appear to hold nothing and the next save would rewrite a real value — the orphaned-custom-field-option lesson in a new place.

### ✅ Phase 3 — walked through a browser 2026-08-06 · **one defect found**

Driven against the **local** stack as `dev@example.edu`, with a hand-built statement in the real export's shape carrying one row of each decision-table outcome. ⚠️ Its payments are dated **February 2026** on purpose: at the time the seed pinned `current_term()` to `Spring 2026`, and a payment outside the current term covers a term the directory is not scoped to, so every Paid/Not Paid assertion would have read as a bug. 📌 **The seed moved to Fall 2026 later the same day and the pin is gone** — the rule is unchanged but the dates are not, so a fixture rebuilt from this log now belongs in **Aug–Dec 2026**. The `Spring 2026` values quoted below are what was on screen then.

- [x] Preview **6 new / 0 recorded / 4 need review / 4 not payments**, every row classified correctly, including a quoted note containing a comma and the June row flagged `(Spring)`
- [x] Ledger: **4 payments need an officer** in the header, 6 rows newest-first, `Covers` reading `nothing yet — from Spring 2026` on the undecided row
- [x] The unmatched `bk2857` row suggested **Bela Kovacs · EID off by 1**, with nothing preselected — the exit-criterion case, and the payer name `B K` contributed nothing, so the hit came purely from the note token
- [x] Assign → `dues.assigned`, audit diff showing **only `member_id`**, and `member_directory.dues_paid_current_term` flipped to true
- [x] Decide the $42 amount → `dues.updated` (verb branch confirmed), diff showing only `terms_covered` and `covered_terms`
- [x] 🪤 **The summer override, end to end**: correcting a June payment's `start_term` from Spring 2026 to Fall 2026 moved its coverage to `Fall 2026, Spring 2027` and correctly **dropped that member off the current-term Paid list**
- [x] Void with a reason → VOIDED badge, editor replaced by a read-only summary, `dues_paid_current_term` back to false, diff showing only `voided_at` and `void_reason`
- [x] **Conflict**: another officer's write simulated by SQL, then SAVE → *"Someone else changed this payment while you had it open"*, and the officer's picks survived the failed save
- [x] **Re-import the same file** after resolving and voiding → **0 new / 6 already recorded**, the voided row still voided. Members unchanged at 32 throughout (§4.2)
- [x] Signed out `/admin/dues` → 307; an unknown id while signed in → 404
- [x] Fixture payments deleted afterwards (`venmo_txn_id like 'WT3-%'`); local `dues_payments` back to 0

🐛 **Defect — the editor's selects reverted after a successful save, and it is a DATA-LOSS path.** Assigning Bela Kovacs saved correctly and the banner said so, but the dropdown immediately read **"Nobody yet"** while the database held the new value. The officer reads that as a failed save, and the obvious next move — press SAVE again — posts the empty option and genuinely **unassigns** the member they had just credited.

Cause: the selects were written with `defaultValue`, and React 19's post-action form reset beat the revalidated props. **`member-field-cell.tsx` already carries this exact warning in its header** ("Controlled, not defaultValue… the officer sees their pick undone and picks again") and it was written anyway. Fixed by making all three selects controlled with the reset-during-render resync idiom, seeded from the action's echo so a pre-hydration round trip still works. 📌 Pinned as a **source assertion** in `tests/dues.test.ts` rather than left as prose, because the failure is a client-side timing window no behavioural test in this suite would catch — and because the prose version demonstrably did not hold.

📌 **Also corrected in passing:** `AUDITED_PAYMENT_COLUMNS` omitted `imported_by` and `voided_by`, where `AUDITED_ADJUSTMENT_COLUMNS` carries both. Added to both dues literals; the source assertion checks only that the two differ by `updated_at`, so it kept passing either way — which is worth knowing about what that assertion does and does not cover.

### ✅ Phase 4 — the directory column (2026-08-07) · **Stage 6 exit criteria MET**

**No migration.** Migration 19 appended `member_directory.dues_paid_current_term` back in phase 1 and nothing had read it until now, so the schema stayed at `…000019` on both sides.

- [x] **`MemberFilter` gained `dues: "all" | "paid" | "unpaid"`**, shaped like the existing `state` selector, translated in `applyMemberFilter` and nowhere else — so the page, the CSV, the xlsx and the clipboard all inherit it with no second code path.
- [x] `dues` joined `MEMBER_SORTS` as the fifth built-in. The column renders **Paid / Not Paid** — two words, no coverage detail, and **read-only**.
- [x] The detail page shows every payment credited to the member (voided included) and what they are paid through, via `paidThroughTerm`.
- [x] Dues added to the export field catalogue — **one entry**, keyed `dues`, not a new mechanism.
- [x] **Stage 6's exit criterion demonstrated against the real column** — see the walkthrough below.
- [x] Browser walkthrough, driven against **local**.

**⚠️ The filter defaults to `all` where `state` defaults to `active`, and the asymmetry is the design.** Dues must not narrow the roster until an officer asks: a directory silently missing its unpaid members is the phase-1 defect (a count nobody can account for) landing on the one column with money behind it.

**⚠️ The cell is read-only, and that is what the three reserved keys are for.** An inline `<select>` here would be precisely the hand-ticked "Paid Dues" dropdown migration 19 forbids, and the roster would carry two answers to one question with nothing to say which is right.

**📌 `dues` is a BUILT-IN sort key, not a `cf:` one**, because the *view* calculates it — nothing about it is officer-defined. It joined `DESC_BY_DEFAULT` beside `total_points`: descending on a boolean is true-first, so picking the column opens on who has paid, and the existing `full_name` tie-break orders each half.

**🪤 `paidThroughTerm` (in `lib/dues.ts`, not `lib/members.ts`) is where the lexicographic trap would return.** It takes the max over the **term index** — never `max(term)`, never `order by term`, never `<` on a term string. It lives in `lib/dues.ts` because that module is the one place term ordering is expressed, and this is the only screen that asks "which of these terms is latest" about a real member. Voided payments and undecided amounts contribute nothing, so the failure direction stays *under*-reporting, which the review queue makes visible.

**📌 The export cell is TEXT, deliberately.** "Paid" / "Not Paid", the same two words the directory prints, so a spreadsheet and the screen cannot be read as saying different things. Text rather than a number because the CSV formula guard fires on text and must never fire on numbers — the `bonus_points: -5` rule from the other side. 🔓 And it is **not** in `DEFAULT_EXPORT_FIELDS`: payment status leaves the building only when someone ticks it (§6).

### ✅ Phase 4 — walked through a browser 2026-08-07 · **no application defect**

Driven against the **local** stack as `dev@example.edu`, with a hand-built statement in the real Venmo export shape (header on line 3 with a leading empty column, `- $18.50` sign as a separate token, quoted multi-line footer, non-transaction rows identified by an empty `ID`). 📌 Dated **September 2026** — inside Fall 2026, per the rule that a fixture outside the current term makes every Paid/Not Paid assertion read as a bug.

- [x] Preview **5 new / 0 recorded / 2 need review / 4 not payments**, every row classified correctly — including `DUES AO4471` matching through the `lower()` fold and the bank transfer skipped as not incoming
- [x] The column renders; **Eli Rosenberg reads NOT PAID while holding a $42 payment**, because the amount matched no configured price and nobody has decided what it bought — the whole point of the nullable `terms_covered`
- [x] Filter → `?dues=paid` gives **3 matching**, `?dues=unpaid` gives **26** (29 active − 3), CLEAR appears and the count always accounts for what is on screen
- [x] Sort → **Paid first**, then the `full_name` tie-break within each half
- [x] 🪤 **The `memberFilterUrl` re-parse trap, on the new field**: from `?dues=paid&sort=total_points`, typing in the search box produced `?dues=paid&q=osei&sort=total_points` — both survived, which is the failure that killed a `cf:` sort on every keystroke once already
- [x] Detail page, 2-term payment: **"Official for Fall 2026. Paid through Spring 2027."** with Covers reading `Fall 2026, Spring 2027`
- [x] Detail page, undecided payment: **"Not paid for Fall 2026. No payment covers a term yet."** with the row reading `nothing yet — from Fall 2026` — and the $42 still visible, because nothing that arrived as money is dropped on the floor
- [x] Central wall time held: `2026-09-03T19:22:00` in the CSV stored as `2026-09-04T00:22:00+00:00` and displayed **Sep 3, 7:22 PM CT**
- [x] **Void → the directory takes membership away**: Bela Kovacs off the Paid list, `dues_paid_current_term` false, paid count 3 → 2
- [x] ✅ **THE EXIT CRITERION**: Not Paid → header checkbox → **"All 26 matching selected"**, the export URL carrying **0 `ids` params in 101 characters** → COPY EMAILS → **"Copied 26 addresses"** against 26 rendered rows
- [x] The `roster.exported` receipt: `scope: filter`, `filter: dues=unpaid`, `rowCount: 26`, and **`fields: ["email"]`** — one field, not the four ticked in the picker, which is `exportedFields` recording what actually left rather than what was requested
- [x] A second export with Dues ticked recorded `fields: [name, email, eid, total_points, dues]` — the new entry reaching the receipt for free
- [x] Fixtures deleted afterwards (`venmo_txn_id like 'WT4-%'`); local `dues_payments` back to **0**, members unchanged at **32** throughout (§4.2)

📌 **The second phase in this stage to come through clean**, and for the same reason phase 4 of Stage 6 did: the hazards were written down before the code was. The three that would have bitten — the default-narrowing filter, the read-only cell, and the term ordering — were each designed against explicitly and then checked head-on. ⚠️ This still does not argue for dropping the walkthrough; it argues that writing the traps down first is what survives it.

🪤 **Worth knowing for the next walkthrough, and not an application fault:** the browser's renderer froze on `Page.captureScreenshot` several times and hung outright on a `navigator.clipboard.readText()`. Every time, `curl` against the dev server answered instantly and the database held the right values — the corollary already recorded in CLAUDE.md, arriving through the automation harness rather than through an EPIPE'd dev server. **Check the server before believing the screen**, and verify a clipboard action by its audit receipt rather than by reading the clipboard.

### 🪤 Traps specific to this stage

- 🪤 **Dedupe on the transaction ID or not at all.** Amount + date + payer is not unique — two members can send $30 in the same minute — and a fingerprint that collapses them loses a payment somebody can prove they made.
- 🪤 **The unique index must span voided rows.** Re-importing a statement whose payment an officer already voided has to stay a no-op, not resurrect it.
- 🪤 **Terms do not sort lexicographically.** `'Fall 2026' < 'Spring 2026'` is true as a string compare and false as a calendar fact. Every "which term is later" question goes through `termsFrom` ordering — never `max(term)`, never `order by term`. Same class of error as `new Date("2026-09-01T18:00")`: plausible output, wrong answer, no error anywhere.
- 🪤 **`create or replace view` still only appends**, and a drop re-opens the anon hole.
- 🪤 **Prices are read at import time, not at read time.** `terms_covered` is stored, so raising dues never rewrites last year's payments — and re-importing an old statement after a price change would land differently, which is one more reason the dedupe has to hold.
- 🪤 **An undecided row must cover nothing.** `covered_terms` generated from a nullable `terms_covered` is what makes the failure direction *under*-reporting membership (visible in the queue) rather than over-reporting it (visible nowhere).
- 🔓 **Never persist the uploaded file.** It is every dues transaction for a month in one blob. Parse it, keep the rows, discard the text — which is also why the preview holds it in the browser rather than in a staging table.
- 🔓 **Payment notes are member-supplied text** and reach the officer's screen and any export that includes them. Same formula-injection blast radius as member names; same escape, same writer.
- ⚠️ **A payer who writes someone else's EID credits the wrong person, silently** — the Stage 6 "valid-but-wrong EID" failure through a second door, and worse here: the victim reads as unpaid, the beneficiary as paid, and neither has a reason to check. The payer's Venmo name is stored partly so a name mismatch is at least *available* to flag later.
- ⚠️ **The overlapping-statement test is the headline test, and a demo will not exercise it.** Import, import an overlapping second, assert the row count rose by exactly the number of genuinely new transactions. Its failure mode is silently double-counting somebody's dues.

## Done — Stage 7: Member-facing views (closed 2026-08-09, both phases)

*Goal: members can answer their own questions. ✅ **Exit criteria met** — a member can determine their own standing, why it is what it is, which specific events they missed, and whether anything of theirs is still pending, without asking an officer. Demonstrated end to end in a browser. Two phases, each merged to `main` on completion.*

### Phase 1 — `/leaderboard` ✅ built 2026-08-09 (doc v1.50, **migration 21**)

The page is 200 lines and was never the hard part. What it turned up was.

- 🔓 **`app_settings.current_term` — the pin §4.4/§4.7/§9 #4 all document — has never worked for any caller subject to RLS.** `current_term()` was `stable` and invoker-rights, and it reads `app_settings`, which is deny-all with zero policies: the subselect returns nothing, the `coalesce` falls through, and it silently answers with `term_of(now())`. **Measured with the pin at `Spring 2026`** — service role saw Spring 2026, `authenticated` and `anon` both saw Fall 2026. Not just the label: **the rows too**.
  - 🪤 **"The view runs as its owner" is true and does not reach this.** `security_invoker = false` covers the tables a view names *directly*. A plain function called from inside the view still executes as the invoker. Same shape as migration 15's lesson — checking the table proved nothing about the view over it; here, checking the view proves nothing about a function it calls.
  - **Latent since migration 1 and harmless until this phase**, because every admin screen reads through `createAdminClient()` and `leaderboard` had **no reader at all**. That is exactly why it was Stage 7's to fix: it lands on the first anon-facing term-scoped page in the project.
  - Fixed with `security definer` + `set search_path = ''` (mandatory on a definer function — otherwise the caller controls name resolution inside a body with owner rights). An RLS policy on `app_settings` was the alternative and is looser: migration 12 grants anon everything and only RLS withholds it, so a policy would have exposed `updated_by` and `updated_at` too. **`current_term()` must stay `stable`, never `immutable`.**
- **`term` appended to `leaderboard`** so the heading and the rows come from one query and cannot disagree. Append-only, so grants survive and the migration deliberately restates none — a reader hunting the re-grant finds a note saying why there isn't one. `tests/security.test.ts`'s exact-column assertion went to four names **in the same commit**, as a privacy decision rather than a red test to fix.
- 🪤 **Stage 5's revalidation carry-forward was resolved by NOT following it.** It said to add `/leaderboard` to `revalidatePoints`. Five modules move public standings — `points.ts`, `attendance-review.ts`, **`attendance.ts` (a live check-in writes a `present` row and revalidates nothing at all today)**, `events.ts`, and `member-merge.ts`, which already called `revalidatePath("/leaderboard")` against a route that did not exist. `force-dynamic` deletes the surface instead of policing five call sites. The dead merge call is gone and `revalidatePoints`' comment now says adding a path there means changing that line first.
- **Standard competition ranking** (1, 2, 2, 4), computed in the page — the view's alphabetical tie-break decides print order, not placement. Verified in the rendered HTML: a four-way tie at rank 25 and a five-way at rank 16, alphabetical within each.
- **An all-zero board explains itself.** The view LEFT JOINs every active member, so a term with no points yet renders the whole roster tied at zero and tied at rank 1 — accurate, and it reads as broken. A note above the table says so. Reachable in early August (§4.4) and immediately whenever the board is pinned to a term that has not started.
- **Verified in a browser against the local stack**: 200; `<meta name="robots" content="noindex, nofollow">` present; 29 rows; heading and rows both moving to Spring 2026 under a pin and back; a +100 grant and a deactivation each reflected on the very next request with no revalidate call anywhere. Local DB confirmed back at seed values afterwards (32/29/15/208/6/29, unpinned).
- 📌 **Two loose ends held for phase 2 deliberately**: `/leaderboard` carries a comment where the `/lookup` link belongs, and the nav has no "My Attendance" entry. Each phase deploys, so linking them now would ship a 404 to production for a phase.

### Phase 2 — `/lookup` ✅ built 2026-08-09 (doc v1.51, **no migration**)

`lib/lookup.ts`, `lib/request-ip.ts`, `app/actions/lookup.ts`, the page and its form.

- 🔓 **The gate is a CONJUNCTION in ONE query, and the obvious reuse would have broken it silently.** `findMember` in `lib/checkin.ts` is an ordered *fallback* — EID, then email — because a check-in must forgive one mistyped field. Copying that shape here resolves on either half alone, reducing the one page that shows **dues status** to the EID-only oracle §6 accepts solely for check-in. `findMemberByBoth` runs one query with both predicates, never `.or()`. Two behavioural tests (right EID + wrong email; two halves belonging to two *different* real members) and a source assertion exist purely to fail if someone makes it "more forgiving". `escapeIlike` on the email side keeps a `%` a literal rather than a wildcard past half the gate.
- 🔓 **One `unmatched` and one message for every miss.** "No such EID" versus "that email doesn't match" is a *strictly stronger* oracle than the accepted one — confirm the EID, then walk the email — on the most sensitive surface in the system.
- 🔓 **No identifier is returned that the caller did not supply.** Name and own aggregates yes, stored email and EID no; §6's rule then holds by construction. Asserted on the serialized profile, and confirmed live (`pn8571` and the email appear nowhere in the rendered result).
- **The one unauthenticated READ path**, single-export like `attendance.ts` (the one WRITE path). It writes exactly one row anywhere: the throttle record, in **its own bucket** — `RATE_LIMIT_MAX` is a *room capacity*, so a shared budget would let standings lookups crowd out check-ins behind a venue's NAT. `hashClientIp(scope)` was extracted so both endpoints derive the client identically. ⚠️ Switching `attendance.ts` onto it changed its hash input, so live throttle buckets reset once on deploy — a ten-minute window, harmless, but not a surprise worth rediscovering.
- **Voided adjustments are hidden**, and no `awarded_by` is returned. A struck-through line a member cannot act on generates the officer question this page exists to prevent; the officer ledger keeps the full record.
- 🪤 **The site header ran out of room and failed SILENTLY — the one real defect of this phase.** The wordmark is absolutely centred so the side groups cannot shift it, which also means nothing stops a group growing *underneath* it: the wordmark wins the z-order and the nav item just vanishes. Measured at 1646px — six items cleared it by **61px**, eight overflowed by **199px**, hiding "Leaderboard" behind the logo. Tightening the gap does not recover 199px. Fixed by splitting the nav across the wordmark (site pages left, member pages right) and moving the desktop breakpoint `lg` → `xl`; at 1024 the *original* six already collided, so this was pre-existing and the new links only exposed it. **Adding a nav item means re-measuring at 1280 and at a wide viewport.**
- **Browser-verified**: right EID + wrong email → one generic miss with both typed values still on screen (the React 19 reset); corrected to a case-folded `PRIYA.NAIR@Example.EDU` → 27 points split 17/10, 67% over 8 of 12, a 13-row grid marked attended/missed/upcoming, the +10 grant with its reason, the dues line; LOOK UP SOMEONE ELSE returns a clean form. Console clean — no React warnings, which is how the phase-7b defect surfaced. Row counts unchanged across the whole walkthrough; the only writes were 4 throttle rows.

## 🔨 Stage 8: Hardening & data integrity (in progress)

*Goal: trust the data enough to base decisions on it. Exit: reading the roster, writing attendance, granting points or altering an audit row directly with the anon key fails for every table. Three phases, each merged to `main` on completion.*

### Phase 1 — the database enforces its own rules ✅ built 2026-08-09 (doc v1.52, **migration 22**)

The stage exists because two defects of this exact shape already shipped (migrations 15 and 21). Phase 1 found a third and a fourth.

- 🔓 **A signed-in NON-OFFICER could read every member's name, EID and email.** `member_directory` was granted to `authenticated` by migration 15 — the same migration that revoked it from `anon` — on the understanding that the role means "an officer". It does not: `authenticated` is what any valid user JWT carries, and production had `disable_signup: false`, so it was one confirmed email away for anyone. Officer-ness is an `admin_profiles` row checked in `lib/auth.ts` — **application code PostgREST never runs**. Reproduced on the local stack *before* the fix (a signed-up user with no profile read back a real EID), then revoked. Costs nothing: every module touching member data uses the service-role client.
  - 📌 **The generalisable rule, and it is migration 15's one role over: checking `anon` proves nothing about `authenticated`.** Same shape as "checking the table proves nothing about a view over it" and "the view runs as owner does not reach a function it calls". Three variants of one mistake in three stages.
- 🔓 **`grant all` includes TRUNCATE, and RLS cannot restrain it.** RLS covers SELECT/INSERT/UPDATE/DELETE only, and `admin_audit`'s append-only triggers are BEFORE UPDATE and BEFORE DELETE — so the single statement that wipes the audit log slipped past both, while migration 12 handed the privilege to `anon`. Unreachable through PostgREST (no TRUNCATE verb, NOLOGIN roles), but migration 12's doctrine is false for that verb. Narrowed to `select`, plus a statement-level trigger behind it.
- **"Write every RLS policy" resolved to proving the empty set is correct.** 11 tables, all RLS-enabled, one policy. 33 modules read through the service role; four touch anon; **`lib/supabase/client.ts` has zero importers**. Policies nothing exercises are untested surface.
- 🪤 **The proof matrix was VACUOUS on its first draft and only breaking it on purpose showed it.** `insert({})` trips NOT NULL before permission matters, so "an error came back" passes straight through an open grant. Measured: no grant → `42501`; grant without policy → `42501`; grant **plus** policy with `{}` → `23502`; grant plus policy with a real payload → **201 Created**. Asserts `42501` now, and was re-run against a deliberately opened hole to watch it go red. **A guard never seen red is a guard nobody knows works.**
- 🪤 **`term_index()` is not a validator.** `term_index('Autumn 2026')` = **4052 = `term_index('Spring 2026')`** — the season arm files anything that is not literally `Fall` as Spring. It never returns null for a bad season; it returns a plausible wrong answer. The first version of the constraint used `term_index(x) is not null` and let `'Autumn 2026'` straight through. Checks the shape now.
- 🪤 **`_stage0_check` broke the table enumeration**, and the fix is worth knowing: `countOf()` used `head: true`, and supabase-js leaves `error` null for a missing relation under a HEAD request — so the "does this table still exist?" filter silently kept a table dropped by migration 10. Probe with a real row read.
- **Six older tables gained the constraints the two newest already had** (`lib/validation.ts:363-366`'s doctrine, never applied backwards): EID-folds-to-≥3 chars on `members` and `attendance` (a raw `-` folds to `''` and collides every such member into one phantom identity), `events.points` 0–100, the `events.category` enum, attendance's resolved-pair completeness, term shape, and text lengths. Each proved by SQLSTATE 23514 against the live database, Stage-1 style, and pinned in `tests/schema-integrity.test.ts`.
  - ⚠️ **The resolved-pair check nearly broke check-in.** A self-check-in leaves BOTH `resolved_at` and `resolved_by` null — auto-resolved against an open window with no human. The constraint is about the pair, never about status; a test pins that.
- ⚠️ **`force row level security` was deliberately NOT added.** It subjects the table *owner* to RLS, and migrations plus `seed.sql` run as `postgres`, which owns every table — the seed's wipe block would start failing. Consequence to state plainly: every "no client role can write X" claim is about API roles, not about whoever holds the database password.
- **New in `tests/helpers.ts`: `authenticatedClient()`, `signInAsOfficer()`, `signInAsOutsider()`.** The suite had three client constructions, all anon or service-role, and `security.test.ts` admitted in prose it could not reach `authenticated`. 📌 `getTestOfficer` used to mint a random password and throw it away; it uses a fixed local-only constant now, and resets it on the already-registered branch.
- **Verified in a browser after the grant narrowing**: signed in, all seven admin screens render with data and no error state, an inline custom-field edit and a roster export both wrote and audited correctly. Local back at seed values afterwards.

**📌 Config findings recorded but not changed** (they live outside the repo, so changing them would break §2.3's "recreate from the repo alone"): `enable_signup = true` with no product use — the only auth consumer is officer login, seeded by `create-officer.mjs`; `minimum_password_length = 6` while that script enforces 12, and the Auth server is the real authority; **MFA entirely off** on accounts that reach every EID, email and the export path; `max_rows = 1000` against `MAX_IMPORT_ROWS = 2000`; Storage and Realtime enabled and unused. ✅ One good property worth writing down: **revocation is effectively immediate**, because `getOfficer()` re-checks `admin_profiles` on every request.

### Phase 2 — attendance and adjustment export for archival ✅ built 2026-08-10 (doc v1.53, **migration 23**)

🔓 **The filter extraction was the phase; the export was the easy half.** The roster export is safe because `applyMemberFilter` is a *shared* translation — the route re-runs provably the query the screen counted. Points and attendance had no equivalent: predicates inline in the page bodies, each with **its own copy of the Central half-open date bound**. An export route would have been the third copy of rules that must agree. `lib/ledger-filters.ts` now serves both screens and both routes; the row window stays the caller's (screens cap at 200, archives must not).

- 📌 **Measured proof the shared bound is right:** `?to=2026-08-04` returns **170** submissions; a UTC-anchored bound returns **168**. Two seeded rows sit in the five-hour slice a bare `.lte()` silently drops.
- 🐛 **The extraction fixed a live 500.** Neither page validated `from`/`to`, and `centralWallTimeToInstant("yesterday", …)` does **not** return an Invalid Date — it throws at `lib/events.ts:99`. A hand-typed date on either ledger was a server error. Also tightened `?status=xyz`, which used to reach `.eq()` and match nothing — a filter narrowing with no control on screen.
- 🪤 **`.order("id")` is a TIE-BREAK on a chunked read, and it was missed on the first pass.** Rows tied on `submitted_at`/`awarded_at` have no defined relative order, so a tie straddling a `.range()` boundary duplicates one row and **drops another** — missing data in an archive. **Four ties per table in the seed alone**; a room checking in together, or one multi-member grant, makes them the normal case.
- 🪤 **`signedPoints` must never reach a spreadsheet.** U+2212 MINUS, not ASCII hyphen: the formula guard rightly ignores it and Excel rightly refuses to parse it as a number, so the column would be inert text that will not sum. Points go out as a typed number cell.
- 🐛 **The first real export exposed a defect no unit test would have caught.** `voided_date` was not in the default field set while the ledger's `state` filter defaults to `all`, so a voided +8 grant came out **byte-identical to a live one**. The screen has a strikethrough; a file does not. It is in the defaults now.
- ⚠️ **`parseFieldSelection` gained a `defaults` parameter.** It falls back by *filtering the catalogue*, so the member defaults against a ledger catalogue — no shared keys — would have produced a file with **no columns at all**. A test asserts every default key exists in its catalogue.
- 📌 **The archives carry more than the screens do**: attendance gains `resolved_at`/`resolved_by`/`resolution_note`; adjustments gain the void columns. That is what archival means.
- **UI**: `_components/export-controls.tsx` holds the presentational half (Download/Action/FieldPicker) now shared with the roster toolbar; `_components/ledger-export.tsx` is the ledger toolbar. 📌 Filter-only — no `useSelection`, no `ids`, no two-mode selection, because neither ledger has a selection model. Verified live: **zero `ids` params** in the export URLs.
- **Verified live**: counts match the screen at every filter; 1709 rows across two chunks with **1709 unique**; the 5000-row cap **refuses** naming the number rather than truncating; CSV guards a `=HYPERLINK` name and xlsx does not; a negative adjustment is a real `-2`; **403 "Forbidden"** past `proxy.ts` for a valid session with no `admin_profiles` row (the 307 an anonymous request gets is proxy, not the route's boundary).

### Phase 3 — error boundaries, loading and empty states ✅ built 2026-08-10 (doc v1.54, **no migration**)

- 🐛 **`lib/lookup.ts:250-253` is the defect to fix first** — see the cold-pickup table. Public-facing, shipped in Stage 7 phase 2.
- The five admin *list* pages already distinguish error from empty correctly; the swallow is on **detail pages and `lib/` helpers**. `members/[id]:130-132` tells an officer a member never paid when the dues query failed; `members/[id]:111-113` and `events/[id]:49-60` turn a *failed* query into `notFound()`.
- ⚠️ **Read `node_modules/next/dist/docs/` first** — `error.tsx`'s prop is `unstable_retry`, not `reset`; `global-error.tsx` must render its own `<html>`/`<body>` and gets no `globals.css`; `forbidden()`/`unauthorized()` are experimental. And 🪤 `error.tsx` does **not** wrap the layout in its own segment, so `app/admin/(shell)/error.tsx` cannot catch a throw in `AdminShellLayout` — that needs `app/admin/error.tsx`.
- Zero `Suspense` anywhere in `app/`; no shared `EmptyState`/`ErrorState` component (the same class string is copy-pasted ~15 times).

## Capacity ceilings — the constants that break before the bills do

From the worst-case check run 2026-08-02 (doc v1.31, §2.2): **500 registered members, 3 events a week, 150 attendees each.** No service tier needs upgrading at that size and it is not close — ~7 MB of attendance a year against a 500 MB database, and Supabase MAU stays at ~13 officers because members have no accounts. What breaks is application constants, none of which announce themselves.

**Not scheduled into a stage on purpose.** Each is cheap and each is triggered by growth rather than by a phase, so the trigger is written next to the work. Re-run §2.2 whenever the roster or the event cadence changes materially.

- [ ] 🔴 **Raise `RATE_LIMIT_MAX` (`lib/checkin.ts`) before the first event expecting more than ~90 attendees.** 90 per IP per 10 minutes, and a venue's WiFi is one IP: the 91st person is refused, or the 46th at a recruiting event where first-timers spend two slots. A one-constant change — the decision is what number, not how. Size it at the largest room the org books, with headroom for the confirmation pass. **It is a room capacity, not a security control** (the honeypot and the 48-hour window are the actual bounds), so do not talk yourself into a small number on abuse grounds.
  - Worth doing at the same time: the throttle message currently reads as a generic refusal. Someone turned away at a check-in table needs to know it is the venue's network and not their EID, or they will retry into the same wall and then give up.
- [ ] 🔴 **Build the `pg_trgm` growth path before the active roster reaches `MEMBER_SCAN_LIMIT` (400).** Not after: past it, `fetchMemberOptions` and the near-miss candidate scan silently take a subset, and the candidate query in `attendance/[id]` does not order, so it is an *arbitrary* subset. An officer sees "that member isn't in the list", which reads as a data problem rather than a limit. Three pickers and the ranker are affected.
  - 🔴 **Stage 6 phase 8 added a fifth caller, and it is the sharpest of them: the merge picker.** The other four truncate a list of people an officer is *choosing among*, so the cost is "I cannot find them, let me search another way". This one truncates the list a **duplicate has to be found in** — past the cap a duplicate is neither suggested by the ranker nor selectable from the picker, with nothing on screen to say so, and merging is the only way to clean one up. `fetchMergeCandidates` also deliberately includes inactive members (a ghost is usually the deactivated half of a pair), so it reaches 400 sooner than the active-only pickers do.
  - The scan exists because `ilike '%jon%'` cannot match `John` — do not "fix" this by switching to probes, which is the failure the scan was chosen to avoid. Trigram similarity is the option that keeps `Jon`/`John` reachable.
  - ⚠️ Enabling an extension is a migration, and the near-miss ranker's calibration is empirical (see the stage traps) — a changed candidate set means re-checking the seeded distance-2 cluster still renders no suggestions.
- [ ] 🟡 **`fetchEventOptions` caps at 100 events**, and phase 6 gave it a fourth caller — the directory's event filter. At three events a week that is under a year, after which the oldest event silently drops off every picker with no error. It is the `MEMBER_SCAN_LIMIT` shape (a quiet omission, not a refusal) but far less sharp, because the events an officer filters on are recent ones. Raise it, or order-and-paginate the picker, before the second year of events accumulates.
- [ ] 🟡 **`MAX_GRANT_MEMBERS = 50`** makes crediting a 150-person event three grants. It refuses rather than truncating, which is correct, so this is friction to fix when it annoys someone — not a defect.
- [ ] 🟡 **Re-calibrate the near-miss floor as the roster grows.** EIDs are name-derived, so the distance-2 near-miss population scales with membership and `MIN_SUGGESTION_SCORE` carries more load at 500 members than at 32. Empirical, against a roster of the size in question.
- [ ] 📌 **Comments corrected in this pass, no behaviour change:** `MEMBER_SCAN_LIMIT` claimed a fallback to "bounded ILIKE probes" that was never built, and the candidate query's missing `.order()` is now noted as a consequence rather than left to be read as an oversight. A comment describing an intention as though it were behaviour is how a silent truncation stays unnoticed for a year.

---

## Open items carried out of Stage 6 (re-filed 2026-08-08, phase 9)

Collected here rather than left scattered across three files. Each has a **trigger** — the thing
that should make someone pick it up — because an undated "later" is how these get lost.

- [ ] 🔓 **`/admin/audit` is still `ready: false` in `admin-nav.tsx`, and Stage 6 made that harder to justify.** The stage added five verbs — `roster.exported`, `preset.created/updated/deleted`, `member.imported`, `member.merged` — and one of them is unreachable by design: **a `member.merged` row is the ONLY surviving record of a deleted member**, because the loser's own history is keyed to an id with no row and no page behind it. Today the sole way to read it is SQL.
  - **Trigger:** the first time anyone asks "what happened to that member?" about a merge, or Stage 7, whichever comes first. §5 already lists the route and marks it NOT BUILT.
  - The per-entity `AuditTrail` on each detail page still covers "what happened to *this* row", which is the common question. What is missing is the cross-entity query §4.2 describes — and now, the orphaned-entity one.
- [ ] 🪤 **The seed expires on 1 January 2027.** `current_term()` becomes Spring 2027, every seeded event falls out of scope, and the leaderboard and directory go empty **with nothing on screen to explain why**. That is `seed.sql` needing its dates moved forward a term, not a bug.
  - **Trigger:** the date, or the first "why is the leaderboard empty" after it. One-afternoon workaround: `update app_settings set current_term = 'Fall 2026';`
  - Worth doing at the same time: the twelve completed events are compressed into 1–5 August because that was the only elapsed part of Fall 2026. Spread them back out.
- [ ] 📌 **`/admin/dues/[id]` has never been confirmed live by response**, and cannot be from here: production holds zero payments, so the only id available is invented, and it renders the generic `404: This page could not be found.` — **byte-identical to what a route that does not exist returns.** Do not record it as verified on the strength of a 404.
  - **Trigger:** the first real Venmo statement imported into production. It closes for free.
- [ ] 📋 **Manual dues entry — a way to record a payment that did not come through Venmo** (requested 2026-08-15; plan in [`docs/dues-and-membership.md`](docs/dues-and-membership.md) under *Planned — manual dues entry*, route listed NOT BUILT in §5).
  - **Trigger:** the first member who pays in cash — realistically the first meeting of the term, so this is a launch-adjacent item rather than a someday one.
  - **It records a payment ROW, never a status flag.** `dues_paid_current_term` keeps deriving, and the edit/void/audit paths come for free. 🔓 The toggle version is unbuildable by design — migration 19 reserves `dues`, `dues_paid` and `dues_paid_current_term` as custom-field keys.
  - **One migration**, relaxing four columns that assumed Venmo: `venmo_txn_id` nullable with a **partial** unique index (still spanning voided rows) plus a `source` column, `import_batch_id` nullable, `imported_by`/`imported_at` kept and re-documented. ⚠️ **A comped membership is out of scope** — that is `amount_cents = 0`, a different concept, and must not ride in on a relaxed CHECK.
- [x] ✅ **Check-in location verification — BUILT 2026-08-22** (requested 2026-08-19; spec [`docs/checkin-location-verification.md`](docs/checkin-location-verification.md)). Migration **28**, one new table, **no new route** — a pill on the event's attendance list plus a checkbox on the event form.
  - ✅ **The blocking question is closed, favourably.** Vercel *"overwrite[s] the X-Forwarded-For header and do[es] not forward external IPs… to prevent IP spoofing"*, and supplying your own needs the Enterprise Trusted Proxy add-on. `clientIp()` prefers `x-vercel-forwarded-for` anyway — identical value, but the one a proxy in front of Vercel could not overwrite. ⚠️ That makes the **header** unforgeable; joining the venue wifi still defeats the check completely.
  - 🔓 **It never stores an IP.** `sha256(PEPPER || event_id || normalize(ip))` plus a four-value network label. `tests/checkin-origin-capture.test.ts` sweeps the whole table for anything IP-shaped and asserts zero.
  - 🔓 **Per-event toggle, default true, flippable AFTER the event** — capture runs on every check-in regardless, so the toggle gates *derivation*, not collection. That is what makes it retroactive, and it is why `/attend` now discloses the capture in one plain sentence.
  - ⚠️ **Cellular is never flagged** (officer's call). It removes the largest false-positive class and is a **documented public bypass** — turn off wifi, never get flagged. Correct only while this is advisory.
  - ✂️ **§6's rotating per-event venue code is DROPPED**, per the same decision. This replaces it.
  - 🪤 **The carrier table could not be hand-written, which the plan assumed it could.** Measured, the carriers announce **~6,300 IPv4 prefixes** (AT&T Mobility 1,633; Verizon's Cellco 3,842; T-Mobile 538) against UT's 8. `scripts/build-network-table.mjs` generates `lib/network-prefixes.generated.ts` from RIPEstat; merging collapses them to 137 v4 + 32 v6 ranges in a 7KB committed file. Zero runtime dependency, zero request-time network call.
  - ⚠️ **UT announces NO IPv6 (AS18 is eight IPv4 prefixes), so `CAMPUS_V6` is empty** — which is why `classifyNetwork` returns `unknown` rather than `other` for an unmatched IPv6 address. Calling it `other` would flag a member sitting in the room over a gap in a table. Self-corrects if UT's v6 space is ever found and added.
  - 📌 **Two things deliberately NOT done**, both flagged rather than silently skipped: the pill is **not** on the `/admin/attendance` queue (its rows are overwhelmingly `pending`, which carry no digest by construction, and a per-event mode would have to be computed across a filtered list spanning events); and the two **thresholds are unmeasured** — `VENUE_MIN_COUNT` 5 / `VENUE_MIN_SHARE` 0.5 are room judgements to revisit after one real event.
  - 🪤 **Worth measuring before trusting the "elsewhere on campus" state:** open `whatismyipaddress.com` on UT wifi in two different buildings. If UT NATs campus-wide, that state never fires and the feature reduces to "not on UT's network". It cannot be measured after the fact — `event_id` is inside the hash precisely so digests cannot be compared across events.
  - 📌 **The pre-existing thing this surfaced, unfixed:** `saveEvent`'s audit `before` selects 14 columns and its `after` selects 8. The invariant says both sides must match, and a narrower `after` invents changes that never happened. `verify_origin` was added to both; the underlying asymmetry predates this work and is left alone.
- [x] ✅ **`shirt_size` — decided 2026-08-09: KEEP it, so `seed.sql` seeds it.** Production had carried the definition since the phase-4 walkthrough (8 options, directory column, inline-editable, no member holding a value), and phase 9's wipe-list fix meant the next re-seed would have **deleted a column somebody was using**. The officer chose to keep it, so the seed now creates it — same key, label and options as the remote — and the assert block expects **1 definition, not 0**.
  - 📌 **Nothing was applied to the database.** Production already had the row; the *seed* is what changed, to match it. This is the rare open item that closes by editing the repo alone.
  - 📌 **No member holds a value, on purpose.** Production has none either, and seeding one would manufacture the orphaned-option case for every developer and shift what every export fixture sees.
  - 🪤 **Worth keeping the shape of this one.** The drift was invisible for weeks *because* the wipe list was incomplete; fixing the list did not fix the drift, it converted it into a decision somebody had to make — and the default answer the fix implied (delete it) was the wrong one. A wipe list is a statement about what the seed owns, so adding a table to it is also a claim that the seed should be the only source of those rows.

---

## Later

Placeholders — expand on arrival. Effort estimates from §7.

- **Stage 8 — Hardening & data integrity** · 3–4 days · every RLS policy tested with the anon key; historically the stage most likely to be skipped and most likely to be regretted
  - ⚠️ **Weight `dues_payments` above the roster when scoping this** (v1.34). It is the one table holding financial information, and §6's threat-model boundary was narrowed to say so.
- **Stage 9 — Launch** · 1–2 days · domain + DNS, the handoff guide, and a soft launch at one event with a paper backup sheet on hand
  - 🔓 **No historical data is migrated — the system starts fresh** (decided 2026-08-10, doc v1.55). The spreadsheet tracker is not imported; attendance, points and dues all begin at zero. Last year's standings do not carry over, which is a real cost worth telling members about rather than letting them find out. What it buys is the removal of the one unestimable piece of this stage, and of the prospect of importing exactly the ambiguity §1.2 says the system exists to end.
  - `/admin/members/import` already covers the roster as *current* membership (create-only, matched by header name). There is deliberately **no** importer for historical attendance or adjustments, and this is why one was never written.
  - ✅ **Production was CLEARED on 2026-08-19** with `bash scripts/wipe-remote.sh` — 0 members / 0 events / 0 attendance / 0 adjustments / 0 dues / 0 field definitions, both views empty. Officer sign-ins, `officer_invites` and the eight officer-related `admin_audit` rows survived; `seed.officer@example.edu` was deleted. Real roster import and real schedule next.
  - 🔴 **This line used to say `bash scripts/seed-remote.sh --force`, which would have RE-SEEDED rather than cleared** — `--force` skips only the guard, then re-inserts all 32 fabricated members. `wipe-remote.sh` exists because clearing and re-seeding are opposite operations that read like modes of one.
- **Stage 10 — Post-v1 backlog** · parking lot, see §7

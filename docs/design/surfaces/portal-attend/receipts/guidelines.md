---
skill: web-design-guidelines
command: /web-design-guidelines app/(public)/portal/attend/
date: 2026-09-20
commit: "77d2c568ed093f78a6b437e053bbef0533eff9e4"
output: guidelines.output.md
findings:
  - id: G1
    summary: "Content handling — `ResultPanel`'s content wrapper is a `min-w-0` flex child with no `break-words`, against the rule pair \"Flex children need min-w-0 to allow text truncation\" and \"Text containers handle long content\". The `present` outcome interpolates an officer-entered event title and `events.title` has no length limit. Measured at 360 with a 76-character unbroken title: the `<strong>` painted 622.1px wide, right edge 720.1 against a sheet that ends at 340, and `document.scrollWidth` reached 720 against a 360 client width. The same rule pair was applied to the review step's `<dd>` at the 2026-09-19 gate after a long email overflowed by 588px; the success screen was not. 🪤 A hyphenated 86-character probe passed cleanly first — a hyphen is a break opportunity — which is the trap the `<dd>`'s own comment names."
    disposition: adopted
    fix_commit: "b2900e15681b949b3e551a86a836f13f153d04c9"
  - id: G2
    summary: "Two rules at once — \"Submit button stays enabled until request starts; spinner during request\" and \"Async updates (toasts, validation) need aria-live=polite\". The button disables at the right moment and its visible label swaps to \"Checking in…\", but `disabled` removes it from the tab order so `aria-busy=\"true\"` reaches nobody, and the always-mounted `role=\"status\"` region measured empty for the whole request."
    disposition: adopted
    fix_commit: "b2900e15681b949b3e551a86a836f13f153d04c9"
  - id: G3
    summary: "\"Sticky headers/footers/overlays must not cover the focused element.\" `app/globals.css` sets no `scroll-padding-top` and `components/site-header.tsx` is `sticky top-0 z-50` over a measured 61.0px shell."
    disposition: deferred
    reason: "Site-wide chrome. `scroll-padding-top` belongs on `html` and would change scroll-into-view on every route, including 25 /admin screens. Not reproducible as a failure on this surface's idle path — every control is inside the first screen at 360 — so what is at issue is the `unmatched` state, where the button sits 122px below the fold. Tracked for v2 phase 3 part 6 with the audit's T4, which reached it independently."
  - id: G4
    summary: "\"Brand names, code tokens, identifiers: wrap with translate=\\\"no\\\" to prevent garbled auto-translation.\" The review step renders a UT EID and an email address as values the member is being asked to proofread, with no `translate` attribute."
    disposition: rejected
    reason: "Rejected on the shape rather than on the principle. `Row` renders all three values through one component and only two of the three are identifiers — a full name must stay translatable — so honouring the rule means a per-row flag, which is a new API on a shared shape for a case nobody has reported on an English-only site with no i18n and `lang=\"en\"` on `<html>`. The surface also has no control over what a browser does to the `<input>` values a member typed, which is where the same risk actually lives. Recorded rather than dropped because the rule is exactly on point for a UT EID, and if the site ever gains i18n this is the first place it bites."
  - id: G5
    summary: "Typography — curly quotes ’ rather than the straight apostrophe."
    disposition: rejected
    reason: "The site-wide convention is the `&apos;` entity; two of roughly 200 files use a literal `'`. Changing this surface alone would make the one page a member reads at a door the odd one out, and the typographic gain is invisible against the cost of a split convention. A whole-codebase decision for phase 5, if ever. Unchanged from the 2026-09-19 gate's G4 and re-checked rather than carried forward."
  - id: G6
    summary: "Content — Title Case for headings and buttons (Chicago style)."
    disposition: rejected
    reason: "Overridden by DESIGN.md, which is explicit: \"Button labels are written in SENTENCE CASE; `button.tsx`'s `BASE` applies `uppercase`.\" The caps are a presentation decision living in exactly one place, and writing them into the markup reaches assistive technology, translation and the clipboard as caps — some screen readers spell short all-caps strings letter by letter. Normalised across /admin on 2026-08-31 (55 labels, 22 files); not reopened per surface."
  - id: G7
    summary: "Animation — \"Honor prefers-reduced-motion (provide reduced variant or disable)\". Nothing on this surface is gated behind it."
    disposition: rejected
    reason: "Correct as built, and the two skills have to be reconciled rather than averaged. `emil-design-eng`, which owns motion on this pipeline, states the narrower rule: \"Reduced motion means fewer and gentler animations, not zero. Keep opacity and color transitions that aid comprehension. Remove movement and position animations.\" There is no movement here to remove — no `data-reveal`, no keyframes, no transform, re-verified on every state — and the 150ms colour swaps are the comprehension aid that rule protects. Recorded in `motion.md` as M5."
  - id: G8
    summary: "\"Interactive states increase contrast: hover/active/focus more prominent than rest.\" Measured on the running page: the input's rest boundary `--misa-control-edge` (#858687) is 3.65:1 against the white sheet and 3.26:1 against its own fill; on hover it becomes `misa-blue/55`, which composites to 3.36:1 and 3.24:1. Hovering an input LOWERS the ratio of the thing that identifies it."
    disposition: rejected
    reason: "Both states clear WCAG 1.4.11's 3:1, and contrast ratio is not the only measure of prominence: the hover is a HUE change, grey to navy, which is the system's entire interaction vocabulary (DESIGN.md: \"colour swaps as the only hover\"). Raising the hover's ratio means a darker navy or a heavier border, and `field.tsx` records that `/55` was solved for rather than picked — it is the smallest step that clears 3:1 on BOTH the sheet and the fill, which `/50` did not. It is also `components/ui/field.tsx`, shared with every form on the site, so it is not a per-surface change. Recorded with the four numbers so part 6 starts from a measurement."
  - id: G9
    summary: "\"Full-bleed layouts need env(safe-area-inset-*) for notches.\" Nothing in `app/globals.css` or `components/ui/section.tsx` reads a safe-area inset, and the portal's page ground is full-bleed."
    disposition: deferred
    reason: "Shared: the gutter lives in `Section`, which every public page and the portal use. At 360 portrait the sheet sits inside a 20px gutter, which a landscape notch can exceed — so the case is real but it is a landscape-phone case on a page whose whole design is portrait-first, and fixing it is a change to the one component that owns the public gutter. Tracked for part 6."
  - id: G10
    summary: "Navigation — \"URL reflects state: filters, tabs, pagination, expanded panels in query params.\" Twelve states, one URL."
    disposition: rejected
    reason: "Wrong for this surface specifically, not merely unnecessary. Every state here is the result of a POST that either wrote attendance or refused to; putting the outcome in the URL would make a member's check-in result linkable, shareable and replayable on a page that deliberately has no accounts, and the refusal-before-lookup ordering in `lib/checkin.ts` exists precisely to keep this page from being a membership oracle. Unchanged from the 2026-09-19 gate's G6."
---

Every rule in the fetched guideline set, applied to the surface's two files, at
the layout widths that matter. The file:line list, the full list of checks that
pass with what was verified for each, and the measurements behind every finding
are in `guidelines.output.md`.

## Ten findings: two adopted, three deferred, five rejected against a named rule

**G1 is the one that mattered most**, and it is the same rule pair that caught
the review step's `<dd>` at the 2026-09-19 gate — applied there and not to the
success screen, which is the one screen this whole surface exists to render.
🪤 It also needed the right probe: a hyphenated 86-character title passed, because
a hyphen is a break opportunity. A realistic-looking long value proves nothing.

**G2 was reached by four steps independently** — this one, the critique's
assessment A, the audit's T1 and the `design-reviewer`'s DR1 — none of which saw
the others. That is the strongest signal this gate produced about a single
defect.

## What this checklist clears, which is most of it

Every control labelled; `autoComplete` and the right `type`/`inputMode`;
`spellCheck={false}` on the EID and the email; no paste blocking; no
placeholders anywhere (EV12); errors inline with focus moved to the first one; no
`transition: all`; `…` not `...`; `&nbsp;` in the refusal's window figure;
`text-balance` on every heading; `touch-action: manipulation` and
`-webkit-tap-highlight-color` already global; `color-scheme: light`;
`defaultValue` not `value` on every live input; and **none of the thirteen
anti-patterns**. Full accounting in the output.

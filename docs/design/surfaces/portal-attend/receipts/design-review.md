---
skill: design-reviewer
command: design-reviewer agent — /portal/attend at 360 / 768 / 1280 on the local dev server; ten states plus pre-hydration; Playwright Chromium for scripted measurement and pixel diffs, real Chrome for the bar cross-check
date: 2026-09-20
commit: "77d2c568ed093f78a6b437e053bbef0533eff9e4"
output: design-review.output.md
findings:
  - id: DR1
    summary: "[Medium] The submit's `disabled={pending}` drops focus to `<body>` for the whole pending window. Measured at 360x640 with the POST throttled to 3.5s: the button reads \"Checking in…\", `aria-busy=\"true\"`, `disabled` true, box 286 x 48 with its bottom edge at 591.5 — byte-identical to idle, so EV7's \"must not resize the control\" is satisfied exactly — and `document.activeElement` is BODY. The member pressed a control that then removed itself from the tab order, so the next Tab restarts at the skip link, four to seven stops back. It is the same defect `ReviewPanel`'s own comment identifies one step later, one step earlier."
    disposition: adopted
    fix_commit: "b2900e15681b949b3e551a86a836f13f153d04c9"
  - id: DR2
    summary: "[Medium] 🔴 THE BAR'S RECORDED FIGURE DOES REPRODUCE, AND THE RE-GATE'S FIRST DIAGNOSIS OF IT WAS WRONG. In real Chrome a genuine 360x640 frame on Windows gets a classic 15px scrollbar, so the layout width is 345, not 360 — and there the `h1` computes 26px (no `sm:` applied), the content column is 272, the text column 244, the checkbox LABEL wraps to two lines taking that row to 104px, and the Check in button's bottom edge is 607.66. The 16.16px delta is the label's wrap (+20px) net of sub-pixel row heights (inputs 49.14 not 50, header 60.57 not 61). So 607.7 is the classic-scrollbar reading, taken the most likely way anyone would have taken it, and the `sm:`-value decomposition the lead had written up as \"the signature to look for in a suspect measurement\" was derived from a wrong diagnosis. Found by diffing the working tree mid-review, against the fix being written for `lead.md` L1."
    disposition: adopted
    fix_commit: "b2900e15681b949b3e551a86a836f13f153d04c9"
  - id: DR3
    summary: "[Nit] On the pre-hydration path the outcome sentence is in the initial HTML twice. Measured with `javaScriptEnabled: false` at 360: after a full-page POST, `main`'s innerText reads \"Event Check-In / You're checked in. Your attendance at … is recorded. / You're checked in! / Your attendance at … is recorded.\" — the sr-only `StatusRegion` and the visible `ResultPanel` both carry it in the initial DOM, so a linear read hears it twice. With JavaScript the region is a live update and the panel is silent, which is correct; only the full-document path duplicates."
    disposition: deferred
    reason: "The fix belongs in `components/ui/status-region.tsx`, which `/portal/lookup` also uses, and it is not free: suppressing the message until after hydration means client state in a component whose entire value is that it is a `<p>` that is always mounted. It would also be the right answer — on a full document load nothing announces anyway, so the region has no job there — which is exactly why it should be decided once for both callers rather than here. Tracked for part 6 alongside the announcement question. Practical cost today is one duplicated sentence for a screen-reader user with JavaScript disabled."
  - id: DR4
    summary: "[Nit] `min-h-12` on the checkbox row never binds: measured 104px at a 345px layout, 84px at 360, 64px at 768 and 1280 — the floor is 48."
    disposition: rejected
    reason: "Inert by design rather than dead code. The class was added at the 2026-09-19 gate because the row then measured 44px at >=`sm`, four pixels under EV4's floor; `ca5cd06` narrowed the column and the reassurance grew a line, which is what lifted the row clear. Removing it now would leave the floor guaranteed by a copy length nobody controls — the reassurance is the line EV5 names as the first thing to give if this copy ever grows or shrinks. The measurements are adopted: they are what `lead.md` L3 corrects, and the row's three values by layout width are now in the file."
  - id: DR5
    summary: "[Nit] The brief says the unmatched state \"pushes the button roughly 90px further down\". Measured: +82px at 768 and 1280 (595.7 -> 677.7) and +122px at 360 (591.5 -> 713.5). The recorded figure understates the phone case — the one the officer's named failure actually happens on — by 32px."
    disposition: deferred
    reason: "The brief's own instruction is that this state \"is measured and recorded AT THE GATE, but does not block\", and this receipt is that record — so the instruction is satisfied by the numbers above rather than by editing the brief. The brief is also the officer-facing document that carries the non-gating decision; changing a figure inside it mid-gate would edit the basis of a decision the officer has already taken. Recorded here and in `officer.md`'s neighbourhood for parts 4-5, which read the same brief shape."
  - id: DR6
    summary: "[Nit] The three marks the new \"sheet is the page\" idea rests on are the faintest on the page: the sheet's fill against the page ground 1.12:1, the sheet's border rgb(191,191,194) against the ground 1.64:1, and the masthead rule rgb(219,219,219) against the sheet 1.38:1. No WCAG rule applies — all three are decorative — and what separates the sheet from the ground in practice is `shadow-lift` rather than any of them."
    disposition: deferred
    reason: "It is the composition the officer adopted, and it is `.sheet` in `app/globals.css` plus `PortalSheet` — shared by all four portal surfaces, two of them frozen and two of them being built next. Nothing is wrong by a measurable standard; what the finding establishes is that the sheet is carried by elevation, so any future change to `shadow-lift` is a legibility change to the whole portal and not a taste change. Recorded because NOTHING had reviewed this composition before this gate — that is the reason the re-gate happened — and part 6 owns the shared surfaces. No action proposed."
  - id: DR7
    summary: "[Nit] `py-3` \"takes it to exactly 48px\" for the lookup link holds at 768 and 1280 (measured 217.3 x 48.0) but the link is 200 x 72 at 360, where it wraps to two lines. It exceeds the floor everywhere; the comment is width-silent."
    disposition: rejected
    reason: "Same as `lead.md` L6, reached independently. EV4's figure is a floor and it is met at every width; nothing misleads a decision and there is nothing to change. Both are recorded rather than dropped because the comment states an exact number and the next reader to measure it at this surface's own gate width will get 72."
  - id: DR8
    summary: "[Nit] Box clearance between the centred wordmark and the header's MEMBER PORTAL button, seen on this route: 10.4px at a true 360 layout and 3.0px at a 345px layout. No collision at either."
    disposition: deferred
    reason: "`components/site-header.tsx` — site-wide chrome, outside this surface's registered files. It also corrects the 2026-09-19 gate's DR4, which recorded \"3.0px at 360\" with no convention named — the same defect as `lead.md` L1, in the same folder. CLAUDE.md's nav-clearance invariant records its measurements as taken at 1280 only, so both phone figures are new. Carried into `officer.md` O5 with the rest of the header question, for part 6."
---

**No Blockers and no Highs.** Two Mediums, six Nits, and one finding withdrawn
by the reviewer itself. Full measurements, the focus-ring pixel diffs, the
contrast table and the list of states it could not reach are in
`design-review.output.md`.

## 🔴 DR2 is the finding of the round, and it is a finding against this gate

The reviewer was asked to re-measure the bar from scratch and to treat the
recorded 607.7 as unverified. It did — and then reproduced it. **A 360×640
window in real Chrome on Windows is a 345px layout**, because a classic scrollbar
takes 15px, and at 345 the checkbox's own label wraps to a second line. The lead
had by then written the opposite conclusion into `page.tsx`, with three
derivations and a `sm:`-value decomposition that added up exactly.

**All three of the lead's derivations were headless, and headless Chromium uses
overlay scrollbars in every context.** They held fixed the one variable that
mattered. The reviewer was the only step in this gate using a real browser, and
it is the only reason the surface did not ship a confident wrong diagnosis with
a memorable name attached to it.

## What it verified, with its own numbers

The bar both ways (591.5 at a true 360, 607.66 in real Chrome at 345 — **met
under both**); **every focus ring painted**, Tab-driven so `:focus-visible`
genuinely applied, with changed-pixel counts matching the ring geometry
arithmetically at 360 and 1280; the lowest contrast anywhere in `<main>` at
**8.51:1** with zero failures; `--misa-control-edge` at **3.65 / 3.26** rest and
**3.36 / 3.24** hover, all four matching `field.tsx`'s claim exactly; no
horizontal scroll at any width in any state, including a 143-character unbroken
email; correct focus placement after every screen replacement; **zero console
errors and zero warnings** including the no-JS load; and the pre-hydration submit
working end to end.

🪤 **It also recorded the instrument that would have missed it**: programmatic
`.focus()` on the checkbox and the buttons returns `matches(':focus-visible')
=== false` and paints **0 changed pixels**, which is why the Tab-driven numbers
are the evidence.

## States it could not reach, and did not guess at

`pending`, `refused`, `rate_limited` and `error` — the first two need the shared
local fixture event closed or removed, and `rate_limited` needs 200 submissions
in ten minutes. It said so rather than inferring, and named the nearest evidence
it did have. **The lead reached `pending`, `refused` and both `duplicate`
readings separately** by driving the fixture, and their measurements are in
`audit.output.md`; `rate_limited` and `error` were reached by neither and are
verified by code inspection only — both render the same `Banner` shape as
`unmatched` with a different tone, whose washes were measured on the terminal
panels.

## Withdrawn by the reviewer

A finding that `--misa-secondary` was quoted at 7.60:1 against white in two
comments where the measured value is 8.51:1. It was correct, and it had already
been adopted as `lead.md` L4 and fixed in the working tree while the review ran.
Withdrawn rather than filed twice.

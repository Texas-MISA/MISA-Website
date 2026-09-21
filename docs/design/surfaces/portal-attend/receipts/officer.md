---
skill: officer
command: officer instruction, 2026-09-20 — "the navy header at the top of each page should be removed for all pages in the portal. the design skills can come up with a replacement."
date: 2026-09-20
commit: "4c216f13e6032c7d8e572304f7e02fd97840895c"
output: officer.output.md
findings:
  - id: O1
    summary: "Remove the navy band (`PortalBand`) from `/portal/attend`. The officer gave the instruction against the deployed preview, for every page in the portal, and left the replacement to the design step."
    disposition: adopted
    fix_commit: "ca5cd06be488d085cebeed009aece22c8144b971"
  - id: O2
    summary: "The replacement, proposed by `frontend-design` as one of two concepts and adopted by the officer: \"the sheet is the page\" — each portal page becomes one white `.sheet` on the grey ground, its title a masthead above a rule that bleeds to the sheet's edges. The rejected alternative, \"title and rule\", kept the title on the page ground with the tool as a separate white surface below it."
    disposition: adopted
    fix_commit: "ca5cd06be488d085cebeed009aece22c8144b971"
  - id: O3
    summary: "The adopted concept included a back link (\"Member portal\") above the title on the three leaf pages. It was built, measured and REMOVED before shipping — the site header already carries a MEMBER PORTAL button linking /portal on every page, so it duplicated an always-visible control for 40px on the one surface gated on a fold position."
    disposition: adopted
    fix_commit: "ca5cd06be488d085cebeed009aece22c8144b971"
  - id: O4
    summary: "OPEN QUESTION, raised 2026-09-20 and not decided. The officer's copy rule for the portal is that the interface does not explain itself. Applied to this surface it found nothing to delete — every string is a label, an outcome, a validation message or the officer-approved control-attached reassurance — with ONE borderline item: the `refused` panel's \"Check-in opens around event times, and there's no MISA event within 48 hours of right now — nothing running, and nothing that just ended or is about to start.\" Its first clause states a system rule, and its third restates the second in plain words. This is the one place on this surface where the copy rule would land if the officer wants it applied to error prose."
    disposition: deferred
    reason: "Kept unchanged and escalated rather than decided. It survives the literal test — the 48-hour window appears nowhere else on that screen, so deleting the clause deletes a fact — and the KEEP list the officer gave explicitly protects error messages. Changing member-facing error copy on the officer's own rule, without asking, is the kind of decision this receipt exists to prevent. Recorded for the officer; the sentence ships as written until they say otherwise."
  - id: O5
    summary: "OPEN QUESTION, carried from the portal-hub re-gate (2026-09-20) and re-measured here because it sits directly above this surface's fold-position bar. The site header's MEMBER PORTAL button announces the current page to a screen reader but shows nothing to an eye, and its focus ring fades in from invisible. This pass measured the second half from the other end: `components/ui/button.tsx`'s `BASE` carries `transition-colors duration-150`, Tailwind v4 puts `outline-color` inside that shorthand, and a button whose own text is white therefore animates its focus ring white → navy over 150ms — 1.00:1 against a white ground at t≈1ms, not clearing 3:1 until ~70–90ms. The same cause reaches this surface's own Check in button."
    disposition: deferred
    reason: "Shared chrome, and not fixable at a surface: every Tailwind `transition-*` utility sets `transition-property` at equal specificity, so a per-call-site override ties with `BASE` and loses on emission order. It belongs in `components/ui/button.tsx` and `components/site-header.tsx`, which v2 phase 3 part 6 owns. Recorded here so the officer sees one question rather than two halves of one, and so part 6 starts from a measurement rather than an impression. Full timing table in `motion.output.md` (M1)."
---

The officer's own review, taken after `portal-attend` was already `rebuilt`.
This receipt exists so `scripts/design/receipts.mjs` can tell an officer-
requested change from drift: without it, `ca5cd06` reads as **stale** against
all seven review steps. 📌 An officer receipt never counts as "a skill changed
the outcome" — the nine findings in `lead.md`, `critique.md`, `audit.md`,
`guidelines.md` and `design-review.md` still carry that.

**The instruction came with a screenshot of the deployed preview**, the navy
band circled, and it was scoped to *all* portal pages rather than to this one.
So it also reaches `/portal` (equally frozen, with its own `officer.md`) and
`/portal/leaderboard` and `/portal/lookup`, which are not rebuilt yet and took
the header removal and nothing else.

## The bar survived, but only after the first attempt lost it

🔴 **The first build of this change MISSED the bar.** Removing the band and
adding the concept's back link put the Check in button at **647.7** against a
640 fold — worse than the 610.5 the band version had measured. The band was
worth ~60px of chrome; the narrower sheet column and the back link together
spent ~70.

Two fixes, both measured:

| | |
|---|---|
| Back link removed (O3) | −40px |
| Sheet padding `px-5` → `px-4` | −20px (8px of column, enough to matter elsewhere) |
| **Final** | **button bottom 607.7, 32.3px of slack** — 🔴 see the correction below |

So the surface ends *better* than it was gated at (610.5), on a page whose
layout family count also dropped from two to one.

🔴 **CORRECTED AT THE 2026-09-20 RE-GATE: the bar is 591.5, not 607.7 — 48.5px
of slack, not 32.3.** The row above is left as written because it is what this
receipt recorded on the day. 591.5 was measured three ways at a true 360×640
(`clientWidth` 360, `scrollWidth` 360): in a mobile-emulated context, in a
desktop context and with the `js` class stripped, all identical; and it falls out
of the CSS chain to the pixel — `61 + 24 + 1 + 20 + 26.52 + 16 + 1 + 24 + 3 ×
(20 + 4 + 50) + 4 × 16 + 84 + 48 = 591.52`. A sweep of nineteen widths from 320
to 1280 never produces 607.7 (611.5 at 320–340, **591.5 at 360**, 571.5 from 375
to 639, 595.7 at 640+). **607.68 − 591.52 = 16.16 decomposes exactly into two
`sm:`-branch values** — `Title`'s `sm:text-[34px]` (34.68 − 26.52 = 8.16) and one
8px `sm:` vertical step (`Section`'s `pt-6 sm:pt-8` or `.sheet`'s `py-5 sm:py-7`)
— inside an otherwise-360 layout, a combination that exists at no viewport. And
nothing has moved this layout since `ca5cd06`: `git diff ca5cd06 HEAD` over
`components/` and `app/globals.css` is the control-edge colour, two comment-only
files, the home page, the hub and the header button, and the header shell
measures 61.0px at every one of those nineteen widths. It is the second bar
figure recorded on 2026-09-20 that does not reproduce — the hub's was 265.5 and
re-measures at 267.2. Corrected because a frozen surface should not carry a
figure that no longer reproduces; the gate is met either way, by more than the
figure is wrong.

⚠️ **And a comment asserted an unmeasured number again, one commit after this
surface's gate recorded that exact lesson.** It claimed `px-4` "lands the column
at 272 exactly" and therefore fixed the box reassurance's wrap. It does not: the
reassurance sits inside the checkbox's flex row, so its **text** column is the
content column minus 28px, and it still takes three lines. The third line is
accepted, and the comment now says so. The gate's lesson was "re-derive a number
before writing it into a comment"; the refinement is **measure the column the
text is actually in**.

🔴 **The refinement was right and its own two numbers were also wrong, which the
re-gate measured.** The content column is **286.0px**, not 272 — 272 is
`320 − 2 × 24`, the sheet's width minus a `px-6` that is not in the class list,
with the `.sheet`'s 1px border unaccounted on both sides; 286 is
`320 − 2 − 2 × 16`. The reassurance's text column is therefore **258.0px**, not
244. The conclusion is untouched: at 286 the line still takes three lines, and
two would still need a column no realistic padding reaches. Corrected in
`components/ui/portal-sheet.tsx` at the re-gate, because **part 4 builds
`/portal/lookup` out of that component next** and would have built against 272.

## What was verified after the change

All four portal routes at 1280: **zero** `.chevron-notch` and **zero**
`.ground-field` elements in any `<main>`, so the navy header is gone everywhere
rather than on the two surfaces that happened to be rebuilt. Every page keeps
its `<h1>`. The only navy remaining anywhere in the portal body is the hub's
three key columns and the two submit buttons — controls, which is the Rare Navy
Rule working correctly.

`npm test` 41 files / 1142 tests green. `npm run test:ui` 41 pass / 1 fail,
unchanged by this commit; the one failure is `/portal/lookup`'s
`definition-list`, which part 4 owns.

🪤 **What this receipt did NOT claim, and what has since happened.** As written
on 2026-09-20 this receipt said: *"The seven review steps ran against `a38a2b3`,
and this change alters the surface's composition after them. The measurements
above are the lead's, re-run on the new build — the `design-reviewer`, the
critique and the audit have **not** seen the sheet. If the officer wants that,
the surface should go back through `/design-gate`."*

✅ **It did.** The surface went back through the full gate on 2026-09-20 against
`77d2c56`: all seven steps re-run, this time against the sheet. What that found
is in the seven receipts beside this one — including the two corrections above,
which no step before it had the measurements to catch.

---
skill: impeccable
command: /impeccable polish app/(public)/portal/attend/
date: 2026-09-20
commit: "77d2c568ed093f78a6b437e053bbef0533eff9e4"
output: lead.output.md
findings:
  - id: L1
    summary: "The gate bar is TWO numbers and nothing in the surface said which. At a true 360x640 — a phone, overlay scrollbars, 360 CSS px of layout — the Check in button's bottom edge is 591.5 with 48.5px of slack. In a 360px-wide DESKTOP window, where a classic 14–15px scrollbar leaves 345–346px of layout, the checkbox's own LABEL wraps to a second line and the same build measures 611.5 headless / 607.66 in real Chrome. The step is a cliff at 348px of layout width, not a slope: one pixel moves that row 20px and the button with it (box row 104 at ≤347, 84 at 348–639, 64 at ≥640). Both readings clear the 640 fold. The surface, DESIGN.md, the officer receipts and PortalSheet between them carried 610.5, 611, 607.7 and 265.5 with no convention attached to any of them."
    disposition: adopted
    fix_commit: "b2900e15681b949b3e551a86a836f13f153d04c9"
  - id: L2
    summary: "`page.tsx` said removing the navy band \"gives back most of another 131px\". It gave back 19px at a true 360 (610.5 → 591.5) and about zero at a 346 layout (611 → 611.5). `PortalBand` was 131px of chrome and the sheet's masthead, bleeding rule and margins spent essentially all of it. The sentence's conclusion — the bar stops being tight — holds at the phone reading and not at the desktop one, and the number offered as its evidence is wrong under both."
    disposition: adopted
    fix_commit: "b2900e15681b949b3e551a86a836f13f153d04c9"
  - id: L3
    summary: "`checkin-form.tsx`'s box-row measurement is wrong at every width it names and inverted in direction. It read \"64px at 360 (two lines), but 44px at 768 and 1280, where the label fits on one line\". Measured, by LAYOUT width: 104.0px at ≤347, 84.0px at 348–639, 64.0px at ≥640 — so 84 on a phone at 360 and 64 at 768 and 1280, with the reassurance at three lines below `sm` rather than two. `ca5cd06` is the cause: it narrowed the content column from 305 to 286 (272 at a 346 layout) and the reassurance's own text column to 258 (244). What the comment was defending still holds — `min-h-12`'s 48px floor is cleared everywhere by 16px at the tightest."
    disposition: adopted
    fix_commit: "b2900e15681b949b3e551a86a836f13f153d04c9"
  - id: L4
    summary: "`--misa-secondary` is stated at 7.60:1 on a WHITE ground twice — the box reassurance and the review step's `<dt>`s — and both call sites name white explicitly. 7.60:1 is Secondary Graphite on the GREY page ground; that is where DESIGN.md records it, in the §Accessibility paragraph that moved three public occurrences off `--misa-muted`. On Paper the same ink is 8.51:1. Measured on the running page across every reachable state, with a formula self-checked on the WCAG reference pairs (#767676 on white = 4.54, black on white = 21.00): rgb(74,77,80) on rgb(255,255,255) = 8.51. DESIGN.md's own row for this surface already said 8.51:1, so the file disagreed with DESIGN.md about its own numbers."
    disposition: adopted
    fix_commit: "b2900e15681b949b3e551a86a836f13f153d04c9"
  - id: L5
    summary: "`components/ui/portal-sheet.tsx` gives check-in's content column as 272px and its reassurance text column as 244px with no viewport named, and part 4 builds `/portal/lookup` out of that component next. Both figures are correct at a 346px LAYOUT width and neither is correct on a phone, where they are 286 and 258. The same paragraph carries the bar figure of L1."
    disposition: adopted
    fix_commit: "b19766374e0c21166fc8a6435d940abc0a05235c"
  - id: L6
    summary: "`checkin-form.tsx` says `py-3` takes the lookup link to \"exactly 48px\". Measured 217.3 × 48.0 at 1280 — exactly as claimed — and 200.0 × 72.0 at 360, where \"See your points and attendance\" wraps to two lines."
    disposition: rejected
    reason: "Not a defect. EV4's figure is a FLOOR and it is met at every width — 48.0 where the label fits one line, 72.0 where it wraps. Nothing about the claim misleads a decision, and there is nothing to change. Recorded rather than dropped because the comment states an exact number and the next reader to measure it at this surface's own gate width will get 72. The `design-reviewer` filed the same observation as DR7 and it is rejected there for the same reason."
  - id: L7
    summary: "`ResultPanel`'s Lucide mark computes rgb(58,61,64) — Body Graphite — while the `<h2>` beside it computes rgb(29,31,32) since the 2026-09-19 gate's L1 was adopted. They sit on one optical line, so it looks like the same miss left half-fixed."
    disposition: rejected
    reason: "🔴 REJECTED BY THE LEAD AND THE REJECTION WAS WRONG; the adopted form of this is `critique.md` A2, fixed in b2900e15681b949b3e551a86a836f13f153d04c9. The lead argued from the mark's ROLE — a decorative `aria-hidden` glyph is not a heading, so `Banner`'s \"the text stays body-coloured\" should govern it — and that argument is answered by a measurement the lead did not take. The critique's assessment A measured the rest of the tone encoding on this white sheet: the affirm wash is 1.11:1 against the sheet it lies on, caution 1.10, critical 1.12, with hairlines at 2.14–2.38. So the mark was the only cue EV9 has that could carry tone, and it carried none. Left as `rejected` rather than rewritten, because a receipt that is edited to agree with the outcome stops being evidence that the six steps disagreed."
---

The lead's own pass, `impeccable` in Operate mode against the craft floor. The
concept is not in question — the officer adopted concept A on 2026-09-19 and
"the sheet is the page" on 2026-09-20, and this pass preserves both.

## Why this pass was not a repeat

The 2026-09-19 gate's seven steps ran against `a38a2b3`, **a build whose hero was
a navy band**. `ca5cd06` deleted that band and the replacement shipped without
any review step seeing it; `receipts/officer.md` says so in its own words —
*"the `design-reviewer`, the critique and the audit have not seen the sheet."*
Three further commits landed after it and none had been seen here either:
`f2e41d6` (the new `--misa-control-edge` on every form control — **raised at this
surface's own gate** as DR3/T4), `b01dc6a` (the header button to 48px on phones —
raised here as DR4) and `539a5f0` (comments only).

## What that left, and it is not a coincidence

**Five of the seven findings are numbers this surface asserts about itself.** The
bar, the band's saving, the box row at three widths, Secondary's ratio, and the
sheet's two columns. None is a rendering defect; all five are the frozen record
of a surface, and a frozen surface is read rather than re-measured. Part 4 builds
`/portal/lookup` out of `PortalSheet` **next**, from the figures in L5.

## 🔴 The lead was wrong twice in this pass, and both are on the record

**L1's diagnosis.** The lead measured 591.5 three ways — mobile-emulated, a
"desktop" context, and with the `js` class stripped — got the same number each
time, and concluded that the receipts' 607.7 *"reproduces at no viewport"*,
decomposing the 16.16px gap into `Title`'s `sm:text-[34px]` plus one 8px `sm:`
step and writing that up as "the signature to look for in a suspect
measurement". The arithmetic worked and the diagnosis was numerology.
**Headless Chromium uses overlay scrollbars in every context**, so all three
"independent" derivations held fixed the one variable that mattered. The
`design-reviewer` reproduced 607.66 in real Chrome within the hour (DR2) and
named the real cause: the checkbox label's wrap below 348px of layout. **Three
derivations that hold one variable fixed are one derivation.**

**L7.** Rejected on an argument about the mark's role, and overturned by the
critique with the wash measurement the lead had not taken. Left standing above
rather than rewritten.

📌 Both were caught inside the gate, by two different steps, before anything was
committed. That is what the six steps are for, and it is the third round running
in which the lead's own reading of its own work has not been the last word on it.

## What the pass verified and found correct

Numbers in `lead.output.md`. In short: no horizontal overflow at 320, 346 or 360
on any state, including a 111-character unbroken email; the busy state preserves
layout exactly (286.0 × 48.0 at 360, 208.0 × 48.0 at 1280, identical idle and
pending); **every one of ten focus indicators paints at its exact ring area under
a pixel diff**, before and after the fixes; the pre-hydration path returns the
`present` screen with JavaScript disabled; the honeypot adds no phantom flex gap;
zero console errors on every state; and **both findings this surface deferred to
part 6 at its own gate are now done and verified here** — the inputs' boundary
measures 3.65:1 on the sheet and 3.26:1 on their own fill (`f2e41d6`), and the
header button is 48px on phones inside an unchanged 61.0px shell (`b01dc6a`).

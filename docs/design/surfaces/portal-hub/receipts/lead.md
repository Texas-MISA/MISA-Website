---
skill: impeccable
command: /impeccable polish app/(public)/portal/page.tsx
date: 2026-09-20
commit: "a660ada662ead1f827746d68f57421a98084c5b2"
output: lead.output.md
findings:
  - id: L1
    summary: "The row's focus indicator does not enclose the 48px navy key at all. Screenshotting a focused row and diffing it against the same row unfocused isolates the indicator: the navy runs stop dead at the key's left edge, the row's right-hand run paints nothing, and the key's white ring contributes only a 2px bar at the seam. The ring does not change colour at the seam — it ends there. `getComputedStyle` reports the key's white outline as present and correct, which is why the previous gate recorded this as fixed."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: L2
    summary: "The cell's horizontal padding is a flat `px-6` compared against nothing, while the plate bleeds outward by exactly the sheet's `px-4 sm:px-8`. The row text therefore starts 8px right of the masthead at 360 and 8px left of it at 1280 — the miss inverts across `sm`, which is the signature of an unchecked constant rather than a choice."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: L3
    summary: "The officers line carries no leading class and inherits 1.5 (a 24px line box) where DESIGN.md §The ramp's Body row is 16px / 1.6 and the row bodies 20px above it carry `leading-[1.6]` (25.6px). Two 16px paragraphs at two leadings in one small surface."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: L4
    summary: "The officers sign-in target measures 44.9 x 32px — the one target on the page under EV1's 44pt/48dp floor, which the comment beside it cites while describing the page as one where every other target is 48px+. Round 1a made that claim truer still by raising the header's MEMBER PORTAL button to 48px on phones."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: L5
    summary: "The layout-family block still declares `1. Band ... Short portal field band (field + chevron notch)` and `TWO sections, TWO families`. `ca5cd06` deleted that band; the page renders one section and the route has zero `.chevron-notch` and zero `.ground-field`. DESIGN.md §Layout families makes these comments the enforcement, so this is a wrong count in the only place the count is kept."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: L6
    summary: "The comment describes the officers line as `--misa-secondary` at `7.60:1 there`, meaning on the grey page ground. `ca5cd06` moved that line inside the sheet; it is on white at 8.51:1. The same file states the correct ground 200 lines later, so the file disagrees with itself."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: L7
    summary: "`Lowest ratio anywhere on the route is 7.60:1` is stated two lines after the same paragraph correctly names the footer's muted email at 4.84:1. The paragraph refutes itself inside seven lines. Measured: the page bottoms out at 8.51:1 and the route at 4.84:1."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: L8
    summary: "The gate bar figure recorded for this surface (265.5px) does not reproduce. Measured three times independently at 267.2px, and 267.2 falls out of the box model to the pixel while 265.5 falls out of nothing. A frozen surface should not carry a figure that no longer reproduces."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: L9
    summary: "An early read of the hover state returned the rest colour at both widths and looked like a dead hover on a page whose only interaction cue is a colour swap."
    disposition: rejected
    reason: "Not a finding — a measurement error, recorded because it nearly became one. The read was taken inside the 150ms transition. Waiting 400ms shows rest `rgb(22,48,92)` to hover `rgb(13,29,56)`, and the press state was then separately verified on an emulated `hover: none` device. CLAUDE.md's `a review is a set of claims, not an inventory` cuts against the reviewer as often as for them, and this is the second time in this phase it has caught a reviewer rather than the code."
  - id: L10
    summary: "Three source citations in the comments point at line numbers that have drifted: `app/globals.css:318` for the `:focus-visible` rule (now 359) and `globals.css:594` for `.sheet` (now 635), plus `DESIGN.md:894` citing `page.tsx:42` for a comment now at 56-70."
    disposition: rejected
    reason: "The cited CONTENTS were each verified correct, so nothing is misleading about the reasoning. A line number in a comment is stale the next time anything above it changes, which makes it a maintenance cost with no owner rather than a defect — and this gate has just moved every line number in the file again. The fix is to stop citing line numbers, which is a convention change across the codebase and not this surface's to make."
---

The lead's own pass, `impeccable` in Operate mode against the craft floor. The
concept is not in question: the officer adopted "the sheet is the page" on
2026-09-20 and this pass preserves it. Everything outside the eight adopted
findings is unchanged.

## Why this pass was not a repeat

The 2026-09-19 gate's seven steps ran against a build whose hero was a navy
band. `ca5cd06` deleted that band and the replacement shipped **without any
review step seeing it** — `receipts/officer.md` says so in its own words:
*"The `design-reviewer`, the critique and the audit have not seen the sheet."*
So the sheet composition, the masthead, the bleeding rule, the sheet's padding
at each width, the plate-inside-a-frame and the absent back link had never been
reviewed by anybody. Every finding above came from there.

## The method that decided L1, stated because nothing else would have found it

**Screenshot the row focused, screenshot it unfocused, diff.** The changed
pixels are the indicator and nothing else. `getComputedStyle` reports the key's
outline as `solid 2px rgb(255,255,255)` at `-2px` — present, correct, and not
painted. The previous gate read the computed style, found it correct, and
recorded the defect as fixed; the file then argued the point at length and
accurately in CSS terms. **A careful argument about the right mechanism is not
evidence the mechanism painted.**

Three candidate fixes were measured rather than reasoned about: `relative`,
`relative` + `z-index` and `isolation: isolate` all close the ring; an inset
`box-shadow` does not, because it paints with the child's background and is
still under the parent's outline. `relative` is the least of them and is what
shipped.

## What the lead did NOT find, and the gate did

L2 was reached three times independently — by the `design-reviewer` agent (DR2)
and by both critique assessments (A's P1 and B's B5), none of which saw the
others' work. **The lead had measured the same left edges an hour earlier** — 37
against 45 at 360 — and read them as the plate's bleed working correctly, which
it is; what the lead missed is that the *cell* then re-pads by a third value and
that the sign of the miss inverts at `sm`. Recorded for the same reason this
receipt recorded it in 2026-09-19: the value of a six-step gate is precisely
that the lead's own reading is not the last word on its own work.

## One thing the fix did not do, measured rather than assumed

Assessment A predicted that widening the phone text column 222 → 238px might
take the lookup body from three lines to two and collapse the rake (A4/DR3) as a
side effect, and was explicit that this had to be measured. **It was measured
after the fix, and it did not**: at 320 and 360 the bodies still wrap to 1, 2 and
3 lines and the rows still rake 92.7 / 118.3 / 143.9. A4 stands exactly as
deferred, with no part of it quietly resolved.

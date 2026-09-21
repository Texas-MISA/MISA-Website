# `/impeccable polish app/(public)/portal/page.tsx` — the lead's own pass, re-gate 2026-09-20

Operate mode, `impeccable` as lead, against the craft floor. Context loaded with
`scripts/context.mjs --target "app/(public)/portal/page.tsx"`: PRODUCT.md,
DESIGN.md and the surface brief `.impeccable/surfaces/route-portal.md`, whose
🔴 OFFICER OVERRIDE block wins over everything below it.

**Polish is refinement, never concealed redesign.** The concept is not in
question. The officer adopted "the sheet is the page" on 2026-09-20; this pass
preserves it and everything outside the scope of the findings below.

## Why this pass is not a repeat of 2026-09-19

The previous seven review steps ran against `23fab67`/`ab3f6c9` — a build whose
hero was a navy band (`PortalBand`). The officer deleted that band from every
portal page on 2026-09-20 (`ca5cd06`) and the replacement was built and adopted
**without any review step seeing it**. `receipts/officer.md` says so in its own
words: *"The `design-reviewer`, the critique and the audit have not seen the
sheet."* So the sheet composition, the masthead, the bleeding rule, the sheet's
padding at each width, the plate-inside-a-frame and the missing back link had
never been reviewed by anybody. That is where this pass looked, and that is
where every finding came from.

## Classification (polish.md §1)

- **L1** (the focus ring) — *local defect*, and the most serious kind: the
  implementation does not do what the file says it does, and the file says it at
  length and correctly in CSS terms.
- **L2** (the cell's horizontal padding) — *local defect*: an unchecked constant.
- **L3** (the officers line's leading) — *design-system drift*: a ramp row the
  element does not sit on.
- **L4** (the officers line's target) — *design-system drift*: the surface's own
  48px floor, which the comment beside the control cites and the control misses.
- **L5, L6, L7** (three false claims in comments) — *local defects*. This project
  treats a comment's factual claims as first-class: the previous gate's critique
  B2 was exactly this and was adopted with a fix commit.
- **L8** (the bar figure) — *local defect in the record*, not in the build.

## Method note, because it decided two findings

**The focus ring was settled by screenshotting the row focused and unfocused and
diffing the two.** The changed pixels are the indicator and nothing else. That is
the only method that would have caught it: `getComputedStyle` reports the key's
outline as `solid 2px rgb(255,255,255)` at `-2px` offset — correct, present, and
not painted. The previous gate read the computed style, found it correct, and
recorded the defect as fixed.

⚠️ **And the same rule caught the lead out in the other direction.** An early
read of the hover state returned the rest colour at both widths and looked like
a dead hover; it was a read taken inside the 150ms transition. Waiting 400ms
shows rest `rgb(22,48,92)` → hover `rgb(13,29,56)`. That finding was dropped
before it was written down. A review is a set of claims, not an inventory, and
that cuts against the reviewer as often as for them.

## What this pass did NOT find, and the gate did

The three-way convergence on the margin defect (L2) came from the
`design-reviewer` agent and from both critique assessments independently. The
lead had measured the same left edges an hour earlier — 37 against 45 at 360 —
and read them as the plate's bleed working correctly, which it is; what the lead
missed is that the *cell* then re-pads by a third value, and that the sign of the
miss inverts at `sm`. Three readers who had not seen each other's work all
reached it. Recorded because the value of a six-step gate is precisely that the
lead's own reading is not the last word on its own work — the same sentence this
receipt carried in 2026-09-19, for the same reason.

---
skill: officer
command: officer instruction, 2026-09-20 — "the navy header at the top of each page should be removed for all pages in the portal. the design skills can come up with a replacement."
date: 2026-09-20
commit: "4c216f1"
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
| **Final** | **button bottom 607.7, 32.3px of slack** |

So the surface ends *better* than it was gated at (610.5), on a page whose
layout family count also dropped from two to one.

⚠️ **And a comment asserted an unmeasured number again, one commit after this
surface's gate recorded that exact lesson.** It claimed `px-4` "lands the column
at 272 exactly" and therefore fixed the box reassurance's wrap. It does not: the
reassurance sits inside the checkbox's flex row, so its **text** column is the
content column minus 28px — 244, not 272 — and it still takes three lines. The
third line is accepted, because the bar is met with 32px to spare, and the
comment now says so. The gate's lesson was "re-derive a number before writing it
into a comment"; the refinement is **measure the column the text is actually
in**.

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

🪤 **What this receipt does NOT claim.** The seven review steps ran against
`a38a2b3`, and this change alters the surface's composition after them. The
measurements above are the lead's, re-run on the new build — the
`design-reviewer`, the critique and the audit have **not** seen the sheet. If
the officer wants that, the surface should go back through `/design-gate` rather
than be covered by this receipt; what is recorded here is the officer's
instruction, the design step's two concepts, the adopted one, and the numbers
that moved.

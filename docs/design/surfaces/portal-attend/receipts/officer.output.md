# Officer instruction, 2026-09-20 — remove the navy header from the portal

## What was asked

Delivered against the deployed preview
(`misa-website-git-design-toolkit-…vercel.app/portal`), with the navy band
circled in the screenshot:

> "the redesign can continue but with this change: the navy header at the top of
> each page should be removed for all pages in the portal. the design skills can
> come up with a replacement."

Scope, as given: **all four portal pages**, not only the two that were
`rebuilt`. The replacement was explicitly delegated to the design step.

## Context the instruction arrived in

It followed an exchange where the officer said `/portal` and `/portal/attend`
"both look similar to what existed before" and asked what had changed. The
honest answer was that the phase had changed how the portal *behaves and
measures* — height, states, focus, contrast, outcome coding — inside a visual
language that `DESIGN.md` pinned before the phase began, and that the adopted
concepts were the conservative of the two offered in each case. The navy band
was the most visible thing the phase had left untouched.

🪤 **A bolder hub concept had been on the table and was not escalated.** Hub
concept B, "the field console", put the whole hub on the navy field; its diverge
receipt says *"recorded for the officer, who may overrule at the brief review"*,
and it never came back to them as a live choice. That is a process failure worth
naming: a rejected concept that a receipt flags for the officer should be put to
them, not left in the file.

## The two concepts

Produced by `frontend-design` against the pinned system, both removing navy from
the portal body entirely and both keeping every page's `<h1>`.

### A — "The sheet is the page" — **ADOPTED**

Each portal page becomes one white `.sheet` lying on the grey page ground, its
title a masthead above a rule that bleeds to the sheet's edges. The grey shows
only as margin.

The argument is that a navy hero on a page whose whole job is a form was
applying a **brochure** device to a **tool**. The public pages are stacked
full-bleed sections; making the portal's pages *objects* instead is what stops
it resembling the marketing site — a composition change rather than a colour
change. It also gives the portal one shared device across four surfaces, which
is what "the portal reads as one place" needs now the navy is gone.

🔓 **Nothing was invented.** `.sheet` is already in `DESIGN.md` §Surfaces and
`app/globals.css:594` — white, 1px Plate Edge, the 4px plate radius,
`shadow-lift` — and already ships on `/about`. It carries its own rule that it
*must* sit on a ground that is not white, which is why `PortalSheet` owns its
`<Section ground="page">` rather than trusting a caller. And it satisfies
DESIGN.md's second idea on its own terms: *"structure is square; objects are
softened; only a thing that reads as an object lying on the page takes the 4px
plate radius"* — the argument for the radius here and against it everywhere else
in the portal.

### B — "Title and rule" — rejected

The title on the grey page ground with a hairline under it, the tool staying a
separate white surface below. Closest to `/admin`'s `PageHeader`, cheapest, and
the smallest change to what was already built and gated — but it leaves the
portal reading as a page with a header on it, which is the thing the officer had
just said looked unchanged.

## What shipped, and the two corrections along the way

**`PortalBand` is deleted**, not left orphaned: with the band gone from both its
callers it would have had zero call sites, and DESIGN.md is explicit that a
primitive with no call sites has not ended the drift it was written to end.
Phase 4 found three such components sitting unused, which is the reason that
rule exists.

**The back link was built and then removed.** Concept A showed "Member portal"
above the title on the three leaf pages, as an ancestor pointer in the position
`PageHeader` argues for. Measured, it cost 36px plus its gap — and the site
header already carries a MEMBER PORTAL button linking `/portal` on every page,
visible at all times. It duplicated an always-available control for 40px on the
one page in the codebase gated on a fold position. The hub's gate had already
flagged the same duplication from the other direction (its h1 restating the
button 90px above it).

**The first build lost the bar.** Check in's button landed at **647.7** against
a 640 fold — worse than the 610.5 the band version measured, because the band
was ~60px of chrome and the narrower sheet column plus the back link spent ~70.
Removing the back link and tightening the sheet's phone padding from `px-5` to
`px-4` brought it to **607.7, with 32.3px of slack**.

⚠️ **A comment then asserted an unmeasured number, one commit after this
surface's own gate recorded that lesson.** It said `px-4` "lands the column at
272 exactly" and so fixed the reassurance line's wrap. It does not — the
reassurance sits inside the checkbox's flex row, so its *text* column is the
content column minus 28px (the 16px box plus the 12px gap): **244, not 272**. It
still takes three lines. That is accepted rather than fixed, and the comment now
says so. Refinement to the rule: **measure the column the text is actually in.**

## Verified after the change

| | |
|---|---|
| `.chevron-notch` / `.ground-field` in any portal `<main>` | **0** at 1280, all four routes |
| `<h1>` on each route | present — Member Portal, Event Check-In, Leaderboard, My Attendance |
| Navy remaining in the portal body | the hub's 3 key columns, 2 submit buttons — controls only |
| Check in button bottom, 360×640 idle | **607.7** (bar ≤640) |
| Hub check-in row bottom, 360×640 | **265.5** (bar ≤424; was 325) |
| `npm test` | 41 files / 1142 tests green |
| `npm run test:ui` | 41 pass / 1 fail — unchanged, and the one is `/portal/lookup`'s |

## What is NOT claimed

The seven review steps ran against `a38a2b3`. This change alters the surface's
composition after them, and the numbers above are the **lead's**, re-run. The
`design-reviewer`, the critique and the audit have not seen the sheet. If the
officer wants the surface re-gated rather than amended, it should go back
through `/design-gate`; this receipt records the instruction, the concepts, the
adoption and the measurements, and claims nothing beyond them.

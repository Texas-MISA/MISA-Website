---
skill: web-design-guidelines
command: web-design-guidelines on app/(public)/portal/page.tsx
date: 2026-09-20
commit: "a660ada662ead1f827746d68f57421a98084c5b2"
output: guidelines.output.md
findings:
  - id: G1
    summary: "page.tsx:168 — `Flex children need min-w-0 to allow text truncation` is satisfied, but the same rule's neighbour is not: the flex cell's `px-6` is a fixed value inside a container whose padding is `px-4 sm:px-8`, so the row text sits on no margin at any width and the miss inverts across the breakpoint."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: G2
    summary: "page.tsx:261 — a 16px paragraph with no leading, 20px from a 16px paragraph at `leading-[1.6]`. The typography section's consistency expectation, and DESIGN.md's Body row, both point the same way."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: G3
    summary: "page.tsx:264 — the `sign in` tap target renders 44.9 x 32px. Passes WCAG 2.2 SC 2.5.8's 24px floor, misses the 44/48 native minimum the surface's own evidence step adopted as EV1."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: G4
    summary: "page.tsx:139 — no `touch-action: manipulation`, which the guidelines prescribe against the 300ms double-tap delay."
    disposition: rejected
    reason: "Settled by this surface's own evidence step and recorded there: EV4 rejected this exact guideline because Next emits a `width=device-width` viewport meta by default (the root layout's `viewport` export adds only `themeColor`), which removes the 300ms delay in every current mobile browser. Re-adopting it at a second gate would put a class in the codebase whose stated purpose is already served, against a receipt that argued it out. Unchanged from 2026-09-19."
  - id: G5
    summary: "page.tsx:266 — `sign in` is not Title Case; the guidelines ask for Title Case (Chicago) on headings and buttons."
    disposition: rejected
    reason: "Conflicts with a CLAUDE.md invariant that wins on this repo: `Button labels are sentence case in the DOM`. This is a link rather than a button, and sentence case is the house register PRODUCT.md describes (`plain, warm and unpretentious, addressed to a student`). The roster gives web-design-guidelines override authority over aesthetic preference on ACCESSIBILITY findings; capitalisation is neither. Unchanged from 2026-09-19."
  - id: G6
    summary: "page.tsx:96 — `Brand names, code tokens, identifiers: wrap with translate=\"no\"`. `MISA` appears three times in the destination bodies and once in the title, unwrapped."
    disposition: rejected
    reason: "A site-wide question rather than a surface one, and the wrong place to answer it. `MISA` appears in the site header's wordmark, the footer, the `<title>` of every page and the copy of all nine public pages; wrapping four instances on one noindex page and nowhere else would be inconsistent without being useful. The site is `lang=\"en\"` with no translation pipeline and no i18n in any plan. If it is ever adopted it belongs in `lib/site.ts` and the shared chrome, not here."
  - id: G7
    summary: "page.tsx:186 — the three `<h2>` elements carry `id` attributes and there is no `scroll-margin-top`, under a 61px sticky header. The guidelines ask for `scroll-margin-top` on heading anchors."
    disposition: rejected
    reason: "These ids are not anchors. They exist solely to wire `aria-labelledby` and `aria-describedby` so each row announces as its title rather than as a run-on sentence; nothing on the site links to `#attend-title`, no table of contents exposes them, and they are not in any sitemap — the page is noindex. Adding `scroll-margin-top` would be defensive code for a navigation that does not exist. 📌 The rule DOES bite one element on this route — the skip link's `#main` target under the same 61px header — but `<main>` is in `app/(public)/layout.tsx`, shared chrome outside this surface's registered files."
  - id: G8
    summary: "`Interactive states increase contrast: hover/active/focus more prominent than rest` — verified rather than read this time: rest `#16305c` 13.03:1 on white, hover and press `#0d1d38` 16.80:1, and the press state confirmed on an emulated `hover: none` / `pointer: coarse` device where hover correctly does nothing."
    disposition: rejected
    reason: "A pass, and recorded because the 2026-09-19 receipt filed the same check as `passes as written, but the check is misleading here` — Tailwind v4 gates `hover:` behind `@media (hover: hover)`, so satisfying the rule in the source said nothing about the device this surface is designed for. That gap was closed by the previous gate's M1 fix, and this run is the first time the rule has been confirmed on the device class rather than in the stylesheet. Nothing to fix."
---

Guidelines fetched fresh before review from
`https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`,
per the skill. Checked against the **rendered** page as well as the source,
because several of these rules are only answerable by computed style — G8 is the
clearest case, and the 2026-09-19 run could not answer it.

📌 **Three adopted, five rejected, and every rejection names the rule or the
receipt it conflicts with.** G4 and G5 are unchanged from the previous gate:
this repository has already had both arguments and written down the answers, in
the surface's own evidence receipt and in CLAUDE.md. G6 and G7 are new, and both
are cases where the guideline is real but its owner is not this surface.

🪤 **G1 is the one this checklist nearly missed, and the reason is worth
keeping.** Its content-handling rule *"flex children need `min-w-0`"* is
satisfied — that was the previous gate's G1 and it was fixed. Having found
`min-w-0` present, the obvious reading is that the flex cell is correct. What
the checklist has no rule for is whether a container's inner padding bears any
relation to its parent's, and that is where the defect was: `px-6` against a
sheet at `px-4 sm:px-8`. A checklist can only ask the questions it contains, and
the three reviewers who found this one were all reasoning about composition
rather than working a list.

**Not applicable to this surface, checked and confirmed:** forms (none), images
(none), i18n and `Intl` formatting (no dates or numbers), hydration safety (no
client component, no `value` without `onChange`), dark mode (refused
site-wide), large lists (three items), destructive actions (none), URL state (no
state), drag and gesture (none), autoplay media (none), safe-area insets (no
full-bleed layout in this surface). **Anti-patterns: none of the flagged list is
present.** **axe-core across wcag2a, wcag2aa, wcag21a, wcag21aa and wcag22aa
returns 0 violations and 0 incomplete at 360, 768 and 1280.**

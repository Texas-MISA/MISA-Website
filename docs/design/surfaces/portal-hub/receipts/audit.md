---
skill: impeccable
command: /impeccable audit app/(public)/portal/page.tsx
date: 2026-09-20
commit: "a660ada662ead1f827746d68f57421a98084c5b2"
output: audit.output.md
findings:
  - id: AU1
    summary: "Accessibility — the focus indicator excluded 48px of its own target. Measured by diffing a focused row against the same row unfocused: the navy runs stop at the key's left edge, the row's right edge paints nothing, and the key's white ring contributes only a 2px bar at the seam. WCAG 2.2 SC 2.5.8 and 2.4.11 are still met, so this is a craft defect rather than a conformance failure — but the indicator named 48px of a link it did not enclose, and the file claimed the opposite."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: AU2
    summary: "Responsive — the row text column aligns with the masthead at no width, and the sign of the miss inverts across `sm` (rows +8px in at 320/360/390, -8px out at 768/1280). The plate bleeds by the sheet's padding; the cell re-pads by a flat `px-6` compared against nothing."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: AU3
    summary: "Responsive / implementation integrity — two 16px paragraphs at two leadings 20px apart: the row bodies at `leading-[1.6]` (25.6px, the ramp's Body row) and the officers line with no leading class inheriting 1.5 (24px)."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: AU4
    summary: "Responsive / touch targets — the officers sign-in link measures 44.9 x 32px, the one target on the page under the audit's 44x44 check and under EV1's 44pt/48dp, on a surface whose every other target is 48px+ and whose comment beside this control says so."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: AU5
    summary: "Implementation integrity — three factual claims in the comments that the build contradicts: a layout-family declaration naming a band deleted by `ca5cd06` and a section count of two against one; the officers line described as being on the grey at 7.60:1 when it is on white at 8.51:1; and `lowest ratio anywhere on the route is 7.60:1` stated two lines after the same paragraph correctly names 4.84:1."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: AU6
    summary: "Performance — a static Server Component: no client bundle, no images, no layout reads in render, no `will-change`, no expensive animation, one tree-shaken icon, `<Link>` at Next 16's default prefetch. Zero console errors or warnings at every width and no hydration diff."
    disposition: rejected
    reason: "A passing dimension, recorded so the health score is auditable rather than asserted. Nothing to fix."
  - id: AU7
    summary: "Theming — no hard-coded colour anywhere in the surface; every fill and ink is a token. The only two arbitrary values are `leading-[1.6]`, which IS the ramp's Body leading, and `[-webkit-tap-highlight-color:transparent]`, a property with no token. No dark mode is in scope: DESIGN.md refuses it site-wide and the toolkit records that refusal as settled."
    disposition: rejected
    reason: "A passing dimension, recorded for the same reason as AU6. Nothing to fix."
---

## Audit Health Score

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | **3 → 4** | AU1: the indicator did not enclose the navy key, and `getComputedStyle` said it did. |
| 2 | Performance | **4** | Static Server Component (AU6). |
| 3 | Theming | **4** | Full token system (AU7). |
| 4 | Responsive | **3 → 4** | AU2 and AU4: an unchecked constant, and one target under the floor the page cites. |
| 5 | Implementation integrity | **2 → 4** | AU5: three claims the build contradicts, one self-contradictory within seven lines. |

🔴 **Implementation integrity scored 2 on a surface the detector calls clean.**
All three of AU5's claims live in comments, and comments are where this project
keeps the reasoning that stops a decision being re-litigated. A comment naming a
deleted element as a spent layout family is not cosmetic: DESIGN.md §Layout
families says *"declare the family in a code comment per section so the count is
a grep rather than a memory"*, which makes that block the enforcement mechanism
and a stale entry a wrong count in the only place the count is kept.

📌 **AU1 is the same failure the previous audit filed, and it was not fixed.**
The 2026-09-19 audit's AU1 said the ring measured 1.00:1 over the key. The fix —
a white ring on the key — was adopted, and the file then explained at length, and
accurately, why it works. It was verified by computed style, which reports that
white outline as present, correct and inset by the matching 2px. **It never
painted.** The lesson is narrower and sharper than "verify the fix": *a fix
verified by the same instrument that would have missed the defect is not
verified.* The 2026-09-19 critique's Assessment B illustrated half of this by
measuring the ring's bounds and never its colour; this gate is the other half —
measuring its colour and never its paint.

⚠️ **AU4 is also a repeat, and it under-delivered the first time.** The previous
gate raised this target from 39.3 × 17 to 44.9 × 32 and recorded it as fixed
against a standard it still missed. It is now 44.9 × 48, by the same `min-h-12`
round 1a applied to the header's MEMBER PORTAL button — so the site's one door to
the portal and the portal's own secondary link finally hold the same floor.

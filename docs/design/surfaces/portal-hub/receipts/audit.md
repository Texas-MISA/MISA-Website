---
skill: impeccable
command: /impeccable audit app/(public)/portal/page.tsx
date: 2026-09-19
commit: "23fab67c3edd28001eafd034e8566b67fc94c1f5"
output: audit.output.md
findings:
  - id: AU1
    summary: "Accessibility — the row link's focus indicator is `2px solid var(--misa-blue)` and the row spans both the white cell and the 48px navy key, so the indicator measures 1.00:1 over the key. WCAG 2.2 §Focus Appearance wants the whole indicator to contrast with what it sits on."
    disposition: adopted
    fix_commit: "ab3f6c9c8054754eb491871edaf176a361371219"
  - id: AU2
    summary: "Accessibility / semantic HTML — `<h2>` inside `<span>`, and the row body is a `<span class=\"block\">` where it is a sentence."
    disposition: adopted
    fix_commit: "ab3f6c9c8054754eb491871edaf176a361371219"
  - id: AU3
    summary: "Responsive — the `flex-1` wrapper lacks `min-w-0`, so its automatic minimum size is its content's and a long title cannot wrap beside the fixed 48px key."
    disposition: adopted
    fix_commit: "ab3f6c9c8054754eb491871edaf176a361371219"
  - id: AU4
    summary: "Responsive / touch targets — the officers sign-in link is a 39 × 17px target, under WCAG 2.2's 24px floor, on a surface whose every other target is ≥48px (EV1)."
    disposition: adopted
    fix_commit: "ab3f6c9c8054754eb491871edaf176a361371219"
  - id: AU5
    summary: "Implementation integrity — `text-sm` (14px) is on no row of DESIGN.md §The ramp, and the destination titles render at the same ramp step as the page h1."
    disposition: adopted
    fix_commit: "ab3f6c9c8054754eb491871edaf176a361371219"
  - id: AU6
    summary: "Theming — no hard-coded colour anywhere in the surface; every fill and ink is a token (`--misa-blue`, `--misa-blue-dark`, `--misa-secondary`, `--misa-hairline`, `bg-white`). No dark mode is in scope: DESIGN.md refuses it and the toolkit records that refusal as settled."
    disposition: rejected
    reason: "A passing dimension, recorded so the score below is auditable rather than asserted. Nothing to fix."
  - id: AU7
    summary: "Performance — a static Server Component: no client bundle, no images, no layout reads, no `will-change`, no expensive animation, `<Link>` at Next 16's default `prefetch=\"auto\"`. The one icon is a tree-shaken `lucide-react` import."
    disposition: rejected
    reason: "A passing dimension, recorded for the same reason as AU6. Nothing to fix."
---

## Audit Health Score

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | **2 → 4** | AU1: the focus indicator was 1.00:1 over the navy key — an indicator that is *placed* correctly and *coloured* invisibly. |
| 2 | Performance | **4** | Static Server Component; nothing to optimise (AU7). |
| 3 | Theming | **4** | Full token system, no hard-coded values (AU6). |
| 4 | Responsive | **3 → 4** | AU3 and AU4: a missing `min-w-0` and a 39 × 17px tap target. |
| 5 | Implementation integrity | **3 → 4** | AU5: two type-ramp breaks the deterministic scan cannot see. |

🔴 **Accessibility scored 2 before the gate, and the page's own comments are
the reason that is surprising.** This file argues *at length* and *correctly*
about the focus ring — that `outline-offset: 2px` would draw across the 1px
seam onto the neighbouring cell, and that `-outline-offset-2` draws it inside
the cell it names. All of that is true, and it fixed a real defect. It just
answered the question "**where** is the ring" so thoroughly that "**what colour
is it, over each thing it crosses**" was never asked — on the one component in
the portal that deliberately spans two grounds. A careful argument about the
right half of a problem is not evidence the other half was considered.

📌 **AU1 is the same failure `app/globals.css:316-317` already names.** That
comment exists to explain `.on-navy`: "a navy ring is invisible, so sections
with a navy background carry `.on-navy` and flip it to white." The rule was
written for *sections*; the key is a 48px child of a link. The ground rule was
right, its scope was a section, and this surface built the first thing that
crosses a ground boundary *inside a single focusable element*. Recorded because
the next portal surface that puts a navy element inside a link will hit it
again — see `DESIGN.md` §Components.

🪤 **Two dimensions score 4 with no finding to fix, and they are still
recorded** (AU6, AU7) as `rejected`. A dimension that passes silently is
indistinguishable in a receipt from a dimension nobody checked.

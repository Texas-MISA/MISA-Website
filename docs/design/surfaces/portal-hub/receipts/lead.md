---
skill: impeccable
command: /impeccable polish app/(public)/portal/page.tsx
date: 2026-09-19
commit: "23fab67c3edd28001eafd034e8566b67fc94c1f5"
output: lead.output.md
findings:
  - id: L1
    summary: "`<h2>` rendered inside `<span class=\"flex-1 px-6 py-5\">` — a span is phrasing content and may not contain a heading. Confirmed in the rendered markup, not inferred."
    disposition: adopted
    fix_commit: "ab3f6c9c8054754eb491871edaf176a361371219"
  - id: L2
    summary: "The officer line is `text-sm` (14px), a size on NO row of DESIGN.md §The ramp — it has 12 (Eyebrow) and 16 (Body) and nothing between. The detector cannot see it: it reads arbitrary `text-[Npx]` values against the ramp, and `text-sm` is neither."
    disposition: adopted
    fix_commit: "ab3f6c9c8054754eb491871edaf176a361371219"
  - id: L3
    summary: "The `flex-1` wrapper has no `min-w-0`, so a flex child's automatic minimum size is its content's and a long title cannot wrap beside the 48px key."
    disposition: adopted
    fix_commit: "ab3f6c9c8054754eb491871edaf176a361371219"
  - id: L4
    summary: "Row bodies are `<span class=\"block\">` where the content is a sentence per destination; a `<p>` is the right element once the wrapper is a `<div>` that may legally hold one."
    disposition: adopted
    fix_commit: "ab3f6c9c8054754eb491871edaf176a361371219"
---

The lead's own pass, `impeccable` in Operate mode against the craft floor. The
concept is not in question — this is refinement, and everything outside the
scope of the four findings above is preserved.

**Classification (polish.md §1).** L1, L3 and L4 are *local defects*: the
implementation is incomplete, not the concept wrong. L2 is *design-system
drift* — a size that exists nowhere in the ramp, reached for because 14px is
the habit of the three un-rebuilt portal surfaces this phase is about to
replace (`lookup-form.tsx`, `checkin-form.tsx`, `leaderboard/page.tsx` all
carry it). Fixing it here rather than inheriting it is the point of rebuilding
the hub first.

🪤 **The home page had already argued this exact question and the hub lost the
argument by not having it.** `app/(public)/page.tsx:280` carries a comment
rejecting `text-sm` for the project cards — "14px is a caption size … which is
the wrong weight". That reasoning distinguishes a four-line paragraph from a
one-line footnote, so it does not settle the officer line on its own; what
settles it is that the ramp has no 14px row at all, and phase 5 suppresses
against the ramp that actually ships or not at all.

📌 **What the lead did NOT find, and the gate did.** The two most serious
defects on this surface — the focus ring vanishing on the navy key, and
`Title`'s size being unoverridable — came from the `design-reviewer` agent and
from checking a precedent rather than from this pass. Recorded because the
value of a six-step gate is precisely that the lead's own reading is not the
last word on its own work.

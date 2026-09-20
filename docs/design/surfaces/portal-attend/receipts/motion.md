---
skill: emil-design-eng
command: /emil-design-eng review the form-to-outcome transition on /portal/attend
date: 2026-09-19
commit: "a38a2b3d3fb740cc9565fdfb2036dfee72449efb"
output: motion.output.md
findings:
  - id: M1
    summary: "The form-to-outcome swap could take a ~200ms crossfade — the question `diverge.output.md` explicitly left for this step (\"emil-design-eng decides whether the swap from form to result gets a 200ms crossfade\")."
    disposition: rejected
    reason: "Three surface-specific reasons, in order of weight. (1) The brief's one non-negotiable is that a member always knows which outcome they got and that a recorded check-in never looks like a failure — during a crossfade the affirm and critical grounds are both partly on screen, and the reader is someone glancing at a phone at a door. (2) The portal's one named officer anti-goal is 'slower to check in', and the outcome screen is the answer to the member's only question. (3) It cannot exist before hydration, where the swap is a full document load, so it would appear only on fast devices — inverted from where a smoothing effect helps. Mechanically it would also need both subtrees mounted at once, which is machinery on a component whose constraint is working without JavaScript."
  - id: M2
    summary: "Buttons have no `transform: scale(0.97)` on `:active`, which this skill asks for on every pressable element."
    disposition: rejected
    reason: "Overruled by DESIGN.md, which bans a scale on a control outright (Square Corner / flat-at-rest: 'Press feedback is an ink change, never a transform'). `components/ui/button.tsx` already records this exact overrule and keeps this skill's 150ms timing for the colour swap. A settled system decision, not relitigated per surface."
  - id: M3
    summary: "`transition-colors duration-150` on the controls is not gated behind `@media (hover: hover) and (pointer: fine)`, so `:hover` sticks after a tap on the touch devices this page is built for."
    disposition: deferred
    reason: "Correct in general but not this surface's to fix: it lives in `components/ui/button.tsx` and `field.tsx`, shared with /admin and every public page. Practical effect here is nil — `:hover` and `:active` resolve to the same navy, and the button unmounts on the success path. Tracked in tasks.md under v2 phase 3 part 6, which owns 'the shared primitives re-measured on the grounds the portal now puts them on'."
---

**The concept left one motion question open and this step closes it: nothing on
this surface should animate.** Full reasoning, run through the Animation
Decision Framework in order, in `motion.output.md`.

The surface moves nothing of its own — no `data-reveal`, no keyframes, no
transform. The only transitions are inherited from `components/ui/`: 150ms
colour swaps on buttons and inputs, which is this skill's own figure for that
case.

🪤 **Why this receipt is required at all is worth recording.**
`scripts/design/receipts.mjs` decides whether a surface moves by grepping its
files for `data-reveal|animate-|transition-|…`. Both hits here are **inside
comments** — `page.tsx:42` and `checkin-form.tsx:637`, each explaining why a
reveal must never be added to this page. The grep cannot tell a comment from
code. The step was run in full regardless: the conclusion is worth having on the
record for a surface whose adopted concept explicitly deferred the question, and
deleting a comment to drop a required review step would be the wrong way to
resolve it.

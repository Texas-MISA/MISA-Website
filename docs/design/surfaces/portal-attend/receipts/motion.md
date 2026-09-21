---
skill: emil-design-eng
command: /emil-design-eng review the transitions on /portal/attend — the sheet build, every state
date: 2026-09-20
commit: "77d2c568ed093f78a6b437e053bbef0533eff9e4"
output: motion.output.md
findings:
  - id: M1
    summary: "The focus ring on the Check in button is ANIMATED, and it fades in from invisible. `components/ui/button.tsx`'s `BASE` carries `transition-colors duration-150`, and Tailwind v4 puts `outline-color` inside that shorthand — resolved on the running button as `color, background-color, border-color, outline-color, …` at 0.15s. The button's unfocused `outline-color` computes to `currentColor`, which on `bg-misa-blue` is WHITE, so the ring animates white → navy on a white sheet. Sampled on the page: t≈1ms rgb(255,255,255) = 1.00:1 against the sheet, t≈31ms rgb(214,219,226) ≈1.41:1, t≈62ms rgb(148,160,180) ≈2.67:1, t≈151ms rgb(22,48,92) = 13.03:1. The indicator for the page's primary action does not exist for the first ~30ms and does not clear 3:1 until ~70–90ms. This skill's framework is unqualified on the point: \"Never animate keyboard-initiated actions.\" The three text inputs are unaffected — their currentColor is Graphite, so their ring fades dark-to-dark and clears 3:1 throughout."
    disposition: deferred
    reason: "Not fixable at this surface, and the reason is mechanical rather than a scope preference. Every Tailwind `transition-*` utility sets `transition-property` at the same specificity, so appending `transition-[color,background-color]` to the submit's className ties with `BASE`'s `transition-colors` and the winner is decided by Tailwind's emission order — the same tie that made `<Title className=\"text-[22px]\">` render at 26px, and that `Title`'s and `Banner`'s `size` props both exist to avoid. The fix has to change `BASE` itself, which is one string shared by ~40 public call sites and every /admin button. Tracked for v2 phase 3 part 6, which owns the shared primitives on the grounds the portal now puts them on. 📌 Round 2 raised the identical mechanism on the header's MEMBER PORTAL button and left it as an open officer question; this is the same cause reached independently from a second surface, and the two should be fixed together."
  - id: M2
    summary: "Buttons have no `transform: scale(0.97)` on `:active`, which this skill asks for on every pressable element."
    disposition: rejected
    reason: "Overruled by DESIGN.md, which bans a transform on a control outright (Square Corner / flat-at-rest: 'Press feedback is an ink change, never a transform'). Re-verified on the page rather than restated: press changes `background-color` only, rgb(22,48,92) → rgb(13,29,56), with no transform anywhere. `components/ui/button.tsx` already records this overrule at its own call site and keeps this skill's 150ms figure for the swap. A settled system decision, not relitigated per surface."
  - id: M3
    summary: "`transition-colors duration-150` on the controls is not gated behind `@media (hover: hover) and (pointer: fine)`, so `:hover` sticks after a tap on the touch devices this page is built for."
    disposition: deferred
    reason: "Correct in general and still not this surface's to fix: it lives in `components/ui/button.tsx` and `field.tsx`, shared with /admin and every public page. Practical effect here is still nil — `:hover` and `:active` resolve to the same navy on the submit, and the button unmounts on the success path. Tracked with M1 under part 6. Unchanged from the 2026-09-19 pass, and re-checked against the sheet build rather than carried forward on trust."
  - id: M4
    summary: "The form-to-outcome swap could take a ~200ms crossfade — the question `diverge.output.md` left for this step."
    disposition: rejected
    reason: "Re-asked against the NEW composition, because the officer's header removal changed what the swap happens inside: the outcome panel now replaces the form within one white sheet rather than under a navy band, which is a stronger case for a crossfade than the old build had. It still loses, for the same three surface-specific reasons. (1) The brief's one non-negotiable is that a member always knows which outcome they got and that a recorded check-in never looks like a failure — mid-crossfade the affirm and critical grounds are both partly on screen, to someone glancing at a phone at a door. (2) The portal's one named officer anti-goal is 'slower to check in'. (3) It cannot exist before hydration, where the swap is a full document load — verified this pass with JavaScript disabled — so it would appear only on fast devices, inverted from where smoothing helps. Mechanically it would also need both subtrees mounted at once, machinery on a component whose constraint is working without JavaScript."
  - id: M5
    summary: "Nothing on this surface is gated behind `prefers-reduced-motion`."
    disposition: rejected
    reason: "Correct as built, by this skill's own accessibility rule: 'Reduced motion means fewer and gentler animations, not zero. Keep opacity and color transitions that aid comprehension. Remove movement and position animations.' There is no movement here to remove — no `data-reveal`, no keyframes, no transform, re-verified on every state — and the 150ms colour swaps are exactly the comprehension aid the rule protects. Recorded because `web-design-guidelines` raises it as a flat rule (G7) and the two skills have to be reconciled rather than averaged."
---

**The surface still moves nothing of its own, and that verdict is unchanged.**
No `data-reveal`, no `@keyframes`, no `transform`, no Motion import — re-verified
on every state at 360 and 1280. The only transitions are inherited from
`components/ui/`: 150ms colour swaps, which is this skill's own figure for that
case.

🔴 **What this pass found that the 2026-09-19 pass could not have is that one of
those inherited transitions animates the FOCUS RING.** That pass ran against a
build whose primary button sat under a navy band and it did not sample the
ring's colour over time; `outline-color` is inside Tailwind v4's
`transition-colors`, and nobody chose that. Full timing table and the contrast
at each sample in `motion.output.md`.

⚠️ **M1 is a timing finding, not the hub's paint-order one.** The rings here all
paint, at their exact geometric area — see `audit.output.md`'s pixel diffs. What
is wrong is *when* the indicator becomes visible, not whether it exists.

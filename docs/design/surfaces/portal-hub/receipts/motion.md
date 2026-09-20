---
skill: emil-design-eng
command: emil-design-eng review of every transition and reveal on app/(public)/portal/page.tsx and components/ui/portal-band.tsx
date: 2026-09-19
commit: "23fab67c3edd28001eafd034e8566b67fc94c1f5"
output: motion.output.md
findings:
  - id: M1
    summary: "No press feedback on the row link, on a surface whose primary persona is a member tapping at an event. Tailwind v4 gates `group-hover:` behind `@media (hover: hover)` (verified at compiled stylesheet line 3752), and the file contained no `active:` variant at all, so the touch user received no acknowledgement of a tap until the client-side transition painted."
    disposition: adopted
    fix_commit: "ab3f6c9c8054754eb491871edaf176a361371219"
  - id: M2
    summary: "Emil's checklist prescribes `transform: scale(0.97)` on `:active` for any pressable element, as the instant 'the interface heard you' feedback."
    disposition: rejected
    reason: "Refused on DESIGN.md's authority, and the refusal is narrow: this system states that colour swaps are the only hover and that **nothing moves on interaction**. The roster gives `emil-design-eng` the final word on easing, duration and *whether to animate at all* — and that authority is honoured in M1, where its diagnosis was adopted in full. What is refused is only the *mechanism*: the purpose Emil's rule serves (instant press acknowledgement) is met by a colour swap on `group-active:`, in this system's own vocabulary. That is a synthesis, not an average — the finding's goal is fully satisfied and only its transform is dropped."
  - id: M3
    summary: "Hover animations should be gated behind `@media (hover: hover) and (pointer: fine)` so a tap does not trigger a sticky false-positive hover on touch."
    disposition: rejected
    reason: "Already satisfied, and verified rather than assumed: Tailwind v4 emits `hover:`/`group-hover:` inside `@media (hover: hover)` automatically. Confirmed in the compiled stylesheet — line 3752 opens the media block and 3753 is `.group-hover\\:bg-misa-blue-dark`. Adding the query by hand would duplicate it. 🪤 The same fact is what *creates* M1, so this rule is satisfied and load-bearing in the opposite direction."
  - id: M4
    summary: "Durations and easing: `transition-colors duration-150` on both the title ink and the key fill."
    disposition: rejected
    reason: "Correct as built, recorded so the timing is auditable. 150ms is exactly DESIGN.md's `hover` duration token, and it sits inside Emil's own 100–160ms band for press feedback. Emil's decision tree sends a hover/colour change to `ease`, which is Tailwind's default timing function here; none of DESIGN.md's three easing tokens (reveal, out-quint, in-out-quint) is a hover curve, so there is no system value being ignored."
  - id: M5
    summary: "Whether the removal of `data-reveal` from the band and the three destinations needs motion design."
    disposition: rejected
    reason: "Removal needs no motion design — the plan said so before the build and the measurement confirms it. By Emil's own frequency table this is the right call twice over: the hub is on the highest-frequency path in the product (a member reaching check-in at an event), and the framework's first question is whether a thing should animate at all. A reveal here holds the check-in destination at `opacity: 0` until an IntersectionObserver fires, which is the officer's named anti-goal expressed in CSS."
---

## Review

| Before | After | Why |
| --- | --- | --- |
| No `:active` state on a full-row link (touch-first surface) | `group-active:text-misa-blue-dark` on the title, `group-active:bg-misa-blue-dark` on the key | The element must feel responsive to press. `group-hover:` is gated to `@media (hover: hover)`, so on the phone this page is designed for there was no feedback at all. |
| Emil's `transform: scale(0.97)` on `:active` | Colour swap only, same `duration-150` | DESIGN.md: nothing in this system moves on interaction. The purpose is met, the mechanism is the system's. |
| Browser default tap highlight over the new press state | `[-webkit-tap-highlight-color:transparent]` | Two competing acknowledgements of one tap; the explicit state should be the feedback, not a grey flash on top of it. |
| `transition-colors duration-150` | unchanged | Already DESIGN.md's `hover` token and inside Emil's 100–160ms press band. |
| No `data-reveal` on the band or destinations | unchanged | Correct. Highest-frequency path in the product; a reveal is the anti-goal in CSS. |

📌 **M1 was reached three independent ways and that is the strongest signal
this gate produced.** This step found it in the compiled stylesheet, critique
Assessment A found it from the emotional arc ("momentarily dead" at the tap,
scoring *visibility of system status* 2/4), and the lead found it while
checking whether Tailwind v4's hover gating was already handled. None of the
three saw the others' work.

🪤 **The thing that made it invisible to code review: the file already said it
did this.** Its comment reads "Hover and press swap ink only — no lift, no
scale", which is an accurate statement of the *intent* and of what DESIGN.md
permits. There was no `active:` variant anywhere in the file. **A comment
describing a decision is not evidence the decision was implemented**, and a
grep for the word "press" would have found the comment and stopped.

⚠️ **`prefers-reduced-motion`: deliberately nothing.** Emil's rule is that
reduced motion means fewer and gentler animations, not zero, and that opacity
and colour transitions which aid comprehension should be kept. The only motion
on this surface is a 150ms colour change that *is* the feedback, so a reduced-
motion branch would remove the acknowledgement M1 was filed to add. No
`@media (prefers-reduced-motion)` rule is correct here, and is not an omission.

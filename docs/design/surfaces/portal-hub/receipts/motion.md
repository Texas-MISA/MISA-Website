---
skill: emil-design-eng
command: emil-design-eng review of every transition and reveal on app/(public)/portal/page.tsx and components/ui/portal-sheet.tsx
date: 2026-09-20
commit: "a660ada662ead1f827746d68f57421a98084c5b2"
output: motion.output.md
findings:
  - id: M1
    summary: "The press state added at the 2026-09-19 gate was proved from the compiled stylesheet and never from a device that cannot hover. Verified live at this gate on an emulated `hover: none` / `pointer: coarse` device: hover correctly does nothing and pointer-down swaps the title ink and the key fill to `--misa-blue-dark`. The fix is real on the device class it exists for."
    disposition: rejected
    reason: "A pass, recorded because the previous gate's central motion finding was the ABSENCE of this state and it was reached three independent ways. Proving a fix on the device it was written for is a different claim from proving it in the stylesheet, and only the second had been made. Nothing to fix."
  - id: M2
    summary: "Emil's checklist prescribes `transform: scale(0.97)` on `:active` for any pressable element, as the instant `the interface heard you` feedback."
    disposition: rejected
    reason: "Refused on DESIGN.md's authority, and the refusal is narrow: this system states that colour swaps are the only hover and that NOTHING moves on interaction. The roster gives emil-design-eng the final word on easing, duration and whether to animate at all, and that authority is honoured — what is refused is only the MECHANISM. The purpose Emil's rule serves, instant press acknowledgement, is met by the colour swap on `group-active:`, in this system's own vocabulary. A synthesis, not an average. Unchanged from 2026-09-19."
  - id: M3
    summary: "Hover animations should be gated behind `@media (hover: hover)` so a tap does not trigger a sticky false-positive hover on touch."
    disposition: rejected
    reason: "Already satisfied — Tailwind v4 emits `hover:` and `group-hover:` inside `@media (hover: hover)` automatically. Verified this time by BEHAVIOUR rather than by reading the compiled stylesheet: on an emulated Pixel 5, `matchMedia(\"(hover: hover)\").matches` is false and the hover swap correctly does not fire, while press does. Adding the query by hand would duplicate it."
  - id: M4
    summary: "🔴 The 2026-09-19 motion receipt's M4 rejected an easing change with the reason `Emil's decision tree sends a hover/colour change to ease, which is Tailwind's default timing function here`. That is factually wrong: the rendered transition-timing-function on both the title ink and the key fill is cubic-bezier(0.4, 0, 0.2, 1) — Tailwind's default, which is NOT CSS `ease` (cubic-bezier(0.25, 0.1, 0.25, 1)). Read off the computed style on the running page. And cubic-bezier(0.4, 0, 0.2, 1) has an ease-IN start, which DESIGN.md §Motion says this system does not have: `There is no ease-IN curve on purpose`."
    disposition: rejected
    reason: "The conclusion stands and the REASON is now a true one instead of a false one, which is the whole finding. DESIGN.md's three easing tokens — `--ease-reveal`, `--ease-out-quint`, `--ease-in-out-quint` — are all movement curves for entrances; there is NO token for a hover or press colour swap, so reaching for a quint curve on a 150ms colour change would be drift rather than correction, and inventing a token is a site-wide motion decision the officer has not been asked for. 🪤 The tension is real and it is not this page's: `transition-*` in Tailwind carries that curve on EVERY transition in the codebase. Raised, not resolved. Same for `duration-150` on the press where DESIGN.md names `--dur-press: 140ms` distinctly from `--dur-hover: 150ms` — 10ms on a colour swap, and Tailwind has no `duration-140` step, so an arbitrary value would be the worse trade."
  - id: M5
    summary: "`transition-colors` covers `outline-color`, so a focus indicator is nominally animated on a keyboard action — Emil's `never animate keyboard-initiated actions`, which are repeated hundreds of times a day and where animation reads as lag."
    disposition: rejected
    reason: "Verified as a non-issue ON THE ROWS and it is worth recording why: the ring reads its final rgb(22,48,92) on the first frame, because `outline-style` switches discretely from `none` to `solid` and the start colour already equals the end colour. Measured by sampling the computed value at the instant of focus. 🔴 The same rule DOES bite the header's MEMBER PORTAL button, where the unfocused `outline-color` is currentColor = white on a white header, so its ring genuinely fades white to navy over 150ms — found by the design-reviewer as DR6 and deferred there, because `components/ui/button.tsx` is shared chrome outside this surface's files."
  - id: M6
    summary: "The removal of `data-reveal` from the destinations, and the absence of any `prefers-reduced-motion` branch."
    disposition: rejected
    reason: "Both correct, and both re-verified rather than carried over. `main` contains ZERO `[data-reveal]` nodes, so the reveal is not in play at all: by Emil's own frequency table this is right twice over, because the hub is on the highest-frequency path in the product and a reveal would hold the check-in destination at `opacity: 0` until an observer fires — the officer's anti-goal expressed in CSS. And because nothing translates, a reduced-motion branch would have nothing to remove except the 150ms colour change that IS the press feedback, which Emil's rule explicitly says to keep: reduced motion means fewer and gentler animations, not zero. Measured with an emulated reduced-motion context: geometry identical, check-in row bottom 267.2, opacity 1, transform none."
---

`components/ui/portal-band.tsx` no longer exists — the officer deleted it from
every portal page on 2026-09-20 — so the surface reviewed here is
`app/(public)/portal/page.tsx` and `components/ui/portal-sheet.tsx`. The whole
motion vocabulary on it is **one 150ms colour change on two properties**, and
that change is the feedback rather than decoration.

## 🔴 Every finding in this receipt is a rejection, and that is the correct result

`/design-gate` says plainly: *"If every finding is rejected, say so plainly — the
checker fails the surface, and that is the point."* The checker is satisfied by
the other five review steps, which adopted thirteen findings between them. **The
motion step adopted none, because the motion is right.** M1 records a previous
fix now verified on the device it was written for; M2, M3 and M6 are unchanged
refusals with unchanged reasons; M5 is a rule that bites elsewhere and not here.

**M4 is the one thing this step changed, and it changed a receipt rather than the
code.** The previous motion receipt rejected an easing change for a stated reason
that was not true of the rendered page. The rejection was right; the reason was
wrong; a receipt that carries a false reason is worse than one that carries none,
because the next reviewer will trust it. ⚠️ CLAUDE.md's *"a review is a set of
claims, not an inventory — re-derive against the code, including findings this
project wrote down itself"* is exactly this case, and this is the second time
this phase it has caught the project's own receipts rather than the code.

📌 **What M4 leaves open, deliberately.** DESIGN.md says the system has no ease-in
curve; Tailwind's default `transition-*` curve has an ease-in start; therefore
**every transition in this codebase contradicts a stated design rule**, not just
these two. That is a site-wide motion question with a real answer on both sides
— name a hover/press easing token, or amend the rule to exempt colour swaps —
and it belongs to the officer and to phase 5, not to a hub gate.

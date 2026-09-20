# emil-design-eng — motion review, `/portal/attend`

Run 2026-09-19 against `a38a2b3d3fb740cc9565fdfb2036dfee72449efb`.

The question this step exists to answer was left open by the concept:
`diverge.output.md` says *"emil-design-eng decides whether the swap from form to
result gets a 200ms crossfade."* **It does not.** The reasoning is below, run
through the Animation Decision Framework in order.

| Before | After | Why |
| --- | --- | --- |
| Form → outcome swaps instantly | *unchanged* | A crossfade would put a half-faded screen between "submitted" and "recorded" on the one page whose brief says a member *"must always know which outcome they got"*. It also cannot exist before hydration, where the swap is a full page load — so it would be present exactly when the phone is fast and absent exactly when it is slow. |
| `transition-colors duration-150` on controls | *unchanged* | Already the right call: 150ms is this skill's own figure for a colour swap, and colour is the only thing that moves here. |
| No `:active` transform on buttons | *unchanged* | `transform: scale(0.97)` on press is this skill's recommendation and it is **overruled by DESIGN.md**, which bans a scale on a control outright (Square Corner / flat-at-rest). `components/ui/button.tsx` records the overrule and keeps the 150ms timing. Not relitigated per surface. |
| No spinner in the pending button | *unchanged* | EV7 asks for preserved layout and busy status, not a spinner; the label swap plus `aria-busy` carries it, and the button's geometry is identical between labels (measured, 360 and 1280). |
| Caution outline appears instantly on `unmatched` | *unchanged* | It arrives with the banner on a new render — there is no prior state to transition from. |
| `transition-colors` is not behind `@media (hover: hover) and (pointer: fine)` | **deferred to part 6** | A real point on a touch-first page: `:hover` sticks after a tap on touch. But it lives in `components/ui/button.tsx` and `field.tsx`, shared with `/admin` and every public page, so it is not this surface's to change — and the practical effect here is nil, since `:hover` and `:active` resolve to the same navy and the button unmounts on the success path. |

---

## 1. Should this animate at all?

A member checks in **once per event** — a handful of times a semester. On the
frequency table that is *Rare/first-time*, the band where delight is permitted.
So frequency does not rule it out; everything below does.

## 2. What is the purpose?

The only valid purpose available is *"preventing jarring changes: elements
appearing or disappearing without transition feel broken"*. Three things
outweigh it, and each is specific to this surface rather than a general
preference for less motion:

1. **The officer's anti-goal is literally the duration.** The portal's one named
   anti-goal is *"slower to check in"*. The outcome screen is the answer to the
   only question the member has; 200ms of it being half-legible is the anti-goal
   expressed in milliseconds.
2. **The brief's one non-negotiable is outcome legibility.** *"A member must
   always know which outcome they got — and a recorded check-in must never look
   like a failure, or a failure like a recorded one."* During a crossfade the
   affirm and critical grounds are both partly on screen. A member glancing at a
   phone at a door is exactly the reader that fails on.
3. **It cannot exist before hydration.** The form must post before JS loads
   (verified: `method="POST"` and `$ACTION_KEY` in the server HTML), and that
   path is a full document load with no transition available. A crossfade would
   therefore appear only on fast devices — inverted from where a smoothing
   effect would help.

🪤 And the mechanical objection, which is the one that would have bitten in
code: the panel replaces the form via a `switch` on action state, so React
unmounts one subtree and mounts another. A crossfade needs both present at once
— a wrapper holding the outgoing screen, or a library. That is machinery on a
component whose entire design constraint is working without JavaScript.

## 3 & 4. Easing and duration

Moot. Nothing new animates. The two durations that exist are both 150ms colour
swaps, which is this skill's figure for that case.

## What the surface actually moves

Nothing. No `data-reveal` (correct — the band must be readable at first paint,
and a panel mounted by a state change is never seen by the observer, so a reveal
on it would be permanent `opacity: 0`). No keyframes, no `animate-*`, no
`useReducedMotion`, no transform anywhere. The only transitions are inherited
from `components/ui/`: `transition-colors duration-150` on buttons and inputs.

🪤 **This surface is required to carry a motion receipt for a reason that is
itself worth recording.** `scripts/design/receipts.mjs` computes whether a
surface moves by grepping its files for `data-reveal|animate-|transition-|…`.
Both hits here are **inside comments** — `page.tsx:42` and
`checkin-form.tsx:637`, each explaining why a reveal must never be added. The
grep cannot tell a comment from code. The receipt is written in full anyway:
the conclusion "nothing should animate" is worth having on the record for a
surface whose concept explicitly left the question open, and deleting a comment
to drop a review step would be the wrong way to resolve it.

# `emil-design-eng` — motion review of `/portal/attend`

Run at `77d2c568ed093f78a6b437e053bbef0533eff9e4`, against the running page.

## The surface still moves nothing of its own

Unchanged from 2026-09-19 and re-verified: no `data-reveal`, no `@keyframes`, no
`transform`, no Motion/Framer import, no `useReducedMotion`. `main [data-reveal]`
returns nothing on every state. The terminal panels replace the form in place,
with no crossfade — the decision M1 settled at the original gate and which the
officer's header removal did not reopen.

**What is new since that pass is not a new animation. It is that one of the
inherited transitions turns out to animate the focus ring**, which the 2026-09-19
motion pass did not know and would have had to measure to find.

---

## Run through the Animation Decision Framework

### 1. Should this animate at all?

| What animates | Frequency for this user | Framework's verdict |
|---|---|---|
| Control colour on hover / press | tens of times a day, across the site | "remove or drastically reduce" — but it is the system's only interaction cue, so it stays |
| **The focus ring's colour** | every keyboard tab stop | **"Never animate keyboard-initiated actions."** |

The framework's rule is stated without qualification: *"Never animate
keyboard-initiated actions. These actions are repeated hundreds of times daily.
Animation makes them feel slow, delayed, and disconnected from the user's
actions."* A focus ring is the keyboard-initiated action.

### 2. What is the purpose?

The colour swap's purpose is **feedback** — a valid one. The ring's fade has no
purpose at all: it is a side effect of `outline-color` being inside Tailwind v4's
`transition-colors` shorthand. Nobody chose it.

### 3–4. Easing and duration

150ms, the figure this skill specifies for a colour swap, on the browser default
ease. Correct for the hover. For the ring it is 150ms of a feedback signal
arriving late.

---

## Measured: the ring on the Check in button fades in from white

`components/ui/button.tsx`'s `BASE` carries `transition-colors duration-150`.
Resolved on the running button:

```
transition-property: color, background-color, border-color, outline-color,
                     text-decoration-color, fill, stroke, --tw-gradient-from,
                     --tw-gradient-via, --tw-gradient-to
transition-duration: 0.15s
```

`outline-color` is in the list. The button's unfocused `outline-color` computes
to `currentColor`, and on `bg-misa-blue` that is **white**. So the ring animates
white → navy across the 150ms, on a **white sheet**.

Sampled on the real page, keyboard focus, `outline: 2px solid` at `offset 2px`:

| t | `outline-color` | contrast vs the white sheet |
|---|---|---|
| ≈1 ms | `rgb(255,255,255)` | **1.00:1** — invisible |
| ≈16 ms | `rgb(247,248,250)` | 1.04:1 |
| ≈31 ms | `rgb(214,219,226)` | ≈1.41:1 |
| ≈62 ms | `rgb(148,160,180)` | ≈2.67:1 |
| ≈92 ms | `rgb(60,82,119)` | ≈8.6:1 |
| ≈151 ms | `rgb(22,48,92)` | **13.03:1** |

So the focus indicator on the primary action **does not exist for the first
~30ms and does not clear 3:1 until somewhere around 70–90ms.**

🔓 **The three text inputs do not have this problem, and the difference is
instructive.** Their `currentColor` is `text-foreground` (Graphite), so their
ring fades `rgb(29,31,32)` → `rgb(22,48,92)`: dark to dark, clearing 3:1 for the
whole 150ms. The defect is specific to a control whose own text is white — which
on this surface is the navy submit, and site-wide is every `variant: "primary"`,
`"onNavy"` and `"danger"`-filled button.

⚠️ **The ring does paint.** This is a timing finding, not the hub's
paint-order one: pixel diffs show the full 2px ring at its exact geometric area
on every focusable element here (`audit.output.md`). What is wrong is *when* it
becomes visible, not *whether*.

📌 **Round 2 reached the same mechanism from the other end** — the header's
MEMBER PORTAL button, recorded as an open officer question: *"its focus ring
fades in from invisible."* Two steps, two surfaces, one cause in
`components/ui/button.tsx`.

---

## Why this surface cannot fix it, specifically

The obvious per-surface fix is to append a narrower `transition-property` to the
submit's `className`. It does not work reliably: every Tailwind `transition-*`
utility sets `transition-property` at the same specificity, so
`transition-[color,background-color]` appended after `transition-colors` ties,
and the winner is whichever Tailwind emits last. That is the same
emission-order tie that made `<Title className="text-[22px]">` render at 26px
for as long as it existed, and that `Banner`'s `size` prop and `Title`'s `size`
prop were both introduced to avoid.

So the fix belongs in `BASE` itself — one shared string, ~40 public call sites
plus every `/admin` button — which is `components/ui/` and part 6's.

---

## The two standing overrules, re-checked rather than restated

**`transform: scale(0.97)` on `:active`.** This skill asks for it on every
pressable element. DESIGN.md bans a transform on a control outright ("Press
feedback is an ink change, never a transform"), and `button.tsx` already records
the overrule at its own call site while keeping this skill's 150ms figure for the
swap. Verified on the page: press changes `background-color` only,
`rgb(22,48,92)` → `rgb(13,29,56)`, no transform. Settled system decision; not
relitigated per surface.

**Hover gating.** `transition-colors` is not behind
`@media (hover: hover) and (pointer: fine)`, so `:hover` sticks after a tap on
the touch devices this page is built for. Correct in general, still not this
surface's to fix (`button.tsx`, `field.tsx`), and still nearly free here: hover
and active resolve to the same navy on the button, and the button unmounts on
the success path.

## `prefers-reduced-motion` — checked, and correct as built

Nothing here is gated behind it, and that is right rather than an omission. This
skill's own accessibility rule: *"Reduced motion means fewer and gentler
animations, not zero. **Keep opacity and color transitions that aid
comprehension.** Remove movement and position animations."* There is no movement
on this surface to remove, and the colour transitions are the comprehension aid
the rule protects.

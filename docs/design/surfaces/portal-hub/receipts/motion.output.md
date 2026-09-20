# `emil-design-eng` — raw output

Review of every transition and reveal on `app/(public)/portal/page.tsx` and
`components/ui/portal-band.tsx`.

## The animation decision framework, applied

**1. Should this animate at all?**

The hub sits on the highest-frequency path in the product: a member reaching
check-in during an event's first minutes. The frequency table sends anything on
a path used repeatedly toward *remove or drastically reduce*. The build had
already reached that conclusion independently — no `data-reveal` on the band or
on any destination — and the measurement backs it: a reveal holds the
check-in destination at `opacity: 0` until the IntersectionObserver fires,
which is the officer's named anti-goal ("never slower to check in") expressed
in CSS. **Correct as built; nothing to add.**

What *should* animate is the one thing that was not animating: the press.

**2. What is the purpose?**

Feedback — "a button scales down on press, confirming the interface heard the
user". Valid, and on this surface it is the only motion with a purpose at all.

**3. What easing?**

A hover/colour change → `ease`. Tailwind's default timing function on
`transition-colors`. None of DESIGN.md's three easing tokens (`reveal`,
`out-quint`, `in-out-quint`) is a hover curve, so nothing in the system is
being ignored by using the default here.

**4. How fast?**

Button press feedback: 100–160ms. The file uses `duration-150`, which is also
exactly DESIGN.md's `hover: 150ms` token. No change.

## Review

| Before | After | Why |
| --- | --- | --- |
| No `:active` state on a full-row link on a touch-first surface | `group-active:text-misa-blue-dark` on the title, `group-active:bg-misa-blue-dark` on the key | Pressable elements must feel responsive to press. `group-hover:` is gated to `@media (hover: hover)`, so on a phone there was no feedback at all. |
| `transform: scale(0.97)` on `:active` (my standard prescription) | Colour swap only, same `duration-150` | DESIGN.md: colour swaps are the only hover, and nothing in this system moves on interaction. Purpose met, mechanism is the system's. |
| Browser default tap highlight sitting over the new press state | `[-webkit-tap-highlight-color:transparent]` | Two competing acknowledgements of a single tap. |
| `transition-colors duration-150` | unchanged | Already the system's `hover` token, and inside the 100–160ms press band. |
| No `data-reveal` on band or destinations | unchanged | Highest-frequency path; a reveal here is the anti-goal. |
| No `@media (prefers-reduced-motion)` branch | unchanged | Reduced motion means fewer and gentler, not zero. The only motion is the colour transition that *is* the feedback; removing it would strip the acknowledgement. |

## Verified, not assumed

**Tailwind v4 gates hover automatically.** Checked in the compiled stylesheet
served by the dev server:

```
3752:  @media (hover: hover) {
3753:    .group-hover\:bg-misa-blue-dark:is(:where(.group):hover *) {
3754:      background-color: var(--misa-blue-dark);
3755:    }
3757:    .group-hover\:text-misa-blue-dark:is(:where(.group):hover *) {
3758:      color: var(--misa-blue-dark);
3759:    }
```

So the checklist item "hover animation without media query" is already
satisfied and must not be hand-written a second time. **And this is precisely
what creates the press-state gap**: the rule is satisfied *and* it is the
reason the touch user saw nothing.

**`active:` count in the compiled stylesheet before the fix: 0.** The file's
comment claims "Hover and press swap ink only — no lift, no scale", which
describes the intent accurately and was never implemented. A comment is not an
implementation.

## Checklist sweep

- `transition: all` — none; `transition-colors` names its properties ✓
- `scale(0)` entry — none ✓
- `ease-in` on a UI element — none ✓
- `transform-origin: center` on a popover — no popovers ✓
- Animation on a keyboard action — none ✓
- Duration > 300ms on a UI element — none (150ms) ✓
- Hover animation without media query — handled by Tailwind v4 ✓
- Keyframes on a rapidly-triggered element — no keyframes; transitions only,
  which are interruptible and retarget smoothly ✓
- Framer Motion `x`/`y` under load — no Framer Motion on this surface ✓
- Same enter/exit speed — no enter/exit animation ✓
- Elements all appearing at once needing stagger — nothing animates in, by
  design ✓
- `will-change` at rest — none ✓

## The clip-path note

`portal-band.tsx`'s `.chevron-notch` is a static `clip-path`, not an animated
one, and its own comment records that a clip-path clips descendants. Nothing
transitions it. No finding — recorded because `clip-path` is the one property
on this surface that *could* be animated and deliberately is not, and because
DESIGN.md's scroll-reveal rules elsewhere turn on exactly this property
(`clip-path: none` vs `inset(0 0 0 0)`).

# `emil-design-eng` — every transition and reveal on `/portal`, re-gate 2026-09-20

Reviewed against the compiled result on the running dev server, not the source.
`components/ui/portal-band.tsx` is gone — the officer deleted it on 2026-09-20 —
so the surface is `app/(public)/portal/page.tsx` and `components/ui/portal-sheet.tsx`.

## Review

| Before | After | Why |
| --- | --- | --- |
| `group-active:` press feedback present in the source, never verified on a device that cannot hover | unchanged — **verified live** on an emulated `hover: none` / `pointer: coarse` device: hover does nothing, pointer-down swaps title and key to `--misa-blue-dark` | M1's fix from the previous gate is real. The previous receipt proved it from the compiled stylesheet; this one proves it from the rendered state on the device class the fix exists for. |
| Emil's `transform: scale(0.97)` on `:active` | colour swap only | DESIGN.md: colour swaps are the only hover and **nothing in this system moves on interaction**. The purpose — instant press acknowledgement — is met in the system's own vocabulary. Same synthesis as 2026-09-19, and it still holds. |
| Hover gated behind `@media (hover: hover)` | unchanged | Tailwind v4 emits it automatically. Verified by behaviour rather than by reading the stylesheet: on the Pixel 5 emulation `matchMedia("(hover: hover)").matches` is `false` and the hover swap correctly does not fire. |
| `transition-colors duration-150` | unchanged | 150ms is DESIGN.md's `hover` token and inside Emil's 100–160ms press band. |
| The focus ring's colour is inside the transitioned property list | unchanged | `transition-colors` covers `outline-color`, so a focus ring can nominally fade in — Emil's "never animate a keyboard-initiated action". On the **rows** it does not: the ring reads its final `rgb(22,48,92)` on the first frame, because `outline-style` switches discretely and the start colour already equals the end colour. Verified, not assumed. |
| No `data-reveal` anywhere | unchanged | Highest-frequency path in the product. A reveal holds the check-in destination at `opacity: 0` until an observer fires, which is the officer's anti-goal expressed in CSS. Confirmed: `main` contains zero `[data-reveal]` nodes. |
| No `prefers-reduced-motion` branch | unchanged | Verified with an emulated reduced-motion context: geometry identical (check-in row bottom 267.2), `opacity: 1`, `transform: none`. The only motion left is the 150ms colour change that **is** the press feedback, and Emil's rule is that reduced motion means fewer and gentler animations, not zero. A reduced-motion branch here would delete the acknowledgement M1 was filed to add. |

## 🔴 One thing the previous motion receipt got wrong, corrected here

`motion.md` M4 (2026-09-19) rejected a change to the easing with this reason:

> "Emil's decision tree sends a hover/colour change to `ease`, which is Tailwind's
> default timing function here."

**It is not.** The rendered transition-timing-function on both the title ink and
the key fill is **`cubic-bezier(0.4, 0, 0.2, 1)`** — Tailwind's default, which is
its `ease-in-out`-shaped curve, not CSS `ease` (`cubic-bezier(0.25, 0.1, 0.25, 1)`).
Read off the computed style on the running page.

**The conclusion still stands and the reason is now a different one.** DESIGN.md
§Motion says *"There is no ease-IN curve on purpose — an ease-in start reads as
lag on anything a person is waiting for"*, and `cubic-bezier(0.4, 0, 0.2, 1)`
does have an ease-in start. But DESIGN.md's three easing tokens are
`--ease-reveal`, `--ease-out-quint` and `--ease-in-out-quint`, all movement
curves for entrances; **there is no token for a hover or press colour swap**, and
reaching for a quint curve on a 150ms colour change would be drift, not
correction. So this stays as Tailwind's default, and the tension is recorded
rather than resolved: it is a property of **every `transition-*` in the
codebase**, not of this page, and it belongs to a site-wide motion decision the
officer has not been asked for.

Likewise `duration-150` on the press where DESIGN.md names `--dur-press: 140ms`
distinctly from `--dur-hover: 150ms`. Ten milliseconds, one utility, on a colour
swap: recorded, not changed, because Tailwind has no `duration-140` step and an
arbitrary `duration-[140ms]` is a worse trade than the 10ms.

## Checked and correct

No `transition: all` — `transition-colors` is an explicit property list ✅. No
keyframes ✅. Nothing animates `transform`, so the compositor and
`transform-origin` rules are moot ✅. No `scale(0)` entry ✅. No stagger, and
none wanted — the page has no entrance ✅. No animation on a keyboard-initiated
action ✅. Every duration under 300ms ✅. The whole motion vocabulary on this
surface is one 150ms colour change on two properties, and it is the feedback.

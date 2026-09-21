# `web-design-guidelines` — `/portal/attend`

Rules fetched fresh from
`https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`
and applied to `app/(public)/portal/attend/page.tsx` and
`_components/checkin-form.tsx` at
`77d2c568ed093f78a6b437e053bbef0533eff9e4`.

```text
## app/(public)/portal/attend/_components/checkin-form.tsx

checkin-form.tsx:766 - outcome <p> holds an officer-entered event title inside a
                       min-w-0 flex child with no break-words; the same rule pair
                       that was applied to :690 after it overflowed 588px
checkin-form.tsx:489 - aria-busy rides on a disabled button, and no aria-live
                       region carries the busy state ("Async updates need
                       aria-live=polite"; "spinner during request")
checkin-form.tsx:320 - "..." → "…" : n/a, already correct
checkin-form.tsx:672 - identifiers (UT EID, email) not wrapped translate="no"
checkin-form.tsx:445 - curly quotes: uses the &apos; entity, site convention
checkin-form.tsx:497 - sentence case in the DOM, not Title Case

## app/(public)/portal/attend/page.tsx

✓ pass

## outside the surface, reached from it

app/globals.css      - no scroll-padding-top under a `sticky top-0` 61px header
components/ui/button.tsx - transition-colors not gated behind
                       (hover: hover) and (pointer: fine)
components/ui/field.tsx  - hover boundary is LOWER contrast than rest
                       (3.36:1 vs 3.65:1) — "interactive states increase contrast"
app/globals.css      - no env(safe-area-inset-*) on the full-bleed page ground
```

---

## The checks that pass, with what was actually verified

Listing these because the value of a checklist run is as much what it clears as
what it catches, and several of these are rules the surface goes out of its way
to meet.

**Accessibility.** No icon-only buttons. Every control has a `<label>` — the
three fields through `Field`'s explicit `htmlFor`, the checkbox through
`aria-labelledby` pointing at the label span alone. No `<div onClick>`; actions
are `<button>` and the one navigation is a `<Link>`. The Lucide mark is
`aria-hidden="true"`. Async updates announce — `StatusRegion` is
`role="status" aria-atomic`, in the DOM from first paint. `<h1>` → `<h2>`, no
skipped level; the skip link is in the public layout.

**Focus states.** Every interactive element has a visible `:focus-visible`
indicator, and — the part this checklist cannot tell you — **all ten of them
were verified by pixel diff to actually paint**, at their exact ring area
(`audit.output.md`). No `outline: none` anywhere. `:focus-visible`, not
`:focus`.

**Forms.** `autoComplete` on name and email, `autoComplete="off"` on the EID
(which is the rule, not a violation — "on non-auth fields to avoid password
manager triggers"). `type="email"` + `inputMode="email"`. `spellCheck={false}`
on both the EID and the email. No `onPaste`. The checkbox's label and control
share one hit target with no dead zone — the whole 84px row at 360. Errors are
inline beside their field and focus moves to the first one on submit (EV1,
verified: `activeElement` is `input[name=fullName]` on an empty submit). No
placeholders at all, which is EV12's decision, so the placeholder rule is moot.
The submit stays enabled until the request starts.

**Animation.** No `transition: all` — `transition-colors` enumerates. Nothing
animates `transform`. No keyframes.

**Typography.** `…` not `...` ("Checking in…"). `&nbsp;` in
`{ORPHAN_WINDOW_HOURS}&nbsp;hours`. `text-balance` on every heading (`Title`
applies it).

**Content handling.** `min-w-0 break-words` on the review step's `<dd>` — the
pair, not either half. Empty states are the twelve designed screens.

**Hydration safety.** `defaultValue`, never `value`, on every live input; the
four hidden carriers use `value` + `readOnly`. No dates rendered here, so no
server/client formatting mismatch to guard.

**Touch.** `touch-action: manipulation` and `-webkit-tap-highlight-color` are
both set globally in `app/globals.css:365-381`, on `a, button, label, summary,
[role="button"]` and `a, button` respectively — with a comment naming this
page's 20-second target as the reason. No `autoFocus`.

**Dark mode.** `color-scheme: light` on `<html>`. Light-only site; nothing to
vary.

**i18n.** No dates or numbers are formatted on this surface. (`Intl` is not
reached.)

**Anti-patterns.** None of the thirteen. No `user-scalable=no`, no
`transition: all`, no `outline-none`, no unlabelled input, no icon button
without a name, no `.map()` over a large array, no `autoFocus`.

---

## The findings, in full

### G1 — the outcome panel has `min-w-0` without `break-words`

`checkin-form.tsx` — `ResultPanel`'s content wrapper is `<div className="min-w-0">`
and the paragraph inside it holds `{children}`, which on `present` is
`Your attendance at <strong>{state.eventTitle}</strong> is recorded.` The event
title is officer-entered and `events.title` has no length limit.

**Measured at 360 with a 76-character unbroken title:**

| | before | after |
|---|---|---|
| `<strong>` painted width | **622.1px** | 199.1px |
| its right edge | **720.1px** (the sheet ends at 340) | 297.1px |
| `document.scrollWidth` vs `clientWidth` | **720 vs 360** | 360 vs 360 |
| the wrapper's own box | 200px | 200px |

🪤 **`min-w-0` alone is the half-fix `Row` documents eighty lines below**, and
this is it in the wild: the wrapper's box never moved off 200px, so anything
reading box geometry called it fixed, while the text painted 380px past the
sheet and the document grew 360px of horizontal scroll.

🪤 **It took an unbroken token to find.** The first probe used a hyphenated
86-character title and passed cleanly — the `<strong>` measured 197.5px inside a
200px column — because a hyphen is a break opportunity. That is the same trap the
`<dd>`'s own comment names, applied to the one screen the surface exists to
render.

The review step's `<dd>` got the pair at the 2026-09-19 gate after a long email
overflowed by 588px. The success screen did not, and no step before this one
looked.

### G2 — `aria-busy` on a disabled button, with nothing announcing the busy state

`checkin-form.tsx:489`. Two rules land here at once: *"Submit button stays
enabled until request starts; spinner during request"* and *"Async updates
(toasts, validation) need `aria-live="polite"`."* The button disables at the
right moment, and the visible label swaps to "Checking in…" — but `disabled`
removes it from the tab order, so `aria-busy="true"` reaches nobody, and the
always-mounted `role="status"` region measured empty for the whole request.
Reached independently by the critique (A1) against EV7, which is the brief's own
adopted evidence and asks a loading state to preserve *layout, focus and busy
status*.

### G3 — no `scroll-padding-top` under a sticky header

`app/globals.css` has no `scroll-padding-top`, and `components/site-header.tsx:151`
is `sticky top-0 z-50` with a measured 61.0px shell. The rule is *"Sticky
headers/footers/overlays must not cover the focused element."* On the idle form
nothing scrolls — everything is inside the first screen — but on `unmatched` the
button sits below the fold, and a Shift+Tab back up a scrolled document lands the
target at the viewport's top edge, under the header.

### G4 — identifiers are not `translate="no"`

`checkin-form.tsx:672` — the review step renders a UT EID and an email address as
values a member is being asked to proofread, and the rule asks for
`translate="no"` on identifiers so machine translation cannot garble them.

### G5 — curly quotes

The site-wide convention is the `&apos;` entity; two of roughly 200 files use a
literal `'`.

### G6 — Title Case for headings and buttons

Chicago style, per the rule.

### G7 — `prefers-reduced-motion`

Nothing on this surface is gated behind it.

### G8 — hover states are LOWER contrast than rest

`components/ui/field.tsx`. The rule is *"Interactive states increase contrast:
hover/active/focus more prominent than rest."* Measured: the input's rest
boundary `--misa-control-edge` (`#858687`) is **3.65:1** against the white sheet
and **3.26:1** against its own fill. On hover it becomes `misa-blue/55`, which
composites to **3.36:1** and **3.24:1**. Both still clear 1.4.11's 3:1, but
hovering an input *lowers* the ratio of the thing that identifies it.

### G9 — no `env(safe-area-inset-*)`

The page ground is full-bleed and nothing in `app/globals.css` or
`components/ui/section.tsx` reads a safe-area inset. At 360 the sheet sits inside
a 20px gutter, which a landscape notch can exceed.

### G10 — URL does not reflect state

Twelve states, one URL.

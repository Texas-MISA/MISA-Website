# web-design-guidelines — `/portal` (surface `portal-hub`), re-gate 2026-09-20

Guidelines fetched fresh before review from
`https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`,
per the skill. Reviewed against the rendered page as well as the source, because
several of these rules are only answerable by computed style.

## app/(public)/portal/page.tsx

```
app/(public)/portal/page.tsx:168 - flex cell uses a fixed `px-6` against a sheet whose
                                   padding is `px-4 sm:px-8`; the row text does not sit
                                   on the page's left margin at any width
app/(public)/portal/page.tsx:261 - 16px paragraph with no leading class (renders 1.5)
                                   beside a 16px paragraph at `leading-[1.6]` 20px away
app/(public)/portal/page.tsx:264 - "sign in" tap target renders 44.9 x 32px
app/(public)/portal/page.tsx:139 - no `touch-action: manipulation`
app/(public)/portal/page.tsx:266 - "sign in" is not Title Case
app/(public)/portal/page.tsx:96  - "MISA" is a brand name and is not wrapped `translate="no"`
app/(public)/portal/page.tsx:186 - `<h2 id>` anchors under a 61px sticky header with no
                                   `scroll-margin-top`
```

## Checked and PASSING — recorded so the next review does not re-derive them

**Accessibility.** Decorative chevron is in `aria-hidden="true"` ✅. Navigation
uses `<Link>`, never a `<div onClick>` ✅. Heading hierarchy H1 → H2 × 3, no
skipped level ✅. Skip link present (public layout) ✅. Semantic HTML before
ARIA — the only ARIA is `aria-labelledby` / `aria-describedby`, and it is doing
work a wrapper element cannot: without it each row's accessible name would be
"Event Check-In Check in to a MISA event." ✅. No images, so no `alt` rules
apply ✅. No async updates, so no `aria-live` rule applies ✅.
**axe-core (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa): 0 violations and 0
incomplete at 360, 768 and 1280.**

**Focus states.** Visible `:focus-visible` on every operable control ✅. No
`outline-none` anywhere ✅. `:focus-visible` rather than `:focus` ✅. The row
ring measures 13.03:1 over the white cell and the key's own white ring 13.03:1
over the navy — **the indicator contrasts with both grounds the focused element
spans**, which is the rule this surface itself produced.

**Forms.** None on this page ✅.

**Animation.** No `transition: all` — `transition-colors` is an explicit
property list ✅. Nothing animates `transform`, so the compositor rules are moot
✅. No keyframes ✅. `prefers-reduced-motion`: verified with an emulated
reduced-motion context — geometry identical (check-in row bottom 267.2,
opacity 1, transform none), and the only motion left is a 150ms colour change
that IS the press feedback, which Emil's rule says to keep rather than remove.

**Typography.** No `...` and no straight quotes in the copy ✅. `text-balance`
present on the h1 **and** on all three h2s (verified in the rendered class
attribute and by measuring: every title is one line at every width, so there is
no widow to prevent) ✅. No number columns, so `tabular-nums` does not apply ✅.

**Content handling.** `min-w-0` on the flex cell ✅ — the rule this checklist
flagged at the previous gate, now present. Three static items, so no empty
state and no user-generated content ✅.

**Touch.** `-webkit-tap-highlight-color` set intentionally and verified to
compute to `rgba(0, 0, 0, 0)` ✅.

**Navigation and state.** All navigation is `<Link>`, so Cmd/Ctrl-click and
middle-click work ✅. No stateful UI, so nothing to deep-link ✅. No destructive
action ✅.

**Hover and interactive states.** Hover present and verified to INCREASE
contrast: rest `#16305c` 13.03:1 → hover `#0d1d38` 16.80:1 on white ✅. And the
press state was verified on an emulated `hover: none` / `pointer: coarse`
device, where hover correctly does nothing and pointer-down swaps the ink —
which is what the previous gate filed G6 about and could not check from source.

**Performance.** Static Server Component: no client bundle, no images, no
layout reads, no `will-change`, one tree-shaken icon import ✅.

**Locale.** No dates, numbers or currency, so no `Intl` rule applies ✅.

**Hydration.** No client component, no `value` without `onChange` ✅.

**Dark mode / theming.** Refused site-wide by DESIGN.md; not an omission ✅.

**Anti-patterns.** None of the flagged list is present: no `user-scalable=no`,
no `onPaste` preventDefault, no `transition: all`, no `outline-none`, no inline
onClick navigation, no click-handling `<div>`/`<span>`, no undimensioned image,
no unvirtualised large list, no unlabelled input, no unlabelled icon button, no
hardcoded date/number format, no `autoFocus`, no animated GIF, no gesture-only
action.

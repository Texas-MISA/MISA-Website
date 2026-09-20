# `web-design-guidelines` — raw output

Guidelines fetched from
`https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`
at review time.

## app/(public)/portal/page.tsx

```
app/(public)/portal/page.tsx:141 - flex child lacks min-w-0 (title cannot wrap/truncate beside the fixed w-12 key)
app/(public)/portal/page.tsx:141 - <h2> inside <span> → use <div>; span is phrasing content
app/(public)/portal/page.tsx:139 - -webkit-tap-highlight-color not set intentionally on a full-row tap target
app/(public)/portal/page.tsx:139 - no touch-action: manipulation
app/(public)/portal/page.tsx:176 - "sign in" → Title Case per Chicago rule
```

## components/ui/portal-band.tsx

```
✓ pass
```

---

## Checked and passing (recorded so the scope of the review is visible)

**Accessibility**
- Decorative icons hidden: `page.tsx:166` `aria-hidden="true"` on the key;
  `portal-band.tsx:79` `aria-hidden="true"` on the hero grid ✓
- `<a>`/`<Link>` used for navigation, not `<div onClick>` ✓
- Semantic HTML before ARIA — `<ul>`/`<li>`/`<a>`/`<h1>`/`<h2>` ✓
- Headings hierarchical: h1 (band) → h2 ×3 (rows), no level skipped ✓
- No icon-only button needing `aria-label` (the chevron is inside a named
  link, correctly hidden rather than labelled) ✓
- No images, no media, no async updates needing `aria-live` ✓
- Skip link present (site layout, outside this surface) ✓

**Focus states**
- Visible focus on every interactive element ✓
- No `outline-none` anywhere ✓
- `:focus-visible` used, not `:focus` ✓
- Sticky header does not cover the focused element — all three rows and the
  officer line sit below the 61px header at every width ✓
- ⚠️ *The colour of that ring where it crosses the navy key is out of this
  checklist's scope; it is `audit.md` AU1 and `design-review.md` DR1.*

**Animation**
- No `transition: all` — `transition-colors` names its properties ✓
- Compositor-friendly: colour only, no layout-property animation ✓
- `prefers-reduced-motion`: only colour transitions, which reduced motion
  should retain rather than kill ✓
- No keyframes, no `scale(0)` entry, no `transform-origin` question ✓

**Typography**
- No `...` (nothing needs `…`) ✓
- No straight quotes in rendered copy ✓
- `text-balance` on headings via the `Title` component ✓
- No number columns needing `tabular-nums` ✓

**Content handling**
- Empty states: the destination list is a fixed literal, never empty ✓
- ⚠️ Long-content handling is the `min-w-0` finding above ✗

**Navigation & state**
- `<Link>` for all navigation, so Cmd/Ctrl-click and middle-click work ✓
- No stateful UI to deep-link ✓
- No destructive action ✓

**Hover & interactive states**
- Buttons/links have `hover:` states ✓
- Hover/active/focus more prominent than rest ✓ *(passes as written — see
  `guidelines.md` G6 for why this pass is misleading on a touch surface)*

**Not applicable:** forms, images, safe areas (no full-bleed fixed element that
meets a notch), dark mode/theming (refused site-wide), locale/`Intl`, hydration
(Server Component), performance/virtualization (three items), drag and gesture,
autoplay media.

**Anti-patterns scanned for, none present:** `user-scalable=no`,
`maximum-scale=1`, `onPaste` + `preventDefault`, `transition: all`,
`outline-none` without replacement, inline `onClick` navigation,
`<div>`/`<span>` with click handlers, images without dimensions, unvirtualized
large arrays, inputs without labels, icon buttons without `aria-label`,
hardcoded date/number formats, unjustified `autoFocus`, animated GIF,
gesture-only actions.

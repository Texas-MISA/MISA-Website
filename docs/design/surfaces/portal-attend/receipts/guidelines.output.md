# web-design-guidelines — `app/(public)/portal/attend/`

Guidelines fetched fresh from
`https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`
on 2026-09-19 and applied to the surface's two files at
`a38a2b3d3fb740cc9565fdfb2036dfee72449efb`.

## app/(public)/portal/attend/_components/checkin-form.tsx

```
app/(public)/portal/attend/_components/checkin-form.tsx:604 - <dd> is a flex child with no min-w-0 and no break-words; a long email overflows the viewport
```

Everything else passes.

## app/(public)/portal/attend/page.tsx

```
✓ pass
```

---

## The one finding, measured

**Rule pair:** *"Flex children need `min-w-0` to allow text truncation"* and
*"Text containers handle long content: `truncate`, `line-clamp-*`, or
`break-words`"*.

`Row` renders `<div class="flex flex-wrap gap-x-2"><dt/><dd class="font-medium"/></div>`.
A flex item's automatic minimum size is its `min-content` width, and an email
address has no break opportunities, so the `<dd>` cannot shrink.

The brief names the range this hits: *"full name up to 120 characters, EID up to
32, email up to 254 (the schema's echo limits)"*. Measured at 360 with a
117-character address, in the real column:

| `<dd>` classes | `<dd>` past the panel's edge | document overflow at 360 | panel height |
|---|---|---|---|
| `font-medium` *(today)* | **+624px** | **588px** | 233px |
| `min-w-0 font-medium` | −25px | **588px** | 233px |
| `break-words font-medium` | +624px | **588px** | 233px |
| `min-w-0 break-words font-medium` | −25px | **−15px** *(scrollbar)* | 293px |

🪤 **Neither class works alone, and the two failures look different.**
`break-words` alone does nothing, because the flex item is still sized to
`min-content` and there is nothing to wrap *into*. `min-w-0` alone is worse than
it looks: the `<dd>` **box** stops overflowing the panel, so an inspector
reading box geometry would call it fixed — while the text goes on painting 588px
past the viewport. Only the pair fixes it, and the panel growing 233 → 293px is
the proof that the text finally wrapped.

🐛 **Nothing in the suite sees this.** `tests/ui/design-gate.spec.ts`'s
`does not scroll horizontally at 360px` runs against the freshly-loaded route —
the idle form — and the review step is four interactions away. The state tests
that *do* reach the review step run axe, which does not measure overflow.

This is pre-existing: the `<dd>` carried the same class before the redesign. It
is recorded against this surface because `Row` was rewritten here.

---

## Rules checked and deliberately not raised

| Rule | Why not |
|---|---|
| `touch-action: manipulation` | Already global. `app/globals.css:365-371` sets it on `a, button, label, summary, [role="button"]` — the box's `<label>` and both submits are covered, with a comment naming this page's 20-second target as the reason. |
| `-webkit-tap-highlight-color` set intentionally | Already global, `app/globals.css:373-381`, on `a, button`, as a navy wash matching the hover ink. |
| Curly quotes `'` not `'` | Site-wide convention is the `&apos;` entity; two of ~200 files use `'`. A per-surface change would make this page the odd one out, and the typographic gain is invisible against the cost of a split convention. Phase 5's, if ever. |
| Title Case for headings and buttons (Chicago) | **Overridden by DESIGN.md**, which is explicit: *"Button labels are written in SENTENCE CASE; `button.tsx`'s `BASE` applies `uppercase`"* — the caps are a presentation decision living in one place, and writing them into the markup reaches assistive technology and the clipboard as caps. |
| URL reflects state | A check-in outcome is the result of a POST, not navigable state. Deep-linking it would mean a URL that claims an attendance record exists. Behaviour, and out of scope for a design phase. |
| Errors inline next to fields; focus first error on submit | Already done — this is EV1, built. |
| Submit stays enabled until the request starts; spinner during request | Already done; the label swap is the busy indicator and `aria-busy` carries it. EV7 rules out a resize. |
| Async updates need `aria-live="polite"` | Already done — `StatusRegion` is `role="status"`, whose implicit live value is polite. |
| Disable spellcheck on emails, codes, usernames | Already done on the EID and the email. Full name is neither. |
| Inputs need `autocomplete` and meaningful `name` | Already done, including `autoComplete="off"` on the EID. |
| Images, virtualization, dark mode, `Intl.*`, gestures, modals | No images, no lists, no dark mode, no client-side date formatting, no gestures, no modals on this surface. |

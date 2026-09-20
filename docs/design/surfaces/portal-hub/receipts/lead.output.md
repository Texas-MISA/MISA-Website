# `/impeccable polish app/(public)/portal/page.tsx` — raw output

Mode: Operate. Target resolved to the source path rather than the dev-server
URL (ports drift, paths do not). Context loaded via `context.mjs --target
"app/(public)/portal/page.tsx"`: PRODUCT.md, DESIGN.md, and the surface brief
`.impeccable/surfaces/route-portal.md`.

## 1. Establish the system

Read: `DESIGN.md` (grounds, the ramp, elevation, the Rare Navy Rule, the
layout-family budget), `components/ui/section.tsx`, `components/ui/heading.tsx`,
`components/ui/portal-band.tsx`, and the neighbouring public pages for the
incumbent idiom.

The page is already built from the system rather than around it: `Section`
owns ground/gutter/rhythm, `PortalBand` and `Title` are shared, the plate is
DESIGN.md's shared-rule device (`gap-px` over a hairline background) rather
than a new component, every colour is a token, radius is 0 throughout, and the
layout-family budget is declared in a comment at the top of the file. There is
no missing token and no conceptual mismatch to report.

## 2. Gather the evidence

Used the page at its representative sizes on the local dev server. Read the
rendered markup with `curl … | grep -o '<li class="bg-white">…'` rather than
reading the JSX only, which is what surfaced L1.

`critique-storage.mjs latest` — no prior snapshot for this target (exit 2).
Independent pass performed.

## 3. Triage

No broken or blocked task, no data loss, no misleading state, no inaccessible
path. The surface is static and has no loading/empty/error states of its own
(brief §States). Everything found sits at tier 3–5: design-system drift, then
code cleanup.

## 4. Findings

**L1 — `<h2>` inside `<span>`.** Rendered markup:

    <a class="group flex items-stretch …">
      <span class="flex-1 px-6 py-5">
        <h2 class="font-display text-[26px] …" id="attend-title">Event Check-In</h2>
        <span id="attend-body" class="mt-1 block …">Check in to a MISA event.</span>
      </span>

`<span>` is phrasing content and may contain only phrasing content; `<h2>` is
flow content. The `<a>` itself is fine — an anchor in a flow-content position
may contain flow content, which is what makes the whole-row link legal in the
first place. So the wrapper should be a `<div>`, and once it is, the body
`<span class="block">` should be the `<p>` it actually is.

Browsers tolerate this and React's `validateDOMNesting` does not warn on it, so
nothing in the toolchain was ever going to report it.

**L2 — `text-sm` on the officer line.** `page.tsx:176`. DESIGN.md §The ramp:
Headline 30→42, Title 26→34, Card title 22→26, Lead 18, Body 16, Eyebrow 12.
There is no 14px row. Cross-checked against the rest of the public site: every
other `text-sm` on a public page is on `/officer-invite` or on one of the three
portal surfaces this phase has not rebuilt yet.

**L3 — no `min-w-0` on the flex child.** A flex item's `min-width` resolves to
`auto`, i.e. its min-content size, so a long enough title pushes the row wider
rather than wrapping. The brief's §States asks for "each title wrapping cleanly
inside its row beside the key" at 360.

**L4 — body `<span class="block">` → `<p>`.** Follows from L1.

## 5. Not changed

- The concept, the order, the equal formatting, the absence of a reveal, and
  the page's content: all officer-fixed, and none of them is wrong.
- The chevron notch / chevron key rhyme — the strongest thing on the page.
- The `slug` field and its rationale; the `aria-labelledby`/`aria-describedby`
  pairing; the inset focus ring's *placement* (its colour is another step's
  finding).

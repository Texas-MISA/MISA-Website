---
skill: web-design-guidelines
command: /web-design-guidelines app/(public)/portal/attend/
date: 2026-09-19
commit: "a38a2b3d3fb740cc9565fdfb2036dfee72449efb"
output: guidelines.output.md
findings:
  - id: G1
    summary: "checkin-form.tsx:604 — the review step's `<dd>` is a flex child with no `min-w-0` and no `break-words`, against the rule pair \"Flex children need min-w-0 to allow text truncation\" and \"Text containers handle long content\". The brief names the range it hits (email up to 254 characters). Measured at 360 with a 117-character address: the `<dd>` renders 904px inside a 305px column, 624px past the panel, taking the document to 588px of horizontal overflow."
    disposition: adopted
    fix_commit: "bd71103f223e26f6be75f2296c9c84d4ee401f13"
  - id: G2
    summary: "`touch-action: manipulation` is not set on this surface's controls (prevents the ~300ms double-tap zoom delay)."
    disposition: rejected
    reason: "Already global. `app/globals.css:365-371` sets it on `a, button, label, summary, [role=\"button\"]` — the box's `<label>` and both submits are covered — with a comment naming this page's 20-second target as the reason it exists."
  - id: G3
    summary: "`-webkit-tap-highlight-color` is not set intentionally on this surface's controls."
    disposition: rejected
    reason: "Already global, `app/globals.css:373-381`, on `a, button`, as a navy wash matching the hover ink rather than the platform's opaque grey block."
  - id: G4
    summary: "Typography rule: curly quotes `'` `'` rather than straight `'`."
    disposition: rejected
    reason: "The site-wide convention is the `&apos;` entity; two of roughly 200 files use `'`. Changing this surface alone would make the one page a member reads at a door the odd one out, and the typographic gain is invisible against the cost of a split convention. A whole-codebase decision for phase 5, if ever."
  - id: G5
    summary: "Content rule: Title Case for headings and buttons (Chicago style)."
    disposition: rejected
    reason: "Overridden by DESIGN.md, which is explicit: \"Button labels are written in SENTENCE CASE; `button.tsx`'s `BASE` applies `uppercase`.\" The caps are a presentation decision living in exactly one place, and writing them into the markup reaches assistive technology, translation and the clipboard as caps — some screen readers spell short all-caps strings letter by letter. Normalised across /admin on 2026-08-31 (55 labels, 22 files); not reopened per surface."
  - id: G6
    summary: "Navigation rule: the URL should reflect state — filters, tabs, expanded panels in query params."
    disposition: rejected
    reason: "A check-in outcome is the result of a POST, not navigable state; deep-linking it would mean a URL that claims an attendance record exists. It is also a behaviour change, which this phase does not make."
---

Guidelines fetched fresh from the source URL on 2026-09-19 and applied to the
surface's two files. **One finding**, and `page.tsx` passes clean.

🔴 **G1 is the most serious defect the gate found, and every automated check on
this project was blind to it.** `tests/ui/design-gate.spec.ts`'s
`does not scroll horizontally at 360px` runs against the freshly-loaded route —
the idle form — and the review step is four interactions away; the state tests
that *do* reach the review step run axe, which does not measure overflow. The
detector reads font sizes against the ramp and cannot see a flex item's
automatic minimum size.

🪤 **Neither class works alone, and the two failures look different** — the full
table is in `guidelines.output.md`. `break-words` alone does nothing, because
the item is still sized to `min-content` and there is nothing to wrap into.
`min-w-0` alone is worse than it looks: the `<dd>` **box** stops overflowing, so
anything reading box geometry calls it fixed, while the text goes on painting
588px past the viewport.

🔓 **The design-reviewer sharpened it afterwards:** a 109-character *name* wraps
cleanly today because it has spaces, so the defect is specifically an **unbroken
token**. A long-content check written with a realistic name would have passed
and found nothing.

📌 Five of six findings are rejections, and four of those are rules this
codebase had already answered somewhere else — twice in `app/globals.css` and
once in DESIGN.md. Recorded with the line numbers so the next surface's
guidelines pass can dispose of them in one read instead of re-deriving them.

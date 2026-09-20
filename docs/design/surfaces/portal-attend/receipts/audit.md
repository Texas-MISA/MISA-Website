---
skill: impeccable
command: /impeccable audit app/(public)/portal/attend/
date: 2026-09-19
commit: "a38a2b3d3fb740cc9565fdfb2036dfee72449efb"
output: audit.output.md
findings:
  - id: T1
    summary: "Five of the twelve states replace the screen and none of them places focus. `needs_confirmation`, `present`, `pending`, `duplicate` and `refused` all unmount `CheckinFields`, taking with it the submit button the member just pressed — so focus falls back to `<body>` and the next Tab restarts above the site header. EV1 was implemented and covers FAILED submits; the success path was never in its scope. The review step is the case that matters: it is not terminal, and a keyboard user has to cross the skip link, the wordmark, four nav items and the MEMBER PORTAL button to reach the \"Confirm and check in\" the screen is asking for."
    disposition: adopted
    fix_commit: "bd71103f223e26f6be75f2296c9c84d4ee401f13"
  - id: T2
    summary: "A long email in the review step overflows the viewport by 588px at 360 — `Row`'s `<dd>` is a flex item with `min-width: auto`, so an unbroken 117-character address sizes to min-content: 904px inside a 305px column. The audit's own \"horizontal scroll: content overflow on narrow viewports\" check, and the one thing on this surface that fails a dimension. Found independently by `web-design-guidelines` against its `min-w-0` / long-content rule pair; full measurement table in `guidelines.output.md`."
    disposition: adopted
    fix_commit: "bd71103f223e26f6be75f2296c9c84d4ee401f13"
  - id: T3
    summary: "`aria-busy` rides on a disabled button, which CLAUDE.md warns about in a closely related form: \"A `title` on a DISABLED button reaches nobody\", because `disabled` removes the element from the tab order."
    disposition: rejected
    reason: "Re-derived against this case and it does not apply. Unlike a `title`, the busy state here is also carried by the visible label swapping to \"Checking in…\", so no information exists only in the attribute. The pattern is unchanged from before the redesign. Recorded because the CLAUDE.md rule is close enough that a later reader will ask."
  - id: T4
    summary: "Text inputs have no boundary meeting WCAG 1.4.11's 3:1 — the Vellum fill is 1.12:1 on the white sheet and the hairline composites to ~1.53:1. Raised independently by the design-reviewer as DR3, with the sharper framing that the composite is CREATED by this surface's `ground=\"white\"`, and that `page.tsx`'s own comment offers that pairing as the fix for inputs being \"the colour of what is behind them\" — on white they are 1.12:1 from what is behind them."
    disposition: deferred
    reason: "The fill comes from `controlClass` in `components/ui/field.tsx`, shared with /admin and every form on the site, so the fix is a border-weight or border-colour change that has to be re-measured against 25 admin forms and eleven tables — not a per-surface edit, and not one to make between a review and a flip. Tracked in tasks.md under v2 phase 3 part 6, which already owns \"the shared primitives re-measured on the grounds the portal now puts them on\"."
---

Code-level technical checks across the five dimensions. Scores, and what each
dimension actually measured, in `audit.output.md`.

| Dimension | Score |
|---|---|
| Accessibility | 3 / 4 — WCAG AA met and measured; one focus-management gap (T1), one non-text-contrast gap deferred to a shared primitive (T4) |
| Performance | 4 / 4 |
| Theming | 4 / 4 |
| Responsive | 2 / 4 — the review step's 588px overflow (T2) |
| Implementation integrity | 4 / 4 — detector zero hits |

🔓 **T1's fix changed the announcement model, and that is the point rather than
a side effect.** `StatusRegion`'s existing rule was already *"carry only what
nothing else announces"* — which is why it returns `""` for the three banner
states, whose `role="alert"` speaks for them. Giving the review step's heading
focus makes the heading announce itself, so `needs_confirmation` joins them.
One rule across six states instead of a rule and an exception. The four terminal
outcomes deliberately keep the polite region and do NOT move focus: they ask
nothing of the member, and moving focus there would interrupt a sentence being
given rather than one being acted on.

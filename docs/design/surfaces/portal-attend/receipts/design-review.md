---
skill: design-reviewer
command: design-reviewer agent — /portal/attend at 360 / 768 / 1280 on the local dev server, six states
date: 2026-09-20
commit: "a38a2b3d3fb740cc9565fdfb2036dfee72449efb"
output: design-review.output.md
findings:
  - id: DR1
    summary: "[Medium] The first-time checkbox row — the checkbox's whole tap target — measures 44.0px at 1280x800 and 44.0px at 768x900, four pixels under the 48px floor the brief commits to (EV4). At 360 the label wraps to two lines and the row is 64.0px, so only >=sm is short. The comment declining `min-h-12` cited \"the block is already 87px\", a figure reproducible at no width."
    disposition: adopted
    fix_commit: "bd71103f223e26f6be75f2296c9c84d4ee401f13"
  - id: DR2
    summary: "[Medium] The unmatched alert is painted the same colour as the three empty inputs beneath it. The neutral `<Banner>` computes backgroundColor rgb(242,242,243) and `input[name=fullName]` computes rgb(242,242,243) — identical, because `Banner`'s `info` tone and `controlClass` both fill with `--misa-panel`. Against the sheet's white that wash is 1.12:1 and its hairline composites to ~2.03:1, so the banner reads as a fourth, empty form control rather than as an alert. Salience, not comprehension — text contrast inside it passes and it keeps role=alert and takes focus — but it is the one screen the rebuild exists to rescue."
    disposition: adopted
    fix_commit: "bd71103f223e26f6be75f2296c9c84d4ee401f13"
  - id: DR3
    summary: "[Medium] The text inputs have no boundary meeting WCAG 1.4.11's 3:1. On the white sheet the Vellum fill is 1.12:1 and the hairline `rgba(29,31,32,0.2)` composites to ~1.53:1 against white, ~1.36:1 against the fill it encloses. The composite is created by this surface's `ground=\"white\"`, and `page.tsx`'s own comment offers that pairing as the fix for inputs being \"the colour of what is behind them\"."
    disposition: deferred
    reason: "The fill comes from `controlClass` in `components/ui/field.tsx`, shared with /admin and every form on the site — the reviewer's own note says \"site-wide, so probably not this gate's blocker\". The fix is a border weight or colour change that must be re-measured against 25 admin forms and eleven tables, which is not a per-surface edit and not one to make between a review and a flip. Tracked in tasks.md under v2 phase 3 part 6, which owns the shared primitives re-measured on the portal's grounds. Raised independently by the audit as T4."
  - id: DR4
    summary: "[Medium] At 360 the header's MEMBER PORTAL button is 29.0px tall (rect top 15.5, bottom 44.5), under the 44px phone tap-target floor, and its left edge sits 3.0px from the wordmark's right edge (wordmark 131.6-213.6, button 216.6-325.1). No collision, but 3px of it."
    disposition: deferred
    reason: "`components/site-header.tsx` — site-wide chrome, outside this surface's registered files, and editing it here would put a shared-header change inside a portal surface's gate. It is the nav-clearance invariant's territory: CLAUDE.md records that clearance as re-measured 2026-09-18 AT 1280 ONLY, and this is the 360 case that measurement did not cover — the case CLAUDE.md's own note anticipates (\"on a phone the tight spot is that button beside the centred wordmark\"). Tracked in tasks.md with both numbers so the next nav change starts from a measurement rather than an estimate."
  - id: DR5
    summary: "[Nit] The caution outline marking the checkbox the banner points at renders as a single device pixel: computed `0.571429px solid` at 60% alpha, offset 4px, which at dpr 1.75 is one device pixel held off a 64px block. Paired with DR2, the two faintest marks on that screen were the alert and the pointer to the control it names."
    disposition: adopted
    fix_commit: "bd71103f223e26f6be75f2296c9c84d4ee401f13"
---

**No Blockers and no Highs.** The reviewer confirmed the bar independently — at
a true 360×640 viewport with the scrollbar suppressed, the Check in button
measures top 562.5 / **bottom 610.5** / height 48.0, **29.5px of slack** — and
found zero contrast failures and zero `--misa-muted`-on-Vellum occurrences
across every text node in six states at three widths. Full report, including
what passed and the exact coverage, in `design-review.output.md`.

🪤 **This is the SECOND run; the first was killed after an hour having produced
nothing, and the cause is worth recording because it will recur.** The lead was
driving the same Chrome tab at the same time, and two CDP clients on one browser
wedged the renderer — two of the lead's own calls had already timed out
(`Page.captureScreenshot` at 30s, `Runtime.evaluate` at 45s) before the agent
stalled. **Only one agent may drive the browser at a time.** The second run was
given the browser to itself, an event left open so it needed no database work,
an explicit ban on `requestAnimationFrame` loops (a background tab never
advances rAF), and a ~15-minute budget with instructions to return partial
findings and name its gaps. It returned complete in ten minutes.

🔴 **DR1 is the finding of the gate, because of what it caught rather than what
it cost.** Four pixels is nothing; the comment beside it was the defect. It
declined the 48px floor on the grounds that "the block is already 87px" — an
arithmetic estimate carried over from the build plan, which assumed a three-line
reassurance where it renders two. It is wrong at every width (64 at 360, 44 at
768 and 1280), and it was written by the same pass that was otherwise measuring
everything with `getComputedStyle`. **The project's own rule — measure, do not
assume — landed on the project.**

🔓 **DR2 is the one that changes what a member sees.** The alert carrying the
officer's named failure was the same colour as the empty inputs below it,
because two different primitives reach for `--misa-panel` for two different
reasons and nobody had put them on the same screen before.

📌 **The two deferred findings are both real and both correctly out of scope**,
and each is tracked with its measurement rather than its description — a number
the next person can re-derive, not a claim they have to take on trust.

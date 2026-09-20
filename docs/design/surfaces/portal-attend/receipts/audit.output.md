# impeccable — `audit app/(public)/portal/attend/`

Run 2026-09-19 against `a38a2b3d3fb740cc9565fdfb2036dfee72449efb`. Code-level
technical checks across the five dimensions. Measurements from
`getComputedStyle` / `getBoundingClientRect` on the running page, and from
driving all twelve states on the local stack.

| Dimension | Score | Note |
|---|---|---|
| Accessibility | **3 / 4** | WCAG AA met and measured; one focus-management gap on a screen replacement (T1). |
| Performance | **4 / 4** | No images, no lists, no animation, no layout reads in render. One `querySelector` per state change. |
| Theming | **4 / 4** | Every colour is a named token; no raw framework scale; no hard-coded hex. |
| Responsive | **2 / 4** | Idle and every banner state clean at 360; **the review step overflows the viewport by 588px on long content** (T2). |
| Implementation integrity | **4 / 4** | Detector: zero hits, exit 0. |

---

## T1 — Five of the twelve states replace the screen, and none of them places focus

**Accessibility.** `CheckinForm` switches on `state.status`, and
`needs_confirmation`, `present`, `pending`, `duplicate` and `refused` all
unmount `CheckinFields` entirely. The focused element at that moment is the
submit button the member just pressed. When it is removed from the DOM, focus
falls back to `<body>` — so the next <kbd>Tab</kbd> starts from the top of the
document, above the site header.

EV1 was implemented and covers **failed** submits (banner or first invalid
field, verified live in all four). The success path was never in its scope, and
this is the gap that leaves.

**The review step is the case that matters.** It is not terminal — it asks for
another action, and that action is *"Confirm and check in"*. A keyboard user who
submits the form lands on `<body>` and has to tab through the skip link, the
wordmark, four nav items and the MEMBER PORTAL button to reach the button the
screen is asking them to press.

**The four terminal screens are a different case and should stay as they are.**
Nothing is asked of the member, so a polite `role="status"` announcement is the
correct, less disruptive pattern, and moving focus would interrupt a sentence
the member is being given rather than asked to act on.

🪤 **Adopting this changes `announcement()`, and that is the point rather than a
side effect.** The region's existing rule is already *"carry only what nothing
else announces"* — which is why it returns `""` for the three banner states,
whose `role="alert"` speaks for them (EV11: never competing live regions).
Moving focus to the review heading makes the heading announce itself, so
`needs_confirmation` joins the banners and returns `""` too. One rule, six
states, instead of a rule and an exception.

**Fix:** `tabIndex={-1}` on the review step's heading plus a mount effect that
focuses it; `announcement()` returns `""` for `needs_confirmation`.

## T2 — A long email in the review step overflows the viewport by 588px

**Responsive.** Found independently by `web-design-guidelines` against its
`min-w-0` / long-content rule pair; the full measurement table is in
`guidelines.output.md`. Recorded here because it is the audit's own
"horizontal scroll: content overflow on narrow viewports" check and it is the
one thing on this surface that fails a dimension.

Short version: `Row`'s `<dd>` is a flex item with `min-width: auto`, so an
unbroken 117-character address sizes to `min-content` — **904px inside a 305px
column**, taking the document to 588px of horizontal overflow at 360. The brief
names the range (`email up to 254`). Neither `min-w-0` nor `break-words` fixes
it alone. Same fix commit as the guidelines finding.

## T3 — `aria-busy` rides on a disabled button — checked, correct as built

Raised because CLAUDE.md carries a closely related rule: *"A `title` on a
DISABLED button reaches nobody"* — `disabled` removes the element from the tab
order, so anything attached to it is unreachable. Re-derived against this case
and **not a defect**: unlike a `title`, the busy state here is also carried by
the visible label swapping to *"Checking in…"*, so there is no information that
exists only in the attribute. The pattern is unchanged from before the redesign.

## What each dimension actually checked

**Accessibility.** Contrast measured per element on the ground it sits on,
across all twelve states: lowest anywhere in `<main>` is **8.51:1**. Zero
`--misa-muted` on the route's own content. `prefers-reduced-motion` — nothing on
this surface animates, and `app/globals.css:808` handles reveals and the marquee
site-wide; the 150ms colour swaps on controls are deliberately left, since
killing them removes feedback without removing motion. ARIA: `aria-labelledby` /
`aria-describedby` split on the checkbox (computed name is *"I haven't checked
in with this form before"* and nothing more — verified), `aria-invalid`,
`aria-busy`, `aria-hidden` on both icons, `role="alert"` on the three banners and
each field error, one `role="status"` region. Semantics: `<button>` for actions,
`<a>` for navigation, `<label>` with a real control, `<dl>` in the shape axe's
`definition-list` rule allows. Heading order h1 → h2. Keyboard: tab order is DOM
order, Confirm precedes Edit so <kbd>Enter</kbd> confirms, no traps, no
`autoFocus`. axe (WCAG 2.0/2.1/2.2 A + AA): clean on the route and on all four
state tests.

**Performance.** No images, no lists, no virtualization question. No animation.
No layout reads in render. The one effect runs a single `querySelector` per
state change. Inputs are uncontrolled, which is also what the React 19 reset
invariant requires.

**Theming.** All ink, ground and frame values are named tokens
(`--misa-secondary`, `--misa-caution`, the three status washes via `Banner`'s
tone map). No `red-700`-style framework scale, which DESIGN.md bans outright.
No dark mode on this project.

**Responsive.** Idle at 360: zero overflow, Check in at 611 on a 640 fold. Every
banner state: zero overflow. 768 and 1280: the sheet holds its 576px measure and
the button returns to 208px rather than stretching — which needed
`sm:self-start`, because a width utility on a stretched flex child is not a
width. Touch targets: box row 320 × 64, Check in 48, both review buttons 48, the
result link 32 (raised to 48 — see `critique.output.md` A2).

**Implementation integrity.** `node .claude/skills/impeccable/scripts/detect.mjs
--json --no-advisory` over both files: `[]`, exit 0. 📌 A clean detector is not
a clean surface — it reads arbitrary `text-[Npx]` values against the ramp and
cannot see `text-sm`, a `leading-` value, an ink token used for the wrong role,
or a flex item that cannot shrink. Every finding on this surface came from the
other six steps.

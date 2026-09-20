---
skill: web-design-guidelines
command: web-design-guidelines on app/(public)/portal/page.tsx and components/ui/portal-band.tsx
date: 2026-09-19
commit: "23fab67c3edd28001eafd034e8566b67fc94c1f5"
output: guidelines.output.md
findings:
  - id: G1
    summary: "page.tsx:141 — flex child without `min-w-0`; long content cannot wrap or truncate beside the fixed 48px key."
    disposition: adopted
    fix_commit: "ab3f6c9c8054754eb491871edaf176a361371219"
  - id: G2
    summary: "page.tsx:141 — `<h2>` inside `<span>`; use semantic HTML, a `<div>` may hold a heading and a `<span>` may not."
    disposition: adopted
    fix_commit: "ab3f6c9c8054754eb491871edaf176a361371219"
  - id: G3
    summary: "page.tsx:139 — `-webkit-tap-highlight-color` not set intentionally on a full-row tap target on a phone-first surface."
    disposition: adopted
    fix_commit: "ab3f6c9c8054754eb491871edaf176a361371219"
  - id: G4
    summary: "page.tsx:139 — no `touch-action: manipulation`, which the guidelines prescribe against the 300ms double-tap delay."
    disposition: rejected
    reason: "Already settled by the brief's evidence step and recorded there: EV4 rejected this exact guideline because Next emits a `width=device-width` viewport meta by default (the root layout's `viewport` export adds only `themeColor`), which removes the 300ms delay in every current mobile browser. Re-adopting it at the gate would put a class in the codebase whose stated purpose is already served, against a receipt that argued it out."
  - id: G5
    summary: "page.tsx:176 — \"sign in\" is not Title Case; the guidelines ask for Title Case (Chicago) on headings and buttons."
    disposition: rejected
    reason: "Conflicts with a CLAUDE.md invariant that wins on this repo: \"Button labels are sentence case in the DOM; `components/ui/button.tsx` already applies `uppercase`.\" This is a link rather than a button, and sentence case is the house register PRODUCT.md describes (\"plain, warm and unpretentious, addressed to a student\"). The roster gives `web-design-guidelines` override authority over *aesthetic preference* on accessibility findings; capitalisation is neither."
  - id: G6
    summary: "Hover states present on every interactive element, with hover/active/focus more prominent than rest — the guidelines' 'interactive states increase contrast' rule."
    disposition: rejected
    reason: "Passes as written, but the check is misleading here and the reason is worth keeping: Tailwind v4 gates `hover:` behind `@media (hover: hover)`, so a rule satisfied by reading the source is not satisfied on the device this surface is designed for. The real gap was the missing press state, which this checklist has no rule for and which `motion.md` M1 and `critique.md` A1 caught."
---

Guidelines fetched fresh from
`https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`
before review, per the skill.

📌 **Three adopted, two rejected against a written prior decision, one pass
recorded because passing it proved less than it looks.** G4 and G5 are both
cases where this repository has already had the argument and written down the
answer — EV4 in the surface's own evidence receipt, and CLAUDE.md's
sentence-case invariant. Neither is "not needed": each names the rule it
conflicts with, which is what the gate asks for.

🪤 **G6 is the finding that matters most and it is filed as a pass.** The
checklist asks whether interactive elements have hover states; they do, and the
file looks correct. What the checklist cannot ask is whether the *user* ever
sees them. On a surface whose primary persona is "a member on their own phone,
standing at an event", a hover-only affordance is no affordance — and Tailwind
v4's automatic `@media (hover: hover)` gating means the source and the rendered
result disagree about whether feedback exists. A generic web checklist read
this surface as passing; the mode's own lead, the motion step and Assessment A
all read it as the page's largest gap.

**Not applicable to this surface, checked and confirmed:** forms (none),
images (none), i18n/`Intl` formatting (no dates or numbers), hydration safety
(no client component, no `value` without `onChange`), dark mode (refused
site-wide), large lists (three items), destructive actions (none), URL state
(no state), drag/gesture (none), autoplay media (none).

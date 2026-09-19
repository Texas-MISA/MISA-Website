---
skill: ui-ux-pro-max
command: /design-brief portal-hub — step 3, search.py lookups (--domain ux, --domain web, --stack nextjs), 11 queries
date: 2026-09-19
commit: "f0cb15a53bbca1ee14674ebcc96cd263b0844757"
output: evidence.output.md
findings:
  - id: EV1
    summary: "'touch target size mobile' (ux), result 1 — 44pt on iOS and 48dp on Android; the web's WCAG floor is 24 CSS px. Severity High."
    disposition: adopted
    reason: "Settles the brief's open tap-target size. Members use their own phones, so the native minimum governs rather than the web floor: every destination's target is at least 48px tall. Today's 39px buttons fail it; concept A's full rows (~97–149px) clear it."
  - id: EV2
    summary: "'touch target size mobile' (ux), result 2 — a minimum 8px gap between adjacent touch targets."
    disposition: rejected
    reason: "Written against small, tightly packed controls. Concept A's rows are full-width targets at least 97px tall, divided by the 1px seam of a shared-rule plate (DESIGN.md: one background through gap:1px); target size, not a gap, is what prevents a mis-tap there, and an 8px gap would break the plate into three cards."
  - id: EV3
    summary: "'clickable card whole row link' (ux) — returned one result, Compact Label Overflow (badge and pill wrapping)."
    disposition: rejected
    reason: "No database match for the actual question, whether a whole row may be the link. The returned guideline is about badge labels, which the hub does not have. The row-link decision rests on concept A and EV14, not on this lookup."
  - id: EV4
    summary: "'entrance animation delay content' (ux) — Tap Delay (use touch-action: manipulation against the 300ms delay), Auto-Rotating Content Controls, Continuous Animation."
    disposition: rejected
    reason: "Tap Delay is already handled: Next emits a width=device-width viewport meta by default (the root layout's viewport export adds only themeColor), which removes the 300ms delay in every current mobile browser. The other two concern carousels and looping animation, which the hub has neither of. The brief's no-reveal-on-destinations rule rests on its own measurements and DESIGN.md's html.js hidden state."
  - id: EV5
    summary: "'focus visible keyboard navigation' (ux), results 1–2 — tab order aligned with visual order; a visible focus ring on every operable control, never removed without replacement. Severity High."
    disposition: adopted
    reason: "Decides the row link's keyboard contract: tab order check-in → leaderboard → lookup → officers sign-in, identical to reading order, and a focus ring on every row that the plate's seam and overflow cannot clip."
  - id: EV6
    summary: "'focus visible keyboard navigation' (ux), result 3 — WCAG 2.2 AAA Focus Not Obscured (Enhanced): persistent UI must not hide any part of the focused component."
    disposition: deferred
    reason: "The 61px sticky header is site-wide and outside this surface. On the hub it cannot bite in concept A, where all three rows sit in the first screen at 360×640, so it belongs to the header rather than to this brief."
  - id: EV7
    summary: "'link prefetch navigation' (--stack nextjs), result 2 — use next/link for internal navigation; client-side navigation with prefetching. Severity High."
    disposition: adopted
    reason: "Speed to check-in is the brief's one hard bar. Every destination stays a next/link <Link> with the default prefetch (Next 16: 'auto', which prefetches a route when its link enters the viewport), so the tap to check-in is a client-side transition, not a full page load."
  - id: EV8
    summary: "'link prefetch navigation' (--stack nextjs), result 1 — prefetch={false} for low-priority links; don't prefetch everything."
    disposition: rejected
    reason: "The three destinations are the whole of the page's purpose, not low-priority links, and the node_modules docs reserve prefetch={false} for large lists such as an infinite-scroll table. The officers sign-in link is left at the default too: one extra prefetch is not worth a special case."
  - id: EV9
    summary: "'navigation menu list mobile' (ux) — Back Button (preserve history), Sticky Navigation (pad content under a fixed nav), Mobile Keyboards (inputmode)."
    disposition: rejected
    reason: "Nothing here decides a hub question. <Link> pushes history, so Back already works; the sticky header is in flow (position: sticky), so it overlaps nothing; the hub has no inputs."
  - id: EV10
    summary: "'link accessible name purpose' (--domain web) — Decorative Icons, Icon Button Labels, Dragging Alternatives, all tagged iOS/Android/React Native."
    disposition: rejected
    reason: "Wrong platform: every result is React Native. The web principle it would support (the chevron is decorative, so aria-hidden, and the link's name is the row's title) is already in concept A on its own terms."
  - id: EV11
    summary: "'card link nested interactive' (--domain web) — Role & Traits (expose correct accessibility roles), React Native."
    disposition: rejected
    reason: "React Native only. On the web a row made of a single <Link> already exposes the link role; there is no nested control in concept A for the guideline to govern."
  - id: EV12
    summary: "'content visible without javascript animation' (ux) — Auto-Rotating Content Controls, Bundle Size, Font Loading (reserve space with a fallback font)."
    disposition: rejected
    reason: "No match for the question asked. Font loading is already handled by next/font in the root layout, and the hub ships no carousel or new bundle."
  - id: EV13
    summary: "'primary action above the fold' (ux) — 0 results; the database reported no match."
    disposition: rejected
    reason: "No database match, recorded so the gap is visible. The first-screen requirement comes from the officer's anti-goal and the brief's measurement, not from this skill."
  - id: EV14
    summary: "'hover state touch devices' (ux), result 1 — hover effects do not work on touch; never rely on hover alone for important actions. Severity High."
    disposition: adopted
    reason: "Decides concept A's affordance: what tells a member a row is a link — the navy key and its chevron — is visible at rest on every row, and hover only swaps ink. A member on a phone never sees hover, so nothing may depend on it."
---

Eleven queries, fourteen dispositions: a query whose results pointed different
ways is split by result. **Adopted and cited in the brief's `## Evidence`:
EV1, EV5, EV7, EV14.** Three queries returned nothing relevant (EV3, EV12, EV13),
and two domains answered only for React Native (EV10, EV11). They are recorded
as misses rather than read as support.

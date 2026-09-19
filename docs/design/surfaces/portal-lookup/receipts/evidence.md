---
skill: ui-ux-pro-max
command: /design-brief portal-lookup — step 3, search.py lookups (--domain ux, --domain web), 7 queries
date: 2026-09-19
commit: "8d5dcf2575c4677649c7960a0d11ab55a47d4b15"
output: evidence.output.md
findings:
  - id: EV1
    summary: "'definition list semantics' (--domain web) — 0 results; the database reported no match."
    disposition: rejected
    reason: "No database match, recorded as a miss. The definition-list fix rests on the axe rule the local test suite already fails on, and on the HTML spec: a dl group holds dt and dd, so the stat's note becomes a second dd."
  - id: EV2
    summary: "'horizontal scroll table columns mobile' (ux), result 1 — Horizontal Scroll: content fits the viewport; never wider. Severity High."
    disposition: adopted
    reason: "Names the measured defect: the events table is 512px inside a 320px frame, so 'You' — the column saying whether you attended — is only reachable by scrolling sideways. On a phone, the attendance state must be readable without it."
  - id: EV3
    summary: "'horizontal scroll table columns mobile' (ux), result 2 — Table Handling: use a horizontal scroll wrapper or a card layout."
    disposition: adopted
    reason: "Chooses the remedy between the two it offers: below sm each event becomes a stacked row (the 'card layout' branch) carrying title, when, points and state; from sm the four-column table returns. The scroll-wrapper branch is what the page does today, and it is what hides the state column."
  - id: EV4
    summary: "'horizontal scroll table columns mobile' (ux), result 3 — Smooth Scroll for anchor links."
    disposition: rejected
    reason: "The page has no anchor links, and scroll behaviour is a site-wide concern rather than this surface's."
  - id: EV5
    summary: "'stat metric display dashboard' (ux) — 0 results; the database reported no match."
    disposition: rejected
    reason: "No database match, recorded as a miss. How the four numbers are set comes from DESIGN.md's ramp and the officer's order (points, dues, events)."
  - id: EV6
    summary: "'status badge pill meaning' (ux), result 2 — Compact Label Overflow: a badge or pill label stays whole on one line; use nowrap with a shrinkable neighbour, never a hover-only tooltip. Severity High."
    disposition: adopted
    reason: "Decides how the stacked phone row holds together: the attendance pill (attended / missed) and the dues pill never wrap, and the event title beside them shrinks and wraps instead. At 360px that is the difference between a readable row and a two-line badge."
  - id: EV7
    summary: "'status badge pill meaning' (ux), result 1 — one atomic contextual status message (role=status, aria-atomic), never a bare value or competing live regions. Severity High."
    disposition: adopted
    reason: "A found result replaces the form, and nothing announces it today: role=alert covers the miss, but success is silent and focus is left where the submit button was. One always-mounted atomic status region announces the result ('Showing Avery Placeholder's record for Fall 2026'), and focus moves to the result's heading. Same pattern as check-in's EV11, so the portal answers this the same way twice."
  - id: EV8
    summary: "'status badge pill meaning' (ux), result 3 — Submit Feedback: loading, then success or error."
    disposition: rejected
    reason: "Already built: 'Looking up…' with aria-busy, then a result or a banner."
  - id: EV9
    summary: "'personal data privacy display' (ux) — returned Bulk Actions and Auto-Play Video."
    disposition: rejected
    reason: "No match for the question asked. What this page may show, and to whom, is settled by CLAUDE.md's invariants and the officer's 2026-08-25 decision, not by a UX database."
  - id: EV10
    summary: "'page heading structure landmarks' (ux), result 3 — Heading Hierarchy: sequential heading levels, never skipped or used for styling."
    disposition: adopted
    reason: "Constrains the result's re-layout: the page keeps one h1, the member's name stays an h2 beneath it, and each result section stays an h3. Removing the intro or re-ordering the sections must not promote a section to h1 or skip a level to get a size."
  - id: EV11
    summary: "'page heading structure landmarks' (ux), results 1–2 — Image Optimization; Active State in navigation."
    disposition: rejected
    reason: "The page has no images, and the header already marks the portal as current on every /portal page."
  - id: EV12
    summary: "'result after search feedback' (ux), result 1 — No Results: show a message with suggestions rather than a blank screen or '0 results'."
    disposition: rejected
    reason: "Already satisfied, and capped by an invariant: the miss message suggests a typo check and explains that someone who has never checked in won't be on the roster, and it must stay ONE message for every miss — never split by reason, which is what keeps the EID-alone gate from answering 'is this EID on the roster?'."
---

Seven queries, twelve dispositions: a query whose results pointed different ways
is split by result. **Adopted and cited in the brief's `## Evidence`: EV2, EV3,
EV6, EV7, EV10.** Two queries returned nothing at all (EV1, EV5) and one
returned unrelated rules (EV9); all three are recorded as misses rather than
read as support.

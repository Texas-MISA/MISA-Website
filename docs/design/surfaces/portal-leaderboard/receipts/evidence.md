---
skill: ui-ux-pro-max
command: /design-brief portal-leaderboard — step 3, search.py lookups (--domain ux), 8 queries
date: 2026-09-19
commit: "934fc5536d5c67e365c61035b275c76f369faa98"
output: evidence.output.md
findings:
  - id: EV1
    summary: "'data table mobile responsive' (ux), result 1 — Table Handling: a horizontal scroll wrapper or a card layout so a table never overflows on mobile."
    disposition: rejected
    reason: "Three columns fit 360px without either: names wrap (EV10), and the points column stays on screen. A card per member would multiply the board's height by 150 and lose the column you scan down; a horizontal scroll would hide the points column, which is the number members come for."
  - id: EV2
    summary: "'data table mobile responsive' (ux), results 2–3 — Mobile First; the viewport meta tag."
    disposition: rejected
    reason: "Nothing to decide: the project's Tailwind is mobile-first throughout, and Next emits width=device-width, initial-scale=1 (verified on /portal during the hub's brief)."
  - id: EV3
    summary: "'sticky table header' (ux), result 2 — Sticky Navigation: a fixed or sticky bar must not obscure the content beneath it."
    disposition: adopted
    reason: "Measured: the board's column head is NOT sticky today (THead's sticky is opt-in and paired with maxHeight, and the leaderboard opts out), so on a 50–150 row board the Rank / Member / Points labels scroll away. Decision: the column head sticks while the board scrolls, below the 61px sticky site header, never under it. Any scroll-to target accounts for both bars."
  - id: EV4
    summary: "'number alignment tabular figures' (ux) — Number Formatting: thousand separators or abbreviations for large numbers."
    disposition: rejected
    reason: "Term totals run in the tens (the seed tops out at 23), and even a long term stays well under 1,000. Right-aligned tabular figures, which do matter here, are the concepts' own decision."
  - id: EV5
    summary: "'font size readability distance' (ux), result 1 — Readable Font Size: at least 16px body text on mobile. Severity High."
    disposition: adopted
    reason: "Names render at 14px today, below this floor. Every name on the board, compact rows included, is at least 16px on a phone. The recognised places go larger still."
  - id: EV6
    summary: "'font size readability distance' (ux), result 2 — Font Size Scale: a consistent modular scale, never arbitrary sizes."
    disposition: adopted
    reason: "Decides where the recognised places' larger sizes come from: DESIGN.md's own ramp (Card title 22 → 26px, Title 26 → 34px), not one-off values picked to fill a projector."
  - id: EV7
    summary: "'font size readability distance' (ux), result 3 — Duration Timing: motion duration depends on context; use shared tokens."
    disposition: rejected
    reason: "Not a size question, and motion on this page is emil-design-eng's call under DESIGN.md's shared duration tokens."
  - id: EV8
    summary: "'leaderboard ranking gamification' (ux) — 0 results; the database reported no match."
    disposition: rejected
    reason: "No database match, recorded so the gap is visible. The top-10 treatment rests on the officer's answers (top 10 recognised, projected as-is) and the brief."
  - id: EV9
    summary: "'long text wrap truncation' (ux), result 1 — Truncation: ellipsis plus an expand option."
    disposition: rejected
    reason: "A name is the text that tells two members apart (EV10), and a public read-only board has no expand control to offer. Names wrap instead."
  - id: EV10
    summary: "'long text wrap truncation' (ux), result 2 — Essential Text Truncation: headings, actions and distinguishing names need complete access; wrap or resize, never clamp. Severity Critical."
    disposition: adopted
    reason: "Decides long names (up to 120 characters): they wrap within the member column, never ellipsised or clamped, and never push the points column off a 360px screen."
  - id: EV11
    summary: "'long text wrap truncation' (ux), result 3 — Line Length: 65–75 characters per line."
    disposition: rejected
    reason: "DESIGN.md §Design toolkit records a 65–75ch measure as a refused skill conflict, and it is a prose rule where this page is a table."
  - id: EV12
    summary: "'table caption semantics screen reader' (ux) — semantic HTML and ARIA, not div soup (with two repeats: the error summary, table handling)."
    disposition: rejected
    reason: "Already built: a real table with an sr-only caption naming the term, and th headers. Concept A keeps the ranking one table; that is the concept's decision, which this lookup does not add to."
  - id: EV13
    summary: "'empty state' (ux), result 1 — Empty States: a helpful message and an action, never a blank screen."
    disposition: rejected
    reason: "The message is already there ('Points appear here once the term's first event has been held'), and the page's lookup line sits under every state, the empty one included. The empty board has no action of its own: nothing a member does makes points appear before an event."
  - id: EV14
    summary: "'empty state' (ux), results 2–3 — Active State in navigation; Deep Linking of view state into the URL."
    disposition: rejected
    reason: "The header's MEMBER PORTAL button already marks the portal as current on every /portal page, and the board has no view state (no filter, no sort, by the officer's answer) to put in a URL."
---

Eight queries, fourteen dispositions: a query whose results pointed different
ways is split by result. **Adopted and cited in the brief's `## Evidence`: EV3,
EV5, EV6, EV10.** One query returned no match (EV8), recorded as a miss rather
than read as support.

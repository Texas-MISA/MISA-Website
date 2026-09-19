---
skill: frontend-design
command: /design-brief portal-attend — step 2, frontend-design, two concepts against .impeccable/surfaces/route-portal-attend.md
date: 2026-09-19
commit: "eb1e13c1d51fbb3b50417ac492d27291df1b6599"
output: diverge.output.md
findings:
  - id: A
    summary: "Fit the first screen — the hub's short field band, the form on white at the xs rhythm with 16px gaps, the box label stating a fact the member knows plus an inline reassurance line, a 48px full-width Check in (bottom ≈628 at 360×640, today 671), banners and results in place in the same sheet, outcomes status-coded."
    disposition: adopted
    reason: "Meets the bar with no JavaScript and no covered content, puts the answer to the officer's named problem (the box wording) where every member reads it, and makes check-in read as the same portal as the hub's adopted concept. Its 12px of slack at 360×640 is a real risk and becomes a gate measurement. The shared copy (box label and reassurance, review step, results, lookup link) is a proposal for the officer."
  - id: B
    summary: "The pinned action — the full PageHero kept, Check in pinned in a 72px sticky bar at the phone viewport's bottom (always 568–640), a short box label with a 'Not sure?' disclosure, focus moved to the result on submit."
    disposition: rejected
    reason: "At scroll 0 the bar covers the email field and the checkbox, the very control the officer named as the problem. A fixed bar and the phone keyboard fight on iOS, and fixing that needs the visualViewport API: JavaScript on a form that must work before hydration. It risks WCAG 2.4.11 (a sticky bar covering the focused field) on a site with no scroll padding yet. And it hides the one sentence that answers the officer's problem behind a disclosure the confused member has to know to open."
---

The lead (`impeccable`, Operate) adopted **A** and rejected **B**. Both concepts,
and the copy decisions they share, are in full in `diverge.output.md`; the
decision is also recorded under the brief's `## Diverge`.

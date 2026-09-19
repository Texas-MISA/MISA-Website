---
skill: frontend-design
command: /design-brief portal-lookup — step 2, frontend-design, two concepts against .impeccable/surfaces/route-portal-lookup.md
date: 2026-09-19
commit: "8d5dcf2575c4677649c7960a0d11ab55a47d4b15"
output: diverge.output.md
findings:
  - id: A
    summary: "The receipt — the portal's short navy band, then one white sheet read in the officer's order: name and term, the four numbers with the total largest, pending check-ins, dues, events (stacked rows below sm, the table from sm), points granted separately. Field ≈238–288 and button ≈304–352 on the first phone screen; the member's numbers at ≈300 instead of 517."
    disposition: adopted
    reason: "Keeps the officer's stated order — points, dues, events — with each part in its own voice, and it is check-in's own shape, which answers the officer's named anti-goal of the portal reading as several products. It fixes all four measured problems: the button off the fold, the name at 517, the sideways scroll for the attendance state, and the definition-list fault. Its cost is a long sheet on a phone, so order carries the weight; that is a gate measurement."
  - id: B
    summary: "One ledger — the numbers compressed to a summary line with dues beside the name, then every event, pending check-in and points grant merged into one chronological list of uniform rows."
    disposition: rejected
    reason: "It flattens the order the officer gave: events become something to read past, and dues shrinks to a pill. It also asserts one timeline across three record types that only coincidentally share it — an event's start time, a grant's awarded date, a check-in's submitted time — and an orphan pending has no event to sit beside. The explanation that granted points are the difference between attendance points and the total has nowhere to live in a row-per-item list. Recorded for the officer, who may overrule."
---

The lead (`impeccable`, Operate) adopted **A** and rejected **B**. Both concepts,
and the decisions they share (the short band, the first-screen field, the
definition-list fix, stacked event rows on a phone, dues as a status rather than
a verdict), are in full in `diverge.output.md`; the decision is also recorded
under the brief's `## Diverge`.

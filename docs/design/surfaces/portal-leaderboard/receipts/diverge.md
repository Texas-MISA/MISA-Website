---
skill: frontend-design
command: /design-brief portal-leaderboard — step 2, frontend-design, two concepts against .impeccable/surfaces/route-portal-leaderboard.md
date: 2026-09-19
commit: "934fc5536d5c67e365c61035b275c76f369faa98"
output: diverge.output.md
findings:
  - id: A
    summary: "The board is the page — no navy hero; a white title row with the term set large; one table whose recognised places (rank ≤ 10, once anyone has points) are set larger, closed by a navy cut line, then compact rows below. Top 10 end ≈677 of 720 at 1280×720; rank 3 ends ≈333 at 360×640."
    disposition: adopted
    reason: "Serves all three audiences in one ranking: the race at the top, the member finding their own row (no screen of navy to scroll past first), and the projector. It keeps one table, so the ranking stays one structure for screen readers, and every state reuses the existing light-ground primitives. Its costs are recorded, not hidden: it is the only public page without the navy hero, which needs the officer's yes, and a tie at rank 10 can push the last recognised row past the fold at 1280×720, which becomes a gate measurement."
  - id: B
    summary: "The honours board — the top 10 move into the navy field hero in white type, two columns of five at desktop, one column of ten on a phone; ranks 11+ continue on white as a compact table. Top 10 end ≈470 at 1280×720; rank 3 ends ≈293 on a phone."
    disposition: rejected
    reason: "It splits one ranking into two structures (a list in the hero and a table below it), which screen readers meet separately. It makes every member finding their own row scroll past a full screen of navy on every visit, and that audience is one of the three the officer named. Its error and empty states need on-navy variants of shared primitives that don't exist. It is the stronger picture for the top 10 and is recorded for the officer, who may overrule."
---

The lead (`impeccable`, Operate) adopted **A** and rejected **B**. Both concepts,
and the decisions they share, are in full in `diverge.output.md`; the decision
is also recorded under the brief's `## Diverge`.

---
skill: officer
command: officer instruction, 2026-09-20 — "the navy header at the top of each page should be removed for all pages in the portal. the design skills can come up with a replacement."
date: 2026-09-20
commit: "30bcec549c8bc78983afc093d9964f2b9727a9c9"
output: officer.output.md
findings:
  - id: O1
    summary: "Remove the navy band (`PortalBand`) from `/portal`. The officer gave the instruction against a screenshot of this very page on the deployed preview, with the band circled, scoped to every page in the portal."
    disposition: adopted
    fix_commit: "ca5cd06be488d085cebeed009aece22c8144b971"
  - id: O2
    summary: "The replacement, proposed by `frontend-design` and adopted by the officer: the sheet is the page — the hub becomes one white `.sheet` on the grey ground, its title a masthead above a bleeding rule, with the shared-rule plate as the document's body. The rejected alternative kept the title on the page ground with the plate as a separate surface below."
    disposition: adopted
    fix_commit: "ca5cd06be488d085cebeed009aece22c8144b971"
  - id: O3
    summary: "The destinations plate now BLEEDS to the sheet's edges (negative margins tracking the sheet's padding, `border-y` rather than a full frame) and the officer line moved inside the sheet, so the hub is one object rather than a framed plate inside a framed sheet — the doubled rule `Panel`'s `frameless` prop exists to avoid."
    disposition: adopted
    fix_commit: "ca5cd06be488d085cebeed009aece22c8144b971"
---

The officer's own review, taken after `portal-hub` was already `rebuilt`. This
receipt exists so `scripts/design/receipts.mjs` can tell an officer-requested
change from drift: without it, `ca5cd06` reads as **stale** against all seven
review steps. 📌 An officer receipt never counts as "a skill changed the
outcome" — the twelve findings the hub's gate adopted still carry that.

📌 **This page is where the instruction came from.** The screenshot the officer
marked up was `/portal` on the deployed preview, with the navy band circled. The
instruction was scoped to all four portal pages, so `/portal/attend` carries the
same receipt and the two un-rebuilt surfaces took the header removal alone.

## The hub got faster

Its bar is the check-in row's bottom edge at 360×640, "at or above 424". It was
**423** before the rebuild and **325** after it. With the band gone and the plate
bleeding inside the sheet, it is **267.2** — and all three destinations plus the
officer line still sit on the first screen.

⚠️ **This line read 265.5 until the 2026-09-20 re-gate, and 265.5 does not
reproduce.** 267.2 was measured three times independently that day — by the lead,
by the `design-reviewer` agent and by the critique's assessment B, the last
deriving it from the box model rather than from a browser — and it falls out of
the CSS chain to the pixel (61 header + 24 `padTop="xs"` + 1 sheet border + 20
padding + 26.52 h1 + 16 + 1 rule + 24 + 1 plate border + 92.70 row). 1.7px
changes nothing about the gate, which is met either way by more than 150px; it is
corrected because a frozen surface should not carry a figure that no longer
reproduces. `officer.output.md` keeps the original table verbatim, because it is
a raw output and not a place to rewrite history.

The layout-family budget dropped from two to one: the band and the plate were
two stacked sections, and the hub is now a single object.

## What this change also settled

🔓 **The hub's second deferred officer question is moot.** `critique.md` A3
recorded that `PortalBand title="Member Portal"` rendered directly under the
header's current-marked **MEMBER PORTAL** button — two identical phrases within
90px, costing 130.5px on the page whose named anti-goal is height. The band is
gone, so the restatement is gone with it. The h1 remains "Member Portal", which
is the officer's approved copy, but it now sits inside the sheet as a masthead
rather than in a 131px navy band.

🪤 The **third** deferred question is NOT settled: at 360 the destination rows
still rake 93 / 118 / 144px because their bodies wrap to one, two and three
lines, and that is driven by the officer's copy rather than by formatting. It
stays open.

## What is NOT claimed

The seven review steps ran against `23fab67` / `ab3f6c9`. This change alters the
page's composition after them, and the measurements here are the lead's, re-run.
The `design-reviewer`, the critique and the audit have not seen the sheet. If the
officer wants the surface re-gated rather than amended, it goes back through
`/design-gate`; this receipt records the instruction, the concepts, the adoption
and the numbers that moved, and claims nothing further.

## ✅ SUPERSEDED — the surface WAS re-gated, 2026-09-20

The section above is kept as written, because it correctly stated its own limits
at the time. Those limits are now closed: **all seven review steps have been
re-run against `a660ada`, the sheet build, and their receipts replaced.** The
`design-reviewer`, the critique's two assessments, the audit, the lead, the
guidelines and the motion step have all now seen the sheet.

They found four things the sheet build introduced or exposed and nobody had
reviewed, fixed in `92076ac`:

- the row focus indicator **did not enclose the 48px navy key at all** — the
  white ring this receipt's own build shipped never painted, and the file argued
  at length that it did;
- the row text column **aligned with the masthead at no width**, and the sign of
  the miss inverted across `sm` — the cell's padding was a flat `px-6` against a
  sheet at `px-4 sm:px-8`;
- two 16px paragraphs at two different leadings, 20px apart;
- the officers sign-in target at 44.9 × 32px, the one target on the page under
  the floor the comment beside it cites.

It also found three claims in the page's comments that this change had made
false, including one paragraph that contradicted itself within seven lines.

🪤 **The third deferred question is STILL not settled, and the re-gate did not
quietly settle it.** At 320 and 360 the rows still rake 92.7 / 118.3 / 143.9
because the officer's copy wraps to one, two and three lines. The alignment fix
widened the phone text column 222 → 238px and one assessment predicted that might
collapse the rake; **it was measured after the fix and it does not.** It goes to
the officer unchanged, now with three other questions the re-gate raised: the
header's MEMBER PORTAL button announces the current page to a screen reader and
shows nothing to an eye, the masthead rule and the plate's top border state one
boundary twice, and "Points Leaderboard" on the hub arrives at a sheet titled
"Leaderboard".

---
skill: impeccable
command: /impeccable critique app/(public)/portal/page.tsx
date: 2026-09-20
commit: "a660ada662ead1f827746d68f57421a98084c5b2"
output: critique.output.md
findings:
  - id: A1
    summary: "The masthead does not align with the rows, and the misregistration INVERTS across `sm`: h1 and officers line at x 37 against titles at x 45 at 360; 289 against 281 at 1280. The plate bleeds by exactly the sheet's padding and the cell then re-pads by a third value. On a document whose whole idea is a masthead above a body, the left margin is the strongest alignment line on the page and the titles sit on it at no width at all."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: A2
    summary: "Visibility of system status scores 3, and the reason is a control this surface does not own: on /portal the header's MEMBER PORTAL button links the page you are already on, carries `aria-current=\"page\"` and NO visual state, while the same header's desktop nav items do get one. At 1280 no nav item is active on this route, so the header shows no visible current-location marker at all, and the page's `<h1>` is the only one left."
    disposition: deferred
    reason: "The fix is in `components/site-header.tsx`, shared chrome outside this surface's registered files — `docs/design/surfaces.json` scopes portal-hub to `app/(public)/portal/page.tsx` alone. Editing it here would put a surface's gate in charge of site-wide chrome. It is also the correct lever for the long-deferred A3 (see below), so the two should go to the officer together. Round 6 of the portal rebuild owns work outside the four portal surfaces."
  - id: A3
    summary: "The page h1 restates the header's MEMBER PORTAL button that was just tapped — and the two identical phrases are now 52px apart, CLOSER than the 90px the finding was originally filed at."
    disposition: rejected
    reason: "RESOLVED by the sheet build, and it must not be actioned. The 130.5px navy band that made the redundancy expensive is gone; the masthead costs ~67px against 157px of headroom. Three reasons to keep the h1: on the other three portal pages the masthead is not a restatement, so the duplication is a one-page artifact of a four-page system that is otherwise right; removing the band made all four portal pages identical sheets, so the masthead is now the only per-page identity in the portal; and per A2 the h1 is the ONLY visible `you are here` on this page, so deleting it would remove the page's sole location marker to solve a problem caused by a control that refuses to mark location. The correct lever is A2, in shared chrome. This closes the deferred question the 2026-09-19 critique opened."
  - id: A4
    summary: "At 320 and 360 the three rows rake 92.7 / 118.3 / 143.9 because the officer-approved bodies wrap to one, two and three lines, so the least-urgent destination is the largest object on the phone screen. Re-examined against the sheet build and re-measured after this gate's own fix."
    disposition: deferred
    reason: "Still the officer's copy to cut, and the geometry complaint does not survive scrutiny. Everything — all three rows, the officers line and the sheet's bottom edge — is inside the 640 fold, so nothing is pushed off-screen, reached later or harder to tap, and size is not functioning as a rank cue because the reader's cue is ORDER and check-in is first and topmost. Against acting: the officer's `may change` list names the hero, the row titles, the button labels and the officers line and CONSPICUOUSLY OMITS the bodies; each body is verbatim its destination's `metadata.description`, so both files would have to move together; and it would probably leave a 1/2/2 rake rather than equality. 🔴 This gate's A1 fix widened the phone text column 222 to 238px, which Assessment A predicted might collapse the rake — MEASURED AFTER, and it does not: the bodies still wrap 1 / 2 / 3 and the rows still rake 92.7 / 118.3 / 143.9. Goes to the officer unchanged, with A2/A3."
  - id: A5
    summary: "One boundary is stated twice: the masthead rule occupies 148.5-149.5 and the plate's top border 173.5-174.5 — two identical full-bleed hairlines, same token, 24px apart, with nothing between. A document masthead's rule IS the top edge of its body, and DESIGN.md's named rule that two adjacent borders read as a double rule is the same idea. Unique to the hub: the other three `PortalSheet` callers open with a form or a `<p>`."
    disposition: deferred
    reason: "A visible composition change with a real trade on each side, and neither side is obviously right. `border-y` to `border-b` removes the duplicate but leaves the first cell's top edge unruled while every other cell has a rule above it; tightening the gap instead means changing `mt-6`, which lives in the shared `PortalSheet` with four callers and would move three other pages. The officer adopted this composition eleven days ago and should see a picture of both before one is chosen. Goes to the officer with A2, A3 and A4."
  - id: A6
    summary: "`Points Leaderboard` on the hub arrives at a sheet titled `Leaderboard`. One of three; the other two match exactly. Small when every portal page opened with a navy band that announced arrival — but with the band gone the masthead is the SOLE arrival confirmation, so a label that does not match the title it produces costs strictly more than it did on 2026-09-18 when the copy was approved. A finding created by the un-reviewed build."
    disposition: deferred
    reason: "Two fixes exist and they belong to different surfaces. Retitling the hub's row is inside the officer's granted latitude (`may change: the row titles and button labels`) and is in this file; retitling the destination belongs to `/portal/leaderboard`, which is `in-progress` and unguarded and is round 5's. Choosing the hub-side fix now would pre-empt a surface whose own brief has not been built against yet, and choosing wrong means changing it twice. Goes to the officer with the others."
  - id: A7
    summary: "The sheet's whole identity rests on 1.12:1 — white on the `#f2f2f3` page ground — carried by a 1.84:1 frame and a 6-8% shadow, for a user the brief places outdoors at an event on a phone."
    disposition: rejected
    reason: "Not a WCAG failure: a container boundary is neither a UI-component boundary nor a graphic required to understand the content, so 1.4.11 is not engaged, and axe returns 0 violations at all three widths. `.sheet` is a shared primitive in `app/globals.css` with callers across the site, and `--misa-plate-edge` is DEFINED as Frame resolved over Vellum Shade, so moving it repaints every plate, panel and photograph. Assessment A's own analysis is the decisive part: the failure is completely benign — if the sheet vanishes the member still sees a title, a rule, three rows and a line at 8.51:1 minimum. A composition whose signature device degrades to harmless is a well-chosen composition. Filed so the fragility is on the record before it is reported as a bug."
  - id: B1
    summary: "The layout-family declaration names a family the page does not render and its section count is wrong: `Band ... field + chevron notch` and `TWO sections` against one `<Section>`, zero field ground, zero chevron notch. Contradicted 90 lines below in the same file."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: B2
    summary: "The ground and ratio given as the REASON for the officers line's ink describe a ground it no longer sits on: `--misa-secondary` at `7.60:1 there` is that token on the grey, and `ca5cd06` moved the line inside the sheet, where it is 8.51:1."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: B3
    summary: "`Lowest ratio anywhere on the route is 7.60:1` is false in both directions and is contradicted two lines above itself by the footer's 4.84:1. The page bottoms out at 8.51:1 and the route at 4.84:1."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: B4
    summary: "Two 16px `--misa-secondary` paragraphs in one surface render at two different leadings, 20px apart: row bodies `leading-[1.6]` = 25.6px, the officers line with no leading class inheriting 1.5 = 24px. Derivable from its own measured 32.0px box."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: B5
    summary: "The page's left edge lands at three x positions and the offset flips sign between breakpoints — the same defect as A1, measured independently and without knowing A had called it."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: B6
    summary: "The officers sign-in link is the page's one target below the brief's own EV1 floor: 44.9 x 32px. WCAG 2.2 SC 2.5.8 passes; EV1's 44pt/48dp does not."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: B7
    summary: "The key's white focus ring is a closed rectangle, so it paints a fourth edge inside the composite indicator at the text/key seam — CSS `outline` always draws four sides and a three-sided one is not expressible."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: B8
    summary: "The bar figure disagrees across four documents and 267.2 is the one that reproduces: 267.22 falls out of the CSS chain exactly (61 + 24 + 1 + 20 + 26.52 + 16 + 1 + 24 + 1 + 92.70) and 265.5 falls out of nothing."
    disposition: adopted
    fix_commit: "92076acfdd70303a85f35573f349732a6e22f0fc"
  - id: B9
    summary: "The detector's type-ramp rule is not merely blind to `text-sm` — it is SWITCHED OFF. `normalizeDesignSystem` populates `allowedFontSizes` only from `frontmatter.typography`, and DESIGN.md's frontmatter has no `typography` key, so `design-system-font-size` abstains including for the arbitrary `text-[Npx]` values it is supposed to catch. Same for fonts; the radius key is `radius:` where the reader wants `rounded:`. Only `hasColors` is true, so against a .tsx file the scan has exactly one thing it can say. Proved with six planted probes, five of which returned nothing."
    disposition: deferred
    reason: "A TOOLKIT finding, not a surface finding: the fix is in DESIGN.md's frontmatter or in `.claude/skills/impeccable`, neither of which this surface owns, and adding a `typography` key to DESIGN.md's frontmatter would change what the detector reports on every surface in the registry — including the two still `in-progress`, mid-flight. It also cannot be validated by this gate, because the hub has no off-ramp size left to catch. Raised to the officer and to the phase, where it belongs: it is the strongest argument yet for why the pipeline does not stop at step 6, and it means `a clean detector is not a clean surface` is an even weaker guarantee than the previous gate recorded."
  - id: B10
    summary: "13px in shared chrome, on no ramp row: `components/site-footer.tsx` sets `text-[13px]` on the muted email, and `.skip-link` in globals.css likewise. Both are on the rendered route."
    disposition: rejected
    reason: "Shared chrome this surface does not own; `docs/design/surfaces.json` scopes portal-hub to `app/(public)/portal/page.tsx`. The footer renders on every page on the site, so its type size is a site-wide decision and changing it from a hub gate would move nine other pages. Recorded so the route's true lowest ramp compliance is on the record rather than implied clean by a passing surface."
  - id: B11
    summary: "Three stale source citations in the comments — `globals.css:318` for `:focus-visible` (now 359), `globals.css:594` for `.sheet` (now 635), `DESIGN.md:894` citing `page.tsx:42` (now 56-70) — with the cited contents all verified correct."
    disposition: rejected
    reason: "Same reason as the lead's L10: the contents are right, so nothing misleads, and a line number is stale the moment anything above it changes — which this gate has just done again to every line in the file. Fixing it means dropping line-number citations as a convention across the codebase, which is not a hub decision."
---

⚠️ **NOT DEGRADED.** Assessments A and B ran as two isolated parallel
sub-agents, neither seeing the other's output and neither told what the other
was looking for.

📌 **Two deviations from `critique.md`, declared rather than hidden.** Neither
assessment used a browser — the `design-reviewer` agent held it for step 5, and
two CDP clients wedge the renderer on this machine. The lead measured the
rendered page once and handed both assessments the same evidence pack as data,
so browser inspection was performed and shared rather than skipped or
duplicated. And the parent had already seen the detector's empty array before
synthesis, where the method asks that A finish first; an empty result anchors
judgement in no direction, and A's specificity verdict was written with no
detector output in its prompt, but the ordering is recorded.

## Where the two assessments agree, and what the agreement is worth

**A's P1 and B's B5 are the same defect, reached by different routes** — A from
the composition ("a document whose entire idea is a masthead above a body"), B
from arithmetic on the measured left edges. Neither saw the other. The
`design-reviewer` agent reached it a third time as DR2, from pixels. **Three
independent routes to the same defect is the strongest signal this gate
produced**, and it is the same sentence the 2026-09-19 receipt wrote about the
missing press state — which suggests the pipeline's real output is convergence
rather than any single step.

## Where they appear to conflict and do not

B7 predicted, from the code, that the key's white ring would paint a *fourth*
edge inside the indicator. The `design-reviewer`'s pixel scan found something
worse: the ring did not paint at all except at that edge. **Both were reasoning
correctly from what they had.** B derived what CSS `outline` must draw; DR
measured what Chromium actually painted; the truth is that the shape B described
is exactly what survives when the rest is lost. The lead reproduced it
independently before adopting, with a focused-vs-unfocused pixel diff, rather
than averaging the two accounts.

## Heuristic scores, recorded for the trend

Visibility of status 3 (A2), match to the real world 4, user control 3,
consistency 3 (A1, A5, A6), error prevention 3, recognition 4, flexibility 3,
aesthetic/minimal 4, error recovery n/a, help 3. **Total 30/36 — up from the
2026-09-19 gate's equivalent**, with the improvement concentrated in aesthetic
and minimal design, where removing the band took the page to four content
elements and zero decoration.

## Four questions going to the officer

A2 (the header button marks the current page to a screen reader and not to an
eye), A4 (the rake, unchanged by this gate's fix and measured as such), A5 (the
doubled hairline), A6 ("Points Leaderboard" → "Leaderboard"). A3 is **closed**,
resolved by the sheet build. B9 goes to the phase rather than the officer.

---
skill: impeccable
command: node .claude/skills/impeccable/scripts/detect.mjs --json --no-advisory "app/(public)/portal/page.tsx"
date: 2026-09-19
commit: "23fab67c3edd28001eafd034e8566b67fc94c1f5"
output: detector.output.json
findings: []
---

The detector returned an empty array — **zero hits**, exit 0, so there is exactly
one finding per hit and the list is empty. Run against the surface's own file;
`components/ui/portal-band.tsx` is a shared primitive in `components/ui/` and
belongs to no surface, so it is scanned but not owned here (DESIGN.md: "a change
to a shared primitive in `components/ui/` does not make any surface stale").

📌 **A clean detector is not a clean surface, and this run is the proof.** The
detector reads font sizes against the ramp and catches arbitrary `text-[Npx]`
values; it does not catch `text-sm`, which is how the officer line's 14px — a
size on **no row** of DESIGN.md §The ramp — passed it. That size was found by
the lead pass instead (`lead.md` L2), and the two destination titles rendering
at the *same* ramp step as the page h1 was found by the critique (`critique.md`
A2). **Both are type-ramp defects the deterministic scan is structurally unable
to see**, which is why the pipeline does not stop at step 6.

🪤 Not pre-suppressed: `.impeccable/config.json` gains no ignore entries here.
v1 added ten `design-system-font-size` ignores as it went and the set died with
the branch; the plan's rule is to suppress at phase 5 against the ramp that
actually ships, or not at all.

---
skill: impeccable
command: node .claude/skills/impeccable/scripts/detect.mjs --json --no-advisory "app/(public)/portal/attend/page.tsx" "app/(public)/portal/attend/_components/checkin-form.tsx"
date: 2026-09-19
commit: "a38a2b3d3fb740cc9565fdfb2036dfee72449efb"
output: detector.output.json
findings: []
---

The detector returned an empty array — **zero hits**, exit 0 — so there is
exactly one finding per hit and the list is empty. Run against the surface's own
two files; `components/ui/banner.tsx`, `button.tsx`, `field.tsx` and
`portal-band.tsx` are shared primitives in `components/ui/` and belong to no
surface (DESIGN.md: *"a change to a shared primitive in `components/ui/` does
not make any surface stale"*).

📌 **A clean detector is not a clean surface, and this run is the proof twice
over.** The scan was green on a build that was simultaneously:

- overflowing the viewport by **588px** on a long email in the review step, a
  flex item that cannot shrink (`guidelines.md` G1 / `audit.md` T2);
- setting an `<h2>` in the paragraph ink while the same component two screens
  earlier used the heading ink (`lead.md` L1);
- setting 16px body copy at the ramp's 18px leading (`lead.md` L2);
- leaving focus on `<body>` after five of the twelve states replace the screen
  (`audit.md` T1);
- carrying the sole action on four screens at a 32px target on a page whose
  every other target is 48 (`critique.md` A2).

The detector reads arbitrary `text-[Npx]` values against the ramp. It cannot see
`text-sm`, a `leading-` value, an ink token used for the wrong role, a flex
item's automatic minimum size, or where focus goes. **Every finding on this
surface came from one of the other six steps**, which is the argument for the
pipeline not stopping at step 6.

🪤 Not pre-suppressed: `.impeccable/config.json` gains no ignore entries here.
v1 added ten `design-system-font-size` ignores as it went and the set died with
the branch; the plan's rule is to suppress at phase 5 against the ramp that
actually ships, or not at all.

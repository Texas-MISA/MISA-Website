<!--
  The BODY of a surface brief — step 1 of DESIGN.md §Design toolkit, written by
  /design-brief. It is impeccable's own surface brief (the structure of its
  `shape` reference, plus what this project adds), so every impeccable command
  on the surface loads it. Do not hand-place the file; write it with:

    node .claude/skills/impeccable/scripts/surface-brief.mjs write route:<route> <this-file> <surface files...>

  which adds the frontmatter and lands it at the `brief` path in
  docs/design/surfaces.json. tests/design-receipts.test.ts requires every
  heading below, a **Mode:** matching the registry, no leftover placeholders,
  and every adopted evidence id (EV1, EV2…) cited somewhere in this body.
  Delete this comment block.
-->

## Mode and lead
- **Mode:** Operate | Persuade — one sentence on who uses it, and where.
- **Lead skill:** `impeccable` (Operate) | `design-taste-frontend` (Persuade).
- **Visual authority:** `DESIGN.md` — the established world. Never a replacement
  world, and never a regenerated `DESIGN.md`.
- **Dials** (Persuade only): DESIGN_VARIANCE · MOTION_INTENSITY · VISUAL_DENSITY.

## Job and audience
Who arrives at <route>, their context and device (e.g. a phone at the door of
an event), and what they need.

## Outcome and proof
The primary task, what success looks like, and the one thing this surface must
never fail at.

## States
Every state it renders, with realistic data ranges — empty, loading, each
result, each refusal, each error. The design is done when each state is
designed, not when the happy path is.

## Interaction and layout
Hierarchy, responsiveness (360 / 768 / 1280), affordances, feedback. Intent,
not CSS. Which `DESIGN.md` §Layout families it spends.

## Constraints carried in
The CLAUDE.md invariants and DESIGN.md rules this surface touches, quoted by
name. Behaviour does not change in a design phase. TODO

## Diverge
The two `frontend-design` concepts (receipts/diverge.md), one paragraph each,
and which the lead adopted or rejected — with the reason.

## Evidence
Each adopted `ui-ux-pro-max` lookup by id — EV1, EV2… (receipts/evidence.md):
the guideline it returned, and the decision above it supports.

---
name: design-brief
description: Start the redesign of a MISA design surface — steps 1–3 of the design pipeline (DESIGN.md §Design toolkit). Runs impeccable's shape interview and writes the surface brief impeccable itself loads, has frontend-design propose two concepts for the lead to adopt or reject, and cites ui-ux-pro-max lookups as evidence, leaving receipts for each. Use before ANY visual change to a registered surface (the brief guard hook refuses edits until the brief exists), or when asked to start or brief a page redesign such as /portal.
---

# /design-brief <surface>

The front half of the pipeline; `/design-gate` is the back half. Read
`DESIGN.md` §Design toolkit first. `<surface>` is a key in
`docs/design/surfaces.json` — if the officer has asked for a page's redesign and
it is not registered, register it (mode, `legacy`, routes, files, and the
`brief` path from `surface-brief.mjs path route:<first route>`). Registering is
what turns the brief guard on for its files.

## Hard limits — every step
- **The visual authority is `DESIGN.md`, the established world.** Never a
  replacement world: no `/impeccable init`, no `/impeccable document` that
  overwrites or merges DESIGN.md (its sidecar-only refresh is fine), no
  "redesign replaces DESIGN.md" path. PRODUCT.md already exists.
- **`ui-ux-pro-max` is lookups only:** `search.py "<query>" --domain <domain>`.
  Never `--design-system`, never `--persist` — it writes a `design-system/…/MASTER.md`
  that calls itself the source of truth (a test fails if one appears).
- **`frontend-design` writes no code.** Its concepts are prose and structure.
- CLAUDE.md's invariants outrank all of it. Behaviour does not change here.

## Step 1 — Brief (lead: impeccable's `shape`)
1. Load impeccable's context once: `node .claude/skills/impeccable/scripts/context.mjs --target route:<route>`.
2. Run impeccable's **shape** discovery (`reference/shape.md`) with the officer:
   who arrives, where (a phone at the door?), the task, every state. Ask; do
   not invent. With no officer to answer, mark assumptions plainly and stop.
3. Fill `docs/design/templates/brief.md` — every heading, the Mode matching the
   registry, the CLAUDE.md invariants quoted by name, no placeholders left.
4. Persist it as impeccable's surface brief, so every later impeccable command
   loads it:
   `node .claude/skills/impeccable/scripts/surface-brief.mjs write route:<route> <body-file> <each surface file>`
   and confirm it landed at the registry's `brief` path.

## Step 2 — Diverge (owner: frontend-design)
Invoke `frontend-design` with the brief and DESIGN.md's grounds, palette, type
ramp and layout families as fixed constraints. Ask for **exactly two**
materially different concepts — structure, hierarchy, interaction thesis, the
focal moment — not two colourways. Save its full output as
`docs/design/surfaces/<surface>/receipts/diverge.output.md`. Then the LEAD
decides: `receipts/diverge.md` lists both (ids A, B), each adopted or rejected
with a reason; rejecting both is allowed, with what the lead does instead.
Record the decision under the brief's `## Diverge`.

## Step 3 — Evidence (owner: ui-ux-pro-max)
For each decision the brief leaves open (form feedback, tap targets, error
wording, table density…):
`PYTHONIOENCODING=utf-8 python .claude/skills/ui-ux-pro-max/scripts/search.py "<2–5 terms>" --domain ux`
(other domains: `typography`, `color`, `chart`, `stack`). Save the raw output as
`receipts/evidence.output.md`. `receipts/evidence.md` gives each lookup an id
(EV1, EV2…) and a disposition — adopted only if it actually decides something.
**Every adopted id must be cited in the brief's `## Evidence`**; the checker
fails an adopted lookup nobody cites.

## Close
1. Re-write the brief with surface-brief.mjs if steps 2–3 changed it.
2. Receipts use the template (`docs/design/templates/receipt.md`); **quote every
   SHA**, full length (`git rev-parse HEAD`).
3. Set `"status": "in-progress"` in `surfaces.json`.
4. `npx vitest run tests/design-receipts.test.ts` — the brief must pass.
   `node scripts/design/receipts.mjs <surface>` will still list the review
   receipts as missing; that is correct until `/design-gate`.
5. Commit the brief, the registry change and the two receipts together, then
   show the officer the brief and the two concepts before building.

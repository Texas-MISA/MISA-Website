---
name: design-brief
description: Start design work on any MISA page, new or existing — steps 1–3 of the design pipeline (DESIGN.md §Design toolkit). Runs impeccable's shape interview and writes the surface brief impeccable itself loads, has frontend-design propose two concepts for the lead to adopt or reject, and cites ui-ux-pro-max lookups as evidence, leaving receipts for each. Every page goes through it (officer, 2026-10-12). Use it before creating ANY new page; before the first edit of ANY existing page that has no brief yet, whether public, portal or /admin (registering the page arms the brief guard hook, which then refuses edits until the brief exists); and when asked to start or brief a page redesign such as /portal. Not for a components/ui primitive, which is not a page.
---

# /design-brief <surface>

The front half of the pipeline; `/design-gate` is the back half. Read
`DESIGN.md` §Design toolkit first. `<surface>` is a key in
`docs/design/surfaces.json` — if a page is being created or edited and it is not
registered (every page, public, portal or `/admin`: officer, 2026-10-12),
register it (mode, `legacy`, routes, files, and the `brief` path from
`surface-brief.mjs path route:<first route>`); a page that does not exist yet
is registered later, in the order `DESIGN.md` §Design toolkit gives for a new
page. Registering is
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
   and confirm it landed where `surface-brief.mjs path route:<route>` says.

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
`python .claude/skills/ui-ux-pro-max/scripts/search.py "<2–5 terms>" --domain ux`
(also `--domain web` or `react`, and `--stack nextjs` or `--stack shadcn` for
stack-specific guidance; `color` and `typography` return palettes and pairings,
which may be cited but never adopted over DESIGN.md's). Save the raw output as
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

**For a new page**, which has no files yet and so no registry entry
(`DESIGN.md` §Design toolkit, *A new page, step by step*):
- **Skip step 3, and leave the registry out of step 5's commit**, which holds
  the brief and the two receipts only. `tests/design-receipts.test.ts` fails a
  registered surface whose files do not exist.
- **Step 4 checks nothing for an unregistered surface, so check the brief
  directly**, from the repo root:
  `node -e "import('./scripts/design/receipts.mjs').then(m => console.log(m.checkBrief({ mode: 'operate', brief: '.impeccable/surfaces/<slug>.md' })))"`
  where `mode` is the brief's own (`operate` or `persuade`) and `<slug>.md` is
  the file `surface-brief.mjs path route:<route>` names, written with forward
  slashes. It prints `[]` when the brief passes, and otherwise what to fix.
- **Then continue with DESIGN.md's new-page steps:** register the surface just
  before writing its first file, and commit the entry with those files.

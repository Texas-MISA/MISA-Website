---
name: design-gate
description: Run the review steps (5–6) of the MISA design pipeline on a registered design surface and write its receipts — impeccable critique/audit, web-design-guidelines, the design-reviewer agent, the detector, emil for motion — then run the checkers. Use when a surface's build is done and it is going to the officer's gate, or when asked to "run the design gate" on /portal or any page.
---

# /design-gate <surface>

The pipeline and roster live in `DESIGN.md` §Design toolkit; this skill runs
its review half and leaves evidence the tests can check. Read that section
first. `<surface>` is a key in `docs/design/surfaces.json`.

## Preconditions — stop and say so if any fails
- The surface is registered and has `brief.md` with diverge and evidence
  receipts (steps 1–3). A gate without a brief is not a gate.
- The build is committed. Receipts name a commit; uncommitted work cannot be
  reviewed.
- The local stack and dev server are up (`npx supabase start`, `npm run dev`).

## Steps — each writes `receipts/<step>.md` + its raw output file
Use `docs/design/templates/receipt.md`. `commit` = `git rev-parse --short HEAD`.
Save each skill's full raw output as `receipts/<step>.output.md`.

1. **lead** — the mode's lead skill reviews its own result: `impeccable`
   (Operate: `/impeccable polish` against craft-floor) or
   `design-taste-frontend` (Persuade: its §14 pre-flight).
2. **critique** — `/impeccable critique <route files>`.
3. **audit** — `/impeccable audit <route files>`.
4. **guidelines** — the `web-design-guidelines` skill on the surface's files.
5. **design-review** — spawn the `design-reviewer` agent with the surface
   name and the dev-server URL.
6. **detector** — `node .claude/skills/impeccable/scripts/detect.mjs --json
   <surface files>`; the output file is that JSON.
7. **motion** — only if the surface animates: `emil-design-eng` reviews
   every transition and reveal.

## Dispositions — the part that makes this mean something
For every finding, decide with the lead skill's judgement and the CLAUDE.md
invariants:
- **adopted** → fix it, commit, put the commit in `fix_commit`.
- **rejected** → a real `reason`, naming the rule or brief line it conflicts
  with. "Not needed" is not a reason.
- **deferred** → a reason and where it is tracked (`tasks.md`).
If two skills conflict, ask the officer; never average them (DESIGN.md).
Do not rubber-stamp: if every finding is rejected, say so plainly in the
summary — the checker will fail the surface, and that is the point.

## Close
1. Re-run anything a fix touched, so receipts are fresh.
2. `node scripts/design/receipts.mjs <surface>` → must print `ok`.
3. `npm test` and `npm run test:ui`.
4. Only now propose `"status": "rebuilt"` in `surfaces.json`, and report to
   the officer: findings adopted / rejected / deferred per skill, and the
   screenshots from the design-reviewer.

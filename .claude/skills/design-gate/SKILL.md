---
name: design-gate
description: Run the review half (steps 5–6) of the MISA design pipeline on a registered design surface and write its receipts — the lead's self-review, impeccable critique and audit, web-design-guidelines, the design-reviewer agent, the detector, emil-design-eng for motion — then run the checkers. Use when a surface's build is done and it is going to the officer's gate, or when asked to "run the design gate" on /portal or any page.
---

# /design-gate <surface>

The pipeline and roster live in `DESIGN.md` §Design toolkit; this skill runs
its review half and leaves evidence the tests check. `/design-brief` is the
front half. `<surface>` is a key in `docs/design/surfaces.json`.

## Preconditions — stop and say so if any fails
- `node scripts/design/receipts.mjs <surface>` shows a complete brief and the
  diverge and evidence receipts. A gate without a brief is not a gate.
- The build is **committed**. Receipts name commits; uncommitted work cannot be
  reviewed.
- The local stack is up (`npx supabase start`) and `npm run dev` is running.
  `npm run test:ui` reuses that server (it finds it through `.next/dev/lock`),
  so the two do not collide.

## Steps — each writes `receipts/<step>.md` + its raw output file
Template: `docs/design/templates/receipt.md`. `commit` is `git rev-parse HEAD`,
**quoted** — unquoted, YAML reads `1836e72` as a number. Save each skill's full
raw output beside its receipt (`<step>.output.md`).

1. **lead** — the mode's lead reviews its own result: `impeccable` (Operate:
   `/impeccable polish <target>` — the final pass against craft-floor, its
   changes recorded as findings) or `design-taste-frontend` (Persuade: its
   `## 14. FINAL PRE-FLIGHT CHECK`, every item).
2. **critique** — `/impeccable critique <target>`.
3. **audit** — `/impeccable audit <target>`.
4. **guidelines** — the `web-design-guidelines` skill on the surface's files.
5. **design-review** — spawn the `design-reviewer` agent with the surface name
   and the dev-server URL; its YAML goes straight into the receipt.
6. **detector** — `node .claude/skills/impeccable/scripts/detect.mjs --json
   --no-advisory <surface files> > receipts/detector.output.json`. It exits 2
   when it finds anything; that is not a crash. One finding per hit.
7. **motion** — only if the surface animates (the checker decides from the
   files): `emil-design-eng` reviews every transition and reveal in its
   required review format.

## Dispositions — the part that makes this mean something
Decide every finding with the lead's judgement and the CLAUDE.md invariants:
- **adopted** → fix it, commit, put that commit's SHA in `fix_commit`.
- **rejected** → a real `reason` naming the rule or brief line it conflicts
  with. "Not needed" is not a reason.
- **deferred** → a reason and where it is tracked (`tasks.md`).
If two skills conflict, ask the officer; never average them. If every finding
is rejected, say so plainly — the checker fails the surface, and that is the
point: skills that ran and changed nothing were not used.

## Close
1. Re-run any step a fix touched, so its receipt is fresh. The checker flags
   any surface commit after a review that no receipt names.
2. `node scripts/design/receipts.mjs <surface>` — must print `ok`.
3. `npm test` and `npm run test:ui` — the surface's routes and states green.
4. Report to the officer: findings adopted / rejected / deferred per skill.
   Changes the officer asks for go in `receipts/officer.md` (skill `officer`),
   each with its fix commit — only then propose `"status": "rebuilt"`.
5. Receipts name commits that must survive: **merge the branch, never squash
   it.**

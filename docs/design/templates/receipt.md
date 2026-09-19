---
# Receipt for one pipeline step (DESIGN.md §Design toolkit). Copy to
# docs/design/surfaces/<surface>/receipts/<step>.md, where <step> is one of:
#   diverge  evidence  lead  critique  audit  guidelines  design-review
#   detector  motion (only if the surface animates)
# Checked by scripts/design/receipts.mjs and tests/design-receipts.test.ts.
skill: impeccable            # must be the step's owner, see the roster
command: /impeccable critique
date: 2026-09-18
commit: abc1234              # the commit that was reviewed
output: critique.output.md   # the skill's raw output, committed beside this file
findings:
  - id: C1
    summary: What the skill said, in one line.
    disposition: adopted      # adopted | rejected | deferred
    fix_commit: def5678       # required when adopted; must touch the surface
  - id: C2
    summary: Another finding.
    disposition: rejected
    reason: Why — e.g. it conflicts with a named CLAUDE.md invariant.
---

Optional notes. The frontmatter is what the checker reads.

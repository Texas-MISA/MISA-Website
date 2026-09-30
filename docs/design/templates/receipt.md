---
# Receipt for one pipeline step (DESIGN.md §Design toolkit). Copy to
# docs/design/surfaces/<surface>/receipts/<step>.md, where <step> is one of:
#   diverge  evidence  lead  critique  audit  guidelines  design-review
#   detector  motion (required only if the surface animates)
#   officer  (optional: changes the officer asked for at the gate)
# Checked by scripts/design/receipts.mjs and tests/design-receipts.test.ts.
#
# 🪤 QUOTE EVERY SHA. Unquoted, YAML reads 1836e72 as the float 1.836e+75
# and 1234567 as an integer. Use full SHAs (git rev-parse HEAD).
skill: impeccable              # the step's owner, per the roster
command: /impeccable critique app/(public)/portal/attend
date: 2026-09-18
commit: "0123456789abcdef0123456789abcdef01234567"   # the commit reviewed
output: critique.output.md     # the skill's raw output, committed beside this
findings:
  - id: C1
    summary: What the skill said, in one line.
    disposition: adopted       # adopted | rejected | deferred
    fix_commit: "89abcdef0123456789abcdef0123456789abcdef"  # must touch the surface
  - id: C2
    summary: Another finding.
    disposition: rejected
    reason: Why — the rule or brief line it conflicts with. "Not needed" is not a reason.
---

Per-step rules the checker adds:
- diverge — at least two concepts; adopting one needs no fix_commit.
- evidence — at least one lookup; ids EV1, EV2…; every ADOPTED id must be cited
  in the brief. No fix_commit.
- detector — `output` is the detector's --json array (e.g. detector.output.json),
  and there is exactly one finding per hit in it.
- officer — never counts as "a skill changed the outcome"; it only names the
  commits the officer asked for, so they are not stale.

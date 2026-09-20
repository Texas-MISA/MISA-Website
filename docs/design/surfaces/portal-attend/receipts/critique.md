---
skill: impeccable
command: /impeccable critique app/(public)/portal/attend/
date: 2026-09-19
commit: "a38a2b3d3fb740cc9565fdfb2036dfee72449efb"
output: critique.output.md
findings:
  - id: A1
    summary: "The review step sets the values a member is asked to PROOFREAD at 14px. Its heading says \"Check your details before we add you\" and the next action creates a roster record, but the UT EID and email render at `text-sm` on a phone held at arm's length. The 14px arrived by inheritance from the form's labels, and a label and a value are different jobs — one is scaffolding read once, the other is data being verified. DESIGN.md's other instrument for an identifier, monospace, is scoped to /admin and unavailable here, which leaves size."
    disposition: adopted
    fix_commit: "bd71103f223e26f6be75f2296c9c84d4ee401f13"
  - id: A2
    summary: "The only action on four of the twelve screens — \"See your points and attendance\" — measures 217 x 32px, while every other target on the page was built to 48px on EV4's argument that this page is used standing up at a door, one-handed. On `pending`, `duplicate` and `refused` it is the only thing a member can do at all."
    disposition: adopted
    fix_commit: "bd71103f223e26f6be75f2296c9c84d4ee401f13"
  - id: A3
    summary: "On `unmatched` the Check in button sits at 732px, 121px below the fold, so the member who has just been told to tick the box must scroll to reach both the box and the button."
    disposition: rejected
    reason: "Not a defect — the brief settles this in advance and asks for exactly this number. The bar is IDLE-ONLY because gating on the unmatched state would force either the approved reassurance line into a disclosure or the band below what the 48px chevron notch allows, both reopening officer decisions. Recorded with the measurement per the brief's own instruction that it be \"measured and reported at the gate, but does not block\". Two things soften it: focus moves to the banner on arrival (EV1), and the box now carries a caution outline so the target is marked when the member gets there."
  - id: A4
    summary: "The fast path could have grown a step — \"one submit, one screen\" is the decision table's property and the easiest thing for a redesign to cost."
    disposition: rejected
    reason: "Checked rather than assumed, and it holds: driven on the local stack, a returning member with matching details and the box untouched goes straight to `present`. No step added, no confirmation interposed, no scroll. Nothing to fix."
  - id: A5
    summary: "Outcomes could be distinguishable by colour alone (EV9)."
    disposition: rejected
    reason: "Verified live on all five renderings and correct as built: present affirm + check, pending caution + clock, refused critical + circle-slash, duplicate affirm OR caution by what it found + circle-check, each paired with a heading naming the outcome in words. The duplicate split is the part worth keeping — \"you're already checked in\" is a success the member can act on by leaving, and \"awaiting review\" is the same caution `pending` carries, so one colour for both would have made the affirm ground mean two different things on one page."
---

Operate mode: the visitor completes a task, and the scene is a student at the
door of a club event with a phone in one hand, arriving from a printed QR code
that 308s straight here.

**The concept is not in dispute.** The fast path is three fields, one tick left
untouched, one tap, everything on the first screen at 360×640 with 29px to
spare; the officer's named failure — a first-timer stuck on the checkbox's
wording — has an answer in the label and a second one in the reassurance below
it.

📌 **Three of the five findings are rejections, and two of those are checks that
came back clean** (A4, A5). They are recorded rather than dropped because "the
fast path is still one screen" and "no outcome is carried by colour alone" are
claims this surface has to be able to make at the officer's gate, and a claim
nobody wrote down is a claim nobody can check later.

---
skill: ui-ux-pro-max
command: /design-brief portal-attend — step 3, search.py lookups (--domain ux, --stack nextjs), 8 queries
date: 2026-09-19
commit: "eb1e13c1d51fbb3b50417ac492d27291df1b6599"
output: evidence.output.md
findings:
  - id: EV1
    summary: "'form validation error message' (ux), result 1 — Focusable Error Summary: after a failed submit, move focus to the explanation at the top of the form; keep inline errors. Severity High."
    disposition: adopted
    reason: "Decides where focus goes after a failed submit, which nothing in the form places today: the submit button disables while pending, and where focus lands afterwards is left to the browser. Focus moves to the explanation: the banner on unmatched, rate limited and error, the first invalid field on invalid. Inline errors stay. Before hydration nothing moves, and the form still works."
  - id: EV2
    summary: "'form validation error message' (ux), result 2 — errors announced with aria-live or role=alert, never visual-only."
    disposition: rejected
    reason: "Already built: every banner and every field error carries role=alert. The redesign keeps them, but that is the existing form, not a decision this lookup made."
  - id: EV3
    summary: "'form validation error message' (ux), result 3 — Submit Feedback: loading, then success or error."
    disposition: rejected
    reason: "Already built: 'Checking in…' while pending, then a result or a banner. Nothing to decide."
  - id: EV4
    summary: "'checkbox label touch target' (ux), result 1 — 44pt iOS / 48dp Android; web floor 24 CSS px. Severity High."
    disposition: adopted
    reason: "The box is 16×16 today. The whole label row is its target and is at least 48px tall. The Check in button, 39px today, is 48px."
  - id: EV5
    summary: "'checkbox label touch target' (ux), result 2 — at least 8px between adjacent touch targets."
    disposition: adopted
    reason: "Sets the floor for concept A's compression: with 12px of slack at 360×640, the tempting fix is tighter gaps. No gap between the fields, the box row and the button drops below 8px; the reassurance line gives first."
  - id: EV6
    summary: "'checkbox label touch target' (ux), result 3 — Compact Label Overflow (badges and pills)."
    disposition: rejected
    reason: "About badge labels; the check-in form has none."
  - id: EV7
    summary: "'submit button loading state' (ux), result 3 — Loading Indicators: preserve layout, focus and accessible busy status; don't flicker. (Results 1–2 repeat EV3 and a back-button rule.) Severity High."
    disposition: adopted
    reason: "Decides the pending button: 'Checking in…' must not resize it. Full width below sm; above sm, a width that already fits 'Checking in…', so swapping the label shifts nothing. aria-busy stays."
  - id: EV8
    summary: "'success confirmation feedback' (ux), results 1–2 — confirm success with a message or visual change; its examples are a toast or a checkmark."
    disposition: rejected
    reason: "The toast form is wrong here: a toast vanishes, and the result is the member's receipt, which must stay on screen until they leave. The in-place, persistent outcome panel is concept A's own decision."
  - id: EV9
    summary: "'color not only indicator' (ux), result 1 — never convey information by colour alone; add an icon or text. Severity High."
    disposition: adopted
    reason: "Concept A codes outcomes in the status tokens, so colour must not carry them alone. Every outcome pairs its colour with a heading that names it and a drawn Lucide icon, decorative and aria-hidden: a check for present, a clock for pending, a circle-check for duplicate, a circle-slash for refused."
  - id: EV10
    summary: "'color not only indicator' (ux), results 2–3 — Accessible Authentication (allow paste and password managers), Color Contrast 4.5:1."
    disposition: rejected
    reason: "There is no authentication here, and the fields already accept paste and autofill. Contrast is DESIGN.md's rule, measured per pairing on the actual ground; the brief carries it already."
  - id: EV11
    summary: "'screen reader announce status message' (ux), result 2 — one atomic status message (role=status, aria-atomic), never competing live regions. Severity High."
    disposition: adopted
    reason: "Decides how an outcome is announced, and settles the brief's live-region constraint. One role=status aria-atomic region, in the DOM from the first render, receives the outcome sentence. The result and review panels stop carrying role=status themselves, because they mount already holding their text, which CLAUDE.md says is missed."
  - id: EV12
    summary: "'mobile keyboard autocomplete input' (ux), result 3 — every input keeps a visible label; a placeholder is never the only label. Severity High."
    disposition: adopted
    reason: "Rules out winning concept A's slack by collapsing labels into placeholders or floating labels. The label stays visible above each field, which is also when a member checks which field is the EID."
  - id: EV13
    summary: "'mobile keyboard autocomplete input' (ux), results 1–2 — inputmode and the right input type."
    disposition: rejected
    reason: "Already built: type=email with inputMode=email, autocomplete name/email, the EID with no autocapitalise or autocorrect. Nothing to decide."
  - id: EV14
    summary: "'server action form pending' (--stack nextjs) — use Server Actions for form submissions; validate Server Action input; updateTag for read-your-own-writes."
    disposition: rejected
    reason: "Behaviour is fixed in a design phase, and the first two are how the form already works (submitCheckin, schema-validated). updateTag concerns caching the check-in form does not do."
---

Eight queries, fourteen dispositions: a query whose results pointed different
ways is split by result, and exact repeats of an earlier result are noted rather
than numbered twice. **Adopted and cited in the brief's `## Evidence`: EV1, EV4,
EV5, EV7, EV9, EV11, EV12.**

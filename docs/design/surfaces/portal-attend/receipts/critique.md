---
skill: impeccable
command: /impeccable critique app/(public)/portal/attend/
date: 2026-09-20
commit: "77d2c568ed093f78a6b437e053bbef0533eff9e4"
output: critique.output.md
findings:
  - id: A1
    summary: "The in-flight state delivers neither of EV7's last two thirds. EV7 — this surface's own adopted evidence — asks a loading state to preserve LAYOUT, FOCUS and BUSY STATUS. Layout is preserved exactly (the button measures 286.0 x 48.0 at 360 and 208.0 x 48.0 at 1280, byte-identical idle and pending). The other two are not: `disabled={pending}` removes the focused control from the tab order, so `document.activeElement` becomes `<body>` for the whole request and the member's next Tab restarts at the skip link, four to seven stops back; `aria-busy=\"true\"` then sits on an element nobody can reach; and the always-mounted `role=\"status\"` region measured EMPTY for the entire window. The 2026-09-19 gate's T3 rejected the `aria-busy`-on-disabled shape because \"the visible label swapping to 'Checking in…' \" carries it, which is true of exactly the population that does not need it. Reached independently by four steps: this assessment, the audit (T1), web-design-guidelines (G2) and the design-reviewer (DR1)."
    disposition: adopted
    fix_commit: "b2900e15681b949b3e551a86a836f13f153d04c9"
  - id: A2
    summary: "The outcome mark carried no tone, and it is the only cue on the screen that could. EV9 is satisfied by three channels — a status ground, a heading naming the outcome, and a drawn Lucide mark — and the mark computed rgb(58,61,64), Body Graphite, IDENTICALLY on all four outcomes. Measured, the other two colour channels are very quiet on a white sheet: the affirm wash is 1.11:1 against the sheet it lies on, caution 1.10, critical 1.12, and the hairline over each composites to 2.14-2.38. So the only strong signal that four screens mean four different things was the words, which is the accessibility guarantee rather than the glance. Held at arm's length for half a second before the phone goes back in a pocket, every outcome looked the same. The tone inks measure 7.20 / 5.40 / 7.73:1 on their own washes, so the answer was already in the palette."
    disposition: adopted
    fix_commit: "b2900e15681b949b3e551a86a836f13f153d04c9"
  - id: A3
    summary: "The one sentence that answers the officer's named problem was styled as a footnote. The officer's 2026-09-19 interview named first-timer confusion at the checkbox — specifically its wording — as what goes wrong at the door; the redesign's answer is the new label PLUS the reassurance beneath it; and measured, that reassurance was the quietest text on the page: 14px `--misa-secondary` at 8.51:1, the lowest ratio anywhere in the surface's `<main>`, wrapping to three lines at 360. A member in a doorway reads the label and skips the grey."
    disposition: adopted
    fix_commit: "b2900e15681b949b3e551a86a836f13f153d04c9"
  - id: A4
    summary: "The box-model chain written into `page.tsx` by this round's own fix said `3 x 16` under a total of 591.52 — an expression that reaches 575.52. The form has FOUR `gap-4` gaps: three between the fields, one before the box row, one before the button. The same file's comment at the form already says \"the idle form has four gaps\"."
    disposition: adopted
    fix_commit: "b2900e15681b949b3e551a86a836f13f153d04c9"
  - id: A5
    summary: "The refused screen buries its one actionable sentence and offers the one link that cannot help. Everything under the heading is a single `<p>` carrying three instructions — what the window is, check the home page, tell an officer — with the only one that helps a member standing at an unpublished event last in eight lines and unemphasised. The single onward link is \"See your points and attendance\", which on this outcome leads to a page that will show nothing, because nothing was recorded."
    disposition: deferred
    reason: "Both halves need the officer. The emphasis half is a copy change to member-facing error prose, and the brief requires officer sign-off on any new copy; it also sits on the same sentence as the copy question already escalated in `officer.md` O4, so putting them separately would ask the officer twice about one paragraph. The link half is an IA decision — which onward action a refused member gets — and swapping it per outcome is a behaviour question, not a presentation one. Structurally it is also not free: `ResultPanel` wraps `children` in a single `<p>`, and `banner.tsx`'s own docs record that a `<p>` inside a `<p>` makes the parser close the outer one early, so a second paragraph means changing the component rather than the call site. Recorded in `officer.md` O4's neighbourhood with the measurement (panel height 442.6px at 360)."
  - id: A6
    summary: "The type scale runs backwards against urgency: field errors 12px, the three form banners 14px, the terminal outcomes 16px. The screens that ask the member to DO something are set smaller than the screens that ask them to do nothing, and the smallest type on the page is the text naming what to fix. Proposed fix: `size=\"md\"` on the unmatched banner specifically — the one banner that asks for an action, and the officer's named failure."
    disposition: rejected
    reason: "Overruled by DESIGN.md, which scopes the prop explicitly: \"`Banner` takes `size` … `md` is `px-6 py-6 text-base`, for the one shape that needs it: an outcome sheet that is not a notice beside the task but the screen that ends it.\" The unmatched banner is precisely a notice beside the task — the form is still on screen under it — so `md` there would break the one-shape rule the prop was introduced with, three weeks after it was written. The observation behind it is real and is recorded instead where it belongs: 14px and 15px are on no row of DESIGN.md §The ramp (`banner.tsx` says so itself), which is a ramp-table question for part 6, not a per-surface override. If the officer wants the unmatched screen louder, the levers the system already gives it are the ones it uses — a status tone rather than `info`, and a 2px outline on the control the sentence names."
  - id: A7
    summary: "The page never names the event. `page.tsx` renders `<PortalSheet title=\"Event Check-In\">` with no event data, and `state.eventTitle` first appears on the success screen — so a member who scans the door QR takes it on trust that they are in the right place until after they have committed. The officer's brief calls the success screen a receipt; there is no moment of recognition before it."
    disposition: deferred
    reason: "Out of scope: the server would have to resolve the open event and pass it to the page, which is a data change, not a presentation one, and this phase changes presentation only. It also touches the membership-oracle reasoning in `docs/attend-confirmation-flow.md` — naming the open event on an unauthenticated page discloses that an event is running, which is a decision the officer owns. Recorded for the officer as a question rather than a finding."
  - id: A8
    summary: "The checkbox `<input>` is 16 x 16 — `CHECKBOX` is `size-4` — on a page that raised every other control to a door-sized floor: inputs 50px, both submits 48px, the lookup link deliberately taken to 48px. Reached three ways in this gate (this assessment, assessment B's correction to the focusable claim, and the design-reviewer's tap-target note)."
    disposition: deferred
    reason: "Not an EV4 failure and not this surface's to fix. The TAP TARGET is the wrapping `<label>`, which carries `min-h-12` and measures 84px at 360, 64px at >=640 and 104px at <=347 — verified by measurement, and clicking it toggles the box. What is at issue is affordance weight, not hit area. The fix would be a variant on the shared `CHECKBOX` constant, which has eight other call sites, all in /admin; appending `size-5` at this call site hits the equal-specificity emission-order tie this codebase has now documented three times. Tracked for part 6 with `MARK_INK`'s sibling questions."
  - id: A9
    summary: "15px (every button label, `buttonClass` size `md`) and 14px (`Field`'s labels, `Banner`'s default `sm`, the checkbox label and its hint) are on no row of DESIGN.md §The ramp. `banner.tsx` states this itself — \"14px is on no row of DESIGN.md §The ramp\" — and then ships it as the default."
    disposition: deferred
    reason: "The surface declares neither size: assessment B's by-hand pass found ZERO font sizes and ZERO colours authored in either file, so both arrive through `components/ui/`. The 2026-09-19 gate already rejected raising this surface's 14px in isolation (its L3), because `field.tsx` sets every field label at 14px and lifting only the checkbox would make it larger than the labels it sits with. So the question is whether DESIGN.md's ramp table should carry a 14px row and a 15px control-label row, which is a DESIGN.md edit and part 6's. Tracked there."
---

Operate mode: the visitor completes a task, and the scene is a student at the
door of an event, on their own phone, in its first minutes. Two isolated
assessments, synthesised. Full report, heuristic table, cognitive-load
checklist, emotional journey and the detector's real capability in
`critique.output.md`.

## What this pass had that the 2026-09-19 one could not

The gate's critique ran against `a38a2b3`, a build with a navy band. It never
saw the sheet, the masthead, the sheet's padding, the absent back link, or the
white ground the outcome washes now sit on — **and that white ground is where
A2 came from.** The affirm wash was legible enough under a navy band and against
a Vellum section; on a white sheet it measures 1.11:1, and the mark that was
supposed to be the redundant cue was drawn in the message's ink.

## 🔴 The critique overturned the lead, and the lead was the one who had the file open

A2 is `lead.md` L7 with the opposite verdict. The lead rejected it on an argument
about the mark's *role* — a decorative `aria-hidden` glyph is not a heading, so
`Banner`'s "the text stays body-coloured" should govern — and never measured the
rest of the tone encoding. Assessment A did. **An argument about which rule
applies is not a substitute for measuring what the rule is protecting.**

L7 is left in `lead.md` as `rejected`, unedited. A receipt rewritten to agree
with the outcome stops being evidence that the steps disagreed.

## And the critique caught the fix

A4 is an arithmetic error in the very commit that was correcting somebody else's
arithmetic, found by assessment B an hour after it was written, in a file whose
own comment two hundred lines away stated the right number. It is the third
instance in two days of this project writing down a lesson and then breaking it
in the same pass — which is the argument for the gate having six steps rather
than one careful one.

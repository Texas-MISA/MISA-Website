# frontend-design — two concepts for check-in (`/portal/attend`)

Invoked 2026-09-19 by `/design-brief portal-attend`, step 2, against the brief at
`.impeccable/surfaces/route-portal-attend.md`. **Prose and structure only; no code.**

## What is pinned, and what is free

Pinned by the brief: DESIGN.md's world (grounds, palette, Barlow / Barlow
Condensed and the ramp, elevation, radius, colour swaps as the only hover), and
all behaviour — the three fields in their order, the first-time checkbox, the
two-step first-timer flow, every outcome and when it happens, the honeypot, no
disclosure sentence. So no token pass here; proposing one would be a rival
source of truth.

Free: the hero, the composition of the form and of each of the twelve states,
where the action sits, and the copy the officer made changeable — the checkbox
label, the review step, the results, the banners, the lookup link.

The subject: a student at the door of a club event, phone in one hand, often
arriving from a printed QR code, so this page is the first thing they see. They
want to be done. The officer's named problem is the checkbox wording, which
leaves returning members unsure whether it means them.

## Plan pass, then review against the brief

**First instinct, and why it was thrown out.** A three-step stepper ("1 · Your
details → 2 · Confirm → 3 · Done") with numbered markers and a progress bar. It
reads as thorough and is wrong twice: the fast path is one step, so a stepper
announces two steps nobody on it will take; and it is the template's answer to
every form. Also rejected: floating labels (they save height by hiding the label
while you type, which is the moment a member checks which field is the EID), and
a radio pair ("Have you checked in before? Yes / No") for the box. A radio pair
either forces a tap on the fast path or preselects an answer about the member's
own identity, and the form deliberately never suggests one.

**The measured problem.** At 360×640 the Check in button sits at 632–671, cut by
the fold before the keyboard even opens; the hero takes 177px; the box is 16×16;
and all twelve outcomes share one neutral grey panel, so "recorded" and
"refused" differ only in their words.

**What both concepts do, because the brief decides it rather than taste:**
- **The checkbox label states a fact the member knows**, not a fact about their
  status that only the roster knows. Proposed label: *"I haven't checked in with
  this form before"*. A returning member who has used the form knows at once that
  it isn't them, and "first MISA event" (which the roster knows better than the
  member) is gone. Beneath it, the reassurance the decision table makes true:
  *"Not sure? Tick it. If we already have you, we'll use your existing record,
  never a second one."*
- **The whole label row is the target**, at least 48px tall, with the box
  aligned to the first line.
- **The review step says what happens.** New member: *"Check your details before
  we add you"*; already on file: *"We found you. Confirm to check in."* The
  values are in graphite on white, which ends the muted-on-Vellum failure. The
  buttons read *"Confirm and check in"* and *"Edit details"* (was "Go back",
  which doesn't say the values are kept).
- **Each outcome has its own look, using only the status tokens DESIGN.md
  allows for feedback.** *Present* in affirm (ink on its wash), *pending* in
  caution ("received, an officer will match it"), *refused* in critical (nothing
  was written), *duplicate* as present or pending by what it found. No outcome
  shares a look with another. The lookup link stays under every result, as
  *"See your points and attendance"*.

---

## Concept A — "Fit the first screen"

**Thesis.** Everything a returning member needs is on one phone screen: the
title, three fields, the box and the button, with no scroll. The page borrows the
hub's short field band so the portal reads as one place, and the outcome replaces
the form exactly where it stood. The member's eyes never leave the sheet they
typed into.

**Structure (360px, keyboard closed)**

```
┌──────────────────────────────┐  header, 61px
├──────────────────────────────┤
│░░░░░ EVENT CHECK-IN ░░░░░░░░│  the hub's short band: h1 only, notch kept
 ╲░░░░░░░░░░░░░░░░░░░░░░░░░░░╱   ~129px (today 177)
┌──────────────────────────────┐  white ground (controls on white)
│ Full name                    │
│ ┌──────────────────────────┐ │
│ └──────────────────────────┘ │
│ UT EID                       │
│ ┌──────────────────────────┐ │
│ └──────────────────────────┘ │
│ Email                        │
│ ┌──────────────────────────┐ │
│ └──────────────────────────┘ │
│ ☐ I haven't checked in with  │  whole row is the target, ≥48px
│   this form before           │
│   Not sure? Tick it. If we   │  Secondary Graphite, 14px
│   already have you, we'll... │
│ ┌──────────────────────────┐ │
│ │        CHECK IN          │ │  full width below sm, 48px
│ └──────────────────────────┘ │  bottom ≈ 628 at 360×640 (today 671)
└──────────────────────────────┘
```

**Arithmetic, estimated.** Band ends ≈ 190, form starts ≈ 214 (the `xs` step
rather than `md`), three fields with 16px gaps ≈ 254, the box row with its
reassurance ≈ 80, the button 48. **Check in bottom ≈ 628: on the first screen with
12px to spare.** The reassurance line is where it gives if the copy grows. The
build measures it.

**The twelve states.** Banners (unmatched, rate limited, error) sit above the
fields inside the sheet, so a correction starts where the eye already is. On
*unmatched* the box row is outlined in caution: that screen's message points at
it, so the eye goes there. The review step and every result replace the sheet's
contents in place: same sheet, same width, no scroll jump. The results are one
heading plus one sentence, the status colour carrying the outcome before the
words do.

**Focal moment.** The outcome panel: the one time colour appears on the page is
the moment the member learns what happened.

**Motion.** None on arrival. The result appears without a reveal (it mounts after
first paint, and the rule forbids one). emil-design-eng decides whether the swap
from form to result gets a 200ms crossfade.

**Responsiveness.** 768 and 1280: the sheet holds the `narrow` measure and the
button returns to its natural width, so the form does not stretch into a banner.

**Layout families.** Two: a page hero (short) and a form on white.

**Risks.** 12px of slack at 360×640 is thin, so a longer box label or a
three-line banner pushes the button below the fold. The banner states are
allowed to (the member is correcting, not arriving), but idle is not. The short
band must be hub-only CSS in the portal's own files, never a change to `PageHero`.

---

## Concept B — "The pinned action"

**Thesis.** Don't shrink the page; pin the action. The full `PageHero` stays, so
check-in keeps the family look of the site's other pages, and on a phone the
Check in button lives in a bar fixed to the bottom of the viewport, over a
`shadow-sticky`. It is in reach whatever the scroll, and the page scrolls
beneath it. The checkbox's explanation is on demand: a short label, plus a
"Not sure?" disclosure for the few who need it.

**Structure (360px, keyboard closed, scroll 0)**

```
┌──────────────────────────────┐  header, 61px
├──────────────────────────────┤
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░ EVENT CHECK-IN ░░░░░░░░│  full PageHero, unchanged (177px)
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
 ╲░░░░░░░░░░░░░░░░░░░░░░░░░░░╱
┌──────────────────────────────┐
│ Full name                    │
│ ┌──────────────────────────┐ │
│ UT EID                       │
│ ┌──────────────────────────┐ │
│ Email                        │  ← the email field, the box and "Not sure?"
╞══════════════════════════════╡     scroll UNDER the bar
│ ┌──────────────────────────┐ │  pinned bar, shadow-sticky, 72px
│ │        CHECK IN          │ │  always 568–640 at 360×640
│ └──────────────────────────┘ │
└──────────────────────────────┘
   (scrolled:)
│ ☐ I'm new to MISA check-in   │
│   ▸ Not sure?                │  <details>: "Tick it if you've never
│                              │   checked in with this form. If we already
│                              │   have you, it just uses your record."
```

**The twelve states.** The bar exists only while there is an action. On the
review step it holds *Confirm and check in* / *Edit details*, and on a result it
goes away. Because a result replaces a form the member has scrolled down, the
page moves focus and scroll to the result heading. Banners as A. Results
status-coded as above.

**Focal moment.** The pinned bar: one navy button in the same place on every
phone, the portal's action as furniture.

**Motion.** The bar is static. It doesn't slide in, which would move the target
while a thumb is on its way to it.

**Responsiveness.** From `sm` the bar un-pins and the button sits under the form,
as today. Pinning is a phone answer to a phone problem.

**Layout families.** Two: page hero and a form on white; the bar is chrome, not a
section.

**Risks — several, and they are the concept's price.**
- **At scroll 0 the bar covers the email field's lower half and the checkbox.**
  The bar is on the first screen, but a first-timer has to scroll to reach the
  box, under the bar.
- **Fixed bars and phone keyboards fight.** iOS Safari lays out fixed elements
  against the layout viewport, so with the keyboard up the bar is hidden behind
  it or jumps. Getting this reliable takes the `visualViewport` API, which is
  JavaScript for a form that has to work before hydration.
- **A sticky bottom bar can cover the focused field** (WCAG 2.4.11 Focus Not
  Obscured). The fix is scroll padding equal to the bar, and the site has no
  `scroll-padding-top` even for its sticky header yet.
- **The disclosure hides the only sentence that answers the officer's named
  problem** behind a tap the confused member has to know to make.

---

## For the lead

Both meet the bar on paper: the button is on the first screen at 360×640 and the
fast path stays one submit and one screen. **A** gets there by making the page
fit — short band, tighter rhythm, reassurance inline — at the cost of 12px of
slack and the full hero. **B** keeps the page as it is and pins the action, at
the cost of covering part of the form at scroll 0, fighting the phone keyboard,
and hiding the answer to the officer's named problem behind a disclosure. The
shared decisions above (checkbox copy, review copy, status-coded outcomes) hold
under either.

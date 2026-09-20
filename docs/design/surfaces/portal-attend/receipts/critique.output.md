# impeccable — `critique app/(public)/portal/attend/`

Run 2026-09-19 against `a38a2b3d3fb740cc9565fdfb2036dfee72449efb`. Operate mode:
the visitor completes a task, and the scene is a student standing at the door of
a club event with a phone in one hand, arriving from a printed QR code that
308s straight here.

**The task, measured end to end.** Fast path: three fields, one tick left
untouched, one tap. Everything needed is on the first screen at 360×640 with
29px to spare. The officer's named failure — a first-timer stuck on the
checkbox's wording — now has an answer in the label itself and a second one in
the reassurance below it. Nothing in this critique disputes the concept.

---

## A1 — The review step sets the values a member is asked to proofread at 14px

**The screen's whole job is proofreading.** `needs_confirmation` exists because
the next action creates a roster record, and its heading says so: *"Check your
details before we add you"*. What it then shows is a UT EID and an email address
at `text-sm` — **14px** — on a phone, held at arm's length, in a room.

An EID is the thing this system is most sensitive to getting wrong. The
codebase already knows it: DESIGN.md sets identifiers in monospace *"because an
EID is transcribed by hand off a phone screen; monospace separates `l` from
`1`"* — and scopes that to `/admin`, so monospace is not available here. Size is
the instrument that is.

14px arrived by inheritance, not by decision: the `<dl>` carries `text-sm`
because the form's labels do. But the labels and the values are different jobs.
A label is scaffolding you read once; a value is data you are being asked to
verify.

Measured at 360 in the real column: the whole `<dl>` grows **76 → 88px**, twelve
pixels, on a screen with **no bar on it** — the gate is idle-only, and the review
step already sits comfortably inside the fold.

🪤 The `<dt>` labels move with them rather than staying at 14px. A two-size row
reads as an error before it reads as a hierarchy, and the de-emphasis the labels
want is already carried by the ink (Secondary Graphite against the values'
`font-medium` Graphite).

**Adopt.** `text-base` on the `<dl>`.

## A2 — The only action on four of the twelve screens is a 32px target

Every terminal outcome ends in one link: *"See your points and attendance"*.
Measured: **217 × 32px**.

That clears WCAG 2.2's 24px floor, and it matches what the hub shipped for its
officer line. But this surface's own evidence asks for more, and says why:
**EV4** cites the *native* minimum — 44pt iOS, 48dp Android — and the brief
records the reason as *"`/portal/attend` is used standing up at a door,
one-handed, in a hurry"*. Every other target on this page was built to 48px on
that argument: the box row is 320 × 64, both review buttons are 48, Check in is
48.

The difference from the hub is what the control **is**. The hub's officer line
is a footnote for the one person on the page who is not a member. This is the
sole action on the screen a member lands on after checking in — and on
`pending`, `duplicate` and `refused` it is the only thing they can do at all.
Holding it to a lower floor than the button that got them there is not a
decision anyone made; it is the shared idiom being copied one call site too far.

Measured cost: `py-1 → py-3` takes the link from 32 to **exactly 48px**, on a
terminal screen with nothing below it.

**Adopt.**

## A3 — On `unmatched` the button is 121px below the fold — reported, not a defect

Measured at 360×640: the banner is 105px, and with its 16px gap the Check in
button moves from 611 to **732**. So the member who has just been told to tick
the box must scroll to reach both the box and the button.

This is the tradeoff the brief settled in advance and named: **the bar is
IDLE-ONLY**, because gating on the unmatched state would force either the
approved reassurance line into a disclosure or the band below what the 48px
chevron notch allows — both reopening officer decisions. Recorded here with the
number, which is what the brief asked for ("measured and reported at the gate,
but does not block").

Two things make it land softer than the number suggests: focus moves to the
banner on arrival (EV1), so the explanation is what the member is looking at;
and the box now carries a caution outline, so the thing they are being sent to
is marked when they get there.

**Not a finding.** Reported per the brief.

## A4 — The fast path is unchanged in length, which is the property to protect

Checked rather than assumed, because "one submit, one screen" is the decision
table's property and the easiest thing for a redesign to cost. Driven on the
local stack: a returning member with matching details and the box untouched goes
straight to `present`. No step added, no confirmation interposed, no scroll.

## A5 — Outcomes are distinguishable without colour

`present` affirm + check · `pending` caution + clock · `refused` critical +
circle-slash · `duplicate` **affirm or caution by what it found**, + circle-check.
Each pairs its ground with a heading that names the outcome in words. Verified
live on all five renderings.

🔓 The duplicate split is the one worth calling out as correct: "you're already
checked in" is a success a member can act on by leaving, and "it's awaiting
review" is the same caution `pending` carries. One colour for both would have
made the affirm ground mean two different things on one page.

---
version: 1
slug: "route-portal-attend"
primary_target: "route:/portal/attend"
related_targets: ["app/(public)/portal/attend/page.tsx","app/(public)/portal/attend/_components/checkin-form.tsx"]
---

# Surface brief: portal-attend (`/portal/attend`)

## Mode and lead
- **Mode:** Operate — a member on their own phone at the door of a MISA event,
  in its first minutes, checking themselves in.
- **Lead skill:** `impeccable` (Operate mode, craft-floor).
- **Visual authority:** `DESIGN.md` — the established world. Never a replacement
  world, and never a regenerated `DESIGN.md`.

## Job and audience
- **Who arrives:** a member standing at an event with their phone. Most are
  returning members on the fast path (box unticked, EID or email matches: one
  submit, one screen). The rest are first-timers, who take the two-step
  confirmation.
- **How they arrive — two doors, and the first matters more.** The printed event
  QR codes point at `/attend`, which 308s straight here, so for most members at
  the door **this page, not the hub, is the first screen they see**. The other
  door is header MEMBER PORTAL → hub → *Event Check-In* (the hub's brief keeps
  that at two taps).
- **What goes wrong today (officer, 2026-09-19 interview): first-timer
  confusion, and specifically the checkbox's WORDING.** "This is my first MISA
  event, or my first time checking in here" leaves returning members unsure
  whether it means them. Not named as a problem: mistyped details, slow signal.
- **Who reads the success screen (officer): just the member.** It is a receipt
  for them, not a pass shown to an officer at arm's length.

## Outcome and proof
- **Primary task:** submit full name, UT EID and email and be told, unmistakably,
  that attendance is recorded.
- **Success:** §1.2's target — **a completed check-in in under 20 seconds** — and
  the decision table's fast-path property: the common case stays one submit and
  one screen, with no step added for it.
- **The one thing it must never fail at:** a member must always know which
  outcome they got — recorded, received for review, already recorded, refused,
  or needs a correction — and a recorded check-in must never look like a
  failure, or a failure like a recorded one.
- **Measured 2026-09-19** (local dev server, scroll 0, 61px sticky header,
  keyboard closed):

  | Viewport | Hero ends | Fields (each 50px) | First-time box | Check in button |
  |---|---|---|---|---|
  | 360×640 | 238 | 310–548 | 572, box 16×16 | **632–671 — cut by the fold**, 39px tall |
  | 390×844 | 238 | 310–548 | 572 | 632–671 |
  | 1280×800 | 283 | 371–609 | 633 | 673–712 |

  **Proof the lead proposes for the gate (the officer did not name an anti-goal;
  this is the documented 20-second target made measurable):** at 360×640, with
  the keyboard closed, the Check in button sits fully in the first screen
  (bottom edge ≤ 640px, today 671); the page never grows a step on the fast
  path; and every state below passes `npm run test:ui` — today the first-timer
  confirmation does not.

## States
Every state is designed, not just the form. Realistic ranges: full name up to
120 characters, EID up to 32, email up to 254 (the schema's echo limits); event
titles run long ("Fall Kickoff & Networking Night"-length and beyond); the
refusal quotes `ORPHAN_WINDOW_HOURS` (48).
1. **Idle** — Full name, UT EID, Email, the first-time box, Check in.
2. **Submitting** — the button reads "Checking in…", disabled, `aria-busy`. It
   must also work before hydration: the form posts to the Server Action, and a
   submit made before JS loads queues.
3. **Invalid** — a message under each field that failed (`role="alert"`),
   values kept.
4. **Unmatched** — "We don't have that info on file…" banner, fields echoed back
   for correction, pointing at the box. The accepted membership oracle: this
   screen is allowed to say so.
5. **Rate limited** — caution banner; values kept.
6. **Error** — critical banner, which tells the member to find an officer so
   the attendance isn't lost.
7. **Needs confirmation, new member** — the review step: "Check your details",
   the three values, *Confirm & check in* / *Go back*.
8. **Needs confirmation, already on file** — the same step, saying the existing
   record will be used rather than a second one added.
9. **Present** — "You're checked in!" with the event's title.
10. **Pending** — "Check-in received": no window open, an officer will match it.
11. **Duplicate** — "Already recorded", in two readings: already present, or
    already awaiting review.
12. **Refused** — "No event around this time", with the 48-hour window.

States 9–12 replace the form, and each carries the link to `/portal/lookup`.

## Interaction and layout
- **Behaviour is fixed:** the three fields, the checkbox, the two-step first-timer
  flow, what each outcome means and when it happens. Field order stays.
- **May change (officer, 2026-09-19):** the navy page hero; the wording of the
  results and the four banners; the checkbox's label and the review step's
  heading, sentence and button labels; the lookup link under the results. Any
  new copy is shown to the officer before it ships.
- **The checkbox wording is the design problem the officer named.** Whatever it
  says must stay true to the decision table in
  `docs/attend-confirmation-flow.md`: **the box is a hint, not an instruction**.
  Ticking it when you're already on file links you to your own record and never
  creates a duplicate, so it is safe for an unsure member to tick. Leaving it
  unticked when the details match is the fast path, and a genuinely new member
  who leaves it unticked gets the Unmatched screen, then ticks it.
- **Hero (adopted concept A):** the hub's short field band, so the portal reads
  as one place — hub-only CSS in the portal's own files, never a change to the
  nine-page `PageHero`. Its 177px today is what pushes the button off the first
  screen at 360×640.
- **The form (concept A):** on white, at the `xs` rhythm with 16px gaps; every
  label stays visible above its field — no placeholder or floating labels, even
  to win back height (EV12); no gap between fields, box row and button drops
  below 8px — the reassurance line gives first (EV5). Check in is 48px, full
  width below `sm`, estimated bottom ≈628px at 360×640.
- **Tap targets:** the whole box row is the checkbox's target and is at least
  48px tall; the Check in button is 48px (EV4).
- **Pending:** "Checking in…" never resizes the button — full width below `sm`,
  and above it a width that already fits the longer label; `aria-busy` stays
  (EV7).
- **After a failed submit, focus moves to the explanation** — the banner on
  unmatched, rate limited and error; the first invalid field on invalid — and
  inline errors stay (EV1).
- **Outcomes are status-coded, never by colour alone:** present in affirm,
  pending in caution, refused in critical, duplicate by what it found; each
  pairs its colour with a heading naming the outcome and a drawn, `aria-hidden`
  Lucide icon (EV9). All in the same sheet, in place, no scroll jump.
- **Announcements:** one `role="status"` `aria-atomic` region, in the DOM from
  the first render, receives each outcome sentence; the panels stop carrying
  `role="status"` themselves (EV11). This settles the live-region constraint
  below.
- **Terminal screens** replace the form in place, read as the end of the task,
  and carry no `data-reveal` (they mount after first paint).
- **Keyboard and phone input stay as built:** `autoComplete` name/email,
  `inputMode="email"`, EID with no autocapitalise or autocorrect; Enter submits;
  on the review step Confirm comes first in DOM order, so Enter confirms.

## Constraints carried in
Behaviour does not change in a design phase. From CLAUDE.md's Invariants and
DESIGN.md, the ones this surface touches:
- 🔓 **Check-in location verification: capture runs unconditionally on every
  self check-in, and `/portal/attend` carries NO disclosure sentence** — removed
  by hotfix `c3890a1`, confirmed by the officer on 2026-09-19 (§9 #15, v1.83).
  The redesign adds none; a returning disclosure is an officer decision, and
  would be one sentence in the unconditional present tense.
- **"React 19 resets an uncontrolled `<form action={…}>` after the action
  resolves. Echo submitted values back in server state; drive every
  `defaultValue` from them; pass a string, never `undefined`."**
- **"Never put `data-reveal` on a node that mounts after first paint"** — every
  result and review panel.
- **"A live region must be in the DOM BEFORE its contents change"** — today the
  result and review panels mount already carrying `role="status"` and their
  text, which is exactly the case this rule says is missed. The gate verifies
  that every outcome is announced.
- **"Button labels are sentence case in the DOM"**; `button.tsx` uppercases.
- **"Moving a page ground is a CONTRAST CHANGE"**, **`ground="white"` is a
  correctness control** (`controlClass` fills every input with Vellum), and
  **"`--misa-muted` may sit on Paper, never on Vellum"**: the review step's
  field labels are muted ink on a Vellum panel today, and that is the failure
  `test:ui` catches on the first-timer confirmation. Phase 3 owns the fix.
- **"Server Components own date formatting"** — the form is a Client Component,
  so if any concept shows an event's time, it arrives already formatted from the
  server.
- **The refusal reads `ORPHAN_WINDOW_HOURS` from `lib/checkin.ts`**, never a
  typed "48", and keeps its sentence one unbroken JSX text run (the `&nbsp;`
  trap in the file's comments).
- **Robots is per page:** `/portal/attend` stays indexable, as `/attend` was.
- 🔓 **"check-in lives only inside the portal"** — nothing added here links
  check-in from outside `/portal`.
- **The honeypot stays** visually hidden, `aria-hidden`, `tabIndex={-1}`.
- **The review step's buttons stay plain submit buttons carrying `name`/`value`**
  — never `formAction` — with Confirm first.
- **DESIGN.md:** the five grounds; the Rare Navy Rule; status tokens for
  feedback only, never decoration; square structure, 4px only on things that
  float; colour swaps as the only hover; the layout-family budget.
- **The repository is public:** any sample name, EID or email is obviously fake.

## Diverge
`frontend-design` proposed two concepts (`receipts/diverge.output.md`); the lead
decided in `receipts/diverge.md`.
- **A — "Fit the first screen": ADOPTED.** The hub's short band, the form on
  white at a tighter rhythm, the box label stating a fact the member knows with
  an inline reassurance, a 48px full-width Check in at ≈628px on a 640px screen,
  banners and outcomes in place in the same sheet, outcomes status-coded. It
  meets the bar with no JavaScript and covers nothing. **Risk: 12px of slack at
  360×640** — a gate measurement, not an assumption.
- **B — "The pinned action": REJECTED.** Full hero kept, Check in pinned in a
  sticky bottom bar. At scroll 0 the bar covers the email field and the checkbox
  — the very control the officer named — it fights the phone keyboard (a fix
  needs JavaScript on a form that must work before hydration), it risks WCAG
  2.4.11 on a site with no scroll padding, and it hides the reassurance behind a
  disclosure.
- **Copy both concepts share, PROPOSED for the officer:**
  - Box label *"I haven't checked in with this form before"* (was "This is my
    first MISA event, or my first time checking in here"), with *"Not sure? Tick
    it. If we already have you, we'll use your existing record, never a second
    one."* beneath — true to the decision table: a hint, not an instruction.
  - Review step *"Check your details before we add you"* (new) / *"We found you.
    Confirm to check in."* (on file); buttons *"Confirm and check in"* / *"Edit
    details"* (was "Go back").
  - Lookup link *"See your points and attendance"*.

## Evidence
Adopted lookups from `receipts/evidence.md` (raw output in
`receipts/evidence.output.md`); the rejected ones are recorded there.
- **EV1** — focusable error summary (ux, High). → Focus moves to the explanation
  after a failed submit; inline errors stay.
- **EV4** — touch target size (ux, High): 44pt / 48dp. → The box row and the
  button are at least 48px.
- **EV5** — touch spacing (ux): 8px minimum. → The floor on concept A's
  compression.
- **EV7** — loading indicators (ux, High): preserve layout, focus and busy
  status. → The pending button never resizes.
- **EV9** — colour only (ux, High). → Every outcome is colour plus a naming
  heading plus an icon.
- **EV11** — atomic status message (ux, High). → One always-mounted
  `role="status"` region announces each outcome.
- **EV12** — visible input labels (ux, High). → No placeholder or floating
  labels, even to win back height.

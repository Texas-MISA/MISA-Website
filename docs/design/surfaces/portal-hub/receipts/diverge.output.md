# frontend-design — two concepts for the portal hub (`/portal`)

Invoked 2026-09-19 by `/design-brief portal-hub`, step 2, against the brief at
`.impeccable/surfaces/route-portal.md`. **Prose and structure only; no code.**

## What is pinned, and what is free

The brief pins the visual world: DESIGN.md's palette, the Barlow / Barlow
Condensed pair and its ramp, the five grounds, the four elevation steps, square
structure with the 4px radius only on things that float, colour swaps as the
only hover. So this skill's usual token pass (palette, typefaces) is **not**
re-opened — proposing one would be a rival source of truth. What is free, and
where both concepts spend their decisions: composition, hierarchy, the
interaction thesis, the focal moment, and the copy the officer made changeable
(row titles, labels, the officer line, the hero).

The subject: a student club's member tools, used on a phone at the door of an
event, inside a site whose identity is an institutional drawing set — a drawn
navy field, a grey page, white surfaces lifted off it, hairline rules.

Fixed by the officer: three destinations, **equal formatting**, order
check-in → leaderboard → lookup, nothing else added, and never slower to check
in than today (check-in control's bottom edge ≤ 424px at 360×640; two taps from
the header).

## Plan pass, then review against the brief

**First instinct, and why it was thrown out.** Three icon tiles in a row, each
with a numbered marker (01 / 02 / 03), a line of copy and a "→" on the button.
Every part of that is a default rather than a choice: the three tools are not a
sequence, so numbering them lies; an icon tile row is the SaaS card kit; a
trailing arrow is template chrome; and three equal cards side by side is the
feature-row tell the hub's own code comment already rejected. Both concepts
below start from what this page actually is — a doorway used standing up.

**What today's page spends, measured.** The shared hero costs 176px of a 640px
phone screen before the first destination; each row repeats its name twice (a
title, then a button saying nearly the same thing); every row is hidden behind
`data-reveal` until the observer fires; and the buttons are 39px tall. Both
concepts cut the hero's cost, say each destination's name once, and paint the
destinations immediately.

---

## Concept A — "The title block"

**Thesis.** The hub is one object: a single shared-rule plate on the grey page
ground, three cells tall, like the title block in the corner of a drawing
sheet. Each cell is a whole-row link. The page's one bold move is the plate's
right-hand column: a narrow navy key at the end of every row, so the three keys
stack into one continuous navy stripe down the plate's edge.

**Structure (360px)**

```
┌──────────────────────────────┐  header, 61px (sticky, unchanged)
├──────────────────────────────┤
│░░░░░░ MEMBER PORTAL ░░░░░░░░░│  short field band: the h1 alone, centred,
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  chevron notch kept, padding cut — ~129px
 ╲░░░░░░░░░░░░░░░░░░░░░░░░░░░░╱
  ────────────────────────────
  ┌─────────────────────────┬──┐
  │ Event Check-In          │▐>│  cell 1 — the whole row is the link
  │ Check in to a MISA      │▐ │
  │ event.                  │▐ │
  ├─────────────────────────┼──┤  1px seam: one background through gap:1px
  │ Points Leaderboard      │▐>│
  │ Current-term standings  │▐ │
  │ for MISA members.       │▐ │
  ├─────────────────────────┼──┤
  │ My Attendance           │▐>│
  │ Look up your own MISA   │▐ │
  │ attendance, points and  │▐ │
  │ dues status.            │▐ │
  └─────────────────────────┴──┘
  Officers: sign in               plain line, secondary ink, as today
```

**Hierarchy.** One h1 on the field. Each row: its title at the `Title` step
(26px on a phone) in navy, its one-line body in Secondary Graphite beneath, and
the navy key (48px wide, the row's full height, a drawn Lucide chevron in white,
`aria-hidden`). Equal formatting holds structurally — three cells of one plate
cannot be styled differently without breaking the plate.

**Copy.** The officer's titles and one-line bodies stay verbatim. What goes is
the separate button label (*Check in* / *Leaderboard* / *Lookup*): the row is
the action, so each destination is named once rather than twice. Dropping a
label is a copy change the brief allows; it still needs the officer's yes.

**Interaction.** The link wraps the row; its accessible name is the title, the
body is its description. Hover and press are colour swaps only: the cell's fill
moves from Paper toward Vellum and its key from Drafting to Pressed Navy, at
`--dur-hover` / `--dur-press`. Focus is the standard navy ring, drawn inside the
cell so the seam does not clip it. Tab order: three rows, then the officer link.

**Responsiveness.** 360: as drawn, full width inside the 20px gutter. 768: the
plate holds the `narrow` measure, so the rows stay a column rather than
stretching into a strip. 1280: same column, centred under the centred h1; the
grey ground either side is the page, not emptiness to fill.

**Focal moment.** The navy stripe down the plate's right edge — three keys
reading as one rule, which is DESIGN.md's "one varying property reads as a set"
applied to the only thing that varies here, the words.

**Check-in, estimated at 360×640.** Band bottom ≈ 190, plate top ≈ 214, check-in
row ≈ 214–311, whole plate ≈ 585, officer line ≈ 620. **Check-in bottom ≈ 311
(today 424); all three destinations in the first screen** (today one and a half).
Tap targets become the full row, ~97–149px tall. Estimates from the ramp and the
`<Section>` steps; the build measures them.

**Motion.** None on arrival — the destinations paint complete, with no
`data-reveal`, so nothing waits for the observer. The only motion is the hover
and press ink change. (emil-design-eng owns the final word.)

**Layout families.** Two: a page hero (short) and a shared-rule plate.

**Risks.** The row-as-link needs care so its accessible name is the title rather
than every word in the cell. The short band is a hub-only treatment: it must
live in the hub's file, never as a change to the nine-page `PageHero`.

---

## Concept B — "The field console"

**Thesis.** The hub *is* its hero. The whole tool lives on the drawn navy field:
a small h1, then the three destinations as three full-width white buttons
stacked on the field, each with its one-line description beneath in white at
80%. The chevron notch closes the field under the last one. Below it, on the
grey page, sits only the officer line.

**Structure (360px)**

```
┌──────────────────────────────┐  header, 61px
├──────────────────────────────┤
│░░░░░░ MEMBER PORTAL ░░░░░░░░░│  h1 at the top of the field
│░┌──────────────────────────┐░│
│░│    EVENT CHECK-IN        │░│  white onNavy button, 56px, full width
│░└──────────────────────────┘░│
│░ Check in to a MISA event.  ░│  white/80 description
│░┌──────────────────────────┐░│
│░│    POINTS LEADERBOARD    │░│
│░└──────────────────────────┘░│
│░ Current-term standings for ░│
│░ MISA members.              ░│
│░┌──────────────────────────┐░│
│░│    MY ATTENDANCE         │░│
│░└──────────────────────────┘░│
│░ Look up your own MISA      ░│
│░ attendance, points and dues░│
│░ status.                    ░│
 ╲░░░░░░░░░░░░░░░░░░░░░░░░░░░░╱  chevron notch
  Officers: sign in               on the grey ground
```

**Hierarchy.** The field carries everything: h1, then three identical white
`onNavy` buttons whose labels are the destinations' names, descriptions below.
The page's single brand moment and its three actions are the same element.

**Interaction.** Explicit buttons, not rows. White fill → 85% white on hover, 75%
on press; the focus ring flips to white per `.on-navy`. Tab order as A.

**Responsiveness.** 360: as drawn. 768 and 1280: a centred column about 28rem
wide in the middle of a full-width field — the centred-hero family, holding
controls.

**Focal moment.** Three white bars on the drawn navy field — the most striking
first screen the portal could have.

**Check-in, estimated at 360×640.** First button ≈ 142–198, field bottom ≈ 600,
officer line ≈ 625. **Check-in bottom ≈ 198 — the fastest arrangement
available; all three in the first screen.** Targets are 56px buttons.

**Motion.** None on arrival, as A.

**Layout families.** One: a field band holding controls.

**Risks.** It spends the site's hero ground as a control surface, where
DESIGN.md gives controls the `white` ground and the field to heroes and feature
bands. The descriptions sit *after* the buttons, so a member unsure which tool
is which reads below the control before choosing. At 1280 it is a large navy
area around a narrow column. And it makes the hub the only portal page whose
content lives inside the hero, before the other three are designed.

---

## For the lead

Both pass the brief's hard bar (check-in bottom ≤ 424px at 360×640, two taps,
equal formatting, order fixed, nothing added). They differ in where the tool
lives — **A** on the page, as one lifted object read like a list, **B** inside
the field, as a hero of buttons — and in what the member reads first: **A** a
name that is also the action, **B** a button whose explanation follows it.

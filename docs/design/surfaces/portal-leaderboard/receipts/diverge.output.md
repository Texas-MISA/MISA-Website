# frontend-design — two concepts for the leaderboard (`/portal/leaderboard`)

Invoked 2026-09-19 by `/design-brief portal-leaderboard`, step 2, against the
brief at `.impeccable/surfaces/route-portal-leaderboard.md`. **Prose and
structure only; no code.**

## What is pinned, and what is free

Pinned: DESIGN.md's world, so no token pass. The columns are rank, member and
points. The term stays visible and comes off the rows. Nothing is added (no
filter, no per-member detail). The status colours never encode rank. Free: the
hero, where the term sits, the top places, density and rank styling, and the
empty, banner and lookup copy.

The subject: a student club's term standings. A member reads it on a phone for
the race at the top and for their own row in the middle, and the same page goes
up on a projector at a general meeting. The top 10 are recognised at term's end.
Its vernacular is the honours board: names in a fixed order, the recognised
ones set apart.

## Plan pass, then review against the brief

**First instinct, and why it was thrown out.** A three-step podium with gold,
silver and bronze medals, avatars, and green and red arrows for movement since
last week. Every part fails the brief. Medal colours aren't in the palette, and
the status colours may not stand in for them. Avatars add personal detail to a
page whose privacy rule is that names and totals are all it shows. Movement
arrows need a history the view doesn't have. And a podium honours three when the
club recognises ten.

**The measured problem.** At 1280×720, the projector's size, 6 rows show, set
at 14px. At 360×640, 5 rows show. The hero spends 249px on a phone and 270px at
desktop before the first rank.

**What both concepts do, because the brief decides it rather than taste:**
- **Recognised places are marked by rank, not by row count.** The treatment
  applies to rank ≤ 10 (twelve rows if three members tie at 9), **and only once
  a member has points**. When everyone is tied at zero, nobody is recognised
  yet, so the board shows no top 10 at all rather than a roster-length one.
- **The rank is printed on every row, ties included**, so a member who finds
  their name mid-list reads their place without counting upward.
- **Rank numerals in Barlow Condensed, navy, tabular**; points right-aligned and
  tabular, so a column of totals scans as numbers.
- **The term is content, not a subtitle**: set large and read off the rows. An
  empty board says "Current-term standings" rather than looking a term up
  anywhere else.
- **No row hover** (rows aren't interactive), and **the sticky column head
  stays**. ⚠️ *Correction, made after measuring during step 3: the head is NOT
  sticky today. `THead`'s `sticky` is opt-in and paired with `Table`'s
  `maxHeight`, and the leaderboard opts out, so the page comment claiming a
  sticky head is stale. Making it stick, below the site header, is a decision
  the brief takes from evidence EV3; it is not a given.*
- **Copy, proposed:** the all-zero banner becomes *"Nobody has points yet this
  term, so everyone is tied at zero. Totals appear after the first event."*
  The lookup line becomes *"Want to see how your total adds up? Look up your
  attendance."*

---

## Concept A — "The board is the page"

**Thesis.** This page is its data, so it opens on the data. There is no navy
hero: the page starts on white with a title row (*Leaderboard*, and the term set
large beside it) and the table begins at once. The top 10 are the same table set
larger: bigger names, bigger rank numerals, taller rows. A drawn navy rule after
the last recognised rank is the cut line. Below the line the board drops to a
compact, even density for scrolling to your own name.

**Structure (1280×720, projected)**

```
┌──────────────────────────────────────────────────────────┐ header 61
├──────────────────────────────────────────────────────────┤
│  Leaderboard                                  Fall 2026  │ title row ~72
│  ─────────────────────────────────────────────────────── │
│  #    Member                                    Points   │ sticky head 40
│  1    Avery Placeholder                             23   │ ┐
│  2    Jordan Sample                                 19   │ │ top 10:
│  2    Riley Example                                 19   │ │ names 22px,
│  4    Casey Fixture                                 18   │ │ numerals 26px,
│  5    Morgan Testcase                               17   │ │ 48px rows
│  …                                                       │ │
│  9    Quinn Dummy                                   15   │ ┘
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ the cut line
│  11   Parker Mock                                   14   │ compact, 16px,
│  11   …                                                  │ 40px rows
└──────────────────────────────────────────────────────────┘
```

**Arithmetic, estimated.** Header 61, a 24px top pad, title row 72, sticky head
40: the first row at ≈197. Ten recognised rows at 48px ≈ 480, so **rank 10's row
ends at ≈677 of 720, the whole top 10 on the first screen with 43px to spare.**
Ties that put 12 rows inside the top 10 overflow by about 50px. On a phone
(360×640), the title and term stack in ≈64px, recognised rows are 52px, and
**rank 3's row ends at ≈333**, with about eight rows on the first screen.

**Focal moment.** The cut line: one navy rule across the board, the line every
member wants to be above.

**Responsiveness.** 360: the member column wraps long names onto a second line
rather than truncating, and the points column never leaves the screen. 768 and
up: the table widens to the `narrow` measure; at 1920×1080 the recognised rows
can grow again. Projection is the reason the top of the scale exists.

**Motion.** None. The table is there when the laptop opens it.

**Layout families.** One: a ranked table, with a title row rather than a hero.

**Risks.** It is the only public page without the navy hero, a departure from
the hub and check-in (the officer made the hero changeable, but this changes the
portal's rhythm). A tie at the boundary can push rank 10 below the fold at
1280×720. And the board-only sizes have to be applied at this page, not by
changing the shared `Table`.

---

## Concept B — "The honours board"

**Thesis.** Recognition and standing are different things, so they get
different places. The top 10 move into the hero: the drawn navy field *is* the
honours board, with the recognised names set in white under the title and
term, like gilt names on dark wood. Below the notch, on white, the rest of the
board continues from rank 11 as a compact table.

**Structure (1280×720, projected)**

```
┌──────────────────────────────────────────────────────────┐ header 61
├──────────────────────────────────────────────────────────┤
│░░░░░░░░░░░░░░░░░ Leaderboard, Fall 2026 ░░░░░░░░░░░░░░░░│ field
│░░  1  Avery Placeholder   23  ░░  6  Drew Specimen   16 ░│ two columns
│░░  2  Jordan Sample       19  ░░  7  …                  ░│ of five,
│░░  2  Riley Example       19  ░░  8  …                  ░│ white type,
│░░  4  Casey Fixture       18  ░░  9  Quinn Dummy     15 ░│ names 26px
│░░  5  Morgan Testcase     17  ░░  9  …                  ░│
 ╲░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░╱  notch ≈ 470
┌──────────────────────────────────────────────────────────┐ white
│  #    Member                                    Points   │
│  11   Parker Mock                                   14   │ compact table
└──────────────────────────────────────────────────────────┘
```

**Arithmetic, estimated.** The title and term in ≈80px, five rows of 56px ≈ 280,
and the notch: the field ends ≈470, **the whole top 10 on the first screen at
1280×720 in the largest type either concept reaches.** On a phone the top 10 are
one column of ten on the field: **rank 3 ends ≈293**, and the field runs to
≈650, so the white table (ranks 11+) starts below the first screen.

**Focal moment.** The field itself: white names on the drawn navy, the one place
on the site where people's names are the hero.

**The states it has to answer.** All zero means an empty honours board, so the
field carries the banner's sentence and the table holds the roster. Empty means
the field says "No standings yet". A read error puts `ReadError` on navy, which
has no on-navy variant today.

**Motion.** None.

**Layout families.** Two: the page hero (as an honours board) and a ranked
table.

**Risks.** One ranking becomes two structures, a list in the hero and a table
below it, which screen readers meet as separate things and the rank column has
to bridge. A member in the middle, finding themselves, scrolls past a whole
screen of navy first, on every visit. Error and empty states on the field need
variants of shared primitives that don't exist. And projected in a bright room,
a navy field washes towards grey while white type holds. That is survivable,
but it is the opposite of the room's usual light.

---

## For the lead

Both reach the bar: the top 10 on the first screen at 1280×720, readable across
a room, and the top 3 on the first phone screen. **A** keeps one ranking in one
table, and the cut line carries the recognition; **B** gives recognition its
own place, and the honours board carries it. A's cost is leaving the navy hero
and a thin margin when ties land at 10. B's cost is splitting the ranking in
two, a slower path for the member in the middle, and new variants for its error
and empty states.

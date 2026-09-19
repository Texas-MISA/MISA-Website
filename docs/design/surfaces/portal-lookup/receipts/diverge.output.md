# frontend-design — two concepts for My Attendance (`/portal/lookup`)

Invoked 2026-09-19 by `/design-brief portal-lookup`, step 2, against the brief
at `.impeccable/surfaces/route-portal-lookup.md`. **Prose and structure only; no
code.**

## What is pinned, and what is free

Pinned: DESIGN.md's world, so no token pass. One EID field. What the result
contains — the four numbers, pending check-ins, this term's events, points
granted separately, dues. One message for every miss, in the neutral tone.
Free: the hero, the intro, the result's layout and order, and all result
wording.

The subject: a member checking their own record, on a phone, usually seconds
after checking in at an event. The officer's order is points, then dues, then
events, and the named anti-goal is reading as a different product from the hub,
check-in and the leaderboard.

## Plan pass, then review against the brief

**First instinct, and why it was thrown out.** A dashboard: four KPI tiles in a
2×2 grid with a progress ring for attendance rate, a sparkline of points over
the term, and tabs across the result (Overview / Events / Dues). Rejected on
every count. The ring and the sparkline need history the profile doesn't carry;
tabs hide two of the three things the officer says members come for; and a tile
grid with a coloured wash is the SaaS kit rather than this drawing set.

**The measured problems.** On a phone the single EID field sits at 541 and its
button is cut off at 615–654, because a 249px hero and two paragraphs of
explanation come first. On the result, the member's own name starts at 517 for
the same reason. The events table is 512px wide inside a 320px frame, so the
"You" column — the one saying whether you attended — is the part you have to
scroll sideways to see. And the stat block puts a `<p>` inside a definition
list's group, which axe fails.

**What both concepts do, because the brief decides it rather than taste:**
- **The portal's short navy band**, as on the hub and check-in, carrying the
  h1 and one line: *"Enter your UT EID to see where you stand this term."* The
  intro paragraphs go; the stale "Both have to match the same member" sentence
  goes with them, per the officer.
- **The EID field and its button on the first phone screen** — estimated field
  at ≈238–288 and button at ≈304–352, against 615–654 today.
- **The stat block becomes a legal definition list:** one `<dt>` per number and
  its note as a second `<dd>`, never a `<p>` inside the group. That is the axe
  fault, fixed structurally.
- **No four-column table on a phone.** Below `sm` each event is a stacked row —
  title, then when and points, with its state at the end — so attended, missed
  and upcoming are readable with no sideways scroll. From `sm` the table
  returns as it is.
- **Attendance states stay words** (`Pill` affirm for attended, neutral for
  missed, unframed for upcoming: the absence of an outcome, not an outcome).
- **Dues is a status, not a verdict.** Paid is an affirm pill; unpaid is a
  neutral one, never critical — a member who hasn't paid yet has not failed at
  anything, and DESIGN.md keeps the status colours for feedback.
- **Proposed wording:** dues unpaid becomes *"You're not paid up for Fall 2026
  yet. Dues are worked out from payments we've matched to you — if you've paid
  recently, ask an officer rather than paying twice."*; the reset button becomes
  *"Look up another EID"*. The term note, pending note and events note keep
  their current sentences, which are accurate.

---

## Concept A — "The receipt"

**Thesis.** The result is a receipt, read top to bottom in the officer's order:
who you are, your numbers, what's still in flight, whether you're paid up, then
the events behind the numbers. It shares check-in's shape — short band, one
white sheet — so a member arriving from "You're checked in" sees the same room.

**Structure (360px, result)**

```
┌──────────────────────────────┐ header 61
├──────────────────────────────┤
│░░░░ MY ATTENDANCE ░░░░░░░░░░│ short band
 ╲░░░░░░░░░░░░░░░░░░░░░░░░░░░╱
┌──────────────────────────────┐ white
│ Avery Placeholder            │ name, Title
│ Fall 2026                    │ term, quiet
│                              │
│    17        9               │ the four numbers:
│  TOTAL    ATTENDANCE         │ total largest,
│                              │ 2×2 on a phone
│     8       62%              │
│  BONUS    RATE               │ 8 of 13 completed
│ ─────────────────────────── │
│ ⚠ 1 check-in waiting on an   │ caution band, only
│   officer — nothing is lost  │ when there are any
│ ─────────────────────────── │
│ ✔ Official member, Fall 2026 │ dues, one line
│   Covered through Fall 2026  │
│ ─────────────────────────── │
│ Events this term             │
│ 8 attended, 3 missed,        │ counts
│ 2 still to come              │
│ ┌──────────────────────────┐ │
│ │ Fall Kickoff             │ │ stacked row:
│ │ Sep 4, 6:00 PM    2 pts  │ │ no sideways
│ │                 attended │ │ scroll
│ ├──────────────────────────┤ │
│ │ Resume Workshop          │ │
│ │ Sep 18, 7:00 PM   1 pt   │ │
│ │                   missed │ │
│ └──────────────────────────┘ │
│ Points granted separately    │ only when any
│ [Look up another EID]        │
└──────────────────────────────┘
```

**Hierarchy.** The total is the largest thing on the page, in the display face,
navy. The three supporting numbers sit at one step down in a 2×2 on a phone, a
row of four from `sm`. Pending, dues and events are separated by hairlines
rather than boxed, so the sheet stays one object and the rules do the work the
drawing set already uses everywhere else.

**Interaction thesis.** Nothing to operate: the page answers and then gets out
of the way. The only control after a result is the way back to the field.

**Focal moment.** The total, arriving where the button was: the member's own
number, big, one line under their name.

**Idle, estimated (360×640).** Band ends ≈190, the field's label at ≈214, the
input ≈238–288, the button ≈304–352. **Both on the first screen**, with the
first-time explanation gone.

**Result, estimated (360).** Name ≈214, numbers ≈300–430, pending ≈450, dues
≈540, events heading ≈640 — so the three things members come for are in the
first two screens rather than at 517 and 1718.

**The states.** Pending appears only when there are any, in caution, and an
orphan says "not yet matched to an event" in the same row. No events yet is one
neutral line, not an empty table. Points granted separately appears only when
there are any. Unmatched, rate limited and error keep their single messages
above the field.

**Motion.** None; the result mounts after first paint and may never carry a
reveal.

**Layout families.** Two: the short page hero and a single result sheet.

**Risks.** The sheet is long on a phone (the seed's 13 events run past 2,000px),
so the order carries the weight — anything demoted below events is effectively
unread. Hairline separators do a lot of work; if the copy grows, the sheet
starts to read as one undifferentiated column.

---

## Concept B — "One ledger"

**Thesis.** A member's term is one record, so show one list. The numbers
compress to a single summary line with dues beside them, and everything the
term knows about you — every event, every pending check-in, every points grant
— becomes one chronological ledger, each row carrying its date, what it was,
its points and its state.

**Structure (360px, result)**

```
┌──────────────────────────────┐
│░░░░ MY ATTENDANCE ░░░░░░░░░░│ short band
 ╲░░░░░░░░░░░░░░░░░░░░░░░░░░░╱
┌──────────────────────────────┐
│ Avery Placeholder   ✔ dues   │ name + dues pill
│ 17 points, Fall 2026         │ total inline
│ 9 attendance, 8 bonus, 62%   │ the rest, small
│ ─────────────────────────── │
│ Your term, in order          │
│ ┌──────────────────────────┐ │
│ │ Sep 4   Fall Kickoff     │ │
│ │         2 pts   attended │ │
│ ├──────────────────────────┤ │
│ │ Sep 18  Resume Workshop  │ │
│ │         1 pt      missed │ │
│ ├──────────────────────────┤ │
│ │ Sep 20  Volunteer help   │ │
│ │         +3      granted  │ │ an adjustment,
│ ├──────────────────────────┤ │ in the same list
│ │ Sep 25  Check-in         │ │
│ │         —       waiting  │ │ a pending row
│ ├──────────────────────────┤ │
│ │ Oct 2   Case Night       │ │
│ │         2 pts   upcoming │ │
│ └──────────────────────────┘ │
│ [Look up another EID]        │
└──────────────────────────────┘
```

**Hierarchy.** One summary line, then one list. Every row reads the same way,
so the eye learns the pattern once. Dues rides beside the name as a pill with
its covering term underneath.

**Interaction thesis.** The page is a statement of account: chronological,
uniform, complete — the member reconstructs how their total got to be what it
is by reading down.

**Focal moment.** The ledger itself: one column of dated rows where four kinds
of thing line up in the same grammar.

**The states.** A pending check-in is a row in the ledger, marked waiting; an
orphan is a row with no title. No events, no grants and no pendings is an empty
ledger with one line of explanation. Dues unpaid is a neutral pill and the same
sentence as A.

**Motion.** None.

**Layout families.** Two: the short page hero and a ledger.

**Risks.**
- **It flattens the officer's order.** Points survive as a summary line, dues as
  a pill, but "which events did I miss" now means reading past grants and
  pendings, and events were the third thing the officer named.
- **It invents an ordering the data doesn't have.** Events carry start times,
  grants carry an awarded date, pendings carry a submitted time: interleaving
  them asserts a single timeline that is true only by coincidence, and an orphan
  pending has no event to sit beside.
- **The explanation for granted points has nowhere to live.** Today a paragraph
  says those rows are the difference between attendance points and total; in a
  ledger it has to be repeated per row or dropped.
- **Upcoming events in a chronological list read as the future mixed into a
  statement of what happened.**

---

## For the lead

Both fix the measured problems: field and button on the first screen, no
sideways scroll for the attendance state, numbers before explanation, and a
legal definition list. **A** keeps the officer's order and gives pending,
dues and events each their own voice, at the cost of a long sheet. **B** is one
pattern learned once, at the cost of flattening that order and merging three
record types into a timeline the data doesn't really share.

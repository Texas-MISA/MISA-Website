---
version: 1
slug: "route-portal-lookup"
primary_target: "route:/portal/lookup"
related_targets: ["app/(public)/portal/lookup/page.tsx","app/(public)/portal/lookup/_components/lookup-form.tsx"]
---

# Surface brief: portal-lookup (`/portal/lookup`)

## Mode and lead
- **Mode:** Operate — a member on their phone, usually just after checking in,
  looking up their own standing for the term.
- **Lead skill:** `impeccable` (Operate mode, craft-floor).
- **Visual authority:** `DESIGN.md` — the established world. Never a replacement
  world, and never a regenerated `DESIGN.md`.

## Job and audience
Officer interview, 2026-09-19.
- **Who arrives:** a member, **on a phone, straight from check-in** — the
  "You're checked in" screen links here. They type one thing, their UT EID.
- **What they come for, in the officer's order:** their **points** (the total,
  and how attendance and bonus add up to it), their **dues status**, and
  **which events** they attended, missed or still have coming. Reassurance about
  a check-in still waiting on an officer was not named as a main draw, but it is
  the thing this page exists to make visible and it stays.
- **The anti-goal the officer named: it must not read as a different product
  from the rest of the portal** — the hub, check-in and the leaderboard, all
  approved today.

## Outcome and proof
- **Primary task:** enter an EID, read your own standing for the term.
- **The one thing it must never fail at:** never tell a member something untrue
  about their own record — a failed read must never read as "you have nothing",
  a pending check-in must be visible rather than silently missing, and every
  number must be scoped to the term it claims.
- **Measured 2026-09-19** (local dev server, a seed member with 1 pending
  check-in and 13 term events):

  | | 360×640 | 1280×800 |
  |---|---|---|
  | Hero ends | 310 | 331 |
  | EID field | 541–591 | 532–582 |
  | Look up button | **615–654 — cut by the fold**, 39px | 606–645 |
  | Result: the member's name | 517 | 508 |
  | Result: "Membership dues" | 1718 | 1501 |
  | Events table | **512px wide inside a 320px frame — the "You" column needs a sideways scroll** | fits (768px) |
  | Result page height | 2107 | 1817 |

- **Proof the lead proposes for the gate:** at 360×640 the EID field and the
  Look up button are both on the first screen (today the button is cut); on the
  result, **no horizontal scroll is needed to read whether you attended an
  event**; the member's own numbers are reachable without reading past
  explanation; and `npm run test:ui` passes, including the `definition-list`
  fault it catches on the result today.

## States
- **Idle** — one field (UT EID) and the button.
- **Submitting** — "Looking up…", disabled, `aria-busy`.
- **Invalid** — the field's own message.
- **Unmatched** — **one message for every miss**, in the neutral `info` tone: a
  miss is usually a typo or someone who has never checked in, not an error.
- **Rate limited** — caution banner, which says the limit is per network and can
  trigger on shared campus WiFi.
- **Error** — critical banner that says it is not a statement about their
  records.
- **Found**, which is many states at once:
  - the four numbers (total, from attendance, bonus, attendance rate), with the
    rate unavailable when no event has finished yet;
  - **pending check-ins: none, one, or several**, including an **orphan** with
    no event matched to it yet;
  - **events this term: none, or a table** of attended / missed / upcoming, with
    counts; 13 rows in the seed, more in a full term;
  - **points granted separately: absent, or a table** with reasons;
  - **dues: paid or not**, and **covered through a term, or no payment covering
    any term yet**;
  - a way back to look someone else up.
- Long values: event titles run long; a reason line is free text.

## Interaction and layout
- **May change (officer, 2026-09-19):** the hero and its subhead; the intro
  paragraph; the result's layout and the order of its parts; all result wording
  — the term note, the pending note, the events note, both dues sentences, the
  three banners and "Look up someone else". **Fixed:** what is looked up (the
  EID alone) and what the result contains.
- 🔴 **The stale sentence goes (officer: remove it).** "Both have to match the
  same member, which is why this shows more than the leaderboard does" has been
  false since the gate became the EID alone on 2026-08-25, and `tasks.md` has
  flagged it. Nothing replaces it: the officer chose removal over a privacy
  line. ⚠️ The same reversal has left a **code comment in the result arguing the
  opposite of the page's own header** — it says dues status is allowed *because*
  the gate is the EID alone. The build corrects the comment; it changes no
  behaviour.
- **Order follows what members come for:** points, dues, events. Pending
  check-ins keep a place where someone who just checked in will see them.
- **The result must not sit behind the form's explanation** — today the
  member's name starts at 517px on a phone because the hero and intro stay
  above it.
- **On a phone, whether you attended an event must be readable without
  scrolling sideways (EV2).** Today the four-column table is 512px inside a
  320px frame, and "You" — the column carrying attended / missed / upcoming —
  is the one off-screen. **The remedy is stacked rows below `sm`** — title, then
  when and points, with the state at the end — and the four-column table from
  `sm` up (EV3), rather than the scroll wrapper that hides the column today.
- **The pills never wrap (EV6):** the attendance pill and the dues pill stay
  whole on one line, and the event title beside them shrinks and wraps instead.
- **Headings stay sequential (EV10):** one h1 on the page, the member's name an
  h2 beneath it, each result section an h3. Re-ordering or dropping the intro
  must not promote a section or skip a level for a size.
- **The result is announced (EV7).** It replaces the form, and today nothing
  says so: the miss has `role="alert"`, but a found result is silent and focus
  is left where the button was. One always-mounted `role="status"` `aria-atomic`
  region announces it, and focus moves to the result's heading — the same answer
  check-in's brief gives, so the portal solves this once.
- **Attendance states stay words, not colour alone** (`Pill` affirm / neutral,
  and upcoming deliberately unframed: it is the absence of an outcome).
- **Consistency with the portal is the officer's anti-goal**, so this page's
  shape follows the hub's and check-in's short band unless a concept argues
  otherwise on the record.
- **Motion:** the result mounts after first paint, so it carries no
  `data-reveal`, ever.

## Constraints carried in
Behaviour does not change in a design phase. From CLAUDE.md's Invariants and
DESIGN.md, the ones this surface touches:
- 🔴 **"`/lookup`'s gate is the EID ALONE as of 2026-08-25 (officer), and dues
  status was KEPT."** A recorded reversal, not drift. **Still binding:** ONE
  query (never `lib/checkin.ts`'s ordered fallback), **one `unmatched` outcome
  and one message for every miss**, and its own throttle bucket
  (`hashClientIp("lookup")`).
- 🔴 **This is the only surface that shows dues status to an unauthenticated
  caller**, and it must never be carried anywhere reachable with less — the
  leaderboard most of all.
- **"Dues status is calculated, never ticked"** — an official member is a
  non-voided payment whose covered terms include the row's term.
- 🔓 **Robots:** noindex, per page, never on a portal layout.
- **"Server Components own date formatting"** — every string in the result
  arrives pre-formatted from `lib/lookup.ts`; `Intl` in this Client Component is
  a hydration diff. (Node and Chrome disagree on the space before "PM".)
- **"React 19 resets an uncontrolled `<form action={…}>`"** — the EID is echoed
  back as a string, never `undefined`.
- **"Never put `data-reveal` on a node that mounts after first paint."**
- **"A failed read must never render as an affirmative absence"** — the error
  banner says so in words.
- **`ground="white"` is a correctness control** (the input fills with Vellum),
  and **"`--misa-muted` may sit on Paper, never on Vellum"**: this page carries
  a lot of muted 12–14px explanation, all of it on white today, and any of it
  that moves onto the page ground fails AA. DESIGN.md counts **9 `misa-muted`
  occurrences here**, the most of any portal page.
- **The `definition-list` fault `npm run test:ui` catches on the result is
  this surface's to fix**: each stat's group puts a `<p>` note inside the
  `<dl>`'s `<div>` after its `<dt>`/`<dd>`, which a definition list does not
  allow.
- **"Every shared UI primitive lives in `components/ui/`"** — `Field`, `Input`,
  `Banner`, `Pill`, `Table` are shared with `/admin`; a lookup-only look is
  applied here, never by recolouring a primitive. 🪤 `Pill` is the only badge.
- **The honeypot stays** visually hidden, `aria-hidden`, `tabIndex={-1}`; the
  reset button stays a plain submit carrying `name`/`value`.
- **DESIGN.md:** the five grounds; the Rare Navy Rule; status tokens for
  feedback only; square structure; colour swaps as the only hover; tabular
  figures rather than monospace for numbers (monospace means a photograph
  caption in this system).
- **The repository is public:** every sample EID, name and event stays
  obviously fake.

## Diverge
`frontend-design` proposed two concepts (`receipts/diverge.output.md`); the lead
decided in `receipts/diverge.md`.
- **A — "The receipt": ADOPTED.** The portal's short navy band, then one white
  sheet read in the officer's order: name and term, the four numbers with the
  total largest, pending check-ins, dues, events, points granted separately.
  Estimated at 360×640: the field ≈238–288 and the button ≈304–352 (both on the
  first screen, against a button cut at 615–654 today), and the member's numbers
  at ≈300 instead of 517. Adopted because it keeps the officer's order with each
  part in its own voice and wears check-in's shape, which is the officer's named
  anti-goal answered. **Gate measurement: the sheet is long on a phone, so the
  order carries the weight.**
- **B — "One ledger": REJECTED.** Numbers compressed to a summary line with dues
  beside the name, then every event, pending check-in and grant merged into one
  chronological list. It flattens the officer's order, asserts a single timeline
  across three record types that only coincidentally share one, and leaves the
  explanation of granted points nowhere to live. Recorded for the officer.
- **Shared by both, and PROPOSED copy for the officer:** dues unpaid reads
  *"You're not paid up for Fall 2026 yet. Dues are worked out from payments
  we've matched to you — if you've paid recently, ask an officer rather than
  paying twice."*; the reset button reads *"Look up another EID"*; the band's
  one line reads *"Enter your UT EID to see where you stand this term."* The
  term note, pending note and events note keep today's sentences, which are
  accurate. **Dues is a status, not a verdict:** paid is an affirm pill, unpaid
  a neutral one — never critical.

## Evidence
Adopted lookups from `receipts/evidence.md` (raw output in
`receipts/evidence.output.md`); the rejected ones, including three misses, are
recorded there.
- **EV2** — horizontal scroll (ux, High). → On a phone the attendance state is
  readable without scrolling sideways.
- **EV3** — table handling (ux). → Stacked rows below `sm`, the table from `sm`.
- **EV6** — compact label overflow (ux, High). → Pills never wrap; the title
  beside them shrinks.
- **EV7** — one atomic status message (ux, High). → The found result is
  announced and takes focus.
- **EV10** — heading hierarchy (ux). → h1, then the name as h2, sections as h3.

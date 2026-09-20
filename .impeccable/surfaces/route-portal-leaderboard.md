---
version: 1
slug: "route-portal-leaderboard"
primary_target: "route:/portal/leaderboard"
related_targets: ["app/(public)/portal/leaderboard/page.tsx"]
---

# Surface brief: portal-leaderboard (`/portal/leaderboard`)

## Mode and lead
- **Mode:** Operate — members reading the current term's standings on a phone,
  and the same page projected at a general meeting and read across a room.
- **Lead skill:** `impeccable` (Operate mode, craft-floor).
- **Visual authority:** `DESIGN.md` — the established world. Never a replacement
  world, and never a regenerated `DESIGN.md`.

## Job and audience
Officer interview, 2026-09-19. The board has three audiences, and all three are
real:
- **Members watching the top** — who leads, and how close the race is.
- **Members finding themselves** — on a phone, looking for their own name and
  rank, usually somewhere in the middle. **No name filter** (officer): they
  scroll, or use the browser's find.
- **A meeting room** — **the page itself, as it is, projected** from a laptop
  (officer: no separate display view). It must read from across a room.

**What is at stake:** the **top 10 are recognised** at the end of the term, so
the top of the board carries real weight.

**Size:** **50–150 members** by the end of a term (officer), so the board runs
several phone screens.

## Outcome and proof
- **Primary tasks:** see who is in the top 10 and how close the race is; find
  your own rank; understand which term the board is counting.
- **The one thing it must never fail at:** the board must say what it actually
  knows — the right term, from the same row as the numbers; a failed read never
  shown as an empty board; ties never shown as an order they are not.
- **Measured 2026-09-19** (local dev server, the seed's 29 obviously fake
  members, 42px rows):

  | Viewport | Hero ends | First row | Rows in first screen | Name size |
  |---|---|---|---|---|
  | 360×640 | 310 | 392 | 5 of 29 | 14px |
  | 390×844 | 310 | 392 | 10 | 14px |
  | 1280×720 (projector) | 331 | 429 | **6** | **14px** |
  | 1280×800 | 331 | 429 | 8 | 14px |
  | 1920×1080 (projector) | 331 | 429 | 15 | **14px** |

  The table is 768px wide at desktop; the page is ~1900px tall with 29 rows,
  and would be ~6,500px with 150.

  ✅ **RE-MEASURED 2026-09-19 at the start of the build (part 0): every figure
  in this table holds.** Hero ends 309 / 330, first row 391 / 428, rows in the
  first screen **5 at 360×640, 6 at 1280×720, 15 at 1920×1080**, names 14px,
  rows 42px, table 768px at desktop and 305px at 360, page 1891px with 29 rows.
  Two numbers the build needs that were not recorded:
  - 📌 **The tenth row's bottom edge is at 851 at 1280×720.** So the gate bar is
    a **131px** claw-back, against concept A's estimated 174px of saving (677).
    That is the budget, stated as a number rather than a row count.
  - 📌 **The seed's rank ≤ 10 is exactly ten rows.** Verified against the view:
    totals 23, 19, 19, 18, 17, 17, 17, 17, 15, 15 then 14 — ranks 1, 2, 2, 4,
    5, 5, 5, 5, 9, 9, **11**. So the seed measures the bar honestly, and the
    boundary-tie case has to be constructed rather than observed.
  🔓 **The bar is TEN ROWS (settled 2026-09-19).** A boundary tie pushing an
  eleventh recognised row past the fold is a named, accepted overflow, recorded
  in this surface's receipt — not a bar failure. The board shows ranks as they
  are; what it may not do is renumber a tie to fit.
- **Proof the lead proposes for the gate:** at **1280×720 the whole top 10 is
  on the first screen** (today 6 rows), and the recognised places read from
  across a room — names well above today's 14px at desktop widths; at 360×640
  the top 3 at least are on the first screen (today 5 rows); every state below
  passes `npm run test:ui`.

## States
- **A normal board** — 50–150 rows, ties everywhere (the seed ranks
  1, 2, 2, 4, 5, 5, 5, 5, 9, 9, 11…), totals from 0 to the tens.
- **The top-10 boundary with a tie on it.** Ranking is standard competition
  (1, 2, 2, 4), so "the top 10" means **rank ≤ 10**, which can be more than ten
  rows when members tie at the edge. The design marks recognised places by
  rank, never by row count. (If the officer's prize rule counts differently,
  it is the officer's to say; the board shows ranks as they are.)
- **All zero** — early in a term everyone ties at 0, rank 1; the banner says
  that is expected ("everyone starts level").
- **Empty** — no rows: a new term before its first event, or a pin on a term
  nobody was part of. There is no term to name, so the heading says
  "Current-term standings" and never looks one up elsewhere.
- **Read failed** — `ReadError`, visibly different from empty.
- **A pinned, finished term** — an officer can pin the board on last term over a
  break; the term label must make that readable, not assumed to be today's.
- **Long names** — up to 120 characters; wrapping, not truncation, and never
  pushing the points column off a 360px screen.
- **Projected** — the same page at 1280×720 and 1920×1080, zoomed or not.

## Interaction and layout
- **May change (officer, 2026-09-19):** the page hero, including where the term
  label sits; the empty-state and banner wording; the lookup line under the
  board; how the table looks — rank styling, the top places, density. **Fixed:**
  the columns are rank, member, points; the term stays visible; nothing is
  added (no filter, no per-member detail, no avatars).
- **The top 10 earn a treatment, and it encodes information, not decoration:**
  recognised places. It may use navy, size, weight or a drawn cut line after
  rank 10 — **never a status colour**, which DESIGN.md reserves for feedback
  ("never a category colour").
- **The term label is part of the board's content**, not a hero flourish: it
  must stay visible wherever the hero goes, and it still comes off the rows.
- **Rows are not interactive** — no hover affordance on a row (DESIGN.md: no
  hover on anything not interactive).
- **The column head sticks, below the site header (EV3).** ⚠️ Measured: it does
  NOT stick today — `THead`'s `sticky` is opt-in and paired with `Table`'s
  `maxHeight`, the leaderboard opts out, and the page's own comment claiming a
  sticky head is stale (the build corrects it). On a 50–150 row board the
  Rank / Member / Points labels must survive the scroll, pinned under the 61px
  sticky site header rather than sliding beneath it.
- **Adopted concept A — the board is the page:** no navy hero; a white title
  row with *Leaderboard* and the term set large; one table; the recognised
  places (rank ≤ 10, once anyone has points) set larger, closed by a navy cut
  line; compact rows below. The larger sizes are DESIGN.md ramp steps — Card
  title 22 → 26px, Title 26 → 34px — never one-off values (EV6).
- **Names are never smaller than 16px on a phone** (today 14px) (EV5), and a
  long name **wraps**, never ellipsised or clamped, without pushing the points
  column off a 360px screen (EV10).
- **Motion:** the table currently fades in via `data-reveal`; with 150 rows and
  a projector, emil-design-eng decides whether it still should.

## Constraints carried in
Behaviour does not change in a design phase. From CLAUDE.md's Invariants and
DESIGN.md, the ones this surface touches:
- 🔓 **"`/leaderboard` is public but must never be indexed"** — `robots: {
  index: false, follow: false }` stays per page (never on a portal layout).
- **"No unauthenticated route returns an email or EID. The `leaderboard` view
  deliberately omits both."** Names against totals is the residual exposure; the
  page comment names a display-name field or opt-out as the escalation — the
  redesign adds no personal detail.
- **"The board's term label comes from the same row as its numbers
  (`leaderboard.term`). `/leaderboard` is `force-dynamic`"** — no
  `revalidatePath`, and 🪤 **"never add an `rpc("current_term")` fallback"** for
  the empty board.
- 🔓 **"A failed read must never render as an affirmative absence"** — `ReadError`
  and `EmptyState` stay two different things.
- **The view is the authority on order** (`order by total_points desc,
  full_name`); ranks are standard competition, computed once, never re-sorted in
  JavaScript.
- **`ground="white"` is a correctness control** — a sticky `THead` fills with
  Vellum (and this brief makes it sticky), as do `Tr`'s hover and the neutral
  `Banner`; and **"`--misa-muted` may sit on Paper, never on Vellum"**: the
  lookup line is muted ink on white today (4.84:1) and fails the moment it
  moves onto the page ground.
- **"Never put `data-reveal` on a node that mounts after first paint"** — the
  table is server-rendered, so a reveal is legal; whether it is wise is
  emil-design-eng's call.
- **"Every shared UI primitive lives in `components/ui/`"** — `Table`, `Th`,
  `Td`, `EmptyState`, `ReadError`, `Banner` are shared with `/admin`; a
  board-only look is applied at this page, never by recolouring a primitive.
- **DESIGN.md:** the five grounds; the Rare Navy Rule; status tokens for
  feedback only; square structure; colour swaps as the only hover; the
  layout-family budget.
- **The repository is public:** sample names are obviously fake, as the seed's
  are.

## Diverge
`frontend-design` proposed two concepts (`receipts/diverge.output.md`); the lead
decided in `receipts/diverge.md`.
- **A — "The board is the page": ADOPTED.** No navy hero: a white title row
  with the term set large, then one table — recognised places larger, a navy
  cut line after the last recognised rank, compact rows below. Estimated: the
  top 10 end ≈677 of 720 at 1280×720; rank 3 ends ≈333 at 360×640. It serves
  all three audiences in one ranking and reuses the light-ground primitives for
  every state. ✅ **The officer approved A as proposed on 2026-09-19 —
  including being the only public page without the navy hero** (chosen over
  keeping the hub's short band, which would cost the projector its full top
  10). **Gate measurement: a tie at rank 10 can push the last recognised row
  past the fold at 1280×720.**
- **B — "The honours board": REJECTED.** The top 10 in white on the navy field
  hero, the rest in a table below. The stronger picture of the top, but it
  splits one ranking into two structures, makes every member finding their own
  row scroll past a screen of navy first, and needs on-navy variants of the
  error and empty primitives that don't exist. Recorded for the officer.
- **Shared by both, with copy ✅ APPROVED by the officer on 2026-09-19 (both
  lines):** recognised places are
  marked by rank (rank ≤ 10, ties share) and only once someone has points; the
  rank is printed on every row; the all-zero banner reads *"Nobody has points
  yet this term, so everyone is tied at zero. Totals appear after the first
  event."*; the lookup line reads *"Want to see how your total adds up? Look up
  your attendance."*

## Evidence
Adopted lookups from `receipts/evidence.md` (raw output in
`receipts/evidence.output.md`); the rejected ones, and the one miss, are
recorded there.
- **EV3** — sticky navigation must not obscure content (ux). → The column head
  sticks below the site header, never under it.
- **EV5** — readable font size, 16px minimum on mobile (ux, High). → No name on
  the board below 16px on a phone (today 14px).
- **EV6** — a consistent modular scale (ux). → The recognised places' sizes are
  DESIGN.md ramp steps, not one-offs.
- **EV10** — essential text is never truncated (ux, Critical). → Long names
  wrap; never an ellipsis.

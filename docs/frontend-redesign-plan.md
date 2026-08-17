# Frontend redesign — plan (v1, SUPERSEDED)

> ⛔ **SUPERSEDED by [`frontend-redesign-v2-plan.md`](frontend-redesign-v2-plan.md)
> on 2026-08-17. Do not build from this document.**
>
> v1 was planned here, built, and **scrapped**. It survives on the abandoned
> branch `redesign-stage-1` (tip `60ca71d`); `main` was never touched. The
> officer rejected it as bland, lacking depth, with image slots concentrated
> into a single section and a scattered, same-ey layout.
>
> 📌 **Kept for its reasoning, not its decisions.** The analysis below of what
> the site is and what the no-photography constraint does to it is still good,
> and the v2 plan builds on it. But its decision table is substantially
> reversed: type is open, the frozen four are full redesigns, image slots go in
> every section rather than one, `DESIGN.md` is retired rather than replaced at
> the end, and the direction is taken from `design-taste-frontend` rather than
> from a concept roll.
>
> ⚠️ **The lesson worth carrying forward** is that v1's failure was process, not
> taste: it treated the installed design skills as advisory and hand-rolled
> everything, against §2's *"do not invent CSS for things that have an official
> package."*

**Original status line: NOT STARTED.** Written 2026-08-17; scope widened and then
narrowed with the officer the same day.

A complete redesign of the public site — its design **and** its information
architecture. The data layer is untouched.

---

## Why this exists, and what it is not

The 2026-08-17 work (doc v1.67) was asked for as "a comprehensive rework… just
visuals" and delivered **refinement**: one design system, applied consistently to
every surface, with `/admin`'s three dialects collapsed into it. That is not being
undone — `components/ui/` is a vocabulary rather than a look, so it can be
re-skinned wholesale, which is what makes this job tractable at all.

But refinement preserves the incumbent design and a redesign replaces it. This is
the second job. In `impeccable`'s vocabulary the last one was `polish`/`extract`;
this one is **`new-work`**.

🔓 **Amend `CLAUDE.md`'s *Design skill precedence* rule in the first commit.** It
currently puts `new-work.md` out of scope site-wide — written when `DESIGN.md` had
just become the only complete record of the system. Reverse it deliberately.
`DESIGN.md` is **replaced** at the end of this work, not edited.

---

## Decisions taken (2026-08-17)

| # | Question | Answer |
|---|---|---|
| 1 | Typography | **Keep Barlow + Barlow Condensed.** The pairing is an identity anchor alongside the navy. |
| 2 | Register | **Keep it — institutional, unhurried, confident.** Continuity of tone, discontinuity of form. |
| 3 | Chevron hero | **Open to replacement.** The direction phase proposes what opens a page; the chevron may survive, mutate or go. |
| 4 | Absent imagery | **Rework the convention.** Keep the principle — absence stated honestly, every slot stays a slot — but the device itself is open. |
| 5 | Navigation | **Direction phase decides**, as part of the stage-1 proposal. Hard constraint below. |
| 6 | New pages | **Join / Get involved** and **Upcoming events**. Nothing else. |
| 7 | The frozen four | **They inherit the new skin.** Behaviour and markup frozen; tokens and primitives updated. One website. |
| 8 | `/contact` | **Leave as-is** — routed, reachable, absent from the desktop nav, present in the mobile sheet. |

📌 **Considered and NOT selected**, recorded so they are not re-proposed each
session: a *How points work* page, a *Partner with us / Sponsorship* page, a
*Recruitment / Junior Directors* page, a *Teams / committees* page, and promoting
the FAQ to its own page. All remain defensible; none is in this scope.

---

## What that leaves — the actual brief

The palette is fixed. The type is fixed. The register is fixed. **So the design
has to be carried by structure**, and that is a sharper brief than "redesign the
site":

- how a page opens, and whether every page opens the same way
- the composition system — grid, asymmetry, containment, full-bleed
- section rhythm and density
- hierarchy: what is loud, what is quiet, and what carries a page with no images
- the shape and weight of every component
- how content is ordered and grouped, page by page
- motion

⚠️ **This rules out a whole class of candidate.** Directions that differ only in
ornament — a new accent, a different font, a texture — will look nearly identical
here, because the three levers they rely on are all locked. A candidate is only
genuinely different if it *composes* differently. Say so during `new-work`, and
reject candidates that pass the test only on colour or type.

📌 The upside: this is a brief with a real constraint in it, which is a better
starting point than a blank page. The current site is one answer to it — flat,
generous, banded, centred. It is not the only one.

---

## The contract

### Frozen — behaviour

**No route, Server Action, query, migration, view or schema change anywhere.**
Check-in resolution, the points ledger, dues, attendance review and officer
invites are untouched. `/attend`, `/leaderboard`, `/lookup` and `/admin` keep
their behaviour and their markup exactly; per decision 7 they pick up the new
tokens and re-skinned primitives and nothing else.

### In play

The design and the information architecture of the public marketing pages, plus
the two new surfaces in decision 6.

### Fixed regardless

- **Existing copy stays in `lib/site.ts` / `lib/officers.ts`** and is never
  hardcoded into a page. Existing strings may be re-*placed* in the IA, not
  rewritten.
- **📌 No photography.** See below.
- **The load-bearing traps**, which are engineering rather than taste: Tailwind
  cascade layers, `reveal.tsx` staying server-safe, the `html.js` scoping,
  `--marquee-shift` in pixels, `/leaderboard`'s `force-dynamic` + noindex,
  `/lookup`'s noindex. See `docs/invariants.md`.

---

## 🪤 The navigation constraint

Adding Join and Upcoming events takes the left group from five items to seven,
against a right group of two links and a button. **Five is the measured
ceiling today**, because the wordmark is absolutely centred and wins the z-order:
a sixth item does not wrap or overflow, it *disappears behind the logo*, and
nothing fails. Measured at 1280: 285px clearance left, 312px right.

Per decision 5 the header is a stage-1 design problem rather than a stage-5
fix-up. Two hard requirements on whatever is proposed:

1. **The failure mode must stop being silent.** Whether that comes from moving
   the wordmark off-centre, a different nav pattern, or a layout that cannot
   overlap by construction, the outcome to reach is that nobody has to remember
   to re-measure.
2. **If the centred wordmark survives, re-measure at 1280 and at a wide viewport
   in the same commit**, and record the numbers as the current ones are recorded.

---

## The central design problem

**The site publishes no photography, and it will not on this timeline.** Eighteen
gallery slots, four activity rows, three project cards, thirteen officer
headshots and the About cluster are all captioned placeholders.

That is not a gap to design around — it *is* the brief. Every one of these skills
will propose hero imagery; the answer is no, every time, and a direction that
merely rearranges hatched boxes has not engaged with the problem.

Per decision 4 the device is open but the principle is not:

- **Absence is stated, never disguised.** No stock imagery, no generated imagery,
  no gradient standing in for a photo, no decorative shape pretending to be one.
- **Every image slot stays a slot**, so photography arriving later is a swap —
  add the file, give the slot a `src`, replace the placeholder element. That
  property is why `public/photos/` can be restored without touching a page, and
  it is not being given up.
- The current answer ("The Drawing Set" — the hatch as poché, meaning
  *specified, not yet built*) is a good one and sets the bar. A replacement must
  be at least as honest and at least as deliberate.

🪤 When photography does return, framed slots must be sized with `next/image`'s
`fill`; an intrinsically sized image makes the frame grow to the photo's height
and leaves a void beside the shorter column. The gallery masonry is the one place
that wants intrinsic heights. The duotone treatment spec lives only in the design
handoff's README.

---

## The two new pages

### Join / Get involved

**Needs real copy from an officer before it ships.** Membership, dues and what to
expect are currently explained only inside an accordion on `/about`, even though
`/attend` and the dues system are live. Existing material that can be re-placed
here: the relevant `FAQ` entries and the dues wording. What must come from an
officer: what actually happens when somebody turns up, and what membership costs
and includes, stated plainly.

### Upcoming events

**Needs no new copy** — `app/(public)/_components/upcoming-events.tsx` is already
built and unmounted, and the `events` table and `/admin/events` are live.

🪤 **Remounting it must restore `export const dynamic = "force-dynamic"` on the
page that renders it.** The read touches `cookies()` via `createClient()`, and a
build-time snapshot serves a stale schedule *while looking completely fine* —
which is why the directive was removed alongside the component and why the
comment left in its place says so. Design the empty state deliberately: a term
with no published events yet is a real and frequent state.

---

## 🔴 The rule that governs new content

**No new page may invent a fact about the club.**

`PRODUCT.md` is explicit that testimonials, member counts, placement statistics,
awards and press **do not exist and must not be fabricated**. The same applies to
alumni outcomes, partnerships beyond the four in `PARTNERS`, and anything with a
number in it.

So: propose, **get the real copy**, then build. A page with invented placeholder
prose is worse than no page — it is a liability on a public site that corporate
partners read. If the copy does not arrive, the page does not ship, and that is a
normal outcome rather than a failure.

⚠️ This is the single most likely way this work goes wrong. All four skills will
happily generate plausible-sounding club copy to fill a layout. Of the two
approved pages, only Join is exposed to it.

---

## Process

Per `docs/install-ui-skills.md` and the skills' own guidance.

1. **`/impeccable init` is already done** — `PRODUCT.md` holds the audience, the
   voice and the refusals. Re-read it; do not re-run it.
2. **Settle the IA first**: the page set is decided (decision 6), so what remains
   is what each page is *for* and what moves between them. Do this before
   choosing a direction — a direction chosen against the wrong page set has to be
   chosen twice.
3. **`/impeccable shape`, then `new-work.md`**: derive candidate composition
   systems for the audience `PRODUCT.md` names — a UT business/tech student
   deciding whether to walk into a room, with corporate partners reading
   `/projects` and `/about` over their shoulder. Roll `concept-seed.mjs`, fuse the
   challengers, write verdicts, present candidates on the served decision page.
   **The officer picks — not the agent.** Reject any candidate that differs only
   in ornament, per the brief above.
4. **Stage 1 builds the header and the home page end to end**, then stops for
   review. A composition system that works as a card can still fail at full
   height, and the nav is the riskiest single element.
5. **`emil-design-eng` owns every motion decision**, as it does today.
6. **`web-design-guidelines` before ship.** Accessibility findings override
   aesthetic preference on conflict.
7. **Replace `DESIGN.md`** from the built result, then re-sync
   `.impeccable/design.json`.

📌 **Re-skin the shelf, don't abandon it.** `Section`, `Field`, `Table`,
`Banner`, `Pill`, `Panel`, `Button`, `Heading` should survive with new skins —
decision 7 depends on it, since it is how the frozen four inherit the redesign
without their markup being touched. If the direction genuinely needs different
primitives, replace them *there* rather than going back to per-page class
strings; that regression is what v1.67 existed to undo.

---

## Build order

| Stage | Surface |
|---|---|
| 1 | **Direction + header/nav + home page.** The proof. Nothing else starts until this is accepted. |
| 2 | `/about`, `/projects` — content-heaviest, and where the KPI plate and FAQ patterns live |
| 3 | `/gallery`, `/officers` — most image-dependent, so the hardest test of decision 4 |
| 4 | **Upcoming events** (no copy needed), then **Join** when its copy arrives |
| 5 | Footer, `/contact`, and the public error and not-found boundaries |
| 6 | The frozen four inherit tokens and primitives — no markup or behaviour changes |

---

## What must not regress

Acceptance criteria, not afterthoughts — each is a defect this codebase has
already shipped once:

- Zero horizontal overflow at 390px (`scrollWidth − clientWidth === 0`).
- Content fully visible with JavaScript disabled.
- No `data-reveal` on any node that mounts after first paint.
- Every interactive element has a visible focus ring; white inside `.on-navy`.
- Text ≥ 4.5:1 **on the ground it actually sits on** — measured per pairing, not
  per palette.
- No nav item can overflow silently; if the wordmark stays centred, the
  clearance numbers are re-measured and recorded.
- The marquee, if it survives, verified numerically rather than by watching it.
- Empty states and error states stay visually distinct.
- Both new routes are added to §5's route table — `tests/docs.test.ts` fails
  otherwise, by design.
- `npm run lint`, `tsc --noEmit`, `npm run build` and the full suite clean.

## Documentation duties

Replace `DESIGN.md`; amend the precedence rule in `CLAUDE.md`; add both new routes
to §5 and §10; update `docs/invariants.md` for any invariant the redesign
genuinely retires — the chevron hero and the hatch device are both candidates, and
each needs its replacement argued rather than merely swapped; bump the
architecture doc's version; record the outcome in `docs/build-log.md` and
`tasks.md`.

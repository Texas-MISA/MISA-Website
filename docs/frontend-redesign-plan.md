# Frontend redesign — plan

**Status: NOT STARTED.** Written 2026-08-17, scope widened the same day.
Nothing here is built.

A complete redesign of the public site: how it presents itself **and what it is
made of**. New pages and features are in scope. The data layer is not.

---

## Why this exists, and what it is not

The 2026-08-17 work (doc v1.67) was asked for as "a comprehensive rework… just
visuals" and delivered **refinement**: one design system, applied consistently to
every surface, with `/admin`'s three dialects collapsed into it. That was worth
doing and is not being undone — `components/ui/` is a vocabulary rather than a
look, so it can be re-skinned wholesale, which is what makes this job tractable.

But refinement preserves the incumbent design and a redesign replaces it. This is
the second job. In `impeccable`'s vocabulary the last one was `polish`/`extract`;
this one is **`new-work`**.

🔓 **This requires amending `CLAUDE.md`'s *Design skill precedence* rule**, which
currently puts `new-work.md` out of scope site-wide — written when `DESIGN.md`
had just become the only complete record of the system. Amend it in the first
commit, deliberately. `DESIGN.md` is **replaced** at the end of this work, not
edited.

---

## The contract

### Frozen — the database half

**`/attend`, `/leaderboard`, `/lookup` and `/admin` keep their behaviour
exactly.** No route, Server Action, query, migration, view or schema change
anywhere in the application. Check-in resolution, the points ledger, dues,
attendance review and officer invites are all untouched.

⚠️ **One decision this raises.** If the marketing site takes a new identity and
these four do not, the site splits visually in two — the exact defect v1.67 just
spent 121 files closing. **Recommendation: freeze their function and markup, but
let them inherit the new tokens and re-skinned primitives**, so they stay the
same product. Confirm before stage 1 ships.

### In play

- **The design** of the public site: layout paradigm, composition, rhythm,
  hierarchy, type scale and possibly type family, the chevron hero, the marquee,
  every component's shape, and motion.
- **The information architecture.** Pages may be added, split, merged or
  retired. The current five-page shape is not a given.
- **The palette, mostly.** Navy `#16305c` and white stay the identity; the
  graphite ramp and the three status inks stay. "Mostly" is the licence: a
  redesign may re-*proportion* navy and may add at most one supporting value if
  it argues for it in the new `DESIGN.md`.
- **📌 No photography.** Non-negotiable — and see below, it is the brief rather
  than a constraint on it.

### Fixed regardless

- **Existing copy stays in `lib/site.ts` / `lib/officers.ts`** and is never
  hardcoded into a page. Existing strings may be re-*placed* in the IA, not
  rewritten.
- **The load-bearing traps**, which are engineering rather than taste: Tailwind
  cascade layers, `reveal.tsx` staying server-safe, the `html.js` scoping,
  `--marquee-shift` in pixels, `/leaderboard`'s `force-dynamic` + noindex,
  `/lookup`'s noindex. See `docs/invariants.md`.

### Decisions the officer owns, before direction work starts

1. **Do the fonts change?** "Keep the colour scheme" was said; the Barlow pair
   was not mentioned. It is the single biggest lever available.
2. **Does the chevron hero survive?** It predates the handoff, carries over from
   the old live site, and opens all eight hero'd pages. Most recognisable
   element; also the most limiting.
3. **How far may the hatch convention move?**
4. **Do the four frozen pages inherit the new skin?** (Recommendation above.)

---

## 🔴 The rule that governs new pages

**No new page may invent a fact about the club.**

`PRODUCT.md` is explicit that testimonials, member counts, placement statistics,
awards and press **do not exist and must not be fabricated**. The same applies to
alumni outcomes, company partnerships beyond the four in `PARTNERS`, event
schedules, and anything with a number in it.

So the sequence for any new surface is:

1. Propose it, with the evidence in existing content that implies it.
2. **Get the real copy from an officer.**
3. Build it.

A new page with invented placeholder prose is worse than no page — it is a
liability on a public site that corporate partners read. If the copy does not
arrive, the page does not ship, and that is a normal outcome rather than a
failure.

⚠️ This is the single most likely way this work goes wrong. All four skills will
happily generate plausible-sounding club copy.

---

## The central design problem

**The site publishes no photography, and it will not on this timeline.** Eighteen
gallery slots, four activity rows, three project cards, thirteen officer
headshots and the About cluster are all captioned placeholders.

That is not a gap to design around — it *is* the brief. Every one of these skills
will propose hero imagery; the answer is no, every time, and a direction that
merely rearranges hatched boxes has not engaged with the problem.

The current answer ("The Drawing Set" — the hatch as poché, meaning *specified,
not yet built*) is a good one and sets the bar. A replacement must be at least as
honest and at least as deliberate. Worth exploring:

- **Type as the image** — let typography carry the page and drop image slots
  rather than filling them with anything.
- **Structure as the image** — rules, plates, indices, contents pages; the site
  as a document rather than a brochure.
- **A different metaphor for absence** that is not hatching.

⚠️ Whatever wins must survive photography arriving later: every image slot stays
a slot, so a real photo is a swap and not a re-layout. That property is why
`public/photos/` can be restored without touching a page, and it should not be
given up.

---

## Candidate new surfaces

Each is *inferred from existing content*, listed with what implies it. **None is
approved; all need officer copy.** This is a menu for the IA phase, not a backlog.

| Candidate | Inferred from | Notes |
|---|---|---|
| **Join / Get involved** | FAQ carries "who can become a member", dues, dress code; `/attend` and dues exist but nothing publicly explains membership | The strongest candidate. Currently the answer is scattered across an About accordion. |
| **How points work** | The whole attendance/points/leaderboard system is built and publicly linked, and nothing explains it | Content-only; explains an existing system without touching it. Would make `/leaderboard` and `/lookup` legible. |
| **Partner with us / Sponsorship** | Four `PARTNERS`, a dedicated `CORPORATE_EMAIL`, and `WORK_WITH_MISA` copy already aimed at companies | `PRODUCT.md` names corporate partners as a real readership. Currently a band on `/projects`. |
| **Upcoming events** | `_components/upcoming-events.tsx` is **built and unmounted**; `events` table and `/admin/events` are live | 🪤 Remounting restores `export const dynamic = "force-dynamic"` — the read touches `cookies()`, and a build-time snapshot shows a stale schedule while looking fine. No new DB work; it is a component that already exists. |
| **Recruitment / Junior Directors** | `/officers` copy already states applications reopen Fall 2026 | Seasonal. Needs a plan for the closed state, not just the open one. |
| **Teams / committees** | `PROJECT_STATS` counts "3 Data teams / 3 Client teams" | Thin unless officers supply real structure. |
| **FAQ as its own page** | Six entries currently living as a band on `/about` | An IA move rather than new content — no new copy needed. |

📌 **Retiring is as legitimate as adding.** `/contact` is already routed but
unlinked from the desktop nav; a redesign should decide whether it returns or
goes.

🪤 **Any nav change re-opens the wordmark clearance measurement.** The header
centres the wordmark absolutely and it wins the z-order, so an overflowing item
*disappears silently* rather than wrapping. Five items fit today (measured: 285px
clearance left at 1280, 312px right). More than five almost certainly means a
different navigation pattern, not a tighter one — treat that as a design problem
in stage 1, not a fix-up in stage 5.

---

## Process

Per `docs/install-ui-skills.md` and the skills' own guidance.

1. **`/impeccable init` is already done** — `PRODUCT.md` holds the audience, the
   voice and the refusals. Re-read it; do not re-run it.
2. **IA first, then direction.** Decide what pages exist and what each is for
   before choosing a visual world — a direction chosen against the wrong page set
   has to be re-chosen.
3. **`/impeccable shape`, then `new-work.md`:** derive candidate visual worlds
   from the audience's culture (a UT business/tech student deciding whether to
   walk into a room), roll `concept-seed.mjs`, fuse the challengers, write
   verdicts, present candidates on the served decision page. **The officer picks
   the direction — not the agent.**
4. **Build the home page end to end and review it** before anything else. A
   direction that works as a card can still fail at full height.
5. **`emil-design-eng` owns every motion decision**, as it does today.
6. **`web-design-guidelines` before ship.** Accessibility findings override
   aesthetic preference on conflict.
7. **Replace `DESIGN.md`** from the built result, then re-sync
   `.impeccable/design.json`.

📌 **Re-skin the shelf, don't abandon it.** `Section`, `Field`, `Table`,
`Banner`, `Pill`, `Panel`, `Button`, `Heading` should survive with new skins. If
the direction genuinely needs different primitives, replace them *there* rather
than going back to per-page class strings — that regression is what v1.67 existed
to undo.

---

## Scope, in build order

| Stage | Surface |
|---|---|
| 1 | **IA decision + direction + home page.** The proof. Nothing else starts until this is accepted. Includes the navigation pattern. |
| 2 | `/about`, `/projects` — the content-heaviest pages, and where the KPI plate and FAQ patterns live |
| 3 | `/gallery`, `/officers` — the most image-dependent, so the hardest test of the absent-imagery answer |
| 4 | Approved **new** pages, in the order their copy arrives |
| 5 | Header, footer, error and not-found boundaries; re-measure nav clearance |
| 6 | The four frozen surfaces inherit tokens only — **if** decision 4 says so |

**`/admin` is out of scope beyond inheriting tokens.** It was just converted,
officers are not the audience, and `PRODUCT.md` names the prospective student as
the tiebreaker.

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
- The marquee, if it survives, verified numerically rather than by watching it.
- Empty states and error states stay visually distinct.
- Any new public route is added to §5's route table — `tests/docs.test.ts` fails
  otherwise, by design.
- `npm run lint`, `tsc --noEmit`, `npm run build` and the full suite clean.

## Documentation duties

Replace `DESIGN.md`; amend the precedence rule in `CLAUDE.md`; add every new
route to §5 and §10; update `docs/invariants.md` for any invariant the redesign
genuinely retires; bump the architecture doc's version with the reasoning; record
the outcome in `docs/build-log.md` and `tasks.md`.

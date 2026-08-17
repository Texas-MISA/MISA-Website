# Frontend redesign — plan

**Status: NOT STARTED.** Written 2026-08-17. Nothing here is built.

A complete redesign of how the public site *presents* itself. Same content, same
routes, same behaviour — a different design.

---

## Why this exists, and what it is not

The 2026-08-17 work (doc v1.67) was asked for as "a comprehensive rework… just
visuals" and delivered **refinement**: one design system, applied consistently
to every surface, with `/admin`'s three dialects collapsed into it. That was
worth doing and is not being undone — the component shelf in `components/ui/` is
what makes *this* job tractable.

But refinement preserves the incumbent look, and a redesign replaces it. This
document is the second job. In `impeccable`'s vocabulary the last one was
`polish`/`extract`; this one is **`new-work`**.

🔓 **This requires amending `CLAUDE.md`'s *Design skill precedence* rule**, which
currently puts `new-work.md` out of scope for the whole site — written when
`DESIGN.md` had just become the only complete record of the system. Amend it in
the first commit of this work, deliberately, rather than quietly ignoring it.
`DESIGN.md` is **replaced** at the end of this work, not edited.

---

## The contract

### Fixed — not up for redesign

- **Content.** Every string stays in `lib/site.ts` / `lib/officers.ts` and nothing
  is invented, dropped or reworded. The home page still carries the mission, the
  activities, the projects and the partners; `/about` still carries the history,
  the KPIs and the FAQ. What changes is how they are *presented*.
- **Behaviour.** No route, Server Action, query, migration or schema change. If a
  page needs data it does not have, the answer is a different design.
- **The palette, mostly.** Navy `#16305c` and white stay the identity. The
  graphite text ramp and the three status inks stay. "Mostly" is the licence: a
  redesign may re-*proportion* navy, and may add at most one supporting value if
  it argues for it in the new `DESIGN.md`.
- **📌 No photography.** Non-negotiable, and see below — it is the brief, not a
  constraint on it.
- **The load-bearing traps**, which are engineering rather than taste:
  Tailwind cascade layers, `reveal.tsx` staying server-safe, the `html.js`
  scoping, the nav wordmark clearance measurement, `--marquee-shift` in pixels,
  `/leaderboard`'s `force-dynamic` + noindex. See `docs/invariants.md`.

### In play

Everything else: layout paradigm, composition, section rhythm, hierarchy, type
scale and possibly type *family*, the chevron hero, the marquee, the shape of
every component, motion, and the treatment of absent imagery.

### Decisions the officer must make before direction work starts

1. **Do the fonts change?** "Keep the colour scheme" was said; the Barlow pair
   was not mentioned. Changing it is the single biggest lever available.
2. **Does the chevron hero survive?** It predates the handoff, carries over from
   the old live site, and currently opens all eight hero'd pages. It is the most
   recognisable thing on the site and the most limiting.
3. **How far may the hatch convention move?** See below.

---

## The central design problem

**The site publishes no photography, and it never will on this timeline.**
Eighteen gallery slots, four activity rows, three project cards, thirteen officer
headshots and the About cluster are all captioned placeholders.

That is not a gap to design around — it *is* the brief. Every one of these skills
will propose hero imagery; the answer is no, every time, and a redesign that
merely rearranges hatched boxes has not engaged with the problem.

The current answer ("The Drawing Set" — the hatch as poché, meaning *specified,
not yet built*) is a good one and sets the bar. A replacement must be at least as
honest and at least as deliberate. Directions worth exploring:

- **Type as the image.** Let the typography carry the page and drop the image
  slots entirely rather than filling them with anything.
- **Structure as the image.** Rules, plates, indices, tables of contents — the
  page as a document rather than a brochure.
- **Own the absence differently.** A different metaphor for "not yet
  photographed" that is not hatching.

⚠️ Whatever wins must survive photography arriving later. Every image slot should
remain a slot, so a real photo is a swap and not a re-layout — the same property
the current `<Hatch>` has, and the reason `public/photos/` can be restored
without touching a page.

---

## Process

Per `docs/install-ui-skills.md` and the skills' own guidance.

1. **`/impeccable init`** is already done — `PRODUCT.md` holds the audience, the
   voice, and the refusals. Re-read it; do not re-run it.
2. **`/impeccable shape`**, then **`new-work.md`**: derive candidate visual
   worlds from the audience's culture (a UT business/tech student deciding
   whether to walk into a room), roll `concept-seed.mjs` for direction, fuse the
   challengers, write verdicts, and present the candidates on the served decision
   page. **The officer picks the direction — not the agent.**
3. **Build one page end to end first** (the home page) and review it before the
   other four. A direction that looks right as a card can still fail at full
   height.
4. **`emil-design-eng` owns every motion decision**, as it does today.
5. **`web-design-guidelines` before ship.** Its accessibility findings override
   aesthetic preference on conflict.
6. **Replace `DESIGN.md`** from the built result, then re-sync
   `.impeccable/design.json`.

📌 **Reuse the shelf, restyle it.** `components/ui/` is a vocabulary, not a look —
`Section`, `Field`, `Table`, `Banner`, `Pill`, `Panel`, `Button` should survive
the redesign with new skins. If the new direction genuinely needs different
primitives, replace them there rather than going back to per-page class strings.

---

## Scope, in build order

| Stage | Surface | Note |
|---|---|---|
| 1 | Direction + home page | The proof. Nothing else starts until this is accepted. |
| 2 | `/about`, `/projects` | The two content-heaviest pages, and where the KPI plate and FAQ patterns live. |
| 3 | `/gallery`, `/officers` | The two most image-dependent, so the hardest test of the absent-imagery answer. |
| 4 | `/attend`, `/lookup`, `/leaderboard`, `/contact`, `/officer-invite` | Member-facing. Function is fixed; only skin changes. |
| 5 | Header, footer, error and not-found boundaries | Last, because the nav's wordmark clearance must be re-measured against whatever the header becomes. |

**`/admin` is out of scope.** It was just converted, officers are not the
audience for a redesign, and `PRODUCT.md` names the prospective student as the
tiebreaker. It inherits new tokens only.

---

## What must not regress

Carry these forward as acceptance criteria, not afterthoughts — each is a defect
this codebase has already shipped once:

- Zero horizontal overflow at 390px (`scrollWidth − clientWidth === 0`).
- Content fully visible with JavaScript disabled.
- No `data-reveal` on any node that mounts after first paint.
- Every interactive element has a visible focus ring; white inside `.on-navy`.
- Text ≥ 4.5:1 on the ground it actually sits on — measured per pairing, not
  per palette.
- The marquee (if it survives) verified numerically, never by watching it.
- Empty states and error states remain visually distinct.
- `npm run lint`, `tsc --noEmit`, `npm run build` and the full suite clean.

## Documentation duties

Replace `DESIGN.md`; amend the precedence rule in `CLAUDE.md`; update
`docs/invariants.md` for any invariant the redesign genuinely retires; bump the
architecture doc's version with the reasoning; record the outcome in
`docs/build-log.md` and `tasks.md`.

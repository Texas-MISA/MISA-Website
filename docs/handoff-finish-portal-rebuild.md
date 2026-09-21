# Hand-off: finish the Portal Rebuild (v2 phase 3, parts 4–7)

> 🗑️ **SUPERSEDED 2026-09-20 by
> [`handoff-portal-rebuild-rounds-4-7.md`](handoff-portal-rebuild-rounds-4-7.md).
> Do not run this file.** A session ran it and completed its rounds 1–3: the
> three shared primitives, the officer copy rule on the frozen pair (which
> correctly found nothing to delete), and the re-gates of `portal-hub` and
> `portal-attend`. Parts 4–7 remain, and the new file carries them with the
> corrected numbers, the defect classes those rounds uncovered, and the context
> discipline an orchestrator needs to finish without running out of room.
>
> **Kept for its reasoning**, which the new file does not repeat in full: the
> officer's DELETE/KEEP copy lists and what they supersede, and the original
> per-round scopes. Where this file and the new one disagree, **the new one
> wins** — several of this file's numbers were re-derived and moved.
>
> ⚠️ **Specifically stale here:** the bar figures (`607.7` is the desktop-window
> reading, not a true phone 360; the hub's `265.5` does not reproduce and is
> `267.2`), the state line below, and rounds 1–3, which are done.

---

> **This file is a PROMPT.** Copy everything below the rule into a new Claude
> Code session. It is written to be read cold — it names its own reading list,
> its scope, its traps and its stopping condition.
>
> Written 2026-09-20, at the end of the session that built parts 0–3. State at
> that moment: branch `design-toolkit` at `23d0e33`, `portal-hub` and
> `portal-attend` `rebuilt`, `npm test` 41 files / 1142 green, `npm run test:ui`
> 41 pass / 1 fail.

---

Finish the Portal Rebuild (v2 phase 3) in `C:\MISA-Website`, on branch
`design-toolkit`. Parts 0–3 are done; `portal-hub` and `portal-attend` are
`rebuilt`. You are finishing parts 4–7 **and** applying one new officer rule
across all four surfaces.

**You are an ORCHESTRATOR. Do not build any of this yourself.** Run the setup
and the between-round verification; delegate each round to a subagent. The
reason is context, not capability: the session that built parts 0–3 ran out of
room, and the work below is four times that size.

## READ FIRST, in this order

1. `docs/frontend-redesign-v2-plan.md` § "Phase 3 brief — the Portal Rebuild",
   starting with 🔴 "THE PORTAL HAS NO NAVY HEADER" and then 🧭 "Where the build
   stands". Per-part state with commits, the fixed order, and the five things
   parts 4–5 inherit.
2. `DESIGN.md` — the visual authority, never regenerated. §Components has
   `PortalSheet` and the rules part 3 produced; §The ramp; §Grounds.
3. The brief for whichever surface a round touches, at
   `.impeccable/surfaces/route-portal*.md`. **Each opens with a 🔴 OFFICER
   OVERRIDE block — that block wins over everything below it in the same file.**
4. `tasks.md` § the `--misa-muted` AA contrast failures, and § "Deferred out of
   the portal-attend gate".

## HOW TO RUN THIS

**One subagent per round, strictly sequential. Never two at once.** Three
reasons, all learned: two agents driving Chrome wedge the renderer (this cost an
hour); two agents committing to one branch fight over `index.lock`; and both
share one dev server and one local Supabase stack.

Give each subagent: its round's scope verbatim from below, the READ FIRST list,
the TRAPS section, and this contract —

> Report back: (1) every file you changed; (2) every commit you made, as full
> SHAs from `git rev-parse`; (3) the measured numbers against your round's bar,
> and how you measured them; (4) `node scripts/design/receipts.mjs <surface>`
> output; (5) `npm test` and `npm run test:ui` results; (6) anything you did NOT
> do and why. If you are blocked, say so and stop — do not invent a way around a
> checker.

A subagent may spawn the `design-reviewer` agent for its gate's step 5. **While
it does, you stay out of the browser.**

**Between every round, you verify yourself:** `node scripts/design/receipts.mjs`
(all surfaces), `npm test`, `npm run test:ui`, `git status` clean, and that the
commits the subagent claims actually exist. A round is not done until you have
checked it. If a round fails, fix it before starting the next — a stale surface
compounds.

## 🔴 THE NEW OFFICER RULE (2026-09-20): the interface does not explain itself

> "one overall design change is to not have text explaining all the functions of
> each page, or why certain things are made a certain way. it should be a simple
> interface."

**The rule.** A portal page shows its tool and its data. It does not tell the
member what the page does, what they are about to see, or why something works
the way it does.

**The test for any sentence:** *does this carry information the member cannot
get by looking at the page?* If no, delete it.

### DELETE

| file:line | text |
|---|---|
| `portal/lookup/page.tsx:47` | "Enter your UT EID and you'll see where you stand this term." |
| `portal/lookup/page.tsx:51-52` | "You'll see which events you attended, which you missed, anything still waiting on an officer, and whether your dues are paid." |
| `portal/lookup/page.tsx:54-63` | "Both have to match the same member, which is why this shows more than the leaderboard does." — **and its `<Link>` to the leaderboard with it.** Already independently condemned as stale; the officer chose removal over a replacement. |
| `portal/leaderboard/page.tsx:170` | the second sentence of "Standings for {term}. Attendance and bonus points, added together." **Keep the term** — an officer can pin a finished term, so it is information. |
| `portal/leaderboard/page.tsx:239-247` | "Want your own breakdown — which events you attended, what's still pending, and why your total is what it is?" → leave the bare link. |
| `lookup-form.tsx:184-188` | "A grant from a past term counts for nothing here." (the rationale half) |
| `lookup-form.tsx:254-259` | "Published events only — a cancelled event credits nobody, and an event that hasn't happened yet is upcoming, not a miss." Keep the counts that follow. |
| `lookup-form.tsx:298-300` | "These are the difference between your attendance points and your total." |
| `lookup-form.tsx:217-222` | "Nothing is lost — an officer matches these up by hand, and the points appear once they do." |

Apply the same test to anything the inventory missed. Judge by the rule, not by
this list.

### KEEP — and do not let a subagent over-apply the rule

- **Every label, heading, button and column head.**
- **Every outcome, error, validation and empty-state message.** These say what
  happened, which is not explanation.
- **Check-in's reassurance line** — "Not sure? Tick it. If we already have you,
  we'll use your existing record, never a second one." It is attached to a
  specific control and it is the officer's approved answer to the failure they
  named themselves. Removing it reopens that problem.
- **The hub's three destination one-liners.** They describe *another* page in a
  navigation list — wayfinding, not self-explanation.
- **Check-in's `Check your details before we add you`** — it names the action
  about to happen.
- **The term**, everywhere it appears.

### 🔴 WHAT THIS SUPERSEDES

The rule post-dates the 2026-09-19 copy approvals. Where they conflict, **the
rule wins**, and the receipts must say so rather than quietly diverging:

1. `route-portal-lookup.md:268-269` approved *keeping* "the term note, pending
   note and events note". The rule cuts the rationale from all three.
2. The leaderboard's approved lookup line "Want to see how your total adds up?
   Look up your attendance." reduces to the link alone.
3. Lookup's approved band line "Enter your UT EID to see where you stand this
   term." is deleted, not rewritten.

## THE ROUNDS

### Round 1 — shared primitives first, then the copy rule on the frozen pair

**Primitives before gates, because the phase already learned this.** Part 1 was
widened for exactly this reason: a `components/ui/` change landing after a
surface is gated leaves it reviewed against a rendering that no longer ships.

1. **The WCAG 1.4.11 input boundary** (`tasks.md` § Deferred, item 1). The
   Vellum fill is 1.12:1 on the white sheet and the hairline composites to
   ≈1.53:1 — a text input with no boundary meeting 3:1. It comes from
   `controlClass` in `components/ui/field.tsx`, **shared with /admin and every
   form on the site**, so re-measure against `/admin`'s forms and tables before
   and after. This is the single highest-value fix left in the phase.
2. **The header's MEMBER PORTAL button** (item 2): 29px tall at 360, 3px from
   the wordmark. `components/site-header.tsx`, site-wide. 🪤 **Parts 3–5 lean on
   this button** — it is why no portal page has a back link. Changing it is
   allowed; removing or moving it is not, without saying so.
3. **`components/ui/activities.tsx:98`** — `<Title className="text-[22px]
   sm:text-[26px]">` renders 34px. Use `size="card"`.
4. **The copy rule on `/portal` and `/portal/attend`.** Per the DELETE/KEEP
   lists. On the hub this is likely nothing; on check-in, nothing in the KEEP
   list moves — check carefully before changing anything there.

Commit the primitives and the copy separately. 🔴 A fix confined to
`components/ui/` satisfies **neither** the "mattered" rule nor freshness — only
a commit touching a registry-owned path does.

**Ends when:** both frozen surfaces render no self-explanation, the input
boundary meets 3:1 measured on the sheet and on `/admin`, `npm test` green, and
`test:ui` no worse than 41/1.

### Round 2 — re-gate `portal-hub`

Full `/design-gate portal-hub`: seven receipts (lead, critique, audit,
guidelines, design-review, detector, motion), every `commit:` set to the
post-round-1 HEAD.

🔴 **A re-gate that finds nothing FAILS the checker** — "the skills ran but
changed nothing". At least one finding on a *review* step must be adopted with a
`fix_commit` touching `app/(public)/portal/page.tsx`. If the reviews genuinely
find nothing, look harder; do not invent a finding, and do not point a
`fix_commit` at a commit that does not touch the surface.

Also: update the existing `receipts/officer.md` so its `commit:` is current or
its findings name every later surface commit — it opens its own staleness
window.

**Ends when:** `node scripts/design/receipts.mjs portal-hub` prints ok.

### Round 3 — re-gate `portal-attend`

The same, for `app/(public)/portal/attend/`. Its bar still applies: **at
360×640, idle, the Check in button's bottom edge ≤ 640px.** It measured 607.7
after the header removal. Re-measure; do not assume.

### Round 4 — part 4, `/portal/lookup`

The most complex result, and the surface carrying **9 of the 11** remaining
muted occurrences.

**Its bar:** at 360×640 the EID field and the Look up button are both on the
first screen (the button is cut at 614–653 today); **no horizontal scroll to
read whether you attended an event**; the member's own numbers reachable without
reading past explanation; `test:ui` green including `definition-list`.

**It owns, and must not leave for later:**
- 🔴 **The `definition-list` axe fault** — `lookup-form.tsx:435`, a `<p>` inside
  the `<dl>`'s `<div>`. **It is ONE node, not four**: only the Attendance-rate
  stat passes `note`. This is the last red check in the suite.
- **The events table's sideways scroll.** 512px of table inside a 305px frame.
  🪤 **The page does not overflow** — the scroll is inside `Table`'s
  `overflow-x-auto`, which is why `test:ui`'s 360 check passes while the column
  stays unreachable. The remedy is **stacked rows below `sm`** (title, then when
  and points, state at the end), the four-column table from `sm` up.
- **All 9 muted occurrences** — `page.tsx:54` (deleted with the stale sentence)
  and `lookup-form.tsx:184, 216, 253, 297, 342, 404, 423, 435`.
- **The contradictory dues comment** at `lookup-form.tsx:338-341`, which argues
  the opposite of the page's own header at `page.tsx:13-19`.
- Every state in the brief's list, including the ones no seed member produces.
  🪤 **No seed member has both a pending check-in and an adjustment** — that
  case must be constructed locally to be designed. The suite gates on `bk2856`,
  who has neither, so the gated result is the *shortest* one.

🪤 `motion.md` is **not** required for lookup — but the set is computed from a
grep of the surface's files, so re-run `node scripts/design/receipts.mjs
portal-lookup` before assuming.

**Ends when:** its bar is met, axe green on the result and the miss, `test:ui`
**42/0**, and the surface is `rebuilt` in `surfaces.json` **and** DESIGN.md's
table in one commit.

### Round 5 — part 5, `/portal/leaderboard`

**Its bar:** the whole **top 10 on the first screen at 1280×720** — today 6
rows, the tenth row's bottom edge at 851, so **a 131px claw-back**. Names never
below 16px (today 14px). Top 3 on the first screen at 360×640.

🪤 **A boundary tie at rank 10 is a named, accepted overflow, not a bar
failure.** Ranking is standard competition; the board shows ranks as they are
and may not renumber a tie to fit. The seed's rank ≤ 10 is exactly ten rows, so
the tie case must be constructed.

**It owns:**
- **The sticky column head.** `page.tsx:173-177` claims it is sticky; it is not
  — `:203` is a bare `<Table>` and `:208` a bare `<THead>`. Part 1 already built
  the primitive: `<THead sticky="page">` with `<Table scroll={false}>` and
  `top-[61px]`.
- **Its two stale `active member` comments** — `page.tsx:12` and `:45`. 🪤
  **`:134-139` is already correct and is the evidence they are stale. Do not
  "fix" it.**
- Its one muted occurrence — **`page.tsx:239`**, not `:238` as the docs say; the
  header-removal commit shifted it.
- The approved all-zero banner copy.

### Round 6 — part 6 remainder, then part 7

**Part 6 remainder** (touches no registered surface's files, which is the point):
- `/officer-invite/[token]/page.tsx:135`'s muted line. 🐛 **Re-measure before
  swapping** — that `<p>`'s only child is a `<Link>` with its own ink, so it may
  paint no muted text at all, exactly like the `/portal/attend:364` case part 3
  found. If it is nominal, remove the dead token and say so.
- **Record `/officer-invite`'s other drift in DESIGN.md's surface table as a
  named exception**: a raw `<section className="px-6 py-16">` instead of
  `<Section>`, an h1 at `34 → 42px` on no ramp row, a hand-rolled caution banner
  instead of `Banner`. Do **not** register it as a surface — four measured
  reasons are in the plan.
- The full suite green.

**Part 7:**
- `DESIGN.md`'s surface table and `docs/design/surfaces.json` agree for all four.
- `tasks.md` and `docs/build-log.md` record what the phase found.
- ✅ `PageHero`'s "NINE pages render this" is **already corrected to five**
  (2026-09-20) — verify, do not redo.
- Merge prep. 🪤 **Never squash** — the receipts name commits that must survive,
  and `merge-base --is-ancestor` enforces it. `portal-phase-1` merges first.

## NOT YOURS TO RELITIGATE

- **Behaviour does not change.** Presentation only: no route, Server Action,
  `lib/`, view or schema change. Every invariant in `CLAUDE.md` holds.
- **`DESIGN.md` is the visual authority and is never regenerated.** Never
  `/impeccable init`, `/impeccable document` onto it, or `ui-ux-pro-max
  --persist` — each writes a rival source of truth, and
  `tests/design-receipts.test.ts` fails on both.
- **There is no navy header anywhere in the portal**, and no `PageHero`. Every
  portal page is one white `.sheet` via `PortalSheet`. No back link — the site
  header's MEMBER PORTAL button is the way back.
- **The EID-alone gate on `/portal/lookup`** is a recorded officer reversal, not
  drift. One query, one `unmatched` message for every miss, its own throttle
  bucket.
- **`/portal/attend` stays indexable**; the other three are noindex. Robots is
  per page, never a portal layout.

## TRAPS

- 🚨 **Only one agent may drive Chrome at a time.** Two CDP clients wedge the
  renderer; a run was killed after an hour having produced nothing.
- 🚨 **`npm run test:ui` cannot measure any gate bar.** One project at 1280×720.
  Every bar is a fold position — green suite ≠ met bar.
- **To read a settled layout, remove the `js` class from `<html>`.** Forcing
  `data-revealed` starts a 0.7s transition a background tab never advances. An
  un-settled `[data-reveal="up"]` reads 18px low.
- **Measure computed style, not grep hits, and not the rendered class
  attribute** — there is a live case where the attribute itself lies.
- ⚠️ **Re-derive a number before writing it into a comment, including one you
  produced yourself.** This was violated twice in one phase.
- ⚠️ **Measure the column the text is actually in.** A line nested in a flex row
  gets the content column minus the preceding items — 28px less, for the
  checkbox row.
- **Quote every SHA in a receipt, and use the full 40 characters.** Unquoted,
  YAML reads `1836e72` as a float.
- **A neutral `Banner` and a text input are the same colour** — both fill with
  `--misa-panel`. On a white ground an `info` banner above empty inputs reads as
  one more empty control. **`/portal/lookup` uses both on white.**
- **Neither `min-w-0` nor `break-words` fixes a long unbroken value alone.**
  Lookup echoes an EID and renders event titles.
- **A width utility on a stretched flex child is not a width.** Use `self-start`.
- `receipts.mjs` fails a surface as stale on any commit touching its files after
  a review that no receipt names. **Order: build → fix → gate → flip. Once
  `rebuilt`, stop touching its files.**

## SETUP

Docker + `npx supabase start` (32 seeded fake members, 15 events). `npm run dev`
must show `.env.development.local` in its Environments line or it is reading
production; a dev server may already be on :3000. On a fresh machine, the two
gitignored env files are recreated per `README.md` § "On a fresh clone".

**Known-good state to confirm before round 1:** `npm test` 41 files / 1142 tests
green; `npm run test:ui` **41 pass / 1 fail**, the one being `/portal/lookup`'s
`definition-list`; `node scripts/design/receipts.mjs` ok for `portal-hub` and
`portal-attend`.

## STOP WHEN

All four portal surfaces are `rebuilt` with passing receipts, `npm run test:ui`
is **42 pass / 0 fail**, `npm test` is green, DESIGN.md and `surfaces.json`
agree, and the records are written. Report what the phase found — then stop.
**Do not merge to `main`**: that replaces the live club website, and the merge is
the officer's call.

# Hand-off: finish the Portal Rebuild (v2 phase 3, parts 4–7)

> **This file is a PROMPT.** Copy everything below the horizontal rule into a
> fresh Claude Code session. It is written to be read cold.
>
> Written 2026-09-20, at the end of the orchestrated session that ran the three
> re-gate rounds. **State at that moment:** branch `design-toolkit` at
> `5d8731d`, 10 commits ahead of `main`, unpushed, working tree clean.
> `portal-hub` and `portal-attend` `rebuilt` **and re-gated against the sheet
> build**. `npm test` 41 files / 1142 green. `npm run test:ui` 41 pass / 1 fail.
>
> 🗑️ It supersedes [`handoff-finish-portal-rebuild.md`](handoff-finish-portal-rebuild.md),
> whose rounds 1–3 are done and several of whose numbers were re-derived and
> moved. That file is kept for the officer's full DELETE/KEEP copy lists, which
> this one cites rather than repeats.

---

Finish the Portal Rebuild (v2 phase 3) in `C:\MISA-Website`, on branch
`design-toolkit`. You are running **parts 4–7**. Parts 0–3 are done, and both
frozen surfaces have already been re-gated.

**You are an ORCHESTRATOR. Do not build any of this yourself.** You run setup,
you delegate each round to one subagent, and you verify between rounds. The
reason is context, not capability — and the section below is the most important
part of this prompt.

## 🔴 CONTEXT DISCIPLINE — read this before anything else

**Your context window is the scarcest resource in this job.** The session that
built parts 0–3 ran out of room and had to hand off. The session that ran rounds
1–3 finished comfortably by following the rules below. Parts 4–7 are the largest
remaining chunk. Everything here exists to keep you under budget.

**The principle: you hold conclusions, subagents hold contents.** A subagent has
its own fresh window, so verbosity in *its* prompt is nearly free. Verbosity in
*yours* is what ends the session. Write long briefs; read short outputs.

### Never do these

- ❌ **Never read a subagent's output/transcript file.** The harness warns you;
  it is the full JSONL and it will overflow you in one call. The subagent's
  final report *is* the interface.
- ❌ **Never `git show <sha>`.** Use `git show --stat --format='' <sha>`.
- ❌ **Never run a test command without a tail.** `npm test 2>&1 | tail -6`.
- ❌ **Never read a file over ~300 lines in full.** `lookup-form.tsx` is 438,
  the plan is ~1800, `tasks.md` is ~2000, `DESIGN.md` is ~1000. Use
  `sed -n 'A,Bp'` after locating with `grep -n`.
- ❌ **Never re-derive what a round already reported.** If a round measured it
  and you verified it, it is a fact now. Do not re-measure to feel sure.
- ❌ **Never open the browser yourself.** Measurement is the subagent's job, and
  two CDP clients wedge the renderer.

### Do these instead

| Need | Cheap command |
|---|---|
| Did the claimed commits land? | `git log --oneline -8` |
| Do they touch only what they claim? | `git show --stat --format='' <sha>` |
| Did anything foreign get swept in? | `git diff --name-only <base> HEAD` |
| Receipts state | `node scripts/design/receipts.mjs 2>&1 \| grep -E "^portal"` |
| Unit suite | `npm test 2>&1 \| tail -6` |
| UI suite | `npm run test:ui 2>&1 \| tail -6` |
| Is a surface's wiring right? | `grep -H "^commit:" docs/design/surfaces/<s>/receipts/*.md` |
| Find a line before reading it | `grep -n "<pattern>" <file>` |

**If answering a question means reading several files, that is a subagent's
job.** Spawn one, ask for the conclusion, discard the search.

### Budget guide

Roughly: setup + baseline ≈ 5%. Each round's brief ≈ 2%. Each round's
verification ≈ 2%. That leaves ample headroom for four rounds. **If you find
yourself above ~50% before round 6, stop delegating reading to yourself.**

### If a round stalls or dies

It happens — a stream watchdog, a network switch. **Check the repo state first**
(`git status`, `git rev-parse HEAD`, `receipts.mjs`), then relaunch. Rounds 1–3
lost two agents this way and neither had touched the repo. **If a large prompt
stalls twice, split the round at a natural seam** (build vs. records, primitives
vs. copy) — round 1 was split into 1a/1b for exactly this reason and both halves
then ran clean.

## READ FIRST — in this order, with ranges

1. `docs/frontend-redesign-v2-plan.md` § **"🧭 Where the build stands"** — find
   it with `grep -n "Where the build stands"`, read ~80 lines from there. It
   carries the per-round commit table and **"What rounds 1–3 found"**, which is
   the five defect classes parts 4–7 inherit. **This is the single highest-value
   read in the repo.** Then the part table (`grep -n "^| \*\*4 —"`).
2. `DESIGN.md` — the visual authority, never regenerated. `grep -n "^## \|^### "`
   then read §Components (`PortalSheet`), §The ramp, §Grounds, §Surfaces.
3. The brief for whichever surface a round touches, at
   `.impeccable/surfaces/route-portal*.md`. **Each opens with a 🔴 OFFICER
   OVERRIDE block that wins over everything below it in the same file.**
4. `docs/handoff-finish-portal-rebuild.md` § the officer's **DELETE / KEEP**
   copy lists and § "WHAT THIS SUPERSEDES" — the authoritative copy scope for
   rounds 4 and 5. Read only those sections.
5. `tasks.md` § the `--misa-muted` AA contrast failures (`grep -n "misa-muted\` AA"`).

## STATE — verified at hand-off

| | |
|---|---|
| Branch | `design-toolkit`, HEAD `5d8731d`, **10 ahead of `main`, unpushed** |
| `main` | `699fd3d` — a parallel worker merged and **pushed** partner-logo work; that is live. **Do not touch `main`.** |
| `portal-hub` | `rebuilt`, re-gated round 2 (`92076ac` fixes · `8419617` receipts · `91e5c13` DESIGN.md) — receipts **ok** |
| `portal-attend` | `rebuilt`, re-gated round 3 (`b2900e1` fixes · `b197663` · `5d8731d` receipts) — receipts **ok** |
| `portal-lookup` | `in-progress` — **round 4 builds it** |
| `portal-leaderboard` | `in-progress` — **round 5 builds it** |
| `npm test` | **41 files / 1142 tests** green |
| `npm run test:ui` | **41 pass / 1 fail** — `/portal/lookup`'s `definition-list`, round 4's |

🔴 **Both frozen surfaces are FROZEN AGAIN.** `receipts.mjs` fails a `rebuilt`
surface as **stale** on any later commit touching its files that no receipt
names as a `fix_commit`. `components/ui/` is exempt by design. **Do not edit
`app/(public)/portal/page.tsx` or `app/(public)/portal/attend/` in rounds 4–7.**

## HOW TO RUN THIS

**One subagent per round, strictly sequential. Never two at once.** Three
reasons, all learned: two agents driving Chrome wedge the renderer (this cost an
hour); two agents committing to one branch fight over `index.lock`; and both
share one dev server and one local Supabase stack.

Give each subagent: its round's scope verbatim, the READ FIRST list, the TRAPS
section, and this contract —

> Report back: (1) every file you changed; (2) every commit, as full 40-char
> SHAs from `git rev-parse`, each with `git show --stat --format=''` proving its
> scope; (3) the measured numbers against your round's bar, **naming the layout
> width**, and how you measured them; (4) `node scripts/design/receipts.mjs`
> output; (5) `npm test` and `npm run test:ui` as counts — **file count and test
> count, not just "passed"**; (6) findings adopted / rejected against a named
> rule / deferred; (7) anything you did NOT do and why. If you are blocked, say
> so and stop — do not invent a way around a checker.

A subagent may spawn the `design-reviewer` agent for its gate's step 5. **While
it does, you stay out of the browser.** Give that agent the browser to itself,
ban `requestAnimationFrame` loops (a background tab never advances rAF), set a
~15-minute budget and ask for partial findings if it runs long. That
configuration has now worked three times.

**Between every round, you verify yourself** — using the cheap commands above:
`receipts.mjs` (all surfaces), `npm test`, `npm run test:ui`, `git status`
clean, and that the claimed commits exist **and touch only what they claim**. A
round is not done until you have checked it. If a round fails, fix it before
starting the next — a stale surface compounds.

## THE ROUNDS

### Round 4 — part 4, `/portal/lookup`

The most complex result, and the surface carrying **9 of the 11** remaining
muted occurrences.

**Its bar:** at 360×640 the EID field and the Look up button are both on the
first screen (the button is cut at 614–653 today); **no horizontal scroll to
read whether you attended an event**; the member's own numbers reachable without
reading past explanation; `test:ui` green including `definition-list`.

**It owns, and must not leave for later:**

- 🔴 **The `definition-list` axe fault** — `lookup-form.tsx:435`, a `<p>` inside
  the `<dl>`'s `<div>`, which becomes a second `<dd>`. **It is ONE node, not
  four**: only the Attendance-rate stat passes `note`. **This is the last red
  check in the suite.**
- **The events table's sideways scroll.** 512px of table inside a 305px frame.
  🪤 **The page does not overflow** — the scroll is inside `Table`'s
  `overflow-x-auto`, which is why `test:ui`'s 360 check passes while the column
  stays unreachable. The remedy is **stacked rows below `sm`** (title, then when
  and points, state at the end), the four-column table from `sm` up.
- **All 9 muted occurrences**, verified present at hand-off: `page.tsx:54` (goes
  with the stale sentence) and `lookup-form.tsx:184, 216, 253, 297, 342, 404,
  423, 435`.
- **The contradictory dues comment** at `lookup-form.tsx:338-341`, which argues
  the opposite of the page's own header at `page.tsx:13-19`.
- **The officer's copy DELETE list for this surface** — `page.tsx:47`, `:51-52`,
  `:54-63` (**and its `<Link>` to the leaderboard with it**), and
  `lookup-form.tsx:184-188`, `:217-222`, `:254-259`, `:298-300`. Full text and
  the KEEP list in `handoff-finish-portal-rebuild.md`. **Judge by the rule, not
  by the list** — apply the same test to anything it missed.
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

- **The sticky column head.** `page.tsx:173-177` claims it is sticky; **it is
  not** — the `<Table>` and `<THead>` below it are bare. Part 1 already built
  the primitive: `<THead sticky="page">` with `<Table scroll={false}>` and
  `top-[61px]`. (61px is the measured header shell, confirmed at nineteen widths
  in round 3.)
- **Its two stale `active member` comments** — `members.active` is GONE
  (migration 29). 🪤 **The comment near `:135` is already correct and is the
  evidence the others are stale. Do not "fix" it.** Re-grep for `active member`;
  the line numbers have shifted before.
- Its one muted occurrence — **`page.tsx:239`**, verified at hand-off.
- **The officer's copy DELETE list:** `page.tsx:170`'s second sentence (**keep
  the term** — an officer can pin a finished term, so it is information), and
  `:239-247` reduces to the bare link.
- The approved all-zero banner copy (in the plan's *Copy the officer approved*).

### Round 6 — part 6 remainder, then part 7 prep

**Touches no registered surface's files, which is the point.**

- `/officer-invite/[token]/page.tsx:135`'s muted line. 🐛 **Re-measure before
  swapping** — that `<p>`'s only child is a `<Link>` with its own ink, so it may
  paint no muted text at all, exactly like the `/portal/attend:364` case part 3
  found. If it is nominal, remove the dead token and say so.
- **Record `/officer-invite`'s other drift in DESIGN.md's surface table as a
  named exception**: a raw `<section className="px-6 py-16">` instead of
  `<Section>`, an h1 at `34 → 42px` on no ramp row, a hand-rolled caution banner
  instead of `Banner`. Do **not** register it as a surface — four measured
  reasons are in the plan.
- 🔴 **The focus-ring fade on `button.tsx`** (officer question 3 below).
  Tailwind v4 puts `outline-color` inside `transition-colors`, and an unfocused
  element's `outline-color` is `currentColor` — which on `bg-misa-blue` is
  **white**. Sampled: `rgb(255,255,255)` at t≈1ms (**1.00:1** on the white
  sheet) rising to navy at ≈151ms; it does not clear 3:1 until ~70–90ms. **A
  per-call-site override ties on specificity and loses on emission order**, so
  the fix must be in `BASE`. Same root cause as the header button's ring.
- The full suite green.

### Round 7 — records, merge prep

- `DESIGN.md`'s surface table and `docs/design/surfaces.json` agree for all four.
- `tasks.md` and `docs/build-log.md` record what the phase found. **Much of
  rounds 1–3 is already written** — see the build log's "the RE-GATE ROUNDS"
  entry and the plan's "What rounds 1–3 found". Add rounds 4–6.
- ✅ `PageHero`'s "NINE pages render this" is **already corrected to five**
  (2026-09-20) — verify, do not redo.
- **Sweep the stale bar figures.** `607.7` is the *desktop-window* reading; the
  true-phone number is **591.5**. The hub's `265.5` is **267.2**. Already fixed
  in `CLAUDE.md`, the plan, `tasks.md`, `DESIGN.md` and the build log — check
  for any that escaped (`grep -rn "607\.7\|265\.5" --include=*.md .`).
- Merge prep. 🪤 **Never squash** — the receipts name commits that must survive,
  and `merge-base --is-ancestor` enforces it. `portal-phase-1` merges first.

## 🔴 TRAPS — the five defect classes rounds 1–3 uncovered, plus the standing ones

**These are the ones that cost the most. Put them in every subagent brief.**

1. 🔴 **`getComputedStyle` is not evidence that something painted.** The hub's
   gate "fixed" a focus ring and verified it by reading computed style, which
   reported it present and correct. **It never painted** — an outline is painted
   in its own element's step and was overpainted by the parent's. `position:
   relative` / `z-index` / `isolation: isolate` fix it; an inset `box-shadow`
   does not. **For any claim about what is visible, diff pixels.** 🪤 And
   programmatic `.focus()` returns `:focus-visible === false` and paints **zero**
   pixels — Tab-driven focus is the only valid method.
2. 🔴 **The detector's type-ramp rule is SWITCHED OFF, not blind.**
   `allowedFontSizes` reads a `typography` frontmatter key `DESIGN.md` does not
   have, so it abstains even for the `text-[Npx]` values it exists to catch —
   six planted probes, five returned nothing. **Treat a clean detector as no
   evidence at all.** (Compounds part 3's "a clean detector is not a clean
   surface": that scan returned `[]` on a build overflowing by 588px.)
3. 🔴 **Three agreeing measurements that share one hidden assumption are ONE
   measurement.** Round 3 concluded a recorded number "reproduces at no
   viewport" and built arithmetic that added up and described nothing — all
   three derivations were headless, and **headless Chromium uses overlay
   scrollbars in every context**. **Cross-check every fold position in a real
   browser, and name the layout width in every record.** There is a cliff at
   **348px of layout width** where a classic scrollbar makes the check-in
   checkbox's label wrap.
4. 🪤 **`npm test` can print green while its gatekeeper is not running.** A CRLF
   checkout of `scripts/design/receipts.mjs` made `tests/design-receipts.test.ts`
   fail to **load** — zero tests contributed, suite printed 40 files / 1118
   instead of 41 / 1142. Fixed by `.gitattributes` (`77d2c56`); **do not remove
   it.** **Always check the FILE COUNT, not just the word "passed".**
5. 🪤 **There is no open seeded event locally** (nearest 2026-08-06, 2026-12-02).
   A round needing a check-in written must create its own and delete it. 🔴
   Round 3 damaged the seed and restored it with `npx supabase db reset`, which
   also wipes `auth.users` to the seed officer — a hand-made local officer needs
   recreating with `scripts/create-officer.mjs --local`.

Standing traps, still live:

- 🚨 **Only one agent may drive Chrome at a time.**
- 🚨 **`npm run test:ui` cannot measure any gate bar.** One project at 1280×720.
  Every bar is a fold position — green suite ≠ met bar.
- **To read a settled layout, remove the `js` class from `<html>`.** Forcing
  `data-revealed` starts a 0.7s transition a background tab never advances. An
  un-settled `[data-reveal="up"]` reads 18px low.
- **Measure computed style, not grep hits, and not the rendered class
  attribute** — `<Title className="text-[22px] sm:text-[26px]">` rendered 34px
  because arbitrary values tie on specificity and Tailwind v4 sorts ascending.
- ⚠️ **Re-derive a number before writing it into a comment, including one you
  produced yourself.** Violated three times in this phase now.
- ⚠️ **Measure the column the text is actually in.** A line nested in a flex row
  gets the content column minus the preceding items.
- **A neutral `Banner` and a text input are the same colour** — both fill
  `--misa-panel`. **`/portal/lookup` uses both on white.** On a white ground an
  alert that matters takes a status tone.
- **Neither `min-w-0` nor `break-words` fixes a long unbroken value alone.**
  Round 3 measured a 76-char unbroken title painting **622.1px wide** with
  `min-w-0` alone. 🪤 A hyphenated probe passes — a hyphen is a break
  opportunity. **Lookup echoes an EID and renders event titles.**
- **A width utility on a stretched flex child is not a width.** Use `self-start`.
- **Contrast goes through a formula validated on the WCAG reference pairs**
  (`#767676` on white = 4.54, black on white = 21.00), never by eye.
- **Quote every SHA in a receipt, and use the full 40 characters.** Unquoted,
  YAML reads `1836e72` as a float.
- ⚠️ **A review is a set of claims, not an inventory.** Two of phase 4's five
  findings were wrong about the code; round 2 filed and withdrew two it could
  not reproduce; round 3 was overturned twice inside its own gate. **Re-derive
  against the code, including findings this project wrote down itself.** When a
  gate overturns the lead, **leave the receipt unedited** — a receipt rewritten
  to agree with the outcome stops being evidence that the steps disagreed.
- `receipts.mjs` fails a surface as stale on any commit touching its files after
  a review that no receipt names. **Order: build → fix → gate → flip. Once
  `rebuilt`, stop touching its files.**

## ⚠️ SIX OFFICER QUESTIONS ARE STACKED — ask them, do not let them rot

🔴 This phase has already recorded a process failure of exactly this kind: *"a
rejected concept that its own receipt flagged for the officer was never put to
them,"* and the officer's "looks similar" came a day later. **Carry these to the
gate as one list.**

1. **The `refused` panel's copy** (round 1b). *"Check-in opens around event
   times, and there's no MISA event within 48 hours of right now — nothing
   running, and nothing that just ended or is about to start."* The first clause
   states a system rule; the third restates the second in plain words. Kept on
   the literal test. **This is the one place on the frozen pair where the
   officer's copy rule would land if they want it applied to error prose.**
2. **The header's MEMBER PORTAL button announces the current page to a screen
   reader but shows nothing to an eye** (round 2, shared chrome).
3. **Focus rings fade in from invisible** (rounds 2 and 3, same root cause) —
   white at t≈1ms, **1.00:1**, not clearing 3:1 until ~70–90ms. Fix belongs in
   `button.tsx`'s `BASE`; round 6 owns it.
4. **The hub's three destination rows rake 92.7 / 118.3 / 143.9px at 360** — the
   least-urgent destination is the largest object on the phone screen. The
   remedy is subtraction ("MISA" appears in all three bodies on a MISA-only
   page); a one-line clamp truncates and is worse. 🪤 Equal *formatting* is
   officer-mandated and structural; shortening copy does not break it.
5. **The masthead rule and the plate's top border state one boundary twice.**
6. **"Points Leaderboard" on the hub arrives at a sheet titled "Leaderboard"** —
   round 5 may retitle the page instead.

## NOT YOURS TO RELITIGATE

- **Behaviour does not change.** Presentation only: no route, Server Action,
  `lib/`, view or schema change. Every invariant in `CLAUDE.md` holds.
- **`DESIGN.md` is the visual authority and is never regenerated.** Never
  `/impeccable init`, `/impeccable document` onto it, impeccable's
  replace-DESIGN.md path, or `ui-ux-pro-max --persist` — each writes a rival
  source of truth and `tests/design-receipts.test.ts` fails on it. A
  sidecar-only refresh is fine; hand-editing to record a rule is fine.
- **There is no navy header anywhere in the portal**, and no `PageHero`. Every
  portal page is one white `.sheet` via `PortalSheet`. **No back link** — the
  site header's MEMBER PORTAL button is the way back (40px, measured).
- **The EID-alone gate on `/portal/lookup`** is a recorded officer reversal, not
  drift. One query, one `unmatched` message for every miss, its own throttle
  bucket.
- **`/portal/attend` stays indexable**; the other three are noindex. Robots is
  per page, never a portal layout.
- **Do not touch `main`.** A parallel worker merged and pushed partner-logo work
  there; `main` is `699fd3d` and that is live at https://www.txmisa.org.

## SETUP

Docker + `npx supabase start` (32 members / 15 events / 208 attendance — verify
with `docker exec -i supabase_db_MISA-Website psql -U postgres -d postgres -tA`).
`npm run dev` must show `.env.development.local` in its Environments line or it
is reading production. 🪤 **A dev server may already be running, and it may have
silently died** — check with `curl -s -o /dev/null -w "%{http_code}"
http://localhost:3000/portal` rather than assuming either way. On a fresh
machine the two gitignored env files are recreated per `README.md` § "On a fresh
clone".

**Confirm before round 4:** `npm test` **41 files / 1142 tests**; `npm run
test:ui` **41 pass / 1 fail** (`/portal/lookup`'s `definition-list`);
`node scripts/design/receipts.mjs` ok for `portal-hub` and `portal-attend`,
FAIL for the two `in-progress` surfaces.

## STOP WHEN

All four portal surfaces are `rebuilt` with passing receipts, `npm run test:ui`
is **42 pass / 0 fail**, `npm test` is **41 files / 1142 tests** green, DESIGN.md
and `surfaces.json` agree, and the records are written. Report what the phase
found, and put the six officer questions in front of a person — then stop.
**Do not merge to `main`**: that replaces the live club website, and the merge is
the officer's call.

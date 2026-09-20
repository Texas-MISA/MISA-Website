---
version: 1
slug: "route-portal"
primary_target: "route:/portal"
related_targets: ["app/(public)/portal/page.tsx"]
---

# Surface brief: portal-hub (`/portal`)

## Mode and lead
- **Mode:** Operate — a member on their own phone, usually standing at an
  event, using the hub as the doorway to check-in, standings or their own record.
- **Lead skill:** `impeccable` (Operate mode, craft-floor).
- **Visual authority:** `DESIGN.md` — the established world. Never a replacement
  world, and never a regenerated `DESIGN.md`.

## Job and audience
- **Who arrives (officer, 2026-09-19 interview): mostly a member on a phone, at
  an event**, in its first minutes, heading for check-in. Standings and
  self-lookup are the secondary uses.
- **How they arrive:** the site header's navy MEMBER PORTAL button is the one
  way in, and nothing outside `/portal` links `/portal/attend`. 📌 The printed
  event QR codes do NOT pass through the hub — `/attend` 308s straight to
  `/portal/attend` — so a member reaching the hub at an event has come in
  through the header, not the QR code.
- **What they need:** to see the three member tools at a glance and reach the one
  they came for in one tap. No account, no sign-in: members have none in v1.
- **Not the tiebreaker, but present:** officers, who reach `/admin/login` from
  the "Officers: sign in" line at the foot of the hub.

## Outcome and proof
- **Primary task:** choose one of three destinations — Event Check-In
  (`/portal/attend`), Points Leaderboard (`/portal/leaderboard`), My Attendance
  (`/portal/lookup`) — and go there.
- **Success:** the member reaches the destination they came for in one tap from
  the hub, having read nothing they did not need.
- **The one thing it must never fail at — the officer's named anti-goal: it
  must never be SLOWER TO CHECK IN than today.** Measured 2026-09-19 on the
  local dev server, at scroll 0, with the 61px sticky header:

  | Viewport | Check-in button (top–bottom) | Leaderboard | Lookup |
  |---|---|---|---|
  | 360×640 | 385–424 — first screen | 605–644 — straddles the fold | 840 — below |
  | 390×844 | 386–425 | 605–644 | 824–863 — straddles the fold |
  | 768×1024 | 373–412 | 516–555 | 671–710 |
  | 1280×800 | 381–420 | 524–563 | 667–706 |

  ✅ **RE-MEASURED 2026-09-19 at the start of the build (part 0), and the table
  holds:** at 360×640 the three buttons settle at **384–423**, **602–641** and
  **820–859**. Within 1–3px of the rows above, so the bar stands as written.
  🪤 **Measure the SETTLED state or you will read every number 18px low.**
  `html.js [data-reveal="up"]` is `translateY(18px)`, and the hub's three rows
  each carry one — so an un-revealed read gives 441 where the truth is 423.
  Forcing `data-revealed` is the right method (it is what
  `tests/ui/design-gate.spec.ts` does), but it starts a 0.7s transition, and a
  **background browser tab never advances it** — even an `!important` override
  appears not to apply. Removing the `js` class off `<html>` is the reliable
  read: it drops the transition with the rule, so the geometry snaps.
  📌 This is one more argument for concept A's no-reveal destinations: the 18px
  is not only a delay, it is a number nobody can measure casually.

  **Proof for the gate:** at 360×640 the check-in control's bottom edge sits at
  or above 424px (fully in the first screen, no scroll), and the path stays
  header button → hub → check-in, two taps. Any concept that pushes check-in
  lower or adds a tap fails this brief, however it looks.
- **Held in tension with the ranking rule (officer, 2026-09-18, re-confirmed
  2026-09-19): all three destinations are formatted the same and none outranks
  another.** Check-in's speed must come from order, placement and compactness —
  never from making it the primary action or giving it a different skin.

## States
The hub is **static**: no data reads, no form, no auth. Its states are
presentational, and each is designed, not assumed:
- **Default** — three destinations, each with its title, its one-line body and
  its action, then the officer line. Exactly three (officer: design for 3; a
  fourth or fifth destination — houses, bingo — is a later re-layout, and that
  is accepted).
- **Current-page marking** — the header's MEMBER PORTAL button is current on
  every `/portal/*` page, the hub included. That lives in
  `components/site-header.tsx`, outside this surface; the hub must not
  duplicate it.
- **Each control's hover, focus-visible and active** — keyboard order runs
  check-in → leaderboard → lookup → officers sign-in, matching visual order.
- **JavaScript off** — every destination visible and usable; the reveal's hidden
  state is scoped to `html.js`, so nothing may depend on the observer.
- **Reduced motion** — every reveal resolves at once.
- **Narrow and wide** — 360px with no horizontal overflow, each title wrapping
  cleanly inside its row beside the key; 768; 1280 without the column turning
  into a sparse strip.
- **Errors** — none of its own. A failure in the public layout lands on the
  public error boundary, which is not this surface.

## Interaction and layout
- **Order is fixed: check-in, leaderboard, lookup** (officer: order not
  changeable). Check-in first is what keeps it fastest without ranking it.
- **May change (officer, 2026-09-19):** the page hero, the row titles and button
  labels, and the officers sign-in line. **Must not change:** the order, the
  equal formatting, and the page's content — **nothing else is added** (no
  orienting line, no live data, no imagery).
- **Hero:** the hub may drop or shrink its use of the shared hero. 🪤 `PageHero`
  itself renders on nine pages, so the hub may not restyle the shared component
  for its own ends; a hub-only treatment belongs in the hub's own file. Today
  the hero costs 176px of a 640px phone screen above the first destination.
- **Tap targets:** every destination's target is at least 48px tall — the
  native minimum for the phones members use, not the web's 24px floor (EV1).
  Today's buttons are 39px.
- **Affordance (adopted concept A):** the whole row is the link — exactly one
  `<Link>` per destination, whose accessible name is the row's title and whose
  one-line body is its description. What says "this is a link" (the navy key
  and its chevron) is visible at rest on every row; hover and press only swap
  ink, because a phone never hovers (EV14). The row earns its hover cue by
  becoming the interaction (DESIGN.md).
- **Keyboard:** tab order is check-in → leaderboard → lookup → officers sign-in,
  the same as reading order, and every row shows a focus ring that the plate's
  seam and overflow cannot clip (EV5).
- **Navigation speed:** every destination stays a next/link `<Link>` with the
  default prefetch, so the tap to check-in is a client-side transition (EV7).
- **Layout families** (DESIGN.md §Layout families, budget per page): today the
  page spends two — page hero, stacked row cards. Concept A spends two — a short
  page hero and a shared-rule plate (one background through `gap: 1px`, cells
  opaque) — and declares each in a comment.
- **Motion:** the existing scroll-reveal vocabulary only; `emil-design-eng` owns
  whether anything animates. Nothing may delay the check-in control's
  first paint — a reveal that hides it until the observer fires is slower to
  check in — so the destinations carry no `data-reveal` (concept A). The only
  motion on them is the hover and press ink change.

## Constraints carried in
Behaviour does not change in a design phase. From CLAUDE.md's Invariants and
DESIGN.md, the ones this surface touches:
- 🔓 **"check-in lives only inside the portal (officer): nothing outside
  `/portal` links `/portal/attend`."** The hub is inside the portal, so it is
  the door; the redesign must not add a check-in link anywhere outside it.
- 🔓 **Robots is per page, never a portal layout** (`tests/portal.test.ts`): the
  hub stays `robots: { index: false, follow: false }`; `/portal/attend` stays
  indexable. A layout-level robots would de-index check-in.
- 🔓 **The old paths are permanent redirects in `next.config.ts`, never
  deleted.** Not in this surface's files; nothing here may depend on them.
- **"Moving a page ground is a CONTRAST CHANGE, not a paint change"** and
  DESIGN.md's **"`--misa-muted` may sit on Paper, never on Vellum"** (4.33:1 on
  the grey page ground, fails AA). Phase 3 owns this fix; the hub must ship with
  no muted ink on Vellum, re-measured on the ground each text actually sits on.
- **"Never put `data-reveal` on a node that mounts after first paint."** The hub
  is server-rendered, so reveals are safe; nothing client-mounted may carry one.
- **"The scroll reveal's hidden state is scoped to `html.js`"** and **`reveal.tsx`
  must never gain `"use client"`.**
- **"Every shared UI primitive lives in `components/ui/`"** and **"a primitive
  with no call sites has not ended the drift"**: reuse `Section`, `Title` and
  the shared tokens; the plate follows DESIGN.md's shared-rule plate rather than
  a new component, and a new primitive is justified only by a second caller.
- **"Button labels are sentence case in the DOM"**; `button.tsx` uppercases.
- **"`<Section>` is PUBLIC-ONLY"** — the hub is public, so it is the right band.
- **"Global CSS must live inside a Tailwind cascade layer."**
- **DESIGN.md:** the five grounds are a closed set; the Rare Navy Rule; square
  structure with the 4px radius only on things that float; four elevation steps;
  colour swaps as the only hover; no hover on anything not interactive; the
  layout-family budget.
- **Nav clearance** (DESIGN.md §Nav clearance): the header is out of scope; on a
  phone its MEMBER PORTAL button beside the centred wordmark is already the
  tight spot, so nothing here may lean on the header growing.
- **The repository is public:** any sample copy stays obviously fake.

## Diverge
`frontend-design` proposed two concepts (`receipts/diverge.output.md`); the lead
decided in `receipts/diverge.md`.
- **A — "The title block": ADOPTED.** One shared-rule plate on the page ground,
  three cells, each a whole-row link: the officer's title and one-line body
  verbatim, the separate button label dropped, and a 48px navy key with a drawn
  chevron at the right end, so the three keys stack into one navy stripe down
  the plate's edge. Above it, a short hub-only field band carrying only the
  centred h1, chevron notch kept. No reveal on the destinations. Estimated at
  360×640: check-in bottom ≈311px (today 424), all three in the first screen.
  Adopted because it keeps the tool on the page ground with each destination's
  name and explanation in one read — Operate ranks that above expression — and
  makes equal formatting structural. ✅ **The officer approved A as proposed on
  2026-09-19 — including both calls it needed a yes on: dropping the separate
  button labels, and the short hub-only band.**
- **B — "The field console": REJECTED.** The whole hub on the drawn navy field:
  three full-width white buttons carrying the names, descriptions beneath in
  white/80. Faster still (check-in bottom ≈198px), but it makes the hero the
  control surface where DESIGN.md §Grounds gives controls the `white` ground and
  the field to heroes and feature bands, and it puts each description after its
  button. Shown to the officer beside A; not chosen.

## Evidence
Adopted lookups from `receipts/evidence.md` (raw output in
`receipts/evidence.output.md`); the rejected and deferred ones are recorded
there, misses included.
- **EV1** — touch target size (ux, High): 44pt iOS / 48dp Android; web floor 24
  CSS px. → Every destination target is at least 48px tall (Interaction).
- **EV5** — keyboard navigation and focus states (ux, High): tab order matches
  visual order; a visible ring on every operable control. → The row links'
  keyboard contract (Interaction).
- **EV7** — next/link for internal navigation (nextjs, High). → Destinations stay
  `<Link>`s at the default prefetch, which serves the speed bar (Interaction).
- **EV14** — hover vs tap (ux, High): never rely on hover alone. → The row-link
  affordance is visible at rest; hover only swaps ink (Interaction).

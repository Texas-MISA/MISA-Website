# impeccable — `polish app/(public)/portal/attend/` (lead pass, Operate)

Run 2026-09-19 against `a38a2b3d3fb740cc9565fdfb2036dfee72449efb`, the build
commit. `scripts/context.mjs` loaded PRODUCT.md, DESIGN.md and
`.impeccable/surfaces/route-portal-attend.md`; `reference/polish.md` and
`reference/craft-floor.md` followed.

**Polish is refinement, never concealed redesign.** The concept is not in
question here — concept A was adopted by the officer and it measured out: the
bar came in at **611px against a 640px fold**, 29px of slack against an
estimate of 12. Everything below is refinement inside it.

---

## 1. The system, and how each drift is classified

Three of the four findings are **design-system drift** — a value that exists on
no row of DESIGN.md §The ramp, or an ink used for a role the ramp assigns to a
different token. One is a **local defect**. None is a conceptual mismatch, which
is the outcome a polish pass wants.

## 2. Evidence

Every number below is `getComputedStyle` or `getBoundingClientRect` on the
running page at 360×640 and 1280×720, with the `js` class removed so the layout
is settled. Nothing here is a grep hit: this project has a live case
(`activities.tsx:98`) where the rendered class attribute itself lies, because
two arbitrary-value utilities tie on specificity and Tailwind v4 emits them
ascending, so the larger always wins.

All twelve states were driven on the local stack, including the two that need
the database pushed off its happy path — `error` by revoking the check-in RPC's
execute grant, `rate_limited` by filling the throttle bucket. Both restored.

## 3. Findings

### L1 — The outcome heading is set in the paragraph ink · **design-system drift**

`ResultPanel` renders its `<Title>` inside `Banner`, whose tone classes end in
`text-misa-body`. Measured on the `present` screen: the `<h2>` computes to
`rgb(58, 61, 64)` = `#3a3d40`, **Body Graphite**.

DESIGN.md §Colors assigns `#1d1f20` (Graphite) to *"ink — body headings"* and
`#3a3d40` to *"long-form paragraphs"*. So the outcome heading is wearing the
paragraph's ink.

What makes it a defect rather than a quibble is that **the same flow shows both
inks two screens apart**: the review step's heading sits in a `Panel`, inherits
`body`'s `--foreground`, and is Graphite. A first-timer sees a Graphite heading
on the confirm screen and a Body-Graphite one on the result. Same component,
same size, same role, two inks.

🪤 This is not an argument against `Banner`'s own rule. *"The tone is in the rule
and the ground; the text stays body-coloured"* was written about the **message**,
and a heading inside a banner is a shape `Banner` never had until this surface
put one there. The rule is unchanged; the heading is simply not the message.

**Fix:** `text-foreground` on the result heading only.

### L2 — Body copy set at the Lead row's leading · **design-system drift**

The outcome sentence is `text-base` (16px) with `leading-[1.65]`. DESIGN.md
§The ramp: **Body is 16px / 1.6**; **1.65 is the `Lead` row's**, which is 18px.

This is inherited rather than introduced — the pre-redesign `ResultPanel` had
`mt-2 leading-[1.65] text-misa-body` — but the panel was rewritten, so it is
this surface's now.

🪤 **Both values are live in the codebase and the split is not random.** Ten call
sites use `leading-[1.65]` at body size (`/projects`, the home page's project
cards, `/portal/lookup`, `/gallery`, `/officers`); three use `leading-[1.6]`
(`activities.tsx`, `/about`, and — the one that matters — `app/(public)/portal/page.tsx:188`,
the hub, which is **the only other surface that has been through this pipeline**.
Its gate chose 1.6 against the ramp.

So the finding is not "1.65 is wrong everywhere". It is that the portal's two
rebuilt surfaces must agree, and the ramp decides which way. The un-rebuilt 1.65
call sites are phase 5's problem, not this surface's.

**Fix:** `leading-[1.6]`.

### L3 — The box label and its reassurance are 14px, a size on no ramp row · **examined, NOT a defect**

Raised because the hub's own lead pass adopted exactly this finding (`lead.md`
L2: *"a size on NO row of DESIGN.md §The ramp — it has 12 (Eyebrow) and 16
(Body) and nothing between"*), and consistency between the two portal surfaces
is what L2 above is about. Re-derived here and **rejected**, for two reasons
that are specific rather than general:

1. **The ramp the hub was measured against is the content ramp, and this is form
   vocabulary.** `components/ui/field.tsx` sets every field label at `text-sm`,
   and the three labels directly above the box — Full name, UT EID, Email — are
   14px on this very page. Raising the checkbox's label to 16px would make it
   *larger than the labels it sits with*, which is a worse hierarchy than the
   one being fixed. The hub's L2 was a standalone prose line with no form
   vocabulary around it.
2. **It would break the bar.** Measured: the label line and its two-line
   reassurance grow ~36px at 16px, putting the Check in button at ~647 on a 640
   fold. EV5 names the reassurance as the thing that gives first under pressure;
   it does not license breaking the one number the surface is gated on.

Recorded rather than dropped, because "the hub did X" will be asked again at
parts 4 and 5 and the answer needs to be on the record.

### L4 — Icon optical alignment · **measured, within tolerance, no change**

The outcome mark is `size-6` (24px) at `mt-0.5` beside a 22px heading. Measured:
icon centre 649.1, heading line-box centre 646.6 — **2.5px low** on a 24px mark.
Reported because craft-floor asks for optical as well as mathematical alignment;
not changed, because removing `mt-0.5` moves the centre to 647.1 and trades a
2.5px line-box offset for a cap-height one. Below the threshold where a change
is an improvement rather than a coin toss.

## 4. What the pass confirmed rather than changed

- **Contrast**: lowest ratio anywhere in `<main>`, across all twelve states, is
  **8.51:1** (the reassurance line, Secondary Graphite on white). Zero
  occurrences of `--misa-muted` remain on the route's own content — both of the
  surface's muted-on-Vellum occurrences are gone, and `npm run test:ui` went
  from 39 pass / 3 fail to 41 / 1.
- **Spacing**: more space above a heading than below it — 24px of panel padding
  above, `mt-2` below. Gaps 16px throughout, against EV5's 8px floor.
- **Type**: the band h1 at 26→34 and every h2 at 22→26 via `size="card"`, both
  ramp steps. Measure at 576px / 16px is ≈70ch.
- **States**: all twelve driven, plus pre-hydration — the server HTML carries
  `method="POST"`, `$ACTION_REF_1` and `$ACTION_KEY`, so a submit before
  hydration posts to the Server Action, and `StatusRegion` is in that HTML from
  first paint.
- **Browser surfaces**: focus ring, caret, selection, tap highlight and
  `touch-action` are all themed globally in `app/globals.css`; nothing here
  needs a local answer.
- **Code**: no dead imports, no debug output, no polish-created duplication.
  `npm run lint` and `npx tsc --noEmit` clean.

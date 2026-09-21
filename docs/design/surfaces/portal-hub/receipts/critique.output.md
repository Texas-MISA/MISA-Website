# `/impeccable critique app/(public)/portal/page.tsx` — re-gate 2026-09-20

⚠️ **NOT DEGRADED.** Assessments A and B ran as two isolated parallel
sub-agents. Neither saw the other's output, neither was told what the other was
looking for, and neither was given the detector result.

📌 **One honest deviation from `critique.md`, declared rather than hidden.**
Neither assessment used a browser: the `design-reviewer` agent held it for step
5, and two CDP clients wedge the renderer on this machine. Instead the lead
measured the rendered page first — geometry at 320/360/390/768/1280, grounds,
every contrast ratio, every state, tab order, axe — and handed both assessments
the same measured evidence pack as data. So "browser inspection" was performed
once, by the lead, and shared; it was not skipped, and it was not performed
twice. 📌 The parent had also already run the detector (an empty array) before
synthesis, where `critique.md` asks that A finish first. An empty result anchors
judgement in no direction, and A's verdict was written before any detector
output entered its prompt — but the ordering is recorded rather than glossed.

---

## Assessment A — Design Review

### Design-specificity verdict

**Authored at the detail level, category-generic at the skeleton level, and
deliberately stripped of product character.**

The skeleton — three stacked rows of title + one-line description with a
right-pointing chevron — is the most common mobile list pattern in existence.
iOS Settings is this page. What is genuinely authored is one layer down: the
navy key is a **full-height 48px column**, not a chevron floating in right-hand
padding, so the three keys stack into one continuous navy stripe down the
plate's edge and the affordance is visible at rest on a device that never
hovers; the shared-rule plate is the project's own device, reused from
`KpiPlate`; the bleeding masthead rule is what converts a
heading-with-an-underline into a document masthead; and the two-ground focus
ring is the most specific thing on the page.

**The tension worth naming.** This site's design system is loud — drawn navy
fields, tilted photo plates, counter-scrolling marquees, 143 committed
photographs. The portal spends none of it, which is right for Operate mode. The
honest consequence: strip the site header and footer and this page would not
identify itself as MISA's. The only product-specific signal in the page's own
content is the word "MISA", three times — **the page's only brand signal and its
most redundant word are the same token**, and A4 proposes deleting it.

**Verdict: specific in execution, interchangeable in form, identity-dependent on
chrome it does not own.** For a tool a member uses for four seconds standing at
a door, a defensible trade.

### Nielsen heuristics

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | **3** | Control-level feedback is excellent. The gap is *current location*: the header's MEMBER PORTAL button carries `aria-current="page"` with no visual state, no desktop nav item is active on this route, and the navy band that used to say "you are in the portal" is gone. The `<h1>` is the only visible location marker left. |
| 2 | Match System / Real World | **4** | Plain language throughout; order matches real-world priority; no jargon. |
| 3 | User Control and Freedom | **3** | Nothing traps. The absent back link is correct — the hub is the top of its own tree. Not a 4 only because every exit belongs to chrome. |
| 4 | Consistency and Standards | **3** | The row text misregisters against the masthead and inverts across `sm`; "Points Leaderboard" arrives at a sheet titled "Leaderboard"; one boundary is stated by two identical hairlines 24px apart; press borrows the hover duration. |
| 5 | Error Prevention | **3** | No input, so labelling is the only guardrail — clear, except one label predicts the wrong destination title. |
| 6 | Recognition Rather Than Recall | **4** | All three options visible, each explained at the point of decision. Textbook. |
| 7 | Flexibility and Efficiency | **3** | Two taps from anywhere, prefetched, whole-row targets, tab order = reading order. No accelerators — officer policy. |
| 8 | Aesthetic and Minimalist Design | **4** | Four content elements, zero decoration, zero muted ink, lowest in-page ratio 8.51:1. |
| 9 | Error Recovery | **n/a** | The surface has no error states of its own; a layout failure lands on the public error boundary, a different surface. |
| 10 | Help and Documentation | **3** | The one-line bodies *are* the contextual help. Not a 4 because "do I need an account?" is unanswered and answering it is forbidden by the no-additions rule. |
| **Total** | | **30 / 36** | **83% — Good** (heuristic 9 `n/a`) |

### Cognitive load

**0 of 8 checklist items fail.** Single focus, chunking (3 in a group),
grouping, hierarchy, one-thing-at-a-time, progressive disclosure, working
memory — all pass. **Minimal choices: exactly 4** (three destinations plus the
officers line), at the Cowan limit and not over it. A fourth destination —
houses, bingo — puts it at 5 and forces the re-layout the brief already accepts.

### Emotional journey

**Arrival** is low-drama and high-certainty: a member taps a navy button reading
MEMBER PORTAL and lands on a white document whose first words are *Member
Portal*. **The peak is a non-event, and that is the achievement**: at 360×640
the check-in row's bottom edge is 267.2px against a 424px bar and the entire
sheet fits inside the fold — no scroll, no wait, no reveal, no loading.
**Valleys: none** — the page cannot disappoint because it never asks for
anything. **The cost, stated plainly:** removing the navy band removed the
portal's only moment of warmth, and the portal is now the coldest surface on the
site. That is the right trade for Operate mode, but it is a trade and it should
be on the record rather than discovered later as a complaint.

### Strengths

**S1 — the two-ground focus ring is the best-reasoned detail in this codebase**
(and see DR1/AU1: the reasoning was right and the paint was not).
**S2 — the sheet closes inside the fold**, 85 → 609.4 at 360×640, so "the sheet
is the page" is not an abstraction: on the target device the object is fully
legible as an object in one glance. This is the strongest evidence that the
un-reviewed replacement for the navy band was the right replacement.
**S3 — equal formatting is structural, not remembered**: three cells from one
`.map` over one shape, so making one louder means breaking the loop, which a
reviewer can see in a diff.

### Priority issues

**P1 — the masthead does not align with the rows, and the misregistration
inverts across `sm`.** 37 vs 45 at 360; 289 vs 281 at 1280. The plate bleeds by
exactly the sheet padding; the cell then re-pads by `px-6` = 24, which equals
neither 16 nor 32. **The sheet therefore has two left edges and they never
coincide at any width.** No single intent produces +8 on a phone and −8 on a
desktop; this is an unchecked constant. Fix inside this file:
`px-6` → `px-4 sm:px-8`. It is also the highest-value change on the page,
because it widens the phone text column 222 → 238px — the lever A4 wants and
nobody has pulled. ⚠️ Whether 238px takes the lookup body from three lines to
two must be **measured, not assumed**.

**P2 — one boundary, stated twice.** The masthead `hr` occupies 148.5–149.5 and
the plate's top border 173.5–174.5: two identical full-bleed hairlines, same
token, 24px apart, with nothing between. A document masthead's rule *is* the top
edge of its body. Unique to the hub — the other three `PortalSheet` callers open
with a form or a `<p>`.

**P3 — the one control that says "you are here" is a 48px navy no-op that shows
nothing.** Round 1a took the header's MEMBER PORTAL button to 48px on phones, so
it fills 79% of the bar. On `/portal` it links to the page you are on, carries
`aria-current="page"` and **no visual state**, while the same header's desktop
nav items *do* get one. One header, two current-state conventions, and the
loudest control uses the silent one. Shared chrome — not fixable in this surface.

**P4 — "Points Leaderboard" arrives at a sheet titled "Leaderboard".** One of
three. Small when every portal page opened with a navy band that announced
arrival; with the band gone **the masthead is the sole arrival confirmation**, so
this costs strictly more than it did when the copy was approved. A finding
*created* by the un-reviewed build.

**P5 — the sheet's whole identity rests on 1.12:1**, carried by a 1.84:1 frame
and a 6–8% shadow, for a user standing outdoors at an event. Not a WCAG failure
(a container boundary is not a UI-component boundary, and axe is clean). Filed
as robustness. **The mitigating fact is why it is P3-severity: the failure is
benign** — if the sheet vanishes the member still sees a title, a rule, three
rows and a line at 8.51:1 minimum. A composition whose signature device degrades
to harmless is a well-chosen composition.

### Verdicts on the two deferred findings

**A3 (the h1 restating the header button) — RESOLVED, and it must not be
actioned.** The 130.5px navy band that made it expensive is gone; the masthead
costs ~67px and there is 157px of headroom. Proximity got *worse* (52px apart,
where the band-era h1 was 90px below the button), but three reasons say keep it:
on the other three portal pages the masthead is not a restatement, so the
duplication is a one-page artifact of a four-page system that is otherwise
right; removing the band made all four portal pages identical sheets, so **the
masthead is now the only per-page identity in the portal**; and — decisively —
per P3 the `<h1>` is the *only* visible "you are here" on this page. Deleting it
would remove the page's sole location marker to solve a problem caused by a
control that refuses to mark location. **The correct lever is P3, in shared
chrome.**

**A4 / B3 (the 92.7 / 118.3 / 143.9 rake) — the geometry complaint does not
survive; the copy observation does.** The rake is real and the box model
reproduces it exactly, at 320 and 360 only. But every row, the officers line and
the sheet's bottom edge are **all inside the 640 fold** — nothing is pushed
off-screen, nothing is reached later, nothing is harder to tap, and the check-in
row is 92.7px against a 48px floor. Size is not functioning as a rank cue,
because the reader's cue is **order**, and check-in is first and topmost. What
*is* visible is that the chevron's vertical centre drifts from the title it
points at as rows grow — ~15px on row 1, ~40px on row 3 — so by the third row it
sits beside the second line of body copy. Four things weigh against the proposed
remedy: the officer's "may change" list names the hero, the row titles, the
button labels and the officers line and **conspicuously omits the bodies**; each
body is verbatim its destination's `metadata.description`, so both files would
have to move together; it would probably leave a 1/2/2 rake rather than equality;
and it deletes the page's only product-specific content.

---

## Assessment B — Detector + rendered evidence

Measurement only; severity left to A. Every ratio and every geometry number
re-derived independently from `app/globals.css` and the source.

- **B1 — the layout-family declaration names a family the page does not render,
  and its section count is wrong.** Declared "Band … field + chevron notch" and
  "TWO sections"; `PortalSheet` emits one `<Section>` and there is zero `field`
  ground, zero chevron notch and zero band. Contradicted 90 lines below in the
  same file. The eyebrow arithmetic survives either count — `ceil(1/3)` and
  `ceil(2/3)` are both 1, and the page renders zero `<Eyebrow>`.
- **B2 — the ground and ratio given as the *reason* for the officers line's ink
  describe a ground it no longer sits on.** `#6f7275` on `#f2f2f3` = 4.33 and
  `#4a4d50` on `#f2f2f3` = 7.60, both reproduced — correct *for grey*. The line
  is on white at **8.51**, as the same file says 200 lines later.
- **B3 — "Lowest ratio anywhere on the route is 7.60:1" is false in both
  directions and is contradicted two lines above itself** by the footer's 4.84:1.
  Verified the premise: the header is `bg-white`, the footer sets no background
  and sits on a white `body`. True values: the page bottoms out at 8.51:1, the
  route at 4.84:1.
- **B4 — two 16px `--misa-secondary` paragraphs in one surface render at two
  different leadings.** Row bodies `leading-[1.6]` → 25.6px (the ramp's Body
  row); the officers line has no leading class, inherits 1.5 → 24px. Derivable
  from the measured 32.0px box: 16 × 1.5 + 8.
- **B5 — the page's left edge lands at three x positions and the offset flips
  sign between breakpoints.** Same finding as A's P1, measured independently.
  Cross-checked: 222 at 360 = 318 − 48 − 48, and 670 at 1280 = 766 − 48 − 48.
- **B6 — the officers sign-in link is the page's one target below the brief's own
  EV1 floor.** 44.9 × 32. WCAG 2.2 §2.5.8 passes; EV1's 44/48 does not. The
  file's own comment says "on a page whose every other target is 48px+ (EV1)",
  which is confirmed true of every other target. Note EV1's brief line is scoped
  to *"Every destination target"*, and this is not a destination — so it is
  outside the brief's letter and inside the gap the comment's wording opens.
- **B7 — the key's focus ring is a closed rectangle, so it paints a fourth edge
  inside the indicator at the seam.** Derived from the code, not measured: CSS
  `outline` always draws four sides and a three-sided one is not expressible.
  (The lead's pixel diff later showed the true state is worse than B7 predicted —
  see design-review DR1.)
- **B8 — three stale source citations; the cited contents are all correct.**
  `app/globals.css:318` for `:focus-visible` is now line 359; `globals.css:594`
  for `.sheet` is now 635; `DESIGN.md:894` cites `page.tsx:42` for a comment now
  at 56–70.
- **B9 — three comment numbers describe a layout that no longer exists.** (a) the
  423px baseline is past-tense and true, but the file records no post-rebuild
  figure; (b) *"`mt-6`, not `mt-8`: the line was landing at y 632 on a 640px
  screen"* — the officers line's bottom is now 588.4 and `mt-8` would put it at
  596.4, still inside the fold, so the stated reason no longer holds; (c) the
  441-vs-423 note is internally consistent and confirms the 18px reveal offset.
- **B10 — the bar figure disagrees across four documents; 267.2 is the one that
  reproduces.** 265.5 appears in DESIGN.md:71, `officer.md`, `officer.output.md`
  and the plan. 267.22 falls out of the CSS chain exactly: 61 + 24 + 1 + 20 +
  26.52 + 16 + 1 + 24 + 1 + 92.70. 265.5 does not.
- **B11 — 13px in shared chrome, on no ramp row.** `site-footer.tsx:45`,
  `text-[13px]` on the muted email; `.skip-link` likewise. Not this surface.
- **B12 — the header's MEMBER PORTAL button is 29.0px tall at `sm`+.** Shared
  chrome. Listed only because it is the site's one door to this surface.

### The detector, and what it is structurally unable to see

`[]`, exit 0, with and without `--no-advisory`. **Suppression is not the
explanation:** `ignoreRules` and `ignoreFiles` are empty and all three
`ignoreValues` scope to `app/globals.css` and `tests/design-detector.test.ts`.

Planted probes in a temp file under the same directory:

| Planted | Flagged? |
|---|---|
| `text-[19px] sm:text-[47px]` (on no ramp row) | **No** |
| `text-sm` (14px, on no ramp row) | **No** |
| `p-[13px]` (off-scale spacing) | **No** |
| `bg-[#ff00aa] text-[#123456]` (literal hex in a utility) | **No** |
| `style={{ fontSize: "14px" }}` | **No** |
| `style={{ color: "#abcdef" }}` | **Yes** — `design-system-color`, advisory |

🔴 **The type-ramp rule is not merely blind to `text-sm` — it is switched off
entirely.** `normalizeDesignSystem` populates `allowedFontSizes` only from
`frontmatter.typography`, and **DESIGN.md's frontmatter has no `typography`
key** (it declares `name`, `description`, `version`, `status`, `colors`,
`elevation`, `radius`, `durations`, `easing`). So `hasFontSizes` is false and
`design-system-font-size` abstains — *including for the arbitrary `text-[Npx]`
values it is supposed to be good at*. Same for fonts, and the radius key is
`radius:` where the reader wants `rounded:`. Only `hasColors` is true. Against a
`.tsx` file on this project the detector has exactly one thing it can say: a
literal colour in an inline style. This page has none, so `[]` was structurally
guaranteed before the file was written. **This is a toolkit finding, not a
surface finding, and it is the strongest argument yet for the pipeline's other
six steps.**

### Checked and found correct

Every size on the page is on a ramp row (h1 26→34, h2 22→26 via `size="card"`
and not the className form the ramp's own trap note bans, bodies and officers
line 16). The entire geometry table reproduces from the source to the hundredth.
The negative margins track the sheet's padding at both breakpoints. Every
contrast ratio in the evidence pack recomputed and confirmed. Zero hard-coded
colours, zero off-scale spacing, zero off-ramp sizes. Destination targets clear
both 24×24 and 44/48. `.sheet` sets no `overflow`, so nothing clips the ring.
`robots` correct on the hub and absent on `/portal/attend`. No `data-reveal`
anywhere. Three cells are one `.map` over one shape.

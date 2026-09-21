# `/impeccable critique app/(public)/portal/attend/`

Run at `77d2c568ed093f78a6b437e053bbef0533eff9e4`.

**Provenance:** Assessment A (design review) and Assessment B (detector +
rendered evidence) ran as **two isolated sub-agents, in parallel**, neither
seeing the other's output, and neither seeing the lead's. Not degraded.
One constraint declared to both: **live browser automation was reserved by the
`design-reviewer` agent** for the whole of their run, so each worked from the
source, the primitives, and a captured evidence set — fifteen full-page states
plus per-state JSON carrying every text node's size, ink, actual ground and
measured contrast ratio, the heading and alert lists, the focusable list with
heights, `overflowPx` and `document.activeElement`. Each contrast run
self-checks on the WCAG reference pairs (`#767676` on white = 4.54, black on
white = 21.00), and both assessments re-derived the ratios they quote.

---

## Design-specificity verdict (Assessment A)

**Partially specific — the frame is unmistakably MISA, the task inside it is
not.**

The shell is this product's and nobody else's: one white `.sheet` on the grey
ground, a masthead over a rule that bleeds to the sheet's edges, square
structure with a single 4px radius reserved for the object that floats,
hairlines, desaturated earth status inks rather than signal lights, Barlow
Condensed uppercase controls. The officer's "remove the navy header" was
answered with an idea rather than a deletion.

Strip the words out of the middle and the task is a generic three-field signup:
three identically weighted grey slabs on an even rhythm, a checkbox, a full-width
primary. Nothing in the composition knows this is a check-in happening *in a
room, right now, on a phone at waist height*. Two specifics:

- **The page never names the event.** `page.tsx` renders
  `<PortalSheet title="Event Check-In">` with no event data; `state.eventTitle`
  first appears on the success screen. A member who scans the door QR takes it on
  trust that they are in the right place until after they have committed. *The
  honest fix changes behaviour — the server would have to resolve and pass the
  open event — so it is out of scope and goes to the officer.*
- **The three fields are ranked equally although they are not equivalent.** The
  EID is the key that resolves the member and the field most likely to be
  mistyped from memory. DESIGN.md owns the instrument — *"monospace means an
  identifier… an EID is transcribed by hand off a phone screen"* — and scopes it
  to `/admin`, so the system knows an EID is a special thing and the one page
  where a member types one under pressure cannot say so.

## Nielsen heuristics (Assessment A) — 30/40, "Good"

| # | Heuristic | Score | Evidence |
|---|---|---|---|
| 1 | Visibility of system status | **2** | The outcome layer is near-perfect — twelve states, an atomic live region, per-state focus. Two gaps: nothing announced or reassured **while the action was in flight**, and the page never shows which event or whether check-in is open. |
| 2 | Match to the real world | **4** | "I haven't checked in with this form before"; "We found you."; "tell an officer — it may not be published yet." Zero jargon; "UT EID" is the real-world name. |
| 3 | User control and freedom | **3** | "Edit details" preserves values and says so; every failure echoes them back. No exit from a terminal screen, and a wrong EID that created a roster row has no undo. |
| 4 | Consistency and standards | **3** | One `Banner`, one button skin, one control skin. Deviations: `caution` means both "act now" and "you're done, wait"; type runs 12/14/16px **backwards** against urgency; the outcome mark was body-ink on all four tones while its panel was tone-coloured. |
| 5 | Error prevention | **3** | A two-step proofread before any roster row; a checkbox safe to tick either way; `autoCapitalize="none" autoCorrect="off" spellCheck={false}` on the EID; `inputMode="email"`; a honeypot. |
| 6 | Recognition over recall | **3** | Every label visible above its field (EV12 honoured, no placeholders anywhere); `autoComplete` fills two of three; the review step shows all three values. |
| 7 | Flexibility and efficiency | **3** | The fast path really is one submit, one screen; Enter submits and Confirm is first in DOM order so Enter confirms; the whole flow works with JS disabled. |
| 8 | Aesthetic and minimalist design | **3** | Nothing decorative; one layout family; the sheet is an idea, not a container. Hierarchy is flat where it should be steep — on every terminal screen the masthead out-shouts the outcome (26/34 vs 22/26). |
| 9 | Error recovery | **3** | Plain-language errors beside their fields, `role="alert"`, values preserved, focus moved. But the smallest type on the page is the text naming what to fix. |
| 10 | Help and documentation | **3** | Help sits exactly where the decision is made and answers the question actually being asked. It was also the quietest text in the form. |

## Cognitive load (Assessment A) — one clear failure, one soft

Single focus, chunking, one-thing-at-a-time, minimal choices, working memory and
progressive disclosure all pass. **No decision point anywhere exceeds two visible
options.**

- **Grouping — soft fail.** `gap-4` puts the same 16px between Email and the
  checkbox row as between the three inputs, so proximity groups the box with the
  fields it is not a member of: it is the only element on the page that is a
  *claim about yourself* rather than a value to type.
- **Visual hierarchy — fail.** On idle the largest, darkest thing is "Event
  Check-In", a label for a page the member arrived at deliberately by scanning
  its QR; below it, three identically weighted grey slabs with no rank.

## Emotional journey (Assessment A)

Arrival is neutral-competent; filling is plausible inside 20 seconds with the
phone filling two of three fields. **The valley is submit** — the button greyed,
the page went silent, focus dropped to `<body>`, and the only signal was a
control fading to roughly half strength (`disabled:opacity-50` composites the
navy to about 2.92:1 against the sheet and the white label to about 1.8:1 on
it). Short on good wifi and unbounded on bad.

**The peak is the outcome, and the words carry it alone.** "You're checked in!",
the event named in bold, an atomic announcement — but the affirm wash is
**1.11:1** against the white sheet it sits on (caution 1.10, critical 1.12), the
hairline over it is 2.14–2.38, and the 24px mark was drawn in the sentence's own
ink on all four outcomes. Held at arm's length, or glanced at for half a second
before the phone goes back in a pocket, it read as *a card with words on it*.

**The named high-stakes moment — "We don't have that info on file", in a room
full of people — is better than it gets credit for**: second person, two concrete
causes named *before* the member's status, never "not a member", and the banner's
last clause quotes the checkbox label word for word while the box below is drawn
in a 2px caution outline, so the sentence ends on the control. Two things
undercut it: the copy is 14px where the do-nothing screens get 16, and the button
that acts on the advice sits 122px below the fold at 360 (bottom 713.5) — told
what to do, then made to go looking for the way to do it. That second point is
measured, recorded and **settled as non-gating by the officer**, so it is journey
context, not a re-filing.

**The ending** is one onward action. On present / pending / duplicate that is a
good ending. On **refused** it is the wrong one: nothing was recorded, so the
link leads to a page that will show the member nothing about the problem they
have.

## Strengths (Assessment A)

1. **The failure screens are designed as carefully as the success screen**, which
   is rare. The unmatched banner quotes the checkbox label verbatim so a scanning
   member finds the control, and the box it names carries a 2px caution *outline*
   at offset 4 — an outline, not a border, so the idle state pays zero pixels for
   a state it never shows. The tone was chosen on a measurement: `info`'s wash is
   `bg-misa-panel`, the same Vellum `controlClass` fills the inputs with, so on
   this white sheet the banner carrying the officer's named failure would have
   rendered as a fourth, empty form control.
2. **The accessibility work is structural, not sprinkled.** One always-mounted
   `role="status" aria-atomic` region carries exactly the outcomes nothing else
   announces, and the four terminal panels deliberately dropped their own
   `role="status"` so nothing double-reads. The focus split is principled: a
   screen that *continues* the task takes focus, a screen that *ends* it
   announces politely and leaves focus alone.
3. **The measured decisions are real measurements**, and the flow works with
   JavaScript off — a full page POST returning the success screen, which on
   saturated venue wifi is worth more than any optimisation on this page.

---

## Assessment B — the detector, and what it can actually see here

```
node .claude/skills/impeccable/scripts/detect.mjs --json \
  "app/(public)/portal/attend/page.tsx" \
  "app/(public)/portal/attend/_components/checkin-form.tsx"
→ []    EXIT=0
```

Re-run with `--no-config` (bypassing ignores, inline waivers and DESIGN.md):
also `[]`. Nothing is being suppressed — `config.json`'s three `ignoreValues`
are scoped to `app/globals.css` and `tests/design-detector.test.ts`.

**Assessment B then established what that zero is worth**, by loading the real
design system rather than assuming:

```
hasFonts     : false   (allowedFonts    = [])
hasColors    : true    (106 allowed color keys)
hasRadii     : false   (allowedRadii    = [])
hasFontSizes : false   (allowedFontSizes = [])
```

Three of the four gates are **off**, from a key-name mismatch between DESIGN.md
and the detector's schema:

| detector reads | DESIGN.md frontmatter has | result |
|---|---|---|
| `frontmatter.typography` | *absent* | `hasFonts` false, `hasFontSizes` false |
| `frontmatter.rounded` | **`radius:`** | `hasRadii` false |
| `sidecar.extensions.roundedMeta` | `extensions.radii` | still false |
| `frontmatter.colors` + `sidecar…colorMeta` | both present | `hasColors` **true** |

The font-size gate is dead twice over: even with a `typography` key, only
*non-fluid enumerated* steps count, and DESIGN.md's ramp lives in a **Markdown
table** the frontmatter parser never reads.

**Proved with planted probes** on a scratch copy, deleted afterwards:

| probe | reported? |
|---|---|
| `className="text-[17px]"` | **no** |
| `className="rounded-[9px]"` | **no** |
| `style={{ borderRadius: "9px" }}` (the exact JS form the matcher is written for) | **no** |
| `style={{ fontSize: "17px" }}` (likewise) | **no** |
| `style={{ color: "#ff00aa" }}` | **yes** — `design-system-color`, exit 2 |

So the gates are off, not the matchers. **On this repo the detector is a
colour-literal scanner and nothing more.** The one live rule genuinely passes:
neither surface file contains a raw colour anywhere.

## Assessment B — verification of the rendered claims

| claim | verdict |
|---|---|
| every text node in `<main>` ≥ 4.5:1; lowest 8.51:1 | **holds** — 128 measured nodes across 15 states, **zero** below 4.5:1; lowest is `#4a4d50` on white, independently recomputed at 8.51 |
| `--misa-muted` paints nowhere on this surface | **holds** — `Field` is never called with a hint, and the old `text-misa-muted` wrapper is gone |
| `overflowPx` 0 at 320 and 360 on every state | **holds for every capture**, but only **one** state exists at 320 — "every state at 320" was over-stated |
| the long-value fixtures are 117 and 64 characters | **false** — they are **111** and **65** (plus a 32-character EID) |
| every heading `rgb(29,31,32)`; h1 26→34, h2 22→26 | **holds**; the ≥`sm` half verified at 1280 (and, from the lead's sweep, at 640 and 768) |
| "every focusable ≥ 48px except the 1280 lookup link" | **does not hold, and the exception is backwards** — 48.0 *meets* the floor; the real sub-48 control is the **16 × 16 checkbox `<input>`**, mitigated by its 84px `min-h-12` label |
| no console errors on any state | **holds** — `[]` on all 15 |

Assessment B also named three capture artefacts nobody should read as findings:
nine `0 × 0` "focusables" (React's `$ACTION_*` fields and the confirm step's
hidden carriers), and a `smallText` key that lists only the 15px button even in
states carrying 14px labels and 12px errors.

## Assessment B — the type ramp, by hand, since the detector abstains

**The two surface files declare zero font sizes and zero colours of their own.**
Every value arrives through a `components/ui/` primitive; there is no raw hex,
`rgb()` or `text-[Npx]` in either file. On the ramp: 26→34 (h1), 22→26 (card
titles), 16 (body, `Banner size="md"`, the review `<dl>`, the inputs — the last a
**documented exception**, iOS Safari zooms below 16px). Off it: **15px** (every
button label, from `buttonClass` size `md`) and **14px** (`Field`'s labels,
`Banner`'s default `sm`, the checkbox label and its hint). `banner.tsx` says so
itself. Both are `components/ui/` and DESIGN.md's ramp table, not this surface.

## Where the two assessments and the lead agreed independently

- **The in-flight state** — Assessment A's P2, the audit's T1, `web-design-
  guidelines`' G2 and the `design-reviewer`'s DR1, none of which saw the others.
  Four steps, one defect.
- **The 16 × 16 checkbox** — Assessment A's minor observation, Assessment B's
  correction to the focusable claim, and DR's tap-target note.
- **15px and 14px off the ramp** — Assessment B's table and Assessment A's
  heuristic 4.

## Where an assessment corrected the lead, in flight

- **Assessment B caught the fix's own arithmetic.** The box-model chain written
  into `page.tsx` said `3 × 16` under a total of 591.52 — an expression that
  reaches 575.52. The form has **four** `gap-4` gaps, which the same file's
  comment at the form already stated. Corrected before the commit.
- **Assessment B counted the fixtures** — 111 and 65 characters, not 117 and 64.
- **Assessment A overturned the lead's L7** with the wash measurement the lead
  had not taken.

## Withdrawn by the assessments themselves

Assessment A drafted an error-prevention finding that `noValidate` costs both a
server round trip *and* a rate-limit slot on a blank field, then checked:
`checkinSchema.safeParse` runs at `app/actions/attendance.ts:96` and returns at
`:107`, **before** `hashClientIp("checkin")` at `:125`. An invalid submit spends
no slot. Not filed.

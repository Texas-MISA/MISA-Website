---
skill: design-reviewer
command: design-reviewer agent on surface portal-hub at http://localhost:3000/portal (360 / 768 / 1280)
date: 2026-09-19
commit: "23fab67c3edd28001eafd034e8566b67fc94c1f5"
output: design-review.output.md
findings:
  - id: DR1
    summary: "Medium — keyboard focus state at every width: the row focus ring is invisible where it crosses the navy key. The outline computes to `rgb(22,48,92)` and the key's background is `rgb(22,48,92)` — identical, 1.00:1 — so the focused row reads as a box around the white cell that stops dead at the seam."
    disposition: adopted
    fix_commit: "ab3f6c9c8054754eb491871edaf176a361371219"
  - id: DR2
    summary: "Medium — default state at 360: the officers' \"sign in\" link is a 39.3 × 17px tap target (14px, no padding) against the 48px this surface sets and WCAG 2.2's 24px floor, and it lands at y 632.6–652.6 on a 640px screen, so it must be scrolled to and then hit at 17px."
    disposition: adopted
    fix_commit: "ab3f6c9c8054754eb491871edaf176a361371219"
  - id: DR3
    summary: "Nit — hover state at 1280: the title's hover swap is #16305C → #0D1D38 (13.03:1 → 16.4:1 on white), two dark navies near-indistinguishable at 34px, so the hover reads almost entirely as the key block darkening."
    disposition: rejected
    reason: "The navy ramp is the only ramp this page may use — DESIGN.md's Rare Navy Rule refuses a second accent or any tint outside Pressed↔Drafting, so there is no larger swap available without breaking a named rule. The finding also correctly notes it is not a defect against EV14: the affordance is the navy key at rest, not the hover. 📌 Kept as a recorded observation because it sharpens why the *press* state (M1/A1) mattered so much — the one interaction cue this page had was doing less than it appeared to."
  - id: DR4
    summary: "Nit — default state at 1280: the plate is 768px wide with 104.3px rows, so roughly 490px of each row is empty white between the body text and the key."
    disposition: rejected
    reason: "The brief's own test for this is \"1280 without the column turning into a sparse strip\", and the finding concedes that test is met. Filling the space would mean adding content, which the officer excluded outright (\"nothing else is added — no orienting line, no live data, no imagery\"). Assessment A measured the same geometry independently and read it as \"a deliberate centred object\", recommending no action."
---

Run with Playwright rather than Claude in Chrome: this machine's 1.75 device
pixel ratio made the extension's window sizing return a 643px CSS viewport when
asked for 360, and the agent switched rather than report geometry it could not
trust. The same constraint was hit independently by critique Assessment B.

## 🔴 DR1 is the finding this gate exists for

It was **missed by the lead, by `web-design-guidelines`, by the detector, and —
in the sense that matters — by critique Assessment B**, which measured the same
ring and reported it "visible on all three rows, drawn fully inside its own
cell, not clipped", having explicitly retracted an earlier flag as its own
arithmetic error. Both reports are accurate. **B tested placement; DR1 tested
colour.** A ring can be perfectly placed and still be no indicator at all.

⚠️ **CLAUDE.md's "a review is a set of claims, not an inventory" cuts both
ways here, and this is the first time it has cut in this direction.** The rule
was written after phase 4, where two of five findings were *wrong about the
code*. This is the inverse: a confident, well-measured "not reproduced" that
refuted a proposition nobody had made. The lead re-derived it against
`app/globals.css:318-326` and the compiled stylesheet before adopting, rather
than averaging the two reports or taking the more recent one.

📌 **The page had already reasoned about this ring, carefully, and still missed
it.** Its comment argues — correctly — that the global `outline-offset: 2px`
would draw across the 1px seam onto the neighbouring cell, and that
`-outline-offset-2` fixes that. The argument is sound and the fix is real. It
is an argument about *where*, on the one component in the portal that spans two
grounds, where the open question was *what colour, over each*.

## Verified by this review, and worth recording as verified

- **The gate bar.** At 360×640, settled, under the 61px sticky header, the
  check-in row's bottom edge is **328.6px** against a bar of ≤424 — 95px of
  margin — and all three destinations sit inside the first 640px screen
  (lookup bottom 599.6). Measured with the `js` class removed from `<html>`,
  which is the method the brief prescribes; the agent confirmed there is no
  `data-reveal` in `main` at all, so there was nothing to force and nothing to
  wait for.
- **Zero muted ink in the surface's own content**, every ink measured on the
  ground it actually sits on. Lowest ratio on the route: 7.60:1.
- **Tab order** skip link → menu/nav → wordmark → MEMBER PORTAL → the three
  rows in order → sign in, matching reading order exactly (EV5), every stop in
  view, every stop with a 2px ring.
- **Ring placement** correctly inset and not crossing the seam — the claim the
  page's comment makes, independently confirmed.
- **No horizontal overflow** at any width; **console completely clean** — zero
  errors, zero warnings, zero hydration messages at all three widths.
- **JS off / reduced motion** identical to default: no `data-reveal` anywhere
  in `main`, so all three destinations render at `opacity: 1` and are usable.

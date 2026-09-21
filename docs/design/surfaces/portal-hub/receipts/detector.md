---
skill: impeccable
command: node .claude/skills/impeccable/scripts/detect.mjs --json --no-advisory "app/(public)/portal/page.tsx"
date: 2026-09-20
commit: "a660ada662ead1f827746d68f57421a98084c5b2"
output: detector.output.json
findings: []
---

The detector returned an empty array — **zero hits**, exit 0, with and without
`--no-advisory`. One finding per hit, so the list is empty. Run against the
surface's own file; `components/ui/portal-sheet.tsx` is a shared primitive in
`components/ui/` and belongs to no surface, so it is scanned but not owned here
(DESIGN.md: *"a change to a shared primitive in `components/ui/` does not make
any surface stale"*).

**Not pre-suppressed, and verified rather than assumed.**
`.impeccable/config.json` has empty `ignoreRules` and empty `ignoreFiles`, and
all three `ignoreValues` entries scope to `app/globals.css` and
`tests/design-detector.test.ts` — **nothing scopes to this surface or to
`components/ui/`.** No ignore entry was added at this gate either; the plan's
rule is to suppress at phase 5 against the ramp that actually ships, or not at
all.

## 🔴 A clean detector is not a clean surface, and this run is a sharper proof than the last one

The 2026-09-19 receipt recorded that the scan cannot see `text-sm`, and that two
type-ramp defects were therefore found by the lead and the critique instead.
**That understated it.** The critique's Assessment B planted six probes in a temp
file beside this one:

| Planted | Flagged? |
|---|---|
| `text-[19px] sm:text-[47px]` (on no ramp row) | **No** |
| `text-sm` (14px, on no ramp row) | **No** |
| `p-[13px]` (off-scale spacing) | **No** |
| `bg-[#ff00aa] text-[#123456]` (literal hex in a utility) | **No** |
| `style={{ fontSize: "14px" }}` | **No** |
| `style={{ color: "#abcdef" }}` | **Yes** — `design-system-color`, advisory |

🔴 **The type-ramp rule is not blind to `text-sm`; it is switched off
entirely.** `normalizeDesignSystem` populates `allowedFontSizes` only from
`frontmatter.typography`, and **DESIGN.md's frontmatter has no `typography`
key** — it declares `name`, `description`, `version`, `status`, `colors`,
`elevation`, `radius`, `durations` and `easing`. So `hasFontSizes` is false and
`design-system-font-size` abstains, *including for the arbitrary `text-[Npx]`
values it is supposed to be good at*. The same holds for fonts, and the radius
rule reads a `rounded:` key where the frontmatter writes `radius:`. Only
`hasColors` is true.

**Against a `.tsx` file on this project the scan has exactly one thing it can
say: a literal colour in an inline style object.** This page contains no inline
styles and no colour literals, so `[]` was structurally guaranteed before the
file was written. Everything geometric in the detector —
`first-viewport-column-overflow`, `text-occlusion`, `low-contrast`,
`cramped-padding`, `skipped-heading`, `tiny-text`, `line-length`,
`heading-rhythm` — is browser-engine-only and never ran.

📌 **None of this gate's thirteen adopted findings is in a shape this scan could
express.** The focus ring that did not paint, a cell padding that does not match
its container's, two leadings on one ink, a 32px target, and three comments that
contradict the build — all came from the other six steps. Recorded as
`critique.md` B9 and deferred to the phase, because the fix is in DESIGN.md's
frontmatter or in the skill, and adding a `typography` key would change what the
detector reports on every registered surface, including the two still
`in-progress`.

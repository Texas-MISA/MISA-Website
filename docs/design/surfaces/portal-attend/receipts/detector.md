---
skill: impeccable
command: node .claude/skills/impeccable/scripts/detect.mjs --json --no-advisory "app/(public)/portal/attend/page.tsx" "app/(public)/portal/attend/_components/checkin-form.tsx"
date: 2026-09-20
commit: "77d2c568ed093f78a6b437e053bbef0533eff9e4"
output: detector.output.json
findings: []
---

The detector returned an empty array — **zero hits**, exit 0 — so there is
exactly one finding per hit and the list is empty. Run against the surface's own
two files; `components/ui/banner.tsx`, `button.tsx`, `field.tsx`, `heading.tsx`
and `portal-sheet.tsx` are shared primitives in `components/ui/` and belong to no
surface (DESIGN.md: *"a change to a shared primitive in `components/ui/` does not
make any surface stale"*).

## 🔴 A clean detector is not a clean surface — and this run is worth less than that

The 2026-09-19 receipt recorded the scan as green on a build that was
simultaneously overflowing the viewport by 588px, setting an `<h2>` in the
paragraph ink, painting the unmatched alert the colour of the inputs below it,
and leaving focus on `<body>` in five of twelve states. All 25 findings that
gate came from the other six steps.

**Round 2 then proved the type-ramp rule is switched off rather than blind, and
this run re-derived that independently rather than repeating the claim** —
CLAUDE.md's own rule that a review is a set of claims, not an inventory.

**By mechanism.** `scripts/detector/design-system.mjs` builds the allowlist in
`normalizeDesignSystem()`:

```js
addTypographySizes(out, frontmatter.typography);   // the ONLY source
…
out.hasFontSizes = out.allowedFontSizes.some(entry => !entry.fluid);
```

`frontmatter` is DESIGN.md's YAML head. **DESIGN.md has no `typography:` key**
(it has `name`, `description`, `version`, `status`, `colors`, `elevation`), so
`allowedFontSizes` stays empty, `hasFontSizes` is `false`, and the rule abstains
for everything. The same is true of `rounded:`, which is also absent.

**By probe.** A copy of `page.tsx` carrying three planted values was scanned with
the same flags:

| planted | reported? |
|---|---|
| `className="text-[17px]"` — not on any ramp row | **no** |
| `className="rounded-[9px]"` — not on the radius scale | **no** |
| `style={{ color: "#ff00aa" }}` | **yes** — `design-system-color`, "Undocumented color #ff00aa is outside DESIGN.md colors" |

So the colour rule works — `colors:` *is* in the frontmatter — and the two rules
that would police this surface's type ramp and radii are not running at all.
📌 **Treat this `[]` as no evidence.** It rules out an undocumented literal
colour on these two files and nothing else.

📌 **`--no-advisory` does not suppress an advisory-severity finding**, which the
probe also showed: the colour hit came back at `"severity": "advisory"` with the
flag set. Worth knowing before anyone reads a future empty array as "no advisory
findings either".

# Install UI/Design Skills — Instructions for Claude Code

**How to use this file:** save it in your project root and tell Claude Code:
> Read `install-ui-skills.md` and follow it. Ask me before running anything that writes outside `.claude/`.

---

## 0. Rules for the agent

1. **Verify before you run.** These repos change fast (install names, flags, versions). Before each install, `WebFetch` the repo README and confirm the command still matches. If it doesn't, use the README's command and tell me what changed.
2. **Never install all five silently.** Show me the plan, wait for approval, then run installs one at a time and report the result of each before moving on.
3. **Project scope by default.** Install into `./.claude/skills/` unless I say "global." Global goes to `~/.claude/skills/`.
4. **Do not overwrite existing skills.** If a target directory already exists, stop and ask.
5. **No `sudo`, no global npm installs.** Everything here runs through `npx`.

---

## 1. Prerequisites

Run these first and report the output:

```bash
node -v          # need 20+; Impeccable's detect CLI wants 24+
npm -v
pwd              # confirm we're in the intended project root
ls -la .claude/skills 2>/dev/null || echo "no project skills dir yet"
```

If `node -v` is below 20, stop and tell me — don't try to upgrade Node yourself.

---

## 2. The five skills

Install in this order. Stop and report after each.

### 2.1 Emil Kowalski — design engineering & animation

Source: `github.com/emilkowalski/skills` (MIT). Bundle includes `emil-design-eng`, `review-animations`, `animation-vocabulary`, and a few more.

```bash
npx skills@latest add emilkowalski/skills --agent claude-code
```

Only want the main one (recommended — it's the highest-signal skill of the set):

```bash
npx skills@latest add emilkowalski/skills --skill emil-design-eng --agent claude-code
```

What it does: opinionated rules on easing curves, animation duration, when *not* to animate, and the small details that separate polished UI from default UI. Review output comes back as a Before/After/Why table.

---

### 2.2 Impeccable (Paul Bakaus) — design vocabulary + anti-slop detector

Source: `github.com/pbakaus/impeccable` (Apache 2.0). This one has its own installer and is the most invasive of the five — it can add a hook that runs on UI file edits.

**Preferred path** (installs the Claude Code–native build):

```bash
npx impeccable install
```

Then, inside Claude Code:

```
/impeccable init
```

`init` scans tokens, components, and Tailwind config and writes `PRODUCT.md` (and optionally `DESIGN.md`) to the project root. **Ask me before running `init`** — it creates files outside `.claude/`.

Alternatives if the installer misbehaves:

```
/plugin marketplace add pbakaus/impeccable      # Claude Code plugin route
```
```bash
npx skills add pbakaus/impeccable --agent claude-code   # generic build, one payload for all harnesses
```

**Hook warning:** the installer may write a hook into `.claude/settings.local.json` that runs Impeccable's detector on UI edits. If you see it being added, tell me before proceeding — I want to know it's there before it starts firing on every save.

Staying current later: `npx impeccable check`, then `npx impeccable update`.

Usage: `/impeccable audit src/components/`, `/impeccable polish <page>`, `/impeccable critique landing`.

---

### 2.3 Taste Skill (Leonxlnx) — anti-slop frontend styling

Source: `github.com/Leonxlnx/taste-skill` (MIT). The repo ships 13+ skills. **Do not install the whole bundle** — it bloats the skill list with variants I won't use.

Install just the main one:

```bash
npx skills add Leonxlnx/taste-skill --skill "design-taste-frontend" --agent claude-code
```

Note: `--skill` takes the *install name* from the SKILL.md frontmatter, not the folder name. `design-taste-frontend` is v2. If it behaves oddly, v1 is pinned at `design-taste-frontend-v1`.

Optional extras — ask me first, don't add by default:
- `high-end-visual-design` — "make it look expensive" ruleset
- `redesign-existing-projects` — audit-first upgrades to existing UI
- `minimalist-ui` / `industrial-brutalist-ui` — only when the visual direction is already locked

---

### 2.4 Vercel Web Design Guidelines

Source: `github.com/vercel-labs/agent-skills`, rules pulled live from `vercel-labs/web-interface-guidelines`.

```bash
npx skills add vercel-labs/agent-skills --skill web-design-guidelines --agent claude-code
```

This is a **reviewer**, not a generator — it fetches the current guidelines and reports findings in `file:line` format covering accessibility, interaction, and UX rules.

Optional additions:

```bash
curl -fsSL https://vercel.com/design/guidelines/install | bash
```
Adds the `/web-interface-guidelines` slash command. **Read the script before piping it to bash** and show me what it does.

Also worth doing: add an `AGENTS.md` at the project root referencing the guidelines so they apply during *generation*, not just review. Draft it and show me before writing.

---

### 2.5 Awesome Design Skills (bergside)

Source: `github.com/bergside/awesome-design-skills` — a registry of ~67 design-system `SKILL.md` files (glassmorphism, editorial, neobrutalism, premium, minimal, etc.). These are *aesthetic presets*, not review tools.

List what's available first, then let me pick:

```bash
npx typeui.sh list
```

Pull a chosen slug into Claude Code's path:

```bash
npx typeui.sh pull <slug> -p claude
npx typeui.sh pull <slug> -p claude --dry-run    # preview first
```

Or via the standard skills CLI:

```bash
npx skills add bergside/awesome-design-skills --skill <slug> --agent claude-code
```

**Install at most one or two style presets.** They're mutually exclusive by design — stacking five aesthetics produces mush.

---

## 3. Verify

```bash
ls -1 .claude/skills
ls -1 ~/.claude/skills 2>/dev/null
```

Then restart Claude Code (skills are scanned at session start) and confirm each skill appears in the skill list. Report anything that installed but doesn't show up.

---

## 4. Resolve the overlap — this step is not optional

All five of these have opinions about typography, color, spacing, and motion, and they *will* contradict each other. Without a precedence rule, whichever one loads gets to override the others at random.

Append a section like this to `CLAUDE.md` (draft it, show me, then write):

```markdown
## Design skill precedence

- **Generating new UI:** use ONE primary aesthetic skill per project.
  Default primary: impeccable (product UI) or design-taste-frontend (marketing/landing).
- **Animation and motion:** emil-design-eng always wins. Other skills defer to it
  on easing, duration, and whether something should animate at all.
- **Pre-ship review:** run web-design-guidelines for accessibility and interaction
  rules. Its findings override aesthetic preferences when they conflict.
- **Style presets (awesome-design-skills):** only load when I name the preset
  explicitly. Never auto-apply.
- If two skills conflict and the rule above doesn't settle it, ask me. Don't average them.
```

---

## 5. Housekeeping

Decide with me before committing:

```bash
# If skills should be shared with collaborators, commit them:
git add .claude/skills && git commit -m "Add UI design skills"

# If they're personal, gitignore instead:
echo ".claude/skills/" >> .gitignore
echo ".claude/settings.local.json" >> .gitignore
```

`.claude/settings.local.json` is machine-local and should stay gitignored regardless.

---

## 6. Rollback

```bash
rm -rf .claude/skills/<skill-name>        # remove one
```

For Impeccable specifically, also remove the hook entry from `.claude/settings.local.json` and delete `PRODUCT.md` / `DESIGN.md` if I don't want to keep them. For the plugin install route, remove it from the `/plugin` menu instead.

---

## Quick reference

| Skill | Repo | Role |
|---|---|---|
| emil-design-eng | emilkowalski/skills | Motion + craft details |
| impeccable | pbakaus/impeccable | Design vocabulary, 23 commands, detector |
| design-taste-frontend | Leonxlnx/taste-skill | Anti-slop generation |
| web-design-guidelines | vercel-labs/agent-skills | A11y + UX review |
| awesome-design-skills | bergside/awesome-design-skills | Style preset registry |

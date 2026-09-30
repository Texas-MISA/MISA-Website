# Third-party licences for the vendored design skills

`.claude/skills/` vendors six third-party skills (DESIGN.md §Design toolkit), and
this repository is public — so their licence texts travel with them here. They
sit beside the skills rather than inside them because `skills-lock.json` pins
each skill folder by a content hash, and a file added to a folder would read as a
local modification. Fetched from each upstream repository on 2026-09-18.

| Skill | Upstream | Licence | File here |
|---|---|---|---|
| `design-taste-frontend` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | MIT | `design-taste-frontend.LICENSE` |
| `emil-design-eng` | [emilkowalski/skills](https://github.com/emilkowalski/skills) | MIT | `emil-design-eng.LICENSE` |
| `impeccable` (4.1.1) | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | Apache-2.0, with a NOTICE | `impeccable.LICENSE`, `impeccable.NOTICE.md` |
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | MIT | `ui-ux-pro-max.LICENSE` |
| `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | Apache-2.0 | inside the skill: `.claude/skills/frontend-design/LICENSE.txt` |
| `web-design-guidelines` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | MIT, **per its README only** | none — see below |

⚠️ **`vercel-labs/agent-skills` publishes no LICENSE file.** Its README's
*License* section says MIT, and that is the whole of the grant; there is no
licence text or copyright line to reproduce. The vendored skill is one small
SKILL.md that fetches Vercel's guidelines at run time. If a LICENSE file appears
upstream, add it here.

📌 **Not to be confused with Anthropic's `frontend-design` PLUGIN** in
`anthropics/claude-code`, which is under Anthropic's commercial terms ("All
rights reserved"). The skill vendored here is the Apache-2.0 one from
`anthropics/skills`, and it was chosen for exactly that reason.

When a skill is updated (`docs/install-ui-skills.md`), re-fetch its licence.

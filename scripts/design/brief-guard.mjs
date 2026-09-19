#!/usr/bin/env node
// PreToolUse hook (.claude/settings.json): refuses an Edit or Write to a
// registered design surface's files until that surface has a brief.
//
// The brief is step 1 of the pipeline in DESIGN.md §Design toolkit. v1 of the
// redesign failed because the skills were advisory and work began without
// them; this makes "start with the brief" structural rather than remembered.
// Exit 2 blocks the tool call and shows stderr to Claude. Anything unexpected
// (no registry, unreadable input) exits 0: a broken guard must not wedge
// unrelated edits.
//
// 🔓 The bypass is MISA_DESIGN_GUARD=off in the environment Claude Code was
// LAUNCHED with — a person's decision, e.g. a check-in hotfix at the door that
// cannot wait for a brief. Claude cannot set it: the Bash tool's shell is not
// the environment this hook inherits.
// 🪤 The hook sees Edit/Write/MultiEdit only. A shell edit (sed, a heredoc)
// is not intercepted; tests/design-receipts.test.ts is the backstop.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

if (process.env.MISA_DESIGN_GUARD === "off") process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const target = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path;
if (!target) process.exit(0);

let registry;
try {
  registry = JSON.parse(
    readFileSync(path.join(root, "docs/design/surfaces.json"), "utf8")
  );
} catch {
  process.exit(0);
}

const rel = path
  .relative(root, path.resolve(root, target))
  .split(path.sep)
  .join("/");

for (const [name, surface] of Object.entries(registry.surfaces ?? {})) {
  const owns = (surface.files ?? []).some((f) =>
    f.endsWith("/") ? rel.startsWith(f) : rel === f
  );
  if (!owns) continue;

  const brief = `docs/design/surfaces/${name}/brief.md`;
  if (existsSync(path.join(root, brief))) process.exit(0);

  process.stderr.write(
    `Blocked: ${rel} belongs to the design surface "${name}", which has no brief.\n` +
      `Write ${brief} first (template: docs/design/templates/brief.md), per DESIGN.md §Design toolkit, step 1.\n`
  );
  process.exit(2);
}

process.exit(0);

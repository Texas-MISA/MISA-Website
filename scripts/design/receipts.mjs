#!/usr/bin/env node
// The receipt checker (DESIGN.md §Design toolkit). tests/design-receipts.test.ts
// runs it over every registered surface; /design-gate runs it as a CLI:
//
//   node scripts/design/receipts.mjs [surface ...]     (default: every surface)
//
// A receipt is docs/design/surfaces/<surface>/receipts/<step>.md with YAML
// frontmatter. It proves three things the phase records could not:
//   1. the skill RAN       — `output` points at its committed raw output;
//   2. it was READ         — every finding carries a disposition, and a
//                            rejection carries a reason;
//   3. it MATTERED         — at least one finding was adopted, in a commit
//                            that touches the surface's files.
// Plus freshness: a surface file changed after review, by a commit no receipt
// names as a fix, means the shipped code is not the reviewed code.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { JSON_SCHEMA, load } from "js-yaml";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

// Lead skill per mode. Persuade = public marketing pages; Operate = task tools.
export const LEADS = {
  persuade: "design-taste-frontend",
  operate: "impeccable",
};

// Every step a rebuilt surface must carry, and the skill that owns it.
// `lead` resolves per mode; `motion` is required only when the surface moves.
export const STEPS = {
  diverge: "frontend-design",
  evidence: "ui-ux-pro-max",
  lead: "lead",
  critique: "impeccable",
  audit: "impeccable",
  guidelines: "web-design-guidelines",
  "design-review": "design-reviewer",
  detector: "impeccable",
  motion: "emil-design-eng",
};

// Steps whose findings can count as "a skill changed the outcome".
const REVIEW_STEPS = [
  "diverge",
  "lead",
  "critique",
  "audit",
  "guidelines",
  "design-review",
  "motion",
];

const DISPOSITIONS = new Set(["adopted", "rejected", "deferred"]);
const MOTION_SIGNAL =
  /data-reveal|from ["']motion|animate-|transition-|@keyframes|useReducedMotion/;

export function loadRegistry(root = ROOT) {
  return JSON.parse(
    readFileSync(path.join(root, "docs/design/surfaces.json"), "utf8")
  );
}

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function listFiles(root, entries) {
  const out = [];
  for (const entry of entries) {
    const abs = path.join(root, entry);
    if (!existsSync(abs)) continue;
    if (statSync(abs).isFile()) {
      out.push(abs);
      continue;
    }
    const tracked = git(root, ["ls-files", "--", entry]);
    for (const f of tracked.split("\n").filter(Boolean)) {
      out.push(path.join(root, f));
    }
  }
  return out;
}

export function surfaceMoves(root, surface) {
  return listFiles(root, surface.files).some((f) =>
    MOTION_SIGNAL.test(readFileSync(f, "utf8"))
  );
}

export function parseReceipt(file) {
  const text = readFileSync(file, "utf8");
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) throw new Error("no YAML frontmatter");
  return load(match[1], { schema: JSON_SCHEMA }) ?? {};
}

export function requiredSteps(root, surface) {
  return Object.keys(STEPS).filter(
    (step) => step !== "motion" || surfaceMoves(root, surface)
  );
}

// Returns a list of problems; an empty list means the surface passes.
export function checkSurface(name, surface, root = ROOT) {
  const problems = [];
  const dir = path.join(root, "docs/design/surfaces", name);
  const rel = (p) => path.relative(root, p).split(path.sep).join("/");

  if (!LEADS[surface.mode]) {
    problems.push(`mode must be persuade or operate, got "${surface.mode}"`);
    return problems;
  }
  if (!existsSync(path.join(dir, "brief.md"))) {
    problems.push(`missing ${rel(path.join(dir, "brief.md"))}`);
  }

  const receipts = {};
  for (const step of requiredSteps(root, surface)) {
    const file = path.join(dir, "receipts", `${step}.md`);
    if (!existsSync(file)) {
      problems.push(`missing receipt ${rel(file)}`);
      continue;
    }
    let r;
    try {
      r = parseReceipt(file);
    } catch (e) {
      problems.push(`${rel(file)}: ${e.message}`);
      continue;
    }
    receipts[step] = r;

    const owner = STEPS[step] === "lead" ? LEADS[surface.mode] : STEPS[step];
    if (r.skill !== owner) {
      problems.push(`${step}: skill must be "${owner}", got "${r.skill}"`);
    }
    for (const key of ["command", "date", "commit", "output"]) {
      if (!r[key]) problems.push(`${step}: missing "${key}"`);
    }
    if (r.output) {
      const out = path.join(dir, "receipts", r.output);
      if (!existsSync(out) || readFileSync(out, "utf8").trim() === "") {
        problems.push(`${step}: output "${r.output}" is missing or empty`);
      }
    }
    if (r.commit) {
      try {
        git(root, ["cat-file", "-e", `${r.commit}^{commit}`]);
      } catch {
        problems.push(`${step}: commit ${r.commit} does not exist`);
      }
    }
    if (!Array.isArray(r.findings)) {
      problems.push(`${step}: "findings" must be a list (empty is allowed)`);
      continue;
    }
    for (const [i, f] of r.findings.entries()) {
      const label = `${step} finding ${f?.id ?? i + 1}`;
      if (!f?.summary) problems.push(`${label}: missing summary`);
      if (!DISPOSITIONS.has(f?.disposition)) {
        problems.push(`${label}: disposition must be adopted|rejected|deferred`);
      }
      if (f?.disposition !== "adopted" && !f?.reason) {
        problems.push(`${label}: a ${f?.disposition ?? "finding"} needs a reason`);
      }
      if (f?.disposition === "adopted" && !f?.fix_commit) {
        problems.push(`${label}: an adopted finding needs fix_commit`);
      }
    }
  }

  // It mattered: an adopted review finding, fixed in a commit on this surface.
  const surfacePaths = surface.files.map((f) => f.replace(/\/$/, ""));
  const touchesSurface = (sha) => {
    try {
      const changed = git(root, ["show", "--name-only", "--format=", sha]);
      return changed
        .split("\n")
        .some((c) => surfacePaths.some((p) => c === p || c.startsWith(p + "/")));
    } catch {
      return false;
    }
  };
  const fixCommits = new Set();
  let mattered = false;
  for (const step of REVIEW_STEPS) {
    for (const f of receipts[step]?.findings ?? []) {
      if (f?.fix_commit) fixCommits.add(String(f.fix_commit));
      if (f?.disposition === "adopted" && f.fix_commit && touchesSurface(f.fix_commit)) {
        mattered = true;
      }
    }
  }
  if (Object.keys(receipts).length > 0 && !mattered) {
    problems.push(
      "no review finding was adopted in a commit touching this surface — the skills ran but changed nothing"
    );
  }

  // Freshness: every surface change after the earliest review is a named fix.
  const reviewed = Object.values(receipts)
    .map((r) => r.commit)
    .filter(Boolean);
  if (reviewed.length > 0) {
    let base;
    try {
      base = git(root, ["merge-base", "--octopus", ...reviewed.map(String)]);
    } catch {
      base = null;
    }
    if (base) {
      const later = git(root, [
        "log",
        "--format=%H",
        `${base}..HEAD`,
        "--",
        ...surfacePaths,
      ])
        .split("\n")
        .filter(Boolean);
      const known = [...fixCommits];
      for (const sha of later) {
        const named = known.some((k) => sha.startsWith(k) || k.startsWith(sha));
        const isReviewed = reviewed.some((k) => sha.startsWith(String(k)));
        if (!named && !isReviewed) {
          problems.push(
            `stale: ${sha.slice(0, 7)} changed the surface after review and no receipt names it — re-run /design-gate`
          );
        }
      }
    }
  }

  return problems;
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { surfaces } = loadRegistry();
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(surfaces);
  let failed = false;
  for (const name of names) {
    const s = surfaces[name];
    if (!s) {
      console.error(`${name}: not in docs/design/surfaces.json`);
      failed = true;
      continue;
    }
    const problems = checkSurface(name, s);
    console.log(`${name} (${s.status}): ${problems.length ? "FAIL" : "ok"}`);
    for (const p of problems) console.log(`  - ${p}`);
    if (problems.length && s.status === "rebuilt") failed = true;
  }
  process.exit(failed ? 1 : 0);
}

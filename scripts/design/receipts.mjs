#!/usr/bin/env node
// The receipt checker (DESIGN.md §Design toolkit). tests/design-receipts.test.ts
// runs it over every registered surface; /design-gate runs it as a CLI:
//
//   node scripts/design/receipts.mjs [surface ...]     (default: every surface)
//
// A receipt is docs/design/surfaces/<surface>/receipts/<step>.md with YAML
// frontmatter. Together they prove what the phase records never could:
//   1. the skill RAN       — `output` points at its committed raw output;
//   2. it was READ         — every finding carries a disposition, and anything
//                            not adopted carries a reason;
//   3. it MATTERED         — at least one REVIEW finding was adopted, in a
//                            commit that touches the surface's files;
//   4. it was USED         — two concepts were weighed, every evidence lookup
//                            the lead adopted is cited in the brief, and every
//                            detector hit has a disposition;
//   5. it is FRESH         — no surface commit after a review goes unnamed.

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

// Never required. The officer's own review at the gate: changes the officer
// asked for, each a finding with its fix commit, so freshness can name them.
// It never counts as "a skill changed the outcome" — the officer is not one.
export const OPTIONAL_STEPS = { officer: "officer" };

// Steps that come BEFORE the build (steps 2–3). Their `commit` records what
// the concepts were drawn against; the build that follows is their purpose, so
// freshness never applies to them — every build commit would read as stale.
const PRE_BUILD_STEPS = new Set(["diverge", "evidence"]);

// Steps whose adopted findings prove a skill changed the outcome. `diverge`
// is generation, not review — adopting a concept is how every build starts,
// so it would satisfy the rule on its own and prove nothing.
const REVIEW_STEPS = [
  "lead",
  "critique",
  "audit",
  "guidelines",
  "design-review",
  "motion",
];

// The brief's required headings. They mirror docs/design/templates/brief.md,
// which follows impeccable's shape brief plus what this project adds.
export const BRIEF_HEADINGS = [
  "## Mode and lead",
  "## Job and audience",
  "## Outcome and proof",
  "## States",
  "## Constraints carried in",
  "## Diverge",
  "## Evidence",
];
const BRIEF_PLACEHOLDER = /Operate \| Persuade|<surface>|<route>|\bTODO\b/;

const DISPOSITIONS = new Set(["adopted", "rejected", "deferred"]);
const SHA = /^[0-9a-f]{7,40}$/;
const MOTION_SIGNAL =
  /data-reveal|from ["']motion|animate-|transition-|duration-\d|@keyframes|useReducedMotion/;

export function loadRegistry(root = ROOT) {
  return JSON.parse(
    readFileSync(path.join(root, "docs/design/surfaces.json"), "utf8")
  );
}

// --literal-pathspecs: route folders carry glob characters — `[token]` is a
// character class to git unless told otherwise.
function git(root, args) {
  return execFileSync("git", ["--literal-pathspecs", ...args], {
    cwd: root,
    encoding: "utf8",
  }).trim();
}

// A registry entry is a file, or a directory with or without a trailing
// slash; both callers (this and brief-guard.mjs) match it the same way.
export function surfacePaths(surface) {
  return surface.files.map((f) => f.replace(/\/+$/, ""));
}

export function ownsPath(surface, rel) {
  return surfacePaths(surface).some((p) => rel === p || rel.startsWith(p + "/"));
}

function listFiles(root, surface) {
  const out = [];
  for (const entry of surfacePaths(surface)) {
    const abs = path.join(root, entry);
    if (!existsSync(abs)) continue;
    if (statSync(abs).isFile()) {
      out.push(abs);
      continue;
    }
    for (const f of git(root, ["ls-files", "--", entry]).split("\n").filter(Boolean)) {
      out.push(path.join(root, f));
    }
  }
  return out;
}

export function surfaceMoves(root, surface) {
  return listFiles(root, surface).some((f) =>
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

// 🪤 An unquoted SHA is not always a string: YAML reads `1836e72` as the float
// 1.836e+75 and `1234567` as an integer. The message says how to fix it,
// because "commit 1.836e+75 does not exist" would send anyone the wrong way.
function shaProblem(label, value) {
  if (typeof value !== "string") {
    return `${label} must be a QUOTED string — YAML read ${JSON.stringify(value)} as a ${typeof value}`;
  }
  if (!SHA.test(value)) return `${label} "${value}" is not a commit SHA`;
  return null;
}

// The brief is impeccable's surface brief (.impeccable/surfaces/<slug>.md), so
// the lead loads it on every command. Existence is the hook's job; this checks
// that it was actually filled in, for the mode the registry says.
export function checkBrief(surface, root = ROOT) {
  const problems = [];
  if (!surface.brief) return ["registry entry has no `brief` path"];
  const file = path.join(root, surface.brief);
  if (!existsSync(file)) return [`missing brief ${surface.brief}`];
  const text = readFileSync(file, "utf8");
  if (!/^---\r?\n[\s\S]*?primary_target:[\s\S]*?\r?\n---/.test(text)) {
    problems.push(
      "brief has no impeccable frontmatter — write it with surface-brief.mjs (see the template)"
    );
  }
  for (const h of BRIEF_HEADINGS) {
    if (!text.includes(h)) problems.push(`brief is missing "${h}"`);
  }
  if (BRIEF_PLACEHOLDER.test(text)) problems.push("brief still has template placeholders");
  const mode = /\*\*Mode:\*\*\s*(Operate|Persuade)/i.exec(text)?.[1]?.toLowerCase();
  if (mode !== surface.mode) {
    problems.push(`brief's **Mode:** is "${mode ?? "missing"}", registry says "${surface.mode}"`);
  }
  return problems;
}

// Returns a list of problems; an empty list means the surface passes.
export function checkSurface(name, surface, root = ROOT) {
  const dir = path.join(root, "docs/design/surfaces", name);
  const rel = (p) => path.relative(root, p).split(path.sep).join("/");

  if (!LEADS[surface.mode]) {
    return [`mode must be persuade or operate, got "${surface.mode}"`];
  }
  const problems = [...checkBrief(surface, root)];
  const briefText =
    surface.brief && existsSync(path.join(root, surface.brief))
      ? readFileSync(path.join(root, surface.brief), "utf8")
      : "";

  const receipts = {};
  const optional = Object.keys(OPTIONAL_STEPS).filter((s) =>
    existsSync(path.join(dir, "receipts", `${s}.md`))
  );
  for (const step of [...requiredSteps(root, surface), ...optional]) {
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

    const declared = STEPS[step] ?? OPTIONAL_STEPS[step];
    const owner = declared === "lead" ? LEADS[surface.mode] : declared;
    if (r.skill !== owner) {
      problems.push(`${step}: skill must be "${owner}", got "${r.skill}"`);
    }
    for (const key of ["command", "date", "commit", "output"]) {
      if (r[key] === undefined || r[key] === null || r[key] === "") {
        problems.push(`${step}: missing "${key}"`);
      }
    }
    let output = null;
    if (r.output) {
      const out = path.join(dir, "receipts", String(r.output));
      if (!existsSync(out) || readFileSync(out, "utf8").trim() === "") {
        problems.push(`${step}: output "${r.output}" is missing or empty`);
      } else {
        output = readFileSync(out, "utf8");
      }
    }
    if (r.commit !== undefined) {
      const bad = shaProblem(`${step}: commit`, r.commit);
      if (bad) problems.push(bad);
      else {
        try {
          git(root, ["cat-file", "-e", `${r.commit}^{commit}`]);
          try {
            git(root, ["merge-base", "--is-ancestor", r.commit, "HEAD"]);
          } catch {
            problems.push(
              `${step}: commit ${r.commit} is not in this branch's history — receipts must name commits that survive; merge, never squash`
            );
          }
        } catch {
          problems.push(`${step}: commit ${r.commit} does not exist`);
        }
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
      if (f?.disposition === "adopted" && step !== "evidence" && step !== "diverge") {
        if (f?.fix_commit === undefined) {
          problems.push(`${label}: an adopted finding needs fix_commit`);
        } else {
          const bad = shaProblem(`${label}: fix_commit`, f.fix_commit);
          if (bad) problems.push(bad);
        }
      }
    }

    // Used, not just run.
    if (step === "diverge" && r.findings.length < 2) {
      problems.push("diverge: needs at least two concepts — one concept is a decision, not a divergence");
    }
    if (step === "evidence") {
      if (r.findings.length === 0) {
        problems.push("evidence: no lookups recorded — the reference skill was not used");
      }
      for (const f of r.findings) {
        if (f?.disposition === "adopted" && f?.id && !briefText.includes(String(f.id))) {
          problems.push(`evidence ${f.id}: adopted but never cited in the brief`);
        }
      }
    }
    if (step === "detector" && output !== null) {
      let hits;
      try {
        hits = JSON.parse(output);
      } catch {
        hits = null;
      }
      if (!Array.isArray(hits)) {
        problems.push("detector: output must be the detector's --json array");
      } else if (hits.length !== r.findings.length) {
        problems.push(
          `detector: the output has ${hits.length} hit(s) but the receipt disposes of ${r.findings.length} — every hit needs a disposition`
        );
      }
    }
  }

  // Mattered: an adopted REVIEW finding, fixed in a commit on this surface.
  const touchesSurface = (sha) => {
    try {
      return git(root, ["show", "--name-only", "--format=", sha])
        .split("\n")
        .some((c) => ownsPath(surface, c));
    } catch {
      return false;
    }
  };
  let mattered = false;
  for (const step of REVIEW_STEPS) {
    for (const f of receipts[step]?.findings ?? []) {
      if (
        f?.disposition === "adopted" &&
        typeof f.fix_commit === "string" &&
        touchesSurface(f.fix_commit)
      ) {
        mattered = true;
      }
    }
  }
  if (Object.keys(receipts).length > 0 && !mattered) {
    problems.push(
      "no review finding was adopted in a commit touching this surface — the skills ran but changed nothing"
    );
  }

  // Fresh: per REVIEW step, every surface commit after that step's review is a
  // fix some receipt names (the officer receipt included). Pre-build steps are
  // exempt — see PRE_BUILD_STEPS.
  const named = Object.values(receipts)
    .flatMap((r) => (Array.isArray(r.findings) ? r.findings : []))
    .map((f) => f?.fix_commit)
    .filter((s) => typeof s === "string");
  const isNamed = (sha) => named.some((k) => sha.startsWith(k));
  const staleSteps = new Map();
  for (const [step, r] of Object.entries(receipts)) {
    if (PRE_BUILD_STEPS.has(step)) continue;
    if (typeof r.commit !== "string" || !SHA.test(r.commit)) continue;
    let later = [];
    try {
      later = git(root, ["log", "--format=%H", `${r.commit}..HEAD`, "--", ...surfacePaths(surface)])
        .split("\n")
        .filter(Boolean);
    } catch {
      continue; // reported above as a missing or foreign commit
    }
    for (const sha of later) {
      if (isNamed(sha)) continue;
      staleSteps.set(sha, [...(staleSteps.get(sha) ?? []), step]);
    }
  }
  for (const [sha, steps] of staleSteps) {
    problems.push(
      `stale: ${sha.slice(0, 7)} changed the surface after the ${steps.join(", ")} review and no receipt names it — re-run those steps, or record it in receipts/officer.md if the officer asked for it`
    );
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
    const problems = s.status === "legacy" ? [] : checkSurface(name, s);
    console.log(`${name} (${s.status}): ${s.status === "legacy" ? "not started" : problems.length ? "FAIL" : "ok"}`);
    for (const p of problems) console.log(`  - ${p}`);
    if (problems.length && s.status === "rebuilt") failed = true;
  }
  process.exit(failed ? 1 : 0);
}

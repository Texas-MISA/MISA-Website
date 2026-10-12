// The impeccable detector as a regression gate (DESIGN.md §Design toolkit).
//
// Its hook only advises during an edit; this makes a new finding fail
// `npm test`. The baseline is the set of findings accepted as standing, and
// it is EMPTY as of 2026-09-18 — app/ and components/ scan clean. Adding to
// .impeccable/baseline.json is a decision to record in a receipt, never a way
// to turn this green.
//
// 🪤 The detector EXITS 2 when it finds anything. execFileSync throws on that,
// before the baseline is consulted — so a baselined finding still failed, as
// "Command failed", with the findings buried in the error. detect() reads
// stdout whatever the status; only a missing or non-JSON stdout is a crash.
// The second test plants a finding to prove both halves, because a clean tree
// and an empty baseline cannot tell a working gate from a broken one.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { expect, it } from "vitest";

const ROOT = path.join(__dirname, "..");

type Finding = { antipattern?: string; file?: string; line?: number; snippet?: string };
const key = (f: Finding) =>
  `${f.antipattern}|${path.relative(ROOT, f.file ?? "").split(path.sep).join("/")}|${f.snippet ?? ""}`;

function detect(paths: string[]): Finding[] {
  const run = spawnSync(
    process.execPath,
    [".claude/skills/impeccable/scripts/detect.mjs", "--json", "--no-advisory", ...paths],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  try {
    return JSON.parse(run.stdout) as Finding[];
  } catch {
    throw new Error(`detector crashed (exit ${run.status}): ${run.stderr || run.stdout}`);
  }
}

it("the detector finds nothing outside the committed baseline", () => {
  const baseline = new Set(
    (JSON.parse(readFileSync(path.join(ROOT, ".impeccable/baseline.json"), "utf8")) as Finding[]).map(key)
  );
  const fresh = detect(["app", "components"]).filter((f) => !baseline.has(key(f)));
  expect(fresh.map((f) => `${key(f)} :${f.line ?? "?"}`)).toEqual([]);
}, 120_000);

it("a planted anti-pattern is found, and reported rather than thrown", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "detector-"));
  try {
    writeFileSync(
      path.join(dir, "planted.tsx"),
      'export const P = () => <div className="border-l-4 border-misa-blue">p</div>;\n'
    );
    expect(detect([dir]).map((f) => f.antipattern)).toContain("side-tab");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 120_000);

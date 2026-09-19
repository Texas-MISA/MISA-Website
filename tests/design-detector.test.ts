// The impeccable detector as a regression gate (DESIGN.md §Design toolkit).
//
// Its hook only advises during an edit; this makes a new finding fail
// `npm test`. The baseline is the set of findings accepted as standing, and
// it is EMPTY as of 2026-09-18 — app/ and components/ scan clean. Adding to
// .impeccable/baseline.json is a decision to record in a receipt, never a way
// to turn this green.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, it } from "vitest";

const ROOT = path.join(__dirname, "..");

type Finding = { antipattern?: string; file?: string; line?: number; snippet?: string };
const key = (f: Finding) =>
  `${f.antipattern}|${path.relative(ROOT, f.file ?? "").split(path.sep).join("/")}|${f.snippet ?? ""}`;

it("the detector finds nothing outside the committed baseline", () => {
  const out = execFileSync(
    process.execPath,
    [".claude/skills/impeccable/scripts/detect.mjs", "--json", "--no-advisory", "app", "components"],
    { cwd: ROOT, encoding: "utf8" }
  );
  const found = (JSON.parse(out) as Finding[]).map(key);
  const baseline = new Set(
    (JSON.parse(readFileSync(path.join(ROOT, ".impeccable/baseline.json"), "utf8")) as Finding[]).map(key)
  );
  expect(found.filter((k) => !baseline.has(k))).toEqual([]);
}, 120_000);

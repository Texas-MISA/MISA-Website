// The design toolkit's enforcement (DESIGN.md §Design toolkit).
//
// A surface marked "rebuilt" in docs/design/surfaces.json must carry a receipt
// for every pipeline step, each proving the skill ran, was read, and changed
// something. The checker lives in scripts/design/receipts.mjs so /design-gate
// can run the same rules as a CLI; this file runs them over the real registry
// and then proves the checker catches each failure it exists for.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  checkSurface,
  loadRegistry,
  ROOT,
  STEPS,
} from "../scripts/design/receipts.mjs";

const { surfaces } = loadRegistry() as {
  surfaces: Record<
    string,
    { mode: string; status: string; routes: string[]; files: string[] }
  >;
};

describe("the surface registry", () => {
  it.each(Object.entries(surfaces))("%s is well formed", (_name, s) => {
    expect(["persuade", "operate"]).toContain(s.mode);
    expect(["legacy", "in-progress", "rebuilt"]).toContain(s.status);
    expect(s.routes.length).toBeGreaterThan(0);
    for (const f of s.files) expect(existsSync(path.join(ROOT, f))).toBe(true);
  });
});

describe("rebuilt surfaces carry meaningful receipts", () => {
  // One test over all of them, so an empty set is a pass rather than an
  // empty suite. The failure message names every problem on every surface.
  it("every rebuilt surface passes the receipt checker", () => {
    const problems = Object.entries(surfaces)
      .filter(([, s]) => s.status === "rebuilt")
      .flatMap(([name, s]) => checkSurface(name, s).map((p) => `${name}: ${p}`));
    expect(problems).toEqual([]);
  });

  it("every surface whose redesign has started has a brief", () => {
    const missing = Object.entries(surfaces)
      .filter(([, s]) => s.status !== "legacy")
      .map(([name]) => name)
      .filter(
        (name) => !existsSync(path.join(ROOT, "docs/design/surfaces", name, "brief.md"))
      );
    expect(missing).toEqual([]);
  });
});

// A throwaway git repository, so the checker's git-dependent rules (fix
// commits, freshness) run against history this test controls.
describe("the checker catches what it exists to catch", () => {
  const repo = mkdtempSync(path.join(os.tmpdir(), "receipts-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
  afterAll(() => rmSync(repo, { recursive: true, force: true }));

  git("init", "-q");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "user.name", "fixture");
  // A fixture repository in the OS temp dir, deleted after the run. A global
  // commit.gpgsign would otherwise fail this file on any machine without a key,
  // and a global core.autocrlf (Windows) prints a CRLF warning per fixture file.
  git("config", "commit.gpgsign", "false");
  git("config", "core.autocrlf", "false");
  const write = (rel: string, body: string) => {
    mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    writeFileSync(path.join(repo, rel), body);
  };
  const commit = (msg: string) => {
    git("add", "-A");
    git("commit", "-q", "-m", msg);
    return git("rev-parse", "HEAD");
  };

  const surface = { mode: "operate", status: "rebuilt", routes: ["/x"], files: ["app/x/"] };
  write("app/x/page.tsx", "export default function X() { return null }\n");
  const reviewed = commit("surface");
  write("app/x/page.tsx", "export default function X() { return <main /> }\n");
  const fix = commit("fix a finding");

  const receiptsDir = "docs/design/surfaces/x/receipts";
  const receipt = (step: string, skill: string, findings: string) => {
    write(`${receiptsDir}/${step}.out.md`, "raw skill output\n");
    write(
      `${receiptsDir}/${step}.md`,
      `---\nskill: ${skill}\ncommand: run\ndate: 2026-09-18\ncommit: ${reviewed}\noutput: ${step}.out.md\nfindings: ${findings}\n---\n`
    );
  };
  const writeAll = (critiqueFindings: string) => {
    write("docs/design/surfaces/x/brief.md", "brief\n");
    for (const [step, owner] of Object.entries(STEPS)) {
      if (step === "motion") continue;
      const skill = owner === "lead" ? "impeccable" : owner;
      receipt(step, skill, step === "critique" ? critiqueFindings : "[]");
    }
  };

  it("an empty surface fails on every missing receipt", () => {
    const problems = checkSurface("x", surface, repo);
    expect(problems.some((p) => p.includes("brief.md"))).toBe(true);
    expect(problems.filter((p) => p.startsWith("missing receipt")).length).toBe(8);
  });

  it("receipts with no adopted finding fail: the skills changed nothing", () => {
    writeAll("[]");
    expect(checkSurface("x", surface, repo)).toContain(
      "no review finding was adopted in a commit touching this surface — the skills ran but changed nothing"
    );
  });

  it("a rejection without a reason fails", () => {
    writeAll(`\n  - id: C1\n    summary: s\n    disposition: rejected`);
    expect(checkSurface("x", surface, repo).join("\n")).toMatch(/needs a reason/);
  });

  it("an adopted finding fixed on the surface passes", () => {
    writeAll(`\n  - id: C1\n    summary: s\n    disposition: adopted\n    fix_commit: ${fix}`);
    expect(checkSurface("x", surface, repo)).toEqual([]);
  });

  it("an unreviewed later change makes the receipts stale", () => {
    writeAll(`\n  - id: C1\n    summary: s\n    disposition: adopted\n    fix_commit: ${fix}`);
    write("app/x/page.tsx", "export default function X() { return <div /> }\n");
    const sneak = commit("unreviewed change");
    expect(checkSurface("x", surface, repo).join("\n")).toContain(
      `stale: ${sneak.slice(0, 7)}`
    );
  });

  it("the wrong skill on a step fails", () => {
    writeAll(`\n  - id: C1\n    summary: s\n    disposition: adopted\n    fix_commit: ${fix}`);
    receipt("lead", "design-taste-frontend", "[]");
    expect(checkSurface("x", surface, repo).join("\n")).toMatch(
      /lead: skill must be "impeccable"/
    );
  });
});

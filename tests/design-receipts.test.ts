// The design toolkit's enforcement (DESIGN.md §Design toolkit).
//
// A surface marked "rebuilt" in docs/design/surfaces.json must carry a brief
// and a receipt for every pipeline step, proving each skill ran, was read, was
// used, and changed something. The checker lives in scripts/design/receipts.mjs
// so /design-gate can run the same rules as a CLI; this file runs them over the
// real registry, then proves the checker catches each failure it exists for —
// which is how a js-yaml import bug that failed EVERY receipt was found while
// the real registry, with nothing rebuilt yet, stayed green.

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  BRIEF_HEADINGS,
  checkBrief,
  checkSurface,
  loadRegistry,
  ROOT,
  STEPS,
} from "../scripts/design/receipts.mjs";

type Surface = {
  mode: string;
  status: string;
  routes: string[];
  files: string[];
  brief: string;
};
const { surfaces } = loadRegistry() as { surfaces: Record<string, Surface> };

describe("the surface registry", () => {
  it.each(Object.entries(surfaces))("%s is well formed", (_name, s) => {
    expect(["persuade", "operate"]).toContain(s.mode);
    expect(["legacy", "in-progress", "rebuilt"]).toContain(s.status);
    expect(s.routes.length).toBeGreaterThan(0);
    for (const r of s.routes) expect(r.startsWith("/")).toBe(true);
    for (const f of s.files) expect(existsSync(path.join(ROOT, f))).toBe(true);
  });

  // The brief is only worth writing if the lead skill reads it, and impeccable
  // finds a surface brief by the path it derives from the route. A registry
  // path that disagrees is a brief nothing ever loads.
  it.each(Object.entries(surfaces))("%s's brief is where impeccable looks", (_n, s) => {
    const expected = execFileSync(
      process.execPath,
      [".claude/skills/impeccable/scripts/surface-brief.mjs", "path", `route:${s.routes[0]}`],
      { cwd: ROOT, encoding: "utf8" }
    )
      .trim()
      .split(path.sep)
      .join("/");
    expect(s.brief).toBe(expected);
  });

  it("no file belongs to two surfaces", () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const [name, s] of Object.entries(surfaces)) {
      for (const f of s.files.map((x) => x.replace(/\/+$/, ""))) {
        for (const [other, by] of owner) {
          if (f === other || f.startsWith(other + "/") || other.startsWith(f + "/")) {
            clashes.push(`${f} (${name}) overlaps ${other} (${by})`);
          }
        }
        owner.set(f, name);
      }
    }
    expect(clashes).toEqual([]);
  });
});

describe("rebuilt surfaces carry meaningful receipts", () => {
  // One test over all of them, so an empty set is a pass rather than an empty
  // suite (Vitest 4 fails `it.each([])` as "No test found in suite").
  it("every rebuilt surface passes the receipt checker", () => {
    const problems = Object.entries(surfaces)
      .filter(([, s]) => s.status === "rebuilt")
      .flatMap(([name, s]) => checkSurface(name, s).map((p) => `${name}: ${p}`));
    expect(problems).toEqual([]);
  });

  it("every surface whose redesign has started has a complete brief", () => {
    const problems = Object.entries(surfaces)
      .filter(([, s]) => s.status !== "legacy")
      .flatMap(([name, s]) => checkBrief(s).map((p) => `${name}: ${p}`));
    expect(problems).toEqual([]);
  });
});

describe("there is one design source of truth", () => {
  // `ui-ux-pro-max --persist` writes design-system/<project>/MASTER.md and calls
  // it the "Global Source of Truth"; `/impeccable document` regenerates
  // DESIGN.md from code. Either would quietly replace the hand-written system.
  it("no competing design-system file exists", () => {
    expect(existsSync(path.join(ROOT, "design-system"))).toBe(false);
  });

  it("DESIGN.md is still the hand-written one", () => {
    const design = readFileSync(path.join(ROOT, "DESIGN.md"), "utf8");
    for (const heading of [
      "## Design invariants",
      "### Design toolkit",
      "### Photography and image slots",
    ]) {
      expect(design).toContain(heading);
    }
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

  const surface: Surface = {
    mode: "operate",
    status: "rebuilt",
    routes: ["/x"],
    files: ["app/x/"],
    brief: ".impeccable/surfaces/route-x.md",
  };
  // The real order: concepts and evidence are drawn against the page as it
  // was, THEN the build lands, THEN the reviews run against the build.
  write("app/x/page.tsx", "export default function X() { return 'old' }\n");
  const concepts = commit("the page before its redesign");
  write("app/x/page.tsx", "export default function X() { return null }\n");
  const reviewed = commit("the build");
  write("app/x/page.tsx", "export default function X() { return <main /> }\n");
  const fix = commit("fix a finding");

  const brief = (body = "") =>
    write(
      surface.brief,
      [
        "---",
        "version: 1",
        'slug: "route-x"',
        'primary_target: "route:/x"',
        "related_targets: []",
        "---",
        "",
        "## Mode and lead",
        "- **Mode:** Operate",
        ...BRIEF_HEADINGS.slice(1).map((h) => `${h}\nFilled in.`),
        "The layout follows EV1.",
        body,
      ].join("\n")
    );

  const dir = "docs/design/surfaces/x/receipts";
  const receipt = (
    step: string,
    skill: string,
    findings: string,
    opts: { commit?: string; output?: string } = {}
  ) => {
    const output = step === "detector" ? `${step}.output.json` : `${step}.output.md`;
    const reviewedAt = step === "diverge" || step === "evidence" ? concepts : reviewed;
    write(`${dir}/${output}`, opts.output ?? (step === "detector" ? "[]\n" : "raw skill output\n"));
    write(
      `${dir}/${step}.md`,
      [
        "---",
        `skill: ${skill}`,
        "command: run",
        "date: 2026-09-18",
        `commit: ${opts.commit ?? `"${reviewedAt}"`}`,
        `output: ${output}`,
        `findings: ${findings}`,
        "---",
        "",
      ].join("\n")
    );
  };
  const item = (id: string, disposition: string, extra = "") =>
    `\n  - id: ${id}\n    summary: s\n    disposition: ${disposition}${extra}`;
  const adoptedFix = item("C1", "adopted", `\n    fix_commit: "${fix}"`);
  // The adopted concept names the build commit — which touches the surface —
  // so the "an adopted concept is not a review finding" test below fails if
  // `diverge` ever counts towards "a skill changed the outcome".
  const DIVERGE =
    item("A", "adopted", `\n    fix_commit: "${reviewed}"`) +
    item("B", "rejected", "\n    reason: fights the grey ground");
  const EVIDENCE = item("EV1", "adopted");

  const writeAll = (critiqueFindings: string) => {
    brief();
    for (const [step, owner] of Object.entries(STEPS)) {
      if (step === "motion") continue;
      const skill = owner === "lead" ? "impeccable" : owner;
      const findings =
        step === "critique"
          ? critiqueFindings
          : step === "diverge"
            ? DIVERGE
            : step === "evidence"
              ? EVIDENCE
              : "[]";
      receipt(step, skill, findings);
    }
  };
  const problemsOf = () => checkSurface("x", surface, repo).join("\n");

  it("an empty surface fails on its brief and every missing receipt", () => {
    const problems = checkSurface("x", surface, repo);
    expect(problems).toContain("missing brief .impeccable/surfaces/route-x.md");
    expect(problems.filter((p) => p.startsWith("missing receipt")).length).toBe(8);
  });

  it("an adopted CONCEPT is not a review finding: the skills still changed nothing", () => {
    writeAll("[]");
    expect(problemsOf()).toContain(
      "no review finding was adopted in a commit touching this surface — the skills ran but changed nothing"
    );
  });

  it("a rejection without a reason fails", () => {
    writeAll(item("C1", "rejected"));
    expect(problemsOf()).toMatch(/C1: a rejected needs a reason/);
  });

  it("a complete, used, fresh set of receipts passes — the build after the concepts is not stale", () => {
    writeAll(adoptedFix);
    expect(checkSurface("x", surface, repo)).toEqual([]);
  });

  it("an UNQUOTED SHA that YAML reads as a number is named as such", () => {
    writeAll(adoptedFix);
    receipt("audit", "impeccable", "[]", { commit: "1836e72" });
    expect(problemsOf()).toContain(
      "audit: commit must be a QUOTED string — YAML read 1.836e+75 as a number"
    );
  });

  it("the wrong skill on a step fails", () => {
    writeAll(adoptedFix);
    receipt("lead", "design-taste-frontend", "[]");
    expect(problemsOf()).toMatch(/lead: skill must be "impeccable"/);
  });

  it("one concept is not a divergence", () => {
    writeAll(adoptedFix);
    receipt("diverge", "frontend-design", item("A", "adopted"));
    expect(problemsOf()).toMatch(/diverge: needs at least two concepts/);
  });

  it("an adopted evidence lookup the brief never cites fails", () => {
    writeAll(adoptedFix);
    receipt("evidence", "ui-ux-pro-max", EVIDENCE + item("EV2", "adopted"));
    expect(problemsOf()).toContain("evidence EV2: adopted but never cited in the brief");
  });

  it("a detector hit with no disposition fails", () => {
    writeAll(adoptedFix);
    receipt("detector", "impeccable", "[]", { output: '[{"antipattern":"side-tab"}]' });
    expect(problemsOf()).toMatch(/detector: the output has 1 hit\(s\) but the receipt disposes of 0/);
  });

  it("a brief left as the template fails, and so does one for the wrong mode", () => {
    writeAll(adoptedFix);
    brief("Operate | Persuade");
    expect(problemsOf()).toContain("brief still has template placeholders");
    expect(checkBrief({ ...surface, mode: "persuade" }, repo).join("\n")).toMatch(
      /brief's \*\*Mode:\*\* is "operate", registry says "persuade"/
    );
  });

  it("an unreviewed later change is stale until a receipt names it", () => {
    writeAll(adoptedFix);
    write("app/x/page.tsx", "export default function X() { return <div /> }\n");
    const sneak = commit("an officer-requested change");
    expect(problemsOf()).toContain(`stale: ${sneak.slice(0, 7)}`);

    receipt("officer", "officer", item("O1", "adopted", `\n    fix_commit: "${sneak}"`));
    expect(checkSurface("x", surface, repo)).toEqual([]);
  });
});

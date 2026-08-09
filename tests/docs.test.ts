import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Documentation drift (§7 Stage 6 phase 9). Pure — reads files, no database.
//
// Modelled on tests/security.test.ts, which enumerates every view the migrations
// declare rather than checking the one view that was found open. The point here
// is the same: **the NEXT route fails in this file instead of being missed for
// months.** Phase 9's read-through found the doc's route table missing two
// routes and its layout tree missing six modules, all shipped weeks earlier.
//
// ⚠️ **This test checks that a NAME IS PRESENT. It cannot check that the
// sentence around it is true.** Phase 8's defect — both documents asserting for
// months that a merge could trip `attendance_one_per_event`, when the index is
// keyed on a column a merge never touches — would sail straight past every
// assertion below. A green run here is not a read-through and must never be
// mistaken for one; it only means nothing is *undocumented*.
//
// 🪤 Every check is scoped to the block that is meant to be a MAP — §5's route
// table, §10's tree, CLAUDE.md's Layout — and never to the whole file. A
// whole-file grep passes on a changelog mention, and that is precisely how the
// phase-7 and phase-8 modules hid: their names were in the document, in the
// entry announcing them, while the map that a reader actually navigates by never
// gained a line.

const DOC = "docs/student-org-website-architecture.md";
const CLAUDE = "CLAUDE.md";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

/**
 * The text between a heading and the next heading of the same level.
 *
 * Scoping is the whole point (see the header), so a missing section is a hard
 * failure rather than an empty string that would make every assertion pass.
 */
function section(
  source: string,
  heading: string,
  /** Null for the last section in the file, which runs to the end. */
  nextHeading: string | null
): string {
  const start = source.indexOf(heading);
  if (start === -1) throw new Error(`"${heading}" is no longer in the document`);
  if (nextHeading === null) return source.slice(start);
  const end = source.indexOf(nextHeading, start + heading.length);
  if (end === -1) throw new Error(`"${nextHeading}" is no longer in the document`);
  return source.slice(start, end);
}

/** Every directory under `app/` that Next serves as a URL. */
function routeDirectories(): string[] {
  const routes: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        // `_components` is Next's own "not a route" convention.
        if (!entry.startsWith("_")) walk(full);
      } else if (entry === "page.tsx" || entry === "route.ts") {
        routes.push(dir);
      }
    }
  };
  walk("app");

  return [
    ...new Set(
      routes.map((dir) =>
        dir
          .replace(/\\/g, "/")
          .replace(/^app/, "")
          // Route groups do not appear in the URL, so they must not appear in
          // the route table either — §5 documents URLs, not directories.
          .replace(/\/\([^)]*\)/g, "")
          // The root page is "/" rather than "".
          .replace(/^$/, "/")
      )
    ),
  ].sort();
}

function modulesIn(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))
    .sort();
}

/**
 * Is this exact filename named in `block`?
 *
 * 🪤 **Not `toContain`, and the reason was found by breaking the test on
 * purpose.** A bare substring check passes `merge.ts` on the presence of
 * `member-merge.ts`, and `presets.ts` on `member-presets.ts` — so renaming
 * `merge.ts` out of the layout left the guard green. Every pair in this repo
 * that differs only by a `member-` prefix is affected, which is four of them.
 *
 * The lookbehind rejects a preceding word character or hyphen, so
 * `member-merge.ts` no longer satisfies `merge.ts`, while `lib/merge.ts` and a
 * tree entry indented with spaces both still do.
 */
function names(block: string, file: string): boolean {
  const escaped = file.replace(/\./g, "\\.");
  return new RegExp(`(?<![\\w-])${escaped}`).test(block);
}

describe("the route table documents every route", () => {
  // §5 is the table a reader navigates the application by. A route absent from
  // it is a screen nobody outside this repo knows exists.
  const table = section(read(DOC), "## 5. Route Structure", "## 6. Security Model");

  it.each(routeDirectories())("§5 lists %s", (route) => {
    expect(table).toContain(route);
  });

  it("does not require a documented route to exist yet", () => {
    // The check runs ONE WAY, code → docs, on purpose: the table is a plan as
    // well as a record, and a planned route must stay legal to write down. The
    // reverse check would force the plan out of the document.
    //
    // 📌 The standing example USED to be `/lookup`, which Stage 7 then built —
    // so this assertion went red for the right reason and needed a route that
    // is still only planned. `/admin/audit` is the one, marked NOT BUILT in §5
    // since v1.20 and carried as an open item with its own trigger.
    // Whoever builds it will land here next; pick another planned route, and
    // do not delete the test — it is what keeps the one-way rule honest.
    expect(table).toContain("/admin/audit");
    expect(routeDirectories()).not.toContain("/admin/audit");
  });
});

describe("the layout maps every module", () => {
  const doc = read(DOC);
  const claude = read(CLAUDE);

  // §10 and CLAUDE.md's Layout are the two maps. They serve different readers —
  // §10 explains the shape to someone learning the project, Layout is what an
  // agent reads cold — so a module has to be in both or one of them lies.
  // §10 is the last numbered section, so it runs to the end of the file.
  const layoutDoc = section(doc, "## 10. Repository Layout", null);
  const layoutClaude = section(claude, "## Layout", "## Working agreements");

  const libModules = modulesIn("lib");
  const actionModules = modulesIn("app/actions");

  it.each(libModules)("§10 maps lib/%s", (file) => {
    expect(names(layoutDoc, file)).toBe(true);
  });

  it.each(libModules)("CLAUDE.md maps lib/%s", (file) => {
    expect(names(layoutClaude, file)).toBe(true);
  });

  it.each(actionModules)("§10 maps app/actions/%s", (file) => {
    expect(names(layoutDoc, file)).toBe(true);
  });

  it.each(actionModules)("CLAUDE.md maps app/actions/%s", (file) => {
    expect(names(layoutClaude, file)).toBe(true);
  });

  it("does not accept a prefixed filename as the plain one", () => {
    // The false pass this matcher exists to close, pinned so nobody
    // "simplifies" it back to toContain.
    expect(names("member-merge.ts", "merge.ts")).toBe(false);
    expect(names("member-presets.ts", "presets.ts")).toBe(false);
    expect(names("  merge.ts   the merge core", "merge.ts")).toBe(true);
    expect(names("lib/merge.ts", "merge.ts")).toBe(true);
  });

  it("scopes to the map, not the whole document", () => {
    // 🪤 The assertion that makes the others worth running. Both files mention
    // far more filenames than their maps contain — changelogs, invariants,
    // walkthrough notes — so a whole-file grep would have passed throughout the
    // months when §10 was missing six modules. Proven by construction: the
    // section is a strict slice of the file.
    expect(layoutDoc.length).toBeLessThan(doc.length);
    expect(layoutClaude.length).toBeLessThan(claude.length);
  });
});

describe("the migration count the docs quote", () => {
  it("matches the migrations on disk", () => {
    // A number quoted in three places and re-derived in none. `tasks.md` calls
    // its state table "the one place that number is kept", which only holds if
    // something checks it.
    const count = readdirSync("supabase/migrations").filter((f) =>
      f.endsWith(".sql")
    ).length;
    expect(read("tasks.md")).toContain(`${count} migration files`);
  });
});

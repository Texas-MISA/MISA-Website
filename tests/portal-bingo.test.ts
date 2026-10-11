import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ACTIVITY_POSITIONS,
  HOUSES,
  houseProgress,
  houseStandings,
  type BingoBoard,
  type BingoMark,
} from "@/lib/bingo";

// House bingo's member page, /portal/bingo (migration 33), and the portal hub's
// row for it. Pure: reads source files and calls pure helpers, no database. The
// board read itself is covered against the local stack in tests/bingo.test.ts.
//
// The page renders in a request and its client components need a browser, so,
// as in tests/bingo-admin.test.ts, their wiring is pinned against source with
// the comments stripped: a comment that NAMES a rule must not pass for it.

const PAGE = "app/(public)/portal/bingo/page.tsx";
const PAGE_DIR = "app/(public)/portal/bingo";
const TILE = "app/(public)/portal/bingo/_components/proof-tile.tsx";
const REFRESHER = "app/(public)/portal/bingo/_components/bingo-refresher.tsx";
const TILE_LABEL = "app/(public)/portal/bingo/_components/tile-label.ts";
const HUB = "app/(public)/portal/page.tsx";
const ADMIN_BOARD = "app/admin/(shell)/bingo/page.tsx";

function code(path: string): string {
  // Whole-line comments first, for the reason tests/bingo-admin.test.ts gives:
  // a line comment holding "/*" would otherwise open a block that swallows
  // real code.
  return readFileSync(path, "utf8")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Every .ts and .tsx file under the bingo page's directory. */
function bingoFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry)) files.push(full.replace(/\\/g, "/"));
    }
  };
  walk(PAGE_DIR);
  return files.sort();
}

/** Module specifiers a file loads, however the import is written. */
function specifiers(source: string): string[] {
  const stripped = source.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  return [
    ...stripped.matchAll(/\bfrom\s+["']([^"']+)["']/g),
    ...stripped.matchAll(/^\s*import\s+["']([^"']+)["']/gm),
    ...stripped.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
    ...stripped.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g),
  ].map((m) => m[1]);
}

/** The page's metadata description, which the hub's row must repeat. */
function pageDescription(): string {
  const match = /^\s*description: "([^"]+)",$/m.exec(code(PAGE));
  expect(match, "the page's metadata has no description").not.toBeNull();
  return match![1];
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

describe("the house bingo page", () => {
  const source = code(PAGE);

  it("carries robots noindex, per page, and is force-dynamic", () => {
    expect(source).toContain('title: "House Bingo"');
    expect(source).toContain("robots: { index: false, follow: false }");
    expect(source).toMatch(/^export const dynamic = "force-dynamic";$/m);
    // Nothing revalidates it, so it must never become a cache.
    expect(source).not.toMatch(/\brevalidate\b/);
  });

  it("🔓 reads the board with the service role, never the anon client", () => {
    // Both tables are deny-all, and the anon client gets zero rows, which
    // readBingoBoard reports as an error: the board would never render.
    expect(specifiers(source)).toContain("@/lib/supabase/admin");
    expect(specifiers(source)).not.toContain("@/lib/supabase/server");
    expect(source).toContain("const db = createAdminClient();");
    expect(source).toContain("const result = await readBingoBoard(db);");
  });

  it("🔓 renders a failed read as ReadError, in place of the standings and cards", () => {
    // Never "0 of 24" and empty cards for a read that failed.
    expect(source).toMatch(
      /result\.kind === "error" \? \(\s*<ReadError what="the bingo cards"[^>]*\/>\s*\) : \(\s*<>\s*<Standings board=\{result\.board\} \/>/
    );
    expect(specifiers(source)).toContain("@/components/ui/banner");
  });

  it("states the card's rule verbatim", () => {
    expect(source).toContain(
      '"All tiles must be completed with at least half of house members."'
    );
  });

  it("lists the standings in HOUSES order, with a decorative bar and a live region", () => {
    expect(source).toContain("houseStandings(board).map(");
    // The count is text; the bar says nothing to a screen reader, so the count
    // is not read twice.
    expect(source).toMatch(/<span aria-hidden="true" className="[^"]*\bh-2\b[^"]*">/);
    expect(source).toContain("formatProgress(done)");
    // Mounted with the page, so a refresh that moves a count is announced, and
    // read as a whole line.
    expect(source).toMatch(/<ul aria-live="polite"/);
    expect(source).toMatch(/<li key=\{house\} aria-atomic="true">/);
  });

  it("draws every house's card, in HOUSES order, from houseCard", () => {
    expect(source).toContain("{HOUSES.map((house) => (");
    expect(source).toContain("houseCard(board, house).map((cell) => (");
    expect(source).toContain('className="grid auto-rows-');
    expect(source).toContain("grid-cols-5");
  });

  it("builds every URL on the server and hands the tile plain strings", () => {
    expect(source).toContain("thumbUrl={markThumbUrl(db, cell.mark)}");
    expect(source).toContain("mediaUrl={markMediaUrl(db, cell.mark)}");
  });

  it("makes only a done square a control: open squares and the free centre are text", () => {
    // ProofTile is the one place a <button> is rendered.
    expect(source).not.toContain("<button");
    expect(source).toMatch(/cell\.mark === null \? \(\s*<OpenSquare activity=\{cell\.square\.activity\} \/>/);
  });
});

// ---------------------------------------------------------------------------
// Everything under /portal/bingo
// ---------------------------------------------------------------------------

describe("the bingo page's files", () => {
  const files = bingoFiles();
  const clientComponents = files.filter((file) =>
    /^\s*["']use client["'];/.test(readFileSync(file, "utf8"))
  );

  it("are the page and its three components", () => {
    expect(files).toEqual([PAGE, REFRESHER, TILE, TILE_LABEL].sort());
    expect(clientComponents.sort()).toEqual([REFRESHER, TILE].sort());
  });

  it.each([REFRESHER, TILE])(
    "🔓 %s imports no Supabase client and nothing server-only",
    (file) => {
      const loads = specifiers(readFileSync(file, "utf8"));
      for (const banned of ["@/lib/supabase/admin", "@/lib/supabase/server", "server-only"]) {
        expect(loads, banned).not.toContain(banned);
      }
      expect(loads.filter((spec) => spec.startsWith("@supabase/"))).toEqual([]);
      expect(loads.filter((spec) => /(^|\/)supabase\//.test(spec))).toEqual([]);
    }
  );

  it.each(files)("%s puts data-reveal on nothing", (file) => {
    // The observer scans once per pathname and router.refresh() keeps the
    // pathname, so anything that mounts on a refresh would never be shown.
    expect(code(file)).not.toContain("data-reveal");
  });

  it.each(files)("%s never truncates text, and sets none under 11px", (file) => {
    const source = code(file);
    expect(source).not.toMatch(/\b(truncate|line-clamp-\d+|text-ellipsis)\b/);
    for (const m of source.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
      expect(Number(m[1]), m[0]).toBeGreaterThanOrEqual(11);
    }
  });
});

describe("the refresher", () => {
  const source = code(REFRESHER);

  it("refreshes every 10 seconds", () => {
    expect(source).toContain("const REFRESH_MS = 10_000;");
    expect(source).toContain("window.setInterval(refresh, REFRESH_MS)");
    expect(source).toContain("router.refresh();");
  });

  it("refreshes only while the tab is visible, and once on becoming visible", () => {
    expect(source).toMatch(
      /function refresh\(\) \{\s*if \(document\.visibilityState !== "visible"\) return;/
    );
    expect(source).toContain('document.addEventListener("visibilitychange", onVisibilityChange);');
    expect(source).toMatch(
      /if \(document\.visibilityState === "visible"\) \{\s*refresh\(\);\s*start\(\);\s*\} else \{\s*stop\(\);\s*\}/
    );
  });

  it("skips a refresh while a proof dialog is open, and while offline", () => {
    expect(source).toContain('const OPEN_PROOF = "dialog[data-bingo-proof][open]";');
    expect(source).toContain("if (document.querySelector(OPEN_PROOF) !== null) return;");
    expect(source).toContain("if (!navigator.onLine) return;");
    // The selector names the attribute the tile actually carries.
    expect(code(TILE)).toContain('data-bingo-proof=""');
  });

  it("clears its timer and its listener on unmount", () => {
    expect(source).toMatch(/function stop\(\) \{\s*window\.clearInterval\(timer\);/);
    expect(source).toMatch(
      /return \(\) => \{\s*stop\(\);\s*document\.removeEventListener\("visibilitychange", onVisibilityChange\);\s*\};/
    );
  });

  it("renders nothing", () => {
    expect(source).toMatch(/return null;\s*\}\s*$/);
  });
});

describe("the proof tile", () => {
  const source = code(TILE);

  it("is a type=button control that opens a native modal dialog", () => {
    expect(source).toContain('type="button"');
    expect(source).not.toMatch(/type="submit"/);
    expect(source).toContain('aria-haspopup="dialog"');
    expect(source).toContain("dialog.showModal();");
    expect(source).toMatch(/<dialog[\s\S]*?aria-labelledby=\{headingId\}[\s\S]*?onClose=\{handleClose\}/);
    // A display utility on the dialog itself would beat the user agent's
    // `dialog:not([open]) { display: none }` and show every closed dialog.
    const dialogClass = /<dialog[\s\S]*?className="([^"]*)"/.exec(source)?.[1] ?? "";
    expect(dialogClass).toContain("m-auto");
    expect(dialogClass).not.toMatch(/(^|\s)(flex|grid|block|inline-block|inline-flex)(\s|$)/);
  });

  it("🔓 draws a two-tone focus ring: white inside the global navy outline", () => {
    // The navy outline alone measured 1.00:1 where it crossed the navy free
    // centre or a neighbour's navy band. The white ring fills the outline's
    // offset, so one tone or the other shows on every edge, and the z-index
    // draws both over the neighbouring tiles.
    const tileClass =
      /<button\s+ref=\{tileRef\}[\s\S]*?className="([^"]*)"/.exec(source)?.[1] ?? "";
    for (const token of [
      "relative",
      "focus-visible:z-10",
      "focus-visible:ring-2",
      "focus-visible:ring-white",
    ]) {
      expect(tileClass.split(/\s+/), token).toContain(token);
    }
    // ring-2 is 2px, which only fills the gap while the global outline sits
    // exactly 2px out. Change one and the other must move with it.
    const globals = readFileSync("app/globals.css", "utf8");
    expect(globals).toMatch(
      /:focus-visible \{\s*outline: 2px solid var\(--misa-blue\);\s*outline-offset: 2px;\s*\}/
    );
  });

  it("closes on a backdrop click, through the same close path as Close", () => {
    expect(source).toMatch(
      /<dialog[\s\S]*?onClose=\{handleClose\}\s*onClick=\{handleDialogClick\}/
    );
    const handler =
      /function handleDialogClick\([\s\S]*?\n {2}\}/.exec(source)?.[0] ?? "";
    // Only a click on the dialog itself: the photo, the video's controls and
    // the heading are its children and never close it...
    expect(handler).toContain("if (event.target !== dialog) return;");
    // ...and only outside its box, so its own scrollbar does not either.
    expect(handler).toContain("const box = dialog.getBoundingClientRect();");
    expect(handler).toMatch(/if \(!inside\) dialog\.close\(\);/);
    // close() fires `close`, so the video pauses, the media unmounts and focus
    // returns to the tile, as for the Close button.
    expect(handler).not.toContain("setShowing");
  });

  it("names the done state in more than colour: a check glyph and sr-only text", () => {
    expect(source).toContain("<Check aria-hidden");
    expect(source).toMatch(/<span id=\{stateId\} className="sr-only">\s*, \{houseName\}, done\s*<\/span>/);
    expect(source).toContain("aria-labelledby={`${nameId} ${stateId}`}");
  });

  it("closes from a visible Close button, pauses the video, and returns focus to the tile", () => {
    expect(source).toMatch(/onClick=\{\(\) => dialogRef\.current\?\.close\(\)\}/);
    expect(source).toMatch(/>\s*Close\s*<\/button>/);
    expect(source).toMatch(
      /function handleClose\(\) \{\s*videoRef\.current\?\.pause\(\);\s*setShowing\(false\);\s*tileRef\.current\?\.focus\(\);/
    );
  });

  it("loads the full photo or the video only while the dialog is open", () => {
    expect(source).toContain('{showing && kind === "photo" && (');
    expect(source).toContain('{showing && kind === "video" && (');
  });

  it("plays the video with no type attribute, and loads nothing until play", () => {
    // Chrome refuses type="video/quicktime", yet plays the same file without it.
    const video = /<video[\s\S]*?\/>/.exec(source)?.[0] ?? "";
    expect(video).toContain('preload="none"');
    expect(video).toContain("playsInline");
    expect(video).toContain("controls");
    expect(video).toContain("poster={thumbUrl ?? undefined}");
    expect(video).toContain("src={mediaUrl}");
    expect(video).not.toMatch(/\btype=/);
    expect(source).not.toContain("<source");
  });

  it("draws pictures with next/image, unoptimized and fill, with alt text", () => {
    const images = [...source.matchAll(/<Image[\s\S]*?\/>/g)].map((m) => m[0]);
    expect(images).toHaveLength(2);
    for (const image of images) {
      expect(image).toContain("unoptimized");
      expect(image).toMatch(/\bfill\b/);
      expect(image).toContain("alt={proof}");
    }
    // The grid's thumbnail keeps next/image's default lazy loading.
    expect(images[0]).not.toContain("loading=");
    // ...and the alt names the activity and the house.
    expect(source).toContain("const what = `${activity}, ${houseName}`;");
  });
});

// ---------------------------------------------------------------------------
// The hub and the officer board
// ---------------------------------------------------------------------------

describe("the portal hub's House Bingo row", () => {
  const source = code(HUB);
  const destinations = [
    ...source.matchAll(
      /\{\s*href: "([^"]+)",\s*title: "([^"]+)",\s*body: "([^"]+)",\s*action: "([^"]+)",\s*\}/g
    ),
  ].map((m) => ({ href: m[1], title: m[2], body: m[3], action: m[4] }));

  it("lists /portal/bingo third, after Points Leaderboard, with the action Bingo", () => {
    expect(destinations.map((d) => d.href)).toEqual([
      "/portal/attend",
      "/portal/leaderboard",
      "/portal/bingo",
    ]);
    expect(destinations[2]).toMatchObject({ title: "House Bingo", action: "Bingo" });
  });

  it("uses the bingo page's own metadata description as its body", () => {
    expect(destinations[2].body).toBe(pageDescription());
  });

  it("stays static: no data reads", () => {
    expect(specifiers(source).filter((spec) => spec.includes("supabase"))).toEqual([]);
    expect(source).not.toMatch(/\basync\b/);
    expect(source).not.toContain("force-dynamic");
  });

  it("says in its own description that it leads to house bingo", () => {
    expect(source).toMatch(/^\s*description: "[^"]*house bingo[^"]*",$/m);
  });
});

describe("the officer board", () => {
  it("links the member page rather than naming it", () => {
    expect(code(ADMIN_BOARD)).toMatch(
      /<Link\s+href="\/portal\/bingo"\s+className="text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"\s*>\s*\/portal\/bingo\s*<\/Link>/
    );
  });
});

// ---------------------------------------------------------------------------
// houseStandings
// ---------------------------------------------------------------------------

/** A board built by hand: all 24 squares, and the marks given. */
function syntheticBoard(marks: Array<Pick<BingoMark, "house" | "squareId">>): BingoBoard {
  return {
    squares: ACTIVITY_POSITIONS.map((position) => ({
      id: `sq-${position}`,
      position,
      activity: `Activity ${position}`,
      updatedAt: "2026-10-11T00:00:00+00:00",
    })),
    marks: marks.map((mark, i) => ({
      id: `mk-${i}`,
      house: mark.house,
      squareId: mark.squareId,
      kind: "photo",
      mediaPath: `x/${i}.jpg`,
      thumbPath: `x/${i}-thumb.jpg`,
      createdAt: "2026-10-11T00:00:00+00:00",
      updatedAt: "2026-10-11T00:00:00+00:00",
    })),
  };
}

describe("houseStandings", () => {
  it("is every house, in HOUSES order, at 0 on an empty board", () => {
    expect(houseStandings(syntheticBoard([]))).toEqual([
      { house: "M", done: 0 },
      { house: "I", done: 0 },
      { house: "S", done: 0 },
      { house: "A", done: 0 },
    ]);
  });

  it("is NEVER sorted by progress: A leading still comes last", () => {
    const board = syntheticBoard([
      { house: "A", squareId: "sq-0" },
      { house: "A", squareId: "sq-1" },
      { house: "A", squareId: "sq-2" },
      { house: "S", squareId: "sq-0" },
      { house: "S", squareId: "sq-24" },
      { house: "M", squareId: "sq-13" },
    ]);
    expect(houseStandings(board)).toEqual([
      { house: "M", done: 1 },
      { house: "I", done: 0 },
      { house: "S", done: 2 },
      { house: "A", done: 3 },
    ]);
  });

  it("counts exactly what houseProgress counts, so the standings and the cards agree", () => {
    const board = syntheticBoard([
      { house: "I", squareId: "sq-5" },
      // A mark naming no square on the board is not progress.
      { house: "I", squareId: "sq-12" },
    ]);
    const standings = houseStandings(board);
    expect(standings.map((s) => s.house)).toEqual([...HOUSES]);
    for (const { house, done } of standings) expect(done).toBe(houseProgress(board, house));
    expect(standings[1]).toEqual({ house: "I", done: 1 });
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { AuditTrail } from "@/app/admin/(shell)/_components/audit-trail";
import { MAX_ACTIVITY_LENGTH } from "@/lib/bingo";
import {
  bingoRemoveSchema,
  bingoRenameSchema,
  bingoUploadSchema,
  bingoVideoPrepareSchema,
} from "@/lib/validation";

// House bingo's officer side (migration 33): the upload Route Handler, the
// three Server Actions, their schemas, the two pages and the one browser
// write. Pure — reads source files and parses schemas, no database. The write
// cores these call are covered against the local stack in
// tests/bingo-writes.test.ts.
//
// The route and the actions need a request context (cookies) to run, so, as in
// tests/member-actions.test.ts, their wiring is pinned against source with the
// comments stripped: a comment that NAMES a guard must not pass for the guard.

const ROUTE = "app/admin/(shell)/bingo/upload/route.ts";
const ACTIONS = "app/actions/bingo.ts";
const BOARD_PAGE = "app/admin/(shell)/bingo/page.tsx";
const SQUARE_PAGE = "app/admin/(shell)/bingo/[house]/[position]/page.tsx";
const PROOF_FORM =
  "app/admin/(shell)/bingo/[house]/[position]/_components/proof-form.tsx";
const BROWSER_CLIENT = "lib/supabase/client.ts";
const AUDIT_TRAIL = "app/admin/(shell)/_components/audit-trail.tsx";
const NAV = "app/admin/(shell)/_components/admin-nav.tsx";

function code(path: string): string {
  // 🪤 Whole-line comments FIRST. admin-nav.tsx has a line comment reading
  // "/admin/dues/* path", and stripping blocks first reads that `/*` as an
  // opening and swallows everything up to the next `*/`, NAV array included.
  return readFileSync(path, "utf8")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

/** One exported function's own body, so an assertion cannot pass on a
 * sibling's code. */
function bodyOf(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  expect(start, `${name} is not exported`).toBeGreaterThan(-1);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

// ---------------------------------------------------------------------------
// The Route Handler
// ---------------------------------------------------------------------------

describe("the upload Route Handler", () => {
  const source = code(ROUTE);
  const post = bodyOf(source, "POST");

  it("is force-dynamic and answers POST only", () => {
    expect(source).toMatch(/^export const dynamic = "force-dynamic";$/m);
    const handlers = [...source.matchAll(/^export async function (\w+)\(/gm)].map(
      (m) => m[1]
    );
    expect(handlers).toEqual(["POST"]);
  });

  it("🔓 opens with getOfficer() and answers 403, never requireOfficer()", () => {
    // A redirect is the wrong answer to a fetch, which would follow it and
    // parse the login page as JSON; and Route Handlers run no layout.
    expect(post).toMatch(
      /^export async function POST\([^)]*\)[^{]*\{\s*const officer = await getOfficer\(\);\s*if \(!officer\) return reply\(\{ status: "unauthorized" \}, 403\);/
    );
    expect(source).not.toContain("requireOfficer");
  });

  it("🔓 refuses a request whose Origin is not its own, before reading anything", () => {
    expect(post).toContain('request.headers.get("origin")');
    expect(post).toMatch(
      /origin === null \|\| origin !== new URL\(request\.url\)\.origin\s*\)\s*\{\s*return reply\(\{ status: "forbidden" \}, 403\);/
    );
  });

  it("caps Content-Length before the body is read", () => {
    // proxy.ts matches this path, and Next silently truncates a proxied body
    // past proxyClientMaxBodySize; reading first would parse a cut-off form.
    expect(post).toMatch(/request\.headers\.get\("content-length"\)/);
    expect(post).toMatch(/declared === null \|\|/);
    expect(post).toMatch(/Number\(declared\) > MAX_UPLOAD_REQUEST_BYTES/);
    expect(post).toContain('reply({ status: "too_large" }, 413)');
  });

  it("checks in order: officer, origin, length, then the body", () => {
    const at = (needle: string) => {
      const index = post.indexOf(needle);
      expect(index, needle).toBeGreaterThan(-1);
      return index;
    };
    const officer = at("await getOfficer()");
    const origin = at('request.headers.get("origin")');
    const length = at('request.headers.get("content-length")');
    const body = at("await request.formData()");
    expect(officer).toBeLessThan(origin);
    expect(origin).toBeLessThan(length);
    expect(length).toBeLessThan(body);
  });

  it("answers a body it cannot parse with 400, and validates with the shared schema", () => {
    expect(post).toMatch(
      /try \{\s*form = await request\.formData\(\);\s*\} catch \{\s*return reply\(\{ status: "invalid" \}, 400\);/
    );
    expect(post).toContain("bingoUploadSchema.safeParse(");
  });

  it("writes bingo_mark.added and .replaced through writeAudit, then revalidates", () => {
    expect(post).toMatch(/await writeAudit\(db, \{/);
    expect(post).toContain('entityType: "bingo_mark"');
    expect(post).toContain('"bingo_mark.added"');
    expect(post).toContain('"bingo_mark.replaced"');
    expect(post).toContain("actorId: officer.userId");
    expect(post).toContain("Files not deleted: ");
    // Audit first, then revalidate, then answer.
    expect(post.indexOf("await writeAudit(")).toBeLessThan(
      post.indexOf("revalidatePath(BOARD)")
    );
  });

  it("maps every outcome to its status code", () => {
    expect(post).toContain("reply({ status: result.status, updatedAt: result.updatedAt }, 200)");
    expect(post).toContain('reply({ status: "invalid", reason: result.reason }, 400)');
    expect(post).toContain('reply({ status: "conflict" }, 409)');
    expect(post).toContain('reply({ status: "error" }, 500)');
  });
});

// ---------------------------------------------------------------------------
// The Server Actions
// ---------------------------------------------------------------------------

describe("the bingo Server Actions", () => {
  const raw = readFileSync(ACTIONS, "utf8");
  const source = code(ACTIONS);
  const names = ["prepareBingoVideoUpload", "renameBingoActivity", "removeBingoProof"];

  it('is a "use server" module that exports only async functions', () => {
    // Every export of a "use server" module is a public endpoint.
    expect(raw.startsWith('"use server";')).toBe(true);
    const exported = [...source.matchAll(/^export (?!type )(\w+(?: \w+)?)/gm)].map(
      (m) => m[1]
    );
    expect(exported).toEqual(names.map(() => "async function"));
    expect([...source.matchAll(/^export async function (\w+)\(/gm)].map((m) => m[1])).toEqual(
      names
    );
  });

  it.each(names)("🔓 %s opens with getOfficer() and returns unauthorized", (name) => {
    expect(bodyOf(source, name)).toMatch(
      new RegExp(
        `^export async function ${name}\\([^)]*\\)[^{]*\\{\\s*const officer = await getOfficer\\(\\);\\s*if \\(!officer\\) return \\{ status: "unauthorized" \\};`
      )
    );
  });

  it("never calls requireOfficer(), whose redirect the try/catch would swallow", () => {
    expect(source).not.toContain("requireOfficer");
  });

  it("audits a rename as bingo_square.renamed, with before and after", () => {
    const body = bodyOf(source, "renameBingoActivity");
    expect(body).toContain('entityType: "bingo_square"');
    expect(body).toContain('action: "bingo_square.renamed"');
    expect(body).toContain("before: result.before");
    expect(body).toContain("after: result.after");
    expect(body).toContain("revalidateBingo()");
  });

  it("audits a removal as bingo_mark.removed, with before, no after, and the leftovers", () => {
    const body = bodyOf(source, "removeBingoProof");
    expect(body).toContain('entityType: "bingo_mark"');
    expect(body).toContain('action: "bingo_mark.removed"');
    expect(body).toContain("before: result.before");
    expect(body).toContain("after: null");
    expect(body).toContain("note: filesNotDeleted(result.orphanPaths)");
    expect(body).toContain("revalidateBingo()");
  });

  it("writes no audit row when it only mints an upload token", () => {
    // It changes no club data: no mark, and the sweep deletes only files no
    // mark references. The proof is audited when the Route Handler records it.
    const body = bodyOf(source, "prepareBingoVideoUpload");
    expect(body).not.toContain("writeAudit");
    expect(body).not.toContain("revalidate");
    // And the sweep's results stay on the server.
    expect(body).toContain('return { status: "ready", path: result.path, token: result.token };');
  });

  it("parses each input with its schema from lib/validation.ts", () => {
    expect(bodyOf(source, "prepareBingoVideoUpload")).toContain(
      "bingoVideoPrepareSchema.safeParse(input)"
    );
    expect(bodyOf(source, "renameBingoActivity")).toContain("bingoRenameSchema.safeParse(");
    expect(bodyOf(source, "removeBingoProof")).toContain("bingoRemoveSchema.safeParse(");
  });
});

// ---------------------------------------------------------------------------
// The schemas
// ---------------------------------------------------------------------------

const TOKEN = "2026-10-10T21:14:03.123456+00:00";
const UUID = "0b7f4c1e-9d2a-4e3b-8c5d-6a7b8c9d0e1f";

function jpegFile(name: string): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], name, {
    type: "image/jpeg",
  });
}

describe("bingoUploadSchema", () => {
  const photo = {
    kind: "photo",
    house: "m",
    position: "7",
    expectedUpdatedAt: "",
    photo: jpegFile("photo.jpg"),
    thumb: jpegFile("thumb.jpg"),
  };
  const video = {
    kind: "video",
    house: "a",
    position: "24",
    expectedUpdatedAt: TOKEN,
    videoPath: "a/24/0b7f4c1e-9d2a-4e3b-8c5d-6a7b8c9d0e1f.mp4",
  };

  it("accepts a photo, turning the slug into the house and the position into a number", () => {
    const parsed = bingoUploadSchema.safeParse(photo);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ kind: "photo", house: "M", position: 7 });
  });

  it("accepts a video with or without a poster", () => {
    expect(bingoUploadSchema.safeParse(video).success).toBe(true);
    const withPoster = bingoUploadSchema.safeParse({
      ...video,
      poster: jpegFile("poster.jpg"),
    });
    expect(withPoster.success).toBe(true);
    expect(withPoster.data).toMatchObject({ kind: "video", house: "A", position: 24 });
  });

  it("keeps an empty token, which the core reads as 'the page showed no mark'", () => {
    expect(bingoUploadSchema.safeParse(photo).data?.expectedUpdatedAt).toBe("");
  });

  it("refuses a house in any spelling but the lowercase slug", () => {
    for (const house of ["M", "x", "", "mm", null]) {
      expect(bingoUploadSchema.safeParse({ ...photo, house }).success, String(house)).toBe(false);
    }
  });

  it("refuses the free centre and any second spelling of a position", () => {
    for (const position of ["12", "07", " 7", "7.0", "25", "-1", "", null]) {
      expect(
        bingoUploadSchema.safeParse({ ...photo, position }).success,
        String(position)
      ).toBe(false);
    }
  });

  it("refuses a request that does not say which state of the square it saw", () => {
    expect(bingoUploadSchema.safeParse({ ...photo, expectedUpdatedAt: null }).success).toBe(
      false
    );
    expect(
      bingoUploadSchema.safeParse({ ...photo, expectedUpdatedAt: "x".repeat(65) }).success
    ).toBe(false);
  });

  it("needs real files for a photo and its thumbnail", () => {
    expect(bingoUploadSchema.safeParse({ ...photo, photo: null }).success).toBe(false);
    expect(bingoUploadSchema.safeParse({ ...photo, thumb: "thumb.jpg" }).success).toBe(false);
  });

  it("needs a video path, and a poster only if it is a file", () => {
    expect(bingoUploadSchema.safeParse({ ...video, videoPath: "" }).success).toBe(false);
    expect(bingoUploadSchema.safeParse({ ...video, videoPath: null }).success).toBe(false);
    expect(bingoUploadSchema.safeParse({ ...video, poster: "poster.jpg" }).success).toBe(
      false
    );
  });

  it("refuses an unknown kind, or none", () => {
    expect(bingoUploadSchema.safeParse({ ...photo, kind: "audio" }).success).toBe(false);
    expect(bingoUploadSchema.safeParse({ ...photo, kind: null }).success).toBe(false);
  });
});

describe("bingoVideoPrepareSchema", () => {
  const input = { house: "s", position: 13, contentType: "video/mp4", size: 1024 };

  it("accepts a client call, with the position as a number or its one spelling", () => {
    expect(bingoVideoPrepareSchema.safeParse(input).data).toEqual({ ...input, house: "S" });
    expect(bingoVideoPrepareSchema.safeParse({ ...input, position: "13" }).data?.position).toBe(13);
  });

  it("leaves the type and the size to the core, which refuses them by name", () => {
    // video_type and video_size are the core's reasons; the schema only checks
    // that it has a string and a finite number to give it.
    expect(bingoVideoPrepareSchema.safeParse({ ...input, contentType: "video/webm" }).success).toBe(
      true
    );
    expect(bingoVideoPrepareSchema.safeParse({ ...input, size: 999_999_999 }).success).toBe(true);
  });

  it("refuses a malformed call", () => {
    for (const bad of [
      { ...input, house: "S" },
      { ...input, position: 12 },
      { ...input, position: 7.5 },
      { ...input, size: Number.NaN },
      { ...input, size: Number.POSITIVE_INFINITY },
      { ...input, size: "1024" },
      { ...input, contentType: 4 },
      null,
    ]) {
      expect(bingoVideoPrepareSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("bingoRenameSchema", () => {
  const input = { squareId: UUID, activity: "Karaoke Night", expectedUpdatedAt: TOKEN };

  it("accepts a name and stores it trimmed", () => {
    expect(bingoRenameSchema.safeParse({ ...input, activity: "  Karaoke  " }).data?.activity).toBe(
      "Karaoke"
    );
  });

  it(`counts ${MAX_ACTIVITY_LENGTH} in code points, as the CHECK does`, () => {
    // 60 emoji are 120 UTF-16 units, and still a legal name.
    expect(bingoRenameSchema.safeParse({ ...input, activity: "🎳".repeat(60) }).success).toBe(true);
    expect(bingoRenameSchema.safeParse({ ...input, activity: "a".repeat(60) }).success).toBe(true);
  });

  it("says which part of the rule a name broke", () => {
    const message = (activity: string) =>
      bingoRenameSchema.safeParse({ ...input, activity }).error?.issues[0]?.message;
    expect(message("   ")).toBe("Name the activity");
    expect(message("a".repeat(61))).toBe(`Keep the name to ${MAX_ACTIVITY_LENGTH} characters`);
    expect(message("Bowling\tNight")).toBe("Take the tab or control character out of the name");
  });

  it("refuses a square that is not a uuid, or no token", () => {
    expect(bingoRenameSchema.safeParse({ ...input, squareId: "12" }).success).toBe(false);
    expect(bingoRenameSchema.safeParse({ ...input, expectedUpdatedAt: "" }).success).toBe(false);
    expect(bingoRenameSchema.safeParse({ ...input, activity: null }).success).toBe(false);
  });
});

describe("bingoRemoveSchema", () => {
  it("takes a mark id and the token the page rendered", () => {
    expect(bingoRemoveSchema.safeParse({ markId: UUID, expectedUpdatedAt: TOKEN }).success).toBe(
      true
    );
  });

  it("refuses anything else", () => {
    expect(bingoRemoveSchema.safeParse({ markId: "m/7", expectedUpdatedAt: TOKEN }).success).toBe(
      false
    );
    expect(bingoRemoveSchema.safeParse({ markId: UUID, expectedUpdatedAt: "" }).success).toBe(
      false
    );
    expect(bingoRemoveSchema.safeParse({ markId: UUID }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The one browser write stays in one place
// ---------------------------------------------------------------------------

/** Every .ts and .tsx file under the directories the app is built from. */
function sourceFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".d.ts")) {
        files.push(full.replace(/\\/g, "/"));
      }
    }
  };
  for (const dir of ["app", "components", "lib"]) walk(dir);
  for (const file of ["proxy.ts"]) files.push(file);
  return files.sort();
}

/** Module specifiers a file loads, however the import is written. */
function specifiers(source: string): string[] {
  // Line comments first, for the reason code() gives.
  const stripped = source.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  return [
    ...stripped.matchAll(/\bfrom\s+["']([^"']+)["']/g),
    ...stripped.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
    ...stripped.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g),
  ].map((m) => m[1]);
}

describe("the one browser write", () => {
  const files = sourceFiles();

  it("lib/supabase/client.ts has exactly one importer: the bingo proof form", () => {
    // 🔓 The browser writes a video's bytes and nothing else (user's decision,
    // 2026-10-10). A second importer is a second place that could write.
    const importers = files.filter((file) =>
      specifiers(readFileSync(file, "utf8")).some(
        (spec) => spec === "@/lib/supabase/client" || /(^|\/)supabase\/client$/.test(spec)
      )
    );
    expect(importers).toEqual([PROOF_FORM]);
  });

  it("no other client component reaches for a Supabase client of its own", () => {
    const clientComponents = files.filter((file) =>
      /^\s*["']use client["'];/.test(readFileSync(file, "utf8"))
    );
    expect(clientComponents).toContain(PROOF_FORM);
    for (const file of clientComponents) {
      const loads = specifiers(readFileSync(file, "utf8"));
      expect(
        loads.filter((spec) => spec.startsWith("@supabase/")),
        file
      ).toEqual([]);
    }
  });

  it("the browser client is sessionless: the anon key, never the officer's token", () => {
    // Otherwise it reads the officer's session from the (script-readable) auth
    // cookies, sends that token, and refreshes it from the browser — a second
    // client-side write, to Auth.
    const source = code(BROWSER_CLIENT);
    expect(source).toContain("process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!");
    expect(source).toMatch(/persistSession: false/);
    expect(source).toMatch(/autoRefreshToken: false/);
    expect(source).toMatch(/detectSessionInUrl: false/);
  });

  it("the proof form uploads only to the signed path, and only a video", () => {
    const source = code(PROOF_FORM);
    expect(source.startsWith('"use client";')).toBe(true);
    const writes = [...source.matchAll(/\.(uploadToSignedUrl|upload|update|insert|upsert|remove|delete)\(/g)].map(
      (m) => m[1]
    );
    expect(writes).toEqual(["uploadToSignedUrl"]);
    expect(source).toMatch(/\.storage\s*\.from\(VIDEO_BUCKET\)\s*\.uploadToSignedUrl\(ticket\.path, ticket\.token, video,/);
  });
});

// ---------------------------------------------------------------------------
// The pages, the history and the nav
// ---------------------------------------------------------------------------

describe("the bingo pages", () => {
  it.each([BOARD_PAGE, SQUARE_PAGE])("%s is force-dynamic, officer-only, service-role", (path) => {
    const source = code(path);
    expect(source).toMatch(/^export const dynamic = "force-dynamic";$/m);
    expect(source).toContain("await requireOfficer();");
    expect(source).toContain("createAdminClient()");
    expect(source).toContain("readBingoBoard(db)");
  });

  it.each([BOARD_PAGE, SQUARE_PAGE])("🔓 %s renders a failed read as an error, never an empty card", (path) => {
    const source = code(path);
    expect(source).toMatch(/result\.kind === "error"/);
    expect(source).toContain("<ReadError");
  });

  it("the board marks the selected house's link as the current page", () => {
    expect(code(BOARD_PAGE)).toContain('aria-current={selected ? "page" : undefined}');
  });

  it("the square page 404s any house or position not spelled the one way", () => {
    const source = code(SQUARE_PAGE);
    expect(source).toContain("parseHouseParam(raw.house)");
    expect(source).toContain("parseActivityPosition(raw.position)");
    expect(source).toMatch(/if \(house === null \|\| position === null\) notFound\(\);/);
  });

  it("the square page plays a video with no type attribute, and loads nothing until play", () => {
    // Chrome refuses type="video/quicktime", yet plays the same file without it.
    const video = /<video[\s\S]*?\/>/.exec(code(SQUARE_PAGE))?.[0] ?? "";
    expect(video).toContain('preload="none"');
    expect(video).toContain("playsInline");
    expect(video).not.toMatch(/\btype=/);
    expect(code(SQUARE_PAGE)).toMatch(/<Image[\s\S]*?unoptimized[\s\S]*?\/>/);
  });
});

describe("AuditTrail", () => {
  it("accepts the two bingo entity types and an empty message", () => {
    // Type-level: `npx tsc --noEmit` compiles this file, so a union that lost
    // either type, or a prop that went away, fails the type check.
    type TrailProps = Parameters<typeof AuditTrail>[0];
    const mark: TrailProps = { entityType: "bingo_mark", entityId: UUID };
    const square: TrailProps = {
      entityType: "bingo_square",
      entityId: UUID,
      emptyMessage: "No officer has renamed this activity yet.",
    };
    expect([mark.entityType, square.entityType]).toEqual(["bingo_mark", "bingo_square"]);

    const source = code(AUDIT_TRAIL);
    expect(source).toMatch(/\| "bingo_mark"\s*\| "bingo_square"/);
    expect(source).toContain("emptyMessage ??");
  });

  it("labels the four bingo verbs rather than printing them raw", () => {
    const source = code(AUDIT_TRAIL);
    for (const verb of [
      "bingo_mark.added",
      "bingo_mark.replaced",
      "bingo_mark.removed",
      "bingo_square.renamed",
    ]) {
      expect(source).toMatch(new RegExp(`"${verb.replace(".", "\\.")}": "[^"]+"`));
    }
  });
});

describe("the admin nav", () => {
  it("lists Bingo after Dues and before Officers", () => {
    const source = code(NAV);
    const hrefs = [...source.matchAll(/\{ href: "([^"]+)", label: "([^"]+)", ready: (true|false) \}/g)].map(
      (m) => `${m[1]}|${m[2]}|${m[3]}`
    );
    const at = hrefs.indexOf("/admin/bingo|Bingo|true");
    expect(at).toBeGreaterThan(-1);
    expect(hrefs[at - 1]).toBe("/admin/dues|Dues|true");
    expect(hrefs[at + 1]).toBe("/admin/officers|Officers|true");
  });
});

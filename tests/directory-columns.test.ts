import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// The serializer Next's own `cookies().set()` writes through. Internal, and
// imported anyway: the cookie's failures are all silent ones — a delete on the
// wrong Path, an expiry overridden by a stray maxAge — and only the real
// serializer shows them. If Next moves it, this import fails loudly.
import { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { describe, expect, it, vi } from "vitest";

import {
  DEDICATED_COLUMNS,
  DIRECTORY_COLUMNS_COOKIE,
  DIRECTORY_COLUMNS_COOKIE_OPTIONS,
  EMPTY_CELL_TEXT,
  LOCKED_COLUMNS,
  MAX_DIRECTORY_COLUMNS_COOKIE_LENGTH,
  canonicalDirectoryColumns,
  defaultDirectoryColumns,
  directoryCellText,
  directoryColumns,
  directoryColumnsCookieWrite,
  directoryColumnsPreference,
  forcedSortColumn,
  isDefaultPreference,
  nextDirectoryColumnsPreference,
  parseDirectoryColumns,
  resolveDirectoryColumns,
  serializeDirectoryColumns,
  textCellFields,
  visibleColumnKeys,
  type DirectoryColumnsCookieWrite,
} from "@/lib/directory-columns";
import {
  DEFAULT_EXPORT_FIELDS,
  exportCatalogue,
  parseFieldSelection,
  projectRow,
  type ExportSourceRow,
} from "@/lib/export";
import { MEMBER_SORTS } from "@/lib/filters";
import type { FieldDefinition } from "@/lib/members";

// Pure tests for the directory's columns (officer decision 2026-10-01): one
// picker drives the table and the export, remembered per browser in a cookie
// holding a DELTA from the defaults. No database and no browser — what the
// toolbar does with a click is for the walkthrough; what the click MEANS is
// here.

function definition(over: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    key: "shirt_size",
    label: "Shirt size",
    kind: "select",
    options: ["S", "M", "L"],
    editableInline: true,
    showInDirectory: true,
    sortOrder: 0,
    archivedAt: null,
    ...over,
  };
}

function row(over: Partial<ExportSourceRow> = {}): ExportSourceRow {
  return {
    id: "00000000-0000-4000-8000-0000000000aa",
    eid: "abc1234",
    full_name: "Rowan Pike",
    email: "rowan@example.edu",
    term: "Fall 2026",
    source: "admin",
    joined_at: "2026-01-15T18:00:00.000Z",
    notes: null,
    total_points: 42,
    attendance_points: 30,
    bonus_points: 12,
    events_attended: 3,
    events_possible: 4,
    attendance_rate: 0.75,
    pending_count: 0,
    last_seen_at: "2026-03-01T02:00:00.000Z",
    dues_paid_term: false,
    custom_fields: {},
    ...over,
  };
}

// The three states a definition can be in, as far as the directory cares: a
// default column, a field hidden by default, and an archived one.
const SHIRT = definition();
const COMMITTEE = definition({
  id: "00000000-0000-4000-8000-000000000002",
  key: "committee",
  label: "Committee",
  showInDirectory: false,
  sortOrder: 1,
});
const RETIRED = definition({
  id: "00000000-0000-4000-8000-000000000003",
  key: "retired",
  label: "Retired",
  archivedAt: "2026-08-01T00:00:00.000Z",
  sortOrder: 2,
});
const DEFINITIONS = [SHIRT, COMMITTEE, RETIRED];

const catalogue = exportCatalogue(DEFINITIONS);
const defaults = defaultDirectoryColumns(catalogue, DEFINITIONS);
const keyOrder = catalogue.map((field) => field.key);

describe("the default columns", () => {
  it("are the built-in defaults plus every live default custom field", () => {
    expect(defaults).toEqual([
      "name",
      "email",
      "eid",
      "total_points",
      "dues",
      "shirt_size",
    ]);
  });

  it("leave out a field hidden by default, and an archived one", () => {
    expect(defaults).not.toContain("committee");
    expect(defaults).not.toContain("retired");
  });

  it("⚠️ ARE the default export: no cookie on screen = no fields in the URL", () => {
    // The whole decision in one assertion. An officer who never touched Fields
    // sees a table, and a request naming no fields (a hand-built link, an old
    // bookmark) must export that same table — the route's fallback is these
    // defaults, read without the cookie.
    const table = visibleColumnKeys(
      catalogue,
      resolveDirectoryColumns(catalogue, defaults, null),
      forcedSortColumn("name")
    );
    const file = parseFieldSelection([], catalogue, defaults).map(
      (field) => field.key
    );

    expect(file).toEqual(table);
    expect(table).toEqual(defaults);
  });

  it("keep the built-in half in DEFAULT_EXPORT_FIELDS", () => {
    // One list, not two: the export's built-in defaults are the table's.
    expect(defaults.filter((key) => key !== "shirt_size")).toEqual([
      ...DEFAULT_EXPORT_FIELDS,
    ]);
  });
});

describe("parseDirectoryColumns", () => {
  it("reads a well-formed value", () => {
    expect(parseDirectoryColumns("1~attendance_rate.notes~email")).toEqual({
      show: ["attendance_rate", "notes"],
      hide: ["email"],
    });
    expect(parseDirectoryColumns("1~~dues")).toEqual({
      show: [],
      hide: ["dues"],
    });
  });

  it("is TOTAL: anything malformed means the defaults, never an error", () => {
    for (const raw of [
      undefined,
      null,
      "",
      "garbage",
      "%zz",
      "1",
      "1~",
      "1~notes",
      "1~notes~email~eid",
      "~~",
      "~notes~",
      "2~notes~",
      "01~notes~",
      "1 ~notes~",
      "v1~notes~",
    ]) {
      expect(parseDirectoryColumns(raw), String(raw)).toBeNull();
    }
  });

  it("ignores a value longer than the cap", () => {
    const over = `1~${"notes.".repeat(600)}~`;
    expect(over.length).toBeGreaterThan(MAX_DIRECTORY_COLUMNS_COOKIE_LENGTH);
    expect(parseDirectoryColumns(over)).toBeNull();

    // At the cap it is still read — the bound is on length, not on content.
    const at = `1~${"a".repeat(MAX_DIRECTORY_COLUMNS_COOKIE_LENGTH - 3)}~`;
    expect(at.length).toBe(MAX_DIRECTORY_COLUMNS_COOKIE_LENGTH);
    expect(parseDirectoryColumns(at)).not.toBeNull();
  });

  it("🔓 drops every key that fails FIELD_KEY_PATTERN", () => {
    // `Email` is a case-folded spelling of a real key, `cf:x` is the SORT
    // namespace rather than a catalogue key, and `__proto__` is the one that
    // matters. A key too long or starting with a digit fails the same way.
    expect(
      parseDirectoryColumns(
        `1~Email.cf:x.__proto__.1abc.${"x".repeat(41)}.notes~EID.eid`
      )
    ).toEqual({ show: ["notes"], hide: ["eid"] });
  });

  it("collapses duplicates", () => {
    expect(parseDirectoryColumns("1~notes.notes.notes~email.email")).toEqual({
      show: ["notes"],
      hide: ["email"],
    });
  });

  it("treats a key in BOTH lists as hidden", () => {
    expect(parseDirectoryColumns("1~notes.term~notes")).toEqual({
      show: ["term"],
      hide: ["notes"],
    });
  });
});

describe("serializeDirectoryColumns", () => {
  it("round-trips through the parser", () => {
    const pref = {
      show: ["attendance_rate", "last_seen_at", "notes"],
      hide: ["email"],
    };
    const value = serializeDirectoryColumns(pref);

    expect(value).toBe("1~attendance_rate.last_seen_at.notes~email");
    expect(parseDirectoryColumns(value)).toEqual(pref);
  });

  it("🪤 is unchanged by encodeURIComponent", () => {
    // Next's cookies().set() encodes, cookies().get() URI-decodes, and
    // proxy.ts's session refresh re-encodes every request cookie — so a
    // character outside this set would come back different from what the
    // action wrote.
    for (const pref of [
      { show: ["attendance_rate", "notes"], hide: ["email"] },
      { show: [], hide: ["dues"] },
      { show: ["shirt_size", "events_attended"], hide: [] },
    ]) {
      const value = serializeDirectoryColumns(pref);
      expect(value).toMatch(/^[0-9a-z_.~]+$/);
      expect(encodeURIComponent(value)).toBe(value);
    }
  });

  it("checks each key before joining, so `a.b` cannot smuggle in two keys", () => {
    expect(
      serializeDirectoryColumns({ show: ["a.b", "Email", "notes"], hide: [] })
    ).toBe("1~notes~");
  });
});

describe("directoryColumnsPreference — the delta", () => {
  it("is EMPTY for exactly the defaults, which deletes the cookie", () => {
    const pref = directoryColumnsPreference(defaults, defaults);
    expect(pref).toEqual({ show: [], hide: [] });
    expect(isDefaultPreference(pref)).toBe(true);
    expect(isDefaultPreference(null)).toBe(true);
    // And the action, handed that, deletes rather than storing "1~~".
    expect(canonicalDirectoryColumns(serializeDirectoryColumns(pref))).toEqual({
      kind: "ok",
      value: null,
    });
  });

  it("records only the differences", () => {
    // The walkthrough's example: tick Attendance rate, Last seen and Officer
    // notes, untick Email.
    const chosen = keyOrder.filter((key) =>
      [
        "name",
        "eid",
        "total_points",
        "attendance_rate",
        "last_seen_at",
        "dues",
        "notes",
        "shirt_size",
      ].includes(key)
    );
    const pref = directoryColumnsPreference(chosen, defaults);

    expect(pref).toEqual({
      show: ["attendance_rate", "last_seen_at", "notes"],
      hide: ["email"],
    });
    expect(isDefaultPreference(pref)).toBe(false);
    expect(serializeDirectoryColumns(pref)).toBe(
      "1~attendance_rate.last_seen_at.notes~email"
    );
  });

  it("never puts Name in `hide`", () => {
    expect(directoryColumnsPreference(["email"], defaults).hide).not.toContain(
      "name"
    );
  });
});

describe("nextDirectoryColumnsPreference — what the page cannot see survives", () => {
  // 🐛 The review finding this exists for. fetchFieldDefinitions answers a
  // failed read with [], so that request's catalogue has no custom fields, and
  // a tick then rewrote the cookie without them — the officer's custom-field
  // choices gone for good after one bad request.
  const bare = exportCatalogue([]);
  const bareDefaults = defaultDirectoryColumns(bare, []);
  const tick = (keys: readonly string[], catalogueIn = bare) =>
    catalogueIn.map((field) => field.key).filter((key) => keys.includes(key));

  it("🐛 keeps entries for keys missing from a catalogue the definitions read emptied", () => {
    expect(bare.some((field) => field.source === "custom")).toBe(false);

    const previous = parseDirectoryColumns("1~committee~shirt_size");
    const next = nextDirectoryColumnsPreference(
      tick([...bareDefaults, "notes"]),
      bareDefaults,
      bare,
      previous
    );

    expect(next).toEqual({ show: ["committee", "notes"], hide: ["shirt_size"] });
    expect(serializeDirectoryColumns(next)).toBe("1~committee.notes~shirt_size");

    // …and once the read recovers, the choices are all still there.
    const recovered = resolveDirectoryColumns(catalogue, defaults, next);
    expect(recovered).toContain("committee");
    expect(recovered).toContain("notes");
    expect(recovered).not.toContain("shirt_size");
  });

  it("lets the officer's ticks decide every key the catalogue DOES have", () => {
    // Committee shown and Shirt size hidden, both in today's catalogue: the
    // ticks undo both, and there is nothing left to carry.
    const previous = parseDirectoryColumns("1~committee~shirt_size");
    const next = nextDirectoryColumnsPreference(
      defaults,
      defaults,
      catalogue,
      previous
    );
    expect(next).toEqual({ show: [], hide: [] });
    expect(isDefaultPreference(next)).toBe(true);
  });

  it("carries a choice about an ARCHIVED field, and a key that never existed", () => {
    // Storage permissive, application strict: the page ignores both on read,
    // and un-archiving the field brings the officer's choice back.
    const previous = parseDirectoryColumns("1~retired.made_up~");
    const next = nextDirectoryColumnsPreference(
      tick([...defaults, "attendance_rate"], catalogue),
      defaults,
      catalogue,
      previous
    );
    expect(next).toEqual({
      show: ["retired", "made_up", "attendance_rate"],
      hide: [],
    });
    expect(resolveDirectoryColumns(catalogue, defaults, next)).not.toContain(
      "retired"
    );
  });

  it("is the plain delta when there was no cookie", () => {
    const chosen = tick([...defaults, "notes"], catalogue);
    expect(
      nextDirectoryColumnsPreference(chosen, defaults, catalogue, null)
    ).toEqual(directoryColumnsPreference(chosen, defaults));
  });
});

describe("resolveDirectoryColumns", () => {
  it("is the defaults with no cookie", () => {
    expect(resolveDirectoryColumns(catalogue, defaults, null)).toEqual(defaults);
  });

  it("📌 shows a field created LATER as a default column to an officer who customised", () => {
    // The reason the cookie is a delta. This officer's choice predates the
    // field, and a stored list would have frozen it out.
    const pref = parseDirectoryColumns("1~notes~email");
    const major = definition({
      id: "00000000-0000-4000-8000-000000000004",
      key: "major",
      label: "Major",
      sortOrder: 3,
    });
    const later = [...DEFINITIONS, major];
    const laterCatalogue = exportCatalogue(later);

    const chosen = resolveDirectoryColumns(
      laterCatalogue,
      defaultDirectoryColumns(laterCatalogue, later),
      pref
    );

    expect(chosen).toContain("major");
    expect(chosen).toContain("notes");
    expect(chosen).not.toContain("email");
  });

  it("🔓 adds nothing for an archived, unknown or prototype-named key", () => {
    // Sets only, never object indexing: the cookie is user input.
    const viaCookie = parseDirectoryColumns(
      "1~retired.not_a_column.constructor.tostring.hasownproperty~"
    );
    expect(resolveDirectoryColumns(catalogue, defaults, viaCookie)).toEqual(
      defaults
    );

    // And handed straight in, past the parser's format check.
    expect(
      resolveDirectoryColumns(catalogue, defaults, {
        show: ["constructor", "toString", "__proto__", "valueOf"],
        hide: ["constructor", "__proto__"],
      })
    ).toEqual(defaults);
  });

  it("🔓 treats a real field keyed `constructor` as a field, and nothing more", () => {
    // What makes the test above worth having. `constructor` passes
    // FIELD_KEY_PATTERN and is not reserved, so an officer can create it — and
    // then `{}[key]`, `key in obj` or `obj[key] ?? fallback` all answer for it
    // from Object.prototype, with no cookie naming it at all. Hidden by
    // default, so every one of those shortcuts would wrongly put it on screen.
    const proto = definition({
      id: "00000000-0000-4000-8000-000000000005",
      key: "constructor",
      label: "Constructor",
      showInDirectory: false,
      sortOrder: 4,
    });
    const withProto = [...DEFINITIONS, proto];
    const protoCatalogue = exportCatalogue(withProto);
    const protoDefaults = defaultDirectoryColumns(protoCatalogue, withProto);
    expect(protoCatalogue.map((field) => field.key)).toContain("constructor");

    // Not a default, so not shown — with no cookie, or one naming other keys.
    expect(protoDefaults).not.toContain("constructor");
    for (const pref of [
      null,
      { show: [], hide: [] },
      { show: ["toString", "valueOf"], hide: ["__proto__"] },
      parseDirectoryColumns("1~notes~email"),
    ]) {
      const chosen = resolveDirectoryColumns(protoCatalogue, protoDefaults, pref);
      expect(chosen, JSON.stringify(pref)).not.toContain("constructor");
      expect(visibleColumnKeys(protoCatalogue, chosen, null)).not.toContain(
        "constructor"
      );
    }

    // Shown when the officer asks for it, and only then — and never sortable,
    // because it is not a default column.
    const asked = resolveDirectoryColumns(
      protoCatalogue,
      protoDefaults,
      parseDirectoryColumns("1~constructor~")
    );
    expect(asked).toContain("constructor");
    const [column] = directoryColumns(protoCatalogue, ["constructor"], withProto);
    expect(column).toMatchObject({ key: "constructor", sort: null });
    expect(column.definition).toEqual(proto);

    // And hiding it again works like any other key.
    expect(
      resolveDirectoryColumns(protoCatalogue, protoDefaults, {
        show: ["constructor"],
        hide: ["constructor"],
      })
    ).not.toContain("constructor");
  });

  it("still shows Name when the cookie hides it", () => {
    expect(
      resolveDirectoryColumns(catalogue, defaults, { show: [], hide: ["name"] })
    ).toContain("name");
    expect(
      resolveDirectoryColumns(catalogue, defaults, parseDirectoryColumns("1~~name"))
    ).toContain("name");
    expect(LOCKED_COLUMNS.has("name")).toBe(true);
  });

  it("comes out in catalogue order, whatever order the cookie lists", () => {
    const chosen = resolveDirectoryColumns(catalogue, defaults, {
      show: ["committee", "notes", "attendance_rate"],
      hide: ["email"],
    });

    expect(chosen).toEqual([
      "name",
      "eid",
      "total_points",
      "attendance_rate",
      "dues",
      "notes",
      "shirt_size",
      "committee",
    ]);
  });
});

describe("the sorted column", () => {
  it("stays on screen while the table is sorted by it, even when hidden", () => {
    const chosen = resolveDirectoryColumns(
      catalogue,
      defaults,
      parseDirectoryColumns("1~~total_points")
    );
    expect(chosen).not.toContain("total_points");

    expect(
      visibleColumnKeys(catalogue, chosen, forcedSortColumn("total_points"))
    ).toContain("total_points");
    // …and goes again once the sort does.
    expect(
      visibleColumnKeys(catalogue, chosen, forcedSortColumn("name"))
    ).toEqual(chosen);
  });

  it("maps a cf: sort to the bare catalogue key", () => {
    expect(forcedSortColumn("cf:shirt_size")).toBe("shirt_size");
  });

  it("forces nothing for Name, which is locked anyway", () => {
    expect(forcedSortColumn("name")).toBeNull();
  });

  it("forces nothing for a key that is not a sort", () => {
    // parseMemberFilter normally degrades these first; this holds anyway.
    expect(forcedSortColumn("notes")).toBeNull();
    expect(forcedSortColumn("toString")).toBeNull();
    expect(forcedSortColumn("")).toBeNull();
  });

  it("keeps the visible set in catalogue order", () => {
    expect(
      visibleColumnKeys(catalogue, ["notes", "name"], "email")
    ).toEqual(["name", "email", "notes"]);
  });
});

describe("no new sorting", () => {
  const everything = directoryColumns(catalogue, keyOrder, DEFINITIONS);
  const column = (key: string) => {
    const found = everything.find((c) => c.key === key);
    if (!found) throw new Error(`${key} is not a column`);
    return found;
  };

  it("📌 a built-in is sortable exactly when it is in MEMBER_SORTS", () => {
    for (const c of everything.filter((c) => c.definition === null)) {
      expect(c.sort !== null, c.key).toBe(
        (MEMBER_SORTS as readonly string[]).includes(c.key)
      );
      if (c.sort !== null) expect(c.sort).toBe(c.key);
    }
  });

  it("📌 a custom field is sortable exactly when it is a default column", () => {
    expect(column("shirt_size").sort).toBe("cf:shirt_size");
    expect(column("committee").sort).toBeNull();
  });

  it("spells a sortable header the way the sort labels do, and the rest as the file does", () => {
    // Name reads "Member" in the table and "Name" in the file — the one
    // wording difference between the two.
    expect(column("name").label).toBe("Member");
    expect(column("total_points").label).toBe("Total points");
    expect(column("attendance_rate").label).toBe("Attendance rate (%)");
    expect(column("shirt_size").label).toBe("Shirt size");
  });

  it("right-aligns the number and percent kinds only", () => {
    expect(column("total_points").numeric).toBe(true);
    expect(column("attendance_rate").numeric).toBe(true);
    expect(column("pending_count").numeric).toBe(true);
    expect(column("last_seen_at").numeric).toBe(false);
    expect(column("notes").numeric).toBe(false);
    expect(column("shirt_size").numeric).toBe(false);
  });

  it("hands a custom column its live definition, and a built-in none", () => {
    expect(column("shirt_size").definition).toEqual(SHIRT);
    expect(column("committee").definition).toEqual(COMMITTEE);
    expect(column("email").definition).toBeNull();
  });

  it("draws only the visible keys", () => {
    expect(
      directoryColumns(catalogue, defaults, DEFINITIONS).map((c) => c.key)
    ).toEqual(defaults);
  });
});

describe("the all-time labels", () => {
  it("⚠️ name both all-time aggregates as all-time, in the file and on screen", () => {
    // These two ignore the row's term while every other figure obeys it, and a
    // label is the header in the table, the picker and the file at once.
    const label = (key: string) =>
      catalogue.find((field) => field.key === key)?.label;
    expect(label("pending_count")).toBe("Pending submissions (all-time)");
    expect(label("last_seen_at")).toBe("Last seen (all-time)");

    const columns = directoryColumns(
      catalogue,
      ["pending_count", "last_seen_at"],
      DEFINITIONS
    );
    expect(columns.map((c) => c.label)).toEqual([
      "Pending submissions (all-time)",
      "Last seen (all-time)",
    ]);
  });
});

describe("textCellFields", () => {
  it("is the visible built-ins outside the dedicated columns", () => {
    expect(
      textCellFields(catalogue, [
        "name",
        "email",
        "attendance_rate",
        "dues",
        "notes",
        "shirt_size",
      ]).map((field) => field.key)
    ).toEqual(["attendance_rate", "notes"]);
  });

  it("🔓 never includes a column that is not on screen", () => {
    // Which is what keeps hidden officer notes on the server: the page projects
    // only these into a row's `cells`.
    expect(textCellFields(catalogue, defaults)).toEqual([]);
  });
});

describe("canonicalDirectoryColumns — what the action stores", () => {
  it("stores a well-formed choice as sent", () => {
    expect(canonicalDirectoryColumns("1~attendance_rate.notes~email")).toEqual({
      kind: "ok",
      value: "1~attendance_rate.notes~email",
    });
  });

  it("stores the CANONICAL spelling, never the one that was posted", () => {
    // A bad key dropped, a duplicate collapsed, a contradiction hidden.
    expect(
      canonicalDirectoryColumns("1~notes.Email.notes.term~term.email.email")
    ).toEqual({ kind: "ok", value: "1~notes~term.email" });
  });

  it("deletes for null, and for anything that comes to exactly the defaults", () => {
    for (const raw of [null, "1~~", "1~Email.cf:x.__proto__~"]) {
      expect(canonicalDirectoryColumns(raw), String(raw)).toEqual({
        kind: "ok",
        value: null,
      });
    }
  });

  it("🔓 refuses whatever the page would not read back as a choice", () => {
    // The argument arrives from a browser, typed or not.
    for (const raw of [
      undefined,
      "",
      "garbage",
      "%zz",
      "2~notes~",
      "1~notes~email~eid",
      42,
      true,
      {},
      ["1~notes~"],
      { show: ["notes"], hide: [] },
    ]) {
      expect(canonicalDirectoryColumns(raw), JSON.stringify(raw)).toEqual({
        kind: "invalid",
      });
    }
  });

  it("🔓 refuses a value longer than the page reads, and stores one at the cap", () => {
    // The write-side length check. The page ignores a cookie over the cap,
    // so storing one would quietly reset this officer's columns.
    const keys = (n: number) =>
      Array.from({ length: n }, (_, i) => `k${String(i).padStart(39, "0")}`);
    const value = (n: number) => `1~${keys(n).join(".")}~`;

    expect(value(73).length).toBeLessThanOrEqual(
      MAX_DIRECTORY_COLUMNS_COOKIE_LENGTH
    );
    expect(canonicalDirectoryColumns(value(73))).toEqual({
      kind: "ok",
      value: value(73),
    });

    expect(value(74).length).toBeGreaterThan(MAX_DIRECTORY_COLUMNS_COOKIE_LENGTH);
    expect(canonicalDirectoryColumns(value(74))).toEqual({ kind: "invalid" });
  });

  it("📌 does not check keys against any catalogue", () => {
    // Storage permissive, application strict: a field archived today, or one
    // a failed definitions read hid, must survive to be honoured tomorrow.
    expect(canonicalDirectoryColumns("1~retired.committee~shirt_size")).toEqual({
      kind: "ok",
      value: "1~retired.committee~shirt_size",
    });
  });
});

/** The Set-Cookie header Next would send for this write. */
function setCookieHeader(write: DirectoryColumnsCookieWrite): string {
  const headers = new Headers();
  new ResponseCookies(headers).set(write);
  return headers.get("set-cookie") ?? "";
}

describe("the cookie the action sets", () => {
  const setCookie = (value: string | null) =>
    setCookieHeader(directoryColumnsCookieWrite(value));

  it("pins its attributes in one place", () => {
    expect(DIRECTORY_COLUMNS_COOKIE).toBe("misa_directory_columns");
    expect(DIRECTORY_COLUMNS_COOKIE_OPTIONS).toEqual({
      path: "/admin/members",
      maxAge: 31_536_000,
      sameSite: "lax",
      httpOnly: true,
      // Not a production build here; the next test covers one.
      secure: false,
    });
  });

  it("🔓 is Secure in a production build, and only there", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    try {
      const built = await import("@/lib/directory-columns");
      expect(built.DIRECTORY_COLUMNS_COOKIE_OPTIONS.secure).toBe(true);
      expect(
        setCookieHeader(built.directoryColumnsCookieWrite("1~notes~"))
      ).toMatch(/; Secure(;|$)/);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it("writes the value verbatim, for a year, HttpOnly, on the directory's Path", () => {
    const header = setCookie("1~attendance_rate.notes~email");
    const [pair, ...attributes] = header.split("; ");

    expect(pair).toBe(`${DIRECTORY_COLUMNS_COOKIE}=1~attendance_rate.notes~email`);
    expect(attributes).toContain("Path=/admin/members");
    expect(attributes).toContain("Max-Age=31536000");
    expect(attributes).toContain("HttpOnly");
    expect(attributes).toContain("SameSite=lax");
    expect(attributes).not.toContain("Secure");
  });

  it("🪤 deletes with Max-Age=0 on the SAME Path", () => {
    // A delete on another path is another cookie, and the officer's choice
    // would survive "Reset to default".
    expect(setCookie(null)).toBe(
      `${DIRECTORY_COLUMNS_COOKIE}=; Path=/admin/members; Max-Age=0; HttpOnly; SameSite=lax`
    );
  });

  it("🪤 is a set, because both spellings of delete() would miss", () => {
    // Why directoryColumnsCookieWrite does not use cookies().delete(). These
    // assert Next's behaviour, not ours: if they ever fail, delete() may have
    // become usable — and the set above still works either way.
    const deleteBy = (...args: Parameters<ResponseCookies["delete"]>) => {
      const headers = new Headers();
      new ResponseCookies(headers).delete(...args);
      return headers.get("set-cookie") ?? "";
    };

    // By name alone: the default Path, which is not ours.
    expect(deleteBy(DIRECTORY_COLUMNS_COOKIE)).toContain("Path=/;");

    // With our options: the year-long maxAge overrides the delete's expiry.
    expect(
      deleteBy({ name: DIRECTORY_COLUMNS_COOKIE, ...DIRECTORY_COLUMNS_COOKIE_OPTIONS })
    ).toContain("Max-Age=31536000");
  });
});

describe("directoryCellText", () => {
  const pick = (...keys: string[]) =>
    parseFieldSelection(keys.join(","), catalogue);

  it("⚠️ prints a null rate as a dash and a real zero as 0%", () => {
    // §4.5: a term with no completed events has no rate, and a member who
    // attended nothing is a real 0. The table must keep them apart too.
    const [none] = projectRow(row({ attendance_rate: null }), pick("attendance_rate"));
    const [zero] = projectRow(row({ attendance_rate: 0 }), pick("attendance_rate"));

    expect(directoryCellText(none)).toBe("—");
    expect(directoryCellText(zero)).toBe("0%");
    expect(directoryCellText({ kind: "percent", value: 0.75 })).toBe("75%");
  });

  it("🪤 prints a date as its CENTRAL civil date", () => {
    // 02:00Z on the 15th is 21:00 Central on the 14th.
    const [seen] = projectRow(
      row({ last_seen_at: "2026-03-15T02:00:00.000Z" }),
      pick("last_seen_at")
    );
    expect(directoryCellText(seen)).toBe("Mar 14, 2026");
  });

  it("passes numbers and text through, and prints empty as a dash", () => {
    expect(directoryCellText({ kind: "number", value: 0 })).toBe("0");
    expect(directoryCellText({ kind: "number", value: -5 })).toBe("-5");
    expect(directoryCellText({ kind: "text", value: "Rowan" })).toBe("Rowan");
    expect(directoryCellText({ kind: "empty" })).toBe(EMPTY_CELL_TEXT);
  });
});

// ---------------------------------------------------------------------------
// Source assertions
// ---------------------------------------------------------------------------
//
// Wiring that lives in a route, a Client Component or JSX, which a
// node-environment suite cannot render. Matched against COMMENT-STRIPPED
// source, as in tests/export.test.ts: these files explain in prose the very
// things they must not do, and a bare substring check would punish that.

const code = (path: string) =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/** Every .ts/.tsx file under `dir`. */
function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry)) files.push(full);
  }
  return files;
}

/** The directive is the first non-empty line, so prose mentioning it does not
 * count — the same test tests/members.test.ts applies. */
const isClient = (path: string) =>
  readFileSync(path, "utf8")
    .split("\n")
    .find((line) => line.trim() !== "")
    ?.trim() === '"use client";';

const PAGE = "app/admin/(shell)/members/page.tsx";
const TOOLBAR = "app/admin/(shell)/members/_components/export-toolbar.tsx";
const ACTION = "app/actions/directory-columns.ts";

describe("the wiring", () => {
  it("🔓 the export route falls back to the directory defaults and never reads the cookie", () => {
    // The URL is the contract the audit receipt records. A file that depended
    // on which browser followed the link could not be reproduced from it.
    const route = code("app/admin/(shell)/members/export/route.ts");
    expect(route).toContain("defaultDirectoryColumns(");
    expect(route).not.toContain("cookies(");
    expect(route).not.toContain("DIRECTORY_COLUMNS_COOKIE");
    expect(route).not.toContain(DIRECTORY_COLUMNS_COOKIE);
  });

  it("the page reads the cookie by its one name", () => {
    const page = code(PAGE);
    expect(page).toContain("cookies()");
    expect(page).toContain("DIRECTORY_COLUMNS_COOKIE");
  });

  it("🔓 the toolbar never writes the cookie itself: it calls the action", () => {
    // WebKit (Safari, every iOS browser) and Brave cap a cookie written by
    // script at seven days, so the year-long choice has to arrive as a
    // server's Set-Cookie.
    const toolbar = code(TOOLBAR);
    expect(toolbar).not.toContain("document.cookie");
    expect(toolbar).not.toContain("Path=");
    expect(toolbar).toContain("await rememberDirectoryColumns(");
    expect(code("lib/directory-columns.ts")).not.toContain("document.cookie");
  });

  it("⚠️ the toolbar builds the export URL from the server-confirmed columns", () => {
    // Never the optimistic ticks: mid-change, the file must still be the table
    // that is actually on screen.
    const toolbar = code(TOOLBAR);
    const start = toolbar.indexOf("const url = useMemo(");
    expect(start).toBeGreaterThan(-1);
    const block = toolbar.slice(start, toolbar.indexOf("]);", start) + 3);

    expect(block).toContain("visibleColumnKeys(catalogue, preferred, sorted)");
    expect(block).toContain('params.append("fields", key)');
    expect(block).not.toMatch(/\b(optimistic|chosen|shown)\b/);
  });

  it("🔓 the page projects only the visible plain columns into the rows", () => {
    // What keeps hidden officer notes off the client: fetchDirectory formats
    // `cells` for these fields and no others.
    expect(code(PAGE)).toMatch(
      /fetchDirectory\(\s*db,\s*filter,\s*fields,\s*currentTerm,\s*textCellFields\(catalogue, visibleKeys\)\s*\)/
    );
  });

  it("the page hands the toolbar the cookie it parsed", () => {
    // The toolbar's next change is built on it, so entries for keys a
    // failed definitions read hid are kept.
    const page = code(PAGE);
    expect(page).toContain("resolveDirectoryColumns(catalogue, defaults, previous)");
    expect(page).toContain("previous={previous}");
  });

  it("🪤 no Client Component names directoryCellText", () => {
    // It calls Intl, which inside a Client Component runs on both sides of
    // hydration with different ICU data.
    const clients = ["app", "components"]
      .flatMap(sourceFiles)
      .filter(isClient);

    // The walk has to have found the files that matter, or this passes vacuously.
    const names = clients.map((path) => path.replace(/\\/g, "/"));
    expect(names.some((p) => p.endsWith("members/_components/directory-row.tsx"))).toBe(true);
    expect(names.some((p) => p.endsWith("members/_components/export-toolbar.tsx"))).toBe(true);

    // Comment-stripped, because directory-row.tsx names the function in prose
    // precisely to warn against importing it.
    for (const path of clients) {
      expect(code(path), path).not.toContain("directoryCellText");
    }
  });

  it("⚠️ the picker puts no title on anything", () => {
    // A locked box is disabled, and a title on a disabled control reaches
    // nobody. The reason is visible text instead.
    expect(code("app/admin/(shell)/_components/export-controls.tsx")).not.toContain(
      "title="
    );
  });

  it("the row draws every dedicated column", () => {
    // A key in DEDICATED_COLUMNS gets no server text, so a row without a case
    // for it would print an empty cell under a real header.
    const row = code("app/admin/(shell)/members/_components/directory-row.tsx");
    for (const key of DEDICATED_COLUMNS) {
      expect(row, key).toContain(`case "${key}":`);
    }
  });
});

describe("the action", () => {
  // A "use server" export needs a request context, so it is not called from
  // here — the house convention (tests/presets.test.ts). Its decisions live in
  // canonicalDirectoryColumns and directoryColumnsCookieWrite, tested above;
  // what is left to pin is the wiring.
  const source = readFileSync(ACTION, "utf8");
  const actionCode = code(ACTION);

  it("is a Server Action module with exactly one export", () => {
    // Every export of a "use server" module is a public endpoint.
    expect(source.split("\n").find((line) => line.trim() !== "")?.trim()).toBe(
      '"use server";'
    );
    const exported = [
      ...source.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm),
    ].map((m) => m[1]);
    expect(exported).toEqual(["rememberDirectoryColumns"]);
  });

  it("🔓 opens with getOfficer() and returns unauthorized, never requireOfficer()", () => {
    // requireOfficer()'s redirect() throws NEXT_REDIRECT, and the caller gets
    // an exception where it expected a result.
    expect(actionCode).toMatch(
      /export async function rememberDirectoryColumns\([^)]*\)[^{]*\{\s*const officer = await getOfficer\(\);\s*if \(!officer\) return \{ status: "unauthorized" \};/
    );
    expect(actionCode).not.toContain("requireOfficer");
  });

  it("canonicalises before writing, and writes through the one cookie builder", () => {
    expect(actionCode).toContain("canonicalDirectoryColumns(value)");
    expect(actionCode).toContain(
      "(await cookies()).set(directoryColumnsCookieWrite(canonical.value))"
    );
    // A delete is a set with maxAge 0 — see "the cookie the action sets".
    expect(actionCode).not.toContain(".delete(");
  });

  it("writes no audit row, and says why", () => {
    // A display preference in the officer's own browser, not club data. The
    // export it shapes is audited where it leaves.
    expect(actionCode).not.toContain("writeAudit");
    expect(source).toContain("No `admin_audit` row");
  });
});

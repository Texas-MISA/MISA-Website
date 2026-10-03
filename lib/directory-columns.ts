// The member directory's columns (§7 Stage 6; officer decision 2026-10-01).
// Pure — no next/* imports and no supabase-js — so Vitest drives it directly,
// the same contract as lib/export.ts and lib/filters.ts. The page reads the
// cookie and the officer-only Server Action `rememberDirectoryColumns`
// (app/actions/directory-columns.ts) writes it; everything with a decision in
// it is here.
//
// ⚠️ **ONE picker drives the table AND the export.** The "Fields (N)" menu on
// /admin/members was export-only from phase 5 (2026-08-06) until 2026-10-01:
// ticking a box reshaped the download and left the table alone, which read as
// a broken control rather than as two features. Since then the visible columns
// ARE the export's columns — Download XLSX/CSV and Copy table carry exactly
// what is on screen, in screen order. That reverses two documented rules on the
// officer's instruction: Dues being opt-in for a file (it is a default column,
// so it is a default export), and "columns are the one thing that legitimately
// differs from the screen".
//
// Four things live here, and only here:
//   1. the DEFAULT set — the built-ins in DEFAULT_EXPORT_FIELDS plus every live
//      custom field marked as a default column, so the default table is the
//      default file;
//   2. the COOKIE that remembers an officer's choice per browser, so the first
//      paint already has their columns — no migration, no URL parameter, and
//      saved views are untouched;
//   3. the officer's PREFERENCE (P), stored as a DELTA from the defaults, so a
//      field created later as a default column still appears for officers who
//      customised before it existed;
//   4. the VISIBLE set — P, plus Name (locked), plus the column the table is
//      sorted by (forced on, so a sort is never invisible).
//
// 🔓 **The cookie is user input.** Every key is checked against
// FIELD_KEY_PATTERN, and every resolution walks the CATALOGUE and tests Set
// membership — never `object[key]` — so a cookie naming `constructor`,
// `toString` or `__proto__` adds nothing.
//
// 📌 **No new sorting.** A column is sortable exactly when `sortColumn` already
// accepts its key. Making a column displayable does not make it sortable, and
// `directoryColumns` asks `sortColumn` rather than keeping a list of its own.

import {
  DEFAULT_EXPORT_FIELDS,
  type ExportCell,
  type ExportField,
} from "@/lib/export";
import { formatDay } from "@/lib/events";
import {
  MEMBER_SORT_LABELS,
  MEMBER_SORTS,
  sortColumn,
  type MemberBuiltinSort,
  type MemberSort,
} from "@/lib/filters";
import {
  customFieldKey,
  FIELD_KEY_PATTERN,
  formatAttendanceRate,
  parseCustomFieldKey,
  type FieldDefinition,
} from "@/lib/members";

/** The cookie's name. Read on the server by members/page.tsx, written by the
 * Server Action `rememberDirectoryColumns` — and NEVER read by the export
 * route (see `defaultDirectoryColumns`). */
export const DIRECTORY_COLUMNS_COOKIE = "misa_directory_columns";

/** The format version, and the value's first part. A value carrying any other
 * version is ignored rather than guessed at, so the format can change later
 * without an old cookie being misread under the new rules. */
const COOKIE_VERSION = "1";

/**
 * Longer than this and the value is ignored, which reads as the defaults.
 *
 * Generous: a real preference names a handful of keys, and showing every
 * built-in plus fifty custom fields with 40-character keys comes to about
 * 2,200. What it bounds is a hand-edited cookie, which is parsed on every
 * directory request.
 */
export const MAX_DIRECTORY_COLUMNS_COOKIE_LENGTH = 3000;

/**
 * The cookie's attributes: the ONE place they are spelled, for the write and
 * the delete alike (`directoryColumnsCookieWrite`).
 *
 * 🔓 **Set by the server as an HTTP `Set-Cookie`, never by script.** The first
 * build wrote it with `document.cookie`, and WebKit's tracking prevention caps
 * a cookie written by script at SEVEN DAYS — Safari, and every browser on iOS —
 * with Brave doing the same. There the "year" was a week, and an officer's
 * columns quietly went back to the defaults. A cookie set in an HTTP response
 * keeps its Max-Age.
 *
 * - `path`: the only screen that reads it, so the only path it is sent on.
 *   Path-matching is a prefix, so `/admin/members/export` receives it too — and
 *   ignores it, deliberately. 🪤 A delete must name the SAME path, or the
 *   browser treats it as a different cookie and the old one survives.
 * - `maxAge`: a year, in seconds. Only a change rewrites it — a visit does not
 *   — so a choice left untouched for a year expires back to the defaults.
 * - `httpOnly`: no script reads it. The page reads it on the server and hands
 *   the toolbar what it needs as props.
 * - `secure`: in production, which is HTTPS. Not on the dev server, which is
 *   plain http, where a browser may refuse a Secure cookie outright.
 */
export const DIRECTORY_COLUMNS_COOKIE_OPTIONS = {
  path: "/admin/members",
  maxAge: 31_536_000,
  sameSite: "lax",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
} as const;

/**
 * Always shown, never hideable.
 *
 * Name is the row's identity and the link to the member's page; a table
 * without it is a list of numbers nobody can attribute. A cookie that hides it
 * is ignored for this key, and the picker renders its box checked and
 * disabled with the reason beside it.
 */
export const LOCKED_COLUMNS: ReadonlySet<string> = new Set(["name"]);

/**
 * The built-ins the directory row draws with markup of its own — the name link
 * and its SELF pill, the monospace EID, the Dues pill — rather than as plain
 * text from the server.
 *
 * Every other built-in arrives as a server-formatted string in
 * `MemberRow.cells` (see `textCellFields`). tests/directory-columns.test.ts
 * asserts directory-row.tsx handles every key here, because a key added to
 * this set and not to the row would render nothing at all.
 */
export const DEDICATED_COLUMNS: ReadonlySet<string> = new Set([
  "name",
  "email",
  "eid",
  "total_points",
  "dues",
]);

/**
 * An officer's choice, as a DELTA from the defaults: keys to show that are not
 * defaults, and defaults to hide.
 *
 * 📌 A delta rather than a list, and that is the design rather than a
 * compression trick. A stored list would freeze the defaults as they were on
 * the day the officer last ticked a box, so a custom field created afterwards
 * as a default column would never reach the people who had customised —
 * exactly the officers who use the table most.
 */
export type DirectoryColumnsPreference = {
  show: readonly string[];
  hide: readonly string[];
};

/** One column of the directory table, as the table and the row draw it. */
export type DirectoryColumn = {
  /** The catalogue key — bare, never `cf:`-prefixed. */
  key: string;
  /** The header. A sortable built-in takes MEMBER_SORT_LABELS' spelling. */
  label: string;
  /** Right-aligned with tabular figures: the number and percent kinds. */
  numeric: boolean;
  /** The sort key a header link sends, or null for a plain header. */
  sort: MemberSort | null;
  /** The live definition behind a custom column; null for a built-in. */
  definition: FieldDefinition | null;
};

/**
 * The default columns: DEFAULT_EXPORT_FIELDS plus every live custom field
 * marked "Show as a default column", in catalogue order.
 *
 * 🔓 This is also the export route's fallback when a URL names no `fields`, and
 * the route reaches it WITHOUT reading the cookie. The URL is the contract the
 * audit receipt records: a file must be a function of the link that produced
 * it, not of which browser happened to follow it.
 */
export function defaultDirectoryColumns(
  catalogue: readonly ExportField[],
  definitions: readonly FieldDefinition[]
): string[] {
  const builtins = new Set(DEFAULT_EXPORT_FIELDS);
  const custom = new Set(
    definitions
      .filter((definition) => definition.archivedAt === null)
      .filter((definition) => definition.showInDirectory)
      .map((definition) => definition.key)
  );
  return catalogue
    .filter((field) =>
      field.source === "custom" ? custom.has(field.key) : builtins.has(field.key)
    )
    .map((field) => field.key);
}

/** Keys that survive the format check, deduplicated, in the order given. The
 * check runs per key BEFORE any joining, so `a.b` is dropped whole rather than
 * split into two keys that each pass. */
function cleanKeys(keys: readonly string[]): string[] {
  return [...new Set(keys.filter((key) => FIELD_KEY_PATTERN.test(key)))];
}

/** A delta with bad keys dropped and the hide-wins rule applied. */
function normalise(pref: DirectoryColumnsPreference): DirectoryColumnsPreference {
  const hide = cleanKeys(pref.hide);
  const hidden = new Set(hide);
  return {
    show: cleanKeys(pref.show).filter((key) => !hidden.has(key)),
    hide,
  };
}

/**
 * The cookie value → a preference, or null for "use the defaults".
 *
 * TOTAL, like parseMemberFilter: the value arrives from a browser and may have
 * been edited, so nothing here throws. Missing, empty, over-long, not exactly
 * three `~`-separated parts, or a version other than `1` → null. Inside a
 * well-formed value, a key that fails FIELD_KEY_PATTERN is dropped, a duplicate
 * collapses, and a key named in both lists is treated as HIDDEN — the safer
 * reading of a contradiction, since a hidden column costs a click and an
 * unexpected one can carry notes onto a shared screen.
 *
 * 🪤 Whether a key names a real column is NOT decided here. That needs the
 * catalogue, and `resolveDirectoryColumns` answers it by walking the catalogue
 * — so an unknown or archived key costs nothing and is never an error.
 */
export function parseDirectoryColumns(
  raw: string | null | undefined
): DirectoryColumnsPreference | null {
  if (typeof raw !== "string" || raw === "") return null;
  if (raw.length > MAX_DIRECTORY_COLUMNS_COOKIE_LENGTH) return null;

  const parts = raw.split("~");
  if (parts.length !== 3 || parts[0] !== COOKIE_VERSION) return null;

  return normalise({ show: parts[1].split("."), hide: parts[2].split(".") });
}

/**
 * A preference → the cookie value: `1~<show>~<hide>`, each list joined by `.`.
 *
 * 🪤 The value is built from `[0-9a-z_.~]` and nothing else — FIELD_KEY_PATTERN
 * allows only `[a-z0-9_]` in a key — which makes it identical under
 * encodeURIComponent. That is load-bearing, not tidy: Next's `cookies().set()`
 * URI-ENCODES the value it writes, `cookies().get()` URI-DECODES what it
 * reads, and proxy.ts's session refresh re-ENCODES every request cookie when it
 * sets one, so any character outside that set would come back different from
 * what was written.
 */
export function serializeDirectoryColumns(
  pref: DirectoryColumnsPreference
): string {
  const clean = normalise(pref);
  return [COOKIE_VERSION, clean.show.join("."), clean.hide.join(".")].join("~");
}

/**
 * What the officer ticked → the delta from the defaults.
 *
 * `show` keeps the order `chosen` arrives in, so a caller passing catalogue
 * order gets a stable cookie. A LOCKED key never lands in `hide`: the box
 * cannot be unticked, and a cookie claiming otherwise is ignored anyway.
 */
export function directoryColumnsPreference(
  chosen: Iterable<string>,
  defaults: readonly string[]
): DirectoryColumnsPreference {
  const on = new Set(chosen);
  const base = new Set(defaults);
  return normalise({
    show: [...on].filter((key) => !base.has(key)),
    hide: defaults.filter((key) => !on.has(key) && !LOCKED_COLUMNS.has(key)),
  });
}

/**
 * Is this the defaults, exactly? Then there is nothing to remember and the
 * cookie is DELETED rather than written empty — so "Reset to default" leaves
 * no trace, and a later change to the defaults reaches this officer in full.
 */
export function isDefaultPreference(
  pref: DirectoryColumnsPreference | null
): boolean {
  return pref === null || (pref.show.length === 0 && pref.hide.length === 0);
}

/**
 * A change to the ticks → the new preference, KEEPING whatever the previous
 * cookie said about keys this page cannot see.
 *
 * `directoryColumnsPreference` answers for the catalogue's keys, which are the
 * only boxes the picker draws. An entry in `previous` whose key is NOT in
 * today's catalogue is carried over untouched, ahead of the new entries.
 *
 * 🐛 Without the carry, one failed definitions read erased an officer's
 * custom-field choices for good. `fetchFieldDefinitions` answers a failure with
 * `[]`, so that request's catalogue has no custom fields at all, and the next
 * box ticked rewrote the cookie from a catalogue that did not contain them. The
 * same carry keeps a choice about a field that is archived today, so
 * un-archiving it brings the officer's choice back with it. Storage is
 * permissive; application stays strict — the page resolves every key against
 * the catalogue on read, so a carried key costs nothing while it names no
 * column.
 *
 * ⚠️ "Reset to default" does not come through here. It deletes the cookie
 * outright, carried entries included: it means the defaults, for the fields
 * the page could not see when it was pressed as much as for the rest.
 */
export function nextDirectoryColumnsPreference(
  chosen: Iterable<string>,
  defaults: readonly string[],
  catalogue: readonly ExportField[],
  previous: DirectoryColumnsPreference | null
): DirectoryColumnsPreference {
  const next = directoryColumnsPreference(chosen, defaults);
  if (previous === null) return next;

  const known = new Set(catalogue.map((field) => field.key));
  const unseen = (keys: readonly string[]) =>
    keys.filter((key) => !known.has(key));
  return normalise({
    show: [...unseen(previous.show), ...next.show],
    hide: [...unseen(previous.hide), ...next.hide],
  });
}

/**
 * The officer's preference P: the columns they have chosen, in catalogue order.
 *
 * Defaults, plus `show`, minus `hide`, plus every LOCKED key. Walks the
 * catalogue and tests Sets, so the result can only ever name real, live
 * columns: an archived field, a key that never existed and `constructor` all
 * contribute nothing.
 *
 * This is NOT yet the visible set — `visibleColumnKeys` adds the sorted column.
 * The picker's ticks are P, so a column shown only because the table is sorted
 * by it reads as unticked, with a note saying why it is there.
 */
export function resolveDirectoryColumns(
  catalogue: readonly ExportField[],
  defaults: readonly string[],
  pref: DirectoryColumnsPreference | null
): string[] {
  const base = new Set(defaults);
  const show = new Set(pref?.show ?? []);
  const hide = new Set(pref?.hide ?? []);
  return catalogue
    .filter(
      (field) =>
        LOCKED_COLUMNS.has(field.key) ||
        (!hide.has(field.key) && (base.has(field.key) || show.has(field.key)))
    )
    .map((field) => field.key);
}

/**
 * The catalogue key a sort forces onto the screen, or null.
 *
 * ⚠️ Null for Name, which is locked on anyway. A `cf:x` sort forces `x`, the
 * bare catalogue key. A sort the URL could name but `parseMemberFilter` has
 * already degraded to `name` never reaches here; anything else that is not a
 * built-in sort is null rather than passed through, so the visible set never
 * depends on the caller having validated first.
 */
export function forcedSortColumn(sort: MemberSort): string | null {
  const custom = parseCustomFieldKey(sort);
  if (custom !== null) return custom;
  if (LOCKED_COLUMNS.has(sort)) return null;
  return isBuiltinSort(sort) ? sort : null;
}

/**
 * The columns on screen, in catalogue order: P, the locked columns, and the
 * sorted column.
 *
 * 📌 Forcing the sorted column is what keeps "a sort on a column nobody can
 * see" impossible — the rule that cut phase 1's ten sort keys to four. An
 * officer can arrive at a hidden column's sort by a bookmark, a saved view or
 * a shared link; the column comes back while the sort holds and goes again
 * when it does not.
 */
export function visibleColumnKeys(
  catalogue: readonly ExportField[],
  preferred: readonly string[],
  sorted: string | null
): string[] {
  const on = new Set(preferred);
  return catalogue
    .filter(
      (field) =>
        LOCKED_COLUMNS.has(field.key) ||
        on.has(field.key) ||
        field.key === sorted
    )
    .map((field) => field.key);
}

function isBuiltinSort(key: string): key is MemberBuiltinSort {
  return (MEMBER_SORTS as readonly string[]).includes(key);
}

/**
 * The visible keys → the columns the table draws.
 *
 * 📌 `sort` is set ONLY where `sortColumn` already accepts the key, which is
 * what keeps "no new sorting" structural rather than remembered: a built-in is
 * sortable exactly when it is in MEMBER_SORTS, a custom field exactly when it
 * is a default column. Every other column gets a plain header.
 *
 * A sortable built-in takes MEMBER_SORT_LABELS' spelling, so the header and a
 * saved view's "sorted by …" summary cannot drift apart. That makes Name read
 * "Member" in the table while the file says "Name" — the one wording
 * difference between the two. Everything else uses the catalogue label, which
 * is the file's header.
 */
export function directoryColumns(
  catalogue: readonly ExportField[],
  visibleKeys: readonly string[],
  definitions: readonly FieldDefinition[]
): DirectoryColumn[] {
  const visible = new Set(visibleKeys);
  const byKey = new Map(
    definitions.map((definition) => [definition.key, definition])
  );

  return catalogue
    .filter((field) => visible.has(field.key))
    .map((field): DirectoryColumn => {
      if (field.source === "custom") {
        const key = customFieldKey(field.key);
        return {
          key: field.key,
          label: field.label,
          numeric: false,
          sort: sortColumn(key, definitions) === null ? null : key,
          definition: byKey.get(field.key) ?? null,
        };
      }

      // The MEMBER_SORTS check comes first and is not redundant: sortColumn
      // indexes a plain object, so the list check is what keeps a key named
      // like an Object.prototype property out of the header logic entirely.
      const sort =
        isBuiltinSort(field.key) && sortColumn(field.key, definitions) !== null
          ? field.key
          : null;
      return {
        key: field.key,
        label: sort === null ? field.label : MEMBER_SORT_LABELS[sort],
        numeric: field.kind === "number" || field.kind === "percent",
        sort,
        definition: null,
      };
    });
}

/**
 * The visible built-ins that arrive as server-formatted TEXT: everything on
 * screen except the custom fields and DEDICATED_COLUMNS.
 *
 * The page projects exactly these through `projectRow` — the export's own
 * projection, so the screen and the file cannot disagree about what a cell
 * holds — and formats them with `directoryCellText`. A column that is not on
 * screen is never projected, so hidden officer notes never reach the browser.
 */
export function textCellFields(
  catalogue: readonly ExportField[],
  visibleKeys: readonly string[]
): ExportField[] {
  const visible = new Set(visibleKeys);
  return catalogue.filter(
    (field) =>
      field.source === "builtin" &&
      visible.has(field.key) &&
      !DEDICATED_COLUMNS.has(field.key)
  );
}

/**
 * What `rememberDirectoryColumns` was posted → what the cookie should hold:
 * a canonical value, or null for a DELETE.
 *
 * The action's argument comes from a browser, so it is checked rather than
 * trusted. Anything but null or a string is refused. A string goes through the
 * same TOTAL parser the page reads with and back out through the serializer,
 * so what is stored is always the canonical spelling of something the page
 * reads the same way:
 *   - null, or a value that parses to exactly the defaults → null. There is
 *     nothing to remember, so the cookie is deleted rather than written empty.
 *   - a value the parser refuses → invalid. The page would read it as the
 *     defaults, and storing it would claim a choice nobody can see.
 *   - a canonical value over MAX_DIRECTORY_COLUMNS_COOKIE_LENGTH → invalid,
 *     because the page ignores anything longer and the officer's columns would
 *     quietly reset on the next request. The parser already refuses a longer
 *     raw value and canonicalising never lengthens one, so this holds twice;
 *     it is checked here as the property itself, not left to follow from two
 *     other functions' details.
 *
 * 📌 Keys are NOT checked against the field catalogue. Storage is permissive;
 * application stays strict: the page resolves every key against the catalogue
 * on read, and a key for a field that is archived today — or that a failed
 * definitions read hid — has to survive to be honoured tomorrow.
 */
export function canonicalDirectoryColumns(
  raw: unknown
): { kind: "ok"; value: string | null } | { kind: "invalid" } {
  if (raw === null) return { kind: "ok", value: null };
  if (typeof raw !== "string") return { kind: "invalid" };

  const pref = parseDirectoryColumns(raw);
  if (pref === null) return { kind: "invalid" };
  if (isDefaultPreference(pref)) return { kind: "ok", value: null };

  const value = serializeDirectoryColumns(pref);
  return value.length > MAX_DIRECTORY_COLUMNS_COOKIE_LENGTH
    ? { kind: "invalid" }
    : { kind: "ok", value };
}

/** The one argument the action hands `cookies().set()`. Shaped like Next's
 * `ResponseCookie` without importing it, which this module may not. */
export type DirectoryColumnsCookieWrite = {
  name: string;
  value: string;
  path: string;
  maxAge: number;
  sameSite: "lax";
  httpOnly: boolean;
  secure: boolean;
};

/**
 * Write `value`, or DELETE the cookie with null.
 *
 * 🪤 **A delete is `set` with `maxAge: 0`, never `cookies().delete(…)`.** Both
 * spellings of delete fail here, silently, and both were checked against Next's
 * own cookie serializer (next/dist/compiled/@edge-runtime/cookies):
 *   - `delete("misa_directory_columns")` writes `Path=/`, which is a different
 *     cookie from ours, so the real one survives;
 *   - `delete({ name, ...DIRECTORY_COLUMNS_COOKIE_OPTIONS })` carries the
 *     year-long `maxAge` along, which overrides the delete's expiry and stores
 *     an empty cookie for a year instead.
 * Spreading the one options object keeps the path identical by construction.
 * tests/directory-columns.test.ts runs both results through that serializer.
 */
export function directoryColumnsCookieWrite(
  value: string | null
): DirectoryColumnsCookieWrite {
  return value === null
    ? {
        name: DIRECTORY_COLUMNS_COOKIE,
        value: "",
        ...DIRECTORY_COLUMNS_COOKIE_OPTIONS,
        maxAge: 0,
      }
    : { name: DIRECTORY_COLUMNS_COOKIE, value, ...DIRECTORY_COLUMNS_COOKIE_OPTIONS };
}

/** What an empty cell reads as, on screen. The file leaves it blank instead. */
export const EMPTY_CELL_TEXT = "—";

/**
 * One projected cell → the text the directory prints.
 *
 * 🪤 **SERVER ONLY**, and the module cannot enforce that for it: this file is
 * imported by the toolbar too, so it carries no `server-only` guard. A date
 * goes through `formatDay`, which is Intl, and Intl inside a Client Component
 * runs on both sides of hydration — Node and Chrome ship different ICU data and
 * the diff shows two strings that look identical. The page calls this; no
 * client file may name it (tests/directory-columns.test.ts checks).
 *
 * ⚠️ A null rate is "—" and never "0%". `projectRow` already keeps the two
 * apart (an empty cell versus a percent of 0), and `formatAttendanceRate` is
 * the same rule the detail page prints with (§4.5).
 */
export function directoryCellText(cell: ExportCell): string {
  switch (cell.kind) {
    case "empty":
      return EMPTY_CELL_TEXT;
    case "number":
      return String(cell.value);
    case "percent":
      return formatAttendanceRate(cell.value);
    case "date":
      return formatDay(cell.value);
    case "text":
      return cell.value;
  }
}

// Member directory filters (§7 Stage 6). Pure — no next/* imports, no client —
// so Vitest exercises the translation directly, the same contract as
// lib/events.ts and lib/attendance.ts.
//
// ⚠️ This module is the stage's load-bearing piece, and the reason is worth
// stating before the code: §7's exit criterion is that an officer filters the
// roster and copies a *complete* email list, and the classic way that screen
// breaks is the rendered query and the export query drifting apart, so "copy all
// 60 matching" quietly returns whatever subset happened to be on screen. The
// defence is structural rather than careful: there is one filter object, parsed
// in one place, and one function that turns it into a query. The export
// re-derives the filter from the same URL and applies the same function.
//
// ⚠️ **The directory stopped paginating on 2026-08-07** and `page` left
// `MemberFilter` with it, the same way phase 3's six retired filters left rather
// than merely losing their controls — an old bookmark carrying `?page=3` must
// narrow nothing, not silently offset a list whose control no longer exists.
//
// That does NOT mean the row window stopped mattering. Both callers now read in
// CHUNKS: the directory page and the export route each loop `.range()` in
// thousands, because one unbounded request is subject to the hosted project's
// `max_rows` and comes back short with no error. applyMemberFilter still never
// ranges — keeping the window out of it is what lets two callers share one
// translation and still read the whole result.
//
// ⚠️ Phase 3 REMOVED six fields — `source`, `minEvents`, `maxEvents`, `minRate`,
// `joinedFrom`, `joinedTo` — rather than merely hiding their controls. Filtering
// narrows to what is displayed (four columns then, five since Stage 6.5 phase 4
// added the calculated dues column),
// and a filter with no control on screen is the phase-1 defect arriving from
// the other direction: a count the officer cannot account for. parseMemberFilter
// reads by key and is total, so an old bookmark carrying `minRate=50` is simply
// ignored, and memberFilterToParams does not put it back in the URL.
//
// The Central-anchored half-open date-range translation went with them. Phase 6
// needs it back for "not seen since"; the pattern to copy is the awarded-date
// range in app/admin/(shell)/points/page.tsx.

// The only import here, and deliberately a pure one: lib/members.ts owns the
// key format and the `cf:` namespace, so both modules cannot drift on what a
// custom sort key looks like. Still no next/* and no supabase-js.
// lib/events.ts is pure too — no next/* and no supabase-js — so importing the
// Central wall-clock conversion here keeps this module's contract intact. It is
// the same function every other date range in the app anchors on, which is the
// point: a second implementation is how two screens start disagreeing about
// where a day begins.
import { centralWallTimeToInstant } from "@/lib/events";
import {
  customFieldColumn,
  customFieldKey,
  parseCustomFieldKey,
} from "@/lib/members";

/**
 * Sortable columns, as the URL spells them. Mapped to real column names by
 * SORT_COLUMNS below; the two are separate so a URL cannot name a column that
 * is not meant to be sortable.
 *
 * Exactly the columns the table displays. Phase 1 allowed ten, which was right
 * when the table had ten — a sort on a column nobody can see rearranges the list
 * for no visible reason. Phase 3 cut it to four; `email` became sortable there,
 * having been displayed since phase 1 with no header of its own.
 *
 * `dues` (Stage 6.5 phase 4) is the fifth, and it obeys the same rule from the
 * other side: it is sortable *because* it is displayed. It maps to
 * `dues_paid_current_term`, a boolean the view calculates — nothing about this
 * key is officer-defined, so it belongs here rather than behind the `cf:`
 * namespace.
 */
export const MEMBER_SORTS = [
  "name",
  "email",
  "eid",
  "total_points",
  "dues",
] as const;

export type MemberBuiltinSort = (typeof MEMBER_SORTS)[number];

/**
 * What each built-in sort is called on screen.
 *
 * Here rather than inline in the table headers because phase 7a's preset
 * summaries name the sort too ("sorted by Dues ▾"), and two copies of this list
 * is how a renamed column starts reading one way in the header and another in
 * the saved filter beside it. A custom field's label comes from its definition,
 * so only the built-ins need spelling out.
 */
export const MEMBER_SORT_LABELS: Record<MemberBuiltinSort, string> = {
  name: "Member",
  email: "Email",
  eid: "EID",
  total_points: "Total points",
  dues: "Dues",
};

/**
 * A sort key, as the URL spells it: one of the four built-ins, or `cf:<key>`
 * naming a custom field.
 *
 * A bare string rather than a union, because the custom half is officer-defined
 * at runtime and cannot be enumerated at compile time. That is exactly why the
 * namespace exists — a field keyed `email` would otherwise shadow the real
 * column — and why parseMemberFilter takes the definition list: an unrecognized
 * key must degrade to `name`, not reach the query.
 */
export type MemberSort = string;

const SORT_COLUMNS: Record<MemberBuiltinSort, string> = {
  name: "full_name",
  email: "email",
  eid: "eid",
  total_points: "total_points",
  dues: "dues_paid_current_term",
};

/**
 * The definition list parseMemberFilter needs to validate a `cf:` sort key.
 *
 * Just the sortable identity of a field — the whole FieldDefinition is not
 * needed, and keeping this module free of the richer type is what lets tests
 * pass a two-line fake.
 */
export type SortableField = { key: string; showInDirectory: boolean };

/**
 * Resolve a sort key to the column PostgREST should order by, or null if the
 * key names nothing sortable.
 *
 * 🔓 Custom keys go through customFieldColumn(), which re-applies the key format
 * check. That is the one place a definition key becomes part of a query string,
 * so it re-checks rather than trusting that the value came from the database —
 * see FIELD_KEY_PATTERN in lib/members.ts for what an unchecked key does to an
 * `order=` term.
 *
 * A field that is not shown in the directory is not sortable either: sorting by
 * a column nobody can see rearranges the list for no visible reason, which is
 * the same argument that cut phase 1's ten sort keys down to four.
 */
export function sortColumn(
  sort: MemberSort,
  fields: readonly SortableField[]
): string | null {
  const custom = parseCustomFieldKey(sort);
  if (custom === null) {
    return SORT_COLUMNS[sort as MemberBuiltinSort] ?? null;
  }
  const field = fields.find((f) => f.key === custom);
  if (!field || !field.showInDirectory) return null;
  return customFieldColumn(custom);
}

export const MEMBER_STATES = ["active", "inactive", "all"] as const;
export type MemberState = (typeof MEMBER_STATES)[number];

/**
 * Dues status, as a three-way selector shaped like MEMBER_STATES.
 *
 * ⚠️ `all` is FIRST because it is the default, and that is the difference from
 * `state`, which defaults to the narrowing `active`. Dues status must not narrow
 * the roster until an officer asks it to: a directory that silently hid unpaid
 * members would be the phase-1 defect (a count nobody can account for) applied
 * to the one column with money behind it.
 */
export const MEMBER_DUES = ["all", "paid", "unpaid"] as const;
export type MemberDues = (typeof MEMBER_DUES)[number];

/**
 * How the member row got created (phase 5c), matching the `members_source_check`
 * domain plus an `all` default.
 *
 * 📌 Phase 3 removed `source` as a *column* and that was right — it is an
 * annotation on the name, not something to sort a table by. It comes back here
 * as a *filter*, because §4.2's roster-cleanup query ("find the self-registered
 * rows nobody has reconciled") has had nowhere to live since, and the SELF badge
 * beside the name is the on-screen control this filter answers to.
 */
export const MEMBER_SOURCES = ["all", "admin", "self_checkin"] as const;
export type MemberSource = (typeof MEMBER_SOURCES)[number];

/**
 * Whether a chosen event is being asked about as attendance or as absence
 * (phase 6).
 *
 * Only meaningful alongside `event`, and dropped from the URL without one — a
 * `mode=missed` with nothing to have missed is a filter that reads as active and
 * narrows nothing.
 */
export const EVENT_MODES = ["attended", "missed"] as const;
export type EventMode = (typeof EVENT_MODES)[number];

/** Has an unresolved check-in waiting on an officer, or either (phase 6). */
export const MEMBER_PENDING = ["all", "has"] as const;
export type MemberPending = (typeof MEMBER_PENDING)[number];

/**
 * A uuid, as PostgREST will be asked to compare one.
 *
 * 🔓 An event id arrives from a URL and is interpolated into a query, so it is
 * format-checked before it can get there — the same discipline `customFieldColumn`
 * applies to a definition key and the export route applies to its `ids`. Anything
 * that is not a uuid is dropped rather than passed through.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A `YYYY-MM-DD` civil date, which is what the date inputs emit. */
const CIVIL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The most characters a custom-field filter value may carry.
 *
 * An option is capped at 80 by `saveFieldDefinition`, so this is that bound
 * restated for a value arriving from a URL rather than from the definition — it
 * bounds what a hand-edited link can put in front of PostgREST without needing
 * the definition to hand.
 */
export const MAX_FIELD_VALUE_LENGTH = 80;

/** How much free text the search box will carry. Long enough for a full name or
 * an email, short enough that a pasted essay cannot become the query. */
export const MAX_SEARCH_LENGTH = 64;

export type MemberFilter = {
  /**
   * Active / inactive / all.
   *
   * Not a displayed column, and kept anyway — deliberately framed as a *scope
   * selector* rather than a column filter. Dropping it with the rest of phase
   * 1's filters would strand inactive members with no route to them at all;
   * `leaderboard` excludes them too, so this screen is the only way to reach
   * one.
   */
  state: MemberState;
  /**
   * Free text across name / email / EID — the displayed identity columns, which
   * is what keeps it inside "filtering narrows to what is displayed".
   *
   * Already sanitized: parseMemberFilter is the only thing that writes this, so
   * anything holding a MemberFilter holds a string that is safe to interpolate
   * into a PostgREST filter. See searchTerm() for what is stripped and why.
   */
  q: string;
  minPoints: number | null;
  maxPoints: number | null;
  /**
   * Paid / not paid / any, against `member_directory.dues_paid_current_term`
   * (Stage 6.5 phase 4).
   *
   * Dues status is CALCULATED — a live `dues_payments` row whose `covered_terms`
   * includes `current_term()` — so this filter reads a boolean the view derives
   * and never a field anybody ticked. That is the whole reason `dues`,
   * `dues_paid` and `dues_paid_current_term` are reserved custom-field keys:
   * without them the roster could carry a hand-ticked second answer to the same
   * question, and this filter would have no way to say which one it meant.
   */
  dues: MemberDues;
  /**
   * Admin-created / self-registered / either (phase 5c). See MEMBER_SOURCES for
   * why this is a filter rather than the column phase 3 removed.
   */
  source: MemberSource;
  /**
   * Officer-defined field filters (phase 5c): definition key → the one value
   * being matched. Absent key means "not filtered on"; the object is empty in
   * the common case.
   *
   * ⚠️ Every key in here has already been checked against the live definitions
   * — it names a field that exists, is not archived, and is shown in the
   * directory — because `parseMemberFilter` is the only thing that writes it.
   * 🔓 That is NOT what makes it safe to interpolate, though. `customFieldColumn`
   * re-applies the key format check at the point the key becomes part of the
   * query string, exactly as the sort does, because "it came out of the
   * database" is not a property this module can verify.
   *
   * One value per field rather than a set: these are dropdowns, and "M or L"
   * is a multi-select whose UI question (and `in.()` translation) belongs with
   * phase 6's relational filters rather than smuggled in here.
   */
  custom: Record<string, string>;

  // ---------------------------------------------------------------------
  // The relational filters (phase 6).
  //
  // ⚠️ These are the first that narrow on data the directory does NOT
  // display, which cuts against the phase-3 trim rather than following it.
  // The trim's argument was that a filter with no control on screen leaves a
  // count nobody can account for — so the answer is not to hide them but to
  // give them a labelled panel of their own that says what they are. See
  // member-filters.tsx; the panel opens whenever one of these is set, which is
  // what keeps the rule intact.
  // ---------------------------------------------------------------------

  /**
   * The event being asked about, or null.
   *
   * 🔓 A uuid, format-checked in `parseMemberFilter` before it can reach a
   * query. Nothing else here is interpolated from a URL as an identifier.
   */
  event: string | null;
  /** How to read `event`. Ignored, and dropped from the URL, without one. */
  eventMode: EventMode;
  /**
   * Has at least one check-in still waiting on an officer.
   *
   * ⚠️ `pending_count` is ALL-TIME, unlike every other aggregate on the view —
   * a submission from last term still needs somebody, which is the same reason
   * the member detail page labels it that way. Filtering on it therefore does
   * not mean "this term".
   */
  pending: MemberPending;
  /**
   * A civil date; matches members last seen strictly before it, **including
   * those never seen at all**.
   *
   * ⚠️ The null half is the whole point and is easy to lose. `last_seen_at` is
   * null for a member who has never been marked present, and a bare `.lt()`
   * drops nulls silently — so the officer asking "who has gone quiet?" would
   * get an answer with the quietest members missing from it. Same shape as the
   * `attendance_rate` null-vs-zero rule.
   */
  notSeenSince: string | null;
  /**
   * Bounds on `events_attended`, current-term.
   *
   * 📌 Returning from the phase-3 trim, which removed them along with their
   * column. They come back for the same reason `source` did in 5c: the query
   * ("who has attended fewer than three things?") is real and had nowhere to
   * live. What makes that acceptable is the control, not the column.
   */
  minEvents: number | null;
  maxEvents: number | null;

  sort: MemberSort;
  dir: "asc" | "desc";
};

/** Sorts that read better largest-first when the officer has not said. A custom
 * field is never in here: its values are option text, which sorts A–Z.
 *
 * `dues` is a boolean, where descending means true first — so picking the column
 * opens on the members who have paid. */
const DESC_BY_DEFAULT: ReadonlySet<MemberSort> = new Set<MemberSort>([
  "total_points",
  "dues",
]);

/** "No custom fields are defined" — the pre-phase-4 world, and what the pure
 * tests pass. Named rather than written as a literal `[]` at each call site so
 * it is obvious at a glance that the absence is deliberate. */
export const NO_CUSTOM_FIELDS: readonly SortableField[] = [];

/** Which way a column sorts when the officer picks it but says nothing about
 * direction. Exported because the table's sort headers need the same answer
 * this module uses when deciding whether `dir` is worth putting in the URL. */
export function defaultDirection(sort: MemberSort): "asc" | "desc" {
  return DESC_BY_DEFAULT.has(sort) ? "desc" : "asc";
}

type RawParams = Record<string, string | string[] | undefined>;

function one(params: RawParams, key: string): string {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Non-negative integer or null. Anything unparseable becomes null — a filter
 * the URL cannot express is no filter, never an error page and never a silent
 * zero, which would read as a real bound and hide rows. */
function intOrNull(raw: string, max: number): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const floored = Math.floor(n);
  if (floored < 0) return null;
  return Math.min(floored, max);
}

/**
 * The search box's text, reduced to something safe to interpolate into a
 * PostgREST filter string.
 *
 * Sanitizing happens here, at the one place a MemberFilter is built, rather
 * than at the query — so every holder of a filter holds a safe string and there
 * is no second escape step to forget. What goes:
 *
 * - `%` and `*` are ILIKE wildcards. A search box must not hand the user the
 *   pattern language; `%` alone would silently match the entire roster.
 * - `"` and `\` break the double-quoted value applyMemberFilter builds.
 *
 * What deliberately stays: `.`, `,`, `(`, `)`, `@`, `-`, `_`. The first four are
 * PostgREST filter syntax and are handled by quoting the value instead, because
 * stripping them would make `a.person@example.edu` unsearchable — and searching
 * an email is most of the point. `_` is a single-character ILIKE wildcard, left
 * in as a harmless over-match so underscored emails and EIDs still match.
 */
function searchTerm(raw: string): string {
  return raw
    .replace(/["\\%*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);
}

/**
 * One custom-field filter value, or null for "not filtering on this field".
 *
 * 📌 Deliberately NOT checked against the definition's current option list, and
 * that is a decision rather than an omission. Editing an option list orphans
 * every member still holding the value that just left it (see `fieldOptions` in
 * lib/members.ts — the coupling is intentionally absent from the database too),
 * and "find everyone still on the retired size" is precisely the cleanup query
 * an officer needs afterwards. Restricting this to live options would make the
 * orphans the one thing the directory cannot show, which turns information into
 * a dead end.
 *
 * ⚠️ The control has to cope, and does: it renders through `fieldOptions`, which
 * appends an unmatched value as a trailing entry rather than letting the
 * `<select>` go blank — the defect that has now bitten twice, in
 * `member-field-cell.tsx` and again in the dues editor.
 *
 * No character stripping, unlike `searchTerm`. This value becomes a PostgREST
 * `eq` operand rather than part of a quoted `or` group, so it is data and not
 * syntax; stripping `.` or `,` here would make a legitimate option like `S/M`
 * or `Yes, with notes` unfilterable. The length cap is the whole guard.
 */
function fieldFilterValue(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  return trimmed.slice(0, MAX_FIELD_VALUE_LENGTH);
}

/**
 * searchParams → a filter object. Total: every input yields a usable filter.
 *
 * Anything invalid falls back to the default rather than throwing, because
 * these values arrive from a URL a human may have edited. The important
 * property is that the result is *complete* — every field has a value — so the
 * page query and the export query cannot diverge by one of them reading a
 * default the other did not.
 */
export function parseMemberFilter(
  params: RawParams,
  /**
   * The live custom-field definitions, so a `cf:` sort key can be checked
   * against what actually exists.
   *
   * Defaults to none, which is the correct reading for every caller that has no
   * definitions to hand — the pure tests, and any code path predating phase 4.
   * The query side does NOT get a default: applyMemberFilter takes the same
   * list as a required argument, so a page that forgets to load definitions is
   * a compile error rather than a directory that quietly cannot sort.
   */
  fields: readonly SortableField[] = NO_CUSTOM_FIELDS
): MemberFilter {
  const rawState = one(params, "state");
  const state: MemberState = (MEMBER_STATES as readonly string[]).includes(
    rawState
  )
    ? (rawState as MemberState)
    : "active";

  const rawDues = one(params, "dues");
  const dues: MemberDues = (MEMBER_DUES as readonly string[]).includes(rawDues)
    ? (rawDues as MemberDues)
    : "all";

  const rawSource = one(params, "source");
  const source: MemberSource = (MEMBER_SOURCES as readonly string[]).includes(
    rawSource
  )
    ? (rawSource as MemberSource)
    : "all";

  // 🔓 Dropped unless it is a uuid. The id is interpolated into the query, so
  // "it came from the picker" is not a property this function can verify.
  const rawEvent = one(params, "event").trim();
  const event: string | null = UUID_RE.test(rawEvent) ? rawEvent : null;

  const rawMode = one(params, "eventMode");
  const eventMode: EventMode = (EVENT_MODES as readonly string[]).includes(
    rawMode
  )
    ? (rawMode as EventMode)
    : "attended";

  const rawPending = one(params, "pending");
  const pending: MemberPending = (MEMBER_PENDING as readonly string[]).includes(
    rawPending
  )
    ? (rawPending as MemberPending)
    : "all";

  const rawNotSeen = one(params, "notSeenSince").trim();
  const notSeenSince: string | null = CIVIL_DATE_RE.test(rawNotSeen)
    ? rawNotSeen
    : null;

  // Officer-defined field filters, read by walking the definitions rather than
  // the params — so an unknown `cf:` param is ignored by construction and never
  // reaches the query, the same way this function ignores every retired key.
  //
  // ⚠️ Only a field that is live AND shown in the directory can be filtered on,
  // which is the same predicate `sortColumn` applies and is there for the same
  // reason: a filter with no control on screen leaves the officer a count they
  // cannot account for. A stale bookmark naming a since-archived field
  // therefore narrows nothing rather than narrowing invisibly.
  const custom: Record<string, string> = {};
  for (const field of fields) {
    if (!field.showInDirectory) continue;
    const value = fieldFilterValue(one(params, customFieldKey(field.key)));
    if (value !== null) custom[field.key] = value;
  }

  // A sort key is either one of the four built-ins or `cf:<key>` naming a
  // definition that exists and is shown in the directory. Anything else — a
  // retired phase-1 key, a field archived since the officer bookmarked the URL,
  // or typed nonsense — degrades to `name` rather than reaching the query.
  const rawSort = one(params, "sort");
  const sort: MemberSort =
    sortColumn(rawSort, fields) !== null ? rawSort : "name";

  const rawDir = one(params, "dir");
  const dir: "asc" | "desc" =
    rawDir === "asc" || rawDir === "desc"
      ? rawDir
      : DESC_BY_DEFAULT.has(sort)
        ? "desc"
        : "asc";

  // Any other key in `params` — `minRate`, `source`, `joinedFrom` from a phase-1
  // bookmark, `page` from a pre-2026-08-07 one, or anything a human typed — is
  // ignored by construction: this reads the keys it knows and never enumerates
  // the input.
  return {
    state,
    q: searchTerm(one(params, "q")),
    minPoints: intOrNull(one(params, "minPoints"), 1_000_000),
    maxPoints: intOrNull(one(params, "maxPoints"), 1_000_000),
    dues,
    source,
    custom,
    event,
    eventMode,
    pending,
    notSeenSince,
    minEvents: intOrNull(one(params, "minEvents"), 10_000),
    maxEvents: intOrNull(one(params, "maxEvents"), 10_000),
    sort,
    dir,
  };
}

/**
 * The inverse: a filter back to a query string.
 *
 * Round-trips with parseMemberFilter, which is what lets pagination links, the
 * sort headers, and phase 5's export all rebuild a URL from a filter without
 * anyone hand-assembling one. Defaults are omitted so the common case stays a
 * clean URL, and because an omitted key and its default must mean the same
 * thing for the round trip to hold.
 */
export function memberFilterToParams(
  filter: MemberFilter,
  overrides: Partial<MemberFilter> = {}
): URLSearchParams {
  // Explicit `undefined` in an override means "no opinion", not "unset this".
  // Spreading it directly would blank the field and, for `dir`, produce a
  // literal `dir=undefined` in the URL.
  const merged = { ...filter };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  const params = new URLSearchParams();

  if (merged.state !== "active") params.set("state", merged.state);
  if (merged.dues !== "all") params.set("dues", merged.dues);
  if (merged.source !== "all") params.set("source", merged.source);
  if (merged.pending !== "all") params.set("pending", merged.pending);
  if (merged.q) params.set("q", merged.q);
  if (merged.notSeenSince) params.set("notSeenSince", merged.notSeenSince);

  // ⚠️ The mode rides on the event, never alone. A URL carrying
  // `eventMode=missed` with no event describes a filter that reads as active in
  // the controls and narrows nothing — the phase-1 defect in miniature — and it
  // would also break the round trip, since parse would hand back a filter that
  // does not re-serialize to the same string.
  if (merged.event) {
    params.set("event", merged.event);
    if (merged.eventMode !== "attended") {
      params.set("eventMode", merged.eventMode);
    }
  }

  // Sorted by key so the query string is a function of the filter and not of
  // object insertion order — two officers who picked the same filters in a
  // different order must produce the same URL, or the selection reset key and
  // the export's query string start differing for no visible reason.
  for (const key of Object.keys(merged.custom).sort()) {
    const value = merged.custom[key];
    if (value) params.set(customFieldKey(key), value);
  }

  const numbers: [keyof MemberFilter, string][] = [
    ["minPoints", "minPoints"],
    ["maxPoints", "maxPoints"],
    ["minEvents", "minEvents"],
    ["maxEvents", "maxEvents"],
  ];
  for (const [key, name] of numbers) {
    const value = merged[key];
    if (typeof value === "number") params.set(name, String(value));
  }

  if (merged.sort !== "name") params.set("sort", merged.sort);
  // The direction is only omitted when it matches what this sort defaults to,
  // so flipping a column that defaults to desc still produces a URL.
  if (merged.dir !== defaultDirection(merged.sort)) {
    params.set("dir", merged.dir);
  }

  return params;
}

/** True when nothing narrows the roster beyond the default view. Used to
 * choose the empty-state wording, and by phase 5 to warn before an export of
 * everything. */
export function isDefaultFilter(filter: MemberFilter): boolean {
  return memberFilterToParams(filter).toString() === "";
}

/** The free-text and numeric filter boxes, as the strings they display. */
export type MemberFilterFields = {
  q: string;
  minPoints: string;
  maxPoints: string;
  minEvents: string;
  maxEvents: string;
  notSeenSince: string;
};

/**
 * What the typed-into filter boxes should show for a given filter.
 *
 * 🪤 Pure, exported, and tested because this is exactly what broke: the boxes
 * were uncontrolled (`defaultValue`), which React reads only at mount, so
 * CLEAR — a client-side push with no remount — left the officer's typed
 * numbers on screen above a count that no longer applied them. Making the
 * displayed value a function of the filter is the fix; keeping that function
 * here is what lets a test hold it.
 *
 * The search box is in here for the same reason and not as an afterthought: it
 * is the control most likely to be typed into and then cleared, so it is the
 * one most likely to reproduce the original bug.
 *
 * A null bound renders as empty, never "0". A `0` is a real bound that hides
 * rows, and the two must not be able to blur into each other.
 */
export function memberFilterFields(filter: MemberFilter): MemberFilterFields {
  const show = (value: number | null) => (value === null ? "" : String(value));
  return {
    q: filter.q,
    minPoints: show(filter.minPoints),
    maxPoints: show(filter.maxPoints),
    minEvents: show(filter.minEvents),
    maxEvents: show(filter.maxEvents),
    // A date input reads "" for unset, exactly as the number boxes do.
    notSeenSince: filter.notSeenSince ?? "",
  };
}

/**
 * Is any relational filter (phase 6) active?
 *
 * ⚠️ The Advanced panel is collapsible, and a collapsed panel hiding an applied
 * filter is the phase-1 defect wearing a lid — a count the officer cannot
 * account for. The panel therefore opens whenever this is true, and this lives
 * here rather than in the component so the panel and the query cannot disagree
 * about what "active" means.
 */
export function hasRelationalFilter(filter: MemberFilter): boolean {
  return (
    filter.event !== null ||
    filter.pending !== "all" ||
    filter.notSeenSince !== null ||
    filter.minEvents !== null ||
    filter.maxEvents !== null
  );
}

/** How many of them, for the collapsed panel's summary. */
export function relationalFilterCount(filter: MemberFilter): number {
  return [
    filter.event !== null,
    filter.pending !== "all",
    filter.notSeenSince !== null,
    filter.minEvents !== null,
    filter.maxEvents !== null,
  ].filter(Boolean).length;
}

/**
 * Does this filter need `attendance` embedded in the SELECT?
 *
 * 🪤 The embed cannot live in `applyMemberFilter`, because PostgREST needs it in
 * the `select` — which the caller builds before this module ever sees the query.
 * And the select string cannot be assembled dynamically: PostgREST types the
 * returned row off the string **literal**, so a concatenation widens it to plain
 * `string` and collapses every field access at once (the `GenericStringError`
 * break, which has now cost a build three times).
 *
 * So each caller holds two `as const` literals and branches on this. The
 * *decision* stays here, in the one module that owns the translation, even
 * though the literal cannot.
 *
 * The embed is deliberately not applied unconditionally: with no event filter it
 * still returns the right rows and the right count, but it nests every member's
 * entire attendance history into the payload for nothing.
 */
export function needsAttendanceEmbed(filter: MemberFilter): boolean {
  return filter.event !== null;
}

/**
 * The filter controls' one translation: the current filter plus raw input
 * strings, in; the next query string, out.
 *
 * 🪤 The starting point is `memberFilterToParams(filter)` and **never the
 * incoming URL text**. That distinction is the whole reason this function
 * exists. The controls used to build on `new URLSearchParams(searchParams)`,
 * which sounds equivalent and is not: an uncontrolled input can be *showing*
 * a value the URL does not carry — after CLEAR, most obviously — and editing
 * any other field then emitted a URL that silently omitted it. The officer saw
 * "Rate at least 50" above a count that ignored the rate. Building from the
 * parsed filter makes the query a function of state the page can actually see,
 * so a stale control can no longer corrupt it.
 *
 * The round trip through `parseMemberFilter` is not redundant either: it
 * clamps and floors exactly as the page will on the next request, so a typed
 * `250` becomes `minRate=100` in the URL immediately rather than rendering as
 * 250 over results filtered at 100.
 *
 * Page is always dropped. Any change to what is being filtered invalidates the
 * offset, and staying on page 3 of a narrower result set shows an officer an
 * empty table with no reason for it.
 */
export function memberFilterUrl(
  filter: MemberFilter,
  changes: Record<string, string>,
  /**
   * Required, unlike parseMemberFilter's own — and the asymmetry is the same
   * one applyMemberFilter carries, for the same reason.
   *
   * 🪤 This was a live bug. The round trip below re-parses, and re-parsing
   * without the definitions makes `sortColumn("cf:dues", [])` null, which
   * degrades the sort to `name`. So a custom-field sort died the instant the
   * officer touched ANY filter control — typing in the search box silently
   * reset the column they had sorted by. Defaulting this parameter would leave
   * that trap armed for the next caller, and there is only one caller, so it
   * costs nothing to require it.
   */
  fields: readonly SortableField[]
): string {
  const params = memberFilterToParams(filter);
  for (const [key, value] of Object.entries(changes)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }

  const raw: RawParams = {};
  for (const [key, value] of params.entries()) raw[key] = value;
  return memberFilterToParams(parseMemberFilter(raw, fields)).toString();
}

/**
 * The minimum a PostgREST query builder has to offer for applyMemberFilter to
 * work on it.
 *
 * Typed structurally, and self-referentially, rather than importing supabase-js
 * — which keeps this module free of the client entirely and lets the tests pass
 * a recording fake in place of a real builder. Every method returns the same
 * shape, matching PostgREST's chaining.
 */
export type FilterableQuery<Q> = {
  eq(column: string, value: string | number | boolean): Q;
  gte(column: string, value: string | number): Q;
  lte(column: string, value: string | number): Q;
  /**
   * One PostgREST `or=(…)` group, as its comma-separated body. Arrived in phase
   * 3 for the free-text search, ahead of the roadmap that filed it under phase 6.
   *
   * ⚠️ Phase 6 makes a SECOND call to this, for the not-seen-since null branch,
   * and the distinction matters: separate `or=` params **AND** together, which
   * is what two independent concerns want. The failure the phase-3 comment warns
   * about is different — splitting ONE concern's three alternatives across three
   * calls ANDs them and matches nothing. Two groups, two concerns: correct.
   */
  or(filters: string): Q;
  /**
   * `is` and `not` (phase 6), and between them they express the event filter.
   *
   * 📌 The roadmap predicted this phase would need `in`, `not` and `lt`. That
   * came from assuming attendees would be resolved to a uuid list; embedding
   * `attendance` in the select instead means the whole filter is
   * `attendance=is.null` / `attendance=not.is.null`, so `in` and `lt` are still
   * not needed. Measured reason for the embed: a uuid list 414s at ~220 ids
   * (Kong's 8KB header buffer) and §2.2's worst case is 150 attendees an event.
   */
  is(column: string, value: null): Q;
  not(column: string, operator: string, value: null): Q;
  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean }
  ): Q;
};

/**
 * Apply every narrowing clause and the ordering. Pagination is deliberately
 * NOT here — see the note below.
 *
 * This is the single translation from filter to query. The directory page and
 * phase 5's export must both go through it; a second hand-written query is how
 * "select all N matching" starts returning a different set than the count that
 * was shown next to it.
 */
export function applyMemberFilter<Q extends FilterableQuery<Q>>(
  query: Q,
  filter: MemberFilter,
  /** Required, unlike parseMemberFilter's — see the note there. */
  fields: readonly SortableField[]
): Q {
  let q = query;

  if (filter.state === "active") q = q.eq("active", true);
  else if (filter.state === "inactive") q = q.eq("active", false);

  // Free text over the three identity columns the table displays. One `or`
  // group, so it composes with the other clauses as a conjunction — three
  // separate calls would be three ANDed groups and match nothing.
  //
  // ⚠️ The value is double-quoted. `.`, `,` and parentheses are PostgREST filter
  // syntax, and an email is full of the first two — an unquoted
  // `email.ilike.*a.person@example.edu*` is read as a malformed operator rather
  // than as a search. searchTerm() has already removed the characters quoting
  // cannot save us from (`"` and `\`) and the ILIKE wildcards, so nothing here
  // needs a second escape pass.
  if (filter.q) {
    const like = `*${filter.q}*`;
    q = q.or(
      `full_name.ilike."${like}",email.ilike."${like}",eid.ilike."${like}"`
    );
  }

  if (filter.minPoints !== null) q = q.gte("total_points", filter.minPoints);
  if (filter.maxPoints !== null) q = q.lte("total_points", filter.maxPoints);

  // Dues status. The view computes this as an `exists (…)` over dues_payments,
  // so it is a real boolean and never null — no third state to think about, and
  // no nulls-last question the way a custom field has.
  //
  // ⚠️ This clause exists HERE and nowhere else, which is the property the whole
  // module is built on: "copy the emails of all N unpaid members" has to be
  // provably the same query as the count rendered beside the button. A dues
  // predicate hand-written into the page or the export route is exactly how that
  // pair starts disagreeing.
  if (filter.dues === "paid") q = q.eq("dues_paid_current_term", true);
  else if (filter.dues === "unpaid") q = q.eq("dues_paid_current_term", false);

  // §4.2's roster-cleanup query, back as a filter after phase 3 removed it as a
  // column.
  if (filter.source !== "all") q = q.eq("source", filter.source);

  // Officer-defined fields. `custom_fields->>key = value` through the view —
  // the same expression the sort orders by, which is why they share one
  // builder.
  //
  // 🔓 customFieldColumn() re-applies the key format check HERE rather than
  // trusting parseMemberFilter to have done it. This is the second position in
  // which a definition key becomes part of a query string, and the phase-4
  // spike's finding was that PostgREST accepts a space and a `"` silently, with
  // no error at all — so "it would have failed if it were wrong" is not
  // available as a defence. A key that does not survive the check is DROPPED,
  // never interpolated: a filter that silently does not apply is bad, and a
  // filter that applies something else is worse.
  //
  // Keys are sorted for the same reason memberFilterToParams sorts them —
  // the emitted query must be a function of the filter, not of insertion order,
  // or two identical filters produce two different recorded query shapes.
  for (const key of Object.keys(filter.custom).sort()) {
    const value = filter.custom[key];
    if (!value) continue;
    const column = customFieldColumn(key);
    if (column === null) continue;
    q = q.eq(column, value);
  }

  // -------------------------------------------------------------------------
  // The relational filters (phase 6).
  // -------------------------------------------------------------------------

  // ⚠️ ALL-TIME, unlike every other aggregate on the view. A submission from
  // last term still needs an officer, so scoping this to the current term would
  // hide exactly the rows that have been waiting longest.
  if (filter.pending === "has") q = q.gte("pending_count", 1);

  if (filter.minEvents !== null) q = q.gte("events_attended", filter.minEvents);
  if (filter.maxEvents !== null) q = q.lte("events_attended", filter.maxEvents);

  // "Not seen since <date>", and the null branch is the whole filter rather than
  // a nicety.
  //
  // ⚠️ A member who has never been marked present has `last_seen_at` null, and a
  // bare `.lt()` drops nulls silently — so the officer asking "who has gone
  // quiet?" would get an answer with the quietest members missing. Same shape as
  // the attendance_rate null-vs-zero rule, and decided the same way.
  //
  // ⚠️ Central-anchored. A bare `.lt("last_seen_at", "2026-09-01")` is read as
  // UTC midnight and silently drops five hours of a Central day — the
  // `new Date("2026-09-01T18:00")` class of bug, and it fails plausibly.
  //
  // 📌 This is the SECOND `or` group on the query when a search is also active.
  // Separate `or=` params AND together, which is what two independent concerns
  // want; the failure the search comment warns about is splitting ONE concern
  // across several calls.
  if (filter.notSeenSince !== null) {
    const cutoff = centralWallTimeToInstant(
      filter.notSeenSince,
      "00:00"
    ).toISOString();
    q = q.or(`last_seen_at.is.null,last_seen_at.lt.${cutoff}`);
  }

  // Attended or missed one specific event — the only filter here that is not a
  // column on the view.
  //
  // 🪤 It reads as two clauses and is really three: the embed itself lives in
  // the caller's `select` (see needsAttendanceEmbed for why it cannot live
  // here), and these narrow it. Without the embed PostgREST answers
  // `PGRST100`, so the two halves are load-bearing on each other — which is
  // exactly why the decision is exported from this module rather than left for
  // each caller to remember.
  //
  // `status = 'present'` is not optional: a pending or rejected submission is
  // not attendance, and present_requires_resolution guarantees a present row
  // has both ids. One `!left` embed serves both modes — `is.null` for missed,
  // `not.is.null` for attended — and the two partition the roster exactly.
  if (filter.event !== null) {
    q = q.eq("attendance.event_id", filter.event);
    q = q.eq("attendance.status", "present");
    q =
      filter.eventMode === "attended"
        ? q.not("attendance", "is", null)
        : q.is("attendance", null);
  }

  // Nulls last in both directions. None of the four BUILT-IN sortable columns is
  // nullable — that went with attendance_rate and last_seen_at in the phase-3
  // trim — but phase 4's custom fields are sparse by nature: a member who has no
  // answer for a dropdown reads as SQL NULL through `custom_fields->>key` and
  // belongs at the bottom in either direction, not floating to the top of a
  // descending sort.
  //
  // A `cf:` key that no longer resolves falls back to the default sort rather
  // than being interpolated anyway. parseMemberFilter has normally caught this
  // already; the second check is here because this is the function that builds
  // the query string, and it must not depend on a caller having sanitized first.
  const column = sortColumn(filter.sort, fields) ?? SORT_COLUMNS.name;
  q = q.order(column, {
    ascending: filter.dir === "asc",
    nullsFirst: false,
  });

  // Deterministic total order, and not optional. Rows tied on the sort column
  // may otherwise come back in a different arrangement per request, which makes
  // pagination drop and repeat members across pages — a bug that reads as
  // missing data rather than as an ordering fault. full_name is not unique
  // either, so id is the final tie-break.
  if (filter.sort !== "name") q = q.order("full_name", { ascending: true });
  q = q.order("id", { ascending: true });

  return q;
}

/**
 * How many rows to ask PostgREST for at a time.
 *
 * 🪤 **Neither caller may ask for everything in one request.** `config.toml`
 * sets no `max_rows` locally, but the hosted project applies its own — so an
 * unbounded request comes back complete in development and silently short in
 * production, with no error anywhere. That is the partial-list failure this
 * whole module exists to prevent, wearing a different hat.
 *
 * Deliberately NOT applied inside `applyMemberFilter`. Keeping the window out
 * of the translation is what lets the directory and the export share one
 * filter-to-query function and each still read the complete result — the same
 * separation `pageRange()` used to provide when the directory paginated, for the
 * same reason.
 *
 * ⚠️ Reading in chunks re-introduces the tie-break hazard that paging had: rows
 * equal on the sort column can come back ordered differently per request, so a
 * chunk boundary drops one row and repeats another. `applyMemberFilter` ends
 * every query `.order("id")` for exactly this, and it is load-bearing rather
 * than tidy — see the note there.
 */
export const READ_CHUNK = 1000;

/** The inclusive `.range()` bounds for the nth chunk, zero-based. */
export function chunkRange(index: number): { from: number; to: number } {
  const safe = Math.max(0, Math.floor(index));
  const from = safe * READ_CHUNK;
  return { from, to: from + READ_CHUNK - 1 };
}

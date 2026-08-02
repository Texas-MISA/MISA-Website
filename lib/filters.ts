// Member directory filters (§7 Stage 6). Pure — no next/* imports, no client —
// so Vitest exercises the translation directly, the same contract as
// lib/events.ts and lib/attendance.ts.
//
// ⚠️ This module is the stage's load-bearing piece, and the reason is worth
// stating before the code: §7's exit criterion is that an officer filters the
// roster and copies a *complete* email list, and the classic way that screen
// breaks is the page query and the export query drifting apart, so "copy all
// 60 matching" quietly returns the 25 rows that happened to be rendered. The
// defence is structural rather than careful: there is one filter object, parsed
// in one place, and one function that turns it into a query. Phase 2's export
// re-derives the filter from the same URL and applies the same function, with
// only the pagination differing.

import { addCivilDays, centralWallTimeToInstant } from "@/lib/events";

/** Rows per page in the directory. Small enough that the seeded roster of 32
 * actually paginates — a page size that fits the whole fixture set hides every
 * bug this screen is prone to. */
export const PAGE_SIZE = 25;

/** Sortable columns, as the URL spells them. Mapped to real column names by
 * SORT_COLUMNS below; the two are separate so a URL cannot name a column that
 * is not meant to be sortable. */
export const MEMBER_SORTS = [
  "name",
  "student_id",
  "joined_at",
  "events_attended",
  "attendance_points",
  "bonus_points",
  "total_points",
  "attendance_rate",
  "last_seen_at",
  "pending_count",
] as const;

export type MemberSort = (typeof MEMBER_SORTS)[number];

const SORT_COLUMNS: Record<MemberSort, string> = {
  name: "full_name",
  student_id: "student_id",
  joined_at: "joined_at",
  events_attended: "events_attended",
  attendance_points: "attendance_points",
  bonus_points: "bonus_points",
  total_points: "total_points",
  attendance_rate: "attendance_rate",
  last_seen_at: "last_seen_at",
  pending_count: "pending_count",
};

export const MEMBER_STATES = ["active", "inactive", "all"] as const;
export type MemberState = (typeof MEMBER_STATES)[number];

export const MEMBER_SOURCES = ["admin", "self_checkin"] as const;

export type MemberFilter = {
  state: MemberState;
  /** "" means any. `self_checkin` is how §4.2 says to find rows the check-in
   * form created, which is the roster-cleanup query. */
  source: string;
  minPoints: number | null;
  maxPoints: number | null;
  minEvents: number | null;
  maxEvents: number | null;
  /** Whole percent, 0–100, as typed. Converted to the view's fraction only at
   * the point of querying. */
  minRate: number | null;
  joinedFrom: string;
  joinedTo: string;
  sort: MemberSort;
  dir: "asc" | "desc";
  /** 1-based, as it appears in the URL. */
  page: number;
};

/** Sorts that read better largest-first when the officer has not said. */
const DESC_BY_DEFAULT: ReadonlySet<MemberSort> = new Set<MemberSort>([
  "events_attended",
  "attendance_points",
  "bonus_points",
  "total_points",
  "attendance_rate",
  "last_seen_at",
  "pending_count",
]);

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

/** A civil date (YYYY-MM-DD) or "". Rejects anything else rather than handing a
 * malformed string to centralWallTimeToInstant. */
function civilDateOrEmpty(raw: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
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
export function parseMemberFilter(params: RawParams): MemberFilter {
  const rawState = one(params, "state");
  const state: MemberState = (MEMBER_STATES as readonly string[]).includes(
    rawState
  )
    ? (rawState as MemberState)
    : "active";

  const rawSource = one(params, "source");
  const source = (MEMBER_SOURCES as readonly string[]).includes(rawSource)
    ? rawSource
    : "";

  const rawSort = one(params, "sort");
  const sort: MemberSort = (MEMBER_SORTS as readonly string[]).includes(rawSort)
    ? (rawSort as MemberSort)
    : "name";

  const rawDir = one(params, "dir");
  const dir: "asc" | "desc" =
    rawDir === "asc" || rawDir === "desc"
      ? rawDir
      : DESC_BY_DEFAULT.has(sort)
        ? "desc"
        : "asc";

  const page = Math.max(1, intOrNull(one(params, "page"), 100_000) ?? 1);

  return {
    state,
    source,
    minPoints: intOrNull(one(params, "minPoints"), 1_000_000),
    maxPoints: intOrNull(one(params, "maxPoints"), 1_000_000),
    minEvents: intOrNull(one(params, "minEvents"), 100_000),
    maxEvents: intOrNull(one(params, "maxEvents"), 100_000),
    minRate: intOrNull(one(params, "minRate"), 100),
    joinedFrom: civilDateOrEmpty(one(params, "joinedFrom")),
    joinedTo: civilDateOrEmpty(one(params, "joinedTo")),
    sort,
    dir,
    page,
  };
}

/**
 * The inverse: a filter back to a query string.
 *
 * Round-trips with parseMemberFilter, which is what lets pagination links, the
 * sort headers, and phase 2's export all rebuild a URL from a filter without
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
  if (merged.source) params.set("source", merged.source);

  const numbers: [keyof MemberFilter, string][] = [
    ["minPoints", "minPoints"],
    ["maxPoints", "maxPoints"],
    ["minEvents", "minEvents"],
    ["maxEvents", "maxEvents"],
    ["minRate", "minRate"],
  ];
  for (const [key, name] of numbers) {
    const value = merged[key];
    if (typeof value === "number") params.set(name, String(value));
  }

  if (merged.joinedFrom) params.set("joinedFrom", merged.joinedFrom);
  if (merged.joinedTo) params.set("joinedTo", merged.joinedTo);

  if (merged.sort !== "name") params.set("sort", merged.sort);
  // The direction is only omitted when it matches what this sort defaults to,
  // so flipping a column that defaults to desc still produces a URL.
  if (merged.dir !== defaultDirection(merged.sort)) {
    params.set("dir", merged.dir);
  }

  if (merged.page > 1) params.set("page", String(merged.page));

  return params;
}

/** True when nothing narrows the roster beyond the default view. Used to
 * choose the empty-state wording, and by phase 2 to warn before an export of
 * everything. */
export function isDefaultFilter(filter: MemberFilter): boolean {
  return memberFilterToParams({ ...filter, page: 1 }).toString() === "";
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
  lt(column: string, value: string | number): Q;
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
 * phase 2's export must both go through it; a second hand-written query is how
 * "select all N matching" starts returning a different set than the count that
 * was shown next to it.
 */
export function applyMemberFilter<Q extends FilterableQuery<Q>>(
  query: Q,
  filter: MemberFilter
): Q {
  let q = query;

  if (filter.state === "active") q = q.eq("active", true);
  else if (filter.state === "inactive") q = q.eq("active", false);

  if (filter.source) q = q.eq("source", filter.source);

  if (filter.minPoints !== null) q = q.gte("total_points", filter.minPoints);
  if (filter.maxPoints !== null) q = q.lte("total_points", filter.maxPoints);
  if (filter.minEvents !== null) q = q.gte("events_attended", filter.minEvents);
  if (filter.maxEvents !== null) q = q.lte("events_attended", filter.maxEvents);

  // The view stores a fraction; the URL carries whole percent. A member with no
  // rate at all (a term with no completed events yet) has null here and is
  // excluded by the comparison, which is the right answer: "no rate" is not
  // "meets the threshold".
  if (filter.minRate !== null) {
    q = q.gte("attendance_rate", filter.minRate / 100);
  }

  // Central-anchored and half-open, like every other date range in the app. A
  // bare .lte("joined_at", "2026-04-07") is a UTC-midnight cut that drops the
  // last five or six hours of a Central day and looks entirely reasonable.
  if (filter.joinedFrom) {
    q = q.gte(
      "joined_at",
      centralWallTimeToInstant(filter.joinedFrom, "00:00").toISOString()
    );
  }
  if (filter.joinedTo) {
    q = q.lt(
      "joined_at",
      centralWallTimeToInstant(
        addCivilDays(filter.joinedTo, 1),
        "00:00"
      ).toISOString()
    );
  }

  // Nulls last in both directions: an unrated member or one never seen belongs
  // at the bottom of the list whichever way it is sorted, not floating to the
  // top of a descending sort as Postgres would otherwise put them.
  q = q.order(SORT_COLUMNS[filter.sort], {
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
 * The row window for a page, as PostgREST's inclusive .range() bounds.
 *
 * Kept apart from applyMemberFilter on purpose: the export in phase 2 applies
 * the identical filter and must NOT apply this. Making pagination the separate
 * step is what makes "the same query, unpaginated" expressible without copying
 * the filter logic.
 */
export function pageRange(page: number): { from: number; to: number } {
  const safe = Math.max(1, Math.floor(page));
  const from = (safe - 1) * PAGE_SIZE;
  return { from, to: from + PAGE_SIZE - 1 };
}

/** Total pages for a row count — at least 1, so an empty result still renders
 * as "page 1 of 1" rather than "page 1 of 0". */
export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

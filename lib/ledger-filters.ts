import { addCivilDays, centralWallTimeToInstant } from "@/lib/events";
import { ATTENDANCE_STATUSES } from "@/lib/attendance";
import { POINT_CATEGORIES } from "@/lib/points";

// Filter cores for the two officer list screens that are not the member
// directory: the points ledger (/admin/points) and the attendance review queue
// (/admin/attendance). Pure — the query is typed structurally rather than
// imported from supabase-js, so tests drive a recorder fake.
//
// 📌 Why one module for two screens. Both translations were inline in their
// pages until Stage 8 phase 2, and each carried its OWN copy of the Central
// half-open date bound — the trap that `.lte("submitted_at", "2026-04-07")`
// reads as UTC midnight and silently drops the last five or six hours of a
// Central day. Adding an export route would have made a third copy of that. One
// module, one `dateBounds`, one place to be wrong.
//
// 🔓 **The row window is the CALLER's**, exactly as in lib/filters.ts, and here
// it is load-bearing in a new way: the screens cap at 200 rows and an archival
// export must not. Baking either number in is how the export would silently
// truncate — so neither builder below calls `.limit()`, `.range()` or
// `.select()`, and tests/ledger-filters.test.ts asserts that.

/**
 * The query surface these builders need.
 *
 * Deliberately its own interface rather than `FilterableQuery` from
 * lib/filters.ts. That one covers a different domain and lacks `lt`, and
 * widening it would force the member recorder fake to implement operators the
 * member filter never uses. Separate domains, separate contracts.
 */
export type LedgerQuery<Q> = {
  eq(column: string, value: string | number | boolean): Q;
  gte(column: string, value: string | number): Q;
  /** Half-open upper bound. Never `lte` — see the date note above. */
  lt(column: string, value: string | number): Q;
  is(column: string, value: null): Q;
  not(column: string, operator: string, value: null): Q;
};

/** A `?key=value` bag, however the caller got hold of it. */
export type RawParams = Record<string, string | string[] | undefined>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function one(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function uuidOrEmpty(value: string | string[] | undefined): string {
  const raw = one(value);
  return UUID_RE.test(raw) ? raw : "";
}

/**
 * A civil date, or "" if it is not one.
 *
 * ⚠️ Neither page validated these — `from`/`to` went straight from the query
 * string into `centralWallTimeToInstant`. That is not a security hole (the
 * result is interpolated as an ISO instant, not as SQL), but it is a 500 from a
 * hand-typed URL: `"yesterday".split("-").map(Number)` is `[NaN]`, so
 * `Date.UTC` yields NaN and `zoneOffsetMs` **throws** at lib/events.ts:99 while
 * formatting an invalid Date — measured, not assumed. Ignoring the value
 * instead matches how every other filter in this codebase treats input it does
 * not recognise.
 */
function civilDateOrEmpty(value: string | string[] | undefined): string {
  const raw = one(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const [y, m, d] = raw.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  // Rejects 2026-02-31 and friends, which the regex alone accepts.
  return probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d ? raw : "";
}

/**
 * Apply a Central-anchored, half-open date range to `column`.
 *
 * The single copy of the rule §4.7 keeps restating: a date filter is wall time
 * in America/Chicago, the lower bound is inclusive at 00:00, and the upper
 * bound is the start of the FOLLOWING day so the whole of `to` is included.
 */
function dateBounds<Q extends LedgerQuery<Q>>(
  query: Q,
  column: string,
  from: string,
  to: string
): Q {
  let next = query;
  if (from) {
    next = next.gte(
      column,
      centralWallTimeToInstant(from, "00:00").toISOString()
    );
  }
  if (to) {
    next = next.lt(
      column,
      centralWallTimeToInstant(addCivilDays(to, 1), "00:00").toISOString()
    );
  }
  return next;
}

function toParams(entries: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams();
  // Sorted, so the string is a function of the filter rather than of the order
  // the officer clicked — the same property lib/presets.ts relies on.
  for (const key of Object.keys(entries).sort()) {
    if (entries[key]) params.set(key, entries[key]);
  }
  return params;
}

// ---------------------------------------------------------------------------
// Point adjustments — /admin/points
// ---------------------------------------------------------------------------

export type AdjustmentFilter = {
  officer: string;
  category: string;
  member: string;
  state: "all" | "live" | "voided";
  from: string;
  to: string;
};

export function parseAdjustmentFilter(params: RawParams): AdjustmentFilter {
  const category = one(params.category);
  const state = one(params.state);
  return {
    officer: uuidOrEmpty(params.officer),
    category: (POINT_CATEGORIES as readonly string[]).includes(category)
      ? category
      : "",
    member: uuidOrEmpty(params.member),
    // Voided rows stay visible by default. The ledger's job is to show what
    // happened, and a void is something that happened.
    state: state === "live" ? "live" : state === "voided" ? "voided" : "all",
    from: civilDateOrEmpty(params.from),
    to: civilDateOrEmpty(params.to),
  };
}

export function applyAdjustmentFilter<Q extends LedgerQuery<Q>>(
  query: Q,
  filter: AdjustmentFilter
): Q {
  let next = query;
  if (filter.officer) next = next.eq("awarded_by", filter.officer);
  if (filter.category) next = next.eq("category", filter.category);
  if (filter.member) next = next.eq("member_id", filter.member);
  if (filter.state === "live") next = next.is("voided_at", null);
  else if (filter.state === "voided") {
    next = next.not("voided_at", "is", null);
  }
  return dateBounds(next, "awarded_at", filter.from, filter.to);
}

export function adjustmentFilterToParams(
  filter: AdjustmentFilter
): URLSearchParams {
  return toParams({
    officer: filter.officer,
    category: filter.category,
    member: filter.member,
    state: filter.state === "all" ? "" : filter.state,
    from: filter.from,
    to: filter.to,
  });
}

// ---------------------------------------------------------------------------
// Attendance submissions — /admin/attendance
// ---------------------------------------------------------------------------

/** The sentinel for "no event linked", which is not a uuid and never will be. */
export const UNASSIGNED_EVENT = "unassigned";

export type AttendanceFilter = {
  /** "" means every status. Absent in the URL means `pending` — see the parse. */
  status: string;
  /** A uuid, `UNASSIGNED_EVENT`, or "". */
  event: string;
  from: string;
  to: string;
  sort: "oldest" | "newest";
};

export function parseAttendanceFilter(params: RawParams): AttendanceFilter {
  const rawStatus = one(params.status);
  // Absent status means pending: the queue exists for the unresolved rows, and
  // an officer arriving from the dashboard badge wants those. "all" is the
  // explicit escape hatch.
  //
  // ⚠️ Stage 8 phase 2 added the allow-list check. Before it, `?status=xyz`
  // reached `.eq("status", "xyz")` and matched nothing — a screen showing "No
  // matching submissions" for a value with no control behind it, which is the
  // phase-3 rule ("a filter with no control on screen must narrow nothing")
  // failing on a garbage value. It now falls back to the default.
  const status =
    rawStatus === "all"
      ? ""
      : (ATTENDANCE_STATUSES as readonly string[]).includes(rawStatus)
        ? rawStatus
        : "pending";

  const rawEvent = one(params.event);
  const rawSort = one(params.sort);

  return {
    status,
    // ⚠️ Also new: the event was not uuid-checked either.
    event:
      rawEvent === UNASSIGNED_EVENT ? UNASSIGNED_EVENT : uuidOrEmpty(rawEvent),
    from: civilDateOrEmpty(params.from),
    to: civilDateOrEmpty(params.to),
    // Pending defaults to oldest-first so the queue drains from the top rather
    // than rotting at the bottom (§9 #8 chose no enforced deadline, which makes
    // the ordering the mitigation).
    sort:
      rawSort === "newest"
        ? "newest"
        : rawSort === "oldest"
          ? "oldest"
          : defaultSort(status),
  };
}

export function applyAttendanceFilter<Q extends LedgerQuery<Q>>(
  query: Q,
  filter: AttendanceFilter
): Q {
  let next = query;
  if (filter.status) next = next.eq("status", filter.status);
  if (filter.event === UNASSIGNED_EVENT) next = next.is("event_id", null);
  else if (filter.event) next = next.eq("event_id", filter.event);
  return dateBounds(next, "submitted_at", filter.from, filter.to);
}

/**
 * The sort the parse would derive if the URL carried none.
 *
 * Shared by the parse and the serializer so they cannot disagree — which is
 * what makes `parseAttendanceFilter(attendanceFilterToParams(f))` equal `f`.
 */
function defaultSort(status: string): AttendanceFilter["sort"] {
  return status === "pending" ? "oldest" : "newest";
}

export function attendanceFilterToParams(
  filter: AttendanceFilter
): URLSearchParams {
  return toParams({
    // "" means every status, which the URL spells "all". `pending` is the parse
    // default, so it is omitted — a default view gets a clean URL, and reading
    // that URL back produces the same filter.
    status:
      filter.status === ""
        ? "all"
        : filter.status === "pending"
          ? ""
          : filter.status,
    event: filter.event,
    from: filter.from,
    to: filter.to,
    // Omitted when it matches what the status would imply, for the same reason.
    sort: filter.sort === defaultSort(filter.status) ? "" : filter.sort,
  });
}

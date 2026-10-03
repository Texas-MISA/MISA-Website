// Member type and project eligibility (§7, /admin/members item 2; migration
// 30). Pure — no next/* imports, no supabase-js — so Vitest drives it directly,
// the same contract as lib/members.ts and lib/points.ts, and so a Client
// Component can import the labels without pulling a server module along.
//
// 📌 Two values that read alike and are nothing alike underneath:
//   * the TYPE is set by an officer and stored on `members.member_type`;
//   * the ELIGIBILITY is calculated by `member_directory` from attendance, and
//     no screen may set it. It gates nothing: it is a label for officers.
//
// ⚠️ Every label here is a STRING TABLE behind a type guard, never an index
// into an object with a value from outside. A type or an eligibility arrives
// from the database, a URL or a form, and `LABELS[value]` answers for
// `constructor` and `toString` from Object.prototype — the same reason
// lib/directory-columns.ts resolves its cookie with Sets only.

/**
 * Mirrors `members_member_type_valid` in migration 30.
 *
 * Changing one without the other is a 23514 on save for whatever the select
 * offers that the CHECK does not — the pair relationship events_category_valid
 * has with EVENT_CATEGORIES.
 */
export const MEMBER_TYPES = [
  "general",
  "data_project",
  "client_project",
  "junior_director",
] as const;

export type MemberType = (typeof MEMBER_TYPES)[number];

/** The column's default, and therefore every member's type until an officer
 * says otherwise (officer, 2026-10-03: nothing tracks a project member yet).
 * Also what a merge treats as "no answer" — see `mergedMemberType`. */
export const DEFAULT_MEMBER_TYPE: MemberType = "general";

const MEMBER_TYPE_LABELS: Record<MemberType, string> = {
  general: "General",
  data_project: "Data project",
  client_project: "Client project",
  junior_director: "Junior director",
};

export function isMemberType(value: unknown): value is MemberType {
  return (
    typeof value === "string" &&
    (MEMBER_TYPES as readonly string[]).includes(value)
  );
}

/**
 * "data_project" → "Data project".
 *
 * A value outside the list renders as itself rather than as a blank, the rule
 * pill.tsx states for statuses: a CHECK should make it impossible, and if it
 * ever happens the screen should say so legibly. Null is "—", like every other
 * empty cell in the directory.
 */
export function formatMemberType(value: string | null): string {
  if (value === null || value === "") return "—";
  return isMemberType(value) ? MEMBER_TYPE_LABELS[value] : value;
}

/**
 * The types project eligibility applies to.
 *
 * Mirrored by the `in ('data_project', 'client_project')` in member_directory's
 * `project_eligibility` (migration 30). Every other type is `not_applicable`.
 */
export const PROJECT_MEMBER_TYPES = [
  "data_project",
  "client_project",
] as const satisfies readonly MemberType[];

/** Does the project requirement apply to somebody of this type? */
export function requiresProjectEligibility(type: string | null): boolean {
  return (
    type !== null &&
    (PROJECT_MEMBER_TYPES as readonly string[]).includes(type)
  );
}

/**
 * The values `member_directory.project_eligibility` can hold.
 *
 * ⚠️ `yes` means NOTHING HAS FAILED SO FAR, not "has met the semester's
 * requirements". A month is judged only once it is over, so until the term's
 * last month ends a `yes` is provisional. The member page says so beside it.
 */
export const PROJECT_ELIGIBILITIES = ["yes", "no", "not_applicable"] as const;

export type ProjectEligibility = (typeof PROJECT_ELIGIBILITIES)[number];

const ELIGIBILITY_LABELS: Record<ProjectEligibility, string> = {
  yes: "Yes",
  no: "No",
  not_applicable: "N/A",
};

export function isProjectEligibility(
  value: unknown
): value is ProjectEligibility {
  return (
    typeof value === "string" &&
    (PROJECT_ELIGIBILITIES as readonly string[]).includes(value)
  );
}

/**
 * "not_applicable" → "N/A". Null is "—": the view always answers, so a null is
 * a member with no row for the term in question — never a fourth verdict.
 */
export function formatProjectEligibility(value: string | null): string {
  if (value === null || value === "") return "—";
  return isProjectEligibility(value) ? ELIGIBILITY_LABELS[value] : value;
}

// ---------------------------------------------------------------------------
// The member page's breakdown
// ---------------------------------------------------------------------------

/** `member_general_meeting_months.status`. */
export const MONTH_RESULTS = ["met", "not_met", "in_progress"] as const;
export type MonthResult = (typeof MONTH_RESULTS)[number];

const MONTH_RESULT_LABELS: Record<MonthResult, string> = {
  met: "Met",
  not_met: "Not met",
  in_progress: "In progress",
};

export function isMonthResult(value: unknown): value is MonthResult {
  return (
    typeof value === "string" &&
    (MONTH_RESULTS as readonly string[]).includes(value)
  );
}

export function formatMonthResult(value: string | null): string {
  if (value === null || value === "") return "—";
  return isMonthResult(value) ? MONTH_RESULT_LABELS[value] : value;
}

/** `member_project_meetings.status` — the same three states the detail page's
 * events grid uses, for the same reason: an event that has not ended is
 * upcoming, never a miss. */
export const MEETING_RESULTS = ["attended", "missed", "upcoming"] as const;
export type MeetingResult = (typeof MEETING_RESULTS)[number];

const MEETING_RESULT_LABELS: Record<MeetingResult, string> = {
  attended: "Attended",
  missed: "Missed",
  upcoming: "Upcoming",
};

export function isMeetingResult(value: unknown): value is MeetingResult {
  return (
    typeof value === "string" &&
    (MEETING_RESULTS as readonly string[]).includes(value)
  );
}

export function formatMeetingResult(value: string | null): string {
  if (value === null || value === "") return "—";
  return isMeetingResult(value) ? MEETING_RESULT_LABELS[value] : value;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/**
 * "2026-10-01" → "October 2026", for `member_general_meeting_months.month`.
 *
 * 🪤 From a name table, NEVER `new Date("2026-10-01")`. A bare ISO date parses
 * as UTC midnight, which is the evening of 30 September in Central — so any
 * formatter that then applies the Central zone (as every date in this app
 * does) names the wrong month for every row, and a formatter that does not
 * runs Intl inside whichever component calls it. The view already did the zone
 * arithmetic; this only spells the result.
 *
 * Anything that is not `YYYY-MM-DD` with a real month comes back unchanged
 * rather than as a guess, and null or empty as "—".
 */
export function formatMonth(value: string | null): string {
  if (value === null || value === "") return "—";
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(value);
  if (!match) return value;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return value;
  return `${MONTH_NAMES[month - 1]} ${match[1]}`;
}

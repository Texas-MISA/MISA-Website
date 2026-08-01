// Point-adjustment domain constants and formatting (§4.2, §7 Stage 5). Pure —
// no next/* imports — so lib/validation.ts can build its schemas from these
// without reaching into an admin page, exactly as it imports EVENT_CATEGORIES
// from lib/events.ts.

/** Mirrors the CHECK constraint on point_adjustments.category. */
export const POINT_CATEGORIES = [
  "volunteer",
  "recruitment",
  "competition",
  "leadership",
  "correction",
  "other",
] as const;

export type PointCategory = (typeof POINT_CATEGORIES)[number];

/** How many members one grant may cover in a single action. A bound on the
 * form, not on generosity — it stops a hand-edited `sel=` URL fanning a grant
 * across the whole roster in one click. */
export const MAX_GRANT_MEMBERS = 50;

/**
 * Per-grant magnitude bound.
 *
 * This is an input-sanity guard against a fat-fingered 5000, **not** the
 * policy cap §9 #9 declined to impose — that decision stands, and the controls
 * on a large grant remain the required reason and the ledger, not a ceiling.
 * Negative values are first-class: one mechanism covers bonuses, penalties,
 * and corrections rather than three (§4.2).
 */
export const MAX_POINTS_PER_GRANT = 500;

/**
 * The columns an audit row carries for a point adjustment.
 *
 * Both sides of a before/after pair must select exactly this list. The audit
 * trail diffs the union of their keys and renders a key missing from one side
 * as "—", so a mismatch invents changes that never happened: a narrower select
 * on the void made the log read `reason: "Ran the info booth" → —` and
 * `awarded_by: <uuid> → —`, as though voiding had erased the reason and the
 * awarding officer. It lives here, rather than in the action, because
 * "use server" modules may only export async functions — and because a shared
 * constant is what lets the test assert on the real thing.
 */
// One unbroken literal with `as const`, not a concatenation: PostgREST's
// generated types read the column list off the *literal* to type the row it
// returns, and `"a, b" + "c"` widens to plain `string`, which collapses the
// result to an untyped error shape.
export const AUDITED_ADJUSTMENT_COLUMNS =
  "id, member_id, points, reason, category, event_id, term, awarded_by, awarded_at, voided_at, voided_by, void_reason" as const;

const LABELS: Record<PointCategory, string> = {
  volunteer: "Volunteer",
  recruitment: "Recruitment",
  competition: "Competition",
  leadership: "Leadership",
  correction: "Correction",
  other: "Other",
};

export function formatPointCategory(category: string | null): string {
  if (category === null) return "—";
  return LABELS[category as PointCategory] ?? category;
}

/** "+5" / "−2". Uses a real minus sign so a deduction doesn't read as a
 * hyphenated list item in the ledger. */
export function signedPoints(points: number): string {
  return points < 0 ? `−${Math.abs(points)}` : `+${points}`;
}

/** "+5 points to 3 members" — the confirmation and audit-note phrasing. */
export function summarizeGrant(memberCount: number, points: number): string {
  const pointWord = Math.abs(points) === 1 ? "point" : "points";
  const memberWord = memberCount === 1 ? "member" : "members";
  return `${signedPoints(points)} ${pointWord} to ${memberCount} ${memberWord}`;
}

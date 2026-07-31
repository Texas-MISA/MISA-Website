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

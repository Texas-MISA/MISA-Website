// The small outlined status badge.
//
// 📌 One component for what was four implementations plus roughly fifteen
// inline copies — 28 instances in all. The four were: `StatusPill` (attendance
// status, admin), `EventStatusPill` (inside events/_components/event-table.tsx),
// `ReviewFlags` (dues), and `AttendanceMark` (public /lookup, which reached for
// `misa-border` where the admin three reached for `black/30`, so the same badge
// was two different greys depending on which half of the app drew it).
//
// 📌 The tones come off the status tokens now, not from raw Tailwind
// `green-900` / `amber-900` / `black/30`.
//
// 📌 `fill` is an opt-in solid variant (officer, 2026-10-05): a saturated status
// background with white text, used for the pass/fail verdicts in /admin
// (eligibility Yes/No, month Met/Not met, meeting Attended/Missed). The default
// stays the muted outline — only those marks ask for the louder treatment.
//
// 🪤 `status` is typed as a bare `string` in the callers that map one, and that
// is deliberate: the attendance column is `text` with a CHECK constraint, and a
// value this component has never heard of must render as ITSELF rather than
// disappear into an "unknown" branch. Keep any status→tone mapping at the call
// site and default it to `neutral`.

import type { ReactNode } from "react";

const TONES = {
  /** The default. Says "this is a fact", not "this needs you". */
  neutral: "border-misa-border text-misa-secondary",
  /** Resolved, present, approved, published. */
  affirm: "border-misa-affirm/45 text-misa-affirm",
  /** Pending, flagged, needs review, draft. */
  caution: "border-misa-caution/45 text-misa-caution",
  /** Rejected, voided, cancelled. */
  critical: "border-misa-critical/45 text-misa-critical",
  /** Navy — for a badge that labels rather than warns. */
  info: "border-misa-blue/45 text-misa-blue",
  /** Inside a navy band, where every tone above is invisible. */
  onNavy: "border-white/40 text-white/85",
} as const;

export type PillTone = keyof typeof TONES;

// The solid counterpart to the three feedback tones, selected by `fill`. Mirrors
// the destructive button's hover state (button.tsx), which is already
// bg-misa-critical + text-white. White on these tokens is ≥4.5:1, since each is
// ≥4.5:1 on white and contrast is symmetric. A tone with no entry here (neutral,
// info, onNavy) falls back to its outline, so `fill` is always safe.
const FILLED_TONES: Partial<Record<PillTone, string>> = {
  affirm: "border-misa-affirm bg-misa-affirm text-white",
  caution: "border-misa-caution bg-misa-caution text-white",
  critical: "border-misa-critical bg-misa-critical text-white",
};

/**
 * The two documented small-uppercase steps, and no third.
 *
 * 🪤 The badges this replaces used `text-[0.65rem]` (10.4px) and
 * `text-[0.7rem]` (11.2px) — neither of which is on the ramp, and both of which
 * read as the 11px step while quietly being two different sizes in adjacent
 * table cells. `sm` is DESIGN.md's 11px/.12em small-meta step (officer roles,
 * semester tags, inline row badges); `md` is its 12px/.14em label step, for a
 * badge sitting beside a heading.
 */
const SIZES = {
  sm: "px-1.5 py-0.5 text-[11px] tracking-[0.12em]",
  md: "px-2 py-0.5 text-[12px] tracking-[0.14em]",
} as const;

export type PillSize = keyof typeof SIZES;

export type PillProps = {
  children: ReactNode;
  tone?: PillTone;
  size?: PillSize;
  /** Solid status fill with white text, for the pass/fail verdicts. See
   * FILLED_TONES — a tone with no filled counterpart stays its outline. */
  fill?: boolean;
  className?: string;
  title?: string;
};

export function Pill({
  children,
  tone = "neutral",
  size = "md",
  fill = false,
  className = "",
  title,
}: PillProps) {
  const toneClasses = (fill && FILLED_TONES[tone]) || TONES[tone];
  return (
    <span
      title={title}
      className={`inline-flex items-center border leading-none whitespace-nowrap uppercase ${toneClasses} ${SIZES[size]} ${className}`.trim()}
    >
      {children}
    </span>
  );
}

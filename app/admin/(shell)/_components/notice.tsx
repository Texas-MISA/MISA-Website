// The left-rule panel this app renders every empty, error and warning state in.
//
// 🔓 Extracted in Stage 8 phase 3, and NOT as tidying. Until now "no data" and
// "the read failed" rendered with the *identical* blue rule, so the whole
// empty-vs-error correction this phase makes to the logic would have been
// invisible on screen. A distinct `error` tone is what makes the fix legible.
//
// ⚠️ The literal this replaces appears at ~57 call sites across 40 files.
// Phase 3 deliberately migrated only the states it created or touched — a
// sweeping find-and-replace across 40 working files is churn with regression
// risk and no user-visible benefit. The remainder is a tidy-up with no trigger;
// use this component for anything new.

const TONES = {
  /** Neutral: an empty list, an explanation, a "nothing to do here". */
  info: "border-misa-blue",
  /** Something needs an officer's attention, but nothing is broken. */
  warning: "border-amber-700",
  /** 🔓 A READ FAILED. Never reuse `info` for this — that is the whole point. */
  error: "border-red-800",
  /** An action succeeded. */
  success: "border-green-800",
} as const;

export type NoticeTone = keyof typeof TONES;

export function Notice({
  tone = "info",
  className = "",
  role,
  children,
}: {
  tone?: NoticeTone;
  className?: string;
  /**
   * Left unset by default. An empty state is not an alert, and announcing every
   * "no rows match" to a screen reader is noise. Pass `role="alert"` where the
   * message is the result of something the officer just did.
   */
  role?: "alert" | "status";
  children: React.ReactNode;
}) {
  return (
    <p
      role={role}
      className={`border-l-4 bg-misa-panel px-4 py-3 text-sm ${TONES[tone]} ${className}`}
    >
      {children}
    </p>
  );
}

/**
 * The standard "we could not read this" message.
 *
 * A component rather than a string so the wording stays consistent across ~20
 * new call sites, and so the distinction from an empty state is structural: you
 * cannot render this by accident when you meant "nothing here".
 *
 * `what` completes the sentence — "Couldn't load {what}."
 */
export function ReadError({
  what,
  className = "",
}: {
  what: string;
  className?: string;
}) {
  return (
    <Notice tone="error" className={className}>
      Couldn&apos;t load {what}. This isn&apos;t a statement about the data — the
      read failed. Try again, and tell an officer if it keeps happening.
    </Notice>
  );
}

// "There is nothing here", as a designed state rather than an absence.
//
// 📌 The app currently renders an empty list as a bare `<p>` in muted grey —
// /leaderboard has three of them — which is indistinguishable from a paragraph
// that happens to be short, and gives the reader nothing to do next.
//
// 🪤 **This must never be a `<Hatch>`.** The Poché Rule reserves the hatch for
// an image slot awaiting real photography: it means *specified, not yet built*.
// An empty table is not an unbuilt volume, and borrowing the hatch for it would
// make the one convention this whole system rests on ambiguous — a reader who
// has learned that hatching means "a photo belongs here" would start finding it
// where no photo ever will.
//
// ⚠️ An empty state is NOT an error state. If a read failed, the honest answer
// is `<ReadError>` — rendering this instead is the exact defect the empty-vs-
// error work in Stage 8 existed to remove, and it reads as an affirmative claim
// that there is nothing, which is a lie the reader has no way to detect.

import type { ReactNode } from "react";

export type EmptyStateProps = {
  /** The fact, in a few words. "No events this term." */
  title: ReactNode;
  /** Why it might be empty, or what would fill it. */
  children?: ReactNode;
  /** The one thing worth doing from here. */
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  children,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`border border-dashed border-misa-border px-6 py-10 text-center ${className}`.trim()}
    >
      <p className="font-display text-[22px] leading-[1.05] font-semibold text-foreground">
        {title}
      </p>
      {children ? (
        <div className="mx-auto mt-2 max-w-[46ch] text-sm leading-[1.65] text-misa-secondary">
          {children}
        </div>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

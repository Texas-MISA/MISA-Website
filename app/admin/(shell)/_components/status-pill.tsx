// Attendance status badge, shared by the dashboard, the review queue, and the
// submission detail page. It lived inside recent-checkins.tsx until Stage 5
// gave it a third caller.
//
// Takes a bare `string` rather than AttendanceStatus on purpose: the column is
// `text` with a CHECK constraint, and a value this component has never heard of
// should render as itself rather than disappear into an "unknown" branch.

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "present"
      ? "border-green-800/40 text-green-900"
      : status === "pending"
        ? "border-amber-800/50 text-amber-900"
        : "border-black/30 text-foreground/60";

  return (
    <span
      className={`border px-2 py-0.5 text-[0.7rem] uppercase tracking-wider ${tone}`}
    >
      {status}
    </span>
  );
}

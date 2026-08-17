// Attendance status badge, shared by the dashboard, the review queue, and the
// submission detail page.
//
// 📌 The badge itself is `components/ui/pill.tsx` now — this was one of four
// implementations of the same shape. What stays here is the thing that is
// genuinely about attendance: the status → tone mapping.
//
// 🪤 Takes a bare `string` rather than `AttendanceStatus` on purpose, and the
// default branch is the reason. The column is `text` with a CHECK constraint,
// so a value this component has never heard of must render as ITSELF in the
// neutral tone rather than disappear into an "unknown" branch.

import { Pill } from "@/components/ui/pill";
import type { PillTone } from "@/components/ui/pill";

function toneFor(status: string): PillTone {
  if (status === "present") return "affirm";
  if (status === "pending") return "caution";
  if (status === "rejected") return "critical";
  return "neutral";
}

export function StatusPill({ status }: { status: string }) {
  return <Pill tone={toneFor(status)}>{status}</Pill>;
}

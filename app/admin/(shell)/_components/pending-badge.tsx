import Link from "next/link";

import { createAdminClient } from "@/lib/supabase/admin";

// The pending-review count (§7 Stage 4). Surfacing it on the dashboard is the
// mitigation for a rotting queue — §9 #8 chose no enforced resolution
// deadline, so visibility is the only thing keeping orphans from being
// forgotten, and Stage 5's queue is what this links into.
//
// Service-role read: attendance is deny-all under RLS until Stage 8.

async function fetchPendingCount(): Promise<number | null> {
  const db = createAdminClient();
  const { count, error } = await db
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) {
    console.error("pending count query failed:", error.message);
    return null;
  }
  return count ?? 0;
}

export async function PendingBadge() {
  const count = await fetchPendingCount();

  if (count === null) {
    return (
      <p className="border border-misa-blue/35 bg-misa-panel px-4 py-3 text-sm">
        Couldn&apos;t load the pending count.
      </p>
    );
  }

  if (count === 0) {
    return (
      <p className="border border-misa-blue/35 bg-misa-panel px-4 py-3 text-sm">
        Nothing waiting for review.{" "}
        <Link href="/admin/attendance?status=all" className="underline">
          Browse all submissions
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="border border-misa-caution/45 bg-misa-caution-wash px-4 py-3">
      <p className="text-sm">
        <strong className="font-display text-lg">{count}</strong>{" "}
        {count === 1 ? "check-in is" : "check-ins are"} waiting for an officer
        to match {count === 1 ? "it" : "them"} to an event or a member.
      </p>
      <p className="mt-1 text-xs text-misa-secondary">
        <Link href="/admin/attendance?status=pending" className="underline">
          Open the review queue
        </Link>{" "}
        — oldest first.
      </p>
    </div>
  );
}

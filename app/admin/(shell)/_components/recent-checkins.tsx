import { StatusPill } from "@/app/admin/(shell)/_components/status-pill";
import { formatInstant } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";

// Recent check-ins on the officer dashboard (§7 Stage 4).
//
// Reads with the service-role client: attendance is deny-all under RLS until
// Stage 8, so there is no anon-capable path to it yet. Stage 8 replaces this
// with lib/supabase/server.ts plus officer policies.

const LIMIT = 12;

type CheckinRow = {
  id: string;
  submitted_name: string;
  submitted_eid: string;
  submitted_at: string;
  status: string;
  events: { title: string } | null;
};

async function fetchRecentCheckins(): Promise<
  { kind: "ok"; rows: CheckinRow[] } | { kind: "error" }
> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("attendance")
    .select(
      "id, submitted_name, submitted_eid, submitted_at, status, events(title)"
    )
    .order("submitted_at", { ascending: false })
    .limit(LIMIT);

  if (error) {
    console.error("recent check-ins query failed:", error.message);
    return { kind: "error" };
  }
  return { kind: "ok", rows: data as CheckinRow[] };
}

export async function RecentCheckins() {
  const result = await fetchRecentCheckins();

  if (result.kind === "error") {
    return (
      <p className="border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm">
        Couldn&apos;t load recent check-ins.
      </p>
    );
  }
  if (result.rows.length === 0) {
    return (
      <p className="border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm">
        No check-ins yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-2 pr-4 font-medium">Name</th>
            <th className="py-2 pr-4 font-medium">EID</th>
            <th className="py-2 pr-4 font-medium">Event</th>
            <th className="py-2 pr-4 font-medium">Submitted</th>
            <th className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row) => (
            <tr key={row.id} className="border-b border-black/15">
              <td className="py-2 pr-4">{row.submitted_name}</td>
              <td className="py-2 pr-4 font-mono text-xs">
                {row.submitted_eid}
              </td>
              <td className="py-2 pr-4">
                {row.events?.title ?? (
                  <span className="text-foreground/50">unmatched</span>
                )}
              </td>
              <td className="py-2 pr-4 whitespace-nowrap">
                {formatInstant(row.submitted_at)} CT
              </td>
              <td className="py-2">
                <StatusPill status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


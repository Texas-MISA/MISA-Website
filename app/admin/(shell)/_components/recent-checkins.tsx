import { Notice, ReadError } from "@/app/admin/(shell)/_components/notice";
import { StatusPill } from "@/app/admin/(shell)/_components/status-pill";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
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

  // 🔓 A failed read renders as an ERROR, not as an empty list. This used to be
  // the same blue `info` panel as "no check-ins yet", which is the empty-vs-error
  // conflation Stage 8 phase 3 corrected everywhere else and banner.tsx names
  // outright: never reuse `info` for a failed read.
  if (result.kind === "error") {
    return <ReadError what="recent check-ins" />;
  }
  if (result.rows.length === 0) {
    return <Notice>No check-ins yet.</Notice>;
  }

  return (
    <Table minWidth="min-w-[36rem]">
      <THead>
        <Tr hover={false}>
          <Th>Name</Th>
          <Th>EID</Th>
          <Th>Event</Th>
          <Th>Submitted</Th>
          <Th>Status</Th>
        </Tr>
      </THead>
      <tbody>
        {result.rows.map((row) => (
          <Tr key={row.id}>
            <Td>{row.submitted_name}</Td>
            {/* Monospace: an EID is read off a phone screen by hand, and it is
                where `l` has to be distinguishable from `1`. */}
            <Td className="font-mono text-xs">{row.submitted_eid}</Td>
            <Td>
              {row.events?.title ?? (
                <span className="text-misa-muted">unmatched</span>
              )}
            </Td>
            <Td className="whitespace-nowrap">
              {formatInstant(row.submitted_at)} CT
            </Td>
            <Td>
              <StatusPill status={row.status} />
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}


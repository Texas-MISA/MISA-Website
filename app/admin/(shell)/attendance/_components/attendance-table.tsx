import Link from "next/link";

import { StatusPill } from "@/app/admin/(shell)/_components/status-pill";
import { formatInstant } from "@/lib/events";

// Presentational only — the page owns the query, matching event-table.tsx.

export type SubmissionRow = {
  id: string;
  submitted_name: string;
  submitted_student_id: string;
  submitted_email: string;
  submitted_at: string;
  status: string;
  source: string;
  event_id: string | null;
  member_id: string | null;
  events: { id: string; title: string; status: string } | null;
  members: { id: string; full_name: string; active: boolean } | null;
};

export function AttendanceTable({ rows }: { rows: SubmissionRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm">
        No submissions match these filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-2 pr-4 font-medium">Submitted</th>
            <th className="py-2 pr-4 font-medium">Name</th>
            <th className="py-2 pr-4 font-medium">Student ID</th>
            <th className="py-2 pr-4 font-medium">Event</th>
            <th className="py-2 pr-4 font-medium">Member</th>
            <th className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-black/15 align-top">
              <td className="py-2 pr-4 whitespace-nowrap">
                <Link
                  href={`/admin/attendance/${row.id}`}
                  className="underline underline-offset-2"
                >
                  {formatInstant(row.submitted_at)} CT
                </Link>
              </td>
              <td className="py-2 pr-4">
                {row.submitted_name}
                {row.source === "admin_manual" && (
                  <span className="ml-2 text-xs text-foreground/50">
                    entered by an officer
                  </span>
                )}
              </td>
              <td className="py-2 pr-4 font-mono text-xs">
                {row.submitted_student_id}
              </td>
              <td className="py-2 pr-4">
                <Unlinked value={row.events?.title} label="no event" />
              </td>
              <td className="py-2 pr-4">
                <Unlinked value={row.members?.full_name} label="no member" />
                {row.members?.active === false && (
                  <span className="ml-2 text-xs text-foreground/50">
                    inactive
                  </span>
                )}
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

/** A missing link is the whole reason a row is in this queue, so it is named
 * rather than left as an empty cell. */
function Unlinked({ value, label }: { value?: string; label: string }) {
  if (value) return <>{value}</>;
  return <span className="text-foreground/50">{label}</span>;
}

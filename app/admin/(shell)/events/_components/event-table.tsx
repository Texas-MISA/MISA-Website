import Link from "next/link";

import { Notice } from "@/app/admin/(shell)/_components/notice";
import { Pill } from "@/components/ui/pill";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { formatCategory, formatEventRange } from "@/lib/events";

// Presentational only — the page owns the query. Server Component: nothing
// here is interactive beyond links.

export type EventListRow = {
  id: string;
  title: string;
  location: string | null;
  starts_at: string;
  ends_at: string;
  checkin_opens_at: string | null;
  checkin_closes_at: string | null;
  points: number;
  category: string | null;
  status: string;
  term: string | null;
  series_id: string | null;
  // PostgREST returns an embedded aggregate as a single-element array.
  attendance: { count: number }[];
};

export function EventTable({ rows }: { rows: EventListRow[] }) {
  if (rows.length === 0) {
    return (
      <Notice>No events match these filters.</Notice>
    );
  }

  // Series members are numbered so a 12-week schedule reads as one thing
  // rather than twelve identically-titled rows. Ordering is by start time, so
  // counting forward from the earliest gives the officer "week 6 of 12".
  const seriesPosition = numberSeriesMembers(rows);

  return (
    <Table minWidth="min-w-[52rem]">
      <THead>
        <Tr hover={false}>
          <Th>Event</Th>
          <Th>When (CT)</Th>
          <Th>Category</Th>
          <Th numeric>Points</Th>
          <Th numeric>Check-ins</Th>
          <Th>Status</Th>
        </Tr>
      </THead>
      <tbody>
        {rows.map((row) => {
          const position = seriesPosition.get(row.id);
          return (
            <Tr key={row.id} className="align-top">
              <Td>
                <Link
                  href={`/admin/events/${row.id}`}
                  className="text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
                >
                  {row.title}
                </Link>
                {position && (
                  <span className="ml-2 text-xs text-misa-muted">
                    {position}
                  </span>
                )}
                {row.location && (
                  <div className="text-xs text-misa-muted">{row.location}</div>
                )}
              </Td>
              <Td className="whitespace-nowrap">
                {formatEventRange(row.starts_at, row.ends_at)}
              </Td>
              <Td>{formatCategory(row.category)}</Td>
              <Td numeric>{row.points}</Td>
              <Td numeric>{row.attendance?.[0]?.count ?? 0}</Td>
              <Td>
                <EventStatusPill status={row.status} />
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}

// 🪤 The status→tone mapping stays HERE rather than inside `Pill`, and defaults
// to neutral: `events.status` is text with a CHECK constraint, so a value this
// component has not heard of must render as itself rather than vanish into an
// "unknown" branch.
export function EventStatusPill({ status }: { status: string }) {
  const tone =
    status === "published" ? "affirm" : status === "draft" ? "neutral" : "critical";

  return <Pill tone={tone}>{status}</Pill>;
}

/** "week 6 of 12" for every event that belongs to a series. */
function numberSeriesMembers(rows: EventListRow[]): Map<string, string> {
  const bySeries = new Map<string, EventListRow[]>();
  for (const row of rows) {
    if (!row.series_id) continue;
    const group = bySeries.get(row.series_id) ?? [];
    group.push(row);
    bySeries.set(row.series_id, group);
  }

  const labels = new Map<string, string>();
  for (const group of bySeries.values()) {
    const ordered = [...group].sort((a, b) =>
      a.starts_at.localeCompare(b.starts_at)
    );
    ordered.forEach((row, index) => {
      // The filtered page may hold only part of a series, so this counts what
      // is on screen. It is an orientation aid, not a stored week number.
      labels.set(row.id, `${index + 1} of ${ordered.length} shown`);
    });
  }
  return labels;
}

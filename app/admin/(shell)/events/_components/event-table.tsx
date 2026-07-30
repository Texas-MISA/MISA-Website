import Link from "next/link";

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
      <p className="border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm">
        No events match these filters.
      </p>
    );
  }

  // Series members are numbered so a 12-week schedule reads as one thing
  // rather than twelve identically-titled rows. Ordering is by start time, so
  // counting forward from the earliest gives the officer "week 6 of 12".
  const seriesPosition = numberSeriesMembers(rows);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-2 pr-4 font-medium">Event</th>
            <th className="py-2 pr-4 font-medium">When (CT)</th>
            <th className="py-2 pr-4 font-medium">Category</th>
            <th className="py-2 pr-4 font-medium">Points</th>
            <th className="py-2 pr-4 font-medium">Check-ins</th>
            <th className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const position = seriesPosition.get(row.id);
            return (
              <tr key={row.id} className="border-b border-black/15 align-top">
                <td className="py-2 pr-4">
                  <Link
                    href={`/admin/events/${row.id}`}
                    className="text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
                  >
                    {row.title}
                  </Link>
                  {position && (
                    <span className="ml-2 text-xs text-foreground/60">
                      {position}
                    </span>
                  )}
                  {row.location && (
                    <div className="text-xs text-foreground/60">
                      {row.location}
                    </div>
                  )}
                </td>
                <td className="py-2 pr-4 whitespace-nowrap">
                  {formatEventRange(row.starts_at, row.ends_at)}
                </td>
                <td className="py-2 pr-4">{formatCategory(row.category)}</td>
                <td className="py-2 pr-4">{row.points}</td>
                <td className="py-2 pr-4">{row.attendance?.[0]?.count ?? 0}</td>
                <td className="py-2">
                  <EventStatusPill status={row.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function EventStatusPill({ status }: { status: string }) {
  const tone =
    status === "published"
      ? "border-green-800/40 text-green-900"
      : status === "draft"
        ? "border-black/40 text-foreground/70"
        : "border-red-800/40 text-red-900";

  return (
    <span
      className={`border px-2 py-0.5 text-[0.7rem] uppercase tracking-wider ${tone}`}
    >
      {status}
    </span>
  );
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

"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { ATTENDANCE_STATUSES } from "@/lib/attendance";

// Same contract as event-filters.tsx: no submit button, everything in the URL
// so a filtered queue is shareable and survives a reload.

const selectClass = "border border-black/70 bg-misa-panel px-3 py-2 text-sm";
const inputClass = "border border-black/70 bg-misa-panel px-3 py-2 text-sm";

/**
 * Options arrive with their label already rendered.
 *
 * Formatting a date in here instead would run Intl.DateTimeFormat on both the
 * server and the client, and the two disagree on the invisible space before
 * "PM" — Node and Chrome ship different ICU data. That is a hydration mismatch
 * whose diff looks like two identical strings, which is a genuinely horrible
 * hour to spend. Server Components own date formatting; this one just renders.
 */
export type EventOption = {
  id: string;
  label: string;
};

export function AttendanceFilters({
  events,
  selected,
}: {
  events: EventOption[];
  selected: {
    status: string;
    event: string;
    from: string;
    to: string;
    sort: string;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/admin/attendance?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <Labelled label="Status">
        <select
          className={selectClass}
          value={selected.status}
          onChange={(e) => update("status", e.target.value)}
        >
          {/* Pending is the default view, so "all" has to be an explicit
              choice rather than the empty option. */}
          <option value="all">All statuses</option>
          {ATTENDANCE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </Labelled>

      <Labelled label="Event">
        <select
          className={selectClass}
          value={selected.event}
          onChange={(e) => update("event", e.target.value)}
        >
          <option value="">Any event</option>
          <option value="unassigned">Unassigned</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.label}
            </option>
          ))}
        </select>
      </Labelled>

      <Labelled label="From">
        <input
          type="date"
          className={inputClass}
          value={selected.from}
          onChange={(e) => update("from", e.target.value)}
        />
      </Labelled>

      <Labelled label="To">
        <input
          type="date"
          className={inputClass}
          value={selected.to}
          onChange={(e) => update("to", e.target.value)}
        />
      </Labelled>

      <Labelled label="Sort">
        <select
          className={selectClass}
          value={selected.sort}
          onChange={(e) => update("sort", e.target.value)}
        >
          <option value="oldest">Oldest first</option>
          <option value="newest">Newest first</option>
        </select>
      </Labelled>
    </div>
  );
}

function Labelled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      {children}
    </label>
  );
}

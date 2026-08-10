import type { Metadata } from "next";
import Link from "next/link";

import { requireOfficer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

import { EventFilters } from "./_components/event-filters";
import { EventTable, type EventListRow } from "./_components/event-table";
import { SeriesActions } from "./_components/series-actions";

// The schedule (§5, §7 Stage 4). Officers see drafts and cancelled events
// here — the public site only ever sees published ones.
//
// Service-role read: events are anon-readable only where status = 'published'
// (the events_public_read policy), so a draft is invisible to the anon client
// by design. Stage 8 adds officer policies and this moves to server.ts.

export const metadata: Metadata = { title: "Events" };

type Filters = {
  term: string;
  status: string;
  category: string;
  series: string;
};

async function fetchTerms(): Promise<string[]> {
  const db = createAdminClient();
  // Distinct terms, newest first. The generated `term` column means this list
  // can never contain a typo'd value (§4.7).
  const { data, error } = await db
    .from("events")
    .select("term")
    .order("starts_at", { ascending: false });

  if (error) {
    console.error("terms query failed:", error.message);
    return [];
  }
  return [...new Set(data.map((row) => row.term).filter(Boolean) as string[])];
}

async function fetchCurrentTerm(): Promise<string> {
  const db = createAdminClient();
  // Never hardcode a term string (§4.7) — ask the database which one is
  // current, so an officer's app_settings override is honoured too.
  const { data, error } = await db.rpc("current_term");
  if (error) {
    // 🔓 Throw rather than return null, and the reason is not tidiness.
    //
    // The caller does `params.term ?? currentTerm ?? ""`, and an empty term
    // applies NO predicate — so a failed rpc silently widened the default view
    // from "this term" to every event ever recorded, capped at 200. Worse, the
    // term control then read "all", so the screen and the filter agreed with
    // each other about the wrong thing and nothing looked out of place. An
    // officer would have had no way to notice.
    //
    // There is no honest fallback here: without the current term this page
    // cannot know what it is supposed to be showing. The error boundary can
    // say so; a widened list cannot.
    console.error("current_term rpc failed:", error.message);
    throw new Error("Could not determine the current term.");
  }
  return data;
}

async function fetchEvents(
  filters: Filters
): Promise<{ kind: "ok"; rows: EventListRow[] } | { kind: "error" }> {
  const db = createAdminClient();

  let query = db
    .from("events")
    .select(
      "id, title, location, starts_at, ends_at, checkin_opens_at, checkin_closes_at, points, category, status, term, series_id, attendance(count)"
    )
    .order("starts_at", { ascending: false })
    .limit(200);

  if (filters.term) query = query.eq("term", filters.term);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.series) query = query.eq("series_id", filters.series);

  const { data, error } = await query;
  if (error) {
    console.error("events query failed:", error.message);
    return { kind: "error" };
  }
  return { kind: "ok", rows: data as unknown as EventListRow[] };
}

export default async function AdminEventsPage({
  searchParams,
}: {
  // Promise in Next 16 — await before reading.
  searchParams: Promise<{
    term?: string;
    status?: string;
    category?: string;
    series?: string;
  }>;
}) {
  await requireOfficer();

  const params = await searchParams;
  const [terms, currentTerm] = await Promise.all([
    fetchTerms(),
    fetchCurrentTerm(),
  ]);

  // "all" is an explicit choice; an absent parameter defaults to the current
  // term, which is what an officer almost always wants on arrival. Viewing one
  // series drops the term filter entirely — a series can straddle a term
  // boundary, and hiding half of it behind a default nobody chose would be
  // exactly the wrong behaviour.
  const series = params.series ?? "";
  const term = series
    ? ""
    : params.term === "all"
      ? ""
      : (params.term ?? currentTerm ?? "");

  const filters: Filters = {
    term,
    status: params.status ?? "",
    category: params.category ?? "",
    series,
  };

  const result = await fetchEvents(filters);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          Events
        </h1>
        <Link
          href="/admin/events/new"
          className="rounded-full bg-misa-blue px-6 py-2 text-xs font-medium tracking-wider text-white transition hover:bg-misa-blue-dark"
        >
          NEW EVENT
        </Link>
      </div>

      <div className="mt-6">
        <EventFilters
          terms={terms}
          currentTerm={currentTerm}
          selected={{
            term: params.term ?? currentTerm ?? "all",
            status: filters.status,
            category: filters.category,
          }}
        />
      </div>

      {series && result.kind === "ok" && result.rows.length > 0 && (
        <div className="mt-6">
          <SeriesActions
            seriesId={series}
            draftCount={
              result.rows.filter((row) => row.status === "draft").length
            }
          />
        </div>
      )}

      <div className="mt-8">
        {result.kind === "error" ? (
          <p className="border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm">
            Couldn&apos;t load the schedule.
          </p>
        ) : (
          <EventTable rows={result.rows} />
        )}
      </div>
    </div>
  );
}

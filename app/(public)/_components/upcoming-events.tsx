import { createClient } from "@/lib/supabase/server";

import type { Database } from "@/lib/types/database";

// Live schedule section. Not part of the original txmisa.org — this is the
// Stage 2 exit criterion and the reason this app exists (docs §7, Stage 2).

type EventRow = Pick<
  Database["public"]["Tables"]["events"]["Row"],
  "id" | "title" | "description" | "location" | "starts_at" | "ends_at" | "category"
>;

// All times are wall-clock Central, matching term_of()'s America/Chicago
// anchor (§4.7) — the server runs in UTC, so never format without a zone.
const CENTRAL = "America/Chicago";

function formatEventTime(startsAt: string, endsAt: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: CENTRAL,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  // formatRange collapses the shared date: "Tue, Sep 1, 6:00 – 7:00 PM".
  return fmt.formatRange(new Date(startsAt), new Date(endsAt));
}

async function fetchUpcomingEvents(): Promise<
  { kind: "ok"; events: EventRow[] } | { kind: "error" }
> {
  const supabase = await createClient();
  // RLS is the boundary — the anon role can only see published rows — but the
  // filter stays explicit so the query states its own intent.
  const { data, error } = await supabase
    .from("events")
    .select("id, title, description, location, starts_at, ends_at, category")
    .eq("status", "published")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(10);

  if (error) {
    // A broken schedule read shouldn't take down the landing page; log for the
    // function logs and render the fallback.
    console.error("upcoming events query failed:", error.message);
    return { kind: "error" };
  }
  return { kind: "ok", events: data };
}

export async function UpcomingEvents() {
  const result = await fetchUpcomingEvents();

  return (
    <section className="bg-white px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-center font-display text-3xl font-extrabold sm:text-4xl">
          Upcoming Events
        </h2>

        <div className="mt-10">
          {result.kind === "error" ? (
            <p className="text-center text-foreground/70">
              The schedule couldn&apos;t be loaded right now — check back soon.
            </p>
          ) : result.events.length === 0 ? (
            <p className="text-center text-foreground/70">
              No upcoming events are scheduled yet — check back soon.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {result.events.map((event) => (
                <li
                  key={event.id}
                  className="border-l-4 border-misa-blue bg-misa-panel px-5 py-4"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                    <h3 className="font-display text-lg font-bold">{event.title}</h3>
                    <p className="text-sm text-foreground/70">
                      {formatEventTime(event.starts_at, event.ends_at)} CT
                    </p>
                  </div>
                  {event.location && (
                    <p className="mt-1 text-sm text-foreground/70">{event.location}</p>
                  )}
                  {event.description && (
                    <p className="mt-2 text-sm text-foreground/80">{event.description}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

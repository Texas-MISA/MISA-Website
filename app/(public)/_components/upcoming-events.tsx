import { createClient } from "@/lib/supabase/server";

import type { Database } from "@/lib/types/database";

// Live schedule column. Not part of the original txmisa.org and not part of
// the design handoff's static prototype either — this is the Stage 2 exit
// criterion and the reason this app exists (docs §7, Stage 2). The handoff's
// three hardcoded rows are the shape; these are the real ones.

type EventRow = Pick<
  Database["public"]["Tables"]["events"]["Row"],
  "id" | "title" | "location" | "starts_at" | "ends_at"
>;

// All times are wall-clock Central, matching term_of()'s America/Chicago
// anchor (§4.7) — the server runs in UTC, so never format without a zone.
// Formatting stays in this Server Component: Intl in a Client Component
// produces a hydration diff between two strings that look identical.
const CENTRAL = "America/Chicago";

const DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: CENTRAL,
  month: "short",
  day: "2-digit",
});

const TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: CENTRAL,
  hour: "numeric",
  minute: "2-digit",
});

async function fetchUpcomingEvents(): Promise<
  { kind: "ok"; events: EventRow[] } | { kind: "error" }
> {
  const supabase = await createClient();
  // RLS is the boundary — the anon role can only see published rows — but the
  // filter stays explicit so the query states its own intent.
  const { data, error } = await supabase
    .from("events")
    .select("id, title, location, starts_at, ends_at")
    .eq("status", "published")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(10);

  if (error) {
    // 🔓 A failed read must never render as an affirmative absence. Log for
    // the function logs and return the error case, so the section says
    // something went wrong rather than "no events are scheduled".
    console.error("upcoming events query failed:", error.message);
    return { kind: "error" };
  }
  return { kind: "ok", events: data };
}

export async function UpcomingEvents() {
  const result = await fetchUpcomingEvents();

  return (
    <div data-reveal="up" style={{ "--reveal-delay": "0.1s" } as React.CSSProperties}>
      <h2 className="mb-4 font-display text-[30px] leading-none font-semibold tracking-[-0.02em] text-misa-blue sm:text-[42px]">
        Upcoming Events
      </h2>

      {result.kind === "error" ? (
        <p className="text-misa-secondary">
          The schedule couldn&apos;t be loaded right now — check back soon.
        </p>
      ) : result.events.length === 0 ? (
        <p className="text-misa-secondary">
          No upcoming events are scheduled yet — check back soon.
        </p>
      ) : (
        <ul className="border-t border-misa-border">
          {result.events.map((event) => {
            const startsAt = new Date(event.starts_at);
            return (
              <li
                key={event.id}
                className="grid grid-cols-[92px_1fr] items-baseline gap-4 border-b border-misa-border py-3.5"
              >
                <span className="text-xs leading-tight font-medium tracking-[0.14em] uppercase text-misa-blue">
                  {DATE.format(startsAt)}
                </span>
                <span>
                  <span className="block font-display text-[21px] leading-[1.1] font-semibold">
                    {event.title}
                  </span>
                  <span className="text-[13px] leading-normal text-misa-muted">
                    {event.location ? `${event.location} · ` : ""}
                    {TIME.format(startsAt)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

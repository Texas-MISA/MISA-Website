import { createClient } from "@/lib/supabase/server";

import type { Database } from "@/lib/types/database";

// The events list must reflect what officers publish, immediately — a
// build-time snapshot would show a stale schedule until the next deploy.
// createClient() touches cookies(), which forces request-time rendering
// anyway; this makes the intent explicit rather than incidental.
export const dynamic = "force-dynamic";

type EventRow = Pick<
  Database["public"]["Tables"]["events"]["Row"],
  "id" | "title" | "description" | "location" | "starts_at" | "ends_at" | "category"
>;

// All times are wall-clock Central, matching term_of()'s America/Chicago
// anchor (§4.7) — the server itself runs in UTC, so never format without an
// explicit zone.
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
  // formatRange collapses the shared date part: "Tue, Sep 1, 6:00 – 7:00 PM".
  return fmt.formatRange(new Date(startsAt), new Date(endsAt));
}

async function fetchUpcomingEvents(): Promise<
  { kind: "ok"; events: EventRow[] } | { kind: "error" }
> {
  const supabase = await createClient();
  // RLS is the boundary here — the anon role can only see published rows —
  // but the filter stays explicit so the query states its own intent.
  const { data, error } = await supabase
    .from("events")
    .select("id, title, description, location, starts_at, ends_at, category")
    .eq("status", "published")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(10);

  if (error) {
    // A broken schedule read should not take down the landing page; log for
    // the function logs and render the section's fallback.
    console.error("upcoming events query failed:", error.message);
    return { kind: "error" };
  }
  return { kind: "ok", events: data };
}

function UpcomingEvents({
  result,
}: {
  result: Awaited<ReturnType<typeof fetchUpcomingEvents>>;
}) {
  if (result.kind === "error") {
    return (
      <p className="text-zinc-600 dark:text-zinc-400">
        The schedule couldn&apos;t be loaded right now — check back soon.
      </p>
    );
  }
  if (result.events.length === 0) {
    return (
      <p className="text-zinc-600 dark:text-zinc-400">
        No upcoming events are scheduled yet — check back soon.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {result.events.map((event) => (
        <li
          key={event.id}
          className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h3 className="font-semibold">{event.title}</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {formatEventTime(event.starts_at, event.ends_at)} CT
            </p>
          </div>
          {event.location && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {event.location}
            </p>
          )}
          {event.description && (
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
              {event.description}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Static content. Everything in square brackets is placeholder copy waiting
// on real text from the officers — replace the text, keep the structure.
// ---------------------------------------------------------------------------

const OFFICERS: { role: string; name: string }[] = [
  { role: "President", name: "[Name]" },
  { role: "Vice President", name: "[Name]" },
  { role: "Treasurer", name: "[Name]" },
  { role: "Secretary", name: "[Name]" },
];

export default async function LandingPage() {
  const eventsResult = await fetchUpcomingEvents();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-10 sm:py-16">
      {/* Hero */}
      <header className="flex flex-col gap-4">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">MISA</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          [One-sentence tagline — what MISA is and who it&apos;s for.]
        </p>
      </header>

      {/* About */}
      <section aria-labelledby="about-heading" className="mt-12">
        <h2 id="about-heading" className="text-xl font-semibold">
          About us
        </h2>
        <p className="mt-3 leading-7 text-zinc-700 dark:text-zinc-300">
          [Mission statement and a short paragraph about what the org does —
          two or three sentences. Real copy needed from the officers.]
        </p>
        <p className="mt-3 leading-7 text-zinc-700 dark:text-zinc-300">
          [Meeting cadence — e.g. general meetings every other Tuesday at 6pm,
          location. Pulled apart from the mission so a stranger can find
          &quot;when do they meet&quot; at a glance.]
        </p>
      </section>

      {/* Upcoming events — live from the database */}
      <section aria-labelledby="events-heading" className="mt-12">
        <h2 id="events-heading" className="text-xl font-semibold">
          Upcoming events
        </h2>
        <div className="mt-4">
          <UpcomingEvents result={eventsResult} />
        </div>
      </section>

      {/* Officers */}
      <section aria-labelledby="officers-heading" className="mt-12">
        <h2 id="officers-heading" className="text-xl font-semibold">
          Officers
        </h2>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {OFFICERS.map((officer) => (
            <li
              key={officer.role}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <p className="font-medium">{officer.name}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {officer.role}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Contact */}
      <section aria-labelledby="contact-heading" className="mt-12">
        <h2 id="contact-heading" className="text-xl font-semibold">
          Get in touch
        </h2>
        <ul className="mt-4 flex flex-col gap-2 text-zinc-700 dark:text-zinc-300">
          <li>Email: [org email]</li>
          <li>Instagram: [handle]</li>
          <li>Discord: [invite link]</li>
        </ul>
      </section>

      <footer className="mt-16 border-t border-zinc-200 pt-6 text-sm text-zinc-500 dark:border-zinc-800">
        MISA · The University of Texas at Austin
      </footer>
    </div>
  );
}

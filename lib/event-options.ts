import type { SupabaseClient } from "@supabase/supabase-js";

import { formatEventRange } from "@/lib/events";
import type { Database } from "@/lib/types/database";

// Event choices for the admin pickers — the queue filter, the resolution form,
// and manual entry all offer the same list, so it is built once here.
//
// Takes the client as a parameter, matching lib/admin-profiles.ts, so it stays
// testable and carries no server-only guard.
//
// **All statuses, deliberately.** nearby_events() powers the ranked suggestions
// and is published-only and blind past 48 hours, so suggestions alone cannot
// express every assignment an officer needs to make: a submission from a
// cancelled event, or one that has sat in the queue for a week, has no
// suggestion at all. The picker is the escape hatch, which only works if it can
// reach the events the ranker cannot see. `status` rides along so the UI can
// say what it is offering.

type Client = SupabaseClient<Database>;

export type EventOption = {
  id: string;
  label: string;
  status: string;
};

const DEFAULT_LIMIT = 100;

export async function fetchEventOptions(
  db: Client,
  limit = DEFAULT_LIMIT
): Promise<EventOption[]> {
  const { data, error } = await db
    .from("events")
    .select("id, title, starts_at, ends_at, status")
    .order("starts_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("event options query failed:", error.message);
    return [];
  }

  // Labels are formatted here, on the server. Intl.DateTimeFormat inside a
  // Client Component runs on both sides of hydration and Node and Chrome ship
  // different ICU data for the space before "PM", so React reports a mismatch
  // between two strings that look identical.
  return data.map((event) => ({
    id: event.id,
    label: `${event.title} — ${formatEventRange(event.starts_at, event.ends_at)}`,
    status: event.status,
  }));
}

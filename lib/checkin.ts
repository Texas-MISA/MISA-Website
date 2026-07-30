import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

// Check-in resolution core (§4.2, §4.3). Deliberately free of next/* and
// server-only imports so the test suite can call it with the local stack's
// client and injected timestamps. The Server Action in
// app/actions/attendance.ts is the thin wrapper that adds validation, the
// honeypot, and rate limiting.

/**
 * The orphan grace window (§4.3, §9 #7): how far from any published event a
 * submission may be and still be queued as `pending` rather than refused.
 *
 * Single source of truth. nearby_events() has a SQL-side `default 48` too,
 * but that default is a fallback for ad-hoc SQL only — application code must
 * always pass this constant explicitly.
 */
export const ORPHAN_WINDOW_HOURS = 48;

// Deliberately generous (§6): an event venue's NAT can put a whole room of
// legitimate members behind one IP. The honeypot and the orphan-window bound
// are the primary controls; this only stops scripted floods.
export const RATE_LIMIT_MAX = 30;
export const RATE_LIMIT_WINDOW_MINUTES = 10;

/**
 * JS mirror of the SQL normalization on members.normalized_student_id and
 * attendance.normalized_student_id:
 *
 *   upper(regexp_replace(x, '\s|-', '', 'g'))
 *
 * The two must strip identically — tests/normalization.test.ts asserts the
 * generated column equals this function for pathological inputs.
 */
export function normalizeStudentId(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, "");
}

/**
 * Escape ILIKE metacharacters so `.ilike(column, escapeIlike(value))` is a
 * case-insensitive *equality* test — matching the `lower(email)` unique
 * index's semantics — rather than a pattern match.
 */
export function escapeIlike(raw: string): string {
  return raw.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export type CheckinInput = {
  fullName: string;
  studentId: string;
  email: string;
};

export type CheckinResult =
  | { status: "present"; eventTitle: string }
  | { status: "pending" }
  | { status: "duplicate"; prior: "present" | "pending" }
  | { status: "refused" }
  | { status: "error" };

type Client = SupabaseClient<Database>;

const UNIQUE_VIOLATION = "23505";

/**
 * Resolve one submission. Order (§4.2/§4.3):
 *
 *   1. open_event_at(now) — the window semantics live entirely in SQL, so the
 *      half-open bounds cannot drift between the constraint, the function,
 *      and the app (the CLAUDE.md three-places invariant).
 *   2. No open event and nothing within ORPHAN_WINDOW_HOURS → refused, and
 *      nothing is written.
 *   3. Member resolution always succeeds: normalized_student_id, then
 *      lower(email), then create with source='self_checkin' (active
 *      immediately, no approval step, no audit row — §4.2). This runs on the
 *      orphan path too; a later-rejected orphan may leave a self-registered
 *      member behind, which is §6's roster-pollution row: cleanup, not loss.
 *   4. Duplicate checks, then insert. The partial unique index is the
 *      concurrency backstop; the app-level checks close the two gaps the
 *      index cannot see (same member via a different raw ID, and orphan
 *      re-submission where event_id is null).
 *
 * A prior pending orphan never blocks a new event-resolved submission: the
 * new row inserts as present and the orphan stays in the officer queue
 * untouched. Never auto-merged — don't auto-resolve near-misses.
 */
export async function resolveCheckin(
  db: Client,
  input: CheckinInput,
  now: Date
): Promise<CheckinResult> {
  const ts = now.toISOString();
  const normalized = normalizeStudentId(input.studentId);

  // 1. Which event, if any, is open at this instant?
  const openEvent = await db.rpc("open_event_at", { ts });
  if (openEvent.error) {
    console.error("open_event_at failed:", openEvent.error.message);
    return { status: "error" };
  }
  const event = openEvent.data[0] ?? null;

  // 2. No open event: refuse outright unless something is inside the grace
  //    window (§4.3 — refused, not queued, so the form can't manufacture
  //    attendance in the middle of summer).
  if (!event) {
    const nearby = await db.rpc("nearby_events", {
      ts,
      window_hours: ORPHAN_WINDOW_HOURS,
    });
    if (nearby.error) {
      console.error("nearby_events failed:", nearby.error.message);
      return { status: "error" };
    }
    if (nearby.data.length === 0) return { status: "refused" };
  }

  // 3. Member resolution: ID, then email, then create.
  const memberId = await resolveMember(db, input, normalized);
  if (memberId === null) return { status: "error" };

  if (event) {
    // 4a. Same member already recorded for this event under any raw ID —
    //     the double-credit gap the unique index cannot see, because a
    //     member matched by email may carry a different normalized ID.
    const existing = await db
      .from("attendance")
      .select("status")
      .eq("event_id", event.id)
      .eq("member_id", memberId)
      .neq("status", "rejected")
      .limit(1);
    if (existing.error) {
      console.error("duplicate pre-check failed:", existing.error.message);
      return { status: "error" };
    }
    if (existing.data.length > 0) {
      return {
        status: "duplicate",
        prior: existing.data[0].status === "present" ? "present" : "pending",
      };
    }

    const inserted = await db.from("attendance").insert({
      event_id: event.id,
      member_id: memberId,
      submitted_name: input.fullName,
      submitted_student_id: input.studentId,
      submitted_email: input.email,
      submitted_at: ts,
      // Both links resolved, so present — satisfies present_requires_resolution
      // by construction.
      status: "present",
    });
    if (inserted.error) {
      if (inserted.error.code === UNIQUE_VIOLATION) {
        // attendance_one_per_event: same (event_id, normalized_student_id)
        // already recorded. Fetch the blocking row's status for the message.
        return duplicateFromIndex(db, event.id, normalized);
      }
      console.error("attendance insert failed:", inserted.error.message);
      return { status: "error" };
    }
    return { status: "present", eventTitle: event.title };
  }

  // 4b. Orphan path. The unique index ignores rows with event_id null, so a
  //     double-tap outside a window would stack queue rows without this check.
  const windowStart = new Date(
    now.getTime() - ORPHAN_WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString();
  const priorOrphan = await db
    .from("attendance")
    .select("id")
    .is("event_id", null)
    .eq("status", "pending")
    .eq("normalized_student_id", normalized)
    .gte("submitted_at", windowStart)
    .limit(1);
  if (priorOrphan.error) {
    console.error("orphan pre-check failed:", priorOrphan.error.message);
    return { status: "error" };
  }
  if (priorOrphan.data.length > 0) {
    return { status: "duplicate", prior: "pending" };
  }

  const inserted = await db.from("attendance").insert({
    event_id: null,
    member_id: memberId,
    submitted_name: input.fullName,
    submitted_student_id: input.studentId,
    submitted_email: input.email,
    submitted_at: ts,
    status: "pending",
  });
  if (inserted.error) {
    console.error("orphan insert failed:", inserted.error.message);
    return { status: "error" };
  }
  return { status: "pending" };
}

/**
 * §4.2 resolution order: normalized_student_id → lower(email) → create with
 * source='self_checkin'. Returns the member id, or null on unexpected error.
 */
async function resolveMember(
  db: Client,
  input: CheckinInput,
  normalized: string
): Promise<string | null> {
  const lookup = () => findMember(db, input, normalized);

  const found = await lookup();
  if (found !== undefined) return found;

  const created = await db
    .from("members")
    .insert({
      student_id: input.studentId,
      full_name: input.fullName,
      email: input.email,
      source: "self_checkin",
    })
    .select("id")
    .single();

  if (!created.error) return created.data.id;

  if (created.error.code === UNIQUE_VIOLATION) {
    // Race: someone created the same member between our lookup and insert,
    // or the email already belongs to an existing member. Re-run the lookups
    // and use whatever they find.
    const retry = await lookup();
    if (retry !== undefined) return retry;
  }
  console.error("member insert failed:", created.error.message);
  return null;
}

/** Returns member id if matched, undefined if no match, null on error. */
async function findMember(
  db: Client,
  input: CheckinInput,
  normalized: string
): Promise<string | undefined | null> {
  const byId = await db
    .from("members")
    .select("id")
    .eq("normalized_student_id", normalized)
    .maybeSingle();
  if (byId.error) {
    console.error("member lookup by id failed:", byId.error.message);
    return null;
  }
  if (byId.data) return byId.data.id;

  // Email second: contains the common typo — a botched student ID is still
  // recognized by email and linked instead of becoming a duplicate person.
  const byEmail = await db
    .from("members")
    .select("id")
    .ilike("email", escapeIlike(input.email))
    .maybeSingle();
  if (byEmail.error) {
    console.error("member lookup by email failed:", byEmail.error.message);
    return null;
  }
  if (byEmail.data) return byEmail.data.id;

  return undefined;
}

async function duplicateFromIndex(
  db: Client,
  eventId: string,
  normalized: string
): Promise<CheckinResult> {
  const blocking = await db
    .from("attendance")
    .select("status")
    .eq("event_id", eventId)
    .eq("normalized_student_id", normalized)
    .neq("status", "rejected")
    .limit(1);
  if (blocking.error || blocking.data.length === 0) {
    // The row that just blocked us should be readable; if not, still report
    // duplicate — the insert definitely conflicted.
    return { status: "duplicate", prior: "present" };
  }
  return {
    status: "duplicate",
    prior: blocking.data[0].status === "present" ? "present" : "pending",
  };
}

/**
 * Per-IP rate limit (§6), backed by checkin_throttle. Fails open: a throttle
 * bug must never block a real check-in, so any error logs and returns "ok".
 */
export async function checkRateLimit(
  db: Client,
  ipHash: string,
  now: Date
): Promise<"ok" | "limited"> {
  try {
    // Opportunistic prune so the table never needs a scheduled job.
    const pruneBefore = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    await db.from("checkin_throttle").delete().lt("submitted_at", pruneBefore);

    const windowStart = new Date(
      now.getTime() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000
    ).toISOString();
    const recent = await db
      .from("checkin_throttle")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("submitted_at", windowStart);
    if (recent.error) throw recent.error;
    if ((recent.count ?? 0) >= RATE_LIMIT_MAX) return "limited";

    const inserted = await db
      .from("checkin_throttle")
      .insert({ ip_hash: ipHash, submitted_at: now.toISOString() });
    if (inserted.error) throw inserted.error;
    return "ok";
  } catch (e) {
    console.error(
      "rate limit check failed (failing open):",
      e instanceof Error ? e.message : String(e)
    );
    return "ok";
  }
}

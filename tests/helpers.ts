import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

// Shared fixtures for the integration tests. Everything targets the LOCAL
// stack (enforced by tests/global-setup.ts) with the service-role key, since
// attendance/members are deny-all under RLS until Stage 8.
//
// Identities are obviously fake (T3-prefixed IDs, example.edu mailboxes) —
// the repo is public. Events are placed in 2030, far from all seed data
// (which lives in 2026), and each test slot is spaced 7 days apart so no
// 48-hour orphan window can reach a neighbouring test's events.

export function testClient(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.SUPABASE_TEST_URL!,
    process.env.SUPABASE_TEST_SERVICE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// One random base day per run keeps reruns from colliding with leftovers of
// a crashed earlier run; slots within a run never collide with each other.
const RUN_BASE = Date.UTC(2030, 0, 6) + Math.floor(Math.random() * 300) * DAY();
let slotCounter = 0;

function DAY() {
  return 24 * 60 * 60 * 1000;
}

/**
 * A quiet 24-hour region unique to the calling test, 7 days from any other
 * slot. Build event windows inside it with `at(slot, hours)`.
 */
export function claimSlot(): number {
  return RUN_BASE + slotCounter++ * 7 * DAY();
}

/** Timestamp `hours` (fractional ok) after the slot's midnight. */
export function at(slot: number, hours: number): Date {
  return new Date(slot + hours * 60 * 60 * 1000);
}

export type Tracker = {
  eventIds: string[];
  memberIds: string[];
  studentIds: string[];
  /**
   * Attendance rows to delete by id.
   *
   * cleanup() otherwise removes attendance only via `event_id` or `member_id`,
   * which misses a row with **neither** link — and that is the review queue's
   * most important fixture shape, the orphan from someone who is on no roster.
   * Those rows would survive teardown and accumulate in every later run's
   * queries.
   */
  attendanceIds: string[];
};

export function newTracker(): Tracker {
  return { eventIds: [], memberIds: [], studentIds: [], attendanceIds: [] };
}

export async function createTestEvent(
  db: SupabaseClient<Database>,
  track: Tracker,
  opts: {
    starts: Date;
    ends: Date;
    title?: string;
    status?: string;
    points?: number;
    category?: string;
    seriesId?: string;
    checkinOpensAt?: Date;
    checkinClosesAt?: Date;
  }
): Promise<{ id: string; title: string }> {
  const title = opts.title ?? `TEST event ${crypto.randomUUID().slice(0, 8)}`;
  const { data, error } = await db
    .from("events")
    .insert({
      title,
      starts_at: opts.starts.toISOString(),
      ends_at: opts.ends.toISOString(),
      status: opts.status ?? "published",
      points: opts.points,
      category: opts.category,
      series_id: opts.seriesId,
      checkin_opens_at: opts.checkinOpensAt?.toISOString(),
      checkin_closes_at: opts.checkinClosesAt?.toISOString(),
    })
    .select("id, title")
    .single();
  if (error) throw new Error(`fixture event insert failed: ${error.message}`);
  track.eventIds.push(data.id);
  return data;
}

let currentTermSlot = 0;

/**
 * A published event inside whatever `current_term()` currently is.
 *
 * The 2030 fixtures everything else uses cannot exercise `leaderboard` or
 * `member_directory`: both views filter `e.term = current_term()`, and a 2030
 * event's generated term is `"Spring 2030"`, so every aggregate assertion would
 * read zero and pass for the wrong reason. That is worse than no test.
 *
 * Placed a few hours in the past — recent enough to be in the current term,
 * past enough that it never appears on the public upcoming-events list — and
 * then **checked**: the generated `term` is read back and compared against
 * `current_term()`, so a run that straddles Aug 1 or Jan 1 fails loudly instead
 * of silently asserting nothing. The comparison is between two values the
 * database produced; no term string is ever typed here (§4.7).
 */
export async function createCurrentTermEvent(
  db: SupabaseClient<Database>,
  track: Tracker,
  opts: { points?: number; title?: string } = {}
): Promise<{ id: string; title: string; term: string }> {
  // Each call takes its own three-hour slot going backwards, so two of these
  // in one run cannot collide on the published-window exclusion constraint.
  const hoursBack = 3 + currentTermSlot++ * 3;
  const starts = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  const ends = new Date(starts.getTime() + 60 * 60 * 1000);

  const title = opts.title ?? `TEST current ${crypto.randomUUID().slice(0, 8)}`;
  const { data, error } = await db
    .from("events")
    .insert({
      title,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      status: "published",
      points: opts.points ?? 1,
    })
    .select("id, title, term")
    .single();
  if (error) {
    throw new Error(`current-term fixture insert failed: ${error.message}`);
  }
  track.eventIds.push(data.id);

  const { data: currentTerm, error: termError } = await db.rpc("current_term");
  if (termError) {
    throw new Error(`current_term() failed: ${termError.message}`);
  }
  if (data.term !== currentTerm) {
    throw new Error(
      `fixture event landed in ${data.term} but current_term() is ${currentTerm} — ` +
        "a term boundary was crossed, and any leaderboard assertion here would " +
        "have passed at zero. Re-run, or pin app_settings.current_term."
    );
  }

  return { id: data.id, title: data.title, term: data.term! };
}

// --- officer fixtures (Stage 4) -------------------------------------------

const TEST_OFFICER_EMAIL = "test.officer@example.edu";
let officerIdCache: string | null = null;

/**
 * A stable officer to act as `actor_id` on audit rows.
 *
 * **Created once and never deleted, deliberately.** admin_audit rows cannot be
 * removed (a BEFORE DELETE trigger raises P0001) and the service-role client
 * cannot disable that trigger, since it does not own the table. admin_audit
 * .actor_id references auth.users with no ON DELETE, so an officer that has
 * written any audit row can never be deleted either. Rather than fight that,
 * reuse one officer across the whole suite: the local stack is disposable via
 * `supabase db reset`, and global-setup.ts refuses to run against anything but
 * a local URL, so this can never accumulate anywhere that matters.
 */
export async function getTestOfficer(
  db: SupabaseClient<Database>
): Promise<string> {
  if (officerIdCache) return officerIdCache;

  const { data, error } = await db.auth.admin.createUser({
    email: TEST_OFFICER_EMAIL,
    password: `test-only-${crypto.randomUUID()}`,
    email_confirm: true,
  });

  let userId: string;
  if (error) {
    // Vitest runs test files in parallel workers, so two can race to create
    // the same email. Same retry shape as resolveCheckin's member race.
    if (!/already been registered|email_exists/i.test(error.message)) {
      throw new Error(`fixture officer create failed: ${error.message}`);
    }
    const found = await findOfficerId(db);
    if (!found) throw new Error("fixture officer exists but was not found");
    userId = found;
  } else {
    userId = data.user.id;
  }

  const { error: profileError } = await db
    .from("admin_profiles")
    .upsert(
      { user_id: userId, display_name: "Test Officer", role: "officer" },
      { onConflict: "user_id" }
    );
  if (profileError) {
    throw new Error(`fixture officer profile failed: ${profileError.message}`);
  }

  officerIdCache = userId;
  return userId;
}

async function findOfficerId(
  db: SupabaseClient<Database>
): Promise<string | null> {
  const { data, error } = await db.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) throw new Error(`fixture officer lookup failed: ${error.message}`);
  return (
    data.users.find((u) => u.email?.toLowerCase() === TEST_OFFICER_EMAIL)?.id ??
    null
  );
}

/** Audit rows written for one entity. Assertions only — cleanup() cannot
 * remove them, and does not try. */
export async function countAuditRows(
  db: SupabaseClient<Database>,
  entityType: string,
  entityId: string
): Promise<number> {
  const { count, error } = await db
    .from("admin_audit")
    .select("id", { count: "exact", head: true })
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);
  if (error) throw new Error(`audit count failed: ${error.message}`);
  return count ?? 0;
}

export async function latestAuditRow(
  db: SupabaseClient<Database>,
  entityType: string,
  entityId: string
) {
  const { data, error } = await db
    .from("admin_audit")
    .select("action, actor_id, before, after, note")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("acted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`audit read failed: ${error.message}`);
  return data;
}

let idCounter = 0;

/** Obviously-fake identity, unique per call. */
export function testIdentity(): {
  fullName: string;
  studentId: string;
  email: string;
} {
  const n = `${Date.now() % 1_000_000}${idCounter++}`;
  return {
    fullName: `Test Person ${n}`,
    studentId: `T3-${n}`,
    email: `test.person.${n}@example.edu`,
  };
}

export async function createTestMember(
  db: SupabaseClient<Database>,
  track: Tracker,
  identity: { fullName: string; studentId: string; email: string },
  // The directory tests need members that seed rows cannot be confused with,
  // and `joined_at` is the only column phase 1 can filter on that the seed does
  // not already populate across a wide range. Everything else defaults.
  opts: { joinedAt?: Date; active?: boolean; source?: string } = {}
): Promise<string> {
  const { data, error } = await db
    .from("members")
    .insert({
      full_name: identity.fullName,
      student_id: identity.studentId,
      email: identity.email,
      joined_at: opts.joinedAt?.toISOString(),
      active: opts.active,
      source: opts.source,
    })
    .select("id")
    .single();
  if (error) throw new Error(`fixture member insert failed: ${error.message}`);
  track.memberIds.push(data.id);
  return data.id;
}

/** Best-effort teardown: attendance first (FKs), then members, then events. */
export async function cleanup(
  db: SupabaseClient<Database>,
  track: Tracker
): Promise<void> {
  // By id first: a row with neither link is reachable no other way.
  if (track.attendanceIds.length > 0) {
    await db.from("attendance").delete().in("id", track.attendanceIds);
  }
  if (track.eventIds.length > 0) {
    await db.from("attendance").delete().in("event_id", track.eventIds);
  }
  if (track.memberIds.length > 0) {
    await db.from("attendance").delete().in("member_id", track.memberIds);
    await db.from("members").delete().in("id", track.memberIds);
  }
  if (track.eventIds.length > 0) {
    await db.from("events").delete().in("id", track.eventIds);
  }
}

/**
 * An attendance row that cleanup() can always find, whatever its links.
 *
 * Use this rather than a bare insert for anything the review-queue tests
 * create — an unlinked orphan is invisible to the event_id/member_id passes.
 */
export async function createTestAttendance(
  db: SupabaseClient<Database>,
  track: Tracker,
  row: {
    eventId?: string | null;
    memberId?: string | null;
    submittedName: string;
    submittedStudentId: string;
    submittedEmail: string;
    submittedAt: Date;
    status?: string;
    source?: string;
  }
): Promise<{ id: string; updated_at: string }> {
  const { data, error } = await db
    .from("attendance")
    .insert({
      event_id: row.eventId ?? null,
      member_id: row.memberId ?? null,
      submitted_name: row.submittedName,
      submitted_student_id: row.submittedStudentId,
      submitted_email: row.submittedEmail,
      submitted_at: row.submittedAt.toISOString(),
      status: row.status ?? "pending",
      source: row.source ?? "self_checkin",
    })
    .select("id, updated_at")
    .single();
  if (error) throw new Error(`fixture attendance insert failed: ${error.message}`);
  track.attendanceIds.push(data.id);
  return data;
}

/**
 * A point adjustment that teardown will actually remove.
 *
 * cleanup() has no `point_adjustments` pass and does not need one:
 * `member_id` is `on delete cascade`, so deleting a tracked member takes its
 * adjustments with it. That only holds if every adjustment points at a tracked
 * member — one written against a **seed** member survives teardown forever and
 * then shows up in the leaderboard, the directory, and the ledger of every
 * later run, quietly shifting totals that other tests assert on. So the check
 * below is a hard throw rather than a comment: the failure it prevents is one
 * that surfaces in a different file, days later.
 */
export async function createTestAdjustment(
  db: SupabaseClient<Database>,
  track: Tracker,
  row: {
    memberId: string;
    points: number;
    awardedBy: string;
    reason?: string;
    category?: string;
    eventId?: string | null;
  }
): Promise<{ id: string; term: string }> {
  if (!track.memberIds.includes(row.memberId)) {
    throw new Error(
      "point_adjustments are cleaned up only via the member cascade, so this " +
        "must target a tracked member (createTestMember). Writing one against " +
        "a seed member leaves it behind permanently."
    );
  }

  const { data, error } = await db
    .from("point_adjustments")
    .insert({
      member_id: row.memberId,
      points: row.points,
      reason: row.reason ?? "TEST adjustment",
      category: row.category ?? "other",
      event_id: row.eventId ?? null,
      awarded_by: row.awardedBy,
      // No `term`: it defaults to current_term() and is read back (§4.7).
    })
    .select("id, term")
    .single();
  if (error) {
    throw new Error(`fixture adjustment insert failed: ${error.message}`);
  }
  return data;
}

/**
 * Members created *by the code under test* (self-registration) aren't in the
 * tracker at creation time; call this after asserting to adopt them so
 * cleanup removes them too.
 */
export async function adoptMemberByNormalizedId(
  db: SupabaseClient<Database>,
  track: Tracker,
  normalized: string
): Promise<void> {
  const { data } = await db
    .from("members")
    .select("id")
    .eq("normalized_student_id", normalized)
    .maybeSingle();
  if (data) track.memberIds.push(data.id);
}

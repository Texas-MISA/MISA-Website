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
};

export function newTracker(): Tracker {
  return { eventIds: [], memberIds: [], studentIds: [] };
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
  identity: { fullName: string; studentId: string; email: string }
): Promise<string> {
  const { data, error } = await db
    .from("members")
    .insert({
      full_name: identity.fullName,
      student_id: identity.studentId,
      email: identity.email,
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

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
//
// Raised from 30 when the first-time confirmation flow landed. A first-timer
// now spends two slots (submit, then confirm), and the `unmatched` re-prompt
// actively invites retries — so at a recruiting event, where everyone is new
// and everyone shares the venue's IP, 30 would have let barely 15 people
// through. Sized for the room, not for the request count.
//
// ⚠️ Which means the room is the thing to re-check when attendance grows. At
// 90 the ceiling is ~90 returning members or ~45 first-timers per 10 minutes
// behind one address; a 150-person event turns the rest away with a throttle
// message. §2.2's capacity check has the arithmetic. Raise this alongside
// event size — it is a room capacity, not a security tuning knob, and the
// honeypot plus the 48-hour window are what actually bound abuse.
export const RATE_LIMIT_MAX = 90;
export const RATE_LIMIT_WINDOW_MINUTES = 10;

/**
 * JS mirror of the SQL normalization on members.normalized_eid and
 * attendance.normalized_eid:
 *
 *   lower(regexp_replace(x, '\s|-', '', 'g'))
 *
 * The two must strip identically — tests/normalization.test.ts asserts the
 * generated column equals this function for pathological inputs.
 *
 * Folds to LOWER, not upper. EIDs are conventionally written lowercase, and
 * the review screen renders the normalized form back at the officer ("matches
 * as ...") — uppercasing it shouted ABC1234 at someone who typed abc1234.
 *
 * The whitespace and hyphen stripping stays even though a real EID contains
 * neither. It no longer models the four roster formats it was written for, but
 * people still paste from badges and spreadsheets, and dropping it would
 * rewrite every stored value to buy nothing.
 */
export function normalizeEid(raw: string): string {
  return raw.toLowerCase().replace(/[\s-]/g, "");
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
  eid: string;
  email: string;
  /**
   * The member's own claim that they are new — the one bit of information the
   * system cannot derive. A hint, never an instruction: ticking it when you
   * already exist links you to yourself and must never create a duplicate.
   */
  declaredNew: boolean;
  /** Second pass: the member has seen their details on the review screen. */
  confirmed: boolean;
};

export type CheckinResult =
  | { status: "present"; eventTitle: string }
  | { status: "pending" }
  | { status: "duplicate"; prior: "present" | "pending" }
  | { status: "refused" }
  // Nothing written. No roster match and the member did not claim to be new,
  // so this is a typo rather than a new person — re-prompt instead of quietly
  // creating a duplicate member (see docs/attend-confirmation-flow.md).
  | { status: "unmatched" }
  // Nothing written yet. `existing` says only whether the roster already knows
  // this person — never the matched member's name, email, or ID. That would
  // turn the accepted "is this ID on the roster" oracle into "here is the
  // human behind it", which §6 does not accept.
  | { status: "needs_confirmation"; existing: boolean }
  | { status: "error" };

type Client = SupabaseClient<Database>;

/**
 * Explicit shape rather than `string | undefined | null`. The bare tri-state
 * invited `if (!memberId)`, and a single such slip would report a transient
 * Supabase error as `unmatched` — telling a whole room "we don't have that
 * info on file" and sending them away with no attendance and no trace, which
 * is exactly the failure this system is built to make impossible.
 */
type MemberLookup =
  | { kind: "found"; id: string }
  | { kind: "missing" }
  | { kind: "error" };

const UNIQUE_VIOLATION = "23505";

/**
 * Resolve one submission. Order (§4.2/§4.3):
 *
 *   1. open_event_at(now) — the window semantics live entirely in SQL, so the
 *      half-open bounds cannot drift between the constraint, the function,
 *      and the app (the CLAUDE.md three-places invariant).
 *   2. No open event and nothing within ORPHAN_WINDOW_HOURS → refused, and
 *      nothing is written.
 *   3. Member *lookup* — normalized_eid, then lower(email). Creating a
 *      member is no longer part of resolution; it happens only behind an
 *      explicit confirmation (§4.2, docs/attend-confirmation-flow.md). A
 *      lookup miss is `unmatched` and writes nothing.
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
  const normalized = normalizeEid(input.eid);

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
  //
  //    Refusing here, before any member lookup, also closes the membership
  //    oracle outside event windows: someone probing a EID off-season
  //    learns only that there is no event on.
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

  // 3. Member lookup: ID, then email. No create — see below.
  const lookup = await findMember(db, input, normalized);
  if (lookup.kind === "error") return { status: "error" };

  let memberId: string;
  if (!input.declaredNew) {
    // The member says they've been here before. If the roster disagrees, the
    // likeliest explanation is a typo in both fields, not a new person — so
    // re-prompt and write nothing rather than manufacture a duplicate member
    // that no tool can merge back. The cost is real and accepted: someone who
    // never gets their details right leaves no trace, and an officer adds
    // them at /admin/attendance/new instead.
    if (lookup.kind === "missing") return { status: "unmatched" };
    memberId = lookup.id;
  } else if (!input.confirmed) {
    // Claimed first-timer, first pass: always confirm, matched or not. Not
    // worth optimizing away for the already-recorded case — returning
    // `duplicate` here would disclose that this person attended this specific
    // event, which is strictly more than the roster-membership oracle §6
    // accepted.
    return { status: "needs_confirmation", existing: lookup.kind === "found" };
  } else if (lookup.kind === "found") {
    // Ticking the box when you already exist links you to yourself.
    memberId = lookup.id;
  } else {
    const created = await createMember(db, input, normalized);
    if (created === null) return { status: "error" };
    memberId = created;
  }

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
      submitted_eid: input.eid,
      submitted_email: input.email,
      submitted_at: ts,
      // Both links resolved, so present — satisfies present_requires_resolution
      // by construction.
      status: "present",
    });
    if (inserted.error) {
      if (inserted.error.code === UNIQUE_VIOLATION) {
        // attendance_one_per_event: same (event_id, normalized_eid)
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
    .eq("normalized_eid", normalized)
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
    submitted_eid: input.eid,
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
 * Create a self-registered member. Reached only from the confirmed path —
 * `declaredNew && confirmed` with the lookup still finding nothing — so this
 * is the single place in the whole application that inserts a `members` row
 * on an unauthenticated request.
 *
 * The member is `active` immediately: no approval step, no audit row (§4.2).
 * Returns the member id, or null on unexpected error.
 *
 * Note what `confirmed` is and is not. It stops honest typos from becoming
 * roster rows; it is not a security control. A scripted POST carrying
 * step=confirm creates a member in one request without ever rendering the
 * review screen — correct by design, since the server re-derives everything
 * from scratch rather than trusting the previewed payload. The per-IP
 * throttle remains the only abuse control here.
 */
async function createMember(
  db: Client,
  input: CheckinInput,
  normalized: string
): Promise<string | null> {
  const created = await db
    .from("members")
    .insert({
      eid: input.eid,
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
    const retry = await findMember(db, input, normalized);
    if (retry.kind === "found") return retry.id;
  }
  console.error("member insert failed:", created.error.message);
  return null;
}

/** §4.2 lookup order: normalized_eid, then lower(email). Never writes. */
async function findMember(
  db: Client,
  input: CheckinInput,
  normalized: string
): Promise<MemberLookup> {
  const byId = await db
    .from("members")
    .select("id")
    .eq("normalized_eid", normalized)
    .maybeSingle();
  if (byId.error) {
    console.error("member lookup by id failed:", byId.error.message);
    return { kind: "error" };
  }
  if (byId.data) return { kind: "found", id: byId.data.id };

  // Email second: contains the common typo — a botched EID is still
  // recognized by email and linked instead of becoming a duplicate person.
  // This fallback is what keeps `unmatched` rare, so it has to run before any
  // miss is reported.
  const byEmail = await db
    .from("members")
    .select("id")
    .ilike("email", escapeIlike(input.email))
    .maybeSingle();
  if (byEmail.error) {
    console.error("member lookup by email failed:", byEmail.error.message);
    return { kind: "error" };
  }
  if (byEmail.data) return { kind: "found", id: byEmail.data.id };

  return { kind: "missing" };
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
    .eq("normalized_eid", normalized)
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
  now: Date,
  // Defaults to the check-in ceiling so /attend's call is unchanged. /lookup
  // passes its own, against its own bucket (see lib/request-ip.ts): sharing one
  // budget would let standings lookups crowd out check-ins, and RATE_LIMIT_MAX
  // is sized for the room rather than for the request count.
  max: number = RATE_LIMIT_MAX
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
    if ((recent.count ?? 0) >= max) return "limited";

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

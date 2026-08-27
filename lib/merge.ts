// Merging duplicate members (§4.2, §7 Stage 6 phase 8). Pure — no next/*
// imports, no supabase-js, no clock reads — so Vitest calls every export
// directly, the same contract as lib/attendance.ts, lib/dues.ts and
// lib/member-import.ts. Anything request-shaped belongs in
// app/actions/member-merge.ts.
//
// ---------------------------------------------------------------------------
// 🔓 The one thing this module exists to prevent, and the database will NOT
// catch it
// ---------------------------------------------------------------------------
//
// `tasks.md` and the architecture doc both said a merge "can hit
// attendance_one_per_event when both identities attended the same event". That
// is wrong, and the correction is the whole design. The index is
//
//     create unique index attendance_one_per_event
//       on public.attendance (event_id, normalized_eid)
//       where event_id is not null and status <> 'rejected';
//
// keyed on `normalized_eid` — the generated fold of the SUBMITTED eid — and not
// on `member_id`. Two identities have different EIDs by construction, so
// repointing `member_id` never touches an indexed column and the guard is
// structurally unreachable from a merge.
//
// So the failure is silent rather than loud. The survivor ends up holding two
// `present` rows for one event, and both `leaderboard` and `member_directory`
// aggregate per present row — `count(*) as events_attended`,
// `sum(e.points) as attendance_points`. The event's points are counted twice,
// `events_attended` can exceed `events_possible`, and `attendance_rate` reads
// above 100%. Nothing errors, anywhere.
//
// Detecting the collision is therefore this module's job, and resolving it is
// the doc's own answer: keep one row, REJECT the other. A rejected row leaves
// the partial unique index and stops counting toward points, so the double
// count is prevented rather than merely reported.

import {
  MIN_SUGGESTION_SCORE,
  scoreMemberMatch,
  type MatchReason,
  type MemberCandidate,
} from "@/lib/attendance";
import { fieldValue, type FieldDefinition } from "@/lib/members";

// ---------------------------------------------------------------------------
// The two members
// ---------------------------------------------------------------------------

/**
 * What a merge needs to know about a member — structurally typed, so this
 * module never imports the generated database types and a test can hand it a
 * literal.
 */
export type MergeMember = {
  id: string;
  fullName: string;
  email: string;
  eid: string;
  normalizedEid: string;
  /** ISO, as PostgREST returns it. Compared as strings: ISO-8601 with the same
   * offset sorts lexicographically, and both come from the same column. */
  joinedAt: string;
  notes: string | null;
  /** Raw jsonb. Read it with `fieldValue`, never by indexing. */
  customFields: unknown;
};

/** One of the loser's (or the survivor's) attendance rows. */
export type MergeAttendance = {
  id: string;
  eventId: string | null;
  status: string;
  /** Pre-formatted on the server, per the hydration rule. Empty for an orphan. */
  eventLabel: string;
};

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

export type AttendanceOutcome =
  /** Repointed to the survivor untouched. */
  | { kind: "move" }
  /**
   * The survivor already has a non-rejected row for this event.
   *
   * 🔓 The database cannot see this — see the header. One of the two rows must
   * be rejected or the survivor is credited twice for one event.
   */
  | { kind: "collides"; survivorAttendanceId: string };

export type PlannedAttendance = {
  id: string;
  eventId: string | null;
  status: string;
  eventLabel: string;
  outcome: AttendanceOutcome;
};

export type PlannedField = {
  key: string;
  label: string;
  survivorValue: string | null;
  loserValue: string | null;
  /** Both hold a value and they differ — an officer's call, not an overwrite. */
  conflict: boolean;
};

export type MergePlan = {
  /** Every one of the loser's attendance rows, in the order given. */
  attendance: PlannedAttendance[];
  /** Just the colliding ones, for the form to iterate. */
  collisions: PlannedAttendance[];
  /** Every custom field either side answers. */
  fields: PlannedField[];
  /** Of those, the ones needing a decision. */
  conflicts: PlannedField[];
  /** What the survivor's notes become if nothing is chosen otherwise. */
  notes: string | null;
  /** The earlier of the two `joined_at` values. */
  joinedAt: string;
};

export type MergePlanResult =
  | { kind: "ok"; plan: MergePlan }
  /** The same member on both sides. Refused here rather than by the caller, so
   * every caller inherits the check. */
  | { kind: "same_member" };

/**
 * Work out what merging `loser` into `survivor` would do.
 *
 * Shaped after `planBulkAssign` in lib/attendance.ts: it takes the rows that
 * already exist and returns a plan, deciding nothing about the write. That is
 * what lets the preview and the commit share one derivation, and what lets a
 * test drive the whole decision surface with no database.
 */
export function planMerge({
  survivor,
  loser,
  survivorAttendance,
  loserAttendance,
  definitions,
}: {
  survivor: MergeMember;
  loser: MergeMember;
  /** The survivor's rows, needed only to find collisions. */
  survivorAttendance: readonly MergeAttendance[];
  /** Every row the loser holds — pending and rejected included. */
  loserAttendance: readonly MergeAttendance[];
  definitions: readonly FieldDefinition[];
}): MergePlanResult {
  if (survivor.id === loser.id) return { kind: "same_member" };

  // Which events the survivor already occupies. Rejected rows are excluded for
  // the same reason the partial index excludes them: a rejected row counts for
  // nothing, so it cannot be double-counted and it is not in the way.
  const survivorByEvent = new Map<string, string>();
  for (const row of survivorAttendance) {
    if (row.eventId === null || row.status === "rejected") continue;
    // First wins. The survivor should never hold two non-rejected rows for one
    // event — the index forbids it for a single EID — but a previous merge
    // could in principle have left one, and picking deterministically beats
    // throwing.
    if (!survivorByEvent.has(row.eventId)) {
      survivorByEvent.set(row.eventId, row.id);
    }
  }

  const attendance: PlannedAttendance[] = loserAttendance.map((row) => {
    // An orphan has no event to collide over, and a rejected row counts for
    // nothing — both move as history.
    if (row.eventId === null || row.status === "rejected") {
      return { ...row, outcome: { kind: "move" } as const };
    }
    const survivorAttendanceId = survivorByEvent.get(row.eventId);
    return {
      ...row,
      outcome:
        survivorAttendanceId === undefined
          ? ({ kind: "move" } as const)
          : ({ kind: "collides", survivorAttendanceId } as const),
    };
  });

  const fields: PlannedField[] = [];
  for (const definition of definitions) {
    const survivorValue = fieldValue(survivor.customFields, definition.key);
    const loserValue = fieldValue(loser.customFields, definition.key);
    // A field neither answers is not part of this merge.
    if (survivorValue === null && loserValue === null) continue;
    fields.push({
      key: definition.key,
      label: definition.label,
      survivorValue,
      loserValue,
      // Only a genuine disagreement is a decision. A value only the loser holds
      // transfers on its own — that is the whole point of merging — and two
      // identical values are not a conflict.
      conflict:
        survivorValue !== null &&
        loserValue !== null &&
        survivorValue !== loserValue,
    });
  }

  return {
    kind: "ok",
    plan: {
      attendance,
      collisions: attendance.filter((row) => row.outcome.kind === "collides"),
      fields,
      conflicts: fields.filter((field) => field.conflict),
      notes: mergeNotes(survivor.notes, loser.notes),
      // The earlier of the two: the person joined when they first joined, and
      // the duplicate row is an artefact of a typo rather than a second joining.
      joinedAt:
        loser.joinedAt < survivor.joinedAt ? loser.joinedAt : survivor.joinedAt,
    },
  };
}

/**
 * The survivor's notes after a merge.
 *
 * Concatenated, never overwritten. Officer notes are the one free-text field on
 * a member and the only place a "why" is ever recorded; dropping the loser's
 * because the survivor happens to have some of their own would destroy exactly
 * the context a merge makes valuable. Deduplicated when the two are identical,
 * which happens when someone wrote the same note on both halves of a duplicate.
 */
export function mergeNotes(
  survivorNotes: string | null,
  loserNotes: string | null
): string | null {
  const a = (survivorNotes ?? "").trim();
  const b = (loserNotes ?? "").trim();
  if (a === "" && b === "") return null;
  if (a === "") return b;
  if (b === "" || a === b) return a;
  return `${a}\n\n${b}`;
}

/**
 * The `custom_fields` object the survivor ends up with.
 *
 * `choices` carries the officer's answer for each conflicting key. A key only
 * the loser holds transfers; a key only the survivor holds stays; a conflict
 * takes the choice, falling back to the survivor when the form did not carry
 * one — which is the safe direction, because it changes nothing.
 *
 * ⚠️ Built as a whole object with **no empty-string values**, matching
 * `setFieldValue`: an empty string would make "cleared" and "never answered"
 * two states that render identically and sort differently.
 */
export function mergedCustomFields(
  plan: MergePlan,
  choices: Record<string, string>
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const field of plan.fields) {
    const chosen = field.conflict
      ? (choices[field.key] ?? field.survivorValue)
      : (field.survivorValue ?? field.loserValue);
    if (chosen !== null && chosen !== undefined && chosen !== "") {
      next[field.key] = chosen;
    }
  }
  return next;
}

/**
 * Is `value` one of the two things the officer may pick for this field?
 *
 * The commit re-derives the plan and re-checks every choice against it rather
 * than trusting the POST, the same discipline `savePayment` applies to
 * `start_term`. Without it the form is a way to write an arbitrary string into
 * `custom_fields`, bypassing the option list `setMemberFieldValue` enforces.
 */
export function isOfferedChoice(field: PlannedField, value: string): boolean {
  return value === field.survivorValue || value === field.loserValue;
}

// ---------------------------------------------------------------------------
// Finding likely duplicates
// ---------------------------------------------------------------------------

/**
 * 🪤 The submission ranker's calibration does NOT carry over to
 * member-vs-member, and these two rules are the correction.
 *
 * `scoreMemberMatch` was weighted for a check-in submission against the roster,
 * where the two decisive keys are worth +100 each. Between two **members** both
 * are structurally impossible: `members_email_lower` and `members_normalized_eid`
 * are unique indexes, so `email_exact` and `id_exact` can never fire. Only the
 * corroborating signals remain, and `MIN_SUGGESTION_SCORE` (25) is no longer
 * "corroboration required" against them — it is cleared by one shared surname.
 *
 * 📌 **Recalibrated empirically, as phase 2's note requires — but NOT against
 * the seed, and that is worth knowing before anyone tries.** The seeded roster
 * produces **zero** member-vs-member pairs scoring 15 or above (measured, 32
 * members, all 496 pairs): it is a clean roster of deliberately distinct people,
 * so it contains no duplicate to calibrate against and never will. The seed's
 * near-miss cluster (`mp8570` / `pn8571` / `ro8574`) sits at distance 2 from a
 * *submission* fixture, not from another member.
 *
 * So the shapes were constructed and measured instead. Real scores:
 *
 *   | score | axes | shape                                    |          |
 *   |-------|------|------------------------------------------|----------|
 *   |   110 |    2 | same name, same email local, new domain  | DUPLICATE|
 *   |    95 |    2 | same name, EID one character out         | DUPLICATE|
 *   |    90 |    2 | name typo AND EID typo                   | DUPLICATE|
 *   |    65 |    2 | same name, EID two characters out        | DUPLICATE|
 *   |    50 |    2 | shared surname + EID two out             | different|
 *   |    50 |    1 | same name, nothing else in common        | different|
 *   |    45 |    1 | same initials, adjacent EID              | different|
 *   |    35 |    1 | siblings — shared surname                | different|
 *   |    15 |    1 | shared first name only                   | different|
 *
 * The gap is 50 → 65, so **60** sits in it with room either side. The axis
 * count is the second rule: a duplicate is one person entered twice, so at
 * least two of {name, email, EID} should be close, and the only single-axis
 * signal that can reach 60 on its own is a shared email local part — which,
 * with a different name attached, is two people who both go by "ada".
 *
 * ⚠️ **"Same name, nothing else" is deliberately NOT offered** (50, one axis).
 * Two students can share a name, and the consequence of acting on a wrong
 * suggestion here is a deleted member row. The picker is still there for the
 * officer who knows better — which is exactly why suggestions sit beside a
 * picker rather than replacing one.
 *
 * ⚠️ An empty list stays a valid answer and nothing is ever preselected.
 */
export const MIN_DUPLICATE_SCORE = 60;

/** How many distinct identity axes must agree. See MIN_DUPLICATE_SCORE. */
export const MIN_DUPLICATE_AXES = 2;

/** How many candidates the merge form offers. Shorter than the resolution
 * form's five: this is a destructive action and a long list invites picking. */
export const MAX_DUPLICATE_SUGGESTIONS = 4;

/** Which identity a match reason speaks to. */
function matchAxis(reason: MatchReason): "name" | "email" | "eid" | null {
  switch (reason.kind) {
    case "email_exact":
    case "email_local":
      return "email";
    case "id_exact":
    case "id_near_miss":
      return "eid";
    case "name_exact":
    case "name_tokens":
    case "name_near":
      return "name";
  }
}

/** How many of {name, email, EID} agree at all. */
export function matchAxisCount(reasons: readonly MatchReason[]): number {
  const axes = new Set<string>();
  for (const reason of reasons) {
    const axis = matchAxis(reason);
    if (axis !== null) axes.add(axis);
  }
  return axes.size;
}

export type DuplicateSuggestion = {
  member: MemberCandidate;
  score: number;
  reasons: MatchReason[];
};

/**
 * Members that look like duplicates of `member`.
 *
 * A new **caller** of `scoreMemberMatch`, never a second ranker — the precedent
 * is `rankPaymentSuggestions` in lib/dues.ts, and the reason is that a second
 * implementation is a second thing to recalibrate. A member is structurally a
 * `SubmissionIdentity` already.
 *
 * The member themselves is excluded, obviously, and so is anybody clearing
 * neither `MIN_DUPLICATE_SCORE` nor `MIN_DUPLICATE_AXES` — see the note there
 * for why neither is `MIN_SUGGESTION_SCORE`.
 */
export function rankDuplicateCandidates(
  member: MergeMember,
  roster: readonly MemberCandidate[],
  limit = MAX_DUPLICATE_SUGGESTIONS
): DuplicateSuggestion[] {
  const identity = {
    fullName: member.fullName,
    email: member.email,
    eid: member.eid,
    normalizedEid: member.normalizedEid,
  };

  return roster
    .filter((candidate) => candidate.id !== member.id)
    .map((candidate) => ({ member: candidate, ...scoreMemberMatch(identity, candidate) }))
    .filter(
      (entry) =>
        entry.score >= MIN_DUPLICATE_SCORE &&
        matchAxisCount(entry.reasons) >= MIN_DUPLICATE_AXES
    )
    .sort(
      (a, b) =>
        b.score - a.score || a.member.fullName.localeCompare(b.member.fullName)
    )
    .slice(0, limit);
}

/** The floor this module deliberately does not use, re-exported so a reader
 * comparing the two does not have to go looking. */
export { MIN_SUGGESTION_SCORE };

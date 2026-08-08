import { z } from "zod";

import { MAX_BULK_ASSIGN } from "@/lib/attendance";
import { normalizeEid } from "@/lib/checkin";
import { MAX_TERMS_COVERED, termIndex } from "@/lib/dues";
import {
  EVENT_CATEGORIES,
  EVENT_STATUSES,
  MAX_SERIES_EVENTS,
} from "@/lib/events";
import {
  FIELD_KEY_PATTERN,
  MAX_FIELD_LABEL_LENGTH,
  MAX_FIELD_OPTIONS,
  MAX_OPTION_LENGTH,
  RESERVED_FIELD_KEYS,
} from "@/lib/members";
import {
  MAX_GRANT_MEMBERS,
  MAX_POINTS_PER_GRANT,
  POINT_CATEGORIES,
} from "@/lib/points";
import { MAX_PRESET_NAME, MAX_PRESET_QUERY } from "@/lib/presets";

// Zod schemas (§10). App-side validation is the only email-format check in
// the system — the attendance table requires submitted_email to be non-null
// but deliberately does not validate its shape.

export const checkinSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name is too long"),
  eid: z
    .string()
    .trim()
    .min(1, "EID is required")
    .max(32, "EID is too long")
    // A raw EID of "-" or "  " passes the database's not-blank check but
    // normalizes to nothing, which would collide every such submission into
    // one phantom identity. Three normalized characters, because the shortest
    // real UT EIDs are three, and a two-character floor is what made the old
    // substring-containment rule dangerous.
    .refine((v) => normalizeEid(v).length >= 3, "Enter a valid EID"),
  email: z
    .string()
    .trim()
    .max(254, "Email is too long")
    .pipe(z.email("Enter a valid email address")),
});

export type CheckinFields = z.infer<typeof checkinSchema>;

// Officer sign-in (§5). Deliberately no minimum length on the password: the
// login form is not where a password policy belongs — enforcing it here leaks
// the policy to anyone probing the form and rejects any account created before
// the current rules. The Auth server is the authority on what a valid
// credential is; this only screens out empty submissions.
export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .max(254, "Email is too long")
    .pipe(z.email("Enter a valid email address")),
  password: z.string().min(1, "Password is required"),
});

export type SignInFields = z.infer<typeof signInSchema>;

// Event create/edit (§4.1, §4.6).
//
// Dates and times arrive as separate <input type="date"> and
// <input type="time"> values: native, dependency-free, and crucially
// zone-free. Both submit plain civil strings, so nothing is ambiguous in
// transit and the server unambiguously reads them as Central (§4.7).
// datetime-local would work for a single event but splits badly across the
// series form, where one time applies to many dates.

const civilDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const civilTime = z.string().regex(/^\d{2}:\d{2}$/, "Pick a time");

/** "" from an untouched optional text input means null, not empty string —
 * the database's not-blank checks reject '' but accept NULL. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long`)
    .transform((v) => (v === "" ? null : v));

const eventBase = {
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title is too long"),
  description: optionalText(2000, "Description"),
  location: optionalText(200, "Location"),
  startTime: civilTime,
  endTime: civilTime,
  // Offsets rather than absolute times, so the check-in window follows the
  // event when its times move (see deriveCheckinWindow).
  openEarlyMinutes: z.coerce.number().int().min(0).max(1440),
  closeLateMinutes: z.coerce.number().int().min(0).max(1440),
  // 0 is allowed: an event can be worth attending without being worth points.
  points: z.coerce.number().int().min(0, "Points cannot be negative").max(100),
  category: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .refine(
      (v) => v === null || (EVENT_CATEGORIES as readonly string[]).includes(v),
      "Unknown category"
    ),
  status: z.enum(EVENT_STATUSES),
};

// The database's valid_window check is the real backstop; this exists so the
// officer gets a field-level message instead of a constraint violation.
const endAfterStart = (data: { startTime: string; endTime: string }) =>
  data.endTime > data.startTime;

export const eventSchema = z
  .object({ ...eventBase, date: civilDate })
  .refine(endAfterStart, {
    message: "End time must be after the start time",
    path: ["endTime"],
  });

export type EventFields = z.infer<typeof eventSchema>;

export const seriesSchema = z
  .object({
    ...eventBase,
    date: civilDate,
    untilDate: civilDate,
    weekdays: z
      .array(z.coerce.number().int().min(0).max(6))
      .min(1, "Pick at least one weekday"),
  })
  .refine(endAfterStart, {
    message: "End time must be after the start time",
    path: ["endTime"],
  })
  .refine((data) => data.untilDate >= data.date, {
    message: "The end date must not be before the first date",
    path: ["untilDate"],
  })
  .refine(
    (data) => {
      // Cheap upper bound on the occurrence count, so a typo'd until-date is
      // rejected with a readable message rather than silently truncated by
      // expandSeries' cap.
      const days =
        (Date.parse(`${data.untilDate}T00:00:00Z`) -
          Date.parse(`${data.date}T00:00:00Z`)) /
        86_400_000;
      return Math.ceil(((days + 1) / 7) * data.weekdays.length) <= MAX_SERIES_EVENTS;
    },
    {
      message: `That would create more than ${MAX_SERIES_EVENTS} events — shorten the date range`,
      path: ["untilDate"],
    }
  );

export type SeriesFields = z.infer<typeof seriesSchema>;

// Attendance review and point adjustments (§4.2, §7 Stage 5).
//
// Each schema below deliberately shadows a database constraint rather than
// trusting it: the constraint is the guarantee, this is what turns a violation
// into a field-level message the officer can act on. Same relationship as
// endAfterStart and valid_window above.

/** An empty <select> means "not set", which is NULL — the FK columns are
 * nullable and a pending row is precisely one that hasn't got them yet. */
const optionalUuid = (label: string) =>
  z
    .union([z.literal(""), z.uuid(`Pick a valid ${label}`)])
    .transform((v) => (v === "" ? null : v));

const resolutionNote = optionalText(1000, "Note");

export const attendanceEditSchema = z.object({
  // The submitted_* fields stay editable — an officer fixing an obvious typo
  // is the point of the screen — so they carry the same rules the public form
  // applied, including the normalization floor that stops "-" collapsing every
  // such submission into one phantom identity.
  submittedName: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name is too long"),
  submittedEid: z
    .string()
    .trim()
    .min(1, "EID is required")
    .max(32, "EID is too long")
    .refine((v) => normalizeEid(v).length >= 3, "Enter a valid EID"),
  submittedEmail: z
    .string()
    .trim()
    .max(254, "Email is too long")
    .pipe(z.email("Enter a valid email address")),
  eventId: optionalUuid("event"),
  memberId: optionalUuid("member"),
  resolutionNote,
});

export type AttendanceEditFields = z.infer<typeof attendanceEditSchema>;

/** Rejecting prompts for a note but does not require one (§7 Stage 5). */
export const attendanceRejectSchema = z.object({
  id: z.uuid(),
  resolutionNote,
});

export const manualAttendanceSchema = z.object({
  // Both links required: a manually created row is `present` from the start,
  // which present_requires_resolution would refuse with either one missing.
  eventId: z.uuid("Pick an event"),
  memberId: z.uuid("Pick a member"),
  date: civilDate,
  time: civilTime,
  resolutionNote,
});

export type ManualAttendanceFields = z.infer<typeof manualAttendanceSchema>;

export const bulkAssignSchema = z.object({
  eventId: z.uuid("Pick an event"),
  // Explicitly checked ids only — never "everything matching this filter".
  ids: z
    .array(z.uuid())
    .min(1, "Select at least one submission")
    .max(MAX_BULK_ASSIGN, `Select at most ${MAX_BULK_ASSIGN} at a time`),
  approve: z.boolean(),
});

export const pointGrantSchema = z.object({
  memberIds: z
    .array(z.uuid())
    .min(1, "Pick at least one member")
    .max(MAX_GRANT_MEMBERS, `Pick at most ${MAX_GRANT_MEMBERS} members at once`),
  points: z.coerce
    .number()
    .int("Points must be a whole number")
    .min(-MAX_POINTS_PER_GRANT, "That is larger than a single grant allows")
    .max(MAX_POINTS_PER_GRANT, "That is larger than a single grant allows")
    // Mirrors check (points <> 0). Zero is not a grant.
    .refine((v) => v !== 0, "Points can't be zero"),
  // Mirrors reason_not_blank. §4.2: an unexplained grant is what turns a
  // leaderboard from a record into a rumor, so no UI path may skip it.
  reason: z
    .string()
    .trim()
    .min(1, "A reason is required")
    .max(500, "Reason is too long"),
  category: z.enum(POINT_CATEGORIES),
  eventId: optionalUuid("event"),
  // No `term` field, deliberately. point_adjustments.term defaults to
  // current_term() and a literal term string anywhere in application code is a
  // bug (§4.7). If overriding ever ships it must come from a picker fed by the
  // distinct terms in the database, never from typed text.
});

export type PointGrantFields = z.infer<typeof pointGrantSchema>;

/** Mirrors the void_requires_reason constraint added in migration 13. */
export const pointVoidSchema = z.object({
  id: z.uuid(),
  voidReason: z
    .string()
    .trim()
    .min(1, "A reason is required")
    .max(500, "Reason is too long"),
});

// Dues corrections (§4.1, §7 Stage 6.5 phase 3).
//
// Two schemas for two actions, not the three the spec doc names. Reassigning a
// payment and correcting what it bought are one officer intent over one row
// holding one `updated_at`, so they save together — splitting them would give
// each form its own copy of that token and strand the second one the moment the
// first saved. Voiding stays separate because it is one-way.

/**
 * One correction to a payment: who it credits, and what it bought.
 *
 * `memberId` accepting "" is deliberate — an officer must be able to *unlink* a
 * payment credited to the wrong person, and `dues_payments.member_id` is
 * nullable precisely so an unresolved row can exist. Clearing it puts the
 * payment back in the queue rather than deleting anything.
 *
 * `termsCovered` accepting "" is the same shape for a different reason: null
 * means "no officer has decided", which is the review axis itself (migration
 * 19), so it has to be reachable from the form and not only from the importer.
 *
 * ⚠️ `startTerm` is checked for *shape* here and for *membership of the offered
 * list* in the action, which is the half that needs `paid_at`. Both matter: the
 * shape check keeps a malformed string out of a column `term_index()` would
 * silently return null for, and the membership check is what stops the form
 * being a way to type an arbitrary term (§4.7 — a literal term string in
 * application code is a bug, and that applies to one arriving in a POST too).
 */
export const duesPaymentSaveSchema = z.object({
  id: z.uuid(),
  memberId: optionalUuid("member"),
  startTerm: z
    .string()
    .trim()
    // Through termIndex() rather than a regex copied here, so the one place
    // that knows what a term looks like stays the one place.
    .refine((v) => termIndex(v) !== null, "Pick a term"),
  termsCovered: z
    .union([
      z.literal(""),
      z.coerce
        .number()
        .int()
        .min(1, "A payment covers at least one term")
        .max(
          MAX_TERMS_COVERED,
          `A payment covers at most ${MAX_TERMS_COVERED} terms`
        ),
    ])
    .transform((v) => (v === "" ? null : v)),
  // The compare-and-set anchor, carried as the raw PostgREST string. A JS Date
  // round trip truncates the microseconds and the CAS then never matches,
  // reporting a phantom conflict on every save.
  expectedUpdatedAt: z.string().min(1),
});

export type DuesPaymentSaveFields = z.infer<typeof duesPaymentSaveSchema>;

/** Mirrors dues_void_requires_reason. A void moves someone's membership status
 * without their doing anything, so the reason is not optional — same argument
 * as pointVoidSchema, and money makes it stronger rather than weaker. */
export const duesVoidSchema = z.object({
  id: z.uuid(),
  voidReason: z
    .string()
    .trim()
    .min(1, "A reason is required")
    .max(500, "Reason is too long"),
});

// Custom fields (§7 Stage 6 phase 4). Every rule below is also a constraint in
// migration 18 — deliberately, not redundantly. These schemas give the officer
// a sentence explaining what went wrong; the database constraints make the rule
// true for anything that skipped them, including a hand-run SQL statement.

/**
 * 🔓 The definition key, and this refinement is a security control.
 *
 * The key ends up interpolated into a PostgREST `order=` term. An unconstrained
 * one is a sort-injection surface — a comma is read as a second order column,
 * and a space or a `"` is accepted silently with no error at all. FIELD_KEY_PATTERN
 * is the escape; see its note in lib/members.ts for what the spike found.
 *
 * The message names the shape rather than showing the regex, because an officer
 * naming a column should not have to read one.
 */
const fieldKey = z
  .string()
  .trim()
  .min(1, "A key is required")
  .refine(
    (v) => FIELD_KEY_PATTERN.test(v),
    "Use lowercase letters, numbers and underscores, starting with a letter"
  )
  .refine(
    (v) => !RESERVED_FIELD_KEYS.has(v),
    "That key is already used by a built-in column"
  );

/**
 * The dropdown's options, arriving as one per line from a <textarea>.
 *
 * A textarea rather than a repeating input set: an officer pasting a list from
 * a spreadsheet is the common case, and the alternative is N form fields whose
 * count has to be managed client-side. Blank lines are dropped rather than
 * rejected, since a trailing newline is what a textarea always gives you.
 */
const fieldOptions = z
  .string()
  .transform((raw) =>
    raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "")
  )
  .refine((options) => options.length >= 1, "Add at least one option")
  .refine(
    (options) => options.length <= MAX_FIELD_OPTIONS,
    `Use at most ${MAX_FIELD_OPTIONS} options`
  )
  .refine(
    (options) => options.every((o) => o.length <= MAX_OPTION_LENGTH),
    `An option can be at most ${MAX_OPTION_LENGTH} characters`
  )
  .refine(
    // Case-insensitive, matching valid_field_options(). The stored value IS the
    // option text, so "Paid" and "paid" would be indistinguishable once written.
    (options) =>
      new Set(options.map((o) => o.toLowerCase())).size === options.length,
    "Two options are the same"
  );

const fieldLabel = z
  .string()
  .trim()
  .min(1, "A label is required")
  .max(MAX_FIELD_LABEL_LENGTH, "Label is too long");

export const fieldDefinitionSchema = z.object({
  key: fieldKey,
  label: fieldLabel,
  // Dropdown only for now. Present in the schema rather than hardcoded at the
  // insert so widening the CHECK later is a one-line change here too.
  kind: z.literal("select"),
  options: fieldOptions,
  editableInline: z.boolean(),
  showInDirectory: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999),
});

export type FieldDefinitionFields = z.infer<typeof fieldDefinitionSchema>;

/**
 * Editing a definition. The key is NOT editable and is absent by design.
 *
 * Values in `members.custom_fields` are keyed by it, so renaming a key would
 * orphan every stored answer — the rename would have to rewrite every member
 * row, and a half-finished rewrite is unrecoverable. Officers change the
 * *label*, which is the thing they actually see.
 */
export const fieldDefinitionEditSchema = fieldDefinitionSchema.omit({
  key: true,
});

/**
 * One inline edit: this member, this field, this value.
 *
 * `value` is deliberately NOT checked against the option list here — the schema
 * does not know the definition. The action loads it and calls
 * isAllowedFieldValue(), so a value that is not an option is rejected server-side
 * against the definition as stored, not as the form claimed it to be.
 *
 * `expectedUpdatedAt` is the compare-and-set anchor, carried as the raw
 * PostgREST string. A JS Date round trip truncates the microseconds and the CAS
 * then never matches, reporting a phantom conflict on every save.
 */
export const memberFieldValueSchema = z.object({
  memberId: z.uuid(),
  key: fieldKey,
  value: z.string().trim().max(MAX_OPTION_LENGTH, "Value is too long"),
  expectedUpdatedAt: z.string().min(1),
});

export type MemberFieldValueFields = z.infer<typeof memberFieldValueSchema>;

/** Officer notes on a member. Nullable in the schema, so clearing the box
 * stores NULL rather than '' — members.notes has no not-blank check, but an
 * empty string and "no notes" must not become two states that render alike. */
export const memberNotesSchema = z.object({
  memberId: z.uuid(),
  notes: optionalText(2000, "Notes"),
  expectedUpdatedAt: z.string().min(1),
});

export type MemberNotesFields = z.infer<typeof memberNotesSchema>;

// ---------------------------------------------------------------------------
// Saved filter presets (§7 Stage 6 phase 7a)
// ---------------------------------------------------------------------------

/**
 * Saving a preset — creating one, renaming it, or re-pointing it at the current
 * filter. One schema for all three, because `savePreset` is one action for the
 * same reason `saveFieldDefinition` is: the form is the same and the only
 * difference is whether an `id` is posted.
 *
 * ⚠️ `query` is `min(1)`, mirroring `member_filter_presets_query_bounded`, and
 * that bound is a correctness rule rather than hygiene. An empty query is the
 * default view, so a preset holding one is a chip an officer clicks expecting a
 * narrowed roster and gets the whole thing — the phase-1 defect saved as an
 * object and shared with the team. The UI disables Save when
 * `isDefaultFilter(filter)`; this is the same rule where a hand-rolled POST
 * cannot get past it, and the database CHECK is the third.
 *
 * The action canonicalises before parsing, so what reaches here is already what
 * `memberFilterToParams` emits — see `canonicalPresetQuery` for why that happens
 * on write and never on read.
 */
export const presetSaveSchema = z.object({
  /** Absent when creating. */
  id: z.uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "A name is required")
    .max(MAX_PRESET_NAME, "Name is too long"),
  query: z
    .string()
    .min(1, "Narrow the list before saving it as a view")
    .max(MAX_PRESET_QUERY, "That filter is too long to save"),
});

export type PresetSaveFields = z.infer<typeof presetSaveSchema>;

export const presetDeleteSchema = z.object({ id: z.uuid() });

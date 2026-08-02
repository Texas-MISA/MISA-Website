import { z } from "zod";

import { MAX_BULK_ASSIGN } from "@/lib/attendance";
import { normalizeEid } from "@/lib/checkin";
import {
  EVENT_CATEGORIES,
  EVENT_STATUSES,
  MAX_SERIES_EVENTS,
} from "@/lib/events";
import {
  MAX_GRANT_MEMBERS,
  MAX_POINTS_PER_GRANT,
  POINT_CATEGORIES,
} from "@/lib/points";

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

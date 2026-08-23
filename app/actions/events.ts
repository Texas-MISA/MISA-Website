"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { writeAudit, writeAuditBatch } from "@/app/actions/audit";
import { getOfficer } from "@/lib/auth";
import {
  centralWallTimeToInstant,
  deriveCheckinWindow,
  duplicateDraft,
  expandSeries,
  findWindowConflicts,
  impactToken,
  previewEventEdit,
  type Conflict,
  type EventStatus,
  type EventWarning,
} from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";
import { eventSchema, seriesSchema } from "@/lib/validation";

// Officer event mutations (§4.6, §7 Stage 4).
//
// Every export follows the house action shape (see app/actions/attendance.ts):
// a discriminated union on `status`, never throws, whole body in try/catch.
//
// Two rules specific to admin actions, both easy to get wrong:
//
//   1. Authorization is checked here, not only in proxy.ts. Server Actions are
//      POSTs to the route they are rendered on, so a matcher change or a moved
//      action would silently drop proxy coverage. getOfficer() — not
//      requireOfficer() — because redirect() throws NEXT_REDIRECT and the
//      try/catch below would swallow it into a generic error.
//   2. Every redirect() sits OUTSIDE the try/catch, for the same reason.
//
// Reads and writes use the service-role client because events are deny-all for
// writes and anon-readable only when published; Stage 8 adds officer policies.

type FieldName =
  | "title"
  | "description"
  | "location"
  | "date"
  | "startTime"
  | "endTime"
  | "openEarlyMinutes"
  | "closeLateMinutes"
  | "points"
  | "category"
  | "status"
  | "verifyOrigin";

/**
 * The raw strings the officer submitted, echoed back so the form can restore
 * them.
 *
 * React 19 resets an uncontrolled `<form action={…}>` once the action
 * resolves. Without echoing the values back, any state that re-renders the
 * form — a validation error, or the §4.6 confirmation step — silently reverts
 * every field to its original value. In the confirmation case that is a
 * genuinely dangerous bug rather than an annoyance: the officer reads warnings
 * about the edit they made, presses "save anyway", and saves the *old* values
 * with no indication anything was lost.
 */
export type SubmittedEventValues = Record<FieldName, string>;

export type EventFormState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  | { status: "conflict" }
  | { status: "overlap" }
  | { status: "saved"; eventId: string }
  | {
      status: "invalid";
      fieldErrors: Partial<Record<FieldName, string[]>>;
      values: SubmittedEventValues;
    }
  | {
      status: "needs_confirmation";
      warnings: EventWarning[];
      token: string;
      values: SubmittedEventValues;
    };

export type EventActionState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  | { status: "overlap" }
  | { status: "blocked"; attendanceCount: number }
  | { status: "done" };

/**
 * Create an event, or update one when `id` is present.
 *
 * Updating is a two-step confirm when the edit has §4.6 consequences: the
 * first submit returns the warnings and writes nothing, and the form resubmits
 * with a token bound to both the proposed values and the row's `updated_at`.
 * That token doubles as optimistic concurrency — see lib/events.ts.
 */
export async function saveEvent(
  _prev: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const values_ = echo(formData);

  const parsed = eventSchema.safeParse(values_);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "title");
      (fieldErrors[field] ??= []).push(issue.message);
    }
    return { status: "invalid", fieldErrors, values: values_ };
  }

  const id = asString(formData.get("id"));
  let createdId: string | null = null;

  try {
    const db = createAdminClient();
    const fields = parsed.data;

    // Civil date + wall time -> instant, anchored to Central (§4.7). Never
    // new Date("2026-09-01T18:00") — the server runs in UTC.
    const startsAt = centralWallTimeToInstant(fields.date, fields.startTime);
    const endsAt = centralWallTimeToInstant(fields.date, fields.endTime);
    const window = deriveCheckinWindow({
      startsAt,
      endsAt,
      openEarlyMinutes: fields.openEarlyMinutes,
      closeLateMinutes: fields.closeLateMinutes,
    });

    const values = {
      title: fields.title,
      description: fields.description,
      location: fields.location,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      checkin_opens_at: window.checkinOpensAt,
      checkin_closes_at: window.checkinClosesAt,
      points: fields.points,
      category: fields.category,
      status: fields.status,
      verify_origin: fields.verifyOrigin,
    };

    if (!id) {
      const { data, error } = await db
        .from("events")
        .insert({ ...values, created_by: officer.userId })
        .select("id, title, starts_at, ends_at, points, status, term, verify_origin")
        .single();

      if (error) return insertError(error);

      await writeAudit(db, {
        entityType: "event",
        entityId: data.id,
        actorId: officer.userId,
        action: "event.created",
        after: data,
      });

      createdId = data.id;
    } else {
      const { data: current, error: readError } = await db
        .from("events")
        .select(
          "id, title, description, location, starts_at, ends_at, checkin_opens_at, checkin_closes_at, points, category, status, term, updated_at, verify_origin"
        )
        .eq("id", id)
        .single();

      if (readError || !current) {
        console.error("saveEvent: event not found:", readError?.message);
        return { status: "error" };
      }

      // term_of is an exposed RPC, so the new term is fetched rather than
      // computed — no JS mirror to drift, and no term literal in TypeScript.
      const { data: newTerm, error: termError } = await db.rpc("term_of", {
        ts: values.starts_at,
      });
      if (termError) {
        console.error("saveEvent: term_of rpc failed:", termError.message);
        return { status: "error" };
      }

      const { data: presentRows, error: attendanceError } = await db
        .from("attendance")
        .select("member_id, submitted_at")
        .eq("event_id", id)
        .eq("status", "present");
      if (attendanceError) {
        console.error(
          "saveEvent: attendance query failed:",
          attendanceError.message
        );
        return { status: "error" };
      }

      const warnings = previewEventEdit({
        current,
        proposed: values,
        newTerm,
        presentRows: presentRows ?? [],
      });

      // updated_at is carried as the raw PostgREST string. It has microsecond
      // precision, and a Date round trip would truncate it to milliseconds —
      // after which the compare-and-set below never matches and every save
      // reports a phantom conflict.
      const token = impactToken(id, current.updated_at, values);

      if (warnings.length > 0 && asString(formData.get("confirm")) !== token) {
        // Recomputed on every submit, so tweaking a field after seeing the
        // warnings re-previews instead of confirming stale numbers.
        return {
          status: "needs_confirmation",
          warnings,
          token,
          values: values_,
        };
      }

      const { data: updated, error } = await db
        .from("events")
        .update(values)
        .eq("id", id)
        .eq("updated_at", current.updated_at)
        .select("id, title, starts_at, ends_at, points, status, term, verify_origin")
        .maybeSingle();

      if (error) return insertError(error);
      // Zero rows back means another officer saved between the preview and
      // this write; their change would otherwise be silently overwritten.
      if (!updated) return { status: "conflict" };

      await writeAudit(db, {
        entityType: "event",
        entityId: id,
        actorId: officer.userId,
        action: "event.updated",
        before: current,
        after: updated,
      });
    }

    revalidateEventViews(id ?? createdId);
  } catch (e) {
    console.error("saveEvent failed:", e instanceof Error ? e.message : String(e));
    return { status: "error" };
  }

  // Outside the try/catch: redirect() throws NEXT_REDIRECT by design.
  if (createdId) redirect(`/admin/events/${createdId}`);
  return { status: "saved", eventId: id! };
}

/** Move a single event through draft -> published -> cancelled (§4.1). */
export async function setEventStatus(
  _prev: EventActionState,
  formData: FormData
): Promise<EventActionState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const id = asString(formData.get("id"));
  const next = asString(formData.get("status")) as EventStatus | null;
  if (!id || !next) return { status: "error" };

  try {
    const db = createAdminClient();

    const { data: before, error: readError } = await db
      .from("events")
      .select("id, title, status, starts_at, ends_at")
      .eq("id", id)
      .single();
    if (readError || !before) {
      console.error("setEventStatus: event not found:", readError?.message);
      return { status: "error" };
    }

    const { data: after, error } = await db
      .from("events")
      .update({ status: next })
      .eq("id", id)
      .select("id, title, status, starts_at, ends_at")
      .single();

    if (error) {
      // 23P01: publishing would put two events' check-in windows open at the
      // same instant. The exclusion constraint is the guarantee; the UI's job
      // is to say which event it collided with, not to relay a SQLSTATE.
      if (error.code === "23P01") return { status: "overlap" };
      console.error("setEventStatus failed:", error.message);
      return { status: "error" };
    }

    await writeAudit(db, {
      entityType: "event",
      entityId: id,
      actorId: officer.userId,
      action:
        next === "published"
          ? "event.published"
          : next === "cancelled"
            ? "event.cancelled"
            : "event.reopened",
      before,
      after,
    });

    revalidateEventViews(id);
    return { status: "done" };
  } catch (e) {
    console.error(
      "setEventStatus failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

/**
 * Delete an event — blocked when it has attendance (§4.6).
 *
 * Recorded attendance is a fact about a person who showed up. `event_id` is
 * ON DELETE SET NULL, so deleting anyway would not error: it would quietly
 * turn every one of those rows into an unresolved orphan. Cancelling instead
 * preserves the history and removes the event from the upcoming list.
 */
export async function deleteEvent(
  _prev: EventActionState,
  formData: FormData
): Promise<EventActionState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const id = asString(formData.get("id"));
  if (!id) return { status: "error" };

  try {
    const db = createAdminClient();

    const { count, error: countError } = await db
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("event_id", id);
    if (countError) {
      console.error("deleteEvent: count failed:", countError.message);
      return { status: "error" };
    }
    if ((count ?? 0) > 0) {
      return { status: "blocked", attendanceCount: count ?? 0 };
    }

    const { data: before, error: readError } = await db
      .from("events")
      .select("id, title, starts_at, ends_at, status, points, category, verify_origin")
      .eq("id", id)
      .single();
    if (readError || !before) {
      console.error("deleteEvent: event not found:", readError?.message);
      return { status: "error" };
    }

    const { error } = await db.from("events").delete().eq("id", id);
    if (error) {
      console.error("deleteEvent failed:", error.message);
      return { status: "error" };
    }

    await writeAudit(db, {
      entityType: "event",
      entityId: id,
      actorId: officer.userId,
      action: "event.deleted",
      before,
      note: "event had no attendance",
    });

    revalidateEventViews(null);
  } catch (e) {
    console.error(
      "deleteEvent failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }

  redirect("/admin/events");
}

// ---------------------------------------------------------------------------
// Recurring series and duplication (§7 Stage 4)
// ---------------------------------------------------------------------------

type SeriesFieldName = FieldName | "untilDate" | "weekdays";

export type SeriesFormState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  | {
      status: "invalid";
      fieldErrors: Partial<Record<SeriesFieldName, string[]>>;
    }
  | { status: "created"; seriesId: string; count: number };

/**
 * Generate a whole schedule in one action.
 *
 * Always creates drafts, and inserts them as a single statement so the batch
 * is all-or-nothing. Drafts cannot trip the overlap exclusion constraint —
 * it is predicated on `status = 'published'` — so generation never fails on
 * a collision. Publishing is where that surfaces; see publishSeries.
 */
export async function createSeries(
  _prev: SeriesFormState,
  formData: FormData
): Promise<SeriesFormState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const parsed = seriesSchema.safeParse({
    ...echo(formData),
    untilDate: formData.get("untilDate"),
    weekdays: formData.getAll("weekdays"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "title");
      (fieldErrors[field] ??= []).push(issue.message);
    }
    return { status: "invalid", fieldErrors };
  }

  const fields = parsed.data;
  const seriesId = crypto.randomUUID();

  try {
    const db = createAdminClient();

    // Duration rather than a wall-clock end time, so a 6–7pm meeting is one
    // hour of real time on every occurrence including the DST changeover.
    const durationMinutes =
      (Number(fields.endTime.slice(0, 2)) * 60 +
        Number(fields.endTime.slice(3, 5))) -
      (Number(fields.startTime.slice(0, 2)) * 60 +
        Number(fields.startTime.slice(3, 5)));

    const drafts = expandSeries({
      firstDate: fields.date,
      untilDate: fields.untilDate,
      weekdays: fields.weekdays,
      startTime: fields.startTime,
      durationMinutes,
      openEarlyMinutes: fields.openEarlyMinutes,
      closeLateMinutes: fields.closeLateMinutes,
      title: fields.title,
      description: fields.description,
      location: fields.location,
      points: fields.points,
      category: fields.category,
      seriesId,
    });

    if (drafts.length === 0) {
      return {
        status: "invalid",
        fieldErrors: { untilDate: ["That range contains no matching days"] },
      };
    }

    const { data, error } = await db
      .from("events")
      .insert(drafts.map((d) => ({ ...d, created_by: officer.userId })))
      .select("id, title, starts_at");

    if (error) {
      console.error("createSeries failed:", error.message);
      return { status: "error" };
    }

    await writeAuditBatch(
      db,
      data.map((row) => ({
        entityType: "event" as const,
        entityId: row.id,
        actorId: officer.userId,
        action: "series.created" as const,
        after: row,
        note: `series ${seriesId} (${data.length} events)`,
      }))
    );

    revalidateEventViews(null);
    return { status: "created", seriesId, count: data.length };
  } catch (e) {
    console.error(
      "createSeries failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

export type SeriesPublishState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  | { status: "conflicts"; conflicts: Conflict[] }
  | { status: "conflict_race" }
  | { status: "published"; count: number; skipped: number };

/**
 * Publish every draft in a series.
 *
 * One UPDATE is one statement is one transaction, and the exclusion
 * constraint is checked per row as the statement runs — so a single collision
 * fails the whole batch and nothing publishes. That is the right semantics
 * (a half-published 12-week schedule is worse than a rejected one) but a
 * terrible message, hence the pre-flight below.
 *
 * With `skipConflicts`, the colliding weeks are excluded from the UPDATE and
 * left as drafts. Never silently: the count comes back in the state and goes
 * into the audit note.
 */
export async function publishSeries(
  _prev: SeriesPublishState,
  formData: FormData
): Promise<SeriesPublishState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const seriesId = asString(formData.get("seriesId"));
  if (!seriesId) return { status: "error" };
  const skipConflicts = asString(formData.get("skipConflicts")) === "yes";

  try {
    const db = createAdminClient();

    const { data: candidates, error: readError } = await db
      .from("events")
      .select(
        "id, title, starts_at, ends_at, checkin_opens_at, checkin_closes_at"
      )
      .eq("series_id", seriesId)
      .eq("status", "draft")
      .order("starts_at", { ascending: true });

    if (readError) {
      console.error("publishSeries: read failed:", readError.message);
      return { status: "error" };
    }
    if (!candidates || candidates.length === 0) {
      return { status: "published", count: 0, skipped: 0 };
    }

    // PostgREST cannot filter on coalesce(...), so fetch a padded date range
    // and do the effective-window maths in JS. A check-in window reaching
    // more than two days past its start would slip past this pre-flight — the
    // exclusion constraint still catches it, which is the point of keeping
    // both.
    const first = new Date(candidates[0].starts_at).getTime();
    const last = new Date(candidates.at(-1)!.starts_at).getTime();
    const pad = 2 * 86_400_000;

    const { data: published, error: publishedError } = await db
      .from("events")
      .select(
        "id, title, starts_at, ends_at, checkin_opens_at, checkin_closes_at"
      )
      .eq("status", "published")
      .gte("starts_at", new Date(first - pad).toISOString())
      .lte("starts_at", new Date(last + pad).toISOString());

    if (publishedError) {
      console.error("publishSeries: overlap read failed:", publishedError.message);
      return { status: "error" };
    }

    const conflicts = findWindowConflicts(candidates, published ?? []);
    if (conflicts.length > 0 && !skipConflicts) {
      return { status: "conflicts", conflicts };
    }

    const conflicting = new Set(
      conflicts.map(
        (c) =>
          candidates.find((x) => x.starts_at === c.candidateStartsAt)?.id ?? ""
      )
    );
    const toPublish = candidates.filter((c) => !conflicting.has(c.id));
    if (toPublish.length === 0) {
      return { status: "published", count: 0, skipped: candidates.length };
    }

    const { data: updated, error } = await db
      .from("events")
      .update({ status: "published" })
      .in(
        "id",
        toPublish.map((c) => c.id)
      )
      .select("id, title, starts_at, status");

    if (error) {
      // Someone published a colliding event between the pre-flight and here.
      // Do not parse error.details to name the row — that format is a
      // Postgres implementation detail, not an API.
      if (error.code === "23P01") return { status: "conflict_race" };
      console.error("publishSeries failed:", error.message);
      return { status: "error" };
    }

    const skipped = candidates.length - updated.length;
    await writeAuditBatch(
      db,
      updated.map((row) => ({
        entityType: "event" as const,
        entityId: row.id,
        actorId: officer.userId,
        action: "series.published" as const,
        after: row,
        note:
          skipped > 0
            ? `series ${seriesId}; ${skipped} left as drafts due to overlaps`
            : `series ${seriesId}`,
      }))
    );

    revalidateEventViews(null);
    return { status: "published", count: updated.length, skipped };
  } catch (e) {
    console.error(
      "publishSeries failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

/** Cancel a whole series at once — the counterpart to publishing it. */
export async function setSeriesStatus(
  _prev: EventActionState,
  formData: FormData
): Promise<EventActionState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const seriesId = asString(formData.get("seriesId"));
  const next = asString(formData.get("status")) as EventStatus | null;
  if (!seriesId || !next) return { status: "error" };

  try {
    const db = createAdminClient();

    const { data: updated, error } = await db
      .from("events")
      .update({ status: next })
      .eq("series_id", seriesId)
      .select("id, title, status");

    if (error) {
      if (error.code === "23P01") return { status: "overlap" };
      console.error("setSeriesStatus failed:", error.message);
      return { status: "error" };
    }

    await writeAuditBatch(
      db,
      updated.map((row) => ({
        entityType: "event" as const,
        entityId: row.id,
        actorId: officer.userId,
        action: next === "cancelled" ? ("series.cancelled" as const) : ("series.published" as const),
        after: row,
        note: `series ${seriesId}`,
      }))
    );

    revalidateEventViews(null);
    return { status: "done" };
  } catch (e) {
    console.error(
      "setSeriesStatus failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

/**
 * Clone an event as a draft one week later (§7 Stage 4).
 *
 * Always a draft, so a duplicate can never collide on the exclusion
 * constraint at creation time, and never a member of the source's series.
 */
export async function duplicateEvent(
  _prev: EventActionState,
  formData: FormData
): Promise<EventActionState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const id = asString(formData.get("id"));
  if (!id) return { status: "error" };

  let newId: string | null = null;

  try {
    const db = createAdminClient();

    const { data: source, error: readError } = await db
      .from("events")
      .select(
        "title, description, location, starts_at, ends_at, checkin_opens_at, checkin_closes_at, points, category, verify_origin"
      )
      .eq("id", id)
      .single();

    if (readError || !source) {
      console.error("duplicateEvent: source not found:", readError?.message);
      return { status: "error" };
    }

    const draft = duplicateDraft(source);
    const { data, error } = await db
      .from("events")
      .insert({ ...draft, created_by: officer.userId })
      .select("id, title, starts_at, ends_at, points, status")
      .single();

    if (error) {
      console.error("duplicateEvent failed:", error.message);
      return { status: "error" };
    }

    // One audit row on the new event, not two — the source is unchanged.
    await writeAudit(db, {
      entityType: "event",
      entityId: data.id,
      actorId: officer.userId,
      action: "event.created",
      after: data,
      note: `duplicated from ${id}`,
    });

    newId = data.id;
    revalidateEventViews(null);
  } catch (e) {
    console.error(
      "duplicateEvent failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }

  redirect(`/admin/events/${newId}`);
}

function echo(formData: FormData): SubmittedEventValues {
  const read = (name: FieldName, fallback = "") => {
    const value = formData.get(name);
    return typeof value === "string" ? value : fallback;
  };
  return {
    title: read("title"),
    description: read("description"),
    location: read("location"),
    date: read("date"),
    startTime: read("startTime"),
    endTime: read("endTime"),
    openEarlyMinutes: read("openEarlyMinutes", "0"),
    closeLateMinutes: read("closeLateMinutes", "0"),
    points: read("points", "1"),
    category: read("category"),
    status: read("status", "draft"),
    verifyOrigin: read("verifyOrigin"),
  };
}

function insertError(error: { code?: string; message: string }): EventFormState {
  if (error.code === "23P01") return { status: "overlap" };
  console.error("event write failed:", error.message);
  return { status: "error" };
}

/** The public home page reads live published events, so a publish, cancel, or
 * time change has to invalidate it too — easy to forget, and the symptom is a
 * stale schedule for everyone but the officer who changed it. */
function revalidateEventViews(id: string | null) {
  revalidatePath("/admin/events");
  if (id) revalidatePath(`/admin/events/${id}`);
  revalidatePath("/");
}

function asString(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

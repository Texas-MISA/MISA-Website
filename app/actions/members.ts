"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { writeAudit } from "@/app/actions/audit";
import { getOfficer } from "@/lib/auth";
import {
  AUDITED_FIELD_COLUMNS,
  AUDITED_MEMBER_COLUMNS,
  fieldValue,
  isAllowedFieldValue,
  isValidFieldKey,
  setFieldValue,
  withoutToken,
} from "@/lib/members";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fieldDefinitionEditSchema,
  fieldDefinitionSchema,
  memberFieldValueSchema,
  memberNotesSchema,
} from "@/lib/validation";

// Member mutations (§4.2, §7 Stage 6 phase 4): one custom-field value, the
// officer notes, and the field definitions themselves. Same house shape as
// app/actions/points.ts and app/actions/attendance-review.ts — read either of
// those for the shared rationale rather than repeating it here.
//
// members and member_field_definitions are both RLS deny-all, so every read and
// write goes through the service-role client behind a getOfficer() guard. The
// browser never touches either table (§3, §6).
//
// 🔓 No role check anywhere in this file, and that is a decision rather than an
// omission (§9 #6, confirmed for phase 4 on 2026-08-02): ANY officer may define
// a field and any officer may edit a value. The audit log is the control, not a
// role gate — a gate funnels every dues-status correction through whoever is
// busiest, and the misuse it guards against shows up in admin_audit either way.
// Nothing in this codebase branches on admin_profiles.role, and this must not
// be the first thing that does.

const DIRECTORY = "/admin/members";
const FIELDS = "/admin/members/fields";

// ---------------------------------------------------------------------------
// One custom-field value
// ---------------------------------------------------------------------------

export type MemberFieldState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  /** Someone else changed this member between the render and the save. */
  | { status: "conflict" }
  /**
   * The save was well-formed but the definition would not have it. Separate
   * from `invalid` because none of these is something the officer typed — the
   * field was archived, deleted, or had its options edited in another tab.
   */
  | {
      status: "rejected";
      reason: "unknown_field" | "archived" | "not_an_option";
    }
  | {
      status: "invalid";
      fieldErrors: Partial<Record<"memberId" | "key" | "value", string[]>>;
    }
  /** Carries the fresh token, which the row hands to its sibling cells. */
  | { status: "done"; key: string; value: string; updatedAt: string };

/**
 * Set (or clear) one member's answer for one custom field.
 *
 * Called from the directory's inline cells and from the member detail page —
 * deliberately the same action for both, so option rejection, the orphan case,
 * and the compare-and-set cannot drift between the two screens.
 */
export async function setMemberFieldValue(
  _prev: MemberFieldState,
  formData: FormData
): Promise<MemberFieldState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const parsed = memberFieldValueSchema.safeParse({
    memberId: formData.get("memberId"),
    key: formData.get("key"),
    value: formData.get("value"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
  });
  if (!parsed.success) {
    return {
      status: "invalid",
      fieldErrors: fieldErrorsOf<"memberId" | "key" | "value">(
        parsed.error,
        "value"
      ),
    };
  }
  const fields = parsed.data;

  try {
    const db = createAdminClient();

    const { data: definition, error: definitionError } = await db
      .from("member_field_definitions")
      .select("id, key, label, options, archived_at")
      .eq("key", fields.key)
      .maybeSingle();

    if (definitionError) {
      console.error(
        "setMemberFieldValue failed:",
        definitionError.message
      );
      return { status: "error" };
    }
    if (!definition) return { status: "rejected", reason: "unknown_field" };
    if (definition.archived_at) {
      return { status: "rejected", reason: "archived" };
    }

    // ⚠️ `editable_inline` is deliberately NOT consulted. It decides where a
    // field is OFFERED — the directory table, or the detail page only — and is
    // not an authorization boundary. The detail page edits `editable_inline =
    // false` fields through this very action, so checking it here would break
    // the screen that flag exists to route work to.
    if (!isAllowedFieldValue(definition, fields.value)) {
      return { status: "rejected", reason: "not_an_option" };
    }

    const { data: before, error: beforeError } = await db
      .from("members")
      .select(AUDITED_MEMBER_COLUMNS)
      .eq("id", fields.memberId)
      .maybeSingle();

    if (beforeError || !before) {
      console.error(
        "setMemberFieldValue failed:",
        beforeError?.message ?? "member not found"
      );
      return { status: "error" };
    }

    // A no-op write would still bump updated_at and still log an audit row, and
    // that row's diff would show nothing changed — noise in the one log that
    // exists to say who changed what. Auto-submit only fires on change, so this
    // is the second-tab and replayed-POST case rather than the common one.
    const next = fields.value === "" ? null : fields.value;
    if (fieldValue(before.custom_fields, fields.key) === next) {
      return {
        status: "done",
        key: fields.key,
        value: fields.value,
        updatedAt: before.updated_at,
      };
    }

    const { data: after, error } = await db
      .from("members")
      // The whole object, not a patch: PostgREST has no partial jsonb update,
      // and setFieldValue deletes the key rather than storing "" so that
      // "cleared" and "never answered" stay one state (§4.5's null-is-not-zero
      // rule, arriving in a new place).
      .update({ custom_fields: setFieldValue(before.custom_fields, fields.key, next) })
      .eq("id", fields.memberId)
      // The raw PostgREST string, never a Date: updated_at has microsecond
      // precision and a JS Date round trip truncates to milliseconds, after
      // which this compare-and-set never matches and every save reports a
      // phantom conflict.
      .eq("updated_at", fields.expectedUpdatedAt)
      // The same literal as `before` — see AUDITED_MEMBER_COLUMNS.
      .select(AUDITED_MEMBER_COLUMNS)
      .maybeSingle();

    if (error) {
      console.error("setMemberFieldValue failed:", error.message);
      return { status: "error" };
    }
    // Zero rows back means another officer saved between the render and here.
    if (!after) return { status: "conflict" };

    await writeAudit(db, {
      entityType: "member",
      entityId: fields.memberId,
      actorId: officer.userId,
      action: "member.updated",
      before: withoutToken(before),
      after: withoutToken(after),
      // Without this the trail reads `custom_fields: {"dues_paid":"no"} →
      // {"dues_paid":"yes"}` and the officer diffs two JSON blobs by eye. The
      // label is what they actually recognize.
      note: definition.label,
    });

    revalidateMembers(fields.memberId);
    return {
      status: "done",
      key: fields.key,
      value: fields.value,
      updatedAt: after.updated_at,
    };
  } catch (e) {
    console.error(
      "setMemberFieldValue failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

// ---------------------------------------------------------------------------
// Officer notes
// ---------------------------------------------------------------------------

export type MemberNotesState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  | { status: "conflict"; values: { notes: string } }
  | {
      status: "invalid";
      fieldErrors: Partial<Record<"notes", string[]>>;
      values: { notes: string };
    }
  | { status: "done"; updatedAt: string; values: { notes: string } };

/** How much of a submitted note is echoed back. Bounds what a hand-rolled POST
 * can make the server reflect into its own response. */
const NOTES_ECHO_LIMIT = 4000;

export async function saveMemberNotes(
  _prev: MemberNotesState,
  formData: FormData
): Promise<MemberNotesState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const raw = formData.get("notes");
  const values = {
    notes: typeof raw === "string" ? raw.slice(0, NOTES_ECHO_LIMIT) : "",
  };

  const parsed = memberNotesSchema.safeParse({
    memberId: formData.get("memberId"),
    notes: values.notes,
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
  });
  if (!parsed.success) {
    return {
      status: "invalid",
      fieldErrors: fieldErrorsOf<"notes">(parsed.error, "notes"),
      values,
    };
  }
  const fields = parsed.data;

  try {
    const db = createAdminClient();

    const { data: before, error: beforeError } = await db
      .from("members")
      .select(AUDITED_MEMBER_COLUMNS)
      .eq("id", fields.memberId)
      .maybeSingle();

    if (beforeError || !before) {
      console.error(
        "saveMemberNotes failed:",
        beforeError?.message ?? "member not found"
      );
      return { status: "error" };
    }

    const { data: after, error } = await db
      .from("members")
      // memberNotesSchema turns an empty box into null, never "". The column has
      // no not-blank check, so '' would be storable — and would render exactly
      // like "no notes" while sorting and filtering differently.
      .update({ notes: fields.notes })
      .eq("id", fields.memberId)
      .eq("updated_at", fields.expectedUpdatedAt)
      .select(AUDITED_MEMBER_COLUMNS)
      .maybeSingle();

    if (error) {
      console.error("saveMemberNotes failed:", error.message);
      return { status: "error" };
    }
    if (!after) return { status: "conflict", values };

    await writeAudit(db, {
      entityType: "member",
      entityId: fields.memberId,
      actorId: officer.userId,
      action: "member.updated",
      before: withoutToken(before),
      after: withoutToken(after),
      note: "officer notes",
    });

    revalidateMembers(fields.memberId);
    return {
      status: "done",
      updatedAt: after.updated_at,
      values: { notes: after.notes ?? "" },
    };
  } catch (e) {
    console.error(
      "saveMemberNotes failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

// ---------------------------------------------------------------------------
// Field definitions
// ---------------------------------------------------------------------------

type FieldFormField = "key" | "label" | "options" | "sortOrder";

export type SubmittedFieldValues = {
  key: string;
  label: string;
  options: string;
  editableInline: boolean;
  showInDirectory: boolean;
  sortOrder: string;
};

export type FieldFormState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  | {
      status: "invalid";
      fieldErrors: Partial<Record<FieldFormField, string[]>>;
      values: SubmittedFieldValues;
    }
  /**
   * 23505 on member_field_definitions_key_idx. `archived` is the half that
   * matters: the unique index deliberately spans archived rows, because
   * re-using an archived key would silently adopt every value still stored
   * under it — a new "Dues 2027" field pre-filled from "Dues 2026".
   */
  | { status: "duplicate_key"; archived: boolean; values: SubmittedFieldValues }
  /** Editing stays on the page; creating redirects to the list. */
  | { status: "saved"; id: string };

const FIELD_ECHO_LIMITS = {
  key: 60,
  label: 120,
  options: 4000,
  sortOrder: 8,
} as const;

/**
 * Create or edit a definition. One action for both, like `saveEvent`: the form
 * is the same and the only difference is whether an `id` is posted.
 *
 * The key is submitted on create and absent on edit, which
 * `fieldDefinitionEditSchema` enforces by omitting it — renaming a key would
 * orphan every answer stored under the old one, and the rewrite that would fix
 * that is unrecoverable if it fails halfway.
 */
export async function saveFieldDefinition(
  _prev: FieldFormState,
  formData: FormData
): Promise<FieldFormState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const id = asString(formData.get("id"));
  const isCreate = id === null;

  const values: SubmittedFieldValues = {
    key: echoField(formData.get("key"), FIELD_ECHO_LIMITS.key),
    label: echoField(formData.get("label"), FIELD_ECHO_LIMITS.label),
    options: echoField(formData.get("options"), FIELD_ECHO_LIMITS.options),
    // Unchecked boxes are absent from FormData entirely, so absence is false.
    editableInline: formData.get("editableInline") !== null,
    showInDirectory: formData.get("showInDirectory") !== null,
    sortOrder: echoField(formData.get("sortOrder"), FIELD_ECHO_LIMITS.sortOrder),
  };

  const candidate = {
    label: values.label,
    kind: "select" as const,
    options: values.options,
    editableInline: values.editableInline,
    showInDirectory: values.showInDirectory,
    sortOrder: Number(values.sortOrder === "" ? 0 : values.sortOrder),
  };

  // Parsed inside each branch rather than once above, because the two schemas
  // genuinely differ: only the create form carries a key, and
  // fieldDefinitionEditSchema omits it so a rename cannot be expressed at all.
  // Parsing once would produce a union whose `key` the compiler cannot see, and
  // the cast that hides that is exactly the kind of assertion this codebase
  // avoids in favour of a shape TypeScript can check.
  const invalid = (error: Parameters<typeof fieldErrorsOf>[0]): FieldFormState => ({
    status: "invalid",
    fieldErrors: fieldErrorsOf<FieldFormField>(error, "label"),
    values,
  });

  let savedId = id ?? "";

  try {
    const db = createAdminClient();

    if (isCreate) {
      const parsed = fieldDefinitionSchema.safeParse({
        ...candidate,
        key: values.key,
      });
      if (!parsed.success) return invalid(parsed.error);
      const fields = parsed.data;

      const { data: after, error } = await db
        .from("member_field_definitions")
        .insert({
          key: fields.key,
          label: fields.label,
          kind: fields.kind,
          options: fields.options,
          editable_inline: fields.editableInline,
          show_in_directory: fields.showInDirectory,
          sort_order: fields.sortOrder,
          created_by: officer.userId,
        })
        .select(AUDITED_FIELD_COLUMNS)
        .single();

      if (error) {
        if (error.code === "23505") {
          return {
            status: "duplicate_key",
            archived: await keyIsArchived(db, values.key),
            values,
          };
        }
        // 23514 here means the zod schema and the CHECK constraints have
        // drifted apart, which is a bug in this codebase rather than something
        // the officer can fix by retyping.
        console.error("saveFieldDefinition failed:", error.message);
        return { status: "error" };
      }

      savedId = after.id;
      await writeAudit(db, {
        entityType: "member_field",
        entityId: after.id,
        actorId: officer.userId,
        action: "member_field.created",
        after: withoutToken(after),
      });
    } else {
      const parsed = fieldDefinitionEditSchema.safeParse(candidate);
      if (!parsed.success) return invalid(parsed.error);
      const fields = parsed.data;

      const { data: before, error: beforeError } = await db
        .from("member_field_definitions")
        .select(AUDITED_FIELD_COLUMNS)
        .eq("id", id)
        .maybeSingle();

      if (beforeError || !before) {
        console.error(
          "saveFieldDefinition failed:",
          beforeError?.message ?? "definition not found"
        );
        return { status: "error" };
      }

      // No compare-and-set token, deliberately, and unlike a member edit. A
      // definition is edited from one full-page form that nothing else writes
      // to — there is no inline surface and no queue — so the concurrent-edit
      // window the directory has does not exist here. If a definitions screen
      // ever gains inline editing, this needs the CAS that member rows carry.
      const { data: after, error } = await db
        .from("member_field_definitions")
        .update({
          label: fields.label,
          kind: fields.kind,
          options: fields.options,
          editable_inline: fields.editableInline,
          show_in_directory: fields.showInDirectory,
          sort_order: fields.sortOrder,
        })
        .eq("id", id)
        .select(AUDITED_FIELD_COLUMNS)
        .maybeSingle();

      if (error || !after) {
        console.error(
          "saveFieldDefinition failed:",
          error?.message ?? "definition disappeared"
        );
        return { status: "error" };
      }

      await writeAudit(db, {
        entityType: "member_field",
        entityId: id,
        actorId: officer.userId,
        action: "member_field.updated",
        before: withoutToken(before),
        after: withoutToken(after),
      });
    }

    revalidateFields();
  } catch (e) {
    console.error(
      "saveFieldDefinition failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }

  // Outside the try/catch: redirect() signals by throwing NEXT_REDIRECT, and
  // the catch above would swallow it. A new definition goes to the list, where
  // sort_order is the only place it means anything; an edit stays put.
  if (isCreate) redirect(FIELDS);
  return { status: "saved", id: savedId };
}

export type FieldArchiveState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  /** Someone archived (or restored) it first. */
  | { status: "already_done" }
  | { status: "done"; archived: boolean };

/**
 * Archive a definition, or bring one back.
 *
 * Archiving never deletes, and never touches stored values: members keep every
 * answer they gave, the field simply stops being offered. A hard delete would
 * leave values keyed to a definition nobody can look up, which silently
 * rewrites what the roster said at the time — the same argument that makes a
 * point adjustment voidable rather than deletable (§4.2).
 *
 * ⚠️ Restoring is filed as `member_field.updated`, not a verb of its own. The
 * diff already reads `archived_at: <timestamp> → —`, which is exactly what
 * happened, and `admin_audit` is append-only — a verb added carelessly can
 * never be corrected out of the rows already written under it.
 */
export async function setFieldArchived(
  _prev: FieldArchiveState,
  formData: FormData
): Promise<FieldArchiveState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const id = asString(formData.get("id"));
  const archiving = asString(formData.get("intent")) === "archive";
  if (!id) return { status: "error" };

  try {
    const db = createAdminClient();

    const { data: before, error: beforeError } = await db
      .from("member_field_definitions")
      .select(AUDITED_FIELD_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (beforeError || !before) {
      console.error(
        "setFieldArchived failed:",
        beforeError?.message ?? "definition not found"
      );
      return { status: "error" };
    }

    // Guarded on the current state rather than on a CAS token: each direction
    // is a one-way transition from where it starts, so the null check IS the
    // complete guard and zero rows back means someone got there first. Same
    // reasoning as voidAdjustment.
    const guarded = db
      .from("member_field_definitions")
      .update({ archived_at: archiving ? new Date().toISOString() : null })
      .eq("id", id);

    const { data: after, error } = await (archiving
      ? guarded.is("archived_at", null)
      : guarded.not("archived_at", "is", null)
    )
      .select(AUDITED_FIELD_COLUMNS)
      .maybeSingle();

    if (error) {
      console.error("setFieldArchived failed:", error.message);
      return { status: "error" };
    }
    if (!after) return { status: "already_done" };

    await writeAudit(db, {
      entityType: "member_field",
      entityId: id,
      actorId: officer.userId,
      action: archiving ? "member_field.archived" : "member_field.updated",
      before: withoutToken(before),
      after: withoutToken(after),
      note: archiving ? null : "restored from the archive",
    });

    revalidateFields();
    return { status: "done", archived: archiving };
  } catch (e) {
    console.error(
      "setFieldArchived failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

// ---------------------------------------------------------------------------

function echoField(value: FormDataEntryValue | null, max: number): string {
  // FormData.get can return a File; anything not a string echoes as empty.
  return typeof value === "string" ? value.slice(0, max) : "";
}

function asString(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Was the colliding key archived rather than live?
 *
 * Only reached after a 23505, so the row exists. 🔓 The key is run through
 * isValidFieldKey first: it reached zod, but this is a query predicate and the
 * rule for a key in a query string is that it is re-checked where it is used,
 * never assumed clean by provenance.
 */
async function keyIsArchived(
  db: ReturnType<typeof createAdminClient>,
  key: string
): Promise<boolean> {
  if (!isValidFieldKey(key)) return false;
  const { data } = await db
    .from("member_field_definitions")
    .select("archived_at")
    .eq("key", key)
    .maybeSingle();
  return Boolean(data?.archived_at);
}

// Duplicated from app/actions/points.ts rather than shared: a "use server"
// module may only export async functions, so a helper like this cannot be
// exported from one and imported by the other.
function fieldErrorsOf<K extends string>(
  error: { issues: { path: PropertyKey[]; message: string }[] },
  fallback: K
): Partial<Record<K, string[]>> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? fallback);
    (fieldErrors[field] ??= []).push(issue.message);
  }
  return fieldErrors as Partial<Record<K, string[]>>;
}

function revalidateMembers(id: string | null) {
  revalidatePath(DIRECTORY);
  if (id) revalidatePath(`${DIRECTORY}/${id}`);
  // Not /leaderboard: a custom field and a note change no point total. Grants
  // and attendance do, and those revalidate it from their own actions.
}

function revalidateFields() {
  revalidatePath(FIELDS);
  // The definitions decide the directory's columns and its sort headers, so a
  // change here reshapes a screen that never posted to this action.
  revalidatePath(DIRECTORY);
  // And every member detail page renders the full field set.
  revalidatePath(`${DIRECTORY}/[id]`, "page");
}

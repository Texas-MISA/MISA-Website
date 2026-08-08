"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/app/actions/audit";
import { getOfficer } from "@/lib/auth";
import { fetchFieldDefinitions } from "@/lib/member-fields";
import {
  canonicalPresetQuery,
  MAX_PRESET_NAME,
  storableFields,
} from "@/lib/presets";
import { createAdminClient } from "@/lib/supabase/admin";
import { presetDeleteSchema, presetSaveSchema } from "@/lib/validation";

// Saved directory filters (§7 Stage 6 phase 7a). Same house shape as
// app/actions/members.ts — read that one for the shared rationale rather than
// repeating it here.
//
// member_filter_presets is RLS deny-all like every other table, so both reads
// and writes go through the service-role client behind a getOfficer() guard.
//
// 🔓 No role check anywhere in this file, and that is a decision rather than an
// omission (§9 #6): presets are SHARED, so any officer may save one, rename
// anyone's, or delete anyone's. The audit log is the control, not a role gate.
// A gate here would be worse than useless — it would leave one person owning
// the team's saved views and everyone else rebuilding them by hand, which is the
// problem this feature exists to solve. Nothing in this codebase branches on
// admin_profiles.role and this must not be the first thing that does.
//
// ⚠️ No compare-and-set token, unlike a member row and like a field definition.
// A preset is edited from one full-page form that nothing else writes to —
// there is no inline surface and no queue — so the concurrent-edit window the
// directory has does not exist here. The same sentence appears on
// saveFieldDefinition, and the same caveat applies: if presets ever become
// inline-editable this needs the CAS that directory-row.tsx carries.

const DIRECTORY = "/admin/members";
const PRESETS = "/admin/members/presets";

/** One unbroken literal with `as const` — PostgREST types the returned row off
 * the string literal, and a concatenation widens it to plain `string`, which
 * collapses every field access at once. */
const AUDITED_PRESET_COLUMNS =
  "id, name, query, created_by, created_at, updated_at" as const;

export type SubmittedPresetValues = {
  name: string;
  query: string;
};

export type PresetSaveState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  | {
      status: "invalid";
      fieldErrors: Partial<Record<"name" | "query", string[]>>;
      values: SubmittedPresetValues;
    }
  /** 23505 on member_filter_presets_name_idx, which is case-insensitive. */
  | { status: "duplicate_name"; values: SubmittedPresetValues }
  /** Someone deleted it between the render and the save. */
  | { status: "not_found" }
  | { status: "saved"; id: string; name: string };

const PRESET_ECHO_LIMITS = {
  name: MAX_PRESET_NAME * 2,
  // Generous relative to MAX_PRESET_QUERY: the echo exists so the officer does
  // not lose what they typed after a validation failure, and truncating it to
  // the limit that just rejected the value would hide why.
  query: 4000,
} as const;

/**
 * Create a preset, rename one, or re-point one at the current filter.
 *
 * One action for all three, like `saveEvent` and `saveFieldDefinition`: create
 * when no `id` is posted. Renaming and re-pointing are the same write, and
 * splitting them would put two forms on the manage screen writing to one row.
 */
export async function savePreset(
  _prev: PresetSaveState,
  formData: FormData
): Promise<PresetSaveState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const id = asString(formData.get("id"));
  const isCreate = id === null;

  const values: SubmittedPresetValues = {
    name: echoField(formData.get("name"), PRESET_ECHO_LIMITS.name),
    query: echoField(formData.get("query"), PRESET_ECHO_LIMITS.query),
  };

  try {
    const db = createAdminClient();

    // 🪤 Canonicalised HERE, before validation. The posted query came from a
    // live directory URL, but a URL is a thing a human can edit — so what gets
    // stored is what the parser makes of it, exactly as the directory itself
    // would. Without this pass, two officers saving the identical view from
    // differently-ordered clicks would store two different strings and the
    // "which preset is active?" comparison would stop matching either of them.
    //
    // ⚠️ **includeArchived, and then storableFields on top of it.** This action
    // serves the rename on the manage screen too, and that form posts the row's
    // STORED query straight back — so canonicalising against the live,
    // in-directory definitions would re-derive a filter the officer never
    // touched and permanently drop any `cf:` clause whose field is currently
    // archived or hidden. Found in the phase-7a walkthrough; the full account is
    // on storableFields. Storage is permissive, application stays strict.
    //
    // This is the ONE place canonicalisation happens. Reading a preset hands the
    // stored string straight to the URL.
    const definitions = await fetchFieldDefinitions(db, {
      includeArchived: true,
    });
    const query = canonicalPresetQuery(values.query, storableFields(definitions));

    const parsed = presetSaveSchema.safeParse({
      ...(isCreate ? {} : { id }),
      name: values.name,
      query,
    });
    if (!parsed.success) {
      return {
        status: "invalid",
        fieldErrors: fieldErrorsOf<"name" | "query">(parsed.error, "name"),
        values,
      };
    }
    const fields = parsed.data;

    if (isCreate) {
      const { data: after, error } = await db
        .from("member_filter_presets")
        .insert({
          name: fields.name,
          query: fields.query,
          created_by: officer.userId,
        })
        .select(AUDITED_PRESET_COLUMNS)
        .single();

      if (error) {
        if (error.code === "23505") {
          return { status: "duplicate_name", values };
        }
        // 23514 here means the zod schema and the CHECK constraints have drifted
        // apart, which is a bug in this codebase rather than something the
        // officer can fix by retyping.
        console.error("savePreset failed:", error.message);
        return { status: "error" };
      }

      await writeAudit(db, {
        entityType: "member_preset",
        entityId: after.id,
        actorId: officer.userId,
        action: "preset.created",
        after,
        // The query is in `after` already; the name is what makes the row
        // readable at a glance in an audit browser.
        note: after.name,
      });

      revalidatePresets();
      return { status: "saved", id: after.id, name: after.name };
    }

    const { data: before, error: beforeError } = await db
      .from("member_filter_presets")
      .select(AUDITED_PRESET_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (beforeError) {
      console.error("savePreset read failed:", beforeError.message);
      return { status: "error" };
    }
    if (!before) return { status: "not_found" };

    const { data: after, error } = await db
      .from("member_filter_presets")
      .update({ name: fields.name, query: fields.query })
      .eq("id", id)
      // The same literal as `before`. Both sides of an audit before/after must
      // select the same columns — AuditTrail diffs the union of their keys and
      // renders a key present on one side only as `—`, inventing a change that
      // never happened.
      .select(AUDITED_PRESET_COLUMNS)
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return { status: "duplicate_name", values };
      }
      console.error("savePreset failed:", error.message);
      return { status: "error" };
    }
    if (!after) return { status: "not_found" };

    await writeAudit(db, {
      entityType: "member_preset",
      entityId: after.id,
      actorId: officer.userId,
      // One verb for both a rename and a re-point, the same granularity rule
      // member.updated follows: before/after already says which column moved,
      // and splitting by column adds rows without adding meaning.
      action: "preset.updated",
      before,
      after,
      note: after.name,
    });

    revalidatePresets();
    return { status: "saved", id: after.id, name: after.name };
  } catch (e) {
    console.error(
      "savePreset failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

export type PresetDeleteState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  /** Someone deleted it first. */
  | { status: "already_gone" }
  | { status: "done"; name: string };

/**
 * Delete a preset. A real delete, unlike archiving a field definition.
 *
 * The asymmetry is not an inconsistency: a definition is archived because
 * `members.custom_fields` holds values keyed to it, and a hard delete would
 * leave answers pointing at something nobody can look up — silently rewriting
 * what the roster said at the time. **Nothing references a preset.** It is a
 * saved URL; deleting it destroys no member's data and orphans nothing, so
 * keeping a tombstone would only clutter the chip row.
 *
 * The audit row survives it and names the preset, which is the record that
 * matters. `event.deleted` is the existing precedent for an audit row pointing
 * at a row that no longer exists.
 */
export async function deletePreset(
  _prev: PresetDeleteState,
  formData: FormData
): Promise<PresetDeleteState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const parsed = presetDeleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { status: "error" };
  const { id } = parsed.data;

  try {
    const db = createAdminClient();

    // Deleted with a returning select rather than read-then-delete: one round
    // trip, and zero rows back is an unambiguous "someone got there first" —
    // the same shape as voidAdjustment's `.is("voided_at", null)` guard. A
    // separate read would leave a window where both officers see the row and
    // the second reports success for a delete that did nothing.
    const { data: before, error } = await db
      .from("member_filter_presets")
      .delete()
      .eq("id", id)
      .select(AUDITED_PRESET_COLUMNS)
      .maybeSingle();

    if (error) {
      console.error("deletePreset failed:", error.message);
      return { status: "error" };
    }
    if (!before) return { status: "already_gone" };

    await writeAudit(db, {
      entityType: "member_preset",
      entityId: id,
      actorId: officer.userId,
      action: "preset.deleted",
      // `before` and no `after`, which is what AuditTrail renders as a removal.
      before,
      note: before.name,
    });

    revalidatePresets();
    return { status: "done", name: before.name };
  } catch (e) {
    console.error(
      "deletePreset failed:",
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

// Duplicated from app/actions/members.ts rather than shared: a "use server"
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

function revalidatePresets() {
  // Both screens render the list: the directory's chip row and the manage page.
  revalidatePath(DIRECTORY);
  revalidatePath(PRESETS);
}

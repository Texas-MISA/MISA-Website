"use client";

import { controlClass } from "@/components/ui/field";
import { BUTTON_PRIMARY_SM } from "@/components/ui/button";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  deletePreset,
  savePreset,
  type PresetDeleteState,
  type PresetSaveState,
} from "@/app/actions/presets";
import { MAX_PRESET_NAME } from "@/lib/presets";
import { Panel } from "@/components/ui/panel";

// One saved view on the manage screen: open it, rename it, delete it.
//
// A Client Component because both mutations are useActionState forms and the
// delete needs a confirm step. Two separate actions rather than one with an
// intent discriminator, matching how the codebase splits savePayment from
// voidPayment: they return genuinely different shapes and a union would make
// every render site check statuses that cannot occur.
//
// ⚠️ The delete confirmation is a two-click control, not `window.confirm`. A
// native dialog blocks the whole tab, which is precisely the failure mode the
// browser-automation notes warn about — and this codebase has no other modal.
//
// The RENAME form posts the preset's existing `query` back unchanged. savePreset
// writes both columns in one statement, so a rename that omitted it would blank
// the filter — the same shape of bug as the dues editor's uncontrolled selects,
// where a form posting a field it did not mean to change destroyed a real value.

const SAVE_INITIAL: PresetSaveState = { status: "idle" };
const DELETE_INITIAL: PresetDeleteState = { status: "idle" };

export function PresetRow({
  id,
  name,
  query,
  summary,
}: {
  id: string;
  name: string;
  query: string;
  summary: string;
}) {
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [saveState, saveAction, saving] = useActionState(
    savePreset,
    SAVE_INITIAL
  );
  const [deleteState, deleteAction, deleting] = useActionState(
    deletePreset,
    DELETE_INITIAL
  );

  // Close the rename box once the save lands, and keep it open if the action
  // came back with something to fix. Render-phase derived state rather than an
  // effect — useActionState has no reset, so `status` stays "saved" forever and
  // an effect would slam the box shut on the officer's second rename.
  const [seenSave, setSeenSave] = useState(saveState);
  if (saveState !== seenSave) {
    setSeenSave(saveState);
    setRenaming(saveState.status !== "saved");
  }

  // A deleted row is gone from the next render of the server component, so this
  // only paints for the instant before revalidation lands — and for the
  // already_gone case, where it is the whole message.
  if (deleteState.status === "done") return null;

  return (
    <Panel as="li" ground="white" pad="sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          {renaming ? (
            <form
              action={saveAction}
              className="flex flex-wrap items-center gap-2"
            >
              <input type="hidden" name="id" value={id} readOnly />
              {/* Unchanged, and load-bearing — see the note at the top. */}
              <input type="hidden" name="query" value={query} readOnly />
              <input
                name="name"
                required
                autoFocus
                maxLength={MAX_PRESET_NAME}
                // ⚠️ A string, never undefined. React 19 resets an uncontrolled
                // form once its action resolves, and a nullish defaultValue
                // following a non-nullish one makes React drop the attribute —
                // after which the reset clears what the officer was fixing.
                defaultValue={
                  saveState.status === "invalid" ||
                  saveState.status === "duplicate_name"
                    ? saveState.values.name
                    : name
                }
                className={controlClass("xs")}
              />
              <button
                type="submit"
                disabled={saving}
                className={BUTTON_PRIMARY_SM}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setRenaming(false)}
                className="px-2 py-1 text-xs underline underline-offset-4"
              >
                Cancel
              </button>
            </form>
          ) : (
            <Link
              href={`/admin/members?${query}`}
              className="font-display text-[18px] leading-[1.1] font-semibold text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
            >
              {name}
            </Link>
          )}

          <p className="mt-1 text-sm text-misa-secondary">{summary}</p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {!renaming && (
            <button
              type="button"
              onClick={() => setRenaming(true)}
              className="text-xs underline underline-offset-4"
            >
              Rename
            </button>
          )}

          {confirming ? (
            <form action={deleteAction} className="flex items-center gap-2">
              <input type="hidden" name="id" value={id} readOnly />
              <span className="text-xs">Delete this view?</span>
              <button
                type="submit"
                disabled={deleting}
                className={BUTTON_PRIMARY_SM}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="px-2 py-1 text-xs underline underline-offset-4"
              >
                Keep
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-xs underline underline-offset-4"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <Problem save={saveState} remove={deleteState} />
    </Panel>
  );
}

function Problem({
  save,
  remove,
}: {
  save: PresetSaveState;
  remove: PresetDeleteState;
}) {
  const message =
    save.status === "duplicate_name"
      ? "A view with that name already exists."
      : save.status === "not_found" || remove.status === "already_gone"
        ? "That view was deleted by someone else."
        : save.status === "unauthorized" || remove.status === "unauthorized"
          ? "Your session expired. Sign in again."
          : save.status === "error" || remove.status === "error"
            ? "Something went wrong. Nothing was changed."
            : save.status === "invalid"
              ? // 🐛 The query error is surfaced too, and not as an afterthought.
                // The walkthrough hit exactly this: a rename was refused because
                // the STORED query had canonicalised to nothing, and the officer
                // was told "Check that name" — a message about the one thing that
                // was fine. Reading only `name` here turns any other failure into
                // a lie about the field the officer is looking at.
                (save.fieldErrors.name?.[0] ??
                save.fieldErrors.query?.[0] ??
                "Couldn’t save that view.")
              : null;

  if (message === null) return null;
  return (
    <p role="alert" className="mt-2 text-xs font-medium">
      {message}
    </p>
  );
}

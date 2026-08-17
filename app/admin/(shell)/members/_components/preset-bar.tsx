"use client";

import { controlClass } from "@/components/ui/field";
import { BUTTON_PRIMARY_SM } from "@/components/ui/button";

import Link from "next/link";
import { useActionState, useState } from "react";

import { savePreset, type PresetSaveState } from "@/app/actions/presets";
import { MAX_PRESET_NAME } from "@/lib/presets";

// The saved-view chip row (§7 Stage 6 phase 7a), rendered above the count on
// /admin/members.
//
// A Client Component for the save form's useActionState; the chips themselves
// are plain links and could be server-rendered, but splitting them across two
// components would put the "which chip is active?" comparison in one file and
// the string it compares against in another.
//
// ⚠️ The active chip is decided by **string equality** between the current
// filter's canonical query string and the preset's stored one, not by diffing
// two filter objects. That works only because `memberFilterToParams` sorts its
// keys and omits defaults, so the string is a function of the filter rather
// than of the order the officer touched the controls — and because
// `savePreset` canonicalises through the same function before storing. If
// either of those stops being true, chips silently stop lighting up.

export type PresetChip = {
  id: string;
  name: string;
  query: string;
  /** Pre-rendered on the server: `presetSummary` needs the field definitions
   * and the event labels, neither of which this component has. */
  summary: string;
};

const SAVE_INITIAL: PresetSaveState = { status: "idle" };

export function PresetBar({
  presets,
  filterKey,
  canSave,
}: {
  presets: readonly PresetChip[];
  /** The current filter as its canonical query string — the same value the
   * export toolbar sends and the selection resets on. */
  filterKey: string;
  /**
   * False when the filter narrows nothing.
   *
   * ⚠️ Not cosmetic. A preset holding the empty query is a chip that promises a
   * narrowed roster and shows the whole thing — the phase-1 defect (a count
   * nobody can account for) saved as an object and shared with the team. This is
   * the first of three refusals; `presetSaveSchema` and
   * `member_filter_presets_query_bounded` are the other two.
   */
  canSave: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, saving] = useActionState(savePreset, SAVE_INITIAL);

  // Collapse the form once a save lands, and re-open it if the action speaks
  // again with a problem. The render-phase derived-state idiom this codebase
  // uses in grant-form.tsx and directory-row.tsx rather than an effect, so no
  // stale frame paints — and it is needed here for the same reason the dues
  // import needed it: useActionState has no reset, so `state.status` stays
  // "saved" forever and a plain `if (state.status === "saved") setOpen(false)`
  // in an effect would fight the officer trying to save a second view.
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    setOpen(state.status !== "saved");
  }

  const nothingSaved = presets.length === 0;

  // Nothing to show and nothing to save: no filter applied and no views yet.
  // Rendering an empty labelled row here would be chrome explaining a feature
  // the officer cannot use from where they are standing.
  if (nothingSaved && !canSave) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <span className="text-xs uppercase tracking-wider text-misa-muted">
        Saved views
      </span>

      {presets.map((preset) => {
        const active = preset.query === filterKey;
        return (
          <Link
            key={preset.id}
            href={`/admin/members?${preset.query}`}
            title={preset.summary}
            aria-current={active ? "true" : undefined}
            className={`border px-3 py-1 text-xs transition ${
              active
                ? "border-black bg-misa-blue text-white"
                : "border-misa-border hover:bg-misa-panel"
            }`}
          >
            {preset.name}
          </Link>
        );
      })}

      {nothingSaved && (
        <span className="text-xs text-misa-muted">
          None yet — filter the list, then save it here.
        </span>
      )}

      {canSave && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="border border-misa-border px-3 py-1 text-xs transition hover:bg-misa-panel"
        >
          Save this view…
        </button>
      )}

      {/* Shown rather than hidden when the filter is the default, so the reason
          is visible instead of the control simply being absent. */}
      {!canSave && !nothingSaved && (
        <span className="text-xs text-misa-muted">
          Narrow the list to save it as a view.
        </span>
      )}

      {canSave && open && (
        <form action={action} className="flex flex-wrap items-center gap-2">
          {/* The filter as it stands. Posted rather than re-derived server-side
              because a Server Action has no access to the page's URL, and
              re-reading it from a Referer header would be both fragile and a
              worse answer than the value the page already holds. */}
          <input type="hidden" name="query" value={filterKey} readOnly />

          <ReplaceOrCreate presets={presets} state={state} saving={saving} />

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-2 py-1 text-xs underline underline-offset-4"
          >
            Cancel
          </button>
        </form>
      )}

      <Problem state={state} />

      {presets.length > 0 && (
        <Link
          href="/admin/members/presets"
          className="text-xs underline underline-offset-4"
        >
          Manage
        </Link>
      )}
    </div>
  );
}

/**
 * The name box, plus the option to overwrite an existing view instead.
 *
 * "Update this view to what I am looking at now" only makes sense where a
 * current filter exists, which is this screen and not the manage page — so it
 * lives here, as a target selector on the one save form, rather than as a second
 * form somewhere with no filter to read.
 */
function ReplaceOrCreate({
  presets,
  state,
  saving,
}: {
  presets: readonly PresetChip[];
  state: PresetSaveState;
  saving: boolean;
}) {
  // Which existing preset is being overwritten, or "" for a new one. Local
  // state rather than uncontrolled, because the name box below has to appear
  // and disappear with it.
  const [target, setTarget] = useState("");
  const creating = target === "";

  // ⚠️ Echoed back as a STRING, never undefined. React 19 resets an uncontrolled
  // form once the action resolves, and a nullish defaultValue following a
  // non-nullish one makes React drop the attribute entirely — after which the
  // reset clears the box the officer is trying to correct.
  const submittedName =
    state.status === "invalid" || state.status === "duplicate_name"
      ? state.values.name
      : "";

  return (
    <>
      {presets.length > 0 && (
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          aria-label="Save as"
          className={controlClass("xs")}
        >
          <option value="">Save as a new view</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              Replace “{preset.name}”
            </option>
          ))}
        </select>
      )}

      {/* `id` present means update, absent means create — the same discriminator
          saveFieldDefinition and saveEvent use. Rendered conditionally rather
          than as an empty-valued input, because `asString` in the action treats
          "" as absent and a reader should not have to know that. */}
      {!creating && <input type="hidden" name="id" value={target} readOnly />}

      {/* 🐛 The `key`s are load-bearing, and the phase-7a walkthrough found out
          why: both branches render an `<input name="name">` in the same slot, so
          without them React reconciles the two as ONE input and warns that an
          uncontrolled input (the typed box, on defaultValue) is "changing to be
          controlled" (the hidden field, on value). It reuses the DOM node, which
          means switching target carries the officer's half-typed name into the
          hidden field — and switching back leaves a box whose displayed value
          React no longer owns. Distinct keys say what is actually true: these are
          two different controls, not one control changing mode. */}
      {creating ? (
        <input
          key="name-input"
          name="name"
          required
          maxLength={MAX_PRESET_NAME}
          placeholder="Name this view"
          defaultValue={submittedName}
          className={controlClass("xs")}
        />
      ) : (
        // The name travels with the update so a re-point cannot blank it —
        // `savePreset` writes both columns in one statement.
        <input
          key="name-hidden"
          type="hidden"
          name="name"
          value={presets.find((p) => p.id === target)?.name ?? ""}
          readOnly
        />
      )}

      <button
        type="submit"
        disabled={saving}
        className={BUTTON_PRIMARY_SM}
      >
        {saving ? "Saving…" : creating ? "Save" : "Replace"}
      </button>
    </>
  );
}

function Problem({ state }: { state: PresetSaveState }) {
  const message =
    state.status === "duplicate_name"
      ? "A view with that name already exists."
      : state.status === "not_found"
        ? "That view was deleted by someone else."
        : state.status === "unauthorized"
          ? "Your session expired. Sign in again."
          : state.status === "error"
            ? "Couldn’t save that view."
            : state.status === "invalid"
              ? // Both, never just the name — a query failure reported as a name
                // problem is a message about the one thing that was fine. See
                // the note in presets/_components/preset-row.tsx.
                (state.fieldErrors.name?.[0] ??
                state.fieldErrors.query?.[0] ??
                "Couldn’t save that view.")
              : null;

  if (message === null) return null;
  return (
    <span role="alert" className="text-xs font-medium">
      {message}
    </span>
  );
}

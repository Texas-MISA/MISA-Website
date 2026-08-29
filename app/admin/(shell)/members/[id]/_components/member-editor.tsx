"use client";

import { BUTTON_QUIET_SM } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";

import { useActionState, useCallback, useEffect, useState } from "react";

import {
  saveMemberNotes,
  type MemberNotesState,
} from "@/app/actions/members";
import { fieldValue, type FieldDefinition } from "@/lib/members";

import { SectionHeading } from "@/components/ui/page-header";
import { Notice } from "@/app/admin/(shell)/_components/notice";
import { MemberFieldCell } from "../../_components/member-field-cell";

// The member detail page's editable half (§7 Stage 6 phase 4).
//
// ⚠️ One client owner for the custom fields AND the notes, for the same reason
// directory-row.tsx owns its row: `members.updated_at` is a single row-level
// compare-and-set token that every one of these forms posts. Saving a field
// moves it, and a notes form still holding the render-time value would then
// report a phantom conflict on a save the officer had every right to make. So
// the token lives here and each form is handed the current one.
//
// ⚠️ Client Component: no Intl, no toLocale*. Node and Chrome ship different
// ICU data and the hydration diff shows two apparently identical strings. Any
// date arrives pre-formatted as a prop.

const NOTES_INITIAL: MemberNotesState = { status: "idle" };

export function MemberEditor({
  memberId,
  definitions,
  customFields,
  notes,
  updatedAt,
}: {
  memberId: string;
  /** Every definition, archived included — filtered here rather than by the
   * page, so the two sections cannot disagree about what is live. */
  definitions: FieldDefinition[];
  customFields: unknown;
  notes: string;
  updatedAt: string;
}) {
  const [token, setToken] = useState(updatedAt);

  const [seen, setSeen] = useState(updatedAt);
  if (seen !== updatedAt) {
    setSeen(updatedAt);
    setToken(updatedAt);
  }

  const adoptToken = useCallback((next: string) => setToken(next), []);

  const live = definitions.filter((d) => d.archivedAt === null);
  // Archived definitions this member still holds an answer for. Read-only:
  // archiving means "stop offering this", and re-setting a retired field from a
  // member's page would quietly work around that — but hiding the value outright
  // would make it unauditable, which is worse.
  const archivedHeld = definitions.filter(
    (d) => d.archivedAt !== null && fieldValue(customFields, d.key) !== null
  );

  return (
    <>
      <section className="mt-12 max-w-3xl">
        <SectionHeading>Custom fields</SectionHeading>

        {live.length === 0 && archivedHeld.length === 0 ? (
          <Notice className="mt-4">
            No custom fields are defined.
          </Notice>
        ) : (
          <dl className="mt-4 grid gap-3 sm:grid-cols-[14rem_1fr]">
            {live.map((definition) => (
              <FieldRow key={definition.key} label={definition.label}>
                {/* Every live field is editable here, including ones with
                    editable_inline off — that flag decides whether the DIRECTORY
                    table offers it, not whether the value can be set at all. */}
                <MemberFieldCell
                  memberId={memberId}
                  definition={definition}
                  value={fieldValue(customFields, definition.key) ?? ""}
                  updatedAt={token}
                  onSaved={adoptToken}
                />
              </FieldRow>
            ))}

            {archivedHeld.map((definition) => (
              <FieldRow key={definition.key} label={definition.label}>
                <span className="flex items-center gap-2 text-sm">
                  {fieldValue(customFields, definition.key)}
                  <span className="border border-misa-border px-1.5 py-0.5 text-[11px] uppercase tracking-[0.12em]">
                    archived
                  </span>
                </span>
              </FieldRow>
            ))}
          </dl>
        )}
      </section>

      <NotesEditor
        memberId={memberId}
        notes={notes}
        updatedAt={token}
        onSaved={adoptToken}
      />
    </>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-sm text-misa-muted">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </>
  );
}

function NotesEditor({
  memberId,
  notes,
  updatedAt,
  onSaved,
}: {
  memberId: string;
  notes: string;
  updatedAt: string;
  onSaved: (updatedAt: string) => void;
}) {
  const [state, formAction, pending] = useActionState(
    saveMemberNotes,
    NOTES_INITIAL
  );

  useEffect(() => {
    if (state.status === "done") onSaved(state.updatedAt);
  }, [state, onSaved]);

  // Echoed values win once the action has spoken, so a rejected save does not
  // discard what the officer wrote — React 19 resets an uncontrolled
  // `<form action>` when the action resolves.
  const value = "values" in state ? state.values.notes : notes;

  return (
    <section className="mt-12 max-w-3xl">
      <SectionHeading>Officer notes</SectionHeading>
      <p className="mt-2 text-sm text-misa-secondary">
        Visible to officers only. Never shown on the public site or the
        leaderboard.
      </p>

      <form action={formAction} className="mt-4">
        <input type="hidden" name="memberId" value={memberId} />
        <input type="hidden" name="expectedUpdatedAt" value={updatedAt} />

        {/* Keyed on the echoed value so React's post-action reset re-reads the
            defaultValue rather than restoring the pre-edit text. */}
        <textarea
          key={value}
          name="notes"
          defaultValue={value}
          rows={5}
          placeholder="Anything the next officer should know."
          className={controlClass("sm", "w-full")}
        />

        {state.status === "invalid" && state.fieldErrors.notes && (
          <p role="alert" className="mt-1 text-xs text-misa-critical">
            {state.fieldErrors.notes[0]}
          </p>
        )}

        <div className="mt-3 flex items-center gap-4">
          <button
            type="submit"
            disabled={pending}
            className={BUTTON_QUIET_SM}
          >
            {pending ? "SAVING…" : "SAVE NOTES"}
          </button>

          {state.status === "done" && (
            <span role="status" className="text-xs text-misa-affirm">
              Saved.
            </span>
          )}
          {state.status === "conflict" && (
            <span role="status" className="text-xs text-misa-caution">
              Someone else changed this member — reload and look again. Nothing
              here was saved.
            </span>
          )}
          {(state.status === "error" || state.status === "unauthorized") && (
            <span role="status" className="text-xs text-misa-caution">
              {state.status === "unauthorized"
                ? "Your session expired. Sign in again — nothing was saved."
                : "Something went wrong. Nothing was saved."}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

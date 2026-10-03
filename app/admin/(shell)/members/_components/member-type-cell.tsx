"use client";

import { controlClass } from "@/components/ui/field";

import {
  startTransition,
  useActionState,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { setMemberType, type MemberTypeState } from "@/app/actions/members";
import {
  formatMemberType,
  isMemberType,
  MEMBER_TYPES,
} from "@/lib/member-types";

// The member-type select (migration 30), copied from member-field-cell.tsx and
// shared the same way: the directory row and the member page's editor are the
// two places a type can be set, and one implementation is what keeps the
// compare-and-set and the conflict wording from drifting between them.
//
// ⚠️ The token is the ROW'S, never this cell's. `members.updated_at` is one
// row-level anchor shared by every editable cell in the row and every form on
// the member page, so the owner hands it in and this cell hands the fresh one
// back through `onSaved`. A type change followed by a notes save must not
// report a conflict, and this is how.
//
// ⚠️ No Intl, no toLocaleString. The labels are a string table
// (lib/member-types.ts); anything date-shaped would arrive pre-formatted.

const initial: MemberTypeState = { status: "idle" };

export function MemberTypeCell({
  memberId,
  value,
  updatedAt,
  onSaved,
  className = "",
}: {
  memberId: string;
  /** The member's type as stored. Always one of MEMBER_TYPES in practice; the
   * CHECK guarantees it, and the select still copes if it is not. */
  value: string;
  /** The row's current CAS token — owned by the parent, not by this cell. */
  updatedAt: string;
  /** Hands the parent the fresh token so sibling cells do not go stale. */
  onSaved: (updatedAt: string) => void;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(setMemberType, initial);

  // ⚠️ Controlled, not defaultValue — React 19 resets an uncontrolled `<form
  // action>` once the action resolves, and the pick would visibly snap back
  // for the length of the revalidation round trip. member-field-cell.tsx has
  // the longer note, and the half of the fix that being controlled is not.
  const [selected, setSelected] = useState(value);

  // Resync when the server sends a newer value: our own save after
  // revalidation, or another officer's. Reset-during-render, as the field cell.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setSelected(value);
  }

  // 🪤 A SUBMITTED form's reset() puts even a controlled <select> back on its
  // first-rendered option, after React's own update in that commit. So the DOM
  // is re-synced after every commit — no dependency list, because `selected`
  // does not change in the one that resets. member-field-cell.tsx has the note.
  const selectRef = useRef<HTMLSelectElement>(null);
  useLayoutEffect(() => {
    const select = selectRef.current;
    if (select && select.value !== selected) select.value = selected;
  });

  // An effect because it calls a PARENT's setter, which React forbids during
  // render. The token only moves when a save succeeds.
  useEffect(() => {
    if (state.status === "done") onSaved(state.updatedAt);
  }, [state, onSaved]);

  const message = markerOf(state);

  return (
    <form action={formAction} className={`flex items-center gap-2 ${className}`}>
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="expectedUpdatedAt" value={updatedAt} />

      <select
        ref={selectRef}
        name="memberType"
        aria-label="Member type"
        value={selected}
        disabled={pending}
        onChange={(event) => {
          setSelected(event.target.value);
          // Picking IS the save, as in every inline cell on this screen. The
          // audit log is the undo. Dispatched, never requestSubmit(): only a
          // submitted form is reset when its action resolves.
          const form = event.currentTarget.form;
          if (form) {
            const formData = new FormData(form);
            startTransition(() => formAction(formData));
          }
        }}
        className={controlClass("xs")}
      >
        {/* No empty option: the column is NOT NULL, and General is the answer
            for "nothing in particular". */}
        {MEMBER_TYPES.map((type) => (
          <option key={type} value={type}>
            {formatMemberType(type)}
          </option>
        ))}
        {/* A value outside the list would leave the select blank in every
            browser, and the officer's next pick would overwrite something they
            never saw. Shown so it can be read, disabled so it cannot be
            re-applied — memberTypeSchema would refuse it anyway. */}
        {!isMemberType(selected) && (
          <option value={selected} disabled>
            {selected} (not a member type)
          </option>
        )}
      </select>

      {/* The no-JavaScript and keyboard path, as in member-field-cell.tsx —
          and the one path still SUBMITTED, so the layout effect is its guard. */}
      <button type="submit" className="sr-only">
        Save member type
      </button>

      {pending ? (
        <span className="text-xs text-misa-muted">saving…</span>
      ) : message ? (
        <span className={`text-xs ${message.tone}`}>{message.text}</span>
      ) : null}

      {/* 🪤 The announcement, separate from the visible word beside the
          select. A live region must be in the DOM BEFORE its contents change,
          so it cannot be the conditional span above; `sr-only` is absolutely
          positioned, so it leaves this `flex … gap-2` row and adds no gap. */}
      <span role="status" className="sr-only">
        {pending ? "Saving member type" : (message?.text ?? "")}
      </span>
    </form>
  );
}

/** A word beside the select, not a banner — at a full roster anything larger
 * would push the table around every time an officer touched a select. */
function markerOf(
  state: MemberTypeState
): { text: string; tone: string } | null {
  switch (state.status) {
    case "done":
      return { text: "saved", tone: "text-misa-affirm" };
    case "conflict":
      return { text: "changed elsewhere — reload", tone: "text-misa-caution" };
    case "unauthorized":
      return { text: "signed out", tone: "text-misa-caution" };
    case "invalid":
    case "error":
      return { text: "not saved", tone: "text-misa-caution" };
    case "idle":
      return null;
  }
}

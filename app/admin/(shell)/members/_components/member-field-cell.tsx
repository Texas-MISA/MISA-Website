"use client";

import { controlClass } from "@/components/ui/field";

import { useActionState, useEffect, useState } from "react";

import {
  setMemberFieldValue,
  type MemberFieldState,
} from "@/app/actions/members";
import { fieldOptions, type FieldDefinition } from "@/lib/members";

// One editable custom-field cell (§7 Stage 6 phase 4).
//
// Shared by the directory table and the member detail page, deliberately: they
// are the two places a value can be set, and a second implementation is how
// option rejection, the orphan case, and the compare-and-set start behaving
// differently depending on which screen the officer happened to use.
//
// ⚠️ No Intl, no toLocaleString, nothing that formats a date. This is a Client
// Component, and Node and Chrome ship different ICU data — the resulting React
// diff shows two strings that look character-for-character identical. Any date
// that ever belongs here arrives pre-formatted as a prop.

const initial: MemberFieldState = { status: "idle" };

export function MemberFieldCell({
  memberId,
  definition,
  value,
  updatedAt,
  onSaved,
  className = "",
}: {
  memberId: string;
  definition: FieldDefinition;
  /** What the member holds today, or "" for no answer. */
  value: string;
  /** The row's current CAS token — owned by the parent, not by this cell. */
  updatedAt: string;
  /** Hands the parent the fresh token so sibling cells do not go stale. */
  onSaved: (updatedAt: string) => void;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(
    setMemberFieldValue,
    initial
  );

  // ⚠️ Controlled, not defaultValue. React 19 resets an uncontrolled
  // `<form action>` once the action resolves, so a defaultValue select would
  // visibly snap back to the previous option for the length of the revalidation
  // round trip — the officer sees their pick undone and picks again. Same class
  // of bug as the filter boxes in phase 1, same fix.
  const [selected, setSelected] = useState(value);

  // Resync when the server sends a newer value — another officer's save, or our
  // own after revalidation. Reset-during-render rather than an effect, matching
  // member-filters.tsx.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setSelected(value);
  }

  // An effect, and one of the few places it is the right tool: this calls a
  // *parent's* setter, which React forbids during render. The token only moves
  // when a save succeeds, so the dependency is the state object itself.
  useEffect(() => {
    if (state.status === "done") onSaved(state.updatedAt);
  }, [state, onSaved]);

  const options = fieldOptions(definition, selected || null);

  return (
    <form action={formAction} className={`flex items-center gap-2 ${className}`}>
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="key" value={definition.key} />
      <input type="hidden" name="expectedUpdatedAt" value={updatedAt} />

      <select
        name="value"
        aria-label={definition.label}
        value={selected}
        disabled={pending}
        onChange={(event) => {
          setSelected(event.target.value);
          // Auto-submit: picking IS the save. The audit log is the undo, and a
          // SAVE button beside every cell in a 25-row table is the thing this
          // screen exists to avoid.
          event.currentTarget.form?.requestSubmit();
        }}
        className={controlClass("xs")}
      >
        <option value="">—</option>
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            // An orphan is a value the member holds that the definition no
            // longer offers. Shown so it can be read and cleared, disabled so it
            // cannot be re-applied — isAllowedFieldValue would refuse it anyway.
            disabled={option.orphan}
          >
            {option.label}
          </option>
        ))}
      </select>

      {/* The only way this cell works before hydration, when onChange does
          nothing at all — and the keyboard path for anyone who changes the
          selection without firing a change event. No `name`, so the "never put
          formAction on a submit button whose name you read" trap is not even in
          scope here. */}
      <button type="submit" className="sr-only">
        Save {definition.label}
      </button>

      <Marker state={state} pending={pending} />
    </form>
  );
}

/** A word beside the cell, not a banner: at 25 rows anything larger would push
 * the table around every time an officer touched a dropdown. */
function Marker({
  state,
  pending,
}: {
  state: MemberFieldState;
  pending: boolean;
}) {
  if (pending) {
    return <span className="text-xs text-misa-muted">saving…</span>;
  }

  const message =
    state.status === "done"
      ? { text: "saved", tone: "text-misa-affirm" }
      : state.status === "conflict"
        ? {
            text: "changed elsewhere — reload",
            tone: "text-misa-caution",
          }
        : state.status === "rejected"
          ? {
              text:
                state.reason === "not_an_option"
                  ? "not an option any more"
                  : state.reason === "archived"
                    ? "field archived — reload"
                    : "field deleted — reload",
              tone: "text-misa-caution",
            }
          : state.status === "unauthorized"
            ? { text: "signed out", tone: "text-misa-caution" }
            : state.status === "invalid" || state.status === "error"
              ? { text: "not saved", tone: "text-misa-caution" }
              : null;

  if (!message) return null;

  return (
    <span role="status" className={`text-xs ${message.tone}`}>
      {message.text}
    </span>
  );
}

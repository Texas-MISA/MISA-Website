"use client";

import { useActionState } from "react";

import {
  saveFieldDefinition,
  type FieldFormState,
  type SubmittedFieldValues,
} from "@/app/actions/members";
import {
  MAX_FIELD_OPTIONS,
  MAX_OPTION_LENGTH,
  type FieldDefinition,
} from "@/lib/members";

// Create and edit share one form: the fields are identical and the only
// difference is whether an `id` is posted — the same arrangement event-form.tsx
// uses. The one real asymmetry is the KEY, which is set at creation and can
// never change afterwards, because every stored answer in members.custom_fields
// is filed under it.

const INITIAL: FieldFormState = { status: "idle" };

const inputClass =
  "border border-black/70 bg-misa-panel px-3 py-2 text-base w-full";

const EMPTY: SubmittedFieldValues = {
  key: "",
  label: "",
  options: "",
  editableInline: true,
  showInDirectory: true,
  sortOrder: "0",
};

export function FieldForm({ definition }: { definition?: FieldDefinition }) {
  const [state, formAction, pending] = useActionState(
    saveFieldDefinition,
    INITIAL
  );

  const isCreate = !definition;

  const current: SubmittedFieldValues = definition
    ? {
        key: definition.key,
        label: definition.label,
        options: definition.options.join("\n"),
        editableInline: definition.editableInline,
        showInDirectory: definition.showInDirectory,
        sortOrder: String(definition.sortOrder),
      }
    : EMPTY;

  // The echoed values win whenever the action has spoken, so a rejected save
  // does not throw away what the officer typed. React 19 resets an uncontrolled
  // `<form action>` once the action resolves, and every defaultValue below
  // reads off this line for exactly that reason.
  const values = "values" in state ? state.values : current;
  const errors = state.status === "invalid" ? state.fieldErrors : {};

  return (
    <form action={formAction} className="max-w-2xl">
      {definition && <input type="hidden" name="id" value={definition.id} />}

      <div className="flex flex-col gap-6">
        <Field label="Label" error={errors.label}>
          <input
            type="text"
            name="label"
            defaultValue={values.label}
            placeholder="Dues paid"
            className={inputClass}
          />
          <span className="text-xs text-foreground/60">
            What officers see — the column header and the field name. Safe to
            change at any time.
          </span>
        </Field>

        {isCreate ? (
          <Field label="Key" error={errors.key}>
            <input
              type="text"
              name="key"
              defaultValue={values.key}
              placeholder="dues_paid"
              className={inputClass}
            />
            <span className="text-xs text-foreground/60">
              Lowercase letters, numbers and underscores, starting with a
              letter. <span className="font-medium">This cannot be changed
              later</span> — every answer is stored under it, and renaming would
              orphan them all.
            </span>
          </Field>
        ) : (
          <div className="flex flex-col gap-1 text-sm">
            Key
            <p className="border border-black/20 bg-black/[0.03] px-3 py-2 font-mono text-sm">
              {current.key}
            </p>
            <span className="text-xs text-foreground/60">
              Fixed at creation. Every stored answer is filed under it, so
              renaming it would orphan them all — create a new field instead.
            </span>
          </div>
        )}

        <Field label="Options, one per line" error={errors.options}>
          <textarea
            name="options"
            defaultValue={values.options}
            rows={6}
            placeholder={"Paid\nUnpaid\nWaived"}
            className={inputClass}
          />
          <span className="text-xs text-foreground/60">
            Up to {MAX_FIELD_OPTIONS}, at most {MAX_OPTION_LENGTH} characters
            each, no two the same. Blank lines are ignored.{" "}
            <span className="font-medium">
              Removing an option does not change anyone&apos;s stored answer
            </span>{" "}
            — members keep it, and it shows as &ldquo;no longer an
            option&rdquo; until someone clears it.
          </span>
        </Field>

        <Field label="Order" error={errors.sortOrder}>
          <input
            type="number"
            name="sortOrder"
            defaultValue={values.sortOrder}
            min={0}
            step={1}
            className={`${inputClass} max-w-[8rem]`}
          />
          <span className="text-xs text-foreground/60">
            Lower numbers come first. Ties fall back to the key, so the order is
            always stable.
          </span>
        </Field>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="showInDirectory"
            defaultChecked={values.showInDirectory}
            className="mt-1"
          />
          <span>
            Show as a column in the directory
            <span className="block text-xs text-foreground/60">
              Off keeps it on the member&apos;s own page only. Every field ever
              created would otherwise widen the table forever — and a field that
              is not a column cannot be sorted on either.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="editableInline"
            defaultChecked={values.editableInline}
            className="mt-1"
          />
          <span>
            Editable straight from the directory table
            <span className="block text-xs text-foreground/60">
              Off means it can still be set, just from the member&apos;s page
              rather than in the list.
            </span>
          </span>
        </label>

        <Banner state={state} />

        <div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-misa-blue px-10 py-3 text-sm font-medium tracking-wider text-white transition hover:bg-misa-blue-dark disabled:opacity-60"
          >
            {pending
              ? "SAVING…"
              : isCreate
                ? "CREATE FIELD"
                : "SAVE CHANGES"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Banner({ state }: { state: FieldFormState }) {
  if (state.status === "idle" || state.status === "invalid") return null;

  const message =
    state.status === "saved"
      ? "Saved."
      : state.status === "duplicate_key"
        ? state.archived
          ? "A field with that key was archived earlier. Keys cannot be re-used — an archived field still holds every answer given under it, and a new field sharing its key would silently adopt them. Pick a different key."
          : "A field with that key already exists."
        : state.status === "unauthorized"
          ? "Your session expired. Sign in again — nothing was saved."
          : "Something went wrong. Nothing was saved.";

  const tone =
    state.status === "saved" ? "border-green-800" : "border-amber-700";

  return (
    <p role="status" className={`border-l-4 ${tone} bg-misa-panel px-4 py-3 text-sm`}>
      {message}
    </p>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      {children}
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error[0]}
        </span>
      )}
    </label>
  );
}

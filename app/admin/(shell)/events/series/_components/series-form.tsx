"use client";

import Link from "next/link";
import { useActionState } from "react";

import { createSeries, type SeriesFormState } from "@/app/actions/events";
import { BUTTON_PRIMARY, BUTTON_PRIMARY_SM } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import {
  EVENT_CATEGORIES,
  formatCategory,
  MAX_SERIES_EVENTS,
} from "@/lib/events";
import { SectionHeading } from "@/components/ui/page-header";
import { Notice } from "@/app/admin/(shell)/_components/notice";
import { Panel } from "@/components/ui/panel";

// Client Component for useActionState. Weekdays are checkboxes sharing one
// name, so they arrive as a repeated form field and the action reads them with
// formData.getAll.

const INITIAL: SeriesFormState = { status: "idle" };

const inputClass =
  controlClass("md", "w-full");

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
] as const;

export function SeriesForm({ defaultDate }: { defaultDate: string }) {
  const [state, formAction, pending] = useActionState(createSeries, INITIAL);

  const fieldErrors =
    state.status === "invalid" ? state.fieldErrors : undefined;

  if (state.status === "created") {
    return (
      <div
        role="status"
        className="border border-misa-affirm/45 bg-misa-affirm-wash px-6 py-6"
      >
        <SectionHeading>
          {state.count} draft {state.count === 1 ? "event" : "events"} created
        </SectionHeading>
        <p className="mt-2 leading-6 text-misa-body">
          They share one series and none of them are public yet. Review the
          schedule, then publish the whole series at once.
        </p>
        <Link
          href={`/admin/events?series=${state.seriesId}&term=all`}
          className={`mt-4 ${BUTTON_PRIMARY_SM}`}
        >
          Review the series
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6 border border-misa-border bg-white px-4 py-4" noValidate>
      {(state.status === "error" || state.status === "unauthorized") && (
        <Notice tone="error" role="alert">
          {state.status === "unauthorized"
            ? "Your session expired — sign in again and resubmit."
            : "Something went wrong creating the series. Nothing was saved."}
        </Notice>
      )}

      <Field label="Title" error={fieldErrors?.title}>
        <input
          type="text"
          name="title"
          required
          placeholder="General Meeting"
          className={inputClass}
        />
      </Field>

      <Field label="Description" error={fieldErrors?.description}>
        <textarea name="description" rows={2} className={inputClass} />
      </Field>

      <Field label="Location" error={fieldErrors?.location}>
        <input type="text" name="location" className={inputClass} />
      </Field>

      <Panel as="fieldset" ground="none" pad="sm">
        <legend className="px-2 text-sm font-medium">Repeats on</legend>
        {fieldErrors?.weekdays && (
          <span role="alert" className="text-xs text-misa-critical">
            {fieldErrors.weekdays[0]}
          </span>
        )}
        <div className="mt-2 flex flex-wrap gap-4">
          {WEEKDAYS.map((day) => (
            <label key={day.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 shrink-0 accent-misa-blue"
                name="weekdays"
                value={day.value}
                defaultChecked={day.value === 2}
              />
              {day.label}
            </label>
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="First date (Central)" error={fieldErrors?.date}>
          <input
            type="date"
            name="date"
            required
            defaultValue={defaultDate}
            className={inputClass}
          />
        </Field>
        <Field label="Repeat until (inclusive)" error={fieldErrors?.untilDate}>
          <input
            type="date"
            name="untilDate"
            required
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Starts" error={fieldErrors?.startTime}>
          <input
            type="time"
            name="startTime"
            required
            defaultValue="18:00"
            className={inputClass}
          />
        </Field>
        <Field label="Ends" error={fieldErrors?.endTime}>
          <input
            type="time"
            name="endTime"
            required
            defaultValue="19:00"
            className={inputClass}
          />
        </Field>
      </div>

      <Panel as="fieldset" ground="none" pad="sm">
        <legend className="px-2 text-sm font-medium">Check-in window</legend>
        <div className="mt-2 grid gap-6 sm:grid-cols-2">
          <Field label="Opens early (minutes)">
            <input
              type="number"
              name="openEarlyMinutes"
              min={0}
              max={1440}
              defaultValue={15}
              className={inputClass}
            />
          </Field>
          <Field label="Closes late (minutes)">
            <input
              type="number"
              name="closeLateMinutes"
              min={0}
              max={1440}
              defaultValue={15}
              className={inputClass}
            />
          </Field>
        </div>
      </Panel>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Points per occurrence" error={fieldErrors?.points}>
          <input
            type="number"
            name="points"
            min={0}
            max={100}
            required
            defaultValue={1}
            className={inputClass}
          />
        </Field>
        <Field label="Category" error={fieldErrors?.category}>
          <select
            name="category"
            defaultValue="general_and_other"
            className={inputClass}
          >
            <option value="">None</option>
            {EVENT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {formatCategory(category)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Series are always generated as drafts; the action ignores anything
          else, and publishing is a separate, deliberate step. */}
      <input type="hidden" name="status" value="draft" />

      <p className="text-xs text-misa-muted">
        At most {MAX_SERIES_EVENTS} events per series.
      </p>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className={`w-fit ${BUTTON_PRIMARY}`}
        >
          {pending ? "Creating…" : "Create series"}
        </button>
        <Link
          href="/admin/events"
          className="text-sm text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
        >
          Cancel
        </Link>
      </div>
    </form>
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
        <span role="alert" className="text-xs text-misa-critical">
          {error[0]}
        </span>
      )}
    </label>
  );
}

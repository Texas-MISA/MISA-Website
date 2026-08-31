"use client";

import { Banner } from "@/components/ui/banner";

import { BUTTON_QUIET_SM } from "@/components/ui/button";

import { useActionState } from "react";

import {
  setFieldArchived,
  type FieldArchiveState,
} from "@/app/actions/members";

// Archive / restore, as its own small form — the void-form.tsx shape. A
// separate <form action> rather than a link, so none of this can be triggered
// by a prefetch or a stray GET.

const INITIAL: FieldArchiveState = { status: "idle" };

export function FieldArchive({
  id,
  archived,
  holders,
}: {
  id: string;
  archived: boolean;
  /** How many members currently hold a value for this field. */
  holders: number;
}) {
  const [state, formAction, pending] = useActionState(
    setFieldArchived,
    INITIAL
  );

  return (
    <div>
      <p className="max-w-2xl text-sm text-misa-secondary">
        {archived ? (
          <>
            This field is archived: it is offered nowhere, and its key stays
            reserved so a new field cannot silently adopt the answers stored
            under it. Restoring puts it back exactly as it was.
          </>
        ) : (
          <>
            Archiving stops this field being offered anywhere.{" "}
            <span className="font-medium">Nobody&apos;s answer is deleted</span>{" "}
            — {holders === 0
              ? "no member holds a value for it today"
              : holders === 1
                ? "1 member holds a value, and it stays on their page"
                : `${holders} members hold a value, and it stays on their pages`}
            . There is no way to delete a field, deliberately: it would rewrite
            what the roster said at the time.
          </>
        )}
      </p>

      <form action={formAction} className="mt-4">
        <input type="hidden" name="id" value={id} />
        <input
          type="hidden"
          name="intent"
          value={archived ? "restore" : "archive"}
        />
        <button
          type="submit"
          disabled={pending || state.status === "done"}
          className={BUTTON_QUIET_SM}
        >
          {pending
            ? archived
              ? "Restoring…"
              : "Archiving…"
            : archived
              ? "Restore this field"
              : "Archive this field"}
        </button>
      </form>

      {state.status !== "idle" && (
        <Banner
          role="status"
          className="mt-4"
          tone={state.status === "done" ? "affirm" : "caution"}
        >
          {state.status === "done"
            ? state.archived
              ? "Archived. Every stored answer was kept."
              : "Restored."
            : state.status === "already_done"
              ? "Someone else already did that — reload to see the current state."
              : state.status === "unauthorized"
                ? "Your session expired. Sign in again — nothing changed."
                : "Something went wrong. Nothing changed."}
        </Banner>
      )}
    </div>
  );
}

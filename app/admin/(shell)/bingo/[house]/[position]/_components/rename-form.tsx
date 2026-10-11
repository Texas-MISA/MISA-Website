"use client";

import { useActionState } from "react";

import {
  renameBingoActivity,
  type RenameActivityState,
} from "@/app/actions/bingo";
import { MAX_ACTIVITY_LENGTH } from "@/lib/bingo";

import { Banner, type BannerTone } from "@/components/ui/banner";
import { buttonClass } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

// Renaming one activity. It changes the square on all four houses' cards, and
// no house's proof moves: a mark belongs to the square, not to its text.
//
// React 19 resets an uncontrolled `<form action>` once the action resolves, so
// the input's defaultValue comes from the text the action echoed back — but
// only while that text was typed against the version of the square this page
// still shows. After a save, or once a refresh brings in another officer's
// rename, the page's own name wins, and its token with it. Holding on to the
// old echo there would put stale text in front of a fresh token, and the next
// save would pass the compare-and-set over a change the officer never saw.

const INITIAL: RenameActivityState = { status: "idle" };

export function RenameForm({
  squareId,
  activity,
  updatedAt,
  doneCards,
}: {
  squareId: string;
  activity: string;
  /** The square's raw PostgREST updated_at: the rename's token. */
  updatedAt: string;
  /** How many houses have proof for this square. */
  doneCards: number;
}) {
  const [state, formAction, pending] = useActionState(
    renameBingoActivity,
    INITIAL
  );

  const echo =
    "values" in state && state.values.expectedUpdatedAt === updatedAt
      ? state.values
      : null;
  const fieldError =
    state.status === "invalid" && echo
      ? state.fieldErrors.activity?.[0]
      : undefined;
  const message = messageOf(state, updatedAt, echo !== null);

  const hint =
    doneCards === 0
      ? "Shown on all four houses' cards."
      : doneCards === 1
        ? "Shown on all four houses' cards. Done on 1 card. Its proof stays with the square."
        : `Shown on all four houses' cards. Done on ${doneCards} cards. Their proof stays with the square.`;

  return (
    <form
      action={formAction}
      className="border border-misa-border bg-white px-6 py-5"
    >
      <input type="hidden" name="squareId" value={squareId} readOnly />
      <input type="hidden" name="expectedUpdatedAt" value={updatedAt} readOnly />

      <Field label="Activity name" hint={hint} error={fieldError}>
        <Input
          name="activity"
          // ⚠️ A string, never undefined — see the note at the top.
          defaultValue={echo?.activity ?? activity}
          required
          autoComplete="off"
          // Twice the limit, because maxLength counts UTF-16 units and the
          // limit is code points: an emoji counts twice here and once in the
          // CHECK. The server holds the real line.
          maxLength={MAX_ACTIVITY_LENGTH * 2}
          aria-invalid={fieldError ? true : undefined}
        />
      </Field>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={buttonClass({ size: "sm" })}
        >
          {pending ? "Saving…" : "Save name"}
        </button>
      </div>

      {message && (
        <Banner tone={message.tone} className="mt-4">
          {message.text}
        </Banner>
      )}
      {/* Always mounted, so it is in the DOM before it has anything to say. */}
      <p role="status" className="sr-only">
        {pending ? "Saving the name" : (message?.text ?? fieldError ?? "")}
      </p>
    </form>
  );
}

/**
 * The banner for the last answer, or null. An answer about an older version of
 * the square than the one on the page (a save, then someone else's rename)
 * says nothing about the page any more, and is not shown.
 */
function messageOf(
  state: RenameActivityState,
  updatedAt: string,
  echoIsCurrent: boolean
): { tone: BannerTone; text: string } | null {
  switch (state.status) {
    case "idle":
      return null;
    case "saved":
      return state.updatedAt === updatedAt
        ? { tone: "affirm", text: "Saved. All four cards show the new name." }
        : null;
    case "unchanged":
      return state.updatedAt === updatedAt
        ? { tone: "info", text: "That is already the name, so nothing changed." }
        : null;
    case "invalid":
      // A field error is shown under the field; this is for a request whose
      // fault was not the name, which the page never builds.
      return echoIsCurrent && state.fieldErrors.activity === undefined
        ? {
            tone: "critical",
            text: "That rename couldn't be read. Reload the page and try again.",
          }
        : null;
    case "conflict":
      return echoIsCurrent
        ? {
            tone: "caution",
            text: "Someone else renamed this activity while you had the page open. Reload to see their name; what you typed is still in the box.",
          }
        : null;
    case "not_found":
      return {
        tone: "critical",
        text: "This square couldn't be found. Reload the page.",
      };
    case "unauthorized":
      return {
        tone: "critical",
        text: "Your session has expired. Sign in again, then try once more.",
      };
    case "error":
      return echoIsCurrent
        ? {
            tone: "critical",
            text: "Something went wrong and the name wasn't saved. Try again.",
          }
        : null;
  }
}

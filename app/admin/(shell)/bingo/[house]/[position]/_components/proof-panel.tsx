"use client";

import { useActionState, useState, type ReactNode } from "react";

import { removeBingoProof, type RemoveProofState } from "@/app/actions/bingo";
import type { MarkKind } from "@/lib/bingo";

import { Banner, type BannerTone } from "@/components/ui/banner";
import { buttonClass } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { ProofForm, type ProofUploaded } from "./proof-form";

// One house's proof for one square: the preview when it is done, with Replace
// and Remove, and the uploader when it is not.
//
// 📌 It stays mounted across the change it causes. Recording or removing proof
// refreshes the page, which swaps the preview for the uploader or back, and
// this panel keeps the sentence saying what just happened — and the live
// region that announces it — through the swap.
//
// ⚠️ Remove is a two-click control, never `window.confirm`: a native dialog
// blocks the whole tab, and this codebase has no other modal (preset-row.tsx,
// series-actions.tsx). Every button that is not the submit is type="button".

const REMOVE_INITIAL: RemoveProofState = { status: "idle" };

type Notice = { tone: BannerTone; text: string };

export function ProofPanel({
  house,
  houseName,
  position,
  mark,
  added,
  children,
}: {
  /** The house's slug, `m`. */
  house: string;
  /** "M House". */
  houseName: string;
  position: number;
  /** `updatedAt` is the raw PostgREST string: the replace and remove token. */
  mark: { id: string; updatedAt: string; kind: MarkKind } | null;
  /** "Added Oct 10, 3:04 PM CT", formatted on the server. */
  added: string | null;
  /** The preview, rendered on the server. */
  children: ReactNode;
}) {
  const [replacing, setReplacing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [removeState, removeAction, removing] = useActionState(
    removeBingoProof,
    REMOVE_INITIAL
  );

  // Leave the confirm step and say what happened whenever the remove action
  // answers. Render-phase derived state rather than an effect, because
  // useActionState has no reset (the same idiom as series-actions.tsx).
  const [seenRemove, setSeenRemove] = useState(removeState);
  if (removeState !== seenRemove) {
    setSeenRemove(removeState);
    setConfirming(false);
    setNotice(removeNotice(removeState, houseName));
  }

  function handleUploaded(status: ProofUploaded) {
    setReplacing(false);
    setNotice({
      tone: "affirm",
      text:
        status === "added"
          ? `Proof added. ${houseName}'s card shows this square done.`
          : "Proof replaced.",
    });
  }

  return (
    <Panel ground="white" pad="md">
      {/* 🪤 Always mounted, so it is in the DOM before it has anything to say:
          a live region that mounts holding its text is not announced. */}
      <p role="status" className="sr-only">
        {notice?.text ?? ""}
      </p>
      {notice && (
        <Banner tone={notice.tone} className="mb-4">
          {notice.text}
        </Banner>
      )}

      {mark === null ? (
        <ProofForm
          house={house}
          position={position}
          expectedUpdatedAt=""
          mode="upload"
          onUploaded={handleUploaded}
        />
      ) : (
        <>
          {children}
          {added && (
            <p className="mt-3 text-sm text-misa-secondary">{added}</p>
          )}

          {replacing ? (
            <div className="mt-5 border-t border-misa-hairline pt-5">
              <ProofForm
                house={house}
                position={position}
                expectedUpdatedAt={mark.updatedAt}
                mode="replace"
                onUploaded={handleUploaded}
                onCancel={() => setReplacing(false)}
              />
            </div>
          ) : confirming ? (
            <form
              action={removeAction}
              className="mt-5 border-t border-misa-hairline pt-5"
            >
              <input type="hidden" name="markId" value={mark.id} readOnly />
              <input
                type="hidden"
                name="expectedUpdatedAt"
                value={mark.updatedAt}
                readOnly
              />
              {/* The blast radius, named: which card, where, and the file. */}
              <p className="text-sm text-foreground">
                This marks the square not done for {houseName} on the member
                portal and deletes the {mark.kind}. It can&apos;t be undone.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={removing}
                  className={buttonClass({ variant: "danger", size: "sm" })}
                >
                  {removing ? "Removing…" : `Remove the ${mark.kind}`}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={removing}
                  className={buttonClass({ variant: "quiet", size: "sm" })}
                >
                  Keep it
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setReplacing(true);
                  setNotice(null);
                }}
                className={buttonClass({ variant: "outline", size: "sm" })}
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(true);
                  setNotice(null);
                }}
                className={buttonClass({ variant: "danger", size: "sm" })}
              >
                Remove
              </button>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function removeNotice(state: RemoveProofState, houseName: string): Notice | null {
  switch (state.status) {
    case "idle":
      return null;
    case "removed":
      return {
        tone: "affirm",
        text: `Proof removed. ${houseName}'s card shows this square not done.`,
      };
    case "conflict":
      return {
        tone: "caution",
        text: "Someone else just changed this square. Reload to see it.",
      };
    case "not_found":
      return {
        tone: "caution",
        text: "This proof was already removed. Reload to see the square.",
      };
    case "unauthorized":
      return {
        tone: "critical",
        text: "Your session has expired. Sign in again, then try once more.",
      };
    case "invalid":
      return {
        tone: "critical",
        text: "That request couldn't be read. Reload the page and try again.",
      };
    case "error":
      return {
        tone: "critical",
        text: "Something went wrong and nothing was removed. Try again.",
      };
  }
}

"use client";

import { Check, Play } from "lucide-react";
import Image from "next/image";
import { useId, useRef, useState } from "react";

import type { MarkKind } from "@/lib/bingo";

import { buttonClass } from "@/components/ui/button";
import { TILE_LABEL } from "./tile-label";

// One DONE square of one house's card, and the dialog that shows its proof.
// A square that is not done is plain text on the page; only a done one is a
// control, because only a done one has something to open.
//
// Every URL arrives as a plain string, computed on the server: this component
// never sees a Supabase client.
//
// 📌 The tile loads only the THUMBNAIL (a photo's, or a video's poster frame),
// lazily, as the grid scrolls into view. The full photo or the video is not
// even in the DOM until the dialog opens, and leaves it again on close: the
// Supabase Free plan's egress is limited, and four cards can hold 96 proofs.
//
// 🪤 A native <dialog> opened with showModal(), which supplies the modal
// behaviour itself: the page behind goes inert, Tab stays inside, and Esc
// closes it. Two consequences for the markup. The dialog element carries NO
// display utility, because author CSS beats the user agent's
// `dialog:not([open]) { display: none }` and a closed dialog would render in
// the grid; its layout is on the inner <div>. And it needs `m-auto`, because
// Tailwind's preflight zeroes every margin, including the auto margins that
// centre a modal dialog.
//
// 🪤 `data-bingo-proof` is how bingo-refresher.tsx knows a proof is open, and it
// skips its refresh while one is: the member may be watching a video.

export function ProofTile({
  activity,
  houseName,
  kind,
  thumbUrl,
  mediaUrl,
}: {
  /** The square's activity, as every card shows it. */
  activity: string;
  /** "M House". */
  houseName: string;
  kind: MarkKind;
  /** The photo's thumbnail or the video's poster frame, or null for a video
   * recorded without a poster. */
  thumbUrl: string | null;
  /** The full photo, or the video. */
  mediaUrl: string;
}) {
  const id = useId();
  const nameId = `${id}-name`;
  const stateId = `${id}-state`;
  const headingId = `${id}-heading`;
  const tileRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Whether the media is mounted. It goes in as the dialog opens and comes out
  // when it closes, so nothing past the thumbnail loads until it is asked for.
  const [showing, setShowing] = useState(false);

  const what = `${activity}, ${houseName}`;
  const proof = `${kind === "video" ? "Proof video" : "Proof photo"}: ${what}`;

  function openProof() {
    const dialog = dialogRef.current;
    if (dialog === null || dialog.open) return;
    setShowing(true);
    // Opened at once, from the click. The media renders a moment later, so the
    // dialog's first focusable element, which showModal() focuses, is Close.
    dialog.showModal();
  }

  // The dialog's `close` event, however it closed: Close, Esc, or the browser.
  function handleClose() {
    videoRef.current?.pause();
    setShowing(false);
    // The browser usually does this itself; Safari does not focus a button on
    // click, so it would have nothing to go back to.
    tileRef.current?.focus();
  }

  return (
    <>
      <button
        ref={tileRef}
        type="button"
        onClick={openProof}
        aria-haspopup="dialog"
        // The visible activity plus the sr-only state. Not the picture's alt,
        // which would say the activity twice.
        aria-labelledby={`${nameId} ${stateId}`}
        // `relative` and the focus z-index so the focus ring, which sits 2px
        // outside the tile, is drawn over the neighbouring tiles, not under.
        className="group relative flex h-full w-full cursor-pointer flex-col bg-misa-blue text-white focus-visible:z-10"
      >
        <span className="relative block min-h-8 flex-1 overflow-hidden bg-misa-panel sm:min-h-12">
          {thumbUrl !== null ? (
            // `unoptimized`: resized on the officer's device already, and
            // served by Supabase Storage rather than by Next. Lazy, as next/image
            // is by default: the grid runs well below the fold on a phone.
            <Image src={thumbUrl} alt={proof} fill unoptimized className="object-cover" />
          ) : (
            // A video recorded without a poster (a browser that could not
            // decode it) has no picture, so it shows what it is instead.
            <span className="absolute inset-0 flex items-center justify-center text-misa-secondary">
              <Play aria-hidden className="size-5" />
            </span>
          )}
          {/* The done mark, in a solid corner so it never sits on raw photo.
              Colour is not the only signal: this glyph, the picture, and the
              sr-only "done" all say it. */}
          <span className="absolute top-0 right-0 flex bg-misa-blue p-0.5 text-white">
            <Check aria-hidden className="size-3 sm:size-3.5" strokeWidth={3} />
          </span>
        </span>
        {/* A solid band, never text over the photo: white on Drafting Navy is
            13:1, and on Pressed Navy (the hover) more. The label class is
            tile-label.ts's, shared with the open squares, and the 2px phone
            padding is the one that file's measurements assume. */}
        <span
          className={`block px-0.5 py-1 text-center transition-colors duration-150 group-hover:bg-misa-blue-dark sm:px-2 sm:py-1.5 ${TILE_LABEL}`}
        >
          <span id={nameId}>{activity}</span>
          <span id={stateId} className="sr-only">
            , {houseName}, done
          </span>
        </span>
      </button>

      <dialog
        ref={dialogRef}
        data-bingo-proof=""
        aria-labelledby={headingId}
        onClose={handleClose}
        className="m-auto w-[calc(100%_-_2rem)] max-w-3xl overscroll-contain bg-white text-foreground shadow-overlay backdrop:bg-misa-blue-dark/70"
      >
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <h2
              id={headingId}
              className="min-w-0 font-display text-[22px] leading-[1.05] font-semibold wrap-break-word sm:text-[26px]"
            >
              {activity}
              <span className="sr-only">, </span>
              <span className="mt-1 block font-sans text-sm leading-normal font-medium text-misa-secondary">
                {houseName}
              </span>
            </h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className={buttonClass({ variant: "outline", size: "sm", className: "shrink-0" })}
            >
              Close
            </button>
          </div>

          <div className="mt-4">
            {showing && kind === "photo" && (
              <div className="relative h-[60dvh] w-full bg-misa-panel sm:h-[70dvh]">
                {/* Eager: it is mounted only because the member opened it. */}
                <Image
                  src={mediaUrl}
                  alt={proof}
                  fill
                  unoptimized
                  loading="eager"
                  className="object-contain"
                />
              </div>
            )}
            {showing && kind === "video" && (
              // 🪤 `src` on the element and NO `type`: Chrome refuses
              // type="video/quicktime" outright, yet plays the same H.264 file
              // without it. preload="none", so nothing downloads until play.
              <video
                ref={videoRef}
                controls
                playsInline
                preload="none"
                poster={thumbUrl ?? undefined}
                src={mediaUrl}
                aria-label={proof}
                className="block h-[60dvh] w-full bg-foreground object-contain sm:h-[70dvh]"
              />
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}

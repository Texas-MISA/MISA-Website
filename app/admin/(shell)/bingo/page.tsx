import { Film } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ReadError } from "@/app/admin/(shell)/_components/notice";
import { requireOfficer } from "@/lib/auth";
import {
  formatProgress,
  HOUSES,
  houseCard,
  houseLabel,
  houseProgress,
  houseSlug,
  markThumbUrl,
  parseHouseParam,
  readBingoBoard,
  type BingoBoard,
  type BingoCell,
  type House,
} from "@/lib/bingo";
import { createAdminClient } from "@/lib/supabase/admin";

import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";

// House bingo, the officer's view (migration 33): one house's card at a time,
// switched by ?house=m|i|s|a. Every activity cell opens its square's page,
// where proof is added, replaced or removed and the activity renamed.
//
// The cards are one shared board: the same 24 activities in the same places
// on all four, and the centre (12) is the free square, which shows the house
// letter and is never stored. Members see all four on the portal.
//
// 📌 Below `sm` the 5×5 grid becomes one column, in reading order, with the
// free square in its place between 11 and 13. An officer opens this on a phone
// right after an activity, and a card of 24 seventy-pixel cells is not
// something to find a square in with a thumb.

export const metadata: Metadata = { title: "House bingo" };

// requireOfficer reads cookies, so this is dynamic anyway; stated so the board
// can never be served from a cache after proof is added.
export const dynamic = "force-dynamic";

export default async function BingoBoardPage({
  searchParams,
}: {
  // Promise in Next 16 — await before reading.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOfficer();

  // A missing or unknown house shows M's card rather than an error: the
  // switcher is right there, and every card is equally valid.
  const house: House = parseHouseParam((await searchParams).house) ?? "M";

  const db = createAdminClient();
  const result = await readBingoBoard(db);

  return (
    <div>
      <PageHeader
        title="House bingo"
        description={
          <>
            Members see all four cards at{" "}
            <Link
              href="/portal/bingo"
              className="text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
            >
              /portal/bingo
            </Link>
            .
          </>
        }
      />

      {result.kind === "error" ? (
        // 🔓 Never an empty card: a board that failed to load is not a board
        // with nothing done, and an officer reading it as one would re-add
        // proof that is already there.
        <ReadError what="the bingo board" className="mt-8" />
      ) : (
        <Card
          board={result.board}
          house={house}
          thumbs={thumbsFor(db, result.board, house)}
        />
      )}
    </div>
  );
}

/** Each of this house's marks' card pictures, by square id. A video recorded
 * without a poster has none. */
function thumbsFor(
  db: ReturnType<typeof createAdminClient>,
  board: BingoBoard,
  house: House
): Map<string, string | null> {
  return new Map(
    board.marks
      .filter((mark) => mark.house === house)
      .map((mark) => [mark.squareId, markThumbUrl(db, mark)])
  );
}

function Card({
  board,
  house,
  thumbs,
}: {
  board: BingoBoard;
  house: House;
  thumbs: Map<string, string | null>;
}) {
  const slug = houseSlug(house);

  return (
    <>
      <nav aria-label="Houses" className="mt-8">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {HOUSES.map((option) => {
            const selected = option === house;
            return (
              <li key={option}>
                <Link
                  href={`/admin/bingo?house=${houseSlug(option)}`}
                  aria-current={selected ? "page" : undefined}
                  className={`flex items-baseline justify-between gap-3 border px-4 py-3 transition-colors duration-150 ${
                    selected
                      ? "border-misa-blue bg-misa-blue text-white"
                      : "border-misa-border bg-white text-foreground hover:border-misa-blue hover:text-misa-blue"
                  }`}
                >
                  <span className="font-display text-[18px] leading-none font-semibold">
                    {houseLabel(option)}
                  </span>
                  <span
                    className={`text-xs ${selected ? "text-white/80" : "text-misa-secondary"}`}
                  >
                    {formatProgress(houseProgress(board, option))}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <section aria-labelledby="bingo-card" className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <SectionHeading id="bingo-card">
            {houseLabel(house)}&apos;s card
          </SectionHeading>
          <p className="text-sm text-misa-secondary">
            {formatProgress(houseProgress(board, house))} done
          </p>
        </div>

        {/* One plate, the rule drawn once by `gap-px` showing the hairline
            through — never a border per cell, which would draw two. */}
        <ol className="mt-4 grid grid-cols-1 gap-px border border-misa-hairline bg-misa-hairline sm:grid-cols-5">
          {houseCard(board, house).map((cell) => (
            <li
              key={cell.position}
              className={`min-w-0 ${cell.kind === "free" ? "bg-misa-blue" : "bg-white"}`}
            >
              {cell.kind === "free" ? (
                <FreeSquare house={house} />
              ) : (
                <ActivitySquare
                  cell={cell}
                  slug={slug}
                  thumb={thumbs.get(cell.square.id) ?? null}
                />
              )}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

function ActivitySquare({
  cell,
  slug,
  thumb,
}: {
  cell: Extract<BingoCell, { kind: "activity" }>;
  slug: string;
  thumb: string | null;
}) {
  const done = cell.mark !== null;

  return (
    <Link
      href={`/admin/bingo/${slug}/${cell.position}`}
      className="group flex h-full min-h-16 items-center gap-3 p-3 transition-colors duration-150 hover:bg-misa-panel sm:min-h-36 sm:flex-col sm:items-stretch sm:gap-2"
    >
      {done && <Thumbnail src={thumb} />}
      <span className="min-w-0 flex-1 text-sm leading-snug font-medium break-words text-foreground group-hover:text-misa-blue">
        {cell.square.activity}
      </span>
      {done ? (
        <Pill tone="affirm" size="sm" className="shrink-0 self-center sm:self-start">
          Done
        </Pill>
      ) : (
        // Secondary, not muted: the cell turns Vellum on hover, and muted ink
        // fails AA on Vellum.
        <span className="shrink-0 text-xs text-misa-secondary">Not done</span>
      )}
    </Link>
  );
}

/** The proof's card picture: a photo's thumbnail or a video's poster frame,
 * cropped to fill. Decorative — the cell's text already says what and whether. */
function Thumbnail({ src }: { src: string | null }) {
  return (
    <span className="relative block size-14 shrink-0 overflow-hidden bg-misa-panel sm:aspect-[4/3] sm:size-auto sm:w-full">
      {src ? (
        // `unoptimized`: the file is already resized on the officer's device,
        // and it is served by Supabase Storage, not by Next.
        <Image src={src} alt="" fill unoptimized className="object-cover" />
      ) : (
        // A video recorded without a poster (a browser that could not decode
        // it) has nothing to show but what it is.
        <span className="flex size-full items-center justify-center text-misa-secondary">
          <Film aria-hidden className="size-5" />
        </span>
      )}
    </span>
  );
}

function FreeSquare({ house }: { house: House }) {
  return (
    <div className="flex h-full min-h-16 items-center gap-3 p-3 text-white sm:min-h-36 sm:flex-col sm:justify-center sm:gap-1">
      <span
        aria-hidden
        className="font-display text-[34px] leading-none font-semibold"
      >
        {house}
      </span>
      <span className="text-xs tracking-[0.12em] text-white/80 uppercase">
        Free square
      </span>
    </div>
  );
}

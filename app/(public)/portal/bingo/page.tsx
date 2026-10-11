import type { Metadata } from "next";

import { ReadError } from "@/components/ui/banner";
import { PageHero } from "@/components/ui/chevron-section";
import { Title } from "@/components/ui/heading";
import { Panel } from "@/components/ui/panel";
import { Section } from "@/components/ui/section";
import {
  ACTIVITY_COUNT,
  formatProgress,
  HOUSES,
  houseCard,
  houseLabel,
  houseProgress,
  houseSlug,
  houseStandings,
  markMediaUrl,
  markThumbUrl,
  readBingoBoard,
  type BingoBoard,
  type House,
} from "@/lib/bingo";
import { createAdminClient } from "@/lib/supabase/admin";

import { BingoRefresher } from "./_components/bingo-refresher";
import { ProofTile } from "./_components/proof-tile";
import { TILE_LABEL } from "./_components/tile-label";

// House bingo, the members' view (migration 33): all four houses' cards and how
// far along each house is. Officers record the proof in /admin/bingo; this page
// only reads. The four houses play ONE card, the same 24 activities in the same
// places, with the free centre (12) showing the house, and the score is just
// "N of 24" (user's decisions, 2026-10-10).
//
// Built from shared primitives only: the member area's real visual design
// belongs to v2 phase 3, and this page should not pre-empt it.
//
// ── THE LAYOUT-FAMILY BUDGET ────────────────────────────────────────────────
//
//   1. Hero ........... Page hero (field + chevron notch)
//   2. The board ...... The rule, the standings on one white panel, then the
//                       four cards: 5×5 shared-rule plates, two by two from lg
//
// TWO sections, TWO families. Eyebrow cap would be ceil(2 / 3) = 1; the page
// uses zero.
//
// 🪤 NOTHING that changes on a refresh carries `data-reveal`: not the
// standings, the cards or a tile. The observer scans once per pathname, and
// router.refresh() keeps the pathname, so a node that mounts on a refresh
// would sit at opacity 0 for good. Only PageHero's own framing reveals.
//
// 🪤 The page ground is grey, where `--misa-muted` measures 4.33:1 and fails
// AA, so the copy written straight onto it (the rule, each card's count) uses
// `--misa-secondary`, 7.60:1. The tiles and the standings sit on white.

// robots is per page, never on a portal layout (see app/(public)/portal/page.tsx).
// Not indexable: the proof photos are of students, and a search engine's copy
// of this page would outlive a photo an officer removed.
export const metadata: Metadata = {
  title: "House Bingo",
  description: "All four house bingo cards, and how far along each house is.",
  robots: { index: false, follow: false },
};

// 🪤 Not cached, and NOTHING revalidates this page: there is no
// revalidatePath("/portal/bingo") anywhere, on purpose. The officers' writes
// (app/actions/bingo.ts and /admin/bingo/upload) revalidate /admin only, and
// force-dynamic means they never need to: every request reads the board
// afresh, so an officer's proof appears on a member's next request, or within
// about ten seconds on an open page, through BingoRefresher. The cost is two
// small reads per request, 24 squares and at most 96 marks.
//
// ⚠️ If this ever becomes a cache, both of those write paths need a
// revalidatePath for it in the same commit. Do not add one without changing
// this line.
export const dynamic = "force-dynamic";

/** The rule printed on the club's card, verbatim. */
const RULE = "All tiles must be completed with at least half of house members.";

type Db = ReturnType<typeof createAdminClient>;

export default async function HouseBingoPage() {
  // 🔓 The SERVICE ROLE, deliberately, as on /officer-invite/[token]. Both
  // tables are RLS deny-all with no anon grant, so the anon client gets zero
  // rows, which readBingoBoard calls an error rather than an empty board. What
  // it returns carries nothing about members or officers (who added a mark is
  // in admin_audit, and never read here), and the client components below get
  // plain strings: every URL is built here.
  const db = createAdminClient();
  const result = await readBingoBoard(db);

  return (
    <>
      {/* 1. LAYOUT FAMILY: Page hero. Static framing, so its reveal is safe.
          No subhead, like the hub's (user, 2026-10-11). */}
      <PageHero title="House Bingo" />

      {/* 2. LAYOUT FAMILY: The board. */}
      <Section padTop="sm" padBottom="md" width="page">
        <p className="max-w-[68ch] leading-[1.6] text-misa-secondary">{RULE}</p>

        {/* 🔓 Never "0 of 24" for a read that failed. A board that did not load
            is not a board with nothing done, and every house would read it as
            its proof having vanished. */}
        {result.kind === "error" ? (
          <ReadError what="the bingo cards" className="mt-6" />
        ) : (
          <>
            <Standings board={result.board} />
            <div className="mt-12 grid gap-x-card gap-y-12 lg:grid-cols-2">
              {HOUSES.map((house) => (
                <HouseCard key={house} db={db} board={result.board} house={house} />
              ))}
            </div>
          </>
        )}
      </Section>

      <BingoRefresher />
    </>
  );
}

/** M, I, S and A in that order, never sorted (houseStandings says why). */
function Standings({ board }: { board: BingoBoard }) {
  return (
    <Panel as="section" aria-labelledby="bingo-standings" className="mt-6">
      <h2 id="bingo-standings" className="sr-only">
        Standings
      </h2>
      {/* 🪤 A live region from first paint, so a refresh that moves a count is
          announced: React updates the text in place, and each line is atomic,
          so it is read whole ("M House, 4 of 24"), not as a bare number. A
          region that mounted already holding its text would say nothing. */}
      <ul aria-live="polite" className="grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        {houseStandings(board).map(({ house, done }) => (
          <li key={house} aria-atomic="true">
            <p className="flex items-baseline justify-between gap-3">
              <span className="font-display text-[22px] leading-none font-semibold text-misa-blue">
                {houseLabel(house)}
              </span>
              <span className="sr-only">, </span>
              <span className="text-sm font-medium text-misa-secondary">
                {formatProgress(done)}
              </span>
            </p>
            {/* Decorative: the text above already says it, and a bar that
                announced itself would say it twice. The track is a light step
                of the same navy, so the bar reads as one scale. */}
            <span aria-hidden="true" className="mt-3 block h-2 bg-misa-blue/15">
              <span
                className="block h-full bg-misa-blue"
                style={{ width: `${(done / ACTIVITY_COUNT) * 100}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function HouseCard({ db, board, house }: { db: Db; board: BingoBoard; house: House }) {
  const name = houseLabel(house);
  const headingId = `bingo-${houseSlug(house)}`;

  return (
    // One card a row until lg. Between sm and lg the column is wide enough to
    // make a 5×5 card enormous, so it stops at max-w-xl there.
    <section aria-labelledby={headingId} className="min-w-0 sm:mx-auto sm:w-full sm:max-w-xl lg:max-w-none">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Title as="h2" id={headingId} className="text-misa-blue">
          {name}
        </Title>
        <p className="text-sm text-misa-secondary">
          {formatProgress(houseProgress(board, house))}
        </p>
      </div>

      {/* 📌 The grid's rows are at least as tall as a column is wide, so the
          card is square; a row grows past that only when a tile's text needs
          it, and every tile in the row grows with it. 100cqw is this wrapper's
          width: the plate inside has a 1px frame each side and four 1px gaps,
          hence the 6px. One plate, the rule drawn once by `gap-px` showing
          the hairline through, never a border per tile. */}
      <div className="mt-4 @container">
        <ol className="grid auto-rows-[minmax(calc((100cqw_-_6px)/5),auto)] grid-cols-5 gap-px border border-misa-hairline bg-misa-hairline">
          {houseCard(board, house).map((cell) => (
            <li
              key={cell.position}
              className={`min-w-0 ${cell.kind === "free" ? "bg-misa-blue" : "bg-white"}`}
            >
              {cell.kind === "free" ? (
                <FreeSquare house={house} />
              ) : cell.mark === null ? (
                <OpenSquare activity={cell.square.activity} />
              ) : (
                <ProofTile
                  activity={cell.square.activity}
                  houseName={name}
                  kind={cell.mark.kind}
                  thumbUrl={markThumbUrl(db, cell.mark)}
                  mediaUrl={markMediaUrl(db, cell.mark)}
                />
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** A square this house has not done: its activity, as plain content. */
function OpenSquare({ activity }: { activity: string }) {
  return (
    <p
      className={`flex h-full items-center justify-center px-0.5 py-1 text-center text-foreground sm:p-2 ${TILE_LABEL}`}
    >
      <span>
        {activity}
        <span className="sr-only">, not done</span>
      </span>
    </p>
  );
}

/** The free centre: the house, as the printed card has it. Never a control. */
function FreeSquare({ house }: { house: House }) {
  return (
    <p className="flex h-full flex-col items-center justify-center gap-0.5 p-1 text-center text-white">
      {/* Drawn as two stacked pieces, read as one phrase: the stacked spans
          have no space between them, so they would be read "MHouse". */}
      <span
        aria-hidden="true"
        className="font-display text-[26px] leading-none font-semibold sm:text-[34px]"
      >
        {house}
      </span>
      <span
        aria-hidden="true"
        className="text-[11px] leading-none font-medium tracking-[0.12em] text-white/80 uppercase sm:text-xs"
      >
        House
      </span>
      <span className="sr-only">{houseLabel(house)}, the free square</span>
    </p>
  );
}

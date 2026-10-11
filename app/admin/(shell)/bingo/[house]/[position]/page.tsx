import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { AuditTrail } from "@/app/admin/(shell)/_components/audit-trail";
import { ReadError } from "@/app/admin/(shell)/_components/notice";
import { requireOfficer } from "@/lib/auth";
import {
  houseLabel,
  houseSlug,
  markMediaUrl,
  markThumbUrl,
  parseActivityPosition,
  parseHouseParam,
  readBingoBoard,
} from "@/lib/bingo";
import { formatInstant } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";

import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Pill } from "@/components/ui/pill";
import { ProofPanel } from "./_components/proof-panel";
import { RenameForm } from "./_components/rename-form";

// One square of one house's card (migration 33): its proof, its activity's
// name, and the history of both.
//
// The proof belongs to this HOUSE: adding, replacing or removing it changes
// only this house's card. The name belongs to the SQUARE: renaming it changes
// all four cards, and every house's proof stays where it is.
//
// Officers open this on a phone straight after an activity, so it is laid out
// as one column that works at 390px.

export const metadata: Metadata = { title: "Bingo square" };

export const dynamic = "force-dynamic";

export default async function BingoSquarePage({
  params,
}: {
  // Promise in Next 16 — await before reading.
  params: Promise<{ house: string; position: string }>;
}) {
  await requireOfficer();

  // One spelling per square: `m`, never `M`; `7`, never `07`; and never the
  // free centre, 12, which has no page because it has nothing to prove.
  const raw = await params;
  const house = parseHouseParam(raw.house);
  const position = parseActivityPosition(raw.position);
  if (house === null || position === null) notFound();

  const slug = houseSlug(house);
  const back = {
    href: `/admin/bingo?house=${slug}`,
    label: `Back to ${houseLabel(house)}'s card`,
  };

  const db = createAdminClient();
  const result = await readBingoBoard(db);
  if (result.kind === "error") {
    return (
      <div>
        <PageHeader back={back} title="Bingo square" />
        <ReadError what="this square" className="mt-8" />
      </div>
    );
  }

  const { board } = result;
  const square = board.squares.find((s) => s.position === position);
  // readBingoBoard returns all 24 activity positions or an error, so this is
  // an invariant broken rather than a square that does not exist: the error
  // boundary, never a 404 that would say so.
  if (!square) throw new Error(`The bingo board has no square at ${position}.`);

  const mark =
    board.marks.find((m) => m.house === house && m.squareId === square.id) ??
    null;
  const doneCards = new Set(
    board.marks.filter((m) => m.squareId === square.id).map((m) => m.house)
  ).size;

  // Formatted here, never in the client panel: Intl in a Client Component is a
  // hydration diff. A replace keeps the row and so its created_at; the two
  // timestamps differ only once the proof has been swapped.
  const added =
    mark === null
      ? null
      : mark.updatedAt === mark.createdAt
        ? `Added ${formatInstant(mark.createdAt)} CT`
        : `Added ${formatInstant(mark.createdAt)} CT · replaced ${formatInstant(mark.updatedAt)} CT`;

  const what = `${square.activity}, ${houseLabel(house)}`;
  const preview =
    mark === null ? null : mark.kind === "photo" ? (
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-misa-panel">
        {/* `unoptimized`: resized on the officer's device already, and served
            by Supabase Storage rather than by Next. `eager`: it is the page's
            main content and above the fold, and Next flags it as the LCP. */}
        <Image
          src={markMediaUrl(db, mark)}
          alt={`Proof photo: ${what}`}
          fill
          unoptimized
          loading="eager"
          className="object-contain"
        />
      </div>
    ) : (
      // 🪤 `src` on the element and NO `type`: Chrome refuses
      // type="video/quicktime" outright, yet plays the same H.264 file without
      // it. preload="none" so opening the page downloads nothing until play.
      <video
        controls
        playsInline
        preload="none"
        poster={markThumbUrl(db, mark) ?? undefined}
        src={markMediaUrl(db, mark)}
        aria-label={`Proof video: ${what}`}
        className="aspect-[4/3] w-full bg-foreground object-contain"
      />
    );

  return (
    <div>
      <PageHeader
        back={back}
        title={square.activity}
        badge={
          <>
            <Pill tone="info">{houseLabel(house)}</Pill>
            {mark ? <Pill tone="affirm">Done</Pill> : <Pill>Not done</Pill>}
          </>
        }
      />

      <section aria-labelledby="proof-heading" className="mt-10 max-w-3xl">
        <SectionHeading id="proof-heading">Proof</SectionHeading>
        <p className="mt-2 text-sm text-misa-secondary">
          {`One photo or video marks this square done on ${houseLabel(house)}'s card, here and on the member portal.`}
        </p>
        <div className="mt-4">
          <ProofPanel
            house={slug}
            houseName={houseLabel(house)}
            position={position}
            mark={
              mark === null
                ? null
                : { id: mark.id, updatedAt: mark.updatedAt, kind: mark.kind }
            }
            added={added}
          >
            {preview}
          </ProofPanel>
        </div>
      </section>

      <section aria-labelledby="name-heading" className="mt-12 max-w-3xl">
        <SectionHeading id="name-heading">Rename the activity</SectionHeading>
        <div className="mt-4">
          <RenameForm
            squareId={square.id}
            activity={square.activity}
            updatedAt={square.updatedAt}
            doneCards={doneCards}
          />
        </div>
      </section>

      <section aria-labelledby="history-heading" className="mt-12 max-w-3xl">
        <SectionHeading id="history-heading">History</SectionHeading>
        {/* A white surface, so the trail's muted ink sits on Paper and not on
            the page's Vellum. `wrap-anywhere` because a storage path in the
            diff is one long word, and at 390px it would push the page wide. */}
        <Panel className="mt-4 wrap-anywhere">
          {mark && (
            <>
              <SectionHeading level="sub">
                {houseLabel(house)}&apos;s proof
              </SectionHeading>
              <div className="mt-3">
                <AuditTrail
                  entityType="bingo_mark"
                  entityId={mark.id}
                  emptyMessage="No history is recorded for this proof."
                />
              </div>
            </>
          )}
          <SectionHeading level="sub" className={mark ? "mt-8" : ""}>
            The activity
          </SectionHeading>
          <div className="mt-3">
            <AuditTrail
              entityType="bingo_square"
              entityId={square.id}
              emptyMessage="No officer has renamed this activity yet."
            />
          </div>
        </Panel>
      </section>
    </div>
  );
}

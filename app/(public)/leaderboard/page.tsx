import type { Metadata } from "next";
import Link from "next/link";

import { Banner, ReadError } from "@/components/ui/banner";
import { PageHero } from "@/components/ui/chevron-section";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";

import type { Database } from "@/lib/types/database";

// Public standings (§4.4, §7 Stage 7). One row per ACTIVE member for the
// current term, ranked on a single total — attendance and bonus points added
// silently (§9 #11). The split stays officer-only, in member_directory and the
// /admin/points ledger.

// 🔓 robots is the load-bearing line in this file, not the title.
//
// The board is deliberately reachable by anyone with the link (§9 #1) and must
// never be crawlable: the residual exposure once eids and emails are dropped is
// real names against point totals, and a search engine's cache OUTLIVES THE
// DEPLOY THAT FILLED IT. That makes this the one privacy decision in this
// project that cannot be walked back by shipping a fix. Same pattern as
// app/admin/(shell)/layout.tsx. Do not remove it to "help people find the
// board" — a display-name field or a per-member opt-out is the escalation.
export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Current-term standings for MISA members.",
  robots: { index: false, follow: false },
};

// 🪤 Not cached, and this is a correctness choice rather than a performance one.
//
// Stage 5 left a carry-forward saying to add "/leaderboard" to revalidatePoints
// the day this route ships. Following it literally would have been incomplete:
// FIVE modules move public standings — app/actions/points.ts (grant, void),
// attendance-review.ts (approve, reject, reopen, bulk assign, manual entry),
// attendance.ts (a live check-in writes a `present` row and revalidates nothing
// at all today), events.ts (cancelling an event, or editing its `points`), and
// member-merge.ts. Correctness that depends on five call sites staying complete
// is precisely the shape this codebase keeps writing invariants against, and a
// board serving a stale cache fails silently and gets found three stages later.
//
// force-dynamic deletes the surface instead of policing it. The cost is one
// Postgres read per request over a view that returns one row per active member
// (29 today, 500 in §2.2's worst case). The landing page already does this.
//
// ⚠️ If this ever becomes a cache, every one of those five modules needs a
// revalidatePath in the same commit. Do not add one without changing this line.
export const dynamic = "force-dynamic";

// The whole view. `term` was appended by migration 21 so the heading and the
// rows arrive together and cannot disagree — see that migration's header for
// the pinned-term defect it exists to close.
type LeaderboardRow = Database["public"]["Views"]["leaderboard"]["Row"];

/** A row that survived the null-narrowing below, plus its computed rank. */
type RankedRow = {
  id: string;
  fullName: string;
  totalPoints: number;
  rank: number;
};

async function fetchLeaderboard(): Promise<
  { kind: "ok"; rows: LeaderboardRow[] } | { kind: "error" }
> {
  // The ANON client, deliberately — not the service role. leaderboard is the
  // one view anon may read (migration 8's grant, and the single entry on
  // tests/security.test.ts's allowlist), so reading it this way is what keeps
  // that grant exercised in production rather than merely asserted in a test.
  const supabase = await createClient();

  // One unbroken literal: PostgREST types the row off the string itself, so a
  // concatenated column list widens to `string` and collapses every field
  // access to GenericStringError. That has already broken the build twice.
  const { data, error } = await supabase
    .from("leaderboard")
    .select("id, full_name, total_points, term");

  if (error) {
    // A broken read renders the fallback rather than a 500 — the same posture
    // as the landing page's schedule section.
    console.error("leaderboard query failed:", error.message);
    return { kind: "error" };
  }
  // No .order() here: the view carries `order by total_points desc, full_name`
  // and it is the authority on rank (§4.4 — ties break alphabetically now that
  // events_attended is no longer in the view to break them with). Re-sorting in
  // JavaScript would be a second opinion about the same question.
  return { kind: "ok", rows: data };
}

/**
 * Narrow the view's all-nullable row type and assign ranks.
 *
 * Every column of a Postgres view is nullable in the generated types, so the
 * narrowing is not ceremony — a row with no id cannot be keyed or linked and is
 * dropped rather than rendered as a blank name.
 *
 * Ranking is STANDARD COMPETITION ranking: equal totals share a rank and the
 * next rank skips (1, 2, 2, 4). The view's alphabetical tie-break decides the
 * order two tied members are printed in; it does not mean one of them placed
 * higher, and numbering them 2 and 3 would say that it did.
 */
function rankRows(rows: readonly LeaderboardRow[]): RankedRow[] {
  const ranked: RankedRow[] = [];
  let lastPoints: number | null = null;
  let lastRank = 0;

  for (const row of rows) {
    if (row.id === null) continue;
    const totalPoints = row.total_points ?? 0;
    // Position in the list, 1-based — not `ranked.length + 1` after the push,
    // because a tie must report the rank of the first member holding it.
    const position = ranked.length + 1;
    const rank = totalPoints === lastPoints ? lastRank : position;
    ranked.push({
      id: row.id,
      fullName: row.full_name ?? "—",
      totalPoints,
      rank,
    });
    lastPoints = totalPoints;
    lastRank = rank;
  }

  return ranked;
}

export default async function LeaderboardPage() {
  const result = await fetchLeaderboard();
  const rows = result.kind === "ok" ? rankRows(result.rows) : [];
  // A term with no points yet is a real, expected state, not an empty one: the
  // view LEFT JOINs every active member, so early in a term — or the moment an
  // officer pins the board on a term that has not started — it renders the whole
  // roster tied at zero and tied at rank 1. That is accurate and reads as
  // broken, so say what it means (§4.4 calls out the early-August case).
  const allZero = rows.length > 0 && rows.every((row) => row.totalPoints === 0);
  // Every row carries the same term. Reading it off the first row rather than
  // asking separately is the point of the column; with no rows there is nothing
  // to name, and the heading says so instead of inventing a term.
  const term = result.kind === "ok" ? (result.rows[0]?.term ?? null) : null;

  return (
    <>
      {/* The active term, prominently (§7 Stage 7). An officer can pin the
          board on a finished term over a break, so a stale term has to be
          readable on the page rather than assumed to be today's. */}
      <PageHero
        title="Leaderboard"
        subhead={
          term
            ? `Standings for ${term}. Attendance and bonus points, added together.`
            : "Current-term standings for MISA members."
        }
      />
      {/* 🪤 White because `<Table>`'s sticky `<THead>` fills with
          `bg-misa-panel` — on the grey page ground the header would dissolve
          into it exactly when it matters, which is while the body scrolls under
          it. The standings table IS this page's content, so the whole section
          is the card. */}
      <Section ground="white" pad="md" width="narrow">
        {/* 🔓 The three outcomes below are rendered as three DIFFERENT things,
            and that is the empty-vs-error invariant showing up in the layout
            rather than only in the types. Both used to be a muted `<p>`: a
            failed read and a term with no points looked identical on screen, so
            a broken query would quietly have told every visitor that nobody has
            any points. `ReadError` says the read failed; `EmptyState` says the
            board is genuinely empty. */}
        {result.kind === "error" ? (
          <ReadError what="the leaderboard" />
        ) : rows.length === 0 ? (
          // Genuinely reachable, not defensive padding: §4.4 notes the board
          // is empty in early August before the term's first meeting.
          <EmptyState title={`No standings yet${term ? ` for ${term}` : ""}`}>
            Points appear here once the term&apos;s first event has been held.
          </EmptyState>
        ) : (
          <div data-reveal="fade">
            {allZero && (
              <Banner className="mb-6">
                No points have been recorded
                {term ? ` for ${term}` : " this term"} yet — everyone starts
                level. Totals appear here after the term&apos;s first event.
              </Banner>
            )}
            <Table>
              <caption className="sr-only">
                MISA member standings{term ? ` for ${term}` : ""}, ranked by
                total points
              </caption>
              <THead>
                <tr>
                  <Th className="w-16">#</Th>
                  <Th>Member</Th>
                  <Th numeric>Points</Th>
                </tr>
              </THead>
              <tbody>
                {rows.map((row) => (
                  <Tr key={row.id}>
                    {/* The rank is set in the display face rather than in body
                        text at 60% opacity. It is the column the page is sorted
                        by, and it was the quietest thing on the row. */}
                    <Td className="font-display text-[18px] font-semibold text-misa-blue tabular-nums">
                      {row.rank}
                    </Td>
                    <Td>{row.fullName}</Td>
                    <Td numeric className="font-semibold">
                      {row.totalPoints}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}

        {/* The board is a bare total by design (§9 #11), so it cannot tell a
            member which of their points were attendance and which were granted.
            /lookup is where that breakdown lives — link it, or the answer is
            "ask an officer", which is what this stage exists to end. */}
        <p className="mt-8 text-sm text-misa-muted">
          Want your own breakdown — which events you attended, what&apos;s still
          pending, and why your total is what it is?{" "}
          <Link
            href="/lookup"
            className="text-misa-blue underline hover:text-misa-blue-dark"
          >
            Look up your attendance
          </Link>
          .
        </p>
      </Section>
    </>
  );
}

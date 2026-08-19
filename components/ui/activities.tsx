import { PhotoSlot } from "@/components/ui/photo-slot";
import { Title } from "@/components/ui/heading";
import { revealDelay } from "@/components/ui/reveal";
import { ACTIVITIES } from "@/lib/site";

// LAYOUT FAMILY: Bento Grid (§10). The page's only one.
//
// 🔓 **Rebuilt in v2 phase 1, and the reason is mechanical rather than a matter
// of taste.** This was four alternating full-width image+text rows, which
// breaks two named rules at once: §4.7's Zigzag Alternation Cap allows at most
// **two** consecutive image+text splits and this had four, and §9.F bans
// `border-t` + `border-b` on every row of a list — which is exactly what
// `border-t … last:border-b` was. Between them they are most of what the
// officer meant by "the layout and spacing is very scattered and same-ey" and
// "the lines separating sections are scattered".
//
// 📌 **Exactly four cells for exactly four activities.** The Bento Cell Count
// Rule: N items get N cells, and a grid with a blank tile at the end means the
// grid was planned wrong. The 4/2 + 2/4 split is what gives the section rhythm
// without any cell being filler.
//
// 📌 **One grouping mechanism: the gap.** No rule per cell, no divider, no
// border between rows. Each cell is a plate that stands on its own, so the
// negative space does the grouping and nothing competes with it. This is the
// direct fix for the scattered-lines complaint.
//
// 📌 Bento Background Diversity is satisfied by construction: all four cells
// carry a hatched slot, so none of them is a white-on-white text card.
//
// 📌 Still no numerals. The 01–04 labels were in an earlier round and the
// handoff removed them deliberately; don't put them back. Section-number
// eyebrows are separately banned by §9.F.
//
// ⚠️ Home page only — grep confirms no other importer, which is what makes
// rebuilding it a phase 1 change rather than a phase 2 one.

/**
 * Cell geometry, in `ACTIVITIES` order. Two sizes only:
 *
 *   small   `col-span-2`, 4/3
 *   large   `col-span-4`, 21/9
 *
 * 🔓 **Row one now opens SMALL and closes large; row two is the mirror**
 * (officer, 2026-08-19). This used to be the other way round, and the comment
 * here used to say "a wide cell leads each row" — it led one row and closed
 * the other even then. Stated as the grid actually is:
 *
 *   +--------+ +------------------+   Leadership (small) | Professional (large)
 *   +------------------+ +--------+   Social (large)     | Workshops (small)
 *
 * ✅ Both rows sum to the six declared columns: 2+4 and 4+2. A cell whose span
 * does not complete its row wraps and leaves a hole, which is the failure the
 * Bento Cell Count Rule is about.
 *
 * ⚠️ The wide cells are 21/9 rather than 16/9. At the `lg` span of 4/6 columns
 * a 16/9 slot stands over 500px tall on a wide viewport, which turns the cell
 * into an image with a caption underneath rather than a card.
 */
const CELLS = [
  { span: "lg:col-span-2", aspect: "aspect-4/3" },
  { span: "lg:col-span-4", aspect: "aspect-21/9" },
  { span: "lg:col-span-4", aspect: "aspect-21/9" },
  { span: "lg:col-span-2", aspect: "aspect-4/3" },
] as const;

export function Activities({ className = "" }: { className?: string }) {
  return (
    // 🪤 Six declared columns, not `grid-cols-12`. A twelve-column grid with a
    // large `gap-x` is eleven gaps — at the 56px page gutter that is 616px of
    // gutter before any content, and every track collapses on a phone. v1
    // shipped that. Declare the tracks the layout actually has.
    <div className={`grid gap-card sm:grid-cols-2 lg:grid-cols-6 ${className}`}>
      {ACTIVITIES.map((activity, i) => (
        <article
          key={activity.title}
          data-reveal="up"
          style={revealDelay(0.06 * i)}
          // `shadow-lift` is the elevation vocabulary doing its stated job: a
          // resting element that is nonetheless above the page.
          //
          // 🔓 **No hover step** (officer, 2026-08-18: remove the
          // expand-on-hover). These cards are non-interactive `<article>`s with
          // nothing to click, so an elevation change on hover was advertising
          // an affordance that does not exist — the same reason the image
          // plates lost theirs. ⚠️ That leaves `--shadow-raised` unused for now.
          // It stays in the vocabulary rather than being deleted: it is the
          // named answer for the first genuinely interactive surface, which is
          // phase 3 and phase 4, and re-deriving it later is how a fifth
          // one-off shadow gets invented instead.
          className={`plate flex flex-col border border-misa-plate-edge bg-white shadow-lift ${CELLS[i].span}`}
        >
          <PhotoSlot
            slot={activity}
            ratio={CELLS[i].aspect}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 60vw"
          />
          <div className="flex flex-1 flex-col px-6 pt-5 pb-6">
            <Title className="mb-2.5 text-[22px] sm:text-[26px]">
              {activity.title}
            </Title>
            <p className="leading-[1.6] text-misa-secondary">{activity.body}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

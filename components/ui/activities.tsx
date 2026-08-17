import { Hatch } from "@/components/ui/hatch";
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
 * Cell geometry, in `ACTIVITIES` order. A wide cell leads each row and a narrow
 * one closes it, alternating sides so the eye is not walked down a column.
 *
 * ⚠️ The wide cells are 21/9 rather than 16/9. At the `lg` span of 4/6 columns
 * a 16/9 slot stands over 500px tall on a wide viewport, which turns the cell
 * into an image with a caption underneath rather than a card.
 */
const CELLS = [
  { span: "lg:col-span-4", aspect: "aspect-21/9" },
  { span: "lg:col-span-2", aspect: "aspect-4/3" },
  { span: "lg:col-span-2", aspect: "aspect-4/3" },
  { span: "lg:col-span-4", aspect: "aspect-21/9" },
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
          // The elevation vocabulary doing its stated job: `lift` is a resting
          // element that is nonetheless above the page, `raised` is the same
          // element under the pointer and is the system's ONLY hover elevation.
          // `.plate` carries the travel and the timing, shared with the hero's
          // cluster so both grounds move the same way.
          className={`plate flex flex-col border border-misa-border bg-white shadow-lift hover:shadow-raised ${CELLS[i].span}`}
        >
          <Hatch caption={activity.caption} className={CELLS[i].aspect} />
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

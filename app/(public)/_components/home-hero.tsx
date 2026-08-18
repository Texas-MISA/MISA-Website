import { Hatch } from "@/components/ui/hatch";
import { revealDelay } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";
import { HERO_SLOTS, TAGLINE } from "@/lib/site";

// LAYOUT FAMILY: Asymmetric Split Hero (§10), with a floating plate cluster.
// Declared here because the family budget is checked by reading these comments:
// a family may appear at most once on the page, and this is the only split.
//
// 🔓 This replaces `PageHero` on the home page ONLY. Nine other public pages
// still import it, so `components/ui/chevron-section.tsx` is untouched in
// phase 1 — its `size="home"` branch is now unreachable and gets retired in
// phase 2, when those pages are rebuilt. Deleting it now would be a change to
// nine pages this phase is not reviewing.
//
// 📌 **Why a split rather than the centred field it replaces.** At
// DESIGN_VARIANCE 8 the anti-centre bias binds: a centred hero is the layout
// the skill names as the default to reach past. The split is also what makes
// room for the plate cluster, and the cluster is the answer to the officer's
// two loudest complaints at once — the page lacked depth, and its image slots
// were concentrated into one band while the hero had none at all.
//
// 🪤 **Three mechanical traps live in this file. All three are load-bearing.**
//
// 1. `.chevron-notch` is a `clip-path`, and a clip-path clips DESCENDANTS. A
//    plate positioned to overlap the section below would simply be cut off at
//    the notch. So the cluster stays inside the field, and the depth that would
//    have come from overlap comes from the ground and the frames instead.
// 2. `html.js [data-reveal][data-revealed]` sets `transform: none` on every
//    revealed node, whatever its variant. A plate that carried both the reveal
//    and its rotation would snap square the moment it entered — after a scroll,
//    silently, which is the hardest kind of defect to see in a screenshot. So
//    the reveal is on the OUTER wrapper and the tilt is on the INNER `.plate`.
//    Never both on one node.
// 3. `clip-path` does NOT prevent horizontal overflow: it clips painting, not
//    the scrollable overflow area, so tilted plates still widen the document.
//    v1 shipped exactly this defect from a 24px reveal offset. Two guards, both
//    deliberate: the cluster reserves internal padding for the rotated corners,
//    and the section carries `overflow-x-clip` behind it. `clip` rather than
//    `hidden` because `hidden` creates a scroll container, which would break the
//    sticky header, and forces the other axis to `auto`.

/**
 * The cluster, as composition rather than content: the captions come from
 * `lib/site.ts`, the geometry lives here.
 *
 * 🔓 **Same size and shape, layered instead of gridded** (officer,
 * 2026-08-18). The four plates went through three arrangements and this is
 * the one that keeps what each round was actually asking for:
 *
 *   - a scatter of four different shapes at four sizes, which read as four
 *     unrelated objects rather than one set of photographs;
 *   - a flat 2×2, which fixed that but flattened the depth out with it;
 *   - this: one aspect ratio at one size, **overlapping**.
 *
 * 📌 The distinction that survived all three is worth stating once. Varying
 * ONE property reads as a deliberate set; varying four reads as scatter. Here
 * the single varying property is POSITION, and size, shape, frame and radius
 * are identical across all four.
 *
 * ⚠️ 3:2 is a height decision, not a taste one. The hero has to fit the
 * viewport, and a taller frame at these widths puts it back over the fold —
 * the failure that bounded this cluster in the first place. Overlapping
 * actually buys height back, because four plates in a layered box occupy less
 * vertical space than the same four in a 2×2.
 *
 * 📌 Tilt stays at 0. It was removed because two plates leaning opposite ways
 * in a tight grid turn the gap between them into a wedge; overlapping would
 * hide that problem rather than solve it, and nothing here needs the lean.
 * `.plate` still reads `--plate-tilt`, so restoring it means putting the
 * custom property back on the inner element (`style={{ "--plate-tilt": … }}`)
 * — the CSS side is untouched and waiting. ⚠️ If it comes back,
 * the overflow arithmetic comes back with it: a plate of width W and height H
 * rotated by θ has a bounding width of `W·cos θ + H·sin θ`, and it applies at
 * EVERY width because `--plate-tilt` is an inline custom property rather than
 * a breakpoint-scoped utility. 390px is where v1 shipped a scrollbar.
 */
const PLATES = [
  // 🪤 Positions are PERCENTAGES of the cluster box, and the box carries an
  // aspect ratio, so the whole arrangement scales as one thing. Pixel offsets
  // would need re-tuning at every breakpoint and would drift apart the first
  // time one of them was missed.
  //
  // Right edges: 48% wide from 0 / 44 / 8 / 50 lands at 48 / 92 / 56 / 98 —
  // all inside the box, which is what keeps this off the horizontal-overflow
  // check. Bottom edge: the last plate starts at 50% of a box whose height is
  // set so 50% + one plate height is exactly the full height.
  { place: "lg:absolute lg:w-[48%] lg:left-0 lg:top-0 lg:z-40", delay: 0.1 },
  {
    place: "lg:absolute lg:w-[48%] lg:left-[44%] lg:top-[6%] lg:z-30",
    delay: 0.16,
  },
  {
    place: "lg:absolute lg:w-[48%] lg:left-[8%] lg:top-[42%] lg:z-20",
    delay: 0.22,
  },
  {
    place: "lg:absolute lg:w-[48%] lg:left-[50%] lg:top-[50%] lg:z-10",
    delay: 0.28,
  },
] as const;

function Plate({
  caption,
  place,
  delay,
}: {
  caption: string;
  place: string;
  delay: number;
}) {
  return (
    // 🪤 Trap 2, still live even with the tilt at 0: `[data-revealed]` sets
    // `transform: none` on every revealed node, so anything transform-based on
    // a plate belongs on the INNER element and never on the node carrying
    // `data-reveal`. The positioning is safe out here because `left`/`top` are
    // not transforms; a `translate`-based offset would be silently erased.
    <div data-reveal="up" style={revealDelay(delay)} className={place}>
      <div
        // 🪤 **`misa-plate-edge`, not `misa-border`.** `--misa-border` is an
        // ALPHA colour, and these plates sit on a navy field, so it resolved to
        // almost nothing there while reading as a clear hairline anywhere else.
        // The opaque twin is that same colour resolved once, so the frame holds
        // whatever passes beneath it.
        //
        // 📌 The radius and the clip come from `.plate`; the corner softening is
        // the documented exception to the all-sharp rule, and it applies to
        // floating plates only.
        className="plate border border-misa-plate-edge shadow-lift"
      >
        {/* 🔓 **A LIGHT hatch on a navy ground, which departs from `hatch.tsx`'s
            "light on white, navy on navy, never mixed" rule.** Recorded as a
            departure with its reason rather than done quietly, and still a gate
            item for the officer.

            A navy plate on a navy field gave no separation from the ground at
            all, and the frame could not rescue it: a shadow tinted to the
            background hue — which every shadow in this system is, by design —
            composites to nothing on a ground of that same hue. A light plate
            separates from the field and gives `shadow-lift` a light surface to
            fall on.

            Contrast is unaffected, because the caption sits on the hatch and
            not on the field: `text-misa-secondary` on the darker `#e7e7ea`
            stripe is 6.89:1, already measured in the component.

            ⚠️ The constraint that comes with it: nothing focusable may go
            inside one of these plates. The field carries `.on-navy`, which
            flips the focus ring to WHITE, and a white ring on a near-white
            plate is no ring at all. They are non-interactive `<div>`s today; if
            one ever becomes a link it needs its own navy ring in the same
            commit. */}
        <Hatch caption={caption} tone="light" className="aspect-3/2" />
      </div>
    </div>
  );
}

export function HomeHero() {
  return (
    <Section
      ground="field"
      width="page"
      // 🪤 `md` rather than `lg`, and it is the images that bought it. The
      // hero has to fit the viewport, so every pixel the plates gain has to
      // come from somewhere — 16px off the top inset is 16px the cluster can
      // spend. The bottom inset is NOT available for the same trick: the
      // chevron notch eats 48px of it and the marquee band below is sized
      // against what is left.
      padTop="md"
      // 🪤 The bottom inset is off the shared scale, and deliberately so: the
      // chevron notch eats 48px of it, so a `lg` step here would leave the
      // marquee band sitting under the notch's tip rather than clear of it.
      // This is still the SECTION's padding, not a margin between sections —
      // the rule that matters is that the next section never has to bring
      // spacing for this one's shape.
      padBottom="none"
      className="chevron-notch relative overflow-x-clip pb-28 sm:pb-32"
    >
      <div
        aria-hidden="true"
        className="hero-grid pointer-events-none absolute inset-0"
      />

      {/* 🪤 **The split starts at `lg`, not `md`, and that is a measured
          decision.** At `md` (768px) the type track works out to about 313px
          once the 56px gutters and the 48px split gap are taken off, and
          "Management Information" at the `sm` step does not fit on one line in
          it — the headline went to THREE lines, which §4.7 calls a font-size
          error rather than a copy problem. Below `lg` the hero stacks instead:
          the type gets the full measure and the cluster sits under it. */}
      <div className="relative grid items-center gap-12 lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] lg:gap-split">
        {/* The type column. Two text elements, which is inside the hero stack
            discipline of four.

            📌 There is deliberately NO hero CTA. The sticky header carries
            Check In above the fold on every scroll position, and adding one
            here would mean authoring a string on a page whose copy is locked
            verbatim. Recorded as a refusal with its reason rather than left to
            look like an oversight. */}
        <div>
          {/* 🪤 **No `text-balance` here, and that is a fix rather than an
              omission.** The heading carries an explicit `<br />` that says
              where the two lines break; `text-balance` re-wraps to equalise
              line lengths and ignores it, which turned this into a FOUR-line
              headline at 1280 and above. §4.7 is blunt about that: a four-line
              hero headline is always a font-size error, never a copy-length
              one. The sizes below are set so "Management Information" fits the
              type column on one line at every width.

              🪤 **The ramp DIPS at `lg` (44px → 38px) and that is not a typo.**
              Type size here is not a function of viewport width, it is a
              function of the TYPE COLUMN, and the column is narrowest exactly
              where the split first engages: below `lg` the heading has the full
              measure, at `lg` it suddenly has 0.84 of half of it. Widening the
              cluster to make the images larger narrowed this column, and the
              headline went to three lines at 1024 and 1280 until these steps
              came down. Change the split ratio and you have to re-measure this.
              */}
          <h1
            data-reveal="rise"
            className="font-display text-[34px] leading-[0.94] font-semibold tracking-[-0.02em] text-white sm:text-[44px] lg:text-[38px] xl:text-[48px] 2xl:text-[56px]"
          >
            Management Information
            <br />
            Systems Association
          </h1>
          <p
            data-reveal="up"
            style={revealDelay(0.08)}
            className="mt-5 text-lg font-normal italic text-white/80 sm:text-xl"
          >
            {TAGLINE}
          </p>
        </div>

        {/* The cluster.
            🔓 **A plain grid, not an absolutely-positioned scatter** (officer,
            2026-08-18). The bounded box and the four hand-placed plates are
            gone; four equal cells in a 2×2 do the same job with none of the
            arithmetic, and the height now follows the content instead of being
            pinned to a magic number per breakpoint.

            📌 The column counts are a height control. At `sm`–`lg` the cluster
            has the full measure to itself, so a 2×2 there would make each plate
            enormous and push the hero past the fold; one row of four keeps it
            short. On a phone it is 2×2 again, because four across at 390px is
            four thumbnails.

            📌 All four slots stay on screen at every width. A breakpoint that
            hides an image slot hides content, and the phone is PRODUCT.md's
            primary reader.

            🪤 `px-3` is the reserve for the rotated corners and the section's
            `overflow-x-clip` is the guarantee behind it. Both still earn their
            place: the tilt is smaller now, but it is not zero. */}
        <div className="grid grid-cols-2 gap-tile px-3 sm:grid-cols-4 lg:relative lg:block lg:aspect-20/13">
          {HERO_SLOTS.map((caption, i) => (
            <Plate key={caption} caption={caption} {...PLATES[i]} />
          ))}
        </div>
      </div>
    </Section>
  );
}

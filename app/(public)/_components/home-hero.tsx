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
 * ⚠️ **The tilts apply at EVERY width, phones included** — `--plate-tilt` is an
 * inline custom property, not a breakpoint-scoped utility — so the overflow
 * arithmetic has to hold at 390px, which is where v1 shipped a scrollbar.
 * A plate of width W and height H rotated by θ has a bounding width of
 * `W·cos θ + H·sin θ`. Worst case here is the 3.5° square plate: in the 390px
 * two-column grid it is about 155px wide, so the bounding box grows to roughly
 * 164px, about 4.5px past each edge. The cluster's `px-3` (12px) reserve covers
 * that, and `overflow-x-clip` on the section is the guarantee behind it.
 * Measured at 390 / 768 / 1280 / 1646: `scrollWidth − clientWidth === 0` at all
 * four. Raising an angle means redoing this arithmetic, not eyeballing it.
 */
const PLATES = [
  {
    // Back-left, the largest. Landscape, so the cluster has a horizon.
    place: "lg:absolute lg:top-[4%] lg:left-0 lg:z-20 lg:w-[50%]",
    aspect: "aspect-4/3",
    tilt: "-3deg",
    delay: 0.1,
  },
  {
    // Tall on the right, running nearly the full height of the box.
    place: "lg:absolute lg:top-0 lg:right-0 lg:z-10 lg:w-[44%]",
    aspect: "aspect-3/4",
    tilt: "2.5deg",
    delay: 0.16,
  },
  {
    // Square, bottom-left, overlapping the back plate. The overlap is where
    // depth actually comes from on this ground.
    place: "lg:absolute lg:bottom-0 lg:left-[8%] lg:z-30 lg:w-[40%]",
    aspect: "aspect-square",
    tilt: "3.5deg",
    delay: 0.22,
  },
  {
    // Small, low right, sitting over the tall plate.
    place: "lg:absolute lg:right-[4%] lg:bottom-[6%] lg:z-20 lg:w-[34%]",
    aspect: "aspect-3/2",
    tilt: "-2deg",
    delay: 0.28,
  },
] as const;

function Plate({
  caption,
  place,
  aspect,
  tilt,
  delay,
}: {
  caption: string;
  place: string;
  aspect: string;
  tilt: string;
  delay: number;
}) {
  return (
    // Trap 2: the reveal is out here, the tilt is on the child.
    //
    // 🪤 `hover:z-40` lives on THIS element, not on `.plate`. The stacking
    // order belongs to the absolutely-positioned wrapper, so a z-index on the
    // inner (statically positioned) plate would do nothing and the enlarging
    // plate would grow UNDERNEATH its neighbours. Hovering the plate hovers the
    // wrapper too, so the rule fires from here correctly.
    <div
      data-reveal="up"
      style={revealDelay(delay)}
      className={`${place} hover:z-40`}
    >
      <div
        // The hairline is what makes an OVERLAP legible: two light plates
        // meeting edge to edge do not separate by shadow alone unless the
        // shadow is heavy, and the next step up (`raised`) is spoken for as the
        // hover state. So the frame draws the edge and the shadow does depth.
        //
        // 🪤 **`misa-plate-edge`, not `misa-border`, and the difference is the
        // whole point.** `--misa-border` is an ALPHA colour. These plates cross
        // two different backdrops — each other, and the navy field — so one
        // border resolved to a clear grey hairline over a plate and to nothing
        // at all over the field. Same border, two apparent weights, which is
        // exactly the inconsistency it looked like. The opaque twin is that
        // same colour resolved once, so it holds whatever passes beneath.
        className="plate border border-misa-plate-edge shadow-lift hover:shadow-raised"
        style={{ "--plate-tilt": tilt } as React.CSSProperties}
      >
        {/* 🔓 **A LIGHT hatch on a navy ground, which departs from `hatch.tsx`'s
            "light on white, navy on navy, never mixed" rule.** Recorded as a
            departure with its reason rather than done quietly, and it is a
            gate item for the officer.

            The reason is measured rather than aesthetic. These plates OVERLAP,
            and overlap is where the depth in this cluster comes from. Navy
            plates on a navy field gave no plate-to-plate separation at all —
            the pairs read as one blob — and the frame could not rescue it,
            because a shadow tinted to the background hue (which every shadow in
            this system is, by design) composites to nothing on a ground of that
            same hue. A light plate fixes both at once: it separates from the
            field, and `shadow-lift` now falls on the light surface of the plate
            beneath it, so `lift` → `raised` is a hover cue you can actually see.

            Contrast is unaffected, because the caption sits on the hatch and not
            on the field: `text-misa-secondary` on the darker `#e7e7ea` stripe is
            6.89:1, already measured in the component.

            ⚠️ The constraint that comes with it: nothing focusable may go inside
            one of these plates. The field carries `.on-navy`, which flips the
            focus ring to WHITE, and a white ring on a near-white plate is no
            ring at all. They are non-interactive `<div>`s today; if a plate ever
            becomes a link, it needs its own navy ring in the same commit. */}
        <Hatch caption={caption} tone="light" className={aspect} />
      </div>
    </div>
  );
}

export function HomeHero() {
  return (
    <Section
      ground="field"
      width="page"
      padTop="lg"
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
      <div className="relative grid items-center gap-12 lg:grid-cols-[minmax(0,1.06fr)_minmax(0,1fr)] lg:gap-split">
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
              type column on one line at every width. */}
          <h1
            data-reveal="rise"
            className="font-display text-[34px] leading-[0.94] font-semibold tracking-[-0.02em] text-white sm:text-[44px] lg:text-[46px] xl:text-[56px]"
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
            🪤 **The height is BOUNDED, and that is a hero-fits-the-viewport
            requirement rather than a style.** Sized by its content the cluster
            grew with the column — four stacked plates at half the track width
            each made the hero 973px tall, so on a laptop the tagline sat below
            the fold and the whole composition had to be scrolled to. §4.7:
            the hero fits the initial viewport, CTA and all. A fixed box also
            makes the arrangement a composition instead of a grid, which is the
            point of a cluster.

            📌 Below `md` it is a plain two-column grid and no plate is
            positioned or rotated. All four slots stay on screen at every
            width — hiding an image slot at a breakpoint hides content, and the
            phone is PRODUCT.md's primary reader.

            Trap 3: `px-3` is the reserve for the rotated corners (bounding
            width of a rotated rect is `w·cos θ + h·sin θ`, about 9px over at
            these angles), and the section's `overflow-x-clip` is the guarantee
            behind it. */}
        {/* 🪤 Four columns in the stacked range, two on a phone. At `sm`–`lg`
            the cluster has the full measure to itself, and a 2×2 of it made the
            plates ~320px wide and the hero 1104px tall — the hero no longer fit
            the viewport, which is the same §4.7 failure the bounded box above
            fixes at desktop, arriving from the other side. One row of four is
            short, and it keeps all four slots on screen. */}
        <div className="relative grid grid-cols-2 gap-tile px-3 sm:grid-cols-4 lg:block lg:h-[420px] xl:h-[460px]">
          {HERO_SLOTS.map((caption, i) => (
            <Plate key={caption} caption={caption} {...PLATES[i]} />
          ))}
        </div>
      </div>
    </Section>
  );
}

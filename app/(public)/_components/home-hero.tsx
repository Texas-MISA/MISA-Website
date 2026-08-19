import { PhotoSlot } from "@/components/ui/photo-slot";
import { revealDelay } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";
import { HERO_SLOTS, TAGLINE } from "@/lib/site";
import type { ImageSlot } from "@/lib/site";

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
//    v1 shipped exactly this defect from a 24px reveal offset. The section
//    carries `overflow-x-clip` behind everything as the last line of defence.
//    `clip` rather than `hidden` because `hidden` creates a scroll container,
//    which would break the sticky header, and forces the other axis to `auto`.
//    ⚠️ It is a BACKSTOP, not the guard: a plate wide enough to need it would
//    be visibly sliced. The real guard is the bounding-box arithmetic written
//    out above `PLATES`, which keeps every rotated corner inside the cluster
//    box.

/**
 * The cluster, as composition rather than content: the captions come from
 * `lib/site.ts`, the geometry lives here.
 *
 * 🔓 **Same size and shape, layered instead of gridded** (officer,
 * 2026-08-18). The three plates went through three arrangements and this is
 * the one that keeps what each round was actually asking for:
 *
 *   - a scatter of different shapes at different sizes, which read as unrelated
 *     objects rather than one set of photographs;
 *   - a flat grid, which fixed that but flattened the depth out with it;
 *   - this: one aspect ratio, **overlapping**, with the pair below leaning.
 *
 * 📌 The distinction that survived all three is worth stating once. Varying ONE
 * property reads as a deliberate set; varying four reads as scatter. Here the
 * varying properties are POSITION and a single mirrored ANGLE — shape, frame
 * and radius are identical across all three, and the bottom two are the same
 * width as each other.
 *
 * ⚠️ 3:2 is a height decision, not a taste one. The hero has to fit the
 * viewport, and a taller frame at these widths puts it back over the fold — the
 * failure that bounded this cluster in the first place.
 *
 * ── THE ARITHMETIC, WHICH IS LOAD-BEARING ───────────────────────────────────
 * 🪤 **Change a width, a `top` or the angle here and you have to redo all of
 * this.** Every figure below is a fraction of the cluster box's WIDTH (W). The
 * box is `lg:aspect-100/67`, so its height is 0.67W and a `top` PERCENTAGE is a
 * percentage of 0.67W, not of W. At 3:2 a plate's height is ⅔ its width.
 *
 *   plate 1  w .58  left 23%               top 0                   z-30  no tilt
 *   plate 3  w .45  left calc(43% + 40px)   top 50%                 z-20  −4°
 *   plate 2  w .45  left calc(5% + 15px)    top calc(43.5% + 45px)  z-10  +4°
 *
 * At W=784 (a 1646px viewport) that resolves to, in px within the box:
 *
 *   plate 1  x [180, 635]  y [  0, 304]
 *   plate 3  x [377, 730]  y [263, 498]
 *   plate 2  x [ 54, 407]  y [274, 509]
 *
 * 📌 **The stacking order is bottom-RIGHT over bottom-LEFT** (officer,
 * 2026-08-19). It is listed above in paint order, front to back, because that
 * is the order the `z-` values read in and the source order no longer matches
 * it — `PLATES` is still indexed against `HERO_SLOTS`, so plate 2 stays the
 * second entry while sitting at the back.
 *
 * 📌 **The `calc()` offsets are ABSOLUTE nudges on purpose** (officer, over
 * several rounds: bottom-right 50px right then 10px back, bottom-left 45px down
 * and 15px right). A percentage would have made each nudge grow with the
 * viewport; the requests were in pixels, so they stay pixels at every width and
 * the percentage beside them keeps carrying the proportion.
 *
 * ⚠️ **The middle overlap is the thing that breaks first, and it is measured
 * along the seam rather than from the `left` values.** At ±4° the two tilted
 * edges swing ±8px about their own centres, so the nominal overlap is not the
 * overlap everywhere: it runs **45px at the top of the seam down to 13px at the
 * bottom**. One round earlier, a nominal 15px read as **−2px at the bottom tip**
 * — a visible sliver of field — which is what the 15px nudge on plate 2 fixed.
 * **Plate 3's `left` must stay under plate 2's right edge, and neither lower
 * `top` may exceed plate 1's bottom edge (304)**, or the field shows through.
 *
 * 📌 The two lower plates sit almost level — plate 2's top is ~6px BELOW plate
 * 3's, having been ~34px above it before the 45px drop, so the stagger reversed
 * and nearly closed. Before this iteration began the overlap was TWO PIXELS and
 * the stagger was 0.4px, both arithmetic accidents rather than choices, which is
 * why the numbers are written out at all.
 *
 * 🪤 **A rotated plate needs more room than it occupies.** A w×h box turned by
 * θ has a bounding box of `w·cosθ + h·sinθ` by `w·sinθ + h·cosθ`. At 4° with
 * w=.45W, h=.30W that is .470W × .330W — **±.010W horizontally and ±.015W
 * vertically** beyond the untilted rectangle. Plate 3's bottom reaches .660W,
 * which is what sets the box at `100/67`; halving the angle from 8° took the
 * needed clearance down with it, so the box got shorter rather than the hero
 * getting taller.
 */
const PLATES = [
  // The wide plate at the front. Both of the pair below tuck under it.
  {
    place:
      "col-span-2 sm:col-span-1 lg:absolute lg:w-[58%] lg:left-[23%] lg:top-0 lg:z-30",
    tilt: "",
    delay: 0.1,
  },
  // 🔓 Bottom-left: leaning CLOCKWISE at 4°, and at the BACK of the stack —
  // `z-10`, under both of the others (officer, 2026-08-19; it used to be the
  // middle layer). The angle was halved from 8°, itself down from 15°.
  //
  // ⚠️ Its 45px drop is what sets the cluster box's height: the bottom of its
  // ROTATED bounding box lands at ~521 of the box's 525, so another few pixels
  // down and `aspect-100/67` has to grow with it.
  {
    place: "lg:absolute lg:w-[45%] lg:left-[calc(5%+15px)] lg:top-[calc(43.5%+45px)] lg:z-10",
    tilt: "lg:[--plate-tilt:4deg]",
    delay: 0.16,
  },
  // 🔓 Bottom-right: leaning COUNTER-clockwise so the pair fans outward from
  // the middle, and SECOND in the stack at `z-20` — over the bottom-left plate,
  // under the wide one (officer, 2026-08-19).
  {
    place:
      "lg:absolute lg:w-[45%] lg:left-[calc(43%+40px)] lg:top-[50%] lg:z-20",
    tilt: "lg:[--plate-tilt:-4deg]",
    delay: 0.22,
  },
] as const;

function Plate({
  slot,
  place,
  tilt,
  delay,
  priority,
}: {
  slot: ImageSlot;
  place: string;
  /** A `lg:`-scoped `--plate-tilt` class, or "" for a plate that stays square. */
  tilt: string;
  delay: number;
  priority?: boolean;
}) {
  return (
    // 🪤 Trap 2: `[data-revealed]` sets `transform: none` on every revealed
    // node, so anything transform-based on a plate belongs on the INNER element
    // and never on the node carrying `data-reveal`. The positioning is safe out
    // here because `left`/`top` are not transforms; a `translate`-based offset
    // would be silently erased the first time this scrolled into view.
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
        //
        // 🪤 **A plain `border` is correct here and was never the problem**, in
        // case a rotated plate ever looks unframed again. It looked that way on
        // 2026-08-19 and the border was innocent: the reveal wrapper outside
        // this element was clipping the rotated plate's corners off, frame and
        // photograph together. The cause and the fix are written up on
        // `html.js [data-reveal][data-revealed]` in globals.css. **Do not
        // "fix" a missing frame by reaching for an outline or an inset shadow
        // — look for what is clipping the plate.**
        //
        // 🪤 **The tilt is a CLASS, not an inline style, and it is `lg:`-scoped
        // — both halves of that are the fix for a real defect.** It has to be
        // on this inner element because `[data-revealed]` erases transforms on
        // the wrapper. And it has to stop below `lg`, because down there the
        // plates are grid cells rather than absolutes: a 15° lean on a ~175px
        // cell grows its bounding box by ~12px a side, which collides across
        // the 16px `gap-tile` and pushes the row wider than the screen. An
        // inline `style={{ "--plate-tilt": … }}` cannot carry a breakpoint, so
        // the custom property is set by an arbitrary-property utility instead.
        className={`plate border border-misa-plate-edge shadow-lift ${tilt}`}
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
        <PhotoSlot
          slot={slot}
          ratio="aspect-3/2"
          tone="light"
          // The plates are ~45% of a track that is a little over half the
          // page at desktop, and the full measure split three or two ways
          // below it. Getting this wrong costs bandwidth, not layout.
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 26vw"
          priority={priority}
        />
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

        {/* The cluster. TWO layouts, and the breakpoint is where they swap.

            📌 Below `lg` it is a plain grid — two columns on a phone, three
            from `sm`, so all three slots stay on screen at every width. A
            breakpoint that hides an image slot hides content, and the phone is
            PRODUCT.md's primary reader. The plates are square down here; the
            tilt is `lg:`-scoped, for the reason written on `Plate`.

            📌 From `lg` it becomes a fixed-ratio box with three absolutely
            positioned plates laid over each other. `aspect-100/73` is what
            bounds the hero's height, and the overlap arithmetic above `PLATES`
            is written against exactly this ratio.

            🪤 `px-3` is the grid's inset and nothing more. It used to be
            described as "the reserve for the rotated corners", and at `lg` that
            was never true: an absolutely positioned child resolves a percentage
            `left` against the PADDING BOX, so this padding moves none of them.
            What actually keeps the rotated corners inside the layout at `lg` is
            the bounding-box arithmetic, the 56px page gutter the cluster sits
            inside, and `overflow-x-clip` on the section as a backstop. */}
        <div className="grid grid-cols-2 gap-tile px-3 sm:grid-cols-3 lg:relative lg:block lg:aspect-100/67">
          {HERO_SLOTS.map((slot, i) => (
            <Plate
              key={slot.caption}
              slot={slot}
              {...PLATES[i]}
              // 📌 Only the first is preloaded. All four are above the fold,
              // but four `priority` images compete for the same early
              // bandwidth and Next warns about exactly this; the rest are in
              // the viewport anyway, so they load immediately regardless.
              priority={i === 0}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}

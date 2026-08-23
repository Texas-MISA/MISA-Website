import { revealDelay } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";

// The hero every page except the home page opens with: the drawn navy field
// under a 60×60 grid overlay, with a chevron notch cut from the bottom edge.
//
// The notch carries over from the current live site and the handoff says to
// preserve it. Both decorations are CSS (`.hero-grid`, `.chevron-notch` in
// globals.css) rather than assets, so they scale with the viewport.
//
// The file keeps its old name so §10 and CLAUDE.md's Layout do not need a new
// entry for what is the same component in a new skin.
//
// ── REBUILT IN v2 PHASE 2 ───────────────────────────────────────────────────
//
// 🔓 **The ground is now `field`, not a flat `bg-misa-blue`.** The home hero
// established the drawn radial in phase 1 and this is the only other navy hero
// on the site; running them on two different navies was the largest remaining
// inconsistency. `ground="field"` also brings `.on-navy` with it, which is what
// answers the focus ring — a navy ring on a navy field is not subtle, it is no
// indicator.
//
// 🔓 **CENTRED AGAIN as of 2026-08-23, on the officer's instruction**, and this
// reverses a phase 2 decision rather than drifting from one — so the argument it
// overrides is kept here rather than deleted. Phase 2 made this hero
// left-aligned because §4.3's anti-centre bias binds at DESIGN_VARIANCE 8, and a
// centred hero repeated across eight pages was the largest v1 tell still
// standing; the home page answers that rule with a split, and this answered it
// with alignment, having one text block and nothing to split against.
//
// 📌 The bias is a bias, not a prohibition, and the officer owns the call. Note
// what still answers it: the home page's hero is a split and is NOT centred, so
// the site's front door does not open on a centred stack. What changed is the
// interior pages, which now read as one consistent family.
//
// 🪤 **Centring is `text-center` PLUS `mx-auto` on both blocks.** The h1 and the
// subhead carry `max-w` measures, and a constrained block with centred text
// still sits hard left inside its parent — the text would centre within a column
// that is itself off-centre, which looks like a bug rather than a choice.
//
// ✂️ **`size` and `tagline` are DELETED.** Both were dead: the home page moved
// to `HomeHero` in phase 1, and grep confirmed no call site passed either. The
// `size="home"` branch had been unreachable since that commit.
//
// 🪤 **EIGHT pages render this, not the five phase 2 rebuilt.** `/attend`,
// `/lookup` and `/leaderboard` are phase 3 and were not redesigned — they
// inherit this hero and nothing else. Any change here is a change to them, so
// they get measured at the gate even though they are out of scope.
//
// 🪤 **`.chevron-notch` is a `clip-path`, and a clip-path clips DESCENDANTS.**
// Nothing may overhang the hero's bottom edge; a plate positioned to overlap
// the section below would simply be cut off at the notch. This is why the
// cluster on the home page stays inside its field too.

export function PageHero({
  title,
  /** One plain sentence under the title. Optional, and most pages carry one. */
  subhead,
}: {
  title: React.ReactNode;
  subhead?: string;
}) {
  return (
    <Section
      ground="field"
      width="page"
      // 🪤 `md` (48 → 64px) rather than the old `pt-12 sm:pt-18`. §4.7 caps hero
      // top padding at 96px desktop, so this has room to spare, and it puts the
      // step back on the shared scale.
      padTop="md"
      // 🪤 The bottom inset is deliberately off the scale: the chevron notch eats
      // 48px of it, so a `lg` step would leave the next section sitting under the
      // notch's tip rather than clear of it. These are the values the v1 hero
      // used, kept because the clearance below them is already measured. It is
      // still the SECTION's padding rather than a margin — the next section never
      // brings spacing for this one's shape.
      padBottom="none"
      className="chevron-notch relative pb-24 sm:pb-27"
    >
      <div
        aria-hidden="true"
        className="hero-grid pointer-events-none absolute inset-0"
      />
      <div className="relative text-center">
        {/* 🪤 **`text-balance` is right HERE and wrong on the home hero**, and the
            difference is worth stating. That headline carries an explicit `<br />`
            saying where its two lines break, and balance re-wraps and ignores it.
            This one sets no break, so balancing is the whole point: "Meet the MISA
            Officers" otherwise drops one word onto a second line.

            📌 The type ramp's PAGE HERO row: 34 → 44 → 52px. It does not dip at
            `lg` the way the home hero's does, because that dip is a function of a
            type COLUMN that narrows when the split engages, and this hero has no
            split — its column only ever gets wider. */}
        <h1
          data-reveal="rise"
          className="mx-auto max-w-[18ch] font-display text-[34px] leading-[0.96] font-semibold tracking-[-0.02em] text-balance text-white sm:text-[44px] lg:text-[52px]"
        >
          {title}
        </h1>
        {subhead && (
          <p
            data-reveal="up"
            style={revealDelay(0.08)}
            className="mx-auto mt-[18px] max-w-[56ch] text-lg leading-normal text-white/80 sm:text-xl"
          >
            {subhead}
          </p>
        )}
      </div>
    </Section>
  );
}

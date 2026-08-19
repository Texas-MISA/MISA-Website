// The page section wrapper: gutters, vertical rhythm, and ground.
//
// 📌 This exists because there was no container component at all. All ten
// public pages reimplemented `px-5 sm:px-14` plus a hand-tuned vertical rhythm
// — `pt-13`, `pb-22`, `sm:pb-27`, `pb-6.5` — so the rhythm was ten independent
// guesses rather than a scale, and changing it meant editing every page.
//
// 🪤 The reason it owns the GROUND as well as the spacing is the Two Grounds
// Rule, which had already been broken once by hand. A navy band is not a
// background: it is a background PLUS `.on-navy` (which flips the focus ring to
// white) PLUS its own padding, because a band's inset was sized to a field. When
// the home page's gallery band lost its navy in 2026-08-15, the padding was left
// behind and 112px of dead air appeared above the tiles. Passing `ground="navy"`
// moves all three together, so that failure is no longer reachable from here.

import type { ElementType, ReactNode } from "react";

/**
 * `page` is the default: it paints nothing and lets the public layout's ground
 * — grey since 2026-08-19 — show through. `white` is an explicit white band.
 * `panel` is the same grey declared on the section itself. `navy` is the
 * full-bleed brand band and `field` the drawn navy gradient.
 *
 * 🔓 **`white` used to be the default AND used to mean `""`.** Both changed on
 * 2026-08-19, when the officer made the public page ground a flat grey: a key
 * called `white` that painted nothing was already a lie, and once the page
 * behind it stopped being white it would have been an actively misleading one.
 * So `page` took over the empty string and the default, and `white` became a
 * real `bg-white` — used by exactly one caller, the gallery marquee band, which
 * is now the only white ground on the public site.
 *
 * 🔓 **`paper` was retired in the same change.** It was `.ground-paper`, a
 * gray-to-white radial; with the page flat grey the class had nothing left to
 * say that `panel` does not, and a variant with nothing distinct behind it gets
 * deleted rather than aliased.
 *
 * 🔓 **`field` is the fourth ground, added in the v2 redesign.** This entry
 * used to read "there is no fourth — adding one is a change to DESIGN.md's Two
 * Grounds Rule, not a prop", and that is exactly what happened: the officer
 * retired the rule on 2026-08-17, clarifying that the navy-and-white *palette*
 * is locked while the *ground* is not. Gradients, tinted fields and drawn
 * backgrounds are in play so long as they are built from the palette.
 *
 * 🪤 `field` carries `.on-navy` for the same reason `navy` does, and that is
 * the engineering rule that survived the retirement: **a focus ring must be
 * visible on every ground it can land on, and a new ground answers that in the
 * same commit.** A navy ring on a navy field is not a subtle defect; it is no
 * focus indicator at all.
 */
export type SectionGround = "page" | "white" | "panel" | "navy" | "field";

/**
 * The vertical rhythm scale. Every step is responsive — the handoff's 56–80px
 * section padding is a desktop figure, and applied at 390px it swallows the
 * screen.
 *
 * `flush` is the deliberate near-zero: a section that takes its rhythm from the
 * sections either side rather than bringing its own. The home page's gallery
 * band is the worked example.
 */
export type SectionPad = "none" | "flush" | "xs" | "sm" | "md" | "lg";

/**
 * Optional inner column. `none` lets children span the full gutter width.
 *
 * 📌 `page` is the one that is new to the site rather than new to this file.
 * Nothing capped the content width, so above about 1500px every section kept
 * spreading — a mission paragraph is capped at 68ch and survives that, but the
 * project card grid and the officer grid just kept getting wider and thinner.
 * A band's GROUND stays full-bleed; only what is written on it is contained,
 * which is why this is a prop on the inner column and not a wrapper.
 */
export type SectionWidth = "none" | "page" | "narrow" | "prose" | "measure";

const GROUND: Record<SectionGround, string> = {
  // Paints nothing, so the public layout's grey `<main>` shows through. This is
  // what almost every section wants.
  page: "",
  // 🪤 A REAL white, and the only thing on the public site that is one. Reach
  // for it when a section carries controls or tabular data whose own fills are
  // `bg-misa-panel` — on the grey page ground those surfaces would be the same
  // colour as what is behind them. The grey is the background; cards stay white.
  white: "bg-white",
  panel: "bg-misa-panel",
  // `.on-navy` is not decoration — it is the focus-ring flip, and it must
  // travel with the fill or every ring inside this section becomes invisible.
  navy: "on-navy bg-misa-blue text-white",
  // The drawn field. `.ground-field` sets its own background-color as well as
  // the radials, so no `bg-*` utility belongs here — one would win the cascade
  // and flatten the gradient back to a solid.
  field: "on-navy ground-field text-white",
};

const PAD_TOP: Record<SectionPad, string> = {
  none: "",
  flush: "pt-2 sm:pt-3",
  xs: "pt-6 sm:pt-8",
  sm: "pt-10 sm:pt-section-sm",
  md: "pt-12 sm:pt-section",
  lg: "pt-14 sm:pt-section-lg",
};

const PAD_BOTTOM: Record<SectionPad, string> = {
  none: "",
  flush: "pb-2 sm:pb-3",
  xs: "pb-6 sm:pb-8",
  sm: "pb-10 sm:pb-section-sm",
  md: "pb-12 sm:pb-section",
  lg: "pb-14 sm:pb-section-lg",
};

const WIDTH: Record<SectionWidth, string> = {
  none: "",
  page: "mx-auto max-w-[1400px]",
  narrow: "mx-auto max-w-3xl",
  prose: "mx-auto max-w-[68ch]",
  measure: "mx-auto max-w-[900px]",
};

export type SectionProps = {
  children: ReactNode;
  /** Defaults to `section`; pass `div` when the parent already titles it. */
  as?: ElementType;
  ground?: SectionGround;
  /** Sets both edges. `padTop` / `padBottom` override it individually. */
  pad?: SectionPad;
  padTop?: SectionPad;
  padBottom?: SectionPad;
  /** Page gutters. Turn off for a band whose children run edge to edge. */
  gutter?: boolean;
  width?: SectionWidth;
  /** A hairline above or below — the system's only section divider. */
  rule?: "none" | "top" | "bottom";
  /** Lands on the outer element, so a caller can still reach for anything. */
  className?: string;
  /** Lands on the inner column when `width` is set, and is ignored otherwise. */
  innerClassName?: string;
  id?: string;
  "aria-labelledby"?: string;
  "aria-label"?: string;
};

export function Section({
  children,
  as: Tag = "section",
  ground = "page",
  pad = "md",
  padTop,
  padBottom,
  gutter = true,
  width = "none",
  rule = "none",
  className = "",
  innerClassName = "",
  ...rest
}: SectionProps) {
  const classes = [
    GROUND[ground],
    PAD_TOP[padTop ?? pad],
    PAD_BOTTOM[padBottom ?? pad],
    gutter ? "px-gutter-sm sm:px-gutter" : "",
    rule === "top" ? "border-t border-misa-hairline" : "",
    rule === "bottom" ? "border-b border-misa-hairline" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag className={classes} {...rest}>
      {width === "none" ? (
        children
      ) : (
        <div className={`${WIDTH[width]} ${innerClassName}`.trim()}>
          {children}
        </div>
      )}
    </Tag>
  );
}

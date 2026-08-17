// The framed rectangle: one hairline, no shadow, square corners.
//
// 📌 DESIGN.md's Card, generalised. The app was drawing this by hand in at
// least four weights — `border border-misa-border` on the public cards,
// `border border-black/20` and `border border-black/30 bg-misa-panel/40` in the
// admin filter panels, and `border-2 border-black` in the Stage 6 directory
// toolbars. The 2px black frame is the one that has to go: it is the loudest
// line in a system whose whole separation vocabulary is a 1px hairline.

import type { ElementType, ReactNode } from "react";

const GROUND = {
  white: "bg-white",
  /** The recessive ground — filter panels, spec cards, anything subordinate. */
  panel: "bg-misa-panel",
  /** Inherit whatever the section already laid down. */
  none: "",
} as const;

const PAD = {
  none: "",
  sm: "px-4 py-3",
  md: "px-6 py-5",
  lg: "px-7 py-6.5",
} as const;

export type PanelProps = {
  children: ReactNode;
  as?: ElementType;
  ground?: keyof typeof GROUND;
  pad?: keyof typeof PAD;
  /**
   * Drop the frame and keep the ground. For a panel that sits inside another
   * frame, where a second border would read as a doubled rule.
   */
  frameless?: boolean;
  className?: string;
  /** A panel is frequently the unit a section reveals. */
  "data-reveal"?: string;
  style?: React.CSSProperties;
  /**
   * `status` where the panel is the outcome of something the person just did —
   * a check-in result, a review step. Left unset otherwise: a panel that is
   * merely part of the page is not an announcement.
   */
  role?: "status" | "alert" | "group";
  "aria-labelledby"?: string;
};

export function Panel({
  children,
  as: Tag = "div",
  ground = "white",
  pad = "md",
  frameless = false,
  className = "",
  "data-reveal": dataReveal,
  style,
  ...rest
}: PanelProps) {
  return (
    <Tag
      data-reveal={dataReveal}
      style={style}
      {...rest}
      className={[
        frameless ? "" : "border border-misa-border",
        GROUND[ground],
        PAD[pad],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}

/**
 * A panel's title bar, separated from its body by the same hairline the frame
 * is drawn in — DESIGN.md's Card puts a rule under the title, and this is that
 * rule as a component rather than a remembered utility.
 */
export function PanelHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mb-3 border-b border-misa-hairline pb-3 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

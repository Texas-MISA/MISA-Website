// The public type roles, as components.
//
// 📌 `font-display text-[30px] leading-none font-semibold tracking-[-0.02em]
// sm:text-[42px]` was written out at every section heading on every page, and
// the copies had already drifted: the home page's "Our Mission" is navy and its
// "Activities" is ink, though DESIGN.md gives one rule for both — *navy on
// white, white on navy*. Two adjacent headings, same role, different colour,
// because they were two strings rather than one component.
//
// 🪤 **Ground-awareness is done with a `.on-navy` descendant variant rather than
// a prop**, and that is the interesting bit. `Headline` renders navy and flips
// to white inside any element carrying `.on-navy` — so moving a section from
// white to navy takes the headings with it automatically, the same way
// `Wordmark` draws in `currentColor` so one component works on both grounds.
// A `dark` prop would have been a fourth thing to remember in the Two Grounds
// Rule's five-part edit, and the rule already gets forgotten at four.

import type { ElementType, ReactNode } from "react";

export type HeadlineProps = {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  id?: string;
  "data-reveal"?: string;
  style?: React.CSSProperties;
};

/** The section heading. 30px on phones, 42px from `sm`. */
export function Headline({
  children,
  as: Tag = "h2",
  className = "",
  ...rest
}: HeadlineProps) {
  return (
    <Tag
      className={`font-display text-[30px] leading-none font-semibold tracking-[-0.02em] text-balance text-misa-blue [.on-navy_&]:text-white sm:text-[42px] ${className}`.trim()}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * The subsection heading — activity and case-study row titles.
 *
 * 🔴 **`size` exists because appending a smaller size class to this component
 * DOES NOT WORK, and had already failed silently in shipped code.** Both sizes
 * are plain arbitrary-value utilities, so they tie on specificity (0,1,0) and
 * the winner is whichever Tailwind emits LAST. Tailwind v4 sorts arbitrary
 * values ASCENDING — `.text-[22px]` at stylesheet line 3066, `.text-[26px]` at
 * 3074 — so **the larger value always wins** and `<Title className="text-[22px]
 * sm:text-[26px]">` renders at 26 → 34, the default, every time.
 *
 * 🐛 Measured on the running site at the portal-hub gate (2026-09-19):
 * `components/ui/activities.tsx:98` passes `text-[22px] sm:text-[26px]` and the
 * home page's activity titles render at **34px** at 1280. That is a live
 * defect on a phase-1 surface, it has been there since the bento grid was
 * built, and no test or detector sees it — the class IS in the attribute, so a
 * grep confirms the intent and only a computed-style read shows the result.
 * **This is the "measure rendered class attributes, not grep hits" rule with
 * teeth: here even the rendered attribute lies, and only `getComputedStyle`
 * tells the truth.** Fixing `activities.tsx` is NOT this surface's to do — it
 * is recorded for v2 phase 3 part 6, which is the part that owns work outside
 * the four portal surfaces.
 *
 * So the size is a prop that SWAPS the base classes rather than an override
 * that races them. `card` is DESIGN.md §The ramp's "Card title" row.
 */
export function Title({
  children,
  as: Tag = "h3",
  className = "",
  size = "title",
  ...rest
}: HeadlineProps & { size?: "title" | "card" }) {
  const RAMP = {
    title: "text-[26px] leading-[1.02] tracking-[-0.015em] sm:text-[34px]",
    card: "text-[22px] leading-[1.05] tracking-[-0.015em] sm:text-[26px]",
  } as const;
  return (
    <Tag
      className={`font-display ${RAMP[size]} font-semibold text-balance ${className}`.trim()}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * The uppercase label above a heading, on a meta row, or under a KPI numeral.
 *
 * ⚠️ Kept as a first-class role against `impeccable`'s craft-floor, which bans
 * the eyebrow outright ("no brief earns it back"). It is overruled here because
 * this system's eyebrow is not a decorative kicker restating the heading — it
 * is the drawing annotation, the same 12px/.14em label that titles a KPI cell
 * and a case-study term. Removing it from headings only would leave the role
 * half-applied, which is worse than either answer.
 */
export function Eyebrow({
  children,
  as: Tag = "p",
  className = "",
  ...rest
}: HeadlineProps) {
  return (
    <Tag
      className={`text-[12px] leading-[1.2] font-medium tracking-[0.14em] text-misa-blue uppercase [.on-navy_&]:text-white/65 ${className}`.trim()}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** A page or section intro. Capped at 74ch, per DESIGN.md's per-role measures. */
export function Lead({
  children,
  as: Tag = "p",
  className = "",
  ...rest
}: HeadlineProps) {
  return (
    <Tag
      className={`max-w-[74ch] text-[18px] leading-[1.65] text-misa-body [.on-navy_&]:text-white/80 ${className}`.trim()}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// The panel every empty, error, warning and success state renders in.
//
// 📌 This is the promotion of `app/admin/(shell)/_components/notice.tsx` into
// the shared vocabulary, and it settles a split the codebase had been carrying:
// /admin wrote `border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm`
// (26 times as a raw literal across 20 files, on top of the 12 that imported
// the component), while the public pages wrote `border-l-2 border-misa-blue`
// for the same thing. Two rule weights for one idea.
//
// 🔓 The tone distinction is load-bearing and predates this file. Until Stage 8
// "no data" and "the read failed" rendered with the IDENTICAL blue rule, so the
// empty-vs-error correction made to the logic was invisible on screen. A
// distinct `critical` tone is what makes that fix legible. Never reuse `info`
// for a failed read.
//
// 📌 **The left rule became a full 1px frame plus a tinted ground**, which is
// the one place an installed skill overruled the incumbent: a thick coloured
// border-left is a flag rather than a surface, it only reads on the side the
// rule is on, and the colour it carries has nowhere to go at 4px but louder.
// A hairline frame over a wash puts the tone in the GROUND — which is how the
// rest of this system already separates one thing from the next.

import type { ReactNode } from "react";

// 📌 **The tone is in the rule and the ground; the text stays body-coloured.**
// Setting the whole message in the status colour reads well for one line and
// badly for four — and several of these panels carry a paragraph, an amount and
// a link. It is also the more disciplined answer for a drafting set: ink is ink,
// and the annotation colour belongs to the rule around it. A pink ground under
// a red hairline is unmistakably an error without shouting the sentence.
const TONES = {
  /** Neutral: an empty list, an explanation, a "nothing to do here". */
  info: "border-misa-blue/35 bg-misa-panel text-misa-body",
  /** Something needs an officer's attention, but nothing is broken. */
  caution: "border-misa-caution/45 bg-misa-caution-wash text-misa-body",
  /** 🔓 A READ FAILED, or an action was refused. */
  critical: "border-misa-critical/45 bg-misa-critical-wash text-misa-body",
  /** An action succeeded. */
  affirm: "border-misa-affirm/45 bg-misa-affirm-wash text-misa-body",
} as const;

export type BannerTone = keyof typeof TONES;

/**
 * 🔓 **`size` is a prop because appending `px-6 py-6 text-base` DOES NOT
 * RELIABLY WORK** (v2 phase 3, the Portal Rebuild). `px-4` and `px-6` are
 * utilities of equal specificity, so which one wins is decided by the order
 * Tailwind emits them — the same tie that made `<Title className="text-[22px]">`
 * render at 26px for as long as it has existed (see `components/ui/heading.tsx`).
 * A prop that SWAPS the base classes cannot lose that race.
 *
 * 🪤 **`sm` is the default and nothing moves.** All ~38 existing call sites
 * render exactly what they rendered before. `md` exists for ONE shape: the
 * portal's outcome sheet, where the banner is not a notice beside the task but
 * the screen that ends it, and its sentence is body copy (16px) rather than the
 * 14px a notice is set in — 14px is on no row of DESIGN.md §The ramp.
 */
const SIZE = {
  sm: "px-4 py-3 text-sm",
  md: "px-6 py-6 text-base",
} as const;

export type BannerSize = keyof typeof SIZE;

export type BannerProps = {
  tone?: BannerTone;
  size?: BannerSize;
  /**
   * `-1` makes the banner a focus target without putting it in the tab order,
   * for the error-summary pattern: after a failed submit, focus moves to the
   * explanation rather than being left wherever the browser put it.
   *
   * 🪤 Only `-1` is accepted. A positive tabindex jumps the document order, and
   * `0` would put every banner on the page into the tab sequence — a route with
   * four empty-state notices would grow four tab stops that do nothing.
   */
  tabIndex?: -1;
  className?: string;
  /**
   * Left unset by default. An empty state is not an alert, and announcing every
   * "no rows match" to a screen reader is noise. Pass `role="alert"` where the
   * message is the result of something the person just did.
   */
  role?: "alert" | "status";
  /**
   * `div` where the banner carries block content — a list, or more than one
   * paragraph.
   *
   * 🪤 A `<p>` cannot contain a `<p>` or a `<ul>`: the parser closes the outer
   * one at the child's start tag, so the wrapper's ground and frame end early
   * and the rest of the message renders bare on the page. Not a styling
   * preference — the browser rewrites the DOM. The attendance bulk-result
   * report is the case that found it.
   */
  as?: "p" | "div";
  children: ReactNode;
};

export function Banner({
  tone = "info",
  size = "sm",
  tabIndex,
  className = "",
  role,
  as: Tag = "p",
  children,
}: BannerProps) {
  return (
    <Tag
      role={role}
      tabIndex={tabIndex}
      className={`border ${SIZE[size]} ${TONES[tone]} ${className}`.trim()}
    >
      {children}
    </Tag>
  );
}

/**
 * The standard "we could not read this" message.
 *
 * A component rather than a string so the wording stays consistent across ~20
 * call sites, and so the distinction from an empty state is structural: you
 * cannot render this by accident when you meant "nothing here".
 *
 * `what` completes the sentence — "Couldn't load {what}."
 */
export function ReadError({
  what,
  className = "",
}: {
  what: string;
  className?: string;
}) {
  return (
    <Banner tone="critical" className={className}>
      Couldn&apos;t load {what}. This isn&apos;t a statement about the data — the
      read failed. Try again, and tell an officer if it keeps happening.
    </Banner>
  );
}

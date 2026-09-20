// The table vocabulary.
//
// 📌 Eight admin tables and two on /lookup HAD been written out longhand, with
// the head-cell string `py-2 pr-4 font-medium` alone appearing 47 times.
// ⚠️ Past tense since v2 phase 4, and the gap between the two is the lesson:
// this component existed for twelve days with ZERO admin call sites while all
// 47 copies stayed exactly where they were. Extracting a primitive is half the
// job.
//
// The frames disagreed: most heads were `border-b-2 border-black`, the member
// directory used `border-2 border-black` with a sticky `bg-misa-panel` head, and
// /leaderboard used a plain `border-b border-misa-border`. Three weights for
// one rule, and only the last of them was on-system — a drafting set separates
// with hairlines, not with a 2px black bar.
//
// 📌 **Row hover was the point of the exercise, and it took phase 4 to land.**
// Not one of the eight admin tables had a hover state, and the member directory
// routinely runs to several hundred rows — an officer tracking across twelve
// columns had nothing holding the line together. ⚠️ Shipping the hover here in
// August fixed none of that, because none of those tables used this component
// until phase 4 adopted it; `tasks.md` claimed the win for twelve days.
//
// 🪤 Head cells are uppercase label type, which makes the head scannable but
// makes a LONG header wrap badly. Pass `wrap` where a column title is a phrase
// rather than a word.

import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

export type TableProps = {
  children: ReactNode;
  /**
   * The width below which the table scrolls rather than crushes. Required in
   * practice on every wide officer table — pass the same value the longhand
   * `min-w-[…]` carried.
   */
  minWidth?: string;
  className?: string;
  /** Caps the height and makes the head sticky — for the long directory reads. */
  maxHeight?: string;
  /**
   * What this table lists, for the scroll region's accessible name.
   *
   * 🪤 **The scrollport is focusable, and that is WCAG 2.1.1 rather than
   * polish.** Several of these tables contain no focusable cell at all — the
   * dashboard's recent check-ins is five columns of plain text at a 36rem
   * minimum — so below that width a keyboard-only officer had no way to scroll
   * the region and simply could not read the right-hand columns. A focusable
   * region scrolls with the arrow keys. It needs a name to be announced as
   * anything useful, so pass one.
   */
  label?: string;
  /**
   * Drop the scroll wrapper entirely.
   *
   * 🔓 **Added for the Portal Rebuild (v2 phase 3), and it is what makes a
   * PAGE-sticky head possible at all.** `overflow-x-auto` with a `visible`
   * overflow-y computes overflow-y to `auto`, so the wrapper is a scroll
   * container in both axes — see the note on `maxHeight` in
   * `members/_components/member-table.tsx`. A `position: sticky` `<thead>`
   * inside it sticks to THAT box, and with no height limit the box is as tall
   * as the table, so the head never visibly sticks to anything. Removing the
   * wrapper is what lets the head stick to the viewport instead.
   *
   * 🪤 **Only pass this for a table that genuinely cannot overflow.** The
   * leaderboard is three narrow columns and measures 305px inside a 305px
   * frame at 360 — it has no `minWidth` and nothing to scroll. Any table that
   * needs `minWidth` must keep the wrapper, because the wrapper is also what
   * makes the overflow keyboard-reachable (WCAG 2.1.1).
   */
  scroll?: boolean;
};

export function Table({
  children,
  minWidth,
  maxHeight,
  label,
  scroll = true,
  className = "",
}: TableProps) {
  // 🪤 No wrapper means no `role="region"`, and that is correct rather than a
  // regression: the region exists so a scrollPORT can be focused and scrolled
  // from the keyboard. A table with no scrollport has nothing to scroll, and a
  // focusable region announcing "Table" around static content is noise.
  if (!scroll) {
    return (
      <table
        className={`w-full border-collapse bg-white text-left text-sm ${minWidth ?? ""} ${className}`.trim()}
      >
        {children}
      </table>
    );
  }

  // 🐛 **The white ground is a correctness control, not a taste one**, and it
  // belongs here rather than at each call site. Three things in this file fill
  // with `bg-misa-panel` — the sticky `<THead>`, `Tr`'s hover, and every
  // `controlClass` input a cell contains — and on a page whose ground is that
  // same grey each of them is the colour of what is behind it: the head stops
  // separating from the rows scrolling under it and row hover does nothing.
  // Both admin and public page grounds are that grey, so making the table carry
  // its own surface is the fix that cannot be forgotten on the next screen.
  const scroller = maxHeight
    ? `overflow-auto border border-misa-border bg-white ${maxHeight}`
    : "overflow-x-auto bg-white";

  return (
    <div
      className={scroller}
      // 🪤 `tabIndex` and `role` go together or neither helps: a focusable div
      // with no role is announced as nothing, and a labelled region that cannot
      // be focused still cannot be scrolled from the keyboard.
      tabIndex={0}
      role="region"
      aria-label={label ?? "Table"}
    >
      <table
        className={`w-full border-collapse text-left text-sm ${minWidth ?? ""} ${className}`.trim()}
      >
        {children}
      </table>
    </div>
  );
}

/**
 * Two kinds of sticky, and they stick to different things.
 *
 * - `sticky` (the officer default) pairs with `Table`'s `maxHeight`: the head
 *   sticks inside the table's own scrollport. It needs an opaque ground of its
 *   own, or the rows scroll visibly underneath it — hence Vellum.
 * - 🔓 **`sticky="page"` sticks to the VIEWPORT**, for a long table that is
 *   itself the page. Added for the Portal Rebuild (v2 phase 3), because the
 *   leaderboard runs 50–150 rows with no height cap and the Rank / Member /
 *   Points labels have to survive the scroll. It requires `<Table scroll={false}>`
 *   — inside the scroll wrapper there is no viewport to stick to — and it takes
 *   a `stickyTop` offset so it lands *below* the site header rather than under
 *   it (EV3: sticky navigation must not obscure content).
 *
 * 🐛 **The page variant fills WHITE, and that is a contrast fix rather than a
 * preference.** `Th` is `text-misa-muted` (`#6f7275`), which is 4.84:1 on Paper
 * and **4.33:1 on Vellum — below AA**. The officer variant gets away with
 * `bg-misa-panel` only because it predates the measurement; making a new sticky
 * head Vellum would have introduced the exact failure v2 phase 3 exists to
 * remove, in the same commit that removed thirteen others. **Any new opaque
 * ground under muted ink is a contrast decision.**
 */
export function THead({
  children,
  sticky = false,
  /**
   * The offset for `sticky="page"`, as a Tailwind class. The site header is
   * `sticky top-0` and measures **61px** (re-measured 2026-09-18, DESIGN.md
   * §Nav clearance), so the leaderboard passes `top-[61px]`.
   *
   * 🪤 **The number lives at the call site on purpose.** A `--misa-header-h`
   * token here would be a second source of truth for a height that nothing
   * enforces — `site-header.tsx` derives its 61px from padding, not from a
   * variable — and this codebase has already paid for two-sources-for-one-fact
   * once (migration 21's pinned-term defect). One caller, one number, one
   * comment naming the measurement.
   */
  stickyTop = "top-0",
}: {
  children: ReactNode;
  sticky?: boolean | "page";
  stickyTop?: string;
}) {
  const base = "[&_th]:border-b [&_th]:border-misa-border";
  const position =
    sticky === "page"
      ? `sticky ${stickyTop} z-10 bg-white`
      : sticky
        ? "sticky top-0 z-10 bg-misa-panel"
        : "";

  return (
    <thead className={`${position} ${base}`.trim()}>{children}</thead>
  );
}

export type TrProps = {
  children: ReactNode;
  /** Off for a head row, and for a single-row layout table. */
  hover?: boolean;
  /** Voided, archived, superseded — the row is still true, just not current. */
  muted?: boolean;
  className?: string;
};

export function Tr({
  children,
  hover = true,
  muted = false,
  className = "",
}: TrProps) {
  return (
    <tr
      className={[
        "border-b border-misa-hairline last:border-b-0",
        hover ? "transition-colors duration-150 hover:bg-misa-panel/70" : "",
        muted ? "text-misa-muted" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </tr>
  );
}

export type ThProps = ThHTMLAttributes<HTMLTableCellElement> & {
  children: ReactNode;
  /** Right-align, for a numeric column. */
  numeric?: boolean;
  /** Let a multi-word header wrap instead of widening the column. */
  wrap?: boolean;
};

export function Th({
  children,
  numeric = false,
  wrap = false,
  className = "",
  ...rest
}: ThProps) {
  return (
    <th
      scope="col"
      className={[
        "py-2 pr-4 align-bottom text-[12px] font-medium tracking-[0.14em] text-misa-muted uppercase",
        numeric ? "text-right" : "text-left",
        wrap ? "" : "whitespace-nowrap",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </th>
  );
}

export type TdProps = TdHTMLAttributes<HTMLTableCellElement> & {
  children: ReactNode;
  /** Right-align and tabular-align — any column of figures. */
  numeric?: boolean;
};

export function Td({
  children,
  numeric = false,
  className = "",
  ...rest
}: TdProps) {
  return (
    <td
      className={[
        "py-2 pr-4",
        numeric ? "text-right tabular-nums" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </td>
  );
}

// The table vocabulary.
//
// 📌 Eight admin tables and two on /lookup were written out longhand, and the
// head-cell string `py-2 pr-4 font-medium` alone appears 47 times. The frames
// disagreed: most heads were `border-b-2 border-black`, the member directory
// used `border-2 border-black` with a sticky `bg-misa-panel` head, and
// /leaderboard used a plain `border-b border-misa-border`. Three weights for
// one rule, and only the last of them was on-system — a drafting set separates
// with hairlines, not with a 2px black bar.
//
// 📌 **Row hover is new and is the point of the exercise.** Not one of the
// eight admin tables had a hover state, and the member directory routinely runs
// to several hundred rows — an officer tracking across twelve columns had
// nothing holding the line together.
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
};

export function Table({
  children,
  minWidth,
  maxHeight,
  className = "",
}: TableProps) {
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
    <div className={scroller}>
      <table
        className={`w-full border-collapse text-left text-sm ${minWidth ?? ""} ${className}`.trim()}
      >
        {children}
      </table>
    </div>
  );
}

/**
 * `sticky` pairs with `Table`'s `maxHeight`. It needs an opaque ground of its
 * own, or the rows scroll visibly underneath it.
 */
export function THead({
  children,
  sticky = false,
}: {
  children: ReactNode;
  sticky?: boolean;
}) {
  return (
    <thead
      className={
        sticky
          ? "sticky top-0 z-10 bg-misa-panel [&_th]:border-b [&_th]:border-misa-border"
          : "[&_th]:border-b [&_th]:border-misa-border"
      }
    >
      {children}
    </thead>
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

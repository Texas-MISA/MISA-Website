// Chips: the interactive filter chip, and the static tag.
//
// 📌 Two different things that look similar, kept apart on purpose. A filter
// chip is a CONTROL — it has a pressed state, it changes what is on screen, and
// it must be a button. A tag is a LABEL: the skill chips on /projects, the
// semester on a case study. Rendering a tag as a button is how a page ends up
// with fourteen tab stops that do nothing.
//
// 📌 Callers: the gallery filter bar, the members preset bar (which had its own
// computed `border px-3 py-1 text-xs` string), and the /projects skill rows.

import type { ReactNode } from "react";

const CHIP_BASE =
  "inline-flex items-center border font-display leading-none font-semibold uppercase transition-colors duration-150 px-[18px] py-[9px] text-[13px] tracking-[0.1em]";

export type FilterChipProps = {
  children: ReactNode;
  /** Drives both the skin and `aria-pressed` — one source, so they can't drift. */
  active?: boolean;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
  name?: string;
  value?: string;
  disabled?: boolean;
};

export function FilterChip({
  children,
  active = false,
  onClick,
  className = "",
  type = "button",
  name,
  value,
  disabled,
}: FilterChipProps) {
  return (
    <button
      type={type}
      name={name}
      value={value}
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={[
        CHIP_BASE,
        active
          ? "border-misa-blue bg-misa-blue text-white"
          : "border-misa-border text-misa-secondary hover:border-misa-blue hover:text-misa-blue",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}

/**
 * The static tag. Vellum fill, no frame — it is a word set into the page, not
 * a thing enclosed by it.
 */
export function Tag({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center bg-misa-panel px-[11px] py-[5px] text-[12px] leading-none tracking-[0.1em] text-misa-secondary uppercase ${className}`.trim()}
    >
      {children}
    </span>
  );
}

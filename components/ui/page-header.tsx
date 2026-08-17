// The page title block.
//
// 📌 Thirteen admin pages open with the same three elements — a title, an
// optional primary action baselined against it, and a description capped at
// `max-w-2xl` — written out longhand every time.
//
// 🪤 **The title weight is a drift fix, not a restyle.** Those pages set
// `font-display text-3xl font-extrabold`, and DESIGN.md's Two-Width Rule puts
// every structural heading in Barlow Condensed **600**. 800 is a weight the
// type ramp does not contain; it arrived before the identity swap and stayed
// because the swap moved colours and left the type alone. `/admin/login` had
// already been corrected to the documented step, which is why that one page
// looked subtly unlike the other twenty-two.

import type { ReactNode } from "react";

export type PageHeaderProps = {
  title: ReactNode;
  /** The primary action, baselined against the title. */
  action?: ReactNode;
  /** One or two sentences on what this screen is for. */
  description?: ReactNode;
  /** Meta beneath the description — counts, the current term, a filter summary. */
  children?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  action,
  description,
  children,
  className = "",
}: PageHeaderProps) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-[30px] leading-[1.02] font-semibold tracking-[-0.015em] text-foreground sm:text-[34px]">
          {title}
        </h1>
        {action}
      </div>
      {description ? (
        <p className="mt-3 max-w-2xl text-sm leading-[1.65] text-misa-secondary">
          {description}
        </p>
      ) : null}
      {children}
    </div>
  );
}

/**
 * The heading for a section within a page — the `font-display text-xl font-bold`
 * that appears 38 times across /admin, likewise corrected to the 600 step.
 */
export function SectionHeading({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`font-display text-[22px] leading-[1.05] font-semibold text-foreground ${className}`.trim()}
    >
      {children}
    </h2>
  );
}

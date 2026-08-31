// The page title block.
//
// 📌 Thirteen admin pages opened with the same three elements — a title, an
// optional primary action baselined against it, and a description capped at
// `max-w-2xl` — written out longhand every time. ⚠️ Past tense since v2 phase
// 4, which is when this component got its first call site: it shipped with
// ZERO and the longhand went on being written for twelve days. By then it was
// 25 pages, not thirteen.
//
// 🪤 **The title weight is a drift fix, not a restyle.** Those pages set
// `font-display text-3xl font-extrabold`, and DESIGN.md's Two-Width Rule puts
// every structural heading in Barlow Condensed **600**. 800 is a weight the
// type ramp does not contain; it arrived before the identity swap and stayed
// because the swap moved colours and left the type alone. `/admin/login` had
// already been corrected to the documented step, which is why that one page
// looked subtly unlike the other twenty-two.

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export type PageHeaderProps = {
  title: ReactNode;
  /**
   * The ancestor this screen was opened from. Eleven admin screens carry one.
   *
   * 🪤 **It renders ABOVE the title, which is a move.** All eleven had it
   * *below* the h1, between the title and the description — so the eye read
   * title → back link → description, and the one line that says where you are
   * in the hierarchy arrived after the line that assumed you knew. A back link
   * is an ancestor pointer; it is read first or it is read too late.
   *
   * 📌 It is a prop rather than a component so the position is enforced in one
   * place instead of remembered at eleven call sites.
   */
  back?: { href: string; label: ReactNode };
  /**
   * A status pill that qualifies the title — draft/published, pending/present.
   *
   * 🪤 **Adjacent to the title, not in `action`.** A badge says something *about
   * the title* and has to be read with it; `action` is pushed to the far right
   * of a 1152px column, which on a wide screen puts a status pill an arm's
   * length from the thing whose status it reports. Two screens had already
   * hand-rolled `items-center gap-3` around the pair rather than use the
   * baselined row, and they were right to.
   */
  badge?: ReactNode;
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
  back,
  badge,
  action,
  description,
  children,
  className = "",
}: PageHeaderProps) {
  return (
    <div className={className}>
      {back ? (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-misa-secondary transition-colors duration-150 hover:text-misa-blue"
        >
          {/* A drawn glyph from the family site-header.tsx already uses, not
              the "←" character these eleven links were carrying. `aria-hidden`
              because the label beside it already says where the link goes. */}
          <ArrowLeft aria-hidden className="size-4" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        {/* The title group's own baseline is the h1's, so `action` stays
            baselined against the title whether or not a badge is present. */}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[30px] leading-[1.02] font-semibold tracking-[-0.015em] text-foreground sm:text-[34px]">
            {title}
          </h1>
          {badge}
        </div>
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
 * that **appeared** 38 times across /admin, likewise corrected to the 600 step.
 * (Past tense since v2 phase 4; there are no raw `<h2>`s under `app/admin` now.)
 *
 * 📌 **Two levels, because /admin genuinely has three.** Counted at the start of
 * phase 4: 38 section headings at 22px and 7 sub-headings at 18px, each written
 * out longhand and each internally consistent. 34 → 22 → 18 is a 1.55 then 1.22
 * ratio, which is the tight product-UI ramp an Operate surface wants — a dense
 * screen has more type roles than a brand page and exaggerated contrast between
 * them reads as noise. The 18px step is the one thing here the public ramp in
 * `DESIGN.md` does not contain; it is admin-only and recorded there as such.
 *
 * 🪤 `id` is a real prop rather than a spread, because five call sites point an
 * `aria-labelledby` at this heading. Dropping it silently would unlabel five
 * landmarks — a `<section>` that names itself by a heading id and then cannot
 * find it is announced as an unlabelled group.
 */
export function SectionHeading({
  children,
  id,
  level = "section",
  className = "",
}: {
  children: ReactNode;
  id?: string;
  /** `sub` for a heading *inside* a panel or form, not one that heads a screen region. */
  level?: "section" | "sub";
  className?: string;
}) {
  // 🪤 **`sub` is an `<h3>`, not a smaller `<h2>`.** Three visual levels have to
  // be three semantic ones or the outline lies: a heading inside a panel is a
  // CHILD of the section heading above it, and rendering both as `<h2>` announces
  // them as siblings. `merge-panel.tsx` had already hand-rolled an `<h3>` with
  // this exact class string, which is the tree disagreeing with itself about
  // what the style means.
  const Tag = level === "sub" ? "h3" : "h2";
  const size =
    level === "sub"
      ? "text-[18px] leading-[1.1]"
      : "text-[22px] leading-[1.05]";

  return (
    <Tag
      id={id}
      className={`font-display ${size} font-semibold text-foreground ${className}`.trim()}
    >
      {children}
    </Tag>
  );
}

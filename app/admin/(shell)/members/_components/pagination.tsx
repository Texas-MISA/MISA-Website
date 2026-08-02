import Link from "next/link";

import { memberFilterToParams, PAGE_SIZE, type MemberFilter } from "@/lib/filters";

// Server-rendered links rather than router pushes: a page number belongs in the
// URL for the same reason every filter does, and a link is back-button correct
// for free.
//
// ⚠️ This control is the visible half of the trap §7 names for this stage. The
// officer sees "page 1 of 3" and 25 rows; phase 2's copy-emails must return all
// N, not these 25. That is why lib/filters.ts keeps pageRange() out of
// applyMemberFilter — the export applies the filter and simply never calls it.

export function Pagination({
  filter,
  pages,
  total,
}: {
  filter: MemberFilter;
  pages: number;
  total: number;
}) {
  if (total <= PAGE_SIZE) return null;

  const page = Math.min(filter.page, pages);
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);

  function hrefFor(target: number): string {
    const params = memberFilterToParams(filter, { page: target });
    const query = params.toString();
    return `/admin/members${query ? `?${query}` : ""}`;
  }

  return (
    <nav
      aria-label="Directory pages"
      className="mt-4 flex flex-wrap items-center justify-between gap-4 text-sm"
    >
      <p className="text-xs text-foreground/60">
        Members {first}–{last} of {total}
      </p>

      <div className="flex items-center gap-2">
        <Step
          href={hrefFor(page - 1)}
          disabled={page <= 1}
          label="Previous page"
        >
          ← Prev
        </Step>
        <span className="px-2 text-xs text-foreground/60">
          Page {page} of {pages}
        </span>
        <Step
          href={hrefFor(page + 1)}
          disabled={page >= pages}
          label="Next page"
        >
          Next →
        </Step>
      </div>
    </nav>
  );
}

function Step({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const base =
    "rounded-full border px-4 py-1.5 text-xs font-medium tracking-wider transition";

  if (disabled) {
    return (
      <span
        aria-disabled
        className={`${base} border-black/20 text-foreground/30`}
      >
        {children}
      </span>
    );
  }

  return (
    <Link href={href} aria-label={label} className={`${base} border-black/50 hover:bg-black/5`}>
      {children}
    </Link>
  );
}

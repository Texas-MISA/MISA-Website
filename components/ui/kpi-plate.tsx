import type { Stat } from "@/lib/site";

// The numeral/label plate on About and Projects.
//
// The 1px grid gap over a hairline background is the whole trick: the cells
// are white and the background shows through the gaps, so the shared hairline
// reads as a rule rather than as two adjacent borders.
//
// The mockups are desktop-only fixed layouts, so the two-column phone step is
// this codebase's decision, not the handoff's.
const COLUMNS: Record<number, string> = {
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

export function KpiPlate({
  stats,
  /** Projects centres its cells; About's sit left. */
  align = "left",
  className = "",
}: {
  stats: readonly Stat[];
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <dl
      className={`grid grid-cols-2 gap-px border border-misa-hairline bg-misa-hairline ${
        COLUMNS[stats.length] ?? ""
      } ${className}`}
    >
      {stats.map((stat) => (
        // Column-reverse so the numeral sits above its label while the markup
        // keeps a <dl>'s required term-then-description order.
        <div
          key={stat.label}
          className={`flex flex-col-reverse bg-white px-6 py-5 ${
            align === "center" ? "items-center text-center" : ""
          }`}
        >
          <dt className="mt-1 text-xs leading-tight font-medium tracking-[0.14em] uppercase text-misa-muted">
            {stat.label}
          </dt>
          <dd className="font-display text-[34px] leading-none font-semibold text-misa-blue">
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

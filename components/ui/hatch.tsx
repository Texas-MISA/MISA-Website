// The hatched placeholder box: a 45° 7px stripe fill with a mono caption
// naming the shot that belongs there.
//
// These are deliberate, not missing assets. The handoff lists them as one of
// its two intentional placeholders, and a labelled box reads as a commission
// where an empty frame reads as a bug.

export function Hatch({
  caption,
  /** `light` on white grounds, `navy` on navy ones. Never mixed. */
  tone = "light",
  className = "",
  /** For the masonry, whose placeholder heights vary per slot. */
  style,
}: {
  caption: string;
  tone?: "light" | "navy";
  className?: string;
  style?: React.CSSProperties;
}) {
  const navy = tone === "navy";

  return (
    <div
      style={style}
      className={`flex items-center justify-center ${
        navy ? "hatch-navy" : "hatch-light"
      } ${className}`}
    >
      <span
        className={`font-mono text-[11px] leading-none ${
          navy ? "text-white/65" : "text-misa-muted"
        }`}
      >
        {caption}
      </span>
    </div>
  );
}

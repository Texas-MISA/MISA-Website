// The MISA wordmark: lowercase "misa" with a hand-built exclamation glyph
// overlaying the second stem, letterspaced "TEXAS" beneath.
//
// The org's real logo file exists but was not included in the design handoff
// bundle, so this stays a CSS construction — which also keeps it crisp at any
// size. Swap in the real asset when it lands (docs/existing-site-inventory.md).
//
// ⚠️ Every part is drawn in `currentColor`, so the caller sets the colour:
// navy on the white site header, white on the navy admin chrome. It used to
// hardcode white, which the navy repaint would have made invisible.
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`flex flex-col items-center leading-none ${className}`}
      aria-label="Texas MISA"
    >
      <span className="relative font-sans text-2xl font-semibold tracking-[-0.02em]">
        {/* The glyph: a dot above a short bar, sitting over the second stem.
            aria-hidden since the label above carries the name. */}
        <span
          aria-hidden="true"
          className="absolute left-[1.72em] -top-[0.3em] flex flex-col items-center"
        >
          <span className="h-[0.16em] w-[0.16em] rounded-full bg-current" />
          <span className="h-[0.14em] w-[0.05em] bg-current" />
        </span>
        misa
      </span>
      <span className="mt-[3px] font-sans text-[8px] font-medium tracking-[0.42em] indent-[0.42em]">
        TEXAS
      </span>
    </span>
  );
}

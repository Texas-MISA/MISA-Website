// The MISA wordmark: the organization's real logo — lowercase "misa" with the
// robot glyph over the "i", letterspaced "TEXAS" beneath.
//
// 🔓 **The real asset landed on 2026-08-23 and replaced the CSS construction.**
// This file drew the mark by hand — a `<span>` of text plus two absolutely
// positioned boxes making a dot-and-bar glyph — because the org's logo file
// "was not included in the design handoff bundle". It said "swap in the real
// asset when it lands"; this is that swap. What the hand-built version could
// never have is the robot, which is the actual mark rather than an approximation
// of it.
//
// ⚠️ **It is still `currentColor`, and that is the whole reason it is a MASK and
// not an `<img>`.** The supplied file is WHITE artwork on transparency, and the
// site needs the mark in two colours: navy on the white public header, white on
// the navy admin chrome and the login screen. An `<img>` can only be the colour
// it was drawn in, so shipping one would have meant either a second recoloured
// file or a `tone` prop — and both put the colour decision somewhere other than
// the caller, which is what the previous version was careful to avoid. The mask
// keeps the contract exactly: the caller sets `color`, the mark obeys.
// The mask mechanics, and why both `-webkit-` and unprefixed properties are set,
// live on `.wordmark` in `app/globals.css`.
//
// 📌 **Sized by HEIGHT, matched to what it replaced.** The CSS mark measured
// 48.5 × 43px in the header; this is 43px tall, so it carries the same weight in
// a 60px header, and the width follows the artwork's own 1.912 ratio to ~82px.
// 🪤 That is 34px wider than the old mark, and the header nav is measured
// against this box — the wordmark is absolutely centred and wins the z-order, so
// a nav item that runs under it disappears silently rather than wrapping. The
// clearance was re-measured after this change; see `components/site-header.tsx`.

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      // `role="img"` + a label, because there is no `<img>` here to carry them:
      // the element is an empty box filled through a mask, so to a screen reader
      // it would otherwise be nothing at all.
      role="img"
      aria-label="Texas MISA"
      className={`wordmark block h-[43px] w-[82px] ${className}`}
    />
  );
}

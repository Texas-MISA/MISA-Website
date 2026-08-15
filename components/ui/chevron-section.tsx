// The hero every page opens with: a navy field under a 60×60 grid overlay,
// with a chevron notch cut from the bottom edge.
//
// The notch carries over from the current live site and the handoff says to
// preserve it. Both decorations are CSS (`.hero-grid`, `.chevron-notch` in
// globals.css) rather than assets, so they scale with the viewport.
//
// The file keeps its old name so §10 and CLAUDE.md's Layout do not need a new
// entry for what is the same component in a new skin.

export function PageHero({
  title,
  /** Plain subhead, on every page but the home page. */
  subhead,
  /** The home page's italic tagline, used instead of a subhead. */
  tagline,
  /** The home page runs slightly taller. */
  size = "default",
}: {
  title: React.ReactNode;
  subhead?: string;
  tagline?: string;
  size?: "default" | "home";
}) {
  return (
    <section
      className={`on-navy chevron-notch relative bg-misa-blue px-6 text-white sm:px-14 ${
        size === "home" ? "pt-14 pb-24 sm:pt-[76px] sm:pb-28" : "pt-12 pb-24 sm:pt-18 sm:pb-27"
      }`}
    >
      <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-[900px] text-center">
        <h1 className="font-display text-[44px] leading-[0.96] font-semibold tracking-[-0.02em] sm:text-[56px] lg:text-[72px]">
          {title}
        </h1>
        {tagline && (
          <p className="mt-[18px] text-lg font-normal italic text-white/80 sm:text-xl">
            {tagline}
          </p>
        )}
        {subhead && (
          <p className="mt-[18px] text-lg leading-normal text-white/80 sm:text-xl">
            {subhead}
          </p>
        )}
      </div>
    </section>
  );
}

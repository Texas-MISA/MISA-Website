// The shallow downward V-notch that closes every hero on txmisa.org.
// Implemented as a clip-path on a colored block rather than an SVG shape, so
// it scales with the viewport and needs no asset.

export function ChevronHero({
  children,
  tone = "panel",
}: {
  children: React.ReactNode;
  tone?: "panel" | "black";
}) {
  const toneClass =
    tone === "black" ? "bg-black text-white" : "bg-misa-panel text-foreground";

  return (
    <section
      className={`${toneClass} px-6 pt-16 pb-24 sm:pt-24 sm:pb-32`}
      style={{
        // A 40px-deep notch at the bottom centre. Percentages on the x-axis
        // keep it centred at any width.
        clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 40px), 50% 100%, 0 calc(100% - 40px))",
      }}
    >
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  );
}

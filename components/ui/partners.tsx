import { PARTNERS } from "@/lib/site";

// The original site runs these as a logo carousel. Rendered here as a static
// wordmark strip: no trademarked logo files in a public repo, and a carousel
// of four items was mostly empty placeholder slides anyway
// (docs/existing-site-inventory.md).
export function Partners({ heading }: { heading: string }) {
  return (
    <section className="bg-misa-panel px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center font-display text-3xl font-extrabold sm:text-4xl">
          {heading}
        </h2>
        <ul className="mt-12 flex flex-wrap items-center justify-center gap-x-14 gap-y-8">
          {PARTNERS.map((partner) => (
            <li
              key={partner}
              className="font-display text-2xl font-bold text-foreground/55 sm:text-3xl"
            >
              {partner}
            </li>
          ))}
        </ul>
        <p className="mt-10 text-center text-xs text-foreground/50">
          Partner logos to be added.
        </p>
      </div>
    </section>
  );
}

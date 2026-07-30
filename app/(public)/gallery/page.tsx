import type { Metadata } from "next";

// Recreation of txmisa.org/gallery (docs/existing-site-inventory.md). The
// original is a masonry grid of event photos and no text at all. Real photos
// aren't in the repo, so this renders the grid shape with placeholder tiles —
// drop images into public/gallery/ and map over them here.

export const metadata: Metadata = {
  title: "Gallery",
  description: "Photos from MISA events.",
};

// Varied spans reproduce the original's mixed-aspect masonry feel.
const TILES = [
  "sm:col-span-2 aspect-3/2",
  "aspect-square",
  "aspect-square",
  "sm:col-span-2 aspect-3/2",
  "aspect-square",
  "aspect-square",
  "aspect-square",
  "sm:col-span-2 aspect-3/2",
  "aspect-square",
  "aspect-square",
  "aspect-square",
  "sm:col-span-2 aspect-3/2",
];

export default function GalleryPage() {
  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Gallery</h1>
        <p className="mt-3 text-sm text-foreground/60">
          Event photos to be added.
        </p>
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TILES.map((tile, i) => (
            <li
              key={i}
              className={`flex items-center justify-center bg-misa-panel text-xs text-foreground/35 ${tile}`}
            >
              Photo
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

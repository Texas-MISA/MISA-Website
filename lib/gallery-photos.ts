import { readdirSync } from "node:fs";
import path from "node:path";

// The gallery pool: whatever `scripts/build-photos.mjs` has written into
// `public/photos/gallery/`. The home page's marquee bands draw from this, so
// adding a photograph to `pictures/gallery/` and re-running the build script is
// the whole of "put it on the site".
//
// 🪤 **This imports `node:fs`, so it must never reach a Client Component** —
// the same hazard `lib/officer-invites.ts` carries for `node:crypto`. Its one
// caller, `app/(public)/_components/gallery-marquee.tsx`, is a Server
// Component, so the read happens once at build time and the file list is baked
// into the prerendered HTML.
//
// 📌 **An empty result is a valid answer, not an error.** `public/photos/` is
// gitignored, so a fresh clone, CI and production all have no gallery directory
// at all. Returning `[]` is what lets the marquee fall back to its labelled
// `<Hatch>` placeholders instead of rendering a row of broken images — the
// no-photography state stays reachable rather than becoming a defect.

const GALLERY_DIR = path.join(process.cwd(), "public", "photos", "gallery");

const IMAGE = /\.(jpe?g|png|webp|avif)$/i;

/**
 * FNV-1a over the filename. Cheap, dependency-free, and well spread.
 *
 * `Math.imul` is what keeps the multiply in 32-bit integer space; a plain `*`
 * overflows into float territory after a few rounds and the distribution falls
 * apart.
 */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Every photograph in the gallery pool, as a public URL, in scattered order.
 *
 * 🔓 **Ordered by a hash of the filename rather than alphabetically** (officer,
 * 2026-08-19: the strip was showing near-identical shots next to each other).
 * Camera filenames are sequential, so an alphabetical list groups a whole
 * afternoon together — `IMG_4118`, `IMG_4120`, `IMG_4122` are three frames of
 * the same podium — and the marquee then showed them side by side.
 *
 * ⚠️ **A hash, not `Math.random()`, and the difference matters here.** This
 * list is sliced into statically prerendered HTML: anything genuinely random
 * would make two builds of the same commit produce different pages, so nothing
 * would be diffable and a rebuild would silently reshuffle the site. Hashing
 * the filename scatters the order while keeping it a pure function of the
 * directory contents — the same photos always produce the same running order,
 * and adding one only perturbs where that one lands.
 *
 * 📌 To reshuffle deliberately, change the FNV offset basis above. There is no
 * seed parameter on purpose: a seed that lives in a caller is a seed that ends
 * up different in two callers.
 */
export function galleryPhotos(): string[] {
  try {
    return readdirSync(GALLERY_DIR)
      .filter((file) => IMAGE.test(file))
      .sort((a, b) => hash(a) - hash(b))
      .map((file) => `/photos/gallery/${file}`);
  } catch {
    // ENOENT is the normal production case, not an exception worth throwing.
    return [];
  }
}

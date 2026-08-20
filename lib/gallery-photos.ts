import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// The gallery pool: whatever `scripts/build-photos.mjs` has written into
// `public/photos/gallery/`. The home page's marquee bands and `/gallery` both
// draw from this, so adding a photograph to `pictures/gallery/` and re-running
// the build script is the whole of "put it on the site".
//
// 🪤 **This imports `node:fs`, so it must never reach a Client Component** —
// the same hazard `lib/officer-invites.ts` carries for `node:crypto`. Both
// callers are Server Components (`_components/gallery-marquee.tsx` and
// `app/(public)/gallery/page.tsx`), so the read happens once at build time and
// the result is baked into the prerendered HTML. `/gallery`'s grid IS a client
// component, and it takes the list as a PROP for exactly this reason.
//
// 📌 **An empty result is a valid answer, not an error.** It used to be the
// normal production case, because `public/photos/` was gitignored. It no longer
// is — the directory was committed on 2026-08-19 — but the fallback stays,
// because it is what lets the marquee and the gallery render labelled `<Hatch>`
// placeholders instead of a row of broken images if the directory ever goes
// missing. The no-photography state stays reachable rather than becoming a
// defect.

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
  return poolFilenames().map((file) => `/photos/gallery/${file}`);
}

/** One photograph, with the pixel dimensions read off the file itself. */
export type GalleryPhoto = {
  src: string;
  width: number;
  height: number;
};

/**
 * The same pool, in the same order, carrying each photograph's REAL shape.
 *
 * 🔓 **Added in v2 phase 2, for `/gallery`'s masonry**, and the reason is worth
 * stating because the obvious alternative is wrong. A masonry has to know how
 * tall each tile is before the image loads, or the column reflows under the
 * reader as photographs arrive. There are three ways to get that number:
 *
 *   1. **Make it up.** This is what the page did until now — eighteen
 *      hand-written `height` values against placeholders. It was fiction, and
 *      fiction is exactly what phase 2 deleted from `lib/site.ts`.
 *   2. **Force one ratio and crop.** Measured against the real pool: 62 of the
 *      117 files are portrait, 39 landscape and 16 near-panoramic. Any single
 *      ratio crops the majority of them against their own grain.
 *   3. **Read the file.** Which is this.
 *
 * 🪤 **Deliberately NOT `sharp`.** `scripts/build-photos.mjs` uses it, but sharp
 * is not a declared dependency of this project — it is reached through whatever
 * the environment happens to provide — and a build-time `import` of a package
 * that is not in `package.json` is a deploy that fails on someone else's
 * machine. The header parse below needs nothing but `node:fs`.
 *
 * 📌 It reads headers, never pixels: it stops at the first frame marker, a few
 * hundred bytes in, and never decodes an image. 117 files is milliseconds, once,
 * at build time.
 *
 * ⚠️ A file whose header cannot be read is **dropped, not guessed**. A tile with
 * a made-up height is the defect this function exists to remove, so inventing
 * one here on a parse failure would reintroduce it through the back door.
 */
export function galleryPhotoEntries(): GalleryPhoto[] {
  const entries: GalleryPhoto[] = [];
  for (const file of poolFilenames()) {
    const size = imageSize(path.join(GALLERY_DIR, file));
    if (size) {
      entries.push({ src: `/photos/gallery/${file}`, ...size });
    }
  }
  return entries;
}

/** The pool's filenames, filtered and hash-scattered. Shared by both readers. */
function poolFilenames(): string[] {
  try {
    return readdirSync(GALLERY_DIR)
      .filter((file) => IMAGE.test(file))
      .sort((a, b) => hash(a) - hash(b));
  } catch {
    // A missing directory is the fallback case, not an exception worth throwing.
    return [];
  }
}

/**
 * Pixel dimensions from a JPEG or PNG header, or `null`.
 *
 * `build-photos.mjs` writes JPEG and nothing else, so the JPEG path is the one
 * that runs; PNG is here because `IMAGE` above admits it and a silently dropped
 * photograph is worse than eight lines of parser.
 *
 * 🪤 The JPEG scan must skip the `C4`, `C8` and `CC` markers. Those share the
 * `Cx` range with the start-of-frame markers but are Huffman tables and
 * arithmetic-coding definitions, not frames — reading dimensions out of one
 * yields a plausible, wrong number rather than an error.
 */
function imageSize(file: string): { width: number; height: number } | null {
  let buf: Buffer;
  try {
    buf = readFileSync(file);
  } catch {
    return null;
  }

  // PNG: the IHDR chunk is at a fixed offset and carries width then height.
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // JPEG: walk the marker segments to the first start-of-frame.
  if (buf.length < 4 || buf.readUInt16BE(0) !== 0xffd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    const length = buf.readUInt16BE(i + 2);
    if (length < 2) return null;
    i += 2 + length;
  }
  return null;
}

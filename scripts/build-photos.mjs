#!/usr/bin/env node
// Turn the officer's picture library into the web-sized files the site serves.
//
//   pictures/home/*      ->  public/photos/home/*.jpg      (slot images, 1600px)
//   pictures/projects/*  ->  public/photos/projects/*.jpg  (slot images, 1600px)
//   pictures/officers/*  ->  public/photos/officers/*.jpg  (headshots, 800px)
//   pictures/gallery/*   ->  public/photos/gallery/*.jpg   (marquee pool, 800px)
//
// Re-run it after adding, renaming or replacing anything in `pictures/`. That
// is the whole workflow: drop a photo in a folder, run this, refresh.
//
// 🔓 **Both directories are gitignored**, and that is the safe default rather
// than an oversight. THIS REPOSITORY IS PUBLIC, and a third party's face in a
// public git history is not something a later commit can take back. Publishing
// for real means deliberately committing `public/photos/`, which needs the
// officer's sign-off on the people in the frames — not just a git command.
//
// ⚠️ Consequence worth stating plainly: a deploy builds from the repo, so
// production has no photographs and every slot falls back to its labelled
// `<Hatch>` placeholder. That is by design, not a broken build.

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import heicConvert from "heic-convert";

const SRC = path.join(process.cwd(), "pictures");
const OUT = path.join(process.cwd(), "public", "photos");

const SETS = [
  // Slot images carry the page. 1600px covers a 2x display at the largest
  // rendered size (the hero's wide plate is ~470 CSS px).
  { from: "home", to: "home", max: 1600 },
  // Project cells are slot images too, and the widest of them — /projects'
  // lead cell is ~790 CSS px at the 1400px page — so they take the same 1600.
  // 🪤 These are CLIENT photographs, not photographs of the club, and they are
  // the reason `pictures/projects/` has its own set rather than pooling into
  // `gallery/`: the marquee pool is "everything not spoken for", and a client's
  // office sign scrolling past in a band of member photos is a category error.
  { from: "projects", to: "projects", max: 1600 },
  // Officer headshots are square cells ~252 CSS px wide at the 1400px page
  // (18vw, five across) and ~175px on a phone, so 800 covers 2x everywhere.
  // 🪤 **The filename IS the name-to-face pairing.** These come out of a saved
  // Squarespace export where the files are called `headshot+updated.JPG` and
  // `Screenshot+2026-01-27+at+5.29.41 PM.png`; they are copied into
  // `pictures/officers/` as `<name-slug>.<ext>` first, precisely so that the
  // one thing this pipeline must never get wrong is legible in `ls`.
  { from: "officers", to: "officers", max: 800 },
  // Marquee tiles render at 260 and 200 CSS px, so 800 is already generous.
  // Shipping 1600px into a strip that scrolls past is bandwidth for nothing.
  { from: "gallery", to: "gallery", max: 800 },
];

const IMAGE = /\.(jpe?g|png|heic|heif|webp|gif|tiff?)$/i;

const HEIC = /\.hei[cf]$/i;

/**
 * 🪤 **sharp cannot decode HEIC here, and `.metadata()` will not tell you so.**
 * The header read succeeds, so a metadata-only probe reports every file as
 * fine; the failure only shows on a real decode, as `bad seek to <offset>`.
 * That produced a confidently wrong answer once, and 40% of this library is
 * HEIC — 49 of 117 gallery files, plus two of the named slot images.
 *
 * The cause is not a corrupt file. libvips ships HEIF support limited to AVIF
 * (`sharp.format.heif.input.fileSuffix` is `['.avif']`) because HEVC is patent
 * encumbered. `heic-convert` does the decode in pure JS/WASM instead. It is
 * slow, seconds per frame, which is why it runs only on the HEIC branch.
 *
 * ⚠️ It also drops EXIF, so `.rotate()` has nothing left to read afterwards.
 * The orientation is taken off the ORIGINAL and applied by hand; without that
 * every sideways phone photo lands sideways.
 */
async function decode(file) {
  if (!HEIC.test(file)) return { input: file, angle: undefined };
  const { orientation } = await sharp(file).metadata();
  const buffer = await heicConvert({
    buffer: fs.readFileSync(file),
    format: "JPEG",
    quality: 0.94,
  });
  return {
    input: Buffer.from(buffer),
    angle: { 3: 180, 6: 90, 8: 270 }[orientation] ?? 0,
  };
}

/**
 * Filename -> URL-safe slug. Deterministic, because the marquee sorts on these
 * and a build that reshuffles its own output is a build that cannot be diffed.
 */
function slug(name) {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  // 🪤 Clear first. Without this a renamed or deleted source leaves its old
  // derivative behind, still being served, and the page keeps showing a photo
  // that is no longer in the library.
  fs.rmSync(OUT, { recursive: true, force: true });

  let total = 0;
  let bytes = 0;

  for (const set of SETS) {
    const from = path.join(SRC, set.from);
    const to = path.join(OUT, set.to);
    if (!fs.existsSync(from)) {
      console.log(`${set.from}/  (no such directory, skipped)`);
      continue;
    }
    fs.mkdirSync(to, { recursive: true });

    const files = fs.readdirSync(from).filter((f) => IMAGE.test(f)).sort();
    const used = new Map();
    let n = 0;
    const failed = [];

    for (const file of files) {
      // Disambiguate slug collisions rather than letting one file silently
      // overwrite another ("IMG_1980.heic" and "IMG_1980.HEIC" both slug to
      // "img-1980").
      let s = slug(file);
      if (used.has(s)) {
        const i = used.get(s) + 1;
        used.set(s, i);
        s = `${s}-${i}`;
      } else {
        used.set(s, 1);
      }

      const dest = path.join(to, `${s}.jpg`);
      try {
        const { input, angle } = await decode(path.join(from, file));
        await sharp(input)
          // 🪤 `.rotate()` with no argument APPLIES the EXIF orientation flag.
          // Phone photos are routinely stored sideways with a flag set;
          // `IMG_8641.JPG` reads landscape in its metadata and displays
          // portrait. Strip the flag without applying it and it lands rotated.
          // A decoded HEIC has no EXIF left, so its angle is passed explicitly.
          .rotate(angle)
          .resize({ width: set.max, height: set.max, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 76, mozjpeg: true })
          .toFile(dest);
        bytes += fs.statSync(dest).size;
        n++;
      } catch (err) {
        failed.push(`${file}: ${String(err).slice(0, 80)}`);
      }
    }

    total += n;
    console.log(`${set.to}/  ${n} of ${files.length} image(s)`);
    if (failed.length) {
      console.log(`  ⚠️  ${failed.length} could not be decoded:`);
      failed.forEach((f) => console.log(`     ${f}`));
    }
  }

  console.log(`\n${total} file(s), ${Math.round(bytes / 1024)} KB in public/photos/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

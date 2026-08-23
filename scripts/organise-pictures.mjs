#!/usr/bin/env node
// Reorganise the officer's local picture library into one folder per page.
//
// 🪤 **This moves files in a GITIGNORED directory, so there is no `git checkout`
// behind it.** Every move is therefore non-destructive: a destination that
// already exists is skipped and reported, never overwritten. Re-running the
// script is safe and is a no-op once the library is in shape.
//
// The library is the officer's, not the site's. `scripts/build-photos.mjs` is
// what turns it into something the site serves; this only decides which folder
// a photograph belongs to.
//
//   pictures/
//     home/         the files named after the slots they fill
//     about/        ready, empty until someone names one
//     projects/
//     officers/
//     gallery/      everything not spoken for — the marquee's pool
//     _saved-site/  the saved Squarespace pages, kept OUT of the photo library
//
// 📌 The saved-site bundles are deliberately excluded from `gallery/` (officer,
// 2026-08-19). They are Squarespace web exports: low resolution, and very
// likely the same shots as the originals already in the library, so folding
// them in would pad the pool with worse copies of photographs it already has.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "pictures");

/**
 * Files the officer named after a slot. These are the page's own images.
 *
 * 🪤 **A name that is not in here is swept into `gallery/`**, which is the
 * marquee's pool — so an unnamed CLIENT photograph would end up scrolling past
 * in a band of member photos. That is why the four project files are listed
 * even though they already sit in `pictures/projects/`: they were dropped at
 * the root of `pictures/` once and the next one will be too.
 */
const NAMED_TO_PAGE = {
  "homepage top main.JPG": "home",
  "homepage top 2.JPG": "home",
  "homepage top 3.jpeg": "home",
  "mission 1.JPG": "home",
  "mission 2.JPG": "home",
  "leadership opp.heic": "home",
  "professional dev.jpeg": "home",
  "social events.HEIC": "home",
  "tech workshops.jpg": "home",
  "pepsico.png": "projects",
  "casa de luz.jpg": "projects",
  "cap metro.jpg": "projects",
  "chicago crime.jpg": "projects",
};

/** Saved copies of the old live site. Not photographs. */
const SAVED_SITE = [
  "TEXAS MISA.html",
  "TEXAS MISA_files",
  "Gallery — TEXAS MISA.html",
  "Gallery — TEXAS MISA_files",
];

const PAGES = ["home", "about", "projects", "officers", "gallery"];
const IMAGE = /\.(jpe?g|png|heic|heif|webp|gif|tiff?)$/i;

const log = { moved: 0, skipped: [], left: [] };

function move(from, to) {
  if (fs.existsSync(to)) {
    log.skipped.push(`${path.basename(from)} -> ${path.relative(ROOT, to)} (destination exists)`);
    return;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
  log.moved++;
}

function main() {
  if (!fs.existsSync(ROOT)) {
    console.error("No pictures/ directory. Nothing to organise.");
    process.exit(1);
  }

  for (const p of PAGES) fs.mkdirSync(path.join(ROOT, p), { recursive: true });

  // The saved-site bundles first, so they are out of the way before the sweep.
  for (const name of SAVED_SITE) {
    const from = path.join(ROOT, name);
    if (fs.existsSync(from)) move(from, path.join(ROOT, "_saved-site", name));
  }

  // `pictures/` itself and the old flat `main pages/` folder are both sources.
  const sources = [ROOT, path.join(ROOT, "main pages")].filter((d) =>
    fs.existsSync(d),
  );

  for (const dir of sources) {
    for (const name of fs.readdirSync(dir)) {
      const from = path.join(dir, name);
      if (!fs.statSync(from).isFile()) continue;

      const page = NAMED_TO_PAGE[name];
      if (page) {
        move(from, path.join(ROOT, page, name));
      } else if (IMAGE.test(name)) {
        move(from, path.join(ROOT, "gallery", name));
      } else {
        // Not an image and not named: leave it exactly where it is and say so,
        // rather than guessing a home for someone else's file.
        log.left.push(path.relative(ROOT, from));
      }
    }
  }

  // Drop `main pages/` only once it is genuinely empty.
  const old = path.join(ROOT, "main pages");
  if (fs.existsSync(old) && fs.readdirSync(old).length === 0) {
    fs.rmdirSync(old);
    console.log("removed empty 'main pages/'");
  }

  console.log(`moved ${log.moved} file(s)`);
  for (const p of [...PAGES, "_saved-site"]) {
    const d = path.join(ROOT, p);
    const n = fs.existsSync(d) ? fs.readdirSync(d).length : 0;
    console.log(`  ${p.padEnd(12)} ${n}`);
  }
  if (log.skipped.length) {
    console.log(`\n⚠️  skipped ${log.skipped.length} (nothing was overwritten):`);
    log.skipped.forEach((s) => console.log(`  ${s}`));
  }
  if (log.left.length) {
    console.log(`\nleft in place (not an image, not named):`);
    log.left.forEach((s) => console.log(`  ${s}`));
  }
}

main();

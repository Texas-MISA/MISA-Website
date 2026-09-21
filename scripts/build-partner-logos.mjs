#!/usr/bin/env node
// Turn each partner's own brand-kit logo file into the web asset the partner
// plate serves.
//
//   pictures/partners/<source file>  ->  public/partners/<slug>.png
//
// Re-run it after changing PARTNERS below, then update `PARTNERS` in
// `lib/site.ts` to match. Unlike `pictures/`, **`public/partners/` IS
// committed** — these are corporate marks from published brand kits, not
// photographs of people, so the reasoning in `build-photos.mjs` does not apply.
//
// ── WHY THIS SCRIPT EXISTS ──────────────────────────────────────────────────
//
// 🔓 **Every output shares ONE canvas, and the art inside it is optically
// normalised.** The four logos that shipped before this script were each a
// 1000x1000 transparent square with the mark scaled to ~95% of the *width* and
// centred, which meant `<Image className="h-21">` sized the SQUARE and not the
// LOGO. The rendered marks came out 18.1px, 32.6px, 40.6px and 56.5px tall on
// the same row — a 3x spread that read as four different logo sizes, with the
// difference showing up as dead space inside each cell.
//
// 🪤 "Uniform" cannot mean equal height here: these marks run from EY's 0.89
// ratio to PepsiCo's 4.32, so equal height would make PepsiCo nearly five times
// the area of EY. It cannot mean equal area either — pure area matching shrinks
// a long wordmark until it reads as the quiet one. The scale below is the
// geometric mean of the two, which is the standard damped fix and is what got
// all four to the same visual weight.
//
// 📌 CANVAS is duplicated in `components/ui/partners.tsx`, which passes it to
// `<Image width/height>`. Change it here and change it there.

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SRC = path.join(process.cwd(), "pictures", "partners");
const OUT = path.join(process.cwd(), "public", "partners");

// The shared output canvas. Wide enough for the widest mark once normalised and
// tall enough for the tallest; the script refuses to write if that stops being
// true, because a silent overflow is a cropped logo.
const CANVAS = { width: 1240, height: 420 };

const PARTNERS = [
  { slug: "kpmg", from: path.join(SRC, "kpmg.png") },
  { slug: "pwc", from: path.join(SRC, "pwc.png") },
  // 🪤 EY publishes the REVERSED lockup — a white wordmark meant for a dark
  // ground — and the partner cells are opaque white, so shipping the file as
  // delivered puts an invisible logo in the row. The file names its own
  // light-ground value in the root `color:` property (rgb(46,46,56) = #2E2E38,
  // EY's grey), so the recolour is EY's own pairing rather than an invention.
  // The tagline is dropped with it: at this size it renders ~6px tall, and the
  // other three cells carry a mark alone. The tagline's clip path starts at
  // x=392.42 of a 1000.5 viewBox, so cropping the viewBox there keeps the beam
  // and the letters and drops the sentence.
  {
    slug: "ey",
    from: path.join(SRC, "ey-com-brandmark.svg"),
    edit: (svg) =>
      svg
        .replaceAll("fill:rgb(255, 255, 255)", "fill:rgb(46, 46, 56)")
        .replace('viewBox="0 0 1000.5 402.22"', 'viewBox="0 0 345 402.22"'),
  },
  { slug: "pepsico", from: path.join(SRC, "PepsiCo_logo.svg") },
];

// Read each mark and trim it to its real content box, so what gets measured is
// the LOGO and not whatever padding its source file happened to carry.
const marks = [];
for (const partner of PARTNERS) {
  if (!fs.existsSync(partner.from)) {
    console.error(`missing source: ${partner.from}`);
    process.exit(1);
  }
  const input = partner.edit
    ? Buffer.from(partner.edit(fs.readFileSync(partner.from, "utf8")))
    : partner.from;
  // density only applies to the SVG sources; 600 keeps the raster sharp at the
  // canvas size below.
  const { data, info } = await sharp(input, { density: 600 })
    .trim({ threshold: 1 })
    .png()
    .toBuffer({ resolveWithObject: true });
  marks.push({ ...partner, data, w: info.width, h: info.height });
}

// Damped optical scale: the geometric mean of matching height and matching
// area. Normalised so the tallest mark in the set fills the canvas height.
const relative = marks.map((m) => Math.sqrt((1 / m.h) * (1 / Math.sqrt(m.w * m.h))));
const fit = CANVAS.height / Math.max(...marks.map((m, i) => m.h * relative[i]));

fs.mkdirSync(OUT, { recursive: true });

for (let i = 0; i < marks.length; i++) {
  const mark = marks[i];
  const scale = relative[i] * fit;
  const width = Math.round(mark.w * scale);
  const height = Math.round(mark.h * scale);

  if (width > CANVAS.width || height > CANVAS.height) {
    console.error(
      `${mark.slug}: ${width}x${height} overflows the ${CANVAS.width}x${CANVAS.height} canvas — widen CANVAS (and partners.tsx) rather than letting it crop`,
    );
    process.exit(1);
  }

  const art = await sharp(mark.data).resize({ width, height }).png().toBuffer();
  const out = path.join(OUT, `${mark.slug}.png`);
  await sharp({
    create: {
      width: CANVAS.width,
      height: CANVAS.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: art,
        top: Math.round((CANVAS.height - height) / 2),
        left: Math.round((CANVAS.width - width) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(out);

  console.log(
    `${mark.slug.padEnd(8)} ${String(mark.w).padStart(4)}x${String(mark.h).padEnd(4)} -> art ${width}x${height} on ${CANVAS.width}x${CANVAS.height}`,
  );
}

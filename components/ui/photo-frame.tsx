import Image from "next/image";

import type { Photo } from "@/lib/site";

// Framed photography. Two shapes, because the layouts want two different
// things from an image.

/**
 * A photo that fills a frame the layout has already sized — the hero cluster,
 * the marquee tiles, the About photo band, the gallery feature shot.
 *
 * 🪤 `fill` is what makes the About history portrait work. The handoff calls
 * this out: with an intrinsically sized `<img>` the frame grows to the image's
 * natural height and leaves a large void beside the column next to it. `fill`
 * absolutely positions the image inside the frame, so the frame's own
 * `flex:1; min-height` wins.
 */
export function PhotoFrame({
  photo,
  /** Sizing and aspect for the frame itself. */
  className = "",
  /** `object-position`, for shots whose subject is off-centre. */
  position,
  /** Brand imagery is duotoned; headshots and the About cluster are not. */
  duotone = false,
  /** Hover zoom, for the gallery and officer tiles. */
  zoom = false,
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority = false,
  /** `light` is the on-navy frame; `none` is the full-bleed photo band. */
  border = "dark",
}: {
  photo: Photo;
  className?: string;
  position?: string;
  duotone?: boolean;
  zoom?: boolean;
  sizes?: string;
  priority?: boolean;
  border?: "dark" | "light" | "none";
}) {
  const frame =
    border === "dark"
      ? "border border-misa-border"
      : border === "light"
        ? "border border-white/28"
        : "";

  return (
    <div
      className={`relative overflow-hidden ${frame} ${
        duotone ? "duotone-frame" : ""
      } ${className}`}
    >
      <Image
        src={photo.src}
        alt={photo.alt}
        fill
        sizes={sizes}
        priority={priority}
        style={position ? { objectPosition: position } : undefined}
        className={`object-cover ${duotone ? "duotone" : ""} ${
          zoom
            ? "transition-transform duration-500 ease-[cubic-bezier(.2,.7,.3,1)] group-hover:scale-105"
            : ""
        }`}
      />
    </div>
  );
}

/**
 * A photo that keeps its own aspect ratio and lets the column flow around it —
 * the gallery masonry, where varied heights are the point.
 */
export function PhotoBlock({
  photo,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw",
}: {
  photo: Photo;
  sizes?: string;
}) {
  return (
    <div className="group overflow-hidden border border-misa-border">
      <Image
        src={photo.src}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        sizes={sizes}
        className="block h-auto w-full transition-transform duration-500 ease-[cubic-bezier(.2,.7,.3,1)] group-hover:scale-[1.04]"
      />
    </div>
  );
}

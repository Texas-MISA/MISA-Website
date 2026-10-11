// The tile label on /portal/bingo: an open square's activity, and a done
// square's band. One string for both, imported by the page (a Server
// Component) and proof-tile.tsx (a Client Component). It lives in this plain
// module because neither of those can export it to the other: a page may only
// export Next's own names, and a value imported from a "use client" module
// reaches the server as a client reference rather than as the string.
//
// 📌 Barlow Condensed, because on a phone the tile is the constraint: at 390 a
// tile is 69px wide, and "Underground" and "Monochrome" set in Barlow at 11px
// measure 63px, so they broke mid-word. Condensed at 12px they measure 54px,
// and with the 2px side padding the callers use on a phone they fit down to a
// 360px screen. `hyphens: auto` was tried and is not relied on: a browser
// without the dictionary (headless Chrome on Windows, measured) breaks with no
// hyphen at all. `wrap-anywhere` stays as the last resort for a long renamed
// activity, so a name wraps and is never truncated or pushed out of its tile.
export const TILE_LABEL =
  "font-display text-[12px] leading-[1.15] font-medium wrap-anywhere sm:text-sm";

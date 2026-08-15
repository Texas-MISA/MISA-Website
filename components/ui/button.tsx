// Button and link styling, as class strings rather than components.
//
// Every call site is already an <a href="mailto:…">, a <Link>, or a real
// <button> with its own behaviour, so wrapping them would mean a component per
// element type. The shared thing here is the skin, and these are it.
//
// 📌 Square corners, no shadow, uppercase Barlow Condensed — the handoff has
// no radii anywhere. The hover and pressed tints and the focus ring are this
// codebase's addition: the prototypes define no hover on buttons at all, and
// the handoff says to add them off the navy ramp.

const BASE =
  "inline-flex items-center justify-center gap-2 font-display leading-none font-semibold uppercase transition";

/** Primary action on a white ground. */
export const BUTTON_SOLID_NAVY = `${BASE} bg-misa-blue px-6 py-3.5 text-[15px] tracking-[0.1em] text-white hover:bg-misa-blue-dark`;

/** The compact version, for the header's Check In. */
export const BUTTON_SOLID_NAVY_SM = `${BASE} bg-misa-blue px-4 py-2 text-[13px] tracking-[0.06em] text-white hover:bg-misa-blue-dark`;

/** Primary action on a navy band. */
export const BUTTON_SOLID_WHITE = `${BASE} bg-white px-[30px] py-3.5 text-[15px] tracking-[0.1em] text-misa-blue hover:bg-white/85`;

/** Secondary action on a navy band. */
export const BUTTON_OUTLINE_WHITE = `${BASE} border border-white/45 px-[22px] py-4 text-[15px] tracking-[0.1em] text-white hover:bg-white hover:text-misa-blue`;

/** Secondary action on a white ground — fills navy on hover. */
export const BUTTON_OUTLINE_NAVY = `${BASE} border border-misa-blue px-[30px] py-3.5 text-[15px] tracking-[0.1em] text-misa-blue hover:bg-misa-blue hover:text-white`;

/** The small "See all photos →" / "All projects →" section links. */
export const LINK_EYEBROW =
  "font-display text-[13px] leading-none font-semibold tracking-[0.08em] uppercase transition";

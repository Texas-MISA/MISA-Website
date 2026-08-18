import Image from "next/image";

import { PARTNERS } from "@/lib/site";

// The partner plate, shared by the home and About pages. Four cells with a
// 1px grid gap over a hairline background, so the shared hairline reads as a
// rule. Logos are full colour, never greyscaled.
const PARTNER_GROUND = {
  panel: "bg-misa-panel",
  white: "bg-white",
  // 🔓 Added in v2 phase 1: the drawn light ground, so the page's last section
  // is not the one flat rectangle at the bottom of it. `.ground-paper` sets its
  // own background-color, so it needs no `bg-*` alongside it — one would win
  // the cascade and flatten the gradient.
  paper: "ground-paper",
} as const;

export function Partners({
  /** `paper` on the home page, `white` on About. */
  ground = "panel",
}: {
  ground?: keyof typeof PARTNER_GROUND;
}) {
  return (
    <section
      className={`border-t border-misa-hairline px-5 py-20 sm:px-14 sm:pt-20 sm:pb-22 ${PARTNER_GROUND[ground]}`}
    >
      <h2 className="mb-11 text-center font-display text-[30px] leading-none font-semibold tracking-[-0.02em] text-misa-blue sm:text-[42px]">
        Our Amazing Partners
      </h2>
      <ul className="grid grid-cols-2 gap-px border border-misa-hairline bg-misa-hairline sm:grid-cols-4">
        {PARTNERS.map((partner) => (
          <li
            key={partner.name}
            className="flex items-center justify-center bg-white px-7 py-10"
          >
            <Image
              src={partner.logo}
              alt={partner.name}
              width={1000}
              height={1000}
              sizes="(max-width: 640px) 40vw, 20vw"
              className="h-21 w-auto object-contain"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

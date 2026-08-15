import Image from "next/image";

import { PARTNERS } from "@/lib/site";

// The partner plate, shared by the home and About pages. Four cells with a
// 1px grid gap over a hairline background, so the shared hairline reads as a
// rule. Logos are full colour, never greyscaled.
export function Partners({
  /** `panel` on the home page, `white` on About. */
  ground = "panel",
}: {
  ground?: "panel" | "white";
}) {
  return (
    <section
      className={`border-t border-misa-hairline px-5 py-20 sm:px-14 sm:pt-20 sm:pb-22 ${
        ground === "panel" ? "bg-misa-panel" : "bg-white"
      }`}
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

import type { Metadata } from "next";

import { OfficerCard } from "@/components/ui/officer-card";
import { OFFICERS } from "@/lib/officers";

// Recreation of txmisa.org/officers (docs/existing-site-inventory.md).
// Same roster as the home page, but these cards carry LinkedIn buttons.

export const metadata: Metadata = {
  title: "Officers",
  description: "Meet the MISA officer team.",
};

export default function OfficersPage() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-center font-display text-3xl font-extrabold sm:text-5xl">
          Meet the MISA Officers!
        </h1>
        <ul className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {OFFICERS.map((officer) => (
            <li key={officer.name}>
              <OfficerCard officer={officer} withLinkedIn />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

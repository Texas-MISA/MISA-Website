import { PILLARS } from "@/lib/site";

// The four-up "what we do" row shared by the home and about pages.
export function Pillars() {
  return (
    <ul className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
      {PILLARS.map((pillar) => (
        <li key={pillar.title} className="text-center">
          <h3 className="font-display text-2xl font-bold leading-tight">
            {pillar.title}
          </h3>
          <p className="mt-4 text-sm leading-6 text-foreground/80">{pillar.body}</p>
        </li>
      ))}
    </ul>
  );
}

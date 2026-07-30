import { initials, type Officer } from "@/lib/officers";

// Circular headshot + serif name + role, matching txmisa.org's officer cards.
// No real photos in the repo yet, so the circle shows initials; swap the
// placeholder div for next/image once headshots land in public/.
export function OfficerCard({
  officer,
  withLinkedIn = false,
}: {
  officer: Officer;
  withLinkedIn?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center px-6 py-8 text-center ${
        withLinkedIn ? "bg-misa-panel" : ""
      }`}
    >
      <div
        className="flex h-40 w-40 items-center justify-center rounded-full bg-misa-blue/25 text-2xl font-semibold text-misa-blue-dark"
        aria-hidden="true"
      >
        {initials(officer.name)}
      </div>
      <h3 className="mt-6 font-display text-xl font-bold">{officer.name}</h3>
      <p className="mt-1 text-sm text-foreground/75">{officer.role}</p>
      {withLinkedIn && (
        <a
          href={officer.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 rounded-full bg-misa-blue px-8 py-3 text-xs font-medium tracking-wider text-white transition hover:bg-misa-blue-dark"
        >
          LINKEDIN
          <span className="sr-only"> profile for {officer.name}</span>
        </a>
      )}
    </div>
  );
}

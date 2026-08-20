import Link from "next/link";

import { buttonClass } from "@/components/ui/button";

// The row of ways out, shown on both 404s.
//
// 🔓 **Extracted in v2 phase 2 because it was written out TWICE, verbatim** —
// once in `app/(public)/not-found.tsx` and once in `app/not-found.tsx`. Both
// files exist for a real reason (see the notes in each: `(public)` is a route
// group, so it does not participate in URL matching and an unmatched address
// falls to the root), but the list of destinations is one fact and was living
// in two places. A route added to one and not the other is a silent divergence
// nobody would look for.
//
// 🐛 **The old chip's hover was `hover:bg-misa-panel`, which stopped working on
// 2026-08-19** without anything erroring. `--misa-panel` became the public page
// ground's own colour that day, so hovering a link on a 404 filled it with
// exactly what was already behind it. It uses the shared `quiet` button skin
// now, whose hover is an ink change — the same family of failure as
// `controlClass` on `/contact` and `Tag` on `/projects`, found in the same
// sweep.
//
// 📌 These six are the places somebody who is lost actually wants: the front
// door, what the club is, the thing they may have been mid-way through, and the
// two member-facing pages. `/attend` is on the list deliberately — a member who
// mistypes a URL on the way to checking in is the one visitor here with a clock
// running.

const DESTINATIONS = [
  ["/", "Home"],
  ["/about", "About Us"],
  ["/attend", "Check In"],
  ["/leaderboard", "Leaderboard"],
  ["/lookup", "My Attendance"],
  ["/contact", "Contact Us"],
] as const;

export function RecoveryNav({ className = "" }: { className?: string }) {
  return (
    <nav
      aria-label="Site sections"
      className={`flex flex-wrap gap-2.5 ${className}`.trim()}
    >
      {DESTINATIONS.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className={buttonClass({ variant: "quiet", size: "sm" })}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

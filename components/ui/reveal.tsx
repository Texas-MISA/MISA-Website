// Server-safe half of the scroll reveal.
//
// 🪤 This file must NOT carry "use client". The observer that reads these
// attributes does (components/ui/reveal-observer.tsx), and a helper exported
// from a client module cannot be CALLED on the server — every page that
// staggers a list would fail to prerender. Keeping the two apart is what lets
// the animated sections stay Server Components.

/**
 * The stagger delay for a sibling group, as the custom property globals.css
 * reads. Steps of .04–.05s, per the design handoff.
 */
export function revealDelay(seconds: number): React.CSSProperties {
  return { "--reveal-delay": `${seconds}s` } as React.CSSProperties;
}

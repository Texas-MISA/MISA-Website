"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Scroll reveal, the replacement for the prototypes' throttled scroll handler.
// The handoff says explicitly not to port that handler; this is the
// IntersectionObserver it asks for.
//
// 🪤 The elements themselves are NOT client components. A page marks a section
// `data-reveal="up"` and stays entirely server-rendered; this one observer,
// mounted once in the public layout, finds them and flips `data-revealed` on.
// Wrapping every animated section in a client component would have pushed the
// whole public site across the boundary for a CSS transition.
//
// The hidden start state lives in globals.css under `html.js`, so with
// JavaScript off nothing here runs and nothing is ever hidden.

/** Matches the prototypes' `top < innerHeight * 0.94` trigger point. */
const ROOT_MARGIN = "0px 0px -6% 0px";

export function RevealObserver() {
  // Route changes swap the children under this layout without remounting it,
  // so the scan has to re-run per path or a navigated-to page never reveals.
  const pathname = usePathname();

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>(
      "[data-reveal]:not([data-revealed])"
    );
    if (nodes.length === 0) return;

    // Reduced motion is handled in CSS (nothing is hidden), so the observer
    // has no work to do — but marking them keeps the DOM honest for anything
    // reading the attribute.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      nodes.forEach((node) => node.setAttribute("data-revealed", ""));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-revealed", "");
          // Once revealed, stay revealed — scrolling back up must not re-hide.
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: ROOT_MARGIN }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}

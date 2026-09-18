import type { Metadata } from "next";
import Link from "next/link";

import { buttonClass } from "@/components/ui/button";
import { PageHero } from "@/components/ui/chevron-section";
import { Title } from "@/components/ui/heading";
import { Panel } from "@/components/ui/panel";
import { revealDelay } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";

// The member portal hub (docs/member-portal-plan.md, phase 1). Static — no data
// reads — and built only from shared primitives: the member area's real visual
// design belongs to v2 phase 3, and this page should not pre-empt it.
//
// ── THE LAYOUT-FAMILY BUDGET ────────────────────────────────────────────────
//
//   1. Hero ........... Page hero (field + chevron notch)
//   2. Destinations ... Stacked row cards, one per member tool
//
// TWO sections, TWO families. Eyebrow cap would be ceil(2 / 3) = 1; the page
// uses zero.
//
// 📌 **Rows, not a three-up card grid.** Three equal cards side by side is the
// feature-row tell `design-taste-frontend` bans, and at `sm` a third of the
// column is too narrow for "My Attendance" at the Title size. Rows also keep
// the narrow single column the three member pages themselves use.
//
// 🔓 **All three buttons are formatted the SAME — one skin, one width
// (officer, 2026-09-18).** Check In was first built as the lone primary with
// the other two in outline, on the argument that check-in is the one done
// against a clock; the officer overruled that. Check-in now lives only inside
// the portal, so this page is its door, and no tool here outranks another.
// The width is fixed rather than fitted so the three buttons line up as one
// column; it is sized to the longest label, "Look up your attendance".
//
// 🔓 **robots is per page, and must never move to a portal layout.** The hub,
// /portal/leaderboard and /portal/lookup are noindex; /portal/attend is
// indexable, as /attend always was. A layout-level robots would silently
// de-index the check-in page.
//
// 🪤 This page sits on the grey page ground, where `--misa-muted` measures
// 4.33:1 and fails AA — so the officer line uses `--misa-secondary`, which is
// 7.60:1 there. The cards are white; their body copy is the secondary ink the
// token names for card copy.

export const metadata: Metadata = {
  title: "Member Portal",
  description: "Check in, see the standings, or look up your own attendance.",
  robots: { index: false, follow: false },
};

// Titles are each destination page's own heading, and the one-line bodies are
// each page's own `metadata.description`, so nothing here is new copy that can
// drift from the page it describes.
const DESTINATIONS = [
  {
    href: "/portal/attend",
    title: "Event Check-In",
    body: "Check in to a MISA event.",
    action: "Check in",
  },
  {
    href: "/portal/leaderboard",
    title: "Leaderboard",
    body: "Current-term standings for MISA members.",
    action: "See the standings",
  },
  {
    href: "/portal/lookup",
    title: "My Attendance",
    body: "Look up your own MISA attendance, points and dues status.",
    action: "Look up your attendance",
  },
] as const;

// One skin for every destination (see the header note), full width on a phone
// and one fixed width beside the text from `sm`, so the column of buttons is
// straight. `whitespace-nowrap` so a label can never break inside the width.
const DESTINATION_BUTTON = buttonClass({
  variant: "primary",
  className: "mt-5 w-full shrink-0 whitespace-nowrap sm:mt-0 sm:w-64",
});

export default function PortalPage() {
  return (
    <>
      {/* 1. LAYOUT FAMILY: Page hero. No subhead, like /attend's: the rows
          below say what the portal holds. */}
      <PageHero title="Member Portal" />

      {/* 2. LAYOUT FAMILY: Stacked row cards. Narrow, like the member pages. */}
      <Section padTop="sm" padBottom="md" width="narrow">
        <ul className="grid gap-card">
          {DESTINATIONS.map((destination, i) => (
            // The panel is not the link — the button is — so it carries no
            // hover of its own (DESIGN.md: a plate earns a hover cue only by
            // becoming the interaction). Server-rendered on first paint, so
            // `data-reveal` is safe here.
            <Panel
              as="li"
              key={destination.href}
              pad="lg"
              data-reveal="up"
              style={revealDelay(0.06 * i)}
              className="sm:flex sm:items-center sm:justify-between sm:gap-8"
            >
              <div>
                <Title as="h2" className="text-misa-blue">
                  {destination.title}
                </Title>
                <p className="mt-2 leading-[1.6] text-misa-secondary">
                  {destination.body}
                </p>
              </div>
              <Link href={destination.href} className={DESTINATION_BUTTON}>
                {destination.action}
              </Link>
            </Panel>
          ))}
        </ul>

        <p className="mt-8 text-sm text-misa-secondary">
          Officers:{" "}
          <Link
            href="/admin/login"
            className="text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
          >
            sign in
          </Link>
        </p>
      </Section>
    </>
  );
}

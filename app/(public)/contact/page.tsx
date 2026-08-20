import type { Metadata } from "next";

import { BUTTON_SOLID_NAVY } from "@/components/ui/button";
import { PageHero } from "@/components/ui/chevron-section";
import { Field, Input, Textarea } from "@/components/ui/field";
import { PhotoSlot } from "@/components/ui/photo-slot";
import { revealDelay } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";
import {
  CONTACT_EMAIL,
  CONTACT_SLOT,
  CORPORATE_EMAIL,
  INSTAGRAM_HANDLE,
  SOCIAL_LINKS,
} from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with Texas MISA.",
};

// /contact, rebuilt from scratch in v2 phase 2.
//
// 🔴 **BUILT FROM THE HOME PAGE, NOT FROM THE OLD /contact.** Exact words kept,
// nothing else. What was here was a single section: a bare `<ul>` of label-and-
// link pairs beside a disabled form, on the grey page ground, with no image and
// no motion — the only public page with neither of those.
//
// The original recreates txmisa.org/contact-us (docs/existing-site-inventory.md).
// That form posts to Squarespace; there is no equivalent backend here, so it is
// rendered for layout fidelity but DISABLED, with the email addresses as the
// working path. Wiring it means a Server Action plus somewhere to deliver the
// message (§3: all writes go through Server Actions), which is out of scope for
// a presentational phase.
//
// ── THE LAYOUT-FAMILY BUDGET ────────────────────────────────────────────────
//
//   1. Hero ......... Page hero (field + chevron notch)
//   2. Channels ..... Shared-rule plate, 3 cells
//   3. Message ...... Form on a white band, beside a leaning plate
//
// THREE sections, THREE families. Eyebrow cap would be ceil(3 / 3) = 1; the page
// uses zero, for the reason on the `<dt>` below.
//
// 🪤 **SECTION 3 IS THE CLEAREST INSTANCE OF THE GROUND TRAP ON THE SITE, and
// this page was sitting in it.** Four `Input`/`Textarea` controls fill with
// `controlClass`, whose background is `bg-misa-panel` — which became the public
// page ground's own colour on 2026-08-19. Every field was the same grey as the
// page behind it: a form with no visible edges. The fix is
// `<Section ground="white">` and nothing else. **Never recolour the primitive**:
// `field.tsx` is shared with all of /admin, which is still on the v1 white
// system until phase 4, and repainting it there would break the one surface that
// is currently correct.
//
// 📌 **Still routed and still UNLINKED from the desktop nav.** The handoff drops
// it and the About FAQ band is the contact path it puts in its place; the
// wordmark is absolutely centred and wins the z-order, so a sixth nav item would
// disappear behind it rather than wrap. It stays in the mobile sheet, which has
// no wordmark to clear.

const CONTACTS = [
  { label: "Email", value: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
  {
    label: "Instagram DM",
    value: INSTAGRAM_HANDLE,
    href: SOCIAL_LINKS.instagram,
  },
  {
    label: "Corporate Relations",
    value: CORPORATE_EMAIL,
    href: `mailto:${CORPORATE_EMAIL}`,
  },
];

export default function ContactPage() {
  return (
    <>
      {/* 1. LAYOUT FAMILY: Page hero. */}
      <PageHero
        title="Contact Us"
        subhead="If you have any questions or comments, please don't hesitate to reach out."
      />

      {/* 2. LAYOUT FAMILY: Shared-rule plate, three cells.
             📌 The home page's partner-plate device, carrying the three ways to
             reach the club. Three channels of equal weight is exactly the case a
             shared-rule plate is for, and it replaces a bare `<ul>`.
             📌 A `<dl>`: three channels each with a name and an address IS a
             description list, and saying so gets a screen reader the pairing for
             free.
             🪤 ONE background showing through `gap-px`, never a border per cell —
             two adjacent borders read as a double rule. The cells stay opaque
             white, or the container shows through the whole cell. */}
      <Section padTop="sm" padBottom="md" width="page">
        <dl
          data-reveal="wipe"
          className="grid auto-rows-fr gap-px border border-misa-hairline bg-misa-hairline sm:grid-cols-3"
        >
          {CONTACTS.map((contact) => (
            <div key={contact.label} className="bg-white px-6 py-7">
              {/* 🪤 **Deliberately NOT the `Eyebrow` component**, which is what
                  this used to be. Two reasons, both more than tidying.
                  `Eyebrow`'s base class is `text-misa-blue`, so the old
                  `<Eyebrow className="text-misa-muted">` put two competing
                  `text-*` utilities on one element, resolved by Tailwind's own
                  stylesheet order rather than by the order they were written.
                  And §4.7's eyebrow cap is counted by grepping for exactly this
                  signature: three channel labels inside a list are data labels,
                  not micro-labels above a section headline, and counting them
                  would put a three-section page over a cap of one.
                  #6f7275 on white is 5.06:1. */}
              <dt className="text-[12px] leading-tight font-medium tracking-[0.14em] text-misa-muted uppercase">
                {contact.label}
              </dt>
              <dd className="mt-2">
                <a
                  href={contact.href}
                  target={contact.href.startsWith("http") ? "_blank" : undefined}
                  rel={
                    contact.href.startsWith("http")
                      ? "noopener noreferrer"
                      : undefined
                  }
                  className="font-display text-[19px] leading-[1.15] font-semibold tracking-[-0.01em] text-misa-blue underline underline-offset-4 transition-colors duration-(--dur-hover) hover:text-misa-blue-dark sm:text-[21px]"
                >
                  {contact.value}
                </a>
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* 3. LAYOUT FAMILY: Form on a white band, beside a leaning plate.
             🪤 `ground="white"` is a CORRECTNESS control here, not a taste one.
             See the trap in this file's header: every control below fills with
             the page ground's own grey.
             📌 The photograph is why this page is no longer text-only. §4.8 is
             blunt that a pure-text page "is not minimalism, it is incomplete
             work", and a page whose whole job is "come talk to us" should show
             the people saying it.
             📌 This is the page's ONLY image+text split, well inside the cap of
             two consecutive. */}
      <Section
        ground="white"
        pad="md"
        width="page"
        innerClassName="grid gap-split lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]"
      >
        <div data-reveal="up">
          {/* ⚠️ Disabled for layout fidelity, not styled to look enabled. The
              shared control carries one disabled treatment for the whole app,
              which is the point — this page used to have its own
              `disabled:opacity-60` against the two other thresholds in use
              elsewhere. */}
          <fieldset disabled className="flex flex-col gap-5">
            <legend className="sr-only">Contact form</legend>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="First name">
                <Input type="text" name="firstName" autoComplete="given-name" />
              </Field>
              <Field label="Last name">
                <Input type="text" name="lastName" autoComplete="family-name" />
              </Field>
            </div>
            <Field label="Email">
              <Input
                type="email"
                spellCheck={false}
                name="email"
                autoComplete="email"
              />
            </Field>
            <Field label="Message">
              <Textarea name="message" rows={5} />
            </Field>
            <button type="submit" className={`w-fit ${BUTTON_SOLID_NAVY}`}>
              Send
            </button>
          </fieldset>
          <p className="mt-4 text-xs text-misa-muted">
            This form isn&apos;t connected yet — please email{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-misa-blue underline"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            in the meantime.
          </p>
        </div>

        {/* 🪤 The lean is a `lg:`-scoped class on `.plate`, never on the node
            carrying `data-reveal` — `[data-revealed]` sets `transform: none`, so
            a plate holding both would snap square the first time it scrolled
            into view. It stops below `lg` because down there this is a
            full-width block above the form and a lean would only cost overflow
            headroom. */}
        <div
          data-reveal="up"
          style={revealDelay(0.08)}
          className="order-first lg:order-none"
        >
          <div className="plate border border-misa-plate-edge shadow-lift lg:[--plate-tilt:-2deg]">
            <PhotoSlot
              slot={CONTACT_SLOT}
              ratio="aspect-4/3"
              sizes="(max-width: 1024px) 92vw, 40vw"
            />
          </div>
        </div>
      </Section>
    </>
  );
}

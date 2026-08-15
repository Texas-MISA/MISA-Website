import type { Metadata } from "next";

import { BUTTON_SOLID_NAVY } from "@/components/ui/button";
import { PageHero } from "@/components/ui/chevron-section";
import {
  CONTACT_EMAIL,
  CORPORATE_EMAIL,
  INSTAGRAM_HANDLE,
  SOCIAL_LINKS,
} from "@/lib/site";

// Recreation of txmisa.org/contact-us (docs/existing-site-inventory.md).
//
// The original's form posts to Squarespace. There is no equivalent backend
// here yet, so the form is rendered for layout fidelity but disabled, with the
// email addresses as the working path. Wiring it up means a Server Action plus
// somewhere to deliver the message (§3: all writes go through Server Actions),
// which is a deliberate later decision, not a Stage 2 one.

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with Texas MISA.",
};

const CONTACTS = [
  { label: "Email", value: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
  { label: "Instagram DM", value: INSTAGRAM_HANDLE, href: SOCIAL_LINKS.instagram },
  {
    label: "Corporate Relations",
    value: CORPORATE_EMAIL,
    href: `mailto:${CORPORATE_EMAIL}`,
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        title="Contact Us"
        subhead="If you have any questions or comments, please don't hesitate to reach out."
      />
      <section className="px-5 py-14 sm:px-14">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <ul className="flex flex-col gap-8">
            {CONTACTS.map((contact) => (
              <li key={contact.label}>
                <p className="text-xs leading-tight font-medium tracking-[0.14em] uppercase text-misa-muted">
                  {contact.label}
                </p>
                <a
                  href={contact.href}
                  target={contact.href.startsWith("http") ? "_blank" : undefined}
                  rel={contact.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="mt-1 inline-block text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
                >
                  {contact.value}
                </a>
              </li>
            ))}
          </ul>

          <div>
            <fieldset disabled className="flex flex-col gap-5">
              <legend className="sr-only">Contact form</legend>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  First Name
                  <input
                    type="text"
                    name="firstName"
                    autoComplete="given-name"
                    className="border border-misa-border bg-white px-3 py-2 disabled:opacity-60"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Last Name
                  <input
                    type="text"
                    name="lastName"
                    autoComplete="family-name"
                    className="border border-misa-border bg-white px-3 py-2 disabled:opacity-60"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm">
                Email
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  className="border border-misa-border bg-white px-3 py-2 disabled:opacity-60"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Message
                <textarea
                  name="message"
                  rows={5}
                  className="border border-misa-border bg-white px-3 py-2 disabled:opacity-60"
                />
              </label>
              <button
                type="submit"
                className={`w-fit ${BUTTON_SOLID_NAVY} disabled:opacity-60`}
              >
                SEND
              </button>
            </fieldset>
            <p className="mt-4 text-xs text-misa-muted">
              This form isn&apos;t connected yet — please email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-misa-blue underline underline-offset-4"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              in the meantime.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

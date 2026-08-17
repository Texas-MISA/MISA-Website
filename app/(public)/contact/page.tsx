import type { Metadata } from "next";

import { BUTTON_SOLID_NAVY } from "@/components/ui/button";
import { PageHero } from "@/components/ui/chevron-section";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Eyebrow } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
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
      <PageHero
        title="Contact Us"
        subhead="If you have any questions or comments, please don't hesitate to reach out."
      />
      <Section
        pad="md"
        width="page"
        innerClassName="grid grid-cols-1 gap-12 lg:grid-cols-2"
      >
        <ul className="flex flex-col gap-8">
          {CONTACTS.map((contact) => (
            <li key={contact.label}>
              <Eyebrow className="text-misa-muted">{contact.label}</Eyebrow>
              <a
                href={contact.href}
                target={contact.href.startsWith("http") ? "_blank" : undefined}
                rel={
                  contact.href.startsWith("http")
                    ? "noopener noreferrer"
                    : undefined
                }
                className="mt-1 inline-block text-misa-blue underline hover:text-misa-blue-dark"
              >
                {contact.value}
              </a>
            </li>
          ))}
        </ul>

        <div>
          {/* ⚠️ Disabled for layout fidelity, not styled to look enabled. The
              shared control carries one disabled treatment for the whole app,
              which is the point — this page had its own `disabled:opacity-60`
              against the two other thresholds in use elsewhere. */}
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
      </Section>
    </>
  );
}

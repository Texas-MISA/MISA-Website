import type { Metadata } from "next";

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
    <section className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-display text-3xl font-extrabold sm:text-5xl">Contact Us!</h1>
        <p className="mt-4 max-w-2xl text-foreground/80">
          If you have any questions or comments, please don&apos;t hesitate to reach out
          via the contacts below.
        </p>

        <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-2">
          <ul className="flex flex-col gap-8">
            {CONTACTS.map((contact) => (
              <li key={contact.label}>
                <p className="font-display font-bold">{contact.label}</p>
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
                    className="border border-black/70 bg-misa-panel px-3 py-2 disabled:opacity-60"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Last Name
                  <input
                    type="text"
                    name="lastName"
                    autoComplete="family-name"
                    className="border border-black/70 bg-misa-panel px-3 py-2 disabled:opacity-60"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm">
                Email
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  className="border border-black/70 bg-misa-panel px-3 py-2 disabled:opacity-60"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Message
                <textarea
                  name="message"
                  rows={5}
                  className="border border-black/70 bg-misa-panel px-3 py-2 disabled:opacity-60"
                />
              </label>
              <button
                type="submit"
                className="w-fit rounded-full bg-misa-blue px-10 py-3 text-xs font-medium tracking-wider text-white disabled:opacity-60"
              >
                SEND
              </button>
            </fieldset>
            <p className="mt-4 text-xs text-foreground/60">
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
      </div>
    </section>
  );
}

import type { Metadata } from "next";

import { CheckinForm } from "./_components/checkin-form";

// Public check-in (§7 Stage 3). Three fields, no account, phone-first —
// §1.2's target is a completed check-in in under 20 seconds. The page itself
// is static; all the work happens in the submitCheckin Server Action.

export const metadata: Metadata = {
  title: "Check In",
  description: "Check in to a MISA event.",
};

export default function AttendPage() {
  return (
    <section className="px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          Event Check-In
        </h1>
        <p className="mt-3 text-foreground/70">
          At a MISA event? Enter your details and you&apos;re done.
        </p>
        <div className="mt-8">
          <CheckinForm />
        </div>
      </div>
    </section>
  );
}

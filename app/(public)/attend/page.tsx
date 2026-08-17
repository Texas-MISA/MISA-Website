import type { Metadata } from "next";

import { PageHero } from "@/components/ui/chevron-section";
import { Section } from "@/components/ui/section";

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
    <>
      <PageHero
        title="Event Check-In"
        subhead="At a MISA event? Enter your details and you're done."
      />
      <Section pad="md" width="narrow" innerClassName="max-w-xl">
        <CheckinForm />
      </Section>
    </>
  );
}

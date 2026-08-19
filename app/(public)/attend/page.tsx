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
      {/* 🪤 `ground="white"` is not decoration. Every control in the form
          fills with `bg-misa-panel` (see `controlClass` in components/ui/
          field.tsx), which is the SAME grey the public page ground became on
          2026-08-19 — on the page ground the inputs would be the colour of what
          is behind them. The fix is a white surface under the form, not a
          recoloured primitive: `controlClass` is shared with /admin, which
          keeps the outgoing white system. */}
      <Section
        ground="white"
        pad="md"
        width="narrow"
        innerClassName="max-w-xl"
      >
        <CheckinForm />
      </Section>
    </>
  );
}

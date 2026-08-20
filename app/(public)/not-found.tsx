import { RecoveryNav } from "@/components/ui/recovery-nav";
import { Section } from "@/components/ui/section";

// The public 404 (Stage 8 phase 3, restyled in v2 phase 2). Renders inside
// (public)/layout.tsx, so the site header and footer stay — a visitor who
// mistypes a URL lands somewhere they can navigate from rather than on a bare
// framework page.
//
// 🪤 This file is NOT the one that catches a mistyped address, and assuming it
// was is a mistake worth recording — it survived local testing and was only
// caught against the deployed site. `(public)` is a route GROUP, so it does not
// appear in the URL and does not participate in matching: an unmatched address
// belongs to no segment and falls all the way to `app/not-found.tsx`. This file
// fires only for a `notFound()` thrown by a page already inside the group.
//
// Both exist. This one gets the chrome from (public)/layout.tsx; the root one
// renders SiteHeader and SiteFooter itself, because the root layout has neither.
// 🔓 The row of links they both draw is `components/ui/recovery-nav.tsx` now,
// where it used to be written out in full in each file.

export default function PublicNotFound() {
  return (
    <Section pad="lg" width="narrow">
      <h1 className="font-display text-[34px] leading-[1.02] font-semibold tracking-[-0.02em] text-misa-blue sm:text-[42px]">
        Page not found
      </h1>
      <p className="mt-4 text-lg leading-[1.65] text-misa-body">
        That address doesn&apos;t exist. It may have moved, or the link that
        sent you here may be out of date.
      </p>
      <RecoveryNav className="mt-8" />
    </Section>
  );
}

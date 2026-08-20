import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { RecoveryNav } from "@/components/ui/recovery-nav";
import { Section } from "@/components/ui/section";

// The app-wide 404: every URL that matches no route at all.
//
// 🪤 This is NOT the same file as app/(public)/not-found.tsx, and adding only
// that one was a real gap — caught on the deployed site rather than locally.
// `(public)` is a route GROUP, so it does not appear in the URL and therefore
// does not participate in matching: an unmatched address belongs to no segment,
// falls all the way to the root, and got Next's built-in 404 with no header, no
// links and no way back. The (public) file only ever fires for a `notFound()`
// thrown by a page already inside that group.
//
// ⚠️ It renders inside app/layout.tsx, which carries the fonts and the
// stylesheet but NOT the site chrome — SiteHeader and SiteFooter live in
// app/(public)/layout.tsx. So this renders them itself. That duplication is the
// price of the root position; the alternative is a 404 that looks like a
// different website.
//
// 🐛 **And it needs the page GROUND for the same reason, which it was missing.**
// `bg-misa-panel` lives on `(public)/layout.tsx`'s `<main>` — deliberately not
// on `body`, because `body` is shared with /admin, which is still on the v1
// white system until phase 4. This file is outside that layout, so from
// 2026-08-19 until v2 phase 2 the root 404 was the one public-looking page on
// the site still rendering on white: full chrome, right type, wrong ground.
// Anything else that ever renders outside `(public)/layout.tsx` and wants to
// look like the public site has to bring the grey itself.

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-misa-panel">
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
      </main>
      <SiteFooter />
    </div>
  );
}

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { RevealObserver } from "@/components/ui/reveal-observer";

// Chrome shared by every public page. The admin routes (Stage 4) get their own
// layout, which is why this lives on the route group rather than the root.
//
// RevealObserver is mounted once here rather than per page: the animated
// sections stay server-rendered and only carry a `data-reveal` attribute, so
// this is the single client component the public site needs for motion.
export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {/* First focusable thing in the document. The header carries five nav
          items, two links and a button before the content begins, and a
          keyboard or switch user should not have to walk them on every page.
          Off-screen until focused — see `.skip-link` in globals.css. */}
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <RevealObserver />
    </>
  );
}

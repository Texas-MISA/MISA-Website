import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { RevealObserver } from "@/components/ui/reveal-observer";

// Chrome shared by every public page. The admin routes (Stage 4) get their own
// layout, which is why this lives on the route group rather than the root.
//
// RevealObserver is mounted once here rather than per page: the animated
// sections stay server-rendered and only carry a `data-reveal` attribute, so
// this is the single client component the public site needs for motion.
//
// 🔓 **`bg-misa-panel` on `<main>` is the public site's PAGE GROUND, and it is
// grey** (officer, 2026-08-19: make the whole white background that grey,
// except for a little around the rotating galleries). It replaces a
// gray-to-white radial (`.ground-paper`, now deleted) that only two sections
// wore, and the plain white that everything else inherited from `body`.
//
// 🪤 It lives HERE, on the public group's `<main>`, and not on `body` — which
// is what keeps `/admin` white. Admin still renders the outgoing v1 system and
// is out of scope for the v2 redesign, and `body` is shared with it.
//
// 🪤 `--background` stays `#ffffff` and must. `.sheet`, the bento cards and the
// partner cells are all *lifted white surfaces*, and a surface can only read as
// lifted off a ground that is not the same colour it is. The grey is the
// background; the cards stay white.
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
      <main id="main" className="flex-1 bg-misa-panel">
        {children}
      </main>
      <SiteFooter />
      <RevealObserver />
    </>
  );
}

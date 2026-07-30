import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

// Chrome shared by every public page. The admin routes (Stage 4) get their own
// layout, which is why this lives on the route group rather than the root.
export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}

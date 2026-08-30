import type { Metadata } from "next";

import { requireOfficer } from "@/lib/auth";

import { AdminNav } from "./_components/admin-nav";

// Chrome for every authenticated admin route (§5). The (shell) route group
// does not appear in URLs, so §5's route table is satisfied exactly — it
// exists so /admin/login can sit outside the requireOfficer() boundary.
//
// Divergence from §10's flat app/admin/ sketch, noted in the architecture doc.

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s — MISA Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Layouts do not re-run on client-side navigation between sibling routes,
  // so this is a first line of defence, not the whole one — every page under
  // it calls requireOfficer() too, and every action calls getOfficer().
  const officer = await requireOfficer();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Nine nav items plus a sign-out sit before the content here — more
          than the public header, and officers work this screen all semester. */}
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <AdminNav
        displayName={officer.displayName ?? officer.email}
        role={officer.role}
      />
      {/* 🔓 **The officer side moves onto the v2 ground here** (phase 4). Vellum
          on `<main>`, exactly as the public layout does it, with content regions
          as white surfaces lifted off it — `DESIGN.md`'s rule, unchanged: *the
          grey is the background; cards stay white.*

          🪤 On `<main>`, never on `body`. `body` keeps `--background: #ffffff`
          and must: `Panel ground="white"`, the sticky `<THead>` and every card
          on these screens only read as lifted off a ground that is not their own
          colour.

          🔴 This line lands LAST, and the order is the opposite of the tempting
          one. Five shared primitives fill with `bg-misa-panel` — `controlClass`,
          `table.tsx`'s sticky head, `chip.tsx`'s resting `FilterChip`,
          `banner.tsx`'s neutral variant and `Tr`'s hover — so on a Vellum page
          each is the same colour as what is behind it: inputs disappear, the
          sticky head stops separating from the rows scrolling under it, and row
          hover does nothing. Every screen was wrapped in white surfaces first,
          which is what makes this one line safe. */}
      <main id="main" className="flex-1 bg-misa-panel px-6 py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

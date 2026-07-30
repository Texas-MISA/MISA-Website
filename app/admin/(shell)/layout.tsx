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
      <AdminNav
        displayName={officer.displayName ?? officer.email}
        role={officer.role}
      />
      <main className="flex-1 px-6 py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

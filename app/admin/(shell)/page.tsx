import type { Metadata } from "next";
import Link from "next/link";

import { requireOfficer } from "@/lib/auth";

import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { PendingBadge } from "./_components/pending-badge";
import { RecentCheckins } from "./_components/recent-checkins";

// Officer dashboard (§5, §7 Stage 4): what needs attention, then what just
// happened.

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  // Not redundant with the layout's check: layouts do not re-run on
  // client-side navigation between sibling routes. cache() makes it free.
  const officer = await requireOfficer();

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Signed in as ${officer.email}.`}
      />

      <section className="mt-10">
        <SectionHeading>Needs review</SectionHeading>
        <div className="mt-4">
          <PendingBadge />
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <SectionHeading>Recent check-ins</SectionHeading>
          <Link
            href="/admin/events"
            className="text-sm text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
          >
            Manage events
          </Link>
        </div>
        <div className="mt-4">
          <RecentCheckins />
        </div>
      </section>
    </div>
  );
}

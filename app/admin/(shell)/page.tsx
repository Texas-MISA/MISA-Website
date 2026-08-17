import type { Metadata } from "next";
import Link from "next/link";

import { requireOfficer } from "@/lib/auth";

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
      <h1 className="font-display text-[30px] leading-[1.02] font-semibold tracking-[-0.015em] sm:text-[34px]">
        Dashboard
      </h1>
      <p className="mt-3 text-misa-body">
        Signed in as {officer.email}.
      </p>

      <section className="mt-10">
        <h2 className="font-display text-[22px] leading-[1.05] font-semibold">Needs review</h2>
        <div className="mt-4">
          <PendingBadge />
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-[22px] leading-[1.05] font-semibold">Recent check-ins</h2>
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

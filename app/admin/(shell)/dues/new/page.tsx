import type { Metadata } from "next";

import { ReadError } from "@/app/admin/(shell)/_components/notice";
import { requireOfficer } from "@/lib/auth";
import { MAX_TERMS_COVERED, formatCents } from "@/lib/dues";
import { toCentralFields } from "@/lib/events";
import { fetchMemberOptions } from "@/lib/member-options";
import { createAdminClient } from "@/lib/supabase/admin";

import { PageHeader } from "@/components/ui/page-header";
import { PaymentForm, type TermChoice } from "./_components/payment-form";

// Recording a dues payment by hand (migration 32): cash at a meeting, a Zelle
// transfer, or another method that will never appear on a Venmo statement.
//
// 📌 It records a PAYMENT, not a status. The form writes one dues_payments row
// through createPayment, and the member's dues status goes on being derived
// from it, exactly as from an imported row.
//
// Everything the form shows that needs Intl is formatted HERE and passed down
// as strings: the Central "now" the date and time start at, and the prices in
// the terms choice. Intl inside a Client Component is a hydration diff.

export const metadata: Metadata = { title: "Record a payment" };

async function readPrices(
  db: ReturnType<typeof createAdminClient>
): Promise<{ oneTermCents: number; twoTermCents: number } | null> {
  const { data, error } = await db
    .from("app_settings")
    .select("dues_one_term_cents, dues_two_term_cents")
    .maybeSingle();

  if (error || !data) {
    console.error("dues price read failed:", error?.message ?? "no settings row");
    return null;
  }
  return {
    oneTermCents: data.dues_one_term_cents,
    twoTermCents: data.dues_two_term_cents,
  };
}

export default async function NewPaymentPage({
  searchParams,
}: {
  // Promise in Next 16 — await before reading.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOfficer();

  const params = await searchParams;
  const db = createAdminClient();
  const [membersResult, prices] = await Promise.all([
    fetchMemberOptions(db),
    readPrices(db),
  ]);
  const members = membersResult.kind === "ok" ? membersResult.options : [];

  // `?member=` pre-selects a member, from the Dues section of their page. Taken
  // only when it names somebody actually offered: the option ids are the
  // roster's uuids, so anything else (a typo, a deleted member, a non-uuid) is
  // ignored rather than posted back as a member the picker cannot show.
  const requested = typeof params.member === "string" ? params.member : "";
  const memberId = members.some((member) => member.id === requested)
    ? requested
    : "";

  // Central wall time, read on the server: an officer recording a payment they
  // were just handed should only have to check these, not type them.
  const now = toCentralFields(new Date());

  // The real prices beside the two counts they buy. 🔓 A failed price read
  // drops the amounts and keeps every choice: the officer still knows what
  // the member paid for, and hiding the choice would only push the payment
  // into the review queue for want of a label.
  const priceOf = (terms: number): string | null =>
    prices === null
      ? null
      : terms === 1
        ? formatCents(prices.oneTermCents)
        : terms === 2
          ? formatCents(prices.twoTermCents)
          : null;

  const termChoices: TermChoice[] = [
    {
      value: "",
      label: "Decide later (covers nothing until then)",
    },
    ...Array.from({ length: MAX_TERMS_COVERED }, (_, i) => {
      const terms = i + 1;
      const price = priceOf(terms);
      const noun = `${terms} term${terms === 1 ? "" : "s"}`;
      return { value: String(terms), label: price ? `${noun} (${price})` : noun };
    }),
  ];

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/dues", label: "Back to the ledger" }}
        title="Record a payment"
        description="For dues that did not come through Venmo: cash handed to an officer, a Zelle transfer, or another method. It is recorded under your name and counts toward the member's dues exactly as an imported payment does."
      />

      {membersResult.kind === "error" && (
        <ReadError
          what="the roster, so no member can be picked"
          className="mt-6 max-w-2xl"
        />
      )}
      {prices === null && (
        <ReadError
          what="the dues prices, so the terms below show no amounts"
          className="mt-6 max-w-2xl"
        />
      )}

      <div className="mt-8">
        <PaymentForm
          members={members}
          defaults={{ memberId, paidDate: now.date, paidTime: now.time }}
          termChoices={termChoices}
        />
      </div>
    </div>
  );
}

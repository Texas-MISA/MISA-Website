import type { Metadata } from "next";
import Link from "next/link";

import { requireOfficer } from "@/lib/auth";

import { FieldForm } from "../_components/field-form";

export const metadata: Metadata = { title: "New field" };

export default async function NewMemberFieldPage() {
  await requireOfficer();

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-[30px] leading-[1.02] font-semibold tracking-[-0.015em] sm:text-[34px]">
        New custom field
      </h1>

      <p className="mt-3 text-sm">
        <Link href="/admin/members/fields" className="underline">
          ← Back to custom fields
        </Link>
      </p>

      <p className="mt-6 max-w-2xl text-sm text-misa-secondary">
        A dropdown officers can set on any member. Pick the options carefully:
        the key can never change, and while options can be edited later, removing
        one leaves every member who held it holding a value the field no longer
        offers.
      </p>

      <div className="mt-8">
        <FieldForm />
      </div>
    </div>
  );
}

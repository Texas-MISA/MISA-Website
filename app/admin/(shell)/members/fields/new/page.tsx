import type { Metadata } from "next";

import { requireOfficer } from "@/lib/auth";

import { PageHeader } from "@/components/ui/page-header";
import { FieldForm } from "../_components/field-form";

export const metadata: Metadata = { title: "New field" };

export default async function NewMemberFieldPage() {
  await requireOfficer();

  return (
    <div className="max-w-3xl">
      <PageHeader
        back={{ href: "/admin/members/fields", label: "Back to custom fields" }}
        title="New custom field"
        description="A dropdown officers can set on any member. Pick the options carefully: the key can never change, and while options can be edited later, removing one leaves every member who held it holding a value the field no longer offers."
      />

      <div className="mt-8">
        <FieldForm />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AuditTrail } from "@/app/admin/(shell)/_components/audit-trail";
import { requireOfficer } from "@/lib/auth";
import { fetchFieldDefinitions } from "@/lib/member-fields";
import { customFieldColumn } from "@/lib/members";
import { createAdminClient } from "@/lib/supabase/admin";

import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { FieldArchive } from "./_components/field-archive";
import { FieldForm } from "../_components/field-form";

export const metadata: Metadata = { title: "Custom field" };

export default async function MemberFieldPage({
  params,
}: {
  // Promise in Next 16 — await before reading.
  params: Promise<{ id: string }>;
}) {
  await requireOfficer();

  const { id } = await params;
  const db = createAdminClient();

  const definitions = await fetchFieldDefinitions(db, { includeArchived: true });
  const definition = definitions.find((d) => d.id === id);
  if (!definition) notFound();

  const holders = await countHolders(db, definition.key);

  return (
    <div className="max-w-3xl">
      <PageHeader
        back={{ href: "/admin/members/fields", label: "Back to custom fields" }}
        title={definition.label}
        badge={
          definition.archivedAt ? (
            <Pill tone="neutral" size="md">
              archived
            </Pill>
          ) : null
        }
      />

      <p className="mt-6 text-sm text-misa-secondary">
        {holders === 0
          ? "No member holds a value for this field yet."
          : holders === 1
            ? "1 member holds a value for this field."
            : `${holders} members hold a value for this field.`}
      </p>

      <section className="mt-10">
        <SectionHeading>Settings</SectionHeading>
        <div className="mt-4">
          <FieldForm definition={definition} />
        </div>
      </section>

      <section className="mt-12">
        <SectionHeading>
          {definition.archivedAt ? "Restore" : "Archive"}
        </SectionHeading>
        <div className="mt-4">
          <FieldArchive
            id={definition.id}
            archived={definition.archivedAt !== null}
            holders={holders}
          />
        </div>
      </section>

      <section className="mt-12">
        <SectionHeading>History</SectionHeading>
        <div className="mt-4">
          <AuditTrail entityType="member_field" entityId={definition.id} />
        </div>
      </section>
    </div>
  );
}

/**
 * How many members currently hold a value for this field.
 *
 * 🔓 `customFieldColumn` is doing double duty as the key check here. The key came
 * out of the database and is therefore already well-formed, but it is about to
 * be interpolated into a PostgREST filter string — the same surface as an
 * `order=` term — and the rule for a key in a query string is that it is
 * re-checked where it is used, never trusted by provenance. A null answer means
 * the key would not survive the check, and 0 is the safe report.
 */
async function countHolders(
  db: ReturnType<typeof createAdminClient>,
  key: string
): Promise<number> {
  const column = customFieldColumn(key);
  if (!column) return 0;

  const { count, error } = await db
    .from("members")
    .select("id", { count: "exact", head: true })
    .not(column, "is", null);

  if (error) {
    console.error("field holder count failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

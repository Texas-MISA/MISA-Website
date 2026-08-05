import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AuditTrail } from "@/app/admin/(shell)/_components/audit-trail";
import { requireOfficer } from "@/lib/auth";
import { fetchFieldDefinitions } from "@/lib/member-fields";
import { customSortColumn } from "@/lib/members";
import { createAdminClient } from "@/lib/supabase/admin";

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
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          {definition.label}
        </h1>
        {definition.archivedAt && (
          <span className="border border-black/40 px-2 py-1 text-[0.65rem] uppercase tracking-wider">
            archived
          </span>
        )}
      </div>

      <p className="mt-3 text-sm">
        <Link href="/admin/members/fields" className="underline">
          ← Back to custom fields
        </Link>
      </p>

      <p className="mt-6 text-sm text-foreground/70">
        {holders === 0
          ? "No member holds a value for this field yet."
          : holders === 1
            ? "1 member holds a value for this field."
            : `${holders} members hold a value for this field.`}
      </p>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold">Settings</h2>
        <div className="mt-4">
          <FieldForm definition={definition} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-bold">
          {definition.archivedAt ? "Restore" : "Archive"}
        </h2>
        <div className="mt-4">
          <FieldArchive
            id={definition.id}
            archived={definition.archivedAt !== null}
            holders={holders}
          />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-bold">History</h2>
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
 * 🔓 `customSortColumn` is doing double duty as the key check here. The key came
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
  const column = customSortColumn(key);
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

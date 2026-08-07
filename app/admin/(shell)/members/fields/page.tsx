import type { Metadata } from "next";
import Link from "next/link";

import { requireOfficer } from "@/lib/auth";
import { fetchFieldDefinitions } from "@/lib/member-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FieldDefinition } from "@/lib/members";

// Officer-defined custom fields (§7 Stage 6 phase 4).
//
// Reached from the directory header rather than the admin nav: admin-nav.tsx
// marks an entry active with pathname.startsWith, so a Fields entry there would
// light "Members" up alongside it, and the nav enumerates top-level sections
// rather than every screen.
//
// Any officer may create, edit and archive a field (§9 #6 — the audit log is
// the control, not a role gate). Nothing here branches on admin_profiles.role.

export const metadata: Metadata = { title: "Custom fields" };

export default async function MemberFieldsPage() {
  await requireOfficer();

  const db = createAdminClient();
  const definitions = await fetchFieldDefinitions(db, { includeArchived: true });

  const live = definitions.filter((d) => d.archivedAt === null);
  const archived = definitions.filter((d) => d.archivedAt !== null);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          Custom fields
        </h1>
        <Link
          href="/admin/members/fields/new"
          className="rounded-full bg-misa-blue px-6 py-2 text-xs font-medium tracking-wider text-white transition hover:bg-misa-blue-dark"
        >
          NEW FIELD
        </Link>
      </div>

      <p className="mt-3 text-sm">
        <Link href="/admin/members" className="underline">
          ← Back to the directory
        </Link>
      </p>

      <p className="mt-6 max-w-2xl text-sm text-foreground/70">
        Dropdowns officers can set on any member — t-shirt size, committee,
        major. Fields marked as directory columns appear in the roster table and
        can be sorted on; the rest live on each member&apos;s own page.
      </p>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold">Live</h2>
        <div className="mt-4">
          {live.length === 0 ? (
            <p className="border-l-4 border-misa-blue bg-misa-panel px-4 py-3 text-sm">
              No custom fields yet. The directory shows its four built-in
              columns until you add one.
            </p>
          ) : (
            <FieldTable rows={live} />
          )}
        </div>
      </section>

      {archived.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-xl font-bold">Archived</h2>
          <p className="mt-2 max-w-2xl text-sm text-foreground/70">
            No longer offered anywhere.{" "}
            <span className="font-medium">
              Members keep every answer given under these
            </span>{" "}
            — archiving hides a field, it never rewrites history — and the
            answers still show on each member&apos;s page. Their keys stay
            reserved for the same reason.
          </p>
          <div className="mt-4">
            <FieldTable rows={archived} />
          </div>
        </section>
      )}
    </div>
  );
}

function FieldTable({ rows }: { rows: FieldDefinition[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[48rem] border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-2 pr-4 font-medium">Label</th>
            <th className="py-2 pr-4 font-medium">Key</th>
            <th className="py-2 pr-4 font-medium">Options</th>
            <th className="py-2 pr-4 font-medium">Where</th>
            <th className="py-2 pr-4 font-medium">Order</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-black/15 align-top">
              <td className="py-2 pr-4">
                <Link
                  href={`/admin/members/fields/${row.id}`}
                  className="text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
                >
                  {row.label}
                </Link>
              </td>
              <td className="py-2 pr-4 font-mono text-xs">{row.key}</td>
              <td className="py-2 pr-4">{row.options.join(", ")}</td>
              <td className="py-2 pr-4">
                {row.showInDirectory ? (
                  <>
                    Directory column
                    {row.editableInline ? ", editable inline" : ", read-only"}
                  </>
                ) : (
                  "Member page only"
                )}
              </td>
              <td className="py-2 pr-4 tabular-nums">{row.sortOrder}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

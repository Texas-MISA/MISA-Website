import { BUTTON_PRIMARY_SM } from "@/components/ui/button";
import type { Metadata } from "next";
import Link from "next/link";

import { requireOfficer } from "@/lib/auth";
import { fetchFieldDefinitions } from "@/lib/member-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FieldDefinition } from "@/lib/members";
import { Notice } from "@/app/admin/(shell)/_components/notice";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";

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
      <PageHeader
        back={{ href: "/admin/members", label: "Back to the directory" }}
        title="Custom fields"
        action={
          <Link href="/admin/members/fields/new" className={BUTTON_PRIMARY_SM}>
            New field
          </Link>
        }
      />

      <p className="mt-6 max-w-2xl text-sm text-misa-secondary">
        Dropdowns officers can set on any member — t-shirt size, committee,
        major. Fields marked as directory columns appear in the roster table and
        can be sorted on; the rest live on each member&apos;s own page.
      </p>

      <section className="mt-10">
        <SectionHeading>Live</SectionHeading>
        <div className="mt-4">
          {live.length === 0 ? (
            <Notice>
              No custom fields yet. The directory shows its four built-in
              columns until you add one.
            </Notice>
          ) : (
            <FieldTable rows={live} />
          )}
        </div>
      </section>

      {archived.length > 0 && (
        <section className="mt-12">
          <SectionHeading>Archived</SectionHeading>
          <p className="mt-2 max-w-2xl text-sm text-misa-secondary">
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
    <Table minWidth="min-w-[48rem]">
      <THead>
        <Tr hover={false}>
          <Th>Label</Th>
          <Th>Key</Th>
          <Th>Options</Th>
          <Th>Where</Th>
          <Th numeric>Order</Th>
        </Tr>
      </THead>
      <tbody>
        {rows.map((row) => (
          <Tr key={row.id} className="align-top">
            <Td>
              <Link
                href={`/admin/members/fields/${row.id}`}
                className="text-misa-blue underline underline-offset-4 hover:text-misa-blue-dark"
              >
                {row.label}
              </Link>
            </Td>
            {/* A field key is an identifier — it is typed into a preset query
                and read back out of an export header. */}
            <Td className="font-mono text-xs">{row.key}</Td>
            <Td>{row.options.join(", ")}</Td>
            <Td>
              {row.showInDirectory ? (
                <>
                  Directory column
                  {row.editableInline ? ", editable inline" : ", read-only"}
                </>
              ) : (
                "Member page only"
              )}
            </Td>
            <Td numeric>{row.sortOrder}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

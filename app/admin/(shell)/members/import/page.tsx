import type { Metadata } from "next";
import Link from "next/link";

import { requireOfficer } from "@/lib/auth";
import { fetchFieldDefinitions } from "@/lib/member-fields";
import { importColumns, MAX_ROSTER_IMPORT_ROWS } from "@/lib/member-import";
import { createAdminClient } from "@/lib/supabase/admin";

import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { RosterImportForm } from "./_components/roster-import-form";

// Roster CSV import (§7 Stage 6 phase 7b).
//
// A Server Action, not a Route Handler: an action takes the file's text in
// FormData, and this codebase's Route Handler rule is about *downloads* needing
// Content-Disposition, which is the opposite direction. Same shape as
// /admin/dues/import.
//
// 🔓 Nothing about the upload is stored server-side. The client reads the file
// with FileReader and holds the text in memory across the two steps — a roster
// file is every member's name, email and EID, and there is no reason a copy of
// it should exist anywhere but in the officer's browser and, parsed, in
// `members`.

export const metadata: Metadata = { title: "Import members" };

export default async function MemberImportPage() {
  await requireOfficer();

  // The column list is the export catalogue's importable subset, so it is
  // rendered from the same source the matcher uses — a screen listing a column
  // the parser does not accept is worse than no list at all.
  const db = createAdminClient();
  const definitions = await fetchFieldDefinitions(db);
  const columns = importColumns(definitions);

  const required = columns.filter((column) => column.required);
  const optional = columns.filter((column) => !column.required);

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/members", label: "Back to the directory" }}
        title="Import members"
        description={
          <>
            Upload a CSV. Nothing is saved until you confirm, and{" "}
            <span className="font-medium">
              people already on the roster are never changed
            </span>{" "}
            — those rows are listed and skipped, so re-importing the same file
            adds nothing.
          </>
        }
      />

      <div className="mt-8 border border-misa-border bg-misa-panel px-4 py-4">
        <SectionHeading level="sub">Columns</SectionHeading>
        <p className="mt-2 text-sm text-misa-secondary">
          Columns are matched <span className="font-medium">by header name</span>
          , so the order does not matter and extra columns are ignored. A file
          downloaded from{" "}
          <Link href="/admin/members" className="underline">
            Download CSV
          </Link>{" "}
          can be edited and imported straight back.
        </p>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-misa-muted">
              Required
            </dt>
            <dd className="font-medium">
              {required.map((column) => column.label).join(", ")}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-misa-muted">
              Optional
            </dt>
            <dd>
              {optional.length > 0
                ? optional.map((column) => column.label).join(", ")
                : "—"}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-misa-muted">
          Up to {MAX_ROSTER_IMPORT_ROWS.toLocaleString()} rows per import.
          Calculated columns — points, attendance, dues — are ignored: they come
          from what members do, not from a spreadsheet.
        </p>
      </div>

      <div className="mt-8">
        <RosterImportForm />
      </div>
    </div>
  );
}

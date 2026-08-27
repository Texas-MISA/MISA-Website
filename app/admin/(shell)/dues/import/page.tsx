import type { Metadata } from "next";

import { requireOfficer } from "@/lib/auth";
import { MAX_IMPORT_ROWS } from "@/lib/dues";

import { PageHeader } from "@/components/ui/page-header";
import { ImportForm } from "./_components/import-form";

// Venmo statement import (§7 Stage 6.5 phase 2).
//
// A Server Action, not a Route Handler: a Server Action takes the file's text in
// FormData, and this codebase's Route Handler rule is about *downloads* needing
// Content-Disposition, which is the opposite direction.
//
// 🔓 Nothing about the upload is stored server-side. The client reads the file
// with FileReader and holds the text in memory across the two steps — a monthly
// statement is every dues transaction the org received, and there is no reason
// for a copy of it to exist anywhere but in the officer's browser and, parsed,
// in dues_payments.

export const metadata: Metadata = { title: "Import payments" };

export default async function DuesImportPage() {
  await requireOfficer();

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/dues", label: "Back to the ledger" }}
        title="Import payments"
        description={
          <>
            Upload a Venmo statement CSV. Nothing is saved until you confirm,
            and{" "}
            <span className="font-medium">
              importing the same statement twice is safe
            </span>{" "}
            — payments already recorded are skipped, so overlapping months are
            fine.
          </>
        }
      />

      <div className="mt-8">
        <ImportForm maxRows={MAX_IMPORT_ROWS} />
      </div>
    </div>
  );
}

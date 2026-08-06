"use server";

import { revalidatePath } from "next/cache";

import { writeAuditBatch } from "@/app/actions/audit";
import { getOfficer } from "@/lib/auth";
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  isSummerTerm,
  parseVenmoStatement,
  planPayment,
  type DuesPrices,
  type PlannedPayment,
} from "@/lib/dues";
import { fetchDuesRoster } from "@/lib/dues-roster";
import { createAdminClient } from "@/lib/supabase/admin";

// Dues import (§7 Stage 6.5 phase 2). Two actions over one CSV: previewImport
// writes nothing, commitImport re-parses and writes.
//
// ⚠️ **No role check anywhere in this file, and that is a decision rather than
// an omission** — the same one app/actions/members.ts records. §9 settled four
// adjacent questions on one premise: the audit log is the control, not a gate.
// Every imported payment writes an audit row naming the officer. Nothing in
// this codebase branches on admin_profiles.role and this is not the thing to
// make it start.
//
// 🔓 **The uploaded file is never persisted.** The client reads it with
// FileReader and holds the text in memory between the two steps; there is no
// staging table and no temp file, because a monthly statement is every dues
// transaction the org received in one blob. The only thing that reaches the
// database is the parsed rows.
//
// ⚠️ commitImport RE-PARSES the text rather than accepting the preview's
// output. Same posture as /attend's `step=confirm`: a preview is a courtesy to
// the officer, never an input to the decision. The browser could rewrite
// anything it was handed back.

const IMPORT_PATH = "/admin/dues/import";

/** One unbroken literal with `as const` — PostgREST types the returned row off
 * the string literal, and a concatenation widens it to plain `string`, which
 * collapses every field access at once. */
const AUDITED_PAYMENT_COLUMNS =
  "id, venmo_txn_id, member_id, paid_at, amount_cents, note, payer_name, payer_handle, submitted_eid, start_term, terms_covered, covered_terms, import_batch_id, voided_at, void_reason" as const;

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

/** What the officer is shown before committing, and what the commit reports. */
export type ImportCounts = {
  /** Rows that would be inserted. */
  fresh: number;
  /** Rows already stored under the same Venmo transaction id. */
  duplicate: number;
  /** Of `fresh`, how many need an officer: unmatched, ambiguous, or undecided. */
  queued: number;
  /** Statement rows that are not incoming payments at all. */
  skipped: number;
  /** 🪤 Of `fresh`, how many land in May–July — see the note on isSummerTerm. */
  summer: number;
};

export type PreviewRow = {
  venmoTxnId: string;
  paidAtLabel: string;
  amountCents: number;
  note: string | null;
  payerName: string | null;
  /** null once matched; otherwise why an officer has to look at it. */
  review: PlannedPayment["review"];
  termsCovered: 1 | 2 | null;
  duplicate: boolean;
  summer: boolean;
};

export type PreviewState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  | { status: "empty"; message: string }
  | { status: "too_large"; message: string }
  | {
      status: "ready";
      counts: ImportCounts;
      rows: PreviewRow[];
      fileName: string;
    };

export type CommitState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  | { status: "empty"; message: string }
  | { status: "too_large"; message: string }
  | { status: "done"; counts: ImportCounts; batchId: string };

// ---------------------------------------------------------------------------

async function readPrices(
  db: ReturnType<typeof createAdminClient>
): Promise<DuesPrices | null> {
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

/**
 * Parse, match and bucket — the work both actions share.
 *
 * Returns the planned rows rather than writing them, so `commitImport` runs the
 * identical code path the preview did and cannot diverge from what the officer
 * was shown. The only thing the commit adds is the insert.
 */
async function planImport(
  db: ReturnType<typeof createAdminClient>,
  csv: string
): Promise<
  | { kind: "error" }
  | { kind: "empty" }
  | { kind: "too_large"; rows: number }
  | { kind: "ok"; planned: PlannedPayment[]; skipped: number; existing: Set<string> }
> {
  const prices = await readPrices(db);
  if (!prices) return { kind: "error" };

  const roster = await fetchDuesRoster(db);
  // ⚠️ A failed roster read must NOT fall through as an empty roster. Matching
  // against nothing would mark an entire statement unmatched and look like a
  // legitimate outcome — the same reason resolveCheckin distinguishes "missing"
  // from "error" (§4.2).
  if (roster.kind === "error") return { kind: "error" };

  const parsed = parseVenmoStatement(csv);
  const skipped = parsed.skipped.reduce((sum, s) => sum + s.count, 0);

  if (parsed.payments.length === 0) return { kind: "empty" };

  // Refuses; never truncates. Importing the first N of a statement would be a
  // partial write reported as success, which is the failure this whole screen
  // exists to prevent.
  if (parsed.payments.length > MAX_IMPORT_ROWS) {
    return { kind: "too_large", rows: parsed.payments.length };
  }

  const planned = parsed.payments.map((payment) =>
    planPayment(payment, roster.roster, prices)
  );

  // Which transaction ids the database already holds. This drives the preview's
  // duplicate count only — the WRITE relies on the unique index, not on this,
  // because another import could land between the two steps.
  const { data: seen, error } = await db
    .from("dues_payments")
    .select("venmo_txn_id")
    .in(
      "venmo_txn_id",
      planned.map((p) => p.venmoTxnId)
    );

  if (error) {
    console.error("duplicate probe failed:", error.message);
    return { kind: "error" };
  }

  return {
    kind: "ok",
    planned,
    skipped,
    existing: new Set(seen.map((row) => row.venmo_txn_id)),
  };
}

function countOf(
  planned: PlannedPayment[],
  existing: Set<string>,
  skipped: number
): ImportCounts {
  const fresh = planned.filter((p) => !existing.has(p.venmoTxnId));
  return {
    fresh: fresh.length,
    duplicate: planned.length - fresh.length,
    queued: fresh.filter((p) => p.review !== null).length,
    skipped,
    summer: fresh.filter((p) => isSummerTerm(p.paidAt)).length,
  };
}

function readCsv(formData: FormData): string {
  const value = formData.get("csv");
  return typeof value === "string" ? value : "";
}

// ---------------------------------------------------------------------------
// previewImport — writes nothing
// ---------------------------------------------------------------------------

export async function previewImport(
  _prev: PreviewState,
  formData: FormData
): Promise<PreviewState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const csv = readCsv(formData);
  const fileName = String(formData.get("fileName") ?? "").slice(0, 200);

  if (csv.length === 0) {
    return { status: "empty", message: "That file was empty." };
  }
  // ⚠️ Below Next's own 1MB Server Action body cap on purpose, so the officer
  // gets this sentence instead of an opaque framework error. A real monthly
  // statement is a couple of kilobytes; this is a guard rail, not a limit
  // anyone should meet.
  if (csv.length > MAX_IMPORT_BYTES) {
    return {
      status: "too_large",
      message: `That file is ${Math.round(csv.length / 1024)} KB; the limit is ${Math.round(MAX_IMPORT_BYTES / 1024)} KB. Split the statement and import it in parts.`,
    };
  }

  try {
    const db = createAdminClient();
    const plan = await planImport(db, csv);

    if (plan.kind === "error") return { status: "error" };
    if (plan.kind === "empty") {
      return {
        status: "empty",
        message:
          "No incoming payments found. Check this is a Venmo statement export rather than a different report.",
      };
    }
    if (plan.kind === "too_large") {
      return {
        status: "too_large",
        message: `That statement holds ${plan.rows} payments; the limit is ${MAX_IMPORT_ROWS} per import.`,
      };
    }

    const rows: PreviewRow[] = plan.planned.map((payment) => ({
      venmoTxnId: payment.venmoTxnId,
      // Formatted on the server. Intl inside a Client Component runs on both
      // sides of hydration and Node and Chrome ship different ICU data.
      paidAtLabel: formatPaidAt(payment.paidAt),
      amountCents: payment.amountCents,
      note: payment.note,
      payerName: payment.payerName,
      review: payment.review,
      termsCovered: payment.termsCovered,
      duplicate: plan.existing.has(payment.venmoTxnId),
      summer: isSummerTerm(payment.paidAt),
    }));

    return {
      status: "ready",
      counts: countOf(plan.planned, plan.existing, plan.skipped),
      rows,
      fileName,
    };
  } catch (e) {
    console.error(
      "previewImport failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

// ---------------------------------------------------------------------------
// commitImport — re-parses, then writes
// ---------------------------------------------------------------------------

export async function commitImport(
  _prev: CommitState,
  formData: FormData
): Promise<CommitState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const csv = readCsv(formData);
  const fileName = String(formData.get("fileName") ?? "").slice(0, 200);

  if (csv.length === 0) {
    return { status: "empty", message: "That file was empty." };
  }
  if (csv.length > MAX_IMPORT_BYTES) {
    return { status: "too_large", message: "That file is too large to import." };
  }

  try {
    const db = createAdminClient();

    // Re-parsed from the text, not taken from the preview. If the roster or the
    // prices changed since the preview, the newer answer wins — which is right,
    // and is the reason this is not a cheap "apply what you were shown".
    const plan = await planImport(db, csv);

    if (plan.kind === "error") return { status: "error" };
    if (plan.kind === "empty") {
      return { status: "empty", message: "No incoming payments found." };
    }
    if (plan.kind === "too_large") {
      return {
        status: "too_large",
        message: `That statement holds ${plan.rows} payments; the limit is ${MAX_IMPORT_ROWS} per import.`,
      };
    }

    const batchId = crypto.randomUUID();

    // 🔓 upsert + ignoreDuplicates, which is the first use of upsert in
    // application code here, and the justification is the whole design: officers
    // upload overlapping statements ON PURPOSE, so "re-importing is a no-op"
    // has to be a DATABASE guarantee rather than an app-level pre-check that a
    // concurrent import could race past. The unique index spans voided rows, so
    // a statement whose payment an officer already voided stays skipped instead
    // of being resurrected.
    //
    // The .select() then returns only the rows actually inserted, so
    // requested − returned is the duplicate count, with no second query and no
    // window for it to disagree with what was written.
    const { data: created, error } = await db
      .from("dues_payments")
      .upsert(
        plan.planned.map((payment) => ({
          venmo_txn_id: payment.venmoTxnId,
          member_id: payment.memberId,
          paid_at: payment.paidAt.toISOString(),
          amount_cents: payment.amountCents,
          note: payment.note,
          payer_name: payment.payerName,
          payer_handle: payment.payerHandle,
          submitted_eid: payment.submittedEid,
          terms_covered: payment.termsCovered,
          import_batch_id: batchId,
          imported_by: officer.userId,
          // No start_term key, deliberately: it defaults to term_of(now()) in
          // SQL and a term string typed in application code is a bug (§4.7).
          // Read back in the .select() below instead.
        })),
        { onConflict: "venmo_txn_id", ignoreDuplicates: true }
      )
      .select(AUDITED_PAYMENT_COLUMNS);

    if (error) {
      console.error("commitImport failed:", error.message);
      return { status: "error" };
    }

    const counts: ImportCounts = {
      ...countOf(plan.planned, plan.existing, plan.skipped),
      // The authoritative numbers come from what the database actually took,
      // not from the pre-flight probe.
      fresh: created.length,
      duplicate: plan.planned.length - created.length,
    };

    // One row per payment — the entity is the payment, the same reason
    // points.granted writes one per adjustment. Batch context travels in the
    // note, and import_batch_id on the row itself answers "which upload was
    // this" without a second audit row.
    await writeAuditBatch(
      db,
      created.map((row) => ({
        entityType: "dues_payment" as const,
        entityId: row.id,
        actorId: officer.userId,
        action: "dues.imported" as const,
        after: row,
        note: summarizeImport(fileName, created.length, plan.planned.length),
      }))
    );

    revalidatePath(IMPORT_PATH);
    return { status: "done", counts, batchId };
  } catch (e) {
    console.error(
      "commitImport failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

/** `imported from "july.csv" — 12 of 14 new`. */
function summarizeImport(
  fileName: string,
  created: number,
  total: number
): string {
  const source = fileName ? ` from "${fileName}"` : "";
  return `imported${source} — ${created} of ${total} new`;
}

/** Server-side date formatting, per the hydration rule. */
function formatPaidAt(at: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(at);
}

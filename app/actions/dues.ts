"use server";

import { revalidatePath } from "next/cache";

import { writeAudit, writeAuditBatch } from "@/app/actions/audit";
import { getOfficer } from "@/lib/auth";
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  isSummerTerm,
  parseVenmoStatement,
  planPayment,
  startTermOptions,
  termOf,
  type DuesPrices,
  type PlannedPayment,
} from "@/lib/dues";
import { fetchDuesRoster } from "@/lib/dues-roster";
import { createAdminClient } from "@/lib/supabase/admin";
import { duesPaymentSaveSchema, duesVoidSchema } from "@/lib/validation";

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
const LEDGER = "/admin/dues";
/** The directory reads member_directory, whose dues_paid_current_term moves on
 * every assign, term change and void. Phase 4 renders that column; revalidating
 * it now costs nothing and means the column is correct the day it appears. */
const DIRECTORY = "/admin/members";

/** One unbroken literal with `as const` — PostgREST types the returned row off
 * the string literal, and a concatenation widens it to plain `string`, which
 * collapses every field access at once. */
const AUDITED_PAYMENT_COLUMNS =
  "id, venmo_txn_id, member_id, paid_at, amount_cents, note, payer_name, payer_handle, submitted_eid, start_term, terms_covered, covered_terms, import_batch_id, imported_by, voided_at, voided_by, void_reason" as const;

/**
 * The same columns plus `updated_at`, as its own unbroken literal rather than a
 * concatenation — see the note above for why that is a build break and not a
 * style preference.
 *
 * ⚠️ `updated_at` is read back so the client can adopt the fresh compare-and-set
 * token, and it is stripped from **both** sides before the audit write. Both
 * halves matter. Keeping it would print `updated_at: t1 → t2` on every single
 * save, and stripping it from only one side would make AuditTrail render it as
 * `→ —` and report a change that never happened — the AUDITED_ADJUSTMENT_COLUMNS
 * lesson, where a narrower select on the update made voiding look like it had
 * erased the reason.
 */
const PAYMENT_SAVE_COLUMNS =
  "id, venmo_txn_id, member_id, paid_at, amount_cents, note, payer_name, payer_handle, submitted_eid, start_term, terms_covered, covered_terms, import_batch_id, imported_by, voided_at, voided_by, void_reason, updated_at" as const;

/** Drop the CAS token before the row becomes an audit before/after. */
function auditable<T extends { updated_at: string }>(
  row: T
): Omit<T, "updated_at"> {
  const rest: Record<string, unknown> = { ...row };
  delete rest.updated_at;
  return rest as Omit<T, "updated_at">;
}

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
          // ⚠️ Set EXPLICITLY, and it has to be. The column defaults to
          // `term_of(now())` — the import time — because a Postgres column
          // default cannot reference another column, so the default can never
          // ask "what term was this payment made in". Those differ for every
          // statement uploaded after a term boundary, which is the ordinary
          // case: import July's statement in August and the default files a
          // Spring payment under Fall.
          //
          // Not a term string typed in application code (§4.7) — it is derived
          // from paid_at by termOf(), the mirror of the SQL function.
          start_term: termOf(payment.paidAt),
          import_batch_id: batchId,
          imported_by: officer.userId,
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

// ---------------------------------------------------------------------------
// The corrections (§7 Stage 6.5 phase 3)
// ---------------------------------------------------------------------------
//
// 📌 TWO actions, where docs/dues-and-membership.md names three
// (assignPayment / setPaymentTerms / voidPayment). Recorded there as a
// correction, alongside phase 2's two.
//
// Reassigning a payment and correcting what it bought are one officer intent
// over one row, and — decisively — one row owns ONE `updated_at`. Two separate
// actions means two forms on the same page each holding its own copy of that
// token, so the first save moves it and strands the second on a stale one: the
// officer's next edit reports a phantom conflict, and their third, until a
// revalidation lands. That is the defect directory-row.tsx exists to avoid, and
// building it deliberately would be a strange way to honour the lesson.
//
// So savePayment is shaped like saveSubmission — one save per officer intent —
// and only the audit verb branches. voidPayment stays separate because voiding
// is one-way and not an edit.

/** Echoed back so React 19's post-action form reset doesn't discard what the
 * officer was in the middle of correcting. */
export type SubmittedPaymentValues = {
  memberId: string;
  startTerm: string;
  termsCovered: string;
};

type PaymentField = "memberId" | "startTerm" | "termsCovered";

export type PaymentSaveState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  | {
      status: "invalid";
      fieldErrors: Partial<Record<PaymentField, string[]>>;
      values: SubmittedPaymentValues;
    }
  /** The payment was deleted between the render and the save. */
  | { status: "not_found" }
  /** Someone else edited or voided this row first — the CAS caught it. */
  | { status: "conflict"; values: SubmittedPaymentValues }
  /** It was voided while the form was open; a voided payment is settled. */
  | { status: "voided" }
  /** The picked member was deleted between the render and the save. */
  | { status: "stale_member"; values: SubmittedPaymentValues }
  /** Carries the fresh CAS token, which the client adopts for its next save. */
  | { status: "done"; updatedAt: string };

const PAYMENT_ECHO_LIMITS = {
  memberId: 40,
  startTerm: 40,
  termsCovered: 4,
  voidReason: 500,
} as const;

/**
 * Correct who a payment credits and what it bought.
 *
 * The parser attributes payments from member-supplied free text, so getting one
 * wrong is an ordinary outcome rather than an exception — which is why a payment
 * is editable at all, unlike a point adjustment. What it is *not* is deletable:
 * money arriving is a fact, and the way to undo one is a void with a reason.
 */
export async function savePayment(
  _prev: PaymentSaveState,
  formData: FormData
): Promise<PaymentSaveState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const values: SubmittedPaymentValues = {
    memberId: echoField(formData.get("memberId"), PAYMENT_ECHO_LIMITS.memberId),
    startTerm: echoField(formData.get("startTerm"), PAYMENT_ECHO_LIMITS.startTerm),
    termsCovered: echoField(
      formData.get("termsCovered"),
      PAYMENT_ECHO_LIMITS.termsCovered
    ),
  };

  const parsed = duesPaymentSaveSchema.safeParse({
    id: formData.get("id"),
    ...values,
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
  });
  if (!parsed.success) {
    return {
      status: "invalid",
      fieldErrors: fieldErrorsOf<PaymentField>(parsed.error, "startTerm"),
      values,
    };
  }
  const fields = parsed.data;

  try {
    const db = createAdminClient();

    const { data: before, error: beforeError } = await db
      .from("dues_payments")
      .select(PAYMENT_SAVE_COLUMNS)
      .eq("id", fields.id)
      .maybeSingle();

    if (beforeError) {
      console.error("savePayment read failed:", beforeError.message);
      return { status: "error" };
    }
    if (!before) return { status: "not_found" };
    if (before.voided_at !== null) return { status: "voided" };

    // The other half of the startTerm check, and the half that needs paid_at.
    // The schema proved the string is a well-formed term; this proves it is one
    // of the terms the editor actually offered for THIS payment. Without it the
    // form is a way to write an arbitrary term into the column, which is §4.7's
    // rule arriving through a POST rather than through source code. The stored
    // value is passed as `include` so a row already holding something outside
    // the window can be saved without being silently changed.
    const allowed = startTermOptions(new Date(before.paid_at), before.start_term);
    if (!allowed.includes(fields.startTerm)) {
      return {
        status: "invalid",
        fieldErrors: { startTerm: ["Pick one of the terms offered"] },
        values,
      };
    }

    const { data: after, error } = await db
      .from("dues_payments")
      .update({
        member_id: fields.memberId,
        start_term: fields.startTerm,
        terms_covered: fields.termsCovered,
        // covered_terms is NOT written: it is generated from start_term and
        // terms_covered, which is what makes an undecided row cover nothing
        // without anything application-side maintaining it.
      })
      .eq("id", fields.id)
      // Carried as the raw PostgREST string — it has microsecond precision, and
      // a JS Date round trip truncates to milliseconds so the CAS would never
      // match. No separate `.is("voided_at", null)` guard: the update trigger
      // moves updated_at, so a concurrent void already lands here as a conflict.
      .eq("updated_at", fields.expectedUpdatedAt)
      .select(PAYMENT_SAVE_COLUMNS)
      .maybeSingle();

    if (error) {
      // The FK is `on delete restrict`, so a member holding payments cannot be
      // deleted at all — but the check belongs at the write either way, and a
      // member with no payments yet can be. Same shape as grantPoints.
      if (error.code === "23503") return { status: "stale_member", values };
      console.error("savePayment failed:", error.message);
      return { status: "error" };
    }
    if (!after) return { status: "conflict", values };

    await writeAudit(db, {
      entityType: "dues_payment",
      entityId: fields.id,
      actorId: officer.userId,
      // Two verbs for one write, chosen by what actually moved. "Who does this
      // payment credit" is the question the review queue exists to answer, so
      // an answer changing is worth its own verb in the log; everything else is
      // an update, and before/after already says which columns moved.
      action:
        before.member_id !== after.member_id ? "dues.assigned" : "dues.updated",
      before: auditable(before),
      after: auditable(after),
    });

    revalidatePayment(fields.id);
    return { status: "done", updatedAt: after.updated_at };
  } catch (e) {
    console.error(
      "savePayment failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

export type PaymentVoidState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  | {
      status: "invalid";
      fieldErrors: Partial<Record<"voidReason", string[]>>;
      value: string;
    }
  /** Someone else voided it between the render and the save. */
  | { status: "already_voided" }
  | { status: "done" };

/**
 * Void a payment, with a reason.
 *
 * Not a delete: the row stays in the ledger, struck through, because money
 * arriving is a fact and a receipt exists for it somewhere. A refund is recorded
 * this way rather than as a negative payment — `amount_cents` is positive-only.
 *
 * ⚠️ It takes effect retroactively and will surprise someone: dues status is a
 * live derivation from `covered_terms`, not a stored flag, so voiding makes a
 * member unofficial the instant it lands. That is correct, and it is exactly why
 * the reason is required and an audit row is written.
 *
 * No compare-and-set token, matching voidAdjustment and diverging from
 * savePayment above: voiding is one-way, so `.is("voided_at", null)` is a
 * complete guard rather than an approximation — the only thing another officer
 * could have done to make this fail is the very thing being attempted, and zero
 * rows back says they got there first.
 */
export async function voidPayment(
  _prev: PaymentVoidState,
  formData: FormData
): Promise<PaymentVoidState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const value = echoField(
    formData.get("voidReason"),
    PAYMENT_ECHO_LIMITS.voidReason
  );

  const parsed = duesVoidSchema.safeParse({
    id: formData.get("id"),
    voidReason: value,
  });
  if (!parsed.success) {
    return {
      status: "invalid",
      fieldErrors: fieldErrorsOf<"voidReason">(parsed.error, "voidReason"),
      value,
    };
  }
  const fields = parsed.data;

  try {
    const db = createAdminClient();

    const { data: before, error: beforeError } = await db
      .from("dues_payments")
      .select(PAYMENT_SAVE_COLUMNS)
      .eq("id", fields.id)
      .maybeSingle();

    if (beforeError || !before) {
      console.error(
        "voidPayment failed:",
        beforeError?.message ?? "payment not found"
      );
      return { status: "error" };
    }

    // All three void columns move in one statement, so dues_void_is_complete
    // and dues_void_requires_reason can never observe a half-voided row.
    const { data: after, error } = await db
      .from("dues_payments")
      .update({
        voided_at: new Date().toISOString(),
        voided_by: officer.userId,
        void_reason: fields.voidReason,
      })
      .eq("id", fields.id)
      .is("voided_at", null)
      .select(PAYMENT_SAVE_COLUMNS)
      .maybeSingle();

    if (error) {
      console.error("voidPayment failed:", error.message);
      return { status: "error" };
    }
    if (!after) return { status: "already_voided" };

    await writeAudit(db, {
      entityType: "dues_payment",
      entityId: fields.id,
      actorId: officer.userId,
      action: "dues.voided",
      before: auditable(before),
      after: auditable(after),
    });

    revalidatePayment(fields.id);
    return { status: "done" };
  } catch (e) {
    console.error(
      "voidPayment failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

// ---------------------------------------------------------------------------

function echoField(value: FormDataEntryValue | null, max: number): string {
  // FormData.get can return a File; anything not a string echoes as empty.
  return typeof value === "string" ? value.slice(0, max) : "";
}

function fieldErrorsOf<K extends string>(
  error: { issues: { path: PropertyKey[]; message: string }[] },
  fallback: K
): Partial<Record<K, string[]>> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? fallback);
    (fieldErrors[field] ??= []).push(issue.message);
  }
  return fieldErrors as Partial<Record<K, string[]>>;
}

function revalidatePayment(id: string) {
  revalidatePath(LEDGER);
  revalidatePath(`${LEDGER}/${id}`);
  revalidatePath(DIRECTORY);
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

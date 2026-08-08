"use server";

import { revalidatePath } from "next/cache";

import { writeAuditBatch } from "@/app/actions/audit";
import { getOfficer } from "@/lib/auth";
import { fetchFieldDefinitions } from "@/lib/member-fields";
import {
  MAX_ROSTER_IMPORT_BYTES,
  MAX_ROSTER_IMPORT_ROWS,
  countOutcomes,
  describeOutcome,
  planRosterImport,
  type ImportCounts,
  type PlannedMember,
} from "@/lib/member-import";
import { AUDITED_MEMBER_COLUMNS, withoutToken } from "@/lib/members";
import { fetchRosterIndex } from "@/lib/roster-index";
import { createAdminClient } from "@/lib/supabase/admin";

// Roster CSV import (§7 Stage 6 phase 7b). Two actions over one file:
// previewRosterImport writes nothing, commitRosterImport re-parses and writes.
//
// Its own module rather than an addition to app/actions/members.ts, matching how
// the dues import got app/actions/dues.ts: that file is about single-value edits
// with compare-and-set tokens, and this is a bulk create with none.
//
// ⚠️ **No role check anywhere in this file, and that is a decision** — the same
// one app/actions/members.ts and app/actions/dues.ts record. §9 #6: the audit
// log is the control, not a gate. Every created member writes an audit row
// naming the officer. Nothing in this codebase branches on
// admin_profiles.role and this is not the thing to make it start.
//
// 🔓 **The uploaded file is never persisted.** The client reads it with
// FileReader and holds the text in memory between the two steps; there is no
// staging table and no temp file. A roster file is every member's name, email
// and EID in one blob.
//
// ⚠️ commitRosterImport RE-PARSES the text rather than accepting the preview's
// output. Same posture as /attend's `step=confirm` and the dues import: a
// preview is a courtesy to the officer, never an input to the decision.

const IMPORT_PATH = "/admin/members/import";
const DIRECTORY = "/admin/members";

export type PreviewRow = {
  line: number;
  eid: string;
  fullName: string;
  email: string;
  active: boolean;
  /** Already rendered — describeOutcome lives in the pure core so the preview
   * and any future caller cannot describe the same outcome differently. */
  outcome: string;
  /** Drives the row styling: only a `new` row is actually going to be written. */
  willImport: boolean;
};

export type PreviewState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  | { status: "empty"; message: string }
  | { status: "too_large"; message: string }
  | { status: "no_header"; message: string }
  | {
      status: "ready";
      counts: ImportCounts;
      rows: PreviewRow[];
      ignoredColumns: string[];
      fileName: string;
    };

export type CommitState =
  | { status: "idle" }
  | { status: "unauthorized" }
  | { status: "error" }
  | { status: "empty"; message: string }
  | { status: "too_large"; message: string }
  | { status: "no_header"; message: string }
  /** A 23505 on one of the two unique indexes: somebody else added one of these
   * people between the preview and the commit. Nothing was written. */
  | { status: "raced" }
  | { status: "done"; counts: ImportCounts };

function readCsv(formData: FormData): string {
  const value = formData.get("csv");
  return typeof value === "string" ? value : "";
}

function readFileName(formData: FormData): string {
  return String(formData.get("fileName") ?? "").slice(0, 200);
}

/** The guard both actions apply before touching the database. */
function checkSize(csv: string): { message: string } | null {
  if (csv.length === 0) return { message: "That file was empty." };
  // ⚠️ Below Next's own 1MB Server Action body cap on purpose, so the officer
  // gets this sentence instead of an opaque framework error.
  if (csv.length > MAX_ROSTER_IMPORT_BYTES) {
    return {
      message: `That file is ${Math.round(csv.length / 1024)} KB; the limit is ${Math.round(
        MAX_ROSTER_IMPORT_BYTES / 1024
      )} KB. Split the roster and import it in parts.`,
    };
  }
  return null;
}

/**
 * Load what the plan needs and run it. Shared by both actions, so the commit
 * runs the identical code path the preview did.
 */
async function plan(db: ReturnType<typeof createAdminClient>, csv: string) {
  const definitions = await fetchFieldDefinitions(db);

  const roster = await fetchRosterIndex(db);
  // ⚠️ A failed roster read must NOT fall through as an empty roster. Every row
  // would then be classified `new`, the preview would promise to add the whole
  // file, and the insert would collide on the first person already on it —
  // reported as a race when it was a read failure. Same reason resolveCheckin
  // distinguishes "missing" from "error" (§4.2).
  if (roster.kind === "error") return null;

  return planRosterImport({ csv, definitions, roster: roster.roster });
}

// ---------------------------------------------------------------------------
// previewRosterImport — writes nothing
// ---------------------------------------------------------------------------

export async function previewRosterImport(
  _prev: PreviewState,
  formData: FormData
): Promise<PreviewState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const csv = readCsv(formData);
  const tooBig = checkSize(csv);
  if (tooBig) {
    return csv.length === 0
      ? { status: "empty", message: tooBig.message }
      : { status: "too_large", message: tooBig.message };
  }

  try {
    const db = createAdminClient();
    const result = await plan(db, csv);
    if (result === null) return { status: "error" };

    if (result.kind === "empty") {
      return {
        status: "empty",
        message:
          "No rows found. The file needs a header row and at least one member below it.",
      };
    }
    if (result.kind === "too_many") {
      return {
        status: "too_large",
        message: `That file holds ${result.rows} rows; the limit is ${MAX_ROSTER_IMPORT_ROWS} per import.`,
      };
    }
    if (result.kind === "no_header") {
      return {
        status: "no_header",
        message: `The file needs a column for ${result.missing.join(", ")}. Columns are matched by their header name, so check the spelling rather than the order.`,
      };
    }

    return {
      status: "ready",
      counts: result.counts,
      rows: result.rows.map(toPreviewRow),
      ignoredColumns: result.ignoredColumns,
      fileName: readFileName(formData),
    };
  } catch (e) {
    console.error(
      "previewRosterImport failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

function toPreviewRow(row: PlannedMember): PreviewRow {
  return {
    line: row.line,
    eid: row.eid,
    fullName: row.fullName,
    email: row.email,
    active: row.active,
    outcome: describeOutcome(row.outcome),
    willImport: row.outcome.kind === "new",
  };
}

// ---------------------------------------------------------------------------
// commitRosterImport — re-parses, then writes
// ---------------------------------------------------------------------------

export async function commitRosterImport(
  _prev: CommitState,
  formData: FormData
): Promise<CommitState> {
  const officer = await getOfficer();
  if (!officer) return { status: "unauthorized" };

  const csv = readCsv(formData);
  const fileName = readFileName(formData);
  const tooBig = checkSize(csv);
  if (tooBig) {
    return csv.length === 0
      ? { status: "empty", message: tooBig.message }
      : { status: "too_large", message: tooBig.message };
  }

  try {
    const db = createAdminClient();

    // Re-parsed from the text, not taken from the preview. If the roster or the
    // field definitions changed since, the newer answer wins — which is right,
    // and is the reason this is not a cheap "apply what you were shown".
    const result = await plan(db, csv);
    if (result === null) return { status: "error" };

    if (result.kind === "empty") {
      return { status: "empty", message: "No rows found." };
    }
    if (result.kind === "too_many") {
      return {
        status: "too_large",
        message: `That file holds ${result.rows} rows; the limit is ${MAX_ROSTER_IMPORT_ROWS} per import.`,
      };
    }
    if (result.kind === "no_header") {
      return {
        status: "no_header",
        message: `The file needs a column for ${result.missing.join(", ")}.`,
      };
    }

    const fresh = result.rows.filter((row) => row.outcome.kind === "new");
    if (fresh.length === 0) {
      return { status: "done", counts: result.counts };
    }

    // 🔓 ONE atomic insert, all-or-nothing — deliberately NOT the upsert the dues
    // import uses, and for two separate reasons:
    //
    //   * `members` has TWO unique indexes (normalized_eid and lower(email)) and
    //     PostgREST's onConflict takes one target, so an upsert cannot express
    //     "skip if either matches". The dues import has a single dedupe key and
    //     is DESIGNED for overlapping re-imports; a roster is not.
    //   * Partial success has no backstop here. `bulkAssignEvent` can report
    //     partial success because a skipped submission stays visibly in the
    //     queue; forty of fifty members imported and the officer told it worked
    //     leaves ten people missing and nobody looking. Same argument as
    //     grantPoints.
    //
    // All-or-nothing is safe precisely because the preview recomputes: a retry
    // reclassifies anything already written as `existing`, so nothing is
    // double-added and the officer loses no work.
    const { data: created, error } = await db
      .from("members")
      .insert(
        fresh.map((row) => ({
          eid: row.eid,
          full_name: row.fullName,
          email: row.email,
          active: row.active,
          custom_fields: row.customFields,
          // Not a new `source` value. Widening the CHECK would touch the
          // filter, the SELF badge, the export catalogue and the seed, and the
          // audit row below already answers "how did this row arrive" — which
          // is the only question a third value would have answered.
          source: "admin" as const,
        }))
      )
      .select(AUDITED_MEMBER_COLUMNS);

    if (error) {
      if (error.code === "23505") {
        // Somebody was added between the preview and here. Nothing was written —
        // the insert is one statement — so the officer previews again and the
        // now-existing person is reclassified rather than retried.
        return { status: "raced" };
      }
      console.error("commitRosterImport failed:", error.message);
      return { status: "error" };
    }

    // One row per MEMBER, not one receipt per import — the entity is the member,
    // the same reason dues.imported is one row per payment and points.granted is
    // one per adjustment. Batch context travels in the note.
    await writeAuditBatch(
      db,
      created.map((row) => ({
        entityType: "member" as const,
        entityId: row.id,
        actorId: officer.userId,
        action: "member.imported" as const,
        // withoutToken on the one side there is: `updated_at` is a concurrency
        // anchor, not a fact about the member, and an audit row opening with a
        // timestamp nobody set carries no information. There is no `before` to
        // keep symmetric — the member did not exist.
        after: withoutToken(row),
        note: summarize(fileName, created.length, result.rows.length),
      }))
    );

    revalidatePath(IMPORT_PATH);
    revalidatePath(DIRECTORY);

    return {
      status: "done",
      // The authoritative number is what the database actually took.
      counts: { ...countOutcomes(result.rows), fresh: created.length },
    };
  } catch (e) {
    console.error(
      "commitRosterImport failed:",
      e instanceof Error ? e.message : String(e)
    );
    return { status: "error" };
  }
}

/** `imported from "roster.csv" — 24 of 30 rows`. */
function summarize(fileName: string, created: number, total: number): string {
  const source = fileName ? ` from "${fileName}"` : "";
  return `imported${source} — ${created} of ${total} rows`;
}

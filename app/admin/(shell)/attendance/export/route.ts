import { writeAudit } from "@/app/actions/audit";
import { fetchOfficerNames } from "@/lib/admin-profiles";
import { getOfficer } from "@/lib/auth";
import { toCentralFields } from "@/lib/events";
import { MAX_EXPORT_ROWS, exportedFields, parseFieldSelection } from "@/lib/export";
import {
  ATTENDANCE_DEFAULT_FIELDS,
  ATTENDANCE_EXPORT_FIELDS,
  isLedgerExportFormat,
  projectAttendanceRow,
  type AttendanceExportRow,
} from "@/lib/export-ledgers";
import {
  applyAttendanceFilter,
  attendanceFilterToParams,
  parseAttendanceFilter,
} from "@/lib/ledger-filters";
import { createAdminClient } from "@/lib/supabase/admin";
import { toCsv, toTsv } from "@/lib/export";
import { toXlsx } from "@/lib/xlsx";

// The attendance archive (§7 Stage 8 phase 2). Every submission the check-in
// form has produced, in whatever the queue is currently filtered to — plus the
// resolution columns the queue does not display, because a file that outlives
// the officer needs to say who resolved a row and why.
//
// A Route Handler, and the reasons are the roster export's:
//
//   * A download needs Content-Disposition, and a Server Action cannot set
//     response headers.
//   * It opens with getOfficer() → 403, NEVER requireOfficer(). That redirects,
//     and a 302 is the wrong answer to fetching a spreadsheet — the browser
//     would cheerfully save the login page as misa-attendance-2026-08-10.csv.
//   * ⚠️ Route Handlers do NOT participate in layouts, so
//     app/admin/(shell)/layout.tsx and its requireOfficer() never run here.
//     Sitting inside the (shell) group is colocation with the screen this
//     serves and grants no protection. proxy.ts's /admin/:path* matcher does
//     cover the path, but that is a convenience — the 403 below is what catches
//     a signed-in user with no admin_profiles row, and what survives a change
//     to the matcher.
//
// No role check, deliberately, consistent with §9 #6 and with every other
// officer surface: any officer may read what any officer may read.

// 🪤 One unbroken literal with `as const`. PostgREST types the returned row off
// the string itself, so a concatenated column list widens to plain `string` and
// collapses every field access to GenericStringError. That has broken this
// build twice.
const EXPORT_COLUMNS =
  "id, submitted_name, submitted_eid, submitted_email, submitted_at, status, source, event_id, member_id, resolved_at, resolved_by, resolution_note, events(id, title), members(id, full_name)" as const;

// The hosted project applies its own PostgREST max_rows that local does not, so
// one unbounded request comes back complete in development and silently short
// in production. Page explicitly.
const CHUNK = 1000;

// A silently static export would serve one officer's file to the next.
export const dynamic = "force-dynamic";

function refuse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function GET(request: Request): Promise<Response> {
  const officer = await getOfficer();
  if (!officer) return refuse("Forbidden", 403);

  const params = new URL(request.url).searchParams;

  const format = params.get("format") ?? "csv";
  if (!isLedgerExportFormat(format)) {
    return refuse(`Unknown format: ${format}`, 400);
  }

  try {
    const db = createAdminClient();

    // The SAME parse and the SAME predicates the queue uses (lib/ledger-filters
    // .ts). That is the property this route exists to have: the file is
    // provably the rows the screen counted, not a second hand-written query
    // that drifts. What differs is only the row window below.
    const filter = parseAttendanceFilter(Object.fromEntries(params.entries()));

    const chosen = parseFieldSelection(
      params.getAll("fields"),
      ATTENDANCE_EXPORT_FIELDS,
      // ⚠️ Not the member defaults. parseFieldSelection falls back to these when
      // nothing was named, and the member list shares no key with this
      // catalogue — so the default would resolve to zero fields and emit a file
      // with no columns at all.
      ATTENDANCE_DEFAULT_FIELDS
    );

    // 🪤 `.order("id")` is a TIE-BREAK, not decoration, and leaving it off is a
    // silent data-loss bug rather than an untidy sort. This read is chunked, and
    // rows tied on `submitted_at` can come back arranged differently per
    // request — so a tie straddling a `.range()` boundary makes one row appear
    // twice and another never appear at all, which reads as missing data rather
    // than as an ordering fault. `submitted_at` is NOT unique: the seed alone
    // has four ties, and a room checking in together produces them by the
    // dozen. The directory queries all end this way for the same reason.
    const query = applyAttendanceFilter(
      db.from("attendance").select(EXPORT_COLUMNS, { count: "exact" }),
      filter
    )
      .order("submitted_at", { ascending: filter.sort === "oldest" })
      .order("id");

    const rows: AttendanceExportRow[] = [];
    let total = 0;

    for (let offset = 0; ; offset += CHUNK) {
      const { data, error, count } = await query.range(offset, offset + CHUNK - 1);
      if (error) {
        console.error("attendance export query failed:", error.message);
        return refuse("Export failed", 500);
      }

      if (offset === 0) {
        total = count ?? data.length;
        // Refuse, never truncate — the §2.2 cap rule. A file that quietly
        // stops at 5000 rows is the partial-list failure the whole export
        // design exists to prevent.
        if (total > MAX_EXPORT_ROWS) {
          return refuse(
            `That export would carry ${total} submissions; the limit is ${MAX_EXPORT_ROWS}. Narrow the filter and try again.`,
            400
          );
        }
      }

      rows.push(...(data as unknown as AttendanceExportRow[]));
      if (data.length < CHUNK || rows.length >= total) break;
    }

    // resolved_by references auth.users, which has no PostgREST path to
    // admin_profiles — so officer names are a second query, never an embed.
    const officers = await fetchOfficerNames(
      db,
      rows.map((row) => row.resolved_by).filter((id): id is string => id !== null)
    );

    const exported = exportedFields(format, chosen);
    const filterQuery = attendanceFilterToParams(filter).toString();

    // Written BEFORE the body is built, so a download the officer cancels still
    // leaves a receipt. entity_id is a fresh uuid nothing references: an export
    // spans N rows, and borrowing one submission's id would read as an action
    // taken against that submission.
    await writeAudit(db, {
      entityType: "archive",
      entityId: crypto.randomUUID(),
      actorId: officer.userId,
      action: "archive.exported",
      before: null,
      after: {
        entity: "attendance",
        format,
        // What actually left, not what was ticked (§6).
        fields: exported,
        rowCount: rows.length,
        filter: filterQuery,
      },
      note: `${format} archive of ${rows.length} attendance submission${
        rows.length === 1 ? "" : "s"
      } (${exported.length} field${exported.length === 1 ? "" : "s"})`,
    });

    const cells = rows.map((row) => projectAttendanceRow(row, chosen, officers));
    const today = toCentralFields(new Date()).date;
    const stem = `misa-attendance-${today}`;

    if (format === "tsv") {
      // Clipboard format: no Content-Disposition, or the browser downloads a
      // file the officer did not ask for. Still audited.
      return new Response(toTsv(chosen, cells), {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    if (format === "xlsx") {
      const book = toXlsx(chosen, cells, "Attendance");
      return new Response(new Uint8Array(book), {
        headers: {
          "content-type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": `attachment; filename="${stem}.xlsx"`,
          "cache-control": "no-store",
        },
      });
    }

    // A UTF-8 BOM, and not decoration: without it Excel on Windows decodes a
    // CSV as the system codepage and mangles every accented name.
    return new Response(`﻿${toCsv(chosen, cells)}`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${stem}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error(
      "attendance export failed:",
      e instanceof Error ? e.message : String(e)
    );
    return refuse("Export failed", 500);
  }
}

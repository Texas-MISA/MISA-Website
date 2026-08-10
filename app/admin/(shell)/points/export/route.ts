import { writeAudit } from "@/app/actions/audit";
import { fetchOfficerNames } from "@/lib/admin-profiles";
import { getOfficer } from "@/lib/auth";
import { toCentralFields } from "@/lib/events";
import {
  MAX_EXPORT_ROWS,
  exportedFields,
  parseFieldSelection,
  toCsv,
  toTsv,
} from "@/lib/export";
import {
  ADJUSTMENT_DEFAULT_FIELDS,
  ADJUSTMENT_EXPORT_FIELDS,
  isLedgerExportFormat,
  projectAdjustmentRow,
  type AdjustmentExportRow,
} from "@/lib/export-ledgers";
import {
  adjustmentFilterToParams,
  applyAdjustmentFilter,
  parseAdjustmentFilter,
} from "@/lib/ledger-filters";
import { createAdminClient } from "@/lib/supabase/admin";
import { toXlsx } from "@/lib/xlsx";

// The point-adjustment archive (§7 Stage 8 phase 2). Every grant and deduction
// in whatever the ledger is filtered to, plus the void columns the ledger shows
// only as a strikethrough — a void is a recorded action (§4.2) and an archive
// has to carry who did it and why.
//
// Same Route Handler reasoning as the attendance archive beside it: a download
// needs Content-Disposition, getOfficer() → 403 rather than requireOfficer()'s
// redirect, and ⚠️ Route Handlers do not participate in layouts, so the
// (shell) layout's requireOfficer() never runs here — the 403 below is the
// boundary, not the route's position in the tree.

// 🪤 One unbroken literal with `as const` — a concatenated column list widens to
// plain `string` and collapses the row type. This is the full non-generated
// column set, matching AUDITED_ADJUSTMENT_COLUMNS in lib/points.ts, plus the
// two embeds.
const EXPORT_COLUMNS =
  "id, member_id, points, reason, category, event_id, term, awarded_by, awarded_at, voided_at, voided_by, void_reason, members(id, full_name), events(id, title)" as const;

const CHUNK = 1000;

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

    // The SAME parse and predicates the ledger screen uses — see
    // lib/ledger-filters.ts. Only the row window differs.
    const filter = parseAdjustmentFilter(Object.fromEntries(params.entries()));

    const chosen = parseFieldSelection(
      params.getAll("fields"),
      ADJUSTMENT_EXPORT_FIELDS,
      // ⚠️ This catalogue's defaults, not the member ones — see the note in the
      // attendance route.
      ADJUSTMENT_DEFAULT_FIELDS
    );

    // 🪤 `.order("id")` is a TIE-BREAK on a chunked read, not decoration. Rows
    // tied on `awarded_at` can come back arranged differently per request, so a
    // tie straddling a `.range()` boundary duplicates one row and drops
    // another — and it reads as missing data, not as an ordering fault. A
    // multi-member grant writes every adjustment in one statement, so ties are
    // the NORMAL case here, not an edge one: the seed has four.
    const query = applyAdjustmentFilter(
      db.from("point_adjustments").select(EXPORT_COLUMNS, { count: "exact" }),
      filter
    )
      .order("awarded_at", { ascending: false })
      .order("id");

    const rows: AdjustmentExportRow[] = [];
    let total = 0;

    for (let offset = 0; ; offset += CHUNK) {
      const { data, error, count } = await query.range(offset, offset + CHUNK - 1);
      if (error) {
        console.error("adjustment export query failed:", error.message);
        return refuse("Export failed", 500);
      }

      if (offset === 0) {
        total = count ?? data.length;
        if (total > MAX_EXPORT_ROWS) {
          return refuse(
            `That export would carry ${total} adjustments; the limit is ${MAX_EXPORT_ROWS}. Narrow the filter and try again.`,
            400
          );
        }
      }

      rows.push(...(data as unknown as AdjustmentExportRow[]));
      if (data.length < CHUNK || rows.length >= total) break;
    }

    // Both awarded_by and voided_by reference auth.users, which has no
    // PostgREST path to admin_profiles — one lookup covering both.
    const officers = await fetchOfficerNames(db, [
      ...rows.map((row) => row.awarded_by),
      ...rows
        .map((row) => row.voided_by)
        .filter((id): id is string => id !== null),
    ]);

    const exported = exportedFields(format, chosen);
    const filterQuery = adjustmentFilterToParams(filter).toString();

    await writeAudit(db, {
      entityType: "archive",
      entityId: crypto.randomUUID(),
      actorId: officer.userId,
      action: "archive.exported",
      before: null,
      after: {
        entity: "adjustments",
        format,
        fields: exported,
        rowCount: rows.length,
        filter: filterQuery,
      },
      note: `${format} archive of ${rows.length} point adjustment${
        rows.length === 1 ? "" : "s"
      } (${exported.length} field${exported.length === 1 ? "" : "s"})`,
    });

    const cells = rows.map((row) => projectAdjustmentRow(row, chosen, officers));
    const today = toCentralFields(new Date()).date;
    const stem = `misa-adjustments-${today}`;

    if (format === "tsv") {
      return new Response(toTsv(chosen, cells), {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    if (format === "xlsx") {
      const book = toXlsx(chosen, cells, "Adjustments");
      return new Response(new Uint8Array(book), {
        headers: {
          "content-type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": `attachment; filename="${stem}.xlsx"`,
          "cache-control": "no-store",
        },
      });
    }

    return new Response(`﻿${toCsv(chosen, cells)}`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${stem}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error(
      "adjustment export failed:",
      e instanceof Error ? e.message : String(e)
    );
    return refuse("Export failed", 500);
  }
}

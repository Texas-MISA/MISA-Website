import { getOfficer } from "@/lib/auth";
import { writeAudit } from "@/app/actions/audit";
import {
  applyMemberFilter,
  isDefaultFilter,
  memberFilterToParams,
  parseMemberFilter,
} from "@/lib/filters";
import { fetchFieldDefinitions } from "@/lib/member-fields";
import { toCentralFields } from "@/lib/events";
import {
  exportCatalogue,
  exportedFields,
  isExportFormat,
  parseFieldSelection,
  projectRow,
  toCsv,
  toEmailList,
  toNameList,
  toTsv,
  MAX_EXPORT_ROWS,
  type ExportFormat,
  type ExportSourceRow,
} from "@/lib/export";
import { createAdminClient } from "@/lib/supabase/admin";
import { toXlsx } from "@/lib/xlsx";

// The roster export (§6, §7 Stage 6 phase 5) — the first Route Handler in this
// codebase, and it is a route rather than a Server Action for one reason: a
// download needs Content-Disposition, and a Server Action cannot set response
// headers at all.
//
// ⚠️ It opens with getOfficer() and returns 403, NEVER requireOfficer(). This is
// the mirror of the Server Action rule for a different reason: an action avoids
// requireOfficer() because the house try/catch would swallow its NEXT_REDIRECT,
// while a route avoids it because a 302 to the login page is the wrong answer to
// fetching a spreadsheet — the browser would cheerfully save the login HTML as
// members.csv.
//
// ⚠️ Route Handlers do NOT participate in layouts, so app/admin/(shell)/layout.tsx
// and its requireOfficer() do not run here. Sitting inside the (shell) group is
// colocation with the screen this serves, nothing more, and it grants no
// protection. proxy.ts's `/admin/:path*` matcher does cover this path, so an
// unauthenticated request is redirected to login before ever reaching the
// handler — but that is a convenience, not the boundary. The 403 below is what
// catches a signed-in user with no admin_profiles row, and what survives a
// matcher change. Both are required; neither substitutes for the other.
//
// ⚠️ No role check, deliberately — the reasoning is in lib/export.ts's header
// and it is a §9 consistency decision, not an oversight.

// getOfficer reads cookies, so this could never be prerendered anyway. Stated
// explicitly because a Route Handler's caching rules differ from a page's, and
// a silently static export would serve one officer's roster to the next.
export const dynamic = "force-dynamic";

// One unbroken literal with `as const`. PostgREST types the returned row off the
// string *literal*, so a concatenation widens it to plain `string` and collapses
// every field access at once — recorded on AUDITED_ADJUSTMENT_COLUMNS in
// lib/points.ts, and it has now cost a build twice.
//
// Wider than the directory's COLUMNS on purpose: this is every column the export
// catalogue can reach, so the picker is limited by the catalogue rather than by
// what happened to be selected here.
const EXPORT_COLUMNS =
  "id, eid, full_name, email, active, source, joined_at, notes, total_points, attendance_points, bonus_points, events_attended, events_possible, attendance_rate, pending_count, last_seen_at, custom_fields" as const;

/**
 * Rows per PostgREST request while paging through the result.
 *
 * 🪤 The export must page explicitly rather than ask for everything at once.
 * `config.toml` sets no `max_rows` locally, but the hosted project applies its
 * own — so a single unbounded request can come back complete in development and
 * silently short in production, which is the partial-list failure this whole
 * screen exists to prevent, wearing a different hat.
 */
const CHUNK = 1000;

/**
 * An id is interpolated into a PostgREST `in.(…)` list, so it is checked rather
 * than trusted — the same discipline FIELD_KEY_PATTERN applies to a sort key.
 * Anything that is not a uuid is dropped before the query is built.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refuse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function GET(request: Request): Promise<Response> {
  const officer = await getOfficer();
  if (!officer) return refuse("Forbidden", 403);

  const url = new URL(request.url);
  const params = url.searchParams;

  const format = params.get("format") ?? "csv";
  if (!isExportFormat(format)) return refuse(`Unknown format: ${format}`, 400);

  try {
    const db = createAdminClient();

    // Definitions first, exactly as the directory page does: parseMemberFilter
    // needs them to tell a live `cf:` sort key from one naming an archived
    // field, and the catalogue needs them for the custom columns.
    const fields = await fetchFieldDefinitions(db);

    const filter = parseMemberFilter(
      Object.fromEntries(params.entries()),
      fields
    );

    const catalogue = exportCatalogue(fields);
    const chosen = parseFieldSelection(params.getAll("fields"), catalogue);

    // "The 25 rows on this page" versus "all N matching this filter" are the two
    // selection modes, and conflating them is the classic bug this screen is
    // prone to (§7). Explicit ids narrow the SAME filtered query rather than
    // replacing it, so a stale checkbox cannot pull in a row the filter excludes.
    const ids = params.getAll("ids").filter((id) => UUID.test(id));
    const scoped = ids.length > 0;

    if (scoped && ids.length > MAX_EXPORT_ROWS) {
      return refuse(
        `Too many members selected (${ids.length}); the limit is ${MAX_EXPORT_ROWS}.`,
        400
      );
    }

    const base = applyMemberFilter(
      db.from("member_directory").select(EXPORT_COLUMNS, { count: "exact" }),
      filter,
      fields
    );

    // ⚠️ pageRange() is NOT called here, and that is the whole design. It is a
    // separate function the page applies precisely so the export can apply the
    // identical filter without it — which is what makes the file provably the
    // same query as the count rendered beside the button, rather than a second
    // query someone has to keep in step (§4.5).
    const query = scoped ? base.in("id", ids) : base;

    const rows: ExportSourceRow[] = [];
    let total = 0;

    for (let offset = 0; ; offset += CHUNK) {
      const { data, error, count } = await query.range(
        offset,
        offset + CHUNK - 1
      );

      if (error) {
        console.error("roster export query failed:", error.message);
        return refuse("Export failed", 500);
      }

      if (offset === 0) {
        total = count ?? data.length;
        // Refuses; never truncates. A trimmed export is a partial list that
        // looks complete — the same bug as a silent cap, and the officer keeps
        // their filter to narrow with.
        if (total > MAX_EXPORT_ROWS) {
          return refuse(
            `That export would carry ${total} members; the limit is ${MAX_EXPORT_ROWS}. Narrow the filter and try again.`,
            400
          );
        }
      }

      rows.push(...(data as ExportSourceRow[]));
      if (data.length < CHUNK || rows.length >= total) break;
    }

    const today = toCentralFields(new Date()).date;

    // What actually left the building, which is not always what was ticked —
    // the reasoning is on exportedFields() in lib/export.ts, where it is tested.
    const exported = exportedFields(format, chosen);

    // ⚠️ Written BEFORE the body is built, so a download the officer cancels
    // still leaves a receipt. §6 requires every export logged because this is
    // the largest PII egress point in the system.
    //
    // entity_id is a uuid nothing else references. Not nullable (that would
    // weaken the column for the four entity types that do name a real row) and
    // never a member's id (the row would read as an action taken against that
    // one person) — an export spans N members.
    await writeAudit(db, {
      entityType: "roster",
      entityId: crypto.randomUUID(),
      actorId: officer.userId,
      action: "roster.exported",
      before: null,
      after: {
        format,
        // Both halves, because since the field picker landed "what left the
        // building" is two questions and the filter alone answers only one.
        fields: exported,
        rowCount: rows.length,
        scope: scoped ? "selected" : "filter",
        filter: memberFilterToParams(filter).toString(),
        wholeRoster: !scoped && isDefaultFilter(filter),
      },
      note: `${format} export of ${rows.length} member${
        rows.length === 1 ? "" : "s"
      } (${exported.length} field${exported.length === 1 ? "" : "s"})`,
    });

    return respond(format, chosen, rows, today, sheetLabelOf(filter));
  } catch (e) {
    console.error(
      "roster export failed:",
      e instanceof Error ? e.message : String(e)
    );
    return refuse("Export failed", 500);
  }
}

/**
 * A human label for the workbook's sheet tab, so a saved file says what it is.
 * `sheetName()` in lib/xlsx.ts does the sanitizing — Excel forbids several
 * characters and caps the name at 31 — so this only has to be descriptive.
 */
function sheetLabelOf(filter: ReturnType<typeof parseMemberFilter>): string {
  const parts = ["Members"];
  if (filter.state !== "active") parts.push(filter.state);
  if (filter.q) parts.push(filter.q);
  return parts.join(" - ");
}

function respond(
  format: ExportFormat,
  chosen: ReturnType<typeof parseFieldSelection>,
  rows: ExportSourceRow[],
  today: string,
  sheetLabel: string
): Response {
  // The clipboard formats are read by fetch and pasted by the browser, so they
  // carry no Content-Disposition — an attachment header would download a file
  // the officer did not ask for. They are still audited: the same rows leave the
  // building either way, and §6 is about egress, not about file extensions.
  if (format === "emails") {
    return text(toEmailList(rows));
  }
  if (format === "names") {
    return text(toNameList(rows));
  }

  const cells = rows.map((row) => projectRow(row, chosen));

  if (format === "tsv") {
    return text(toTsv(chosen, cells));
  }

  if (format === "xlsx") {
    // The same cells CSV gets — only the formatting differs, which is the whole
    // design and the reason xlsx is not CSV with another extension. Buffered
    // whole, because a zip writes its central directory last and has no
    // incremental path worth having; MAX_EXPORT_ROWS is what keeps that inside
    // Vercel's 4.5 MB non-streaming response limit.
    const book = toXlsx(chosen, cells, sheetLabel);
    return new Response(new Uint8Array(book), {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="misa-members-${today}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  }

  // A UTF-8 BOM, and not decoration: without it Excel on Windows decodes a CSV
  // as the system codepage and mangles every accented name on the roster. The
  // BOM belongs to the response rather than to the pure writer, which returns a
  // string and has no opinion about bytes.
  const body = `﻿${toCsv(chosen, cells)}`;

  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="misa-members-${today}.csv"`,
      "cache-control": "no-store",
    },
  });
}

function text(body: string): Response {
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

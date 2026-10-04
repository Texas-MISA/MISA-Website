import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

// One member's project-requirement breakdown for one term (§7, /admin/members
// item 2; migration 30). Takes the client as a parameter, matching
// lib/roster-index.ts and lib/member-fields.ts, so it stays testable and
// carries no server-only guard.
//
// 📌 The three reads behind /admin/members/[id]'s "Project requirements"
// section. The VERDICT is not here: it is `member_directory.project_eligibility`
// on the page's own directory row, so the member page and the table cannot
// disagree about it. Two of the reads are the rows the verdict was judged from,
// read from the same two views the directory asks — one rule, three readers.
// The third is the month general meetings count from (migration 31), the same
// `app_settings` value the months view filters on, so the page can say why a
// month earlier than it has no row.
//
// 🔓 All three are officer-only (the views have no grant to anon or
// authenticated, and app_settings is deny-all under RLS), and the only client
// that can read them is the service-role one. An anon client gets an error for
// each, which is what tests/project-eligibility.test.ts asserts.

type Client = SupabaseClient<Database>;

/**
 * One list, read or failed.
 *
 * ⚠️ Never `[]` on failure. An empty month list is a real answer — no general
 * meeting counts in the term yet: none is published with "Count as general
 * meeting" ticked, or every one falls before the month general meetings count
 * from — and a failed read rendered the same way tells an officer a member has
 * nothing to meet. lib/roster-index.ts is the model.
 */
export type Read<T> = { kind: "ok"; rows: T[] } | { kind: "error" };

/**
 * The first Central month whose general meetings are judged
 * (`app_settings.general_meetings_from`, migration 31), or a failed read.
 *
 * ⚠️ `error` on a read error AND on no row. Under deny-all RLS an anon client
 * gets ZERO rows rather than an error — the reason readPrices in
 * app/actions/dues.ts checks `!data` — and a start that failed to load must
 * never render as if there were none: the page would then explain an empty
 * September as nothing being due, which is a claim.
 */
export type GeneralMeetingsFrom =
  | {
      kind: "ok";
      /** `YYYY-MM-01` — format with `formatMonth`, never `new Date`. */
      month: string;
    }
  | { kind: "error" };

/** One Central calendar month's general meetings, for one member. */
export type RequirementMonth = {
  /** `YYYY-MM-01` — format with `formatMonth`, never `new Date`. */
  month: string;
  meetingsScheduled: number;
  meetingsHeld: number;
  meetingsAttended: number;
  /** 2, or every meeting when fewer than 2 are scheduled. */
  meetingsRequired: number;
  /** The month has ended and so has every meeting in it. */
  complete: boolean;
  /** `met`, `not_met` or `in_progress` — see MONTH_RESULTS. */
  status: string;
};

/** One published Projects event, and what this member did about it. */
export type RequirementMeeting = {
  eventId: string;
  title: string;
  /** Raw PostgREST timestamps. Format on the server. */
  startsAt: string;
  endsAt: string;
  /** `attended`, `missed` or `upcoming` — see MEETING_RESULTS. */
  status: string;
};

export type ProjectRequirements = {
  months: Read<RequirementMonth>;
  meetings: Read<RequirementMeeting>;
  generalMeetingsFrom: GeneralMeetingsFrom;
};

// One unbroken literal each, with `as const`: PostgREST types the returned row
// off the string literal (the note on AUDITED_ADJUSTMENT_COLUMNS).
const MONTH_COLUMNS =
  "month, meetings_scheduled, meetings_held, meetings_attended, meetings_required, month_complete, status" as const;

const MEETING_COLUMNS = "event_id, title, starts_at, ends_at, status" as const;

/**
 * The months and the project meetings behind one member's verdict in `term`,
 * and the month general meetings count from.
 *
 * The three reads fail INDEPENDENTLY, so the page can show what came back and
 * say what did not — the per-section rule the rest of that page follows.
 * Months come oldest first; meetings in the order they happen, with the event
 * id as a tie-break so the order is total.
 *
 * Unbounded on purpose. Both lists are one member's rows for one term: a
 * handful of months and at most a few dozen meetings, far under any `max_rows`.
 */
export async function fetchProjectRequirements(
  db: Client,
  memberId: string,
  term: string
): Promise<ProjectRequirements> {
  const [months, meetings, settings] = await Promise.all([
    db
      .from("member_general_meeting_months")
      .select(MONTH_COLUMNS)
      .eq("member_id", memberId)
      .eq("term", term)
      .order("month", { ascending: true }),
    db
      .from("member_project_meetings")
      .select(MEETING_COLUMNS)
      .eq("member_id", memberId)
      .eq("term", term)
      .order("starts_at", { ascending: true })
      .order("event_id", { ascending: true }),
    // The singleton row, so no filter and no limit (migration 1's note).
    db.from("app_settings").select("general_meetings_from").maybeSingle(),
  ]);

  if (months.error) {
    console.error("project requirement months failed:", months.error.message);
  }
  if (meetings.error) {
    console.error("project meetings failed:", meetings.error.message);
  }
  if (settings.error || !settings.data) {
    console.error(
      "general meetings start failed:",
      settings.error?.message ?? "no settings row"
    );
  }

  return {
    months: months.error
      ? { kind: "error" }
      : {
          kind: "ok",
          // Every column of a view is nullable in the generated types. None of
          // these can really be null — each is a grouping key or an aggregate
          // over at least one row — so the fallbacks only satisfy the type.
          rows: months.data.map((row) => ({
            month: row.month ?? "",
            meetingsScheduled: row.meetings_scheduled ?? 0,
            meetingsHeld: row.meetings_held ?? 0,
            meetingsAttended: row.meetings_attended ?? 0,
            meetingsRequired: row.meetings_required ?? 0,
            complete: row.month_complete ?? false,
            status: row.status ?? "",
          })),
        },
    meetings: meetings.error
      ? { kind: "error" }
      : {
          kind: "ok",
          rows: meetings.data.map((row) => ({
            eventId: row.event_id ?? "",
            title: row.title ?? "",
            startsAt: row.starts_at ?? "",
            endsAt: row.ends_at ?? "",
            status: row.status ?? "",
          })),
        },
    generalMeetingsFrom:
      settings.error || !settings.data
        ? { kind: "error" }
        : { kind: "ok", month: settings.data.general_meetings_from },
  };
}

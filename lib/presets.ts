// Saved directory filters (§7 Stage 6 phase 7a). Pure — no next/* imports, no
// supabase-js — the same contract as lib/filters.ts, which this builds directly
// on top of. The read lives in lib/member-presets.ts and the writes in
// app/actions/presets.ts.
//
// A preset is a NAME over a query string, and that choice carries the whole
// design:
//
//   * lib/filters.ts already round-trips a MemberFilter through a URL in both
//     directions and sorts the keys, so the canonical string is a function of
//     the filter and not of the order the officer touched the controls. That is
//     what lets the UI mark the active preset by string equality instead of
//     diffing two filter objects.
//   * A structured jsonb copy of MemberFilter would be a SECOND representation
//     of that type, and every field added to it would have to be added there too
//     or quietly drop out of every stored preset.
//   * A stale preset degrades the way a stale bookmark does: parseMemberFilter
//     reads the keys it knows and is total, so a preset naming a since-archived
//     custom field narrows LESS rather than erroring — the phase-3 rule arriving
//     for free.

import {
  MEMBER_SORT_LABELS,
  MEMBER_TERM_ALL,
  defaultDirection,
  memberFilterToParams,
  parseMemberFilter,
  type MemberBuiltinSort,
  type MemberFilter,
  type SortableField,
} from "@/lib/filters";
import { parseCustomFieldKey, type FieldDefinition } from "@/lib/members";

/** Mirrors `member_filter_presets_name_not_blank`. The database is the
 * guarantee; this is what turns a violation into a `maxLength` on the input. */
export const MAX_PRESET_NAME = 80;

/**
 * Mirrors `member_filter_presets_query_bounded`.
 *
 * Bounded rather than unbounded text because the query reaches the browser as an
 * href on every directory render. A filter an officer can actually build through
 * the controls is a couple of hundred characters — this is a guard rail against
 * a hand-rolled POST, not a limit anyone should meet.
 */
export const MAX_PRESET_QUERY = 2000;

export type Preset = {
  id: string;
  name: string;
  /** The canonical query string, with no leading `?`. */
  query: string;
  createdBy: string | null;
};

/**
 * The definition list to canonicalise a preset AGAINST — every definition that
 * exists, archived or not, directory column or not.
 *
 * 🐛 Found in the phase-7a walkthrough, and it is subtler than it looks. The
 * rule "canonicalise on write, never on read" is not enough on its own, because
 * **a rename is a write**: the manage screen posts the row's stored query back
 * unchanged, so canonicalising it against the LIVE definitions would re-derive a
 * filter the officer never touched. Archive a custom field, rename a preset that
 * used it, and the `cf:` clause is gone for good — the exact data loss the
 * canonicalise-on-write rule was written to prevent, arriving through the one
 * write nobody thinks of as a filter change. The observed symptom was worse than
 * silent, and only because of an accident: a preset whose ONLY clause was the
 * archived one canonicalised to the empty string and the save was refused with
 * "Check that name", which is not the problem. A preset with a second live
 * clause would have saved cleanly and lost the first.
 *
 * So storage is permissive and APPLICATION stays strict. A `cf:` key naming a
 * definition that exists survives being stored; the directory page still loads
 * live, in-directory definitions only, so an archived field narrows nothing
 * while it is archived — and starts working again if it is restored. Only a key
 * naming no definition at all is dropped, which is the case where there is
 * genuinely nothing to preserve.
 *
 * `showInDirectory: true` is asserted rather than read for the same reason:
 * toggling a field off the directory must not destroy a stored preset either.
 */
export function storableFields(
  definitions: readonly { key: string }[]
): SortableField[] {
  return definitions.map((definition) => ({
    key: definition.key,
    showInDirectory: true,
  }));
}

/**
 * A raw query string reduced to the canonical form `memberFilterToParams` emits.
 *
 * 🪤 **Call this when WRITING a preset and never when reading one**, and pass
 * `storableFields(...)` rather than the live list — see the note there for the
 * walkthrough defect that second half exists to close. On read, the stored
 * string goes straight into the URL and `parseMemberFilter` on the directory
 * page ignores whatever no longer applies. That is the same thing it does to a
 * phase-1 bookmark carrying `minRate=50`, and it is the behaviour we want: an
 * out-of-date preset narrows less, visibly, rather than being rewritten behind
 * the officer's back.
 *
 * Returns "" for a filter that narrows nothing. Callers must refuse to store
 * that — the database CHECK refuses it too, because a preset that shows the
 * whole roster is a chip promising a narrowed view and not delivering one.
 */
export function canonicalPresetQuery(
  raw: string,
  fields: readonly SortableField[]
): string {
  const params: Record<string, string> = {};
  // `raw` may or may not carry a leading '?', depending on whether it came from
  // a stored value or from `location.search`. URLSearchParams strips one.
  for (const [key, value] of new URLSearchParams(raw).entries()) {
    // First wins, matching `one()` in lib/filters.ts — the two must agree about
    // a repeated param or the round trip is not a round trip.
    if (!(key in params)) params[key] = value;
  }
  return memberFilterToParams(parseMemberFilter(params, fields)).toString();
}

/**
 * A one-line, human description of what a preset narrows to.
 *
 * Without this a preset is an opaque query string and the manage screen is a
 * list of names nobody can verify. It is deliberately built from the parsed
 * MemberFilter rather than by pattern-matching the URL text, so a filter that
 * parseMemberFilter would ignore does not get described as though it applied —
 * which is the whole hazard a stale preset carries.
 *
 * Returns the parts; the caller joins them. An empty array means the filter
 * narrows nothing, which the save path already refuses.
 */
export function presetSummary(
  filter: MemberFilter,
  definitions: readonly FieldDefinition[],
  /** id → label, for the one filter that stores an opaque identifier. Missing
   * ids are described without a name rather than as a uuid: `fetchEventOptions`
   * caps at 100, so an old event legitimately falls off the picker. */
  eventLabels: ReadonlyMap<string, string> = new Map()
): string[] {
  const parts: string[] = [];

  // 📌 A null term is the default scope — "whatever term it is when you open
  // this" — and says nothing, which is why it is omitted rather than described
  // as the current term. Describing it would make every saved view read as
  // though it had pinned the semester it was created in, which is exactly the
  // thing null exists to avoid.
  if (filter.term === MEMBER_TERM_ALL) parts.push("All terms");
  else if (filter.term !== null) parts.push(filter.term);

  if (filter.q) parts.push(`“${filter.q}”`);

  const points = rangeLabel("Points", filter.minPoints, filter.maxPoints);
  if (points) parts.push(points);

  if (filter.dues === "paid") parts.push("Dues paid");
  else if (filter.dues === "unpaid") parts.push("Dues not paid");

  if (filter.source === "admin") parts.push("Added by an officer");
  else if (filter.source === "self_checkin") parts.push("Self-registered");

  // Sorted for the same reason applyMemberFilter and memberFilterToParams sort
  // them: the summary must be a function of the filter, not of insertion order.
  for (const key of Object.keys(filter.custom).sort()) {
    const definition = definitions.find((d) => d.key === key);
    parts.push(`${definition?.label ?? key}: ${filter.custom[key]}`);
  }

  if (filter.event !== null) {
    const label = eventLabels.get(filter.event);
    const verb = filter.eventMode === "attended" ? "Attended" : "Missed";
    parts.push(label ? `${verb} ${label}` : `${verb} a specific event`);
  }

  if (filter.pending === "has") parts.push("Has pending check-ins");

  const events = rangeLabel("Events", filter.minEvents, filter.maxEvents);
  if (events) parts.push(events);

  // The sort is part of what a preset restores, so it is part of what the
  // summary has to disclose — an officer who clicks a chip and finds their
  // column order changed with no warning has been surprised by their own saved
  // filter. Omitted when it is the default, which is the one case that surprises
  // nobody.
  if (filter.sort !== "name" || filter.dir !== defaultDirection(filter.sort)) {
    const arrow = filter.dir === "asc" ? "▲" : "▼";
    parts.push(`Sorted by ${sortLabel(filter.sort, definitions)} ${arrow}`);
  }

  return parts;
}

/** What a sort key is called on screen — a built-in's own label, or the custom
 * field's. Falls back to the raw key rather than hiding an unrecognised sort,
 * for the reason `formatAuditAction` falls back to the raw verb. */
function sortLabel(
  sort: string,
  definitions: readonly FieldDefinition[]
): string {
  const custom = parseCustomFieldKey(sort);
  if (custom === null) {
    return MEMBER_SORT_LABELS[sort as MemberBuiltinSort] ?? sort;
  }
  return definitions.find((d) => d.key === custom)?.label ?? custom;
}

/** "Points 5–10" / "Points ≥ 5" / "Points ≤ 10", or null for no bound.
 *
 * ⚠️ Tests `!== null` rather than truthiness. A `0` is a real bound — `Events 0–0`
 * is "attended nothing", the query an officer reaching for this screen most
 * likely wants — and collapsing it into "no bound" is the null-vs-zero rule the
 * rest of this codebase keeps restating. */
function rangeLabel(
  noun: string,
  min: number | null,
  max: number | null
): string | null {
  if (min !== null && max !== null) return `${noun} ${min}–${max}`;
  if (min !== null) return `${noun} ≥ ${min}`;
  if (max !== null) return `${noun} ≤ ${max}`;
  return null;
}

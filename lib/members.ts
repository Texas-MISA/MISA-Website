// Member domain core (§7 Stage 6). Pure — no next/* imports, no supabase-js —
// so Vitest exercises it directly, the same contract as lib/events.ts,
// lib/attendance.ts and lib/filters.ts. Anything with a decision in it belongs
// here rather than inside the page.
//
// Phase 3 put one thing in here: how a term's events are classified against a
// member's attendance for the detail page's grid. Phase 4 adds the custom-field
// definitions, option validation, sort-key namespacing, and
// AUDITED_MEMBER_COLUMNS.

/** The events grid's three states. */
export type TermEventState = "attended" | "missed" | "upcoming";

/** The subset of an event this classification needs. */
export type TermEventInput = {
  id: string;
  /** Raw PostgREST timestamptz string. */
  ends_at: string;
};

export type ClassifiedTermEvent = {
  eventId: string;
  state: TermEventState;
};

export type TermEventSummary = {
  events: ClassifiedTermEvent[];
  attended: number;
  missed: number;
  upcoming: number;
};

/**
 * Classify each of the term's events for one member.
 *
 * ⚠️ **Three states, not two.** An event that has not ended yet is `upcoming`,
 * never a miss. `member_directory.events_possible` counts only published events
 * with `ends_at < now()`, precisely so the denominator does not include events
 * nobody could have attended — and a grid that painted future events red would
 * contradict the rate printed above it and make every member look worse at the
 * start of a term.
 *
 * The boundary is the same half-open one the rest of the app uses: an event
 * whose `ends_at` is exactly `now` has ended, matching the view's `<` on the
 * other side of the comparison.
 *
 * `now` is injected rather than read, so a test can place an event on either
 * side of it without touching the clock.
 */
export function classifyTermEvents(
  events: readonly TermEventInput[],
  attendedEventIds: ReadonlySet<string>,
  now: Date
): TermEventSummary {
  const nowMs = now.getTime();
  const classified: ClassifiedTermEvent[] = events.map((event) => {
    if (attendedEventIds.has(event.id)) {
      return { eventId: event.id, state: "attended" };
    }
    // Attendance is a fact and outranks the clock: a member marked present at
    // an event that has somehow not ended is still attended, not upcoming.
    const ended = new Date(event.ends_at).getTime() <= nowMs;
    return { eventId: event.id, state: ended ? "missed" : "upcoming" };
  });

  return {
    events: classified,
    attended: classified.filter((e) => e.state === "attended").length,
    missed: classified.filter((e) => e.state === "missed").length,
    upcoming: classified.filter((e) => e.state === "upcoming").length,
  };
}

// ---------------------------------------------------------------------------
// Custom fields (phase 4)
// ---------------------------------------------------------------------------

/**
 * A custom field definition, as the app reads it.
 *
 * Mirrors `member_field_definitions` (migration 18). `kind` is a union of one
 * for now; it is a union rather than a literal so adding `'text'` later is a
 * compile error at every place that switches on it rather than a silent
 * fallthrough.
 */
export type FieldKind = "select";

export type FieldDefinition = {
  id: string;
  key: string;
  label: string;
  kind: FieldKind;
  options: string[];
  editableInline: boolean;
  showInDirectory: boolean;
  sortOrder: number;
  archivedAt: string | null;
};

/**
 * 🔓 The shape a definition key is allowed to take — and this is a security
 * control, not a naming convention.
 *
 * The key is interpolated into a PostgREST `order=` term as
 * `custom_fields->>key`, and the phase-4 spike (2026-08-02) established what an
 * unconstrained key buys: a key containing a comma breaks out of the order term
 * and is parsed as a SECOND order column — `custom_fields->>a,b` came back
 * `42703 column ... b does not exist`, meaning an arbitrary column name would
 * have been accepted. `.` and `)` fail as PGRST100 parse errors, but a **space
 * and a `"` were accepted silently, with no error at all**, so "it errored when
 * I tried it" is not a boundary.
 *
 * This regex IS the escape. `member_field_definitions_key_format` in migration
 * 18 is the same pattern, enforced a second time in the database so a key that
 * skipped the zod schema still cannot be stored. Nothing may reach
 * customSortColumn() without having been through one of them.
 *
 * Anchored, lowercase, leading letter, 1–40 characters — deliberately narrower
 * than "characters that happen to be safe", because a key is written once by an
 * officer and read forever by everything else.
 */
export const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

/**
 * Keys a custom field may not take, mirroring
 * `member_field_definitions_key_not_builtin`.
 *
 * Not about sorting — sort keys are namespaced `cf:` and structurally cannot
 * collide. This is phase 5's export field catalogue, which is ONE namespace
 * over the built-in columns and the custom fields: two columns competing for
 * `email` would make the picker, the CSV header, and the xlsx header ambiguous.
 */
export const RESERVED_FIELD_KEYS: ReadonlySet<string> = new Set([
  "id",
  "eid",
  "email",
  "name",
  "full_name",
  "active",
  "source",
  "joined_at",
  "notes",
  "custom_fields",
  "total_points",
  "attendance_points",
  "bonus_points",
  "events_attended",
  "events_possible",
  "attendance_rate",
  "pending_count",
  "last_seen_at",
]);

/** Bounds on an option list, mirroring `valid_field_options()` in migration 18. */
export const MAX_FIELD_OPTIONS = 40;
export const MAX_OPTION_LENGTH = 80;
export const MAX_FIELD_LABEL_LENGTH = 80;

/** True when `key` is storable as a definition key. Both conditions, because
 * the format check alone would accept `email`. */
export function isValidFieldKey(key: string): boolean {
  return FIELD_KEY_PATTERN.test(key) && !RESERVED_FIELD_KEYS.has(key);
}

/**
 * The prefix that keeps a custom sort key out of the built-in namespace.
 *
 * `MEMBER_SORTS` is a closed list of four and a custom field is officer-defined
 * at runtime, so without a namespace a field keyed `email` would shadow the
 * real column — and `:` cannot appear in a key at all, which makes the split
 * unambiguous in both directions.
 */
export const CUSTOM_SORT_PREFIX = "cf:";

/** A definition key → the sort key that names it in a URL. */
export function customSortKey(key: string): string {
  return `${CUSTOM_SORT_PREFIX}${key}`;
}

/** The inverse: a sort key → the definition key, or null if it names a
 * built-in. Total, so a caller never has to test the prefix itself. */
export function parseCustomSortKey(sort: string): string | null {
  if (!sort.startsWith(CUSTOM_SORT_PREFIX)) return null;
  return sort.slice(CUSTOM_SORT_PREFIX.length) || null;
}

/**
 * The PostgREST column expression a custom sort orders by.
 *
 * 🔓 The one place a definition key becomes part of a query string, and
 * therefore the one place the key format has to be re-checked rather than
 * assumed. Returns null for anything that would not survive
 * `isValidFieldKey`, and callers must fall back to a built-in sort rather than
 * interpolating the key anyway — see the note on FIELD_KEY_PATTERN for what an
 * unchecked key does to an `order=` term.
 */
export function customSortColumn(key: string): string | null {
  if (!isValidFieldKey(key)) return null;
  return `custom_fields->>${key}`;
}

/**
 * The value a member holds for one field, or null when they hold none.
 *
 * A missing key and an empty string are the same thing — "no answer" — because
 * clearing a dropdown writes nothing rather than `""`, and a member who has
 * never been touched has no key at all. Collapsing them here means callers do
 * not each decide, and it matches how the column sorts: SQL NULL, last.
 */
export function fieldValue(
  customFields: unknown,
  key: string
): string | null {
  if (typeof customFields !== "object" || customFields === null) return null;
  if (Array.isArray(customFields)) return null;
  const raw = (customFields as Record<string, unknown>)[key];
  if (typeof raw !== "string") return null;
  return raw === "" ? null : raw;
}

/**
 * The next `custom_fields` object after setting one field.
 *
 * Returns a whole object rather than a patch because PostgREST writes the
 * column wholesale — there is no partial jsonb update through the API — and
 * because the audit before/after wants both complete objects anyway.
 *
 * A null or empty value DELETES the key instead of storing `""`. Storing an
 * empty string would make "cleared" and "never answered" two different states
 * that render identically and sort differently, which is precisely the
 * distinction the null-vs-zero rule exists to prevent elsewhere (§4.5).
 */
export function setFieldValue(
  customFields: unknown,
  key: string,
  value: string | null
): Record<string, string> {
  const base: Record<string, string> = {};
  if (
    typeof customFields === "object" &&
    customFields !== null &&
    !Array.isArray(customFields)
  ) {
    for (const [k, v] of Object.entries(customFields as Record<string, unknown>)) {
      if (typeof v === "string" && v !== "") base[k] = v;
    }
  }

  if (value === null || value === "") delete base[key];
  else base[key] = value;

  return base;
}

/** One entry in a rendered dropdown. `orphan` marks a value a member still
 * holds that the definition no longer offers. */
export type FieldOption = {
  value: string;
  label: string;
  orphan: boolean;
};

/**
 * The options to render for one member's cell, given what they currently hold.
 *
 * ⚠️ **Nothing in the database constrains a stored value to its definition's
 * option list.** The column check is `jsonb_typeof = 'object'` and no more —
 * `setMemberFieldValue` and `isAllowedFieldValue` are the only enforcement. So
 * an officer who edits an option list *orphans* every stored value that used to
 * be one, by design: rewriting members' answers to match a changed list would
 * silently falsify the roster, and refusing the edit would leave a typo'd
 * option permanent.
 *
 * That leaves a rendering problem. A `<select>` whose value matches no `<option>`
 * shows blank in every browser, so the member would appear to hold nothing and
 * the officer's first edit would destroy a real answer without ever displaying
 * it. The orphan is therefore appended as a trailing entry, labelled for what it
 * is, and the caller renders it **disabled** — visible, clearable, not
 * re-appliable. `isAllowedFieldValue` independently refuses it server-side, so
 * the disabled attribute is a courtesy rather than the control.
 */
export function fieldOptions(
  definition: Pick<FieldDefinition, "options">,
  current: string | null
): FieldOption[] {
  const options: FieldOption[] = definition.options.map((value) => ({
    value,
    label: value,
    orphan: false,
  }));

  if (current !== null && current !== "" && !definition.options.includes(current)) {
    options.push({
      value: current,
      label: `${current} (no longer an option)`,
      orphan: true,
    });
  }

  return options;
}

/**
 * Is `value` one of the definition's options?
 *
 * Exact match, not case-insensitive: the stored value IS the option text, and
 * the option list already rejects two entries differing only in case, so an
 * incoming value that differs in case came from something other than the
 * dropdown. Empty means "clear it", which is always allowed.
 */
export function isAllowedFieldValue(
  definition: Pick<FieldDefinition, "options">,
  value: string
): boolean {
  if (value === "") return true;
  return definition.options.includes(value);
}

/**
 * The columns both sides of a member audit before/after must select.
 *
 * ⚠️ One unbroken string literal with `as const`, for two reasons that have
 * each bitten this codebase already. PostgREST types the returned row off the
 * string *literal*, so a wrapped or concatenated list widens to plain `string`
 * and collapses the result to `GenericStringError` — every field access fails
 * at once, which reads as a schema fault. And both sides of the diff must
 * select the SAME columns: `AuditTrail` renders a key present on one side only
 * as `—`, so a narrower select on the update invents changes that never
 * happened. Voiding a point adjustment logged two phantom erasures before
 * AUDITED_ADJUSTMENT_COLUMNS existed for this reason.
 */
export const AUDITED_MEMBER_COLUMNS =
  "id, full_name, email, eid, active, notes, custom_fields, updated_at" as const;

/** The same contract for a field definition. Kept separate from
 * `FIELD_COLUMNS` in lib/member-fields.ts, which is the narrower read the UI
 * needs: the symmetry rule is about the two sides of one diff, not about every
 * read of the table agreeing. */
export const AUDITED_FIELD_COLUMNS =
  "id, key, label, kind, options, editable_inline, show_in_directory, sort_order, archived_at, updated_at" as const;

/**
 * Drop the concurrency token from an audit payload.
 *
 * `updated_at` has to be in `AUDITED_MEMBER_COLUMNS` — the action returns it as
 * the next compare-and-set token — but it changes on every single save and
 * `admin_audit.acted_at` already records when. Left in, every `member.updated`
 * diff opens with a timestamp change that carries no information.
 *
 * ⚠️ Apply this to **both sides in the same expression**, never by narrowing one
 * side's `.select()`. `AuditTrail` diffs the union of the two objects' keys and
 * renders a key present on one side only as `—`, so an asymmetric strip would
 * invent an erasure that never happened — the exact bug
 * `AUDITED_ADJUSTMENT_COLUMNS` exists to prevent.
 */
export function withoutToken<T extends Record<string, unknown>>(
  row: T
): Omit<T, "updated_at"> {
  // A copy-then-delete rather than a destructuring rest, only because the
  // discarded binding trips no-unused-vars and this project has no underscore
  // escape configured. Same result, no lint suppression.
  const rest = { ...row };
  delete rest.updated_at;
  return rest as Omit<T, "updated_at">;
}

/** How a rate from `member_directory` is displayed.
 *
 * Null is not zero: a term with no completed events has no rate at all, and
 * rendering that as 0% would read as "attended nothing" and sort below a real
 * 5% (§4.5, migration 14). A member who genuinely attended nothing is a real 0
 * and must stay distinguishable from it. */
export function formatAttendanceRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BUTTON_QUIET_SM } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";

import {
  EVENT_MODES,
  hasRelationalFilter,
  MAX_SEARCH_LENGTH,
  MEMBER_DUES,
  MEMBER_PENDING,
  MEMBER_SOURCES,
  MEMBER_STATES,
  memberFilterFields,
  memberFilterUrl,
  relationalFilterCount,
  type MemberFilter,
  type MemberFilterFields,
} from "@/lib/filters";
import type { EventOption } from "@/lib/event-options";
import {
  customFieldKey,
  fieldOptions,
  type FieldDefinition,
} from "@/lib/members";

// Same contract as attendance-filters.tsx: no submit button, every choice in
// the URL, so a filtered view is shareable, survives a reload, and — the part
// that matters from phase 5 on — is the exact thing the export re-reads.
//
// Phase 3 trimmed these to the displayed columns: the roster scope, free-text
// search across name / email / EID, and a total-points range. The events, rate,
// joined-date and source controls went with their filter fields, so an old
// bookmark carrying them narrows nothing and the count always accounts for what
// is on screen.
//
// Stage 6.5 phase 4 added Dues; phase 5c adds the categorical rest — "Added by"
// and one dropdown per directory custom field. 📌 `source` is a deliberate
// return rather than a reversal of the phase-3 trim: it came out as a *column*
// (an annotation on the name, not something to sort a table by) and comes back
// as a *filter*, because §4.2's roster-cleanup query had nowhere to live.
//
// Every control in the top row is a selector over a categorical value, and every
// one of them defaults to the option that narrows NOTHING. Only the roster scope
// defaults to narrowing, and it is the exception on purpose (see MemberFilter).
//
// ⚠️ **Phase 6's relational filters sit in their own panel below, and the split
// is the point rather than a layout preference.** They narrow on data the
// directory does not display — attendance against one event, pending
// submissions, when someone was last seen — which cuts against the phase-3 trim
// that cut the table to what it shows. The trim's actual argument was that a
// filter the officer cannot see leaves a count they cannot account for, so the
// answer is a panel that says plainly what it is, not a filter smuggled into the
// row above. The panel OPENS whenever one of them is set: a collapsed panel
// hiding an applied filter would be the phase-1 defect with a lid on it.

// Named `control` rather than `controlClass`, which is the shared helper's
// name and would shadow it.
const control = controlClass("sm");
const smallNumber = `${control} w-24`;

export function MemberFilters({
  filter,
  definitions,
  events,
}: {
  filter: MemberFilter;
  /**
   * The live custom-field definitions.
   *
   * 🪤 memberFilterUrl needs them or the URL builder re-parses with no
   * definitions, decides the sort names nothing, and silently drops the officer
   * back to sorting by name — so typing one character in the search box used to
   * reset the column they had sorted by. **Phase 5c gives that trap a second
   * mouth**: the same re-parse also reads the `cf:` *filter* params, so without
   * the definitions every custom filter would be dropped on the next keystroke
   * too, not merely the sort.
   *
   * The full definitions rather than phase 4's narrow `SortableField`, because
   * this now renders a dropdown per field and needs the label and the options.
   * Named `definitions` rather than `fields` because `fields` below is the
   * filter boxes' text.
   */
  definitions: readonly FieldDefinition[];
  /**
   * The events the relational panel can filter on, newest first.
   *
   * Shared with the attendance queue, the resolution form and manual entry via
   * `fetchEventOptions` — all statuses, because an officer filtering "who missed
   * the cancelled kickoff" is asking a real question and the ranker's
   * published-only view cannot answer it.
   *
   * ⚠️ Capped at 100 by that helper. At three events a week that is under a
   * year, so an old event eventually drops off the picker with no error — it is
   * on the Capacity-ceilings list in tasks.md rather than raised blind here.
   */
  events: readonly EventOption[];
}) {
  const router = useRouter();

  // ⚠️ These are controlled, and that is load-bearing rather than a style
  // choice. They were `defaultValue` + `onBlur`, which React reads only at
  // mount — so CLEAR (a router.push, no remount) left the officer's typed
  // numbers on screen while the query no longer carried them. The selects were
  // already controlled and never had the bug.
  //
  // They are *not* committed on every keystroke: onChange keeps the text local
  // and onBlur navigates, so typing "15" does not fire a request at "1".
  const [fields, setFields] = useState(() => memberFilterFields(filter));

  // Resync when the URL's filter changes underneath us — CLEAR, the back
  // button, or a value the server clamped or sanitized. Reset-during-render
  // rather than an effect, matching review-queue.tsx; comparing the derived
  // strings because `filter` is a fresh object on every render and would never
  // compare equal.
  //
  // 📌 Compared across EVERY key rather than three named ones. Phase 6 adds
  // three more boxes, and a hand-written list of comparisons is precisely the
  // kind of thing that gets a field added to one side and not the other — at
  // which case the new box stops resyncing on CLEAR and quietly reproduces the
  // phase-1 defect it was written to prevent.
  const incoming = memberFilterFields(filter);
  const [seen, setSeen] = useState(incoming);
  const changed = (Object.keys(incoming) as (keyof MemberFilterFields)[]).some(
    (key) => seen[key] !== incoming[key]
  );
  if (changed) {
    setSeen(incoming);
    setFields(incoming);
  }

  function set(key: keyof MemberFilterFields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function update(changes: Record<string, string>) {
    router.push(
      `/admin/members?${memberFilterUrl(filter, changes, definitions)}`
    );
  }

  // The directory columns, which is exactly the set parseMemberFilter will
  // accept a `cf:` filter for — so a control exists for every filter that can
  // be applied, and no filter can be applied without a control.
  const filterable = definitions.filter((d) => d.showInDirectory);

  const relationalCount = relationalFilterCount(filter);

  const anyNarrowing =
    filter.state !== "active" ||
    filter.q !== "" ||
    filter.minPoints !== null ||
    filter.maxPoints !== null ||
    filter.dues !== "all" ||
    filter.source !== "all" ||
    Object.keys(filter.custom).length > 0 ||
    relationalCount > 0;

  return (
    <div>
    <div className="flex flex-wrap items-end gap-4">
      <Labelled label="Search">
        <input
          type="search"
          placeholder="name, email, or EID"
          maxLength={MAX_SEARCH_LENGTH}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`${control} w-64`}
          value={fields.q}
          onChange={(e) => set("q", e.target.value)}
          onBlur={(e) => update({ q: e.target.value })}
          // A search box that only commits on blur is surprising — Enter is what
          // people press. Both routes go through the same update(), so there is
          // still one translation.
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              update({ q: e.currentTarget.value });
            }
          }}
        />
      </Labelled>

      <Labelled label="Roster">
        <select
          className={control}
          value={filter.state}
          onChange={(e) => update({ state: e.target.value })}
        >
          {MEMBER_STATES.map((state) => (
            <option key={state} value={state}>
              {state === "all"
                ? "Active and inactive"
                : state === "active"
                  ? "Active only"
                  : "Inactive only"}
            </option>
          ))}
        </select>
      </Labelled>

      {/* 📌 Ships in the same commit as the filter field it drives. A filter
          with no control on screen is the phase-1 defect from the other side —
          a count the officer cannot account for — and it is why phase 3 deleted
          its six retired fields outright rather than hiding them. */}
      <Labelled label="Dues">
        <select
          className={control}
          value={filter.dues}
          onChange={(e) => update({ dues: e.target.value })}
        >
          {MEMBER_DUES.map((dues) => (
            <option key={dues} value={dues}>
              {dues === "all"
                ? "Paid and not paid"
                : dues === "paid"
                  ? "Paid only"
                  : "Not paid only"}
            </option>
          ))}
        </select>
      </Labelled>

      <Labelled label="Total points">
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            placeholder="min"
            className={smallNumber}
            value={fields.minPoints}
            onChange={(e) => set("minPoints", e.target.value)}
            onBlur={(e) => update({ minPoints: e.target.value })}
          />
          <span className="text-misa-muted">–</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="max"
            className={smallNumber}
            value={fields.maxPoints}
            onChange={(e) => set("maxPoints", e.target.value)}
            onBlur={(e) => update({ maxPoints: e.target.value })}
          />
        </div>
      </Labelled>

      <Labelled label="Added by">
        <select
          className={control}
          value={filter.source}
          onChange={(e) => update({ source: e.target.value })}
        >
          {MEMBER_SOURCES.map((source) => (
            <option key={source} value={source}>
              {source === "all"
                ? "Anyone"
                : source === "admin"
                  ? "An officer"
                  : "Self-registered"}
            </option>
          ))}
        </select>
      </Labelled>

      {/* One dropdown per directory field. ⚠️ Rendered through fieldOptions so
          a value the definition no longer offers appears as a trailing entry
          instead of leaving the <select> blank — the same orphan handling the
          editable cell uses, and it matters more here: the officer filtering
          for a retired option is usually doing so precisely to find the
          members still holding it. */}
      {filterable.map((definition) => {
        const selected = filter.custom[definition.key] ?? "";
        return (
          <Labelled key={definition.key} label={definition.label}>
            <select
              className={control}
              value={selected}
              onChange={(e) =>
                update({ [customFieldKey(definition.key)]: e.target.value })
              }
            >
              <option value="">Any</option>
              {fieldOptions(definition, selected || null).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Labelled>
        );
      })}

      {anyNarrowing && (
        <button
          type="button"
          onClick={() => router.push("/admin/members")}
          className={BUTTON_QUIET_SM}
        >
          CLEAR
        </button>
      )}
    </div>

    <RelationalPanel
      filter={filter}
      fields={fields}
      events={events}
      activeCount={relationalCount}
      set={set}
      update={update}
    />
    </div>
  );
}

/**
 * Phase 6's relational filters, in a panel of their own.
 *
 * ⚠️ `<details open={…}>` with the open state derived from the filter, NOT
 * component state. The panel must be open whenever one of its filters is
 * applied — a collapsed panel hiding an active filter leaves the officer a count
 * they cannot account for, which is the phase-1 defect this whole screen was
 * rebuilt around. `hasRelationalFilter` in lib/filters.ts is the one definition
 * of "active", so the panel and the query cannot disagree about it.
 *
 * The officer can still collapse it by hand; `open` on a `<details>` is the
 * initial state per render, not a lock. What they cannot do is *land* on a page
 * where a filter is applied and hidden.
 */
function RelationalPanel({
  filter,
  fields,
  events,
  activeCount,
  set,
  update,
}: {
  filter: MemberFilter;
  fields: MemberFilterFields;
  events: readonly EventOption[];
  activeCount: number;
  set: (key: keyof MemberFilterFields, value: string) => void;
  update: (changes: Record<string, string>) => void;
}) {
  return (
    <details
      open={hasRelationalFilter(filter)}
      className="mt-4 border border-misa-border bg-misa-panel/40"
    >
      <summary className="cursor-pointer px-4 py-2 text-sm font-medium">
        Attendance filters
        {activeCount > 0 && (
          <span className="ml-2 border border-misa-border px-2 py-0.5 text-[11px] tracking-[0.12em] uppercase">
            {activeCount} active
          </span>
        )}
      </summary>

      <div className="border-t border-misa-border px-4 pt-3 pb-4">
        {/* Says what the panel is, because these are the only filters on the
            screen that narrow on something the table does not show. Without
            this the count and the visible columns look unrelated. */}
        <p className="mb-3 max-w-2xl text-xs text-misa-muted">
          These narrow the list without being columns — the table still shows the
          same fields either way. Open a member for the detail behind them.
        </p>

        <div className="flex flex-wrap items-end gap-4">
          <Labelled label="Event">
            <select
              className={`${control} max-w-[22rem]`}
              value={filter.event ?? ""}
              onChange={(e) => update({ event: e.target.value })}
            >
              <option value="">Any event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.label}
                  {event.status !== "published" ? ` (${event.status})` : ""}
                </option>
              ))}
            </select>
          </Labelled>

          {/* Only meaningful with an event chosen, and disabled rather than
              hidden so the pairing is visible before the officer picks one. */}
          <Labelled label="Who">
            <select
              className={control}
              value={filter.eventMode}
              disabled={filter.event === null}
              onChange={(e) => update({ eventMode: e.target.value })}
            >
              {EVENT_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode === "attended" ? "Attended it" : "Missed it"}
                </option>
              ))}
            </select>
          </Labelled>

          <Labelled label="Pending check-ins">
            <select
              className={control}
              value={filter.pending}
              onChange={(e) => update({ pending: e.target.value })}
            >
              {MEMBER_PENDING.map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? "Any" : "Has some waiting"}
                </option>
              ))}
            </select>
          </Labelled>

          {/* ⚠️ Labelled all-time on purpose. Every other number on this screen
              is current-term scoped, and "when did we last see this person" is
              not a term question — the member detail page says the same. */}
          <Labelled label="Not seen since (all-time)">
            <input
              type="date"
              className={control}
              value={fields.notSeenSince}
              onChange={(e) => set("notSeenSince", e.target.value)}
              onBlur={(e) => update({ notSeenSince: e.target.value })}
            />
          </Labelled>

          <Labelled label="Events attended this term">
            <div className="flex items-center gap-1">
              <input
                type="number"
                inputMode="numeric"
                placeholder="min"
                className={smallNumber}
                value={fields.minEvents}
                onChange={(e) => set("minEvents", e.target.value)}
                onBlur={(e) => update({ minEvents: e.target.value })}
              />
              <span className="text-misa-muted">–</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="max"
                className={smallNumber}
                value={fields.maxEvents}
                onChange={(e) => set("maxEvents", e.target.value)}
                onBlur={(e) => update({ maxEvents: e.target.value })}
              />
            </div>
          </Labelled>
        </div>
      </div>
    </details>
  );
}

function Labelled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      {children}
    </label>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  MAX_SEARCH_LENGTH,
  MEMBER_DUES,
  MEMBER_STATES,
  memberFilterFields,
  memberFilterUrl,
  type MemberFilter,
  type MemberFilterFields,
  type SortableField,
} from "@/lib/filters";

// Same contract as attendance-filters.tsx: no submit button, every choice in
// the URL, so a filtered view is shareable, survives a reload, and — the part
// that matters from phase 5 on — is the exact thing the export re-reads.
//
// Phase 3 trimmed these to the displayed columns: the roster scope, free-text
// search across name / email / EID, and a total-points range. The events, rate,
// joined-date and source controls went with their filter fields, so an old
// bookmark carrying them narrows nothing and the count always accounts for what
// is on screen.

const controlClass = "border border-black/70 bg-misa-panel px-3 py-2 text-sm";
const smallNumber = `${controlClass} w-24`;

export function MemberFilters({
  filter,
  definitions,
}: {
  filter: MemberFilter;
  /**
   * The live custom-field definitions, passed only so memberFilterUrl can keep
   * a `cf:` sort alive across a filter change.
   *
   * 🪤 Without them the URL builder re-parses with no definitions, decides the
   * sort names nothing, and silently drops the officer back to sorting by name
   * — so typing one character in the search box used to reset the column they
   * had sorted by. Named `definitions` rather than `fields` because `fields`
   * below is the filter boxes' text.
   */
  definitions: readonly SortableField[];
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
  const incoming = memberFilterFields(filter);
  const [seen, setSeen] = useState(incoming);
  if (
    seen.q !== incoming.q ||
    seen.minPoints !== incoming.minPoints ||
    seen.maxPoints !== incoming.maxPoints
  ) {
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

  const anyNarrowing =
    filter.state !== "active" ||
    filter.q !== "" ||
    filter.minPoints !== null ||
    filter.maxPoints !== null ||
    filter.dues !== "all";

  return (
    <div className="flex flex-wrap items-end gap-4">
      <Labelled label="Search">
        <input
          type="search"
          placeholder="name, email, or EID"
          maxLength={MAX_SEARCH_LENGTH}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`${controlClass} w-64`}
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
          className={controlClass}
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
          className={controlClass}
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
          <span className="text-foreground/50">–</span>
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

      {anyNarrowing && (
        <button
          type="button"
          onClick={() => router.push("/admin/members")}
          className="rounded-full border border-black/50 px-4 py-2 text-xs font-medium tracking-wider transition hover:bg-black/5"
        >
          CLEAR
        </button>
      )}
    </div>
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

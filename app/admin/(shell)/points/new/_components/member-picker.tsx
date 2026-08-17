"use client";

import { controlClass } from "@/components/ui/field";

import { useMemo, useState } from "react";

import type { MemberOption } from "@/lib/member-options";
import { MAX_GRANT_MEMBERS } from "@/lib/points";

// The multi-member picker for a grant.
//
// The whole roster arrives as a prop and the search filters it in the browser,
// so **searching never navigates**. That is the entire reason this is not the
// `?q=…&sel=…` scheme tasks.md sketched: that design existed to survive a
// navigation, and there is no navigation to survive. It also keeps the roster
// scan honest — `ilike '%jon%'` cannot match `John`, which is why
// lib/member-options.ts scans rather than probes, and a client-side filter over
// the scanned list inherits that instead of undoing it.
//
// Two failure modes shape everything below, and both produce a *partial grant
// that reports success* — the worst outcome this screen has, because there is
// no queue for anyone to notice the missing members in:
//
//   1. **A pick must not depend on its row being rendered.** If the payload
//      rode on the roster list's checkboxes, typing a new search term would
//      unmount the earlier picks, and an unmounted input is not in the
//      FormData. The submitted ids therefore come from hidden inputs driven by
//      selection state, which no filter can unmount.
//   2. **One carrier per id.** Two mounted inputs for the same member is two
//      adjustment rows — double points, with no constraint to catch it. The
//      roster list below excludes anyone already selected, so there is exactly
//      one carrier per pick; grantPoints dedupes server-side as the backstop,
//      not as the fix.
//
// The visible checkboxes carry no `name` at all. They are the affordance; the
// hidden inputs are the payload.

export function MemberPicker({
  members,
  selected,
  onToggle,
  onClear,
  error,
}: {
  members: MemberOption[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
  error?: string[];
}) {
  const [query, setQuery] = useState("");

  const byId = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members]
  );

  // Selected first and always, then everyone else the filter admits. An id with
  // no matching member — a stale echo after someone was deleted — still gets a
  // hidden input, so the officer sees the same count they picked and the server
  // gets the same list it would have got.
  const picked = [...selected].map(
    (id) => byId.get(id) ?? { id, label: "unknown member", active: false }
  );

  const needle = query.trim().toLowerCase();
  const available = members.filter(
    (member) =>
      !selected.has(member.id) &&
      (needle === "" || member.label.toLowerCase().includes(needle))
  );

  const atCap = selected.size >= MAX_GRANT_MEMBERS;

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-misa-muted">Members</span>
        <span className="text-xs text-misa-muted">
          {selected.size} of {MAX_GRANT_MEMBERS} selected
        </span>
      </div>

      {picked.length > 0 && (
        <div className="border border-misa-border bg-misa-panel px-3 py-2">
          <ul className="flex flex-col gap-1">
            {picked.map((member) => (
              <li key={member.id} className="flex items-center gap-2">
                {/* The payload. A hidden input's default value is its own
                    `value` attribute, so React 19's post-action form reset
                    restores it to itself rather than clearing it — unlike the
                    checkbox beside it. */}
                <input
                  type="hidden"
                  name="memberIds"
                  defaultValue={member.id}
                />
                <input
                  type="checkbox"
                  checked
                  onChange={() => onToggle(member.id)}
                  aria-label={`Remove ${member.label}`}
                />
                <span>{member.label}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onClear}
            className="mt-2 text-xs underline underline-offset-2"
          >
            clear all
          </button>
        </div>
      )}

      <input
        type="search"
        // No `name`, deliberately: this is a view control and must never reach
        // the action.
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by name or EID"
        aria-label="Filter members"
        className={controlClass("sm", "w-full")}
      />

      <ul className="max-h-64 overflow-y-auto border border-misa-border">
        {available.length === 0 ? (
          <li className="px-3 py-2 text-misa-muted">
            {members.length === 0
              ? "No active members on the roster."
              : needle === ""
                ? "Everyone is selected."
                : "No members match that."}
          </li>
        ) : (
          available.map((member) => (
            <li key={member.id} className="border-b border-misa-hairline last:border-0">
              <label className="flex items-center gap-2 px-3 py-1.5">
                <input
                  type="checkbox"
                  checked={false}
                  disabled={atCap}
                  onChange={() => onToggle(member.id)}
                />
                <span className={atCap ? "text-misa-muted" : ""}>
                  {member.label}
                </span>
              </label>
            </li>
          ))
        )}
      </ul>

      {atCap && (
        <p className="text-xs text-misa-muted">
          That is the most one grant can cover. Grant the rest separately.
        </p>
      )}

      {error && error.length > 0 && (
        <span className="text-xs text-misa-caution">{error[0]}</span>
      )}
    </div>
  );
}

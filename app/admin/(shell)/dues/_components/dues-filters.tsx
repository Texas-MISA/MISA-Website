"use client";

import { controlClass } from "@/components/ui/field";

import { useRouter, useSearchParams } from "next/navigation";
import { Panel } from "@/components/ui/panel";

// Same contract as point-filters.tsx and attendance-filters.tsx: no submit
// button, everything in the URL, so a filtered ledger is shareable and survives
// a reload.
//
// The member filter is deliberately not a control in here. It is set by clicking
// a member's name in the table and cleared by the chip below, because the
// alternative is a second 400-entry <select> an officer would have to scroll to
// answer a question they already answered by looking at a row.
//
// The term options are passed in rather than built here: a literal term string
// in application code is a bug (§4.7), and the page derives them from what is
// actually in the database.

const selectClass = controlClass("sm");
const inputClass = controlClass("sm");

export function DuesFilters({
  terms,
  memberLabel,
  selected,
}: {
  terms: string[];
  /** The name of the member currently filtered on, resolved server-side, or
   * null when the filter is off. Never formatted here. */
  memberLabel: string | null;
  selected: {
    state: string;
    term: string;
    from: string;
    to: string;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/admin/dues?${next.toString()}`);
  }

  return (
    // 🪤 A white surface, because every control in here fills with
    // `bg-misa-panel` and the admin page ground is now that same grey.
    <Panel ground="white" pad="sm">
      <div className="flex flex-wrap items-end gap-4">
        <Labelled label="Show">
          <select
            className={selectClass}
            value={selected.state}
            onChange={(e) => update("state", e.target.value)}
          >
            {/* All is the default, matching the points ledger: the ledger's job
                is to show what happened, and a void is something that happened.
                The needs-review count in the header is what surfaces the queue,
                so it does not have to be the default view too. */}
            <option value="all">Everything</option>
            <option value="review">Needs review</option>
            <option value="live">Live only</option>
            <option value="voided">Voided only</option>
          </select>
        </Labelled>

        <Labelled label="Covers term">
          <select
            className={selectClass}
            value={selected.term}
            onChange={(e) => update("term", e.target.value)}
          >
            <option value="">Any term</option>
            {terms.map((term) => (
              <option key={term} value={term}>
                {term}
              </option>
            ))}
          </select>
        </Labelled>

        <Labelled label="Paid from">
          <input
            type="date"
            className={inputClass}
            value={selected.from}
            onChange={(e) => update("from", e.target.value)}
          />
        </Labelled>

        <Labelled label="Paid to">
          <input
            type="date"
            className={inputClass}
            value={selected.to}
            onChange={(e) => update("to", e.target.value)}
          />
        </Labelled>
      </div>

      {memberLabel && (
        <p className="mt-3 text-sm">
          Showing payments credited to <strong>{memberLabel}</strong>{" "}
          <button
            type="button"
            onClick={() => update("member", "")}
            className="underline underline-offset-2"
          >
            clear
          </button>
        </p>
      )}
    </Panel>
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

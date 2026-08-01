"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { formatPointCategory, POINT_CATEGORIES } from "@/lib/points";

// Same contract as attendance-filters.tsx: no submit button, everything in the
// URL so a filtered ledger is shareable and survives a reload.
//
// The member filter is deliberately not a control in here. It is set by
// clicking a member's name in the ledger and cleared by the chip below, because
// the alternative is a second 400-entry <select> that an officer would have to
// scroll to answer a question they already answered by looking at a row.

const selectClass = "border border-black/70 bg-misa-panel px-3 py-2 text-sm";
const inputClass = "border border-black/70 bg-misa-panel px-3 py-2 text-sm";

export type OfficerOption = {
  id: string;
  label: string;
};

export function PointFilters({
  officers,
  memberLabel,
  selected,
}: {
  officers: OfficerOption[];
  /** The name of the member currently filtered on, resolved server-side, or
   * null when the filter is off. Never formatted here. */
  memberLabel: string | null;
  selected: {
    officer: string;
    category: string;
    state: string;
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
    router.push(`/admin/points?${next.toString()}`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-4">
        <Labelled label="Officer">
          <select
            className={selectClass}
            value={selected.officer}
            onChange={(e) => update("officer", e.target.value)}
          >
            <option value="">Any officer</option>
            {officers.map((officer) => (
              <option key={officer.id} value={officer.id}>
                {officer.label}
              </option>
            ))}
          </select>
        </Labelled>

        <Labelled label="Category">
          <select
            className={selectClass}
            value={selected.category}
            onChange={(e) => update("category", e.target.value)}
          >
            <option value="">Any category</option>
            {POINT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {formatPointCategory(category)}
              </option>
            ))}
          </select>
        </Labelled>

        <Labelled label="Show">
          <select
            className={selectClass}
            value={selected.state}
            onChange={(e) => update("state", e.target.value)}
          >
            {/* All is the default: the ledger's job is to show what happened,
                and a void is something that happened. */}
            <option value="all">Live and voided</option>
            <option value="live">Live only</option>
            <option value="voided">Voided only</option>
          </select>
        </Labelled>

        <Labelled label="From">
          <input
            type="date"
            className={inputClass}
            value={selected.from}
            onChange={(e) => update("from", e.target.value)}
          />
        </Labelled>

        <Labelled label="To">
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
          Showing grants to <strong>{memberLabel}</strong>{" "}
          <button
            type="button"
            onClick={() => update("member", "")}
            className="underline underline-offset-2"
          >
            clear
          </button>
        </p>
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

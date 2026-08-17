"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { EVENT_CATEGORIES, EVENT_STATUSES, formatCategory } from "@/lib/events";
import { controlClass } from "@/components/ui/field";

// Client Component so a filter change navigates without a submit button.
// Filters live in the URL rather than in component state, so a filtered view
// is shareable and survives a reload — the officer-facing screens are ones
// people paste to each other.

const selectClass =
  controlClass("sm");

export function EventFilters({
  terms,
  currentTerm,
  selected,
}: {
  terms: string[];
  currentTerm: string | null;
  selected: { term: string; status: string; category: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/admin/events?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <Labelled label="Term">
        <select
          className={selectClass}
          value={selected.term}
          onChange={(e) => update("term", e.target.value)}
        >
          <option value="all">All terms</option>
          {terms.map((term) => (
            <option key={term} value={term}>
              {term}
              {term === currentTerm ? " (current)" : ""}
            </option>
          ))}
        </select>
      </Labelled>

      <Labelled label="Status">
        <select
          className={selectClass}
          value={selected.status}
          onChange={(e) => update("status", e.target.value)}
        >
          <option value="">Any status</option>
          {EVENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
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
          {EVENT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {formatCategory(category)}
            </option>
          ))}
        </select>
      </Labelled>
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

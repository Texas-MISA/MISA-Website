"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { MEMBER_SOURCES, MEMBER_STATES, type MemberFilter } from "@/lib/filters";

// Same contract as attendance-filters.tsx: no submit button, every choice in
// the URL, so a filtered view is shareable, survives a reload, and — the part
// that matters from phase 2 on — is the exact thing the export re-reads.
//
// Nothing here formats a date. The inputs are <input type="date">, which take
// and return a plain YYYY-MM-DD civil date and never touch Intl.

const controlClass = "border border-black/70 bg-misa-panel px-3 py-2 text-sm";
const smallNumber = `${controlClass} w-24`;

export function MemberFilters({ filter }: { filter: MemberFilter }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Any change to what is being filtered invalidates the offset. Staying on
    // page 3 of a narrower result set shows an officer an empty table and no
    // reason for it.
    next.delete("page");
    router.push(`/admin/members?${next.toString()}`);
  }

  const anyNarrowing =
    filter.state !== "active" ||
    filter.source !== "" ||
    filter.minPoints !== null ||
    filter.maxPoints !== null ||
    filter.minEvents !== null ||
    filter.maxEvents !== null ||
    filter.minRate !== null ||
    filter.joinedFrom !== "" ||
    filter.joinedTo !== "";

  return (
    <div className="flex flex-wrap items-end gap-4">
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

      <Labelled label="Added by">
        <select
          className={controlClass}
          value={filter.source}
          onChange={(e) => update({ source: e.target.value })}
        >
          <option value="">Anyone</option>
          {MEMBER_SOURCES.map((source) => (
            <option key={source} value={source}>
              {source === "admin" ? "An officer" : "The check-in form"}
            </option>
          ))}
        </select>
      </Labelled>

      <Labelled label="Points">
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            placeholder="min"
            className={smallNumber}
            defaultValue={filter.minPoints ?? ""}
            onBlur={(e) => update({ minPoints: e.target.value })}
          />
          <span className="text-foreground/50">–</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="max"
            className={smallNumber}
            defaultValue={filter.maxPoints ?? ""}
            onBlur={(e) => update({ maxPoints: e.target.value })}
          />
        </div>
      </Labelled>

      <Labelled label="Events attended">
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            placeholder="min"
            className={smallNumber}
            defaultValue={filter.minEvents ?? ""}
            onBlur={(e) => update({ minEvents: e.target.value })}
          />
          <span className="text-foreground/50">–</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="max"
            className={smallNumber}
            defaultValue={filter.maxEvents ?? ""}
            onBlur={(e) => update({ maxEvents: e.target.value })}
          />
        </div>
      </Labelled>

      <Labelled label="Rate at least">
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            placeholder="0"
            className={smallNumber}
            defaultValue={filter.minRate ?? ""}
            onBlur={(e) => update({ minRate: e.target.value })}
          />
          <span className="text-sm text-foreground/50">%</span>
        </div>
      </Labelled>

      <Labelled label="Joined from">
        <input
          type="date"
          className={controlClass}
          value={filter.joinedFrom}
          onChange={(e) => update({ joinedFrom: e.target.value })}
        />
      </Labelled>

      <Labelled label="Joined to">
        <input
          type="date"
          className={controlClass}
          value={filter.joinedTo}
          onChange={(e) => update({ joinedTo: e.target.value })}
        />
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

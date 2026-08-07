"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Row selection for the directory (§7 Stage 6 phase 5).
//
// ⚠️ The two modes are the whole point of this file. A hand-picked set of rows
// and "all N matching this filter" are different answers, and conflating them is
// the classic bug on this kind of screen — it silently produces a partial email
// list that looks complete. They are therefore separate states rather than one
// set of ids that happens to be full, so nothing downstream has to infer which
// the officer meant: in `filter` mode the export sends no ids at all and the
// route re-runs the same filtered query.
//
// 📌 **The directory stopped paginating on 2026-08-07, and both modes survived
// that on purpose.** Every matching row is now on screen, so "select everything
// visible" and "all N matching" pick the same people — but they are still not
// the same instruction. `ids` mode exports exactly what was ticked; `filter`
// mode re-runs the query at export time, so it carries whatever matches *then*.
// Collapsing them would throw away the only mode that can prove a list is
// complete rather than merely long.
//
// 🔓 It also fixed a failure the change would otherwise have introduced. The
// header checkbox used to select 25 ids; unpaginated it would select every one,
// and `ids` mode appends one `ids=` query param per member — a few hundred
// uuids at ~40 characters each overruns request-header limits and the download
// simply fails. So the header checkbox sets `filter` mode, which sends none.
// That is not a workaround: with no pages, ticking "all" IS the filter.
//
// ⚠️ Selection resets whenever the filter changes. The count beside the button
// and the rows behind it have to agree, and an officer who narrows the filter
// with rows checked would otherwise carry off-screen ids into the next export.
// This is the same failure React 19's form reset already caused once, where the
// bulk bar read "2 selected" above six empty boxes.
//
// This is a Client Component and MemberTable is not, which is why selection
// lives in a context rather than in table state: the table shell stays a Server
// Component and only the pieces that need interactivity cross the boundary.

type Mode = "ids" | "filter";

type SelectionValue = {
  mode: Mode;
  /** Explicitly checked ids. Empty and meaningless while mode is `filter`. */
  ids: ReadonlySet<string>;
  /** Rows matching the current filter. */
  total: number;
  /** Every id on screen, in render order — which is every matching id. */
  visibleIds: readonly string[];
  /** How many members an export would actually carry. */
  count: number;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  /** The header checkbox. `on` means "all matching", not "all rendered". */
  toggleAll: (on: boolean) => void;
  selectAllMatching: () => void;
  clear: () => void;
};

const SelectionContext = createContext<SelectionValue | null>(null);

export function useSelection(): SelectionValue {
  const value = useContext(SelectionContext);
  if (!value) {
    throw new Error("useSelection must be used inside <SelectionProvider>");
  }
  return value;
}

export function SelectionProvider({
  filterKey,
  total,
  visibleIds,
  children,
}: {
  /**
   * The serialized filter. Changing it clears the selection — see the note at
   * the top of this file. It is a string rather than the MemberFilter object so
   * the comparison is a plain `!==` and cannot be defeated by a new object
   * identity on every render.
   */
  filterKey: string;
  total: number;
  visibleIds: readonly string[];
  children: ReactNode;
}) {
  const [mode, setMode] = useState<Mode>("ids");
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());

  // Reset-during-render rather than an effect, matching member-filters.tsx and
  // directory-row.tsx. An effect would let one paint through with the stale
  // selection still on screen.
  const [seenFilter, setSeenFilter] = useState(filterKey);
  if (seenFilter !== filterKey) {
    setSeenFilter(filterKey);
    setMode("ids");
    setIds(new Set());
  }

  const isSelected = useCallback(
    (id: string) => (mode === "filter" ? true : ids.has(id)),
    [mode, ids]
  );

  const toggle = useCallback(
    (id: string) => {
      setIds((current) => {
        // Leaving `filter` mode by unchecking a row drops back to the visible
        // rows, minus the one just unchecked. The alternative — keeping "all N"
        // minus one — would need a not-in list the export has no way to express,
        // and would read as "all N" in the banner while quietly meaning
        // something else.
        const base = mode === "filter" ? new Set(visibleIds) : new Set(current);
        if (base.has(id)) base.delete(id);
        else base.add(id);
        return base;
      });
      setMode("ids");
    },
    [mode, visibleIds]
  );

  // ⚠️ Ticking the header goes to `filter` mode rather than enumerating every
  // visible id. With no pagination those pick the same people, but only this
  // way does the export send zero ids — see the note at the top for why a URL
  // full of uuids is a real failure and not a tidiness point.
  const toggleAll = useCallback((on: boolean) => {
    if (on) {
      setMode("filter");
      setIds(new Set());
    } else {
      setMode("ids");
      setIds(new Set());
    }
  }, []);

  const selectAllMatching = useCallback(() => {
    setMode("filter");
    setIds(new Set());
  }, []);

  const clear = useCallback(() => {
    setMode("ids");
    setIds(new Set());
  }, []);

  const value = useMemo<SelectionValue>(
    () => ({
      mode,
      ids,
      total,
      visibleIds,
      count: mode === "filter" ? total : ids.size,
      isSelected,
      toggle,
      toggleAll,
      selectAllMatching,
      clear,
    }),
    [
      mode,
      ids,
      total,
      visibleIds,
      isSelected,
      toggle,
      toggleAll,
      selectAllMatching,
      clear,
    ]
  );

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

/**
 * The header checkbox — selects everything matching the filter, or clears.
 *
 * A separate Client Component so member-table.tsx can stay a Server Component;
 * it is one cell of an otherwise server-rendered `<thead>`. Deliberately NOT a
 * SortHeader: the other headers are links, and this is a control.
 */
export function SelectAllHeader() {
  const { visibleIds, ids, mode, toggleAll } = useSelection();

  // Hand-checking every row lands on the same set as ticking this box, so it
  // shows checked either way — but the mode underneath still differs, and that
  // difference is what the export reads.
  const all =
    mode === "filter" ||
    (visibleIds.length > 0 && visibleIds.every((id) => ids.has(id)));
  const some = mode === "filter" || visibleIds.some((id) => ids.has(id));

  return (
    <th
      scope="col"
      className="sticky top-0 z-10 w-10 border-b-2 border-black bg-misa-panel px-3 py-2"
    >
      <input
        type="checkbox"
        className="size-4 accent-black"
        checked={all}
        // Indeterminate is a property, not an attribute, so React cannot set it
        // declaratively — a ref callback is the only way to reach it.
        ref={(node) => {
          if (node) node.indeterminate = some && !all;
        }}
        onChange={(event) => toggleAll(event.currentTarget.checked)}
        aria-label={all ? "Clear selection" : "Select all matching this filter"}
      />
    </th>
  );
}

/** One row's checkbox. */
export function SelectRowCell({
  id,
  label,
}: {
  id: string;
  /** The member's name, so the box has an accessible label of its own. */
  label: string;
}) {
  const { isSelected, toggle } = useSelection();

  return (
    <td className="w-10 px-3 py-2">
      <input
        type="checkbox"
        className="size-4 accent-black"
        checked={isSelected(id)}
        onChange={() => toggle(id)}
        aria-label={`Select ${label}`}
      />
    </td>
  );
}

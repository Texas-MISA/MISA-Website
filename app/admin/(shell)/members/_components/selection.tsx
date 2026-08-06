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
// ⚠️ The two modes are the whole point of this file. "The 25 rows on this page"
// and "all N matching this filter" are different answers, and conflating them is
// the classic bug on this kind of screen — it silently produces a partial email
// list that looks complete. They are therefore separate states rather than one
// set of ids that happens to be full, so nothing downstream has to infer which
// the officer meant: in `filter` mode the export sends no ids at all and the
// route re-runs the same filtered query.
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
  /** Rows matching the current filter, across every page. */
  total: number;
  /** Ids rendered on this page, in render order. */
  pageIds: readonly string[];
  /** How many members an export would actually carry. */
  count: number;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  togglePage: (on: boolean) => void;
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
  pageIds,
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
  pageIds: readonly string[];
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
        // Leaving `filter` mode by unchecking a row drops back to this page's
        // rows, minus the one just unchecked. The alternative — keeping "all N"
        // minus one — would need a not-in list the export has no way to express,
        // and would read as "all N" in the banner while quietly meaning
        // something else.
        const base = mode === "filter" ? new Set(pageIds) : new Set(current);
        if (base.has(id)) base.delete(id);
        else base.add(id);
        return base;
      });
      setMode("ids");
    },
    [mode, pageIds]
  );

  const togglePage = useCallback(
    (on: boolean) => {
      setMode("ids");
      setIds(() => (on ? new Set(pageIds) : new Set()));
    },
    [pageIds]
  );

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
      pageIds,
      count: mode === "filter" ? total : ids.size,
      isSelected,
      toggle,
      togglePage,
      selectAllMatching,
      clear,
    }),
    [
      mode,
      ids,
      total,
      pageIds,
      isSelected,
      toggle,
      togglePage,
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
 * The header checkbox — selects or clears this page.
 *
 * A separate Client Component so member-table.tsx can stay a Server Component;
 * it is one cell of an otherwise server-rendered `<thead>`. Deliberately NOT a
 * SortHeader: the other headers are links, and this is a control.
 */
export function SelectAllHeader() {
  const { pageIds, ids, mode, togglePage } = useSelection();

  const allOnPage =
    mode === "filter" ||
    (pageIds.length > 0 && pageIds.every((id) => ids.has(id)));
  const someOnPage = mode === "filter" || pageIds.some((id) => ids.has(id));

  return (
    <th scope="col" className="w-10 px-3 py-2">
      <input
        type="checkbox"
        className="size-4 accent-black"
        checked={allOnPage}
        // Indeterminate is a property, not an attribute, so React cannot set it
        // declaratively — a ref callback is the only way to reach it.
        ref={(node) => {
          if (node) node.indeterminate = someOnPage && !allOnPage;
        }}
        onChange={(event) => togglePage(event.currentTarget.checked)}
        aria-label={allOnPage ? "Clear selection" : "Select all on this page"}
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

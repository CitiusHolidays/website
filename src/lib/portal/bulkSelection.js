import { useCallback, useEffect, useMemo, useState } from "react";

/** @param {Iterable<string>} selectedIds @param {string[]} visibleIds */
export function pruneSelectionToVisible(selectedIds, visibleIds) {
  const visible = new Set(visibleIds);
  const next = new Set();
  for (const id of selectedIds) {
    if (visible.has(id)) {
      next.add(id);
    }
  }
  return next;
}

/** @param {Set<string>} selectedIds @param {string[]} visibleIds */
export function toggleAllVisibleSelection(selectedIds, visibleIds) {
  if (visibleIds.length === 0) return selectedIds;
  const allSelected = visibleIds.every((id) => selectedIds.has(id));
  if (allSelected) {
    return new Set();
  }
  return new Set(visibleIds);
}

/** @param {Set<string>} selectedIds @param {string[]} visibleIds */
export function allVisibleRowsSelected(selectedIds, visibleIds) {
  return visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
}

/** @param {Set<string>} selectedIds @param {string[]} visibleIds */
export function someVisibleRowsSelected(selectedIds, visibleIds) {
  return visibleIds.some((id) => selectedIds.has(id));
}

export function useBulkSelection(visibleRows) {
  const rowIds = useMemo(
    () => (visibleRows || []).map((row) => row.id).filter(Boolean),
    [visibleRows],
  );
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  useEffect(() => {
    setSelectedIds((current) => pruneSelectionToVisible(current, rowIds));
  }, [rowIds]);

  const toggleOne = useCallback((id) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((current) => toggleAllVisibleSelection(current, rowIds));
  }, [rowIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const allVisibleSelected = allVisibleRowsSelected(selectedIds, rowIds);
  const someVisibleSelected = someVisibleRowsSelected(selectedIds, rowIds);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    toggleOne,
    toggleAllVisible,
    clearSelection,
    allVisibleSelected,
    someVisibleSelected,
  };
}

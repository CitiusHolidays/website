import { useState } from "react";

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
  const rowIds = (visibleRows || []).flatMap((row) => (row.id ? [row.id] : []));
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const effectiveSelectedIds = pruneSelectionToVisible(selectedIds, rowIds);

  const toggleOne = (id) => {
    setSelectedIds((current) => {
      const next = new Set(pruneSelectionToVisible(current, rowIds));
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((current) =>
      toggleAllVisibleSelection(pruneSelectionToVisible(current, rowIds), rowIds),
    );
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  return {
    selectedIds: effectiveSelectedIds,
    selectedCount: effectiveSelectedIds.size,
    toggleOne,
    toggleAllVisible,
    clearSelection,
    allVisibleSelected: allVisibleRowsSelected(effectiveSelectedIds, rowIds),
    someVisibleSelected: someVisibleRowsSelected(effectiveSelectedIds, rowIds),
  };
}

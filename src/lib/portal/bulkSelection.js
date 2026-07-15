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

/** @param {Set<string>} selectedIds @param {string[]} visibleIds @param {{ pageOnly?: boolean }} [options] */
export function toggleAllVisibleSelection(selectedIds, visibleIds, options = {}) {
  const { pageOnly = false } = options;
  if (visibleIds.length === 0) {
    return selectedIds;
  }
  const allSelected = visibleIds.every((id) => selectedIds.has(id));
  if (allSelected) {
    if (pageOnly) {
      const next = new Set(selectedIds);
      for (const id of visibleIds) {
        next.delete(id);
      }
      return next;
    }
    return new Set();
  }
  if (pageOnly) {
    const next = new Set(selectedIds);
    for (const id of visibleIds) {
      next.add(id);
    }
    return next;
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

/**
 * @param {Array<{ id?: unknown }>} rows
 * @param {{ pageRowIds?: string[] }} [options]
 */
export function useBulkSelection(rows, options = {}) {
  const { pageRowIds } = options;
  const allRowIds = (rows || []).flatMap((row) => (row.id ? [String(row.id)] : []));
  const visibleIds = pageRowIds ?? allRowIds;
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const effectiveSelectedIds = pruneSelectionToVisible(selectedIds, allRowIds);

  const toggleOne = (id) => {
    setSelectedIds((current) => {
      const next = new Set(pruneSelectionToVisible(current, allRowIds));
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
      toggleAllVisibleSelection(pruneSelectionToVisible(current, allRowIds), visibleIds, {
        pageOnly: Boolean(pageRowIds),
      })
    );
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  return {
    allVisibleSelected: allVisibleRowsSelected(effectiveSelectedIds, visibleIds),
    clearSelection,
    selectedCount: effectiveSelectedIds.size,
    selectedIds: effectiveSelectedIds,
    someVisibleSelected: someVisibleRowsSelected(effectiveSelectedIds, visibleIds),
    toggleAllVisible,
    toggleOne,
  };
}

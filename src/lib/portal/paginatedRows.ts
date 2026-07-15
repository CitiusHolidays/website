interface IdentifiedRow {
  id: unknown;
}

export function shouldResetLoadedPage(
  previousRowIds: readonly string[] | null,
  nextRowIds: readonly string[]
): boolean {
  if (previousRowIds === null) {
    return false;
  }
  return !(
    nextRowIds.length >= previousRowIds.length &&
    previousRowIds.every((id, index) => nextRowIds[index] === id)
  );
}

export function mergeFocusedRow<Row extends IdentifiedRow>(
  rows: readonly Row[] | undefined,
  focused: Row | null | undefined
): Row[] | undefined {
  if (!rows) {
    return focused ? [focused] : undefined;
  }

  const merged = focused ? [focused, ...rows] : [...rows];
  const seen = new Set<unknown>();
  return merged.filter((row) => {
    if (seen.has(row.id)) {
      return false;
    }
    seen.add(row.id);
    return true;
  });
}

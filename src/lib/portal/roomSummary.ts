export function summarizeRoomTypes(
  rows: Array<{ roomType?: unknown }> | undefined
): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const row of rows || []) {
    const roomType = String(row?.roomType ?? "").trim();
    if (!roomType) {
      continue;
    }
    summary[roomType] = (summary[roomType] ?? 0) + 1;
  }
  return summary;
}

export function formatRoomSummaryText(
  summary: Record<string, number> | undefined,
  jobCode?: string
): string {
  const entries = Object.entries(summary || {}).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    return "";
  }
  const prefix = jobCode ? `${jobCode}: ` : "";
  return `${prefix}${entries.map(([roomType, count]) => `${roomType} ${count}`).join(", ")}`;
}

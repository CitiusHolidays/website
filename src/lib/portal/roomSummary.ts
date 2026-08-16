export interface RoomTypeSummary {
  [roomType: string]: number;
}

export function summarizeRoomTypes(
  rows: Array<{ roomType?: unknown }> | undefined
): RoomTypeSummary {
  const summary: RoomTypeSummary = {};
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
  summary: RoomTypeSummary | undefined,
  jobCode?: string
): string {
  const entries = Object.entries(summary || {}).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    return "";
  }
  const prefix = jobCode ? `${jobCode}: ` : "";
  return `${prefix}${entries.map(([roomType, count]) => `${roomType} ${count}`).join(", ")}`;
}

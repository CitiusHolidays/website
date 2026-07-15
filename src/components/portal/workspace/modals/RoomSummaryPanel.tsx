"use client";

import { Badge } from "../portalWorkspaceListUi";

export function RoomSummaryPanel({
  summary,
  jobCode,
  title = "Passengers by room type",
}: {
  jobCode?: string;
  summary: Record<string, number>;
  title?: string;
}) {
  const entries = Object.entries(summary || {}).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    return null;
  }
  return (
    <div className="rounded-lg border border-brand-border bg-brand-light/60 p-3 text-sm">
      <div className="font-semibold text-brand-muted text-xs uppercase tracking-wide">
        {title}
        {jobCode ? ` — ${jobCode}` : ""}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {entries.map(([roomType, count]) => (
          <Badge key={roomType} label={`${roomType}: ${count}`} tone="blue" />
        ))}
      </div>
    </div>
  );
}

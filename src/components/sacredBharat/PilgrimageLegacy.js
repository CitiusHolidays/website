"use client";

import { getTempleById } from "@/data/sacredBharat/temples";
import { formatVisitDate } from "@/lib/sacredBharat/format";
import { useSacredBharatContext } from "./SacredBharatProvider";

export default function PilgrimageLegacy() {
  const { progress, isAuthenticated } = useSacredBharatContext();
  const visits = progress.visits ?? [];

  if (visits.length === 0 && progress.templeCount === 0) {
    return (
      <p className="font-sans text-brand-muted text-sm">
        Mark your first temple to begin your digital pilgrimage legacy.
      </p>
    );
  }

  const legacyEntries =
    isAuthenticated && visits.length > 0
      ? visits.map((v) => ({
          name: getTempleById(v.templeId)?.name ?? v.templeId,
          templeId: v.templeId,
          visitedAt: v.visitedAt,
        }))
      : progress.visitedTempleIds.map((id) => ({
          name: getTempleById(id)?.name ?? id,
          templeId: id,
          visitedAt: null,
        }));

  return (
    <ul className="max-h-64 space-y-2 overflow-y-auto">
      {legacyEntries.map((entry) => (
        <li
          className="flex justify-between gap-4 rounded-lg border border-brand-light px-4 py-2.5 text-sm"
          key={entry.templeId}
        >
          <span className="font-medium text-brand-dark">{entry.name}</span>
          <span className="shrink-0 text-brand-muted tabular-nums">
            {entry.visitedAt ? formatVisitDate(entry.visitedAt) : "Logged locally"}
          </span>
        </li>
      ))}
    </ul>
  );
}

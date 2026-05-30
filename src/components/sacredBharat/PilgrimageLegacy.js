"use client";

import { getTempleById } from "@/data/sacredBharat/temples";
import { formatVisitDate } from "@/lib/sacredBharat/format";
import { useSacredBharatContext } from "./SacredBharatProvider";

export default function PilgrimageLegacy() {
  const { progress, isAuthenticated } = useSacredBharatContext();
  const visits = progress.visits ?? [];

  if (visits.length === 0 && progress.templeCount === 0) {
    return (
      <p className="font-sans text-sm text-brand-muted">
        Mark your first temple to begin your digital pilgrimage legacy.
      </p>
    );
  }

  const legacyEntries =
    isAuthenticated && visits.length > 0
      ? visits.map((v) => ({
          templeId: v.templeId,
          visitedAt: v.visitedAt,
          name: getTempleById(v.templeId)?.name ?? v.templeId,
        }))
      : progress.visitedTempleIds.map((id) => ({
          templeId: id,
          visitedAt: null,
          name: getTempleById(id)?.name ?? id,
        }));

  return (
    <ul className="space-y-2 max-h-64 overflow-y-auto">
      {legacyEntries.map((entry) => (
        <li
          key={entry.templeId}
          className="flex justify-between gap-4 rounded-lg border border-brand-light px-4 py-2.5 text-sm"
        >
          <span className="font-medium text-brand-dark">{entry.name}</span>
          <span className="text-brand-muted shrink-0 tabular-nums">
            {entry.visitedAt ? formatVisitDate(entry.visitedAt) : "Logged locally"}
          </span>
        </li>
      ))}
    </ul>
  );
}

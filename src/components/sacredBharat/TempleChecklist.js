"use client";

import { Check, MapPin } from "lucide-react";
import { REGION_LABELS } from "@/data/sacredBharat/regions";
import { getTempleById, TEMPLES } from "@/data/sacredBharat/temples";
import { cn } from "@/utils/cn";
import { useSacredBharatContext } from "./SacredBharatProvider";

/**
 * @param {{ templeIds?: string[], showAllTemples?: boolean }} props
 */
export default function TempleChecklist({ templeIds, showAllTemples = false }) {
  const { visitedTempleIds, toggleVisited } = useSacredBharatContext();

  const list = showAllTemples
    ? TEMPLES
    : (templeIds ?? []).flatMap((id) => {
        const temple = getTempleById(id);
        return temple ? [temple] : [];
      });

  return (
    <ul className="space-y-2">
      {list.map((temple) => {
        const visited = visitedTempleIds.includes(temple.id);
        return (
          <li key={temple.id}>
            <button
              type="button"
              onClick={() => toggleVisited(temple.id)}
              className={cn(
                "w-full flex items-center gap-4 rounded-xl border px-4 py-3 text-left transition-all",
                visited
                  ? "border-citius-orange/35 bg-citius-orange/5"
                  : "border-brand-light bg-white hover:border-citius-blue/25",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  visited
                    ? "border-citius-orange bg-citius-orange text-white"
                    : "border-brand-light text-transparent",
                )}
              >
                <Check className="size-4" strokeWidth={3} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-heading text-brand-dark">{temple.name}</p>
                <p className="font-sans text-xs text-brand-muted flex items-center gap-1 mt-0.5">
                  <MapPin className="size-3 shrink-0" />
                  {temple.city}, {temple.state}
                  {showAllTemples && (
                    <span className="ml-2 text-citius-blue/80">
                      · {REGION_LABELS[temple.region]}
                    </span>
                  )}
                </p>
              </div>
              <span className="text-xs text-brand-muted shrink-0">+25 pts</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

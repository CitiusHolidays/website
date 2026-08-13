import { resolveCanonicalTempleId } from "@/data/sacredBharat/templeAliases";
import { getTempleById } from "@/data/sacredBharat/temples";
import { getTrailBySlug } from "@/data/sacredBharat/trails";

export const SACRED_BHARAT_ENTRY_POINTS = Object.freeze({
  JOURNEY_PLANNER: "journey_planner",
  TRAIL: "trail",
});

export function normalizeSacredBharatIntentContext(input) {
  if (!(input && typeof input === "object" && !Array.isArray(input))) {
    return null;
  }
  if (input.entryPoint === SACRED_BHARAT_ENTRY_POINTS.JOURNEY_PLANNER) {
    const templeId = resolveCanonicalTempleId(
      typeof input.templeId === "string" ? input.templeId.trim() : ""
    );
    return getTempleById(templeId)
      ? { entryPoint: SACRED_BHARAT_ENTRY_POINTS.JOURNEY_PLANNER, templeId }
      : null;
  }
  if (input.entryPoint === SACRED_BHARAT_ENTRY_POINTS.TRAIL) {
    const trailSlug = typeof input.trailSlug === "string" ? input.trailSlug.trim() : "";
    return getTrailBySlug(trailSlug)
      ? { entryPoint: SACRED_BHARAT_ENTRY_POINTS.TRAIL, trailSlug }
      : null;
  }
  return null;
}

export function describeSacredBharatIntentContext(context) {
  const normalized = normalizeSacredBharatIntentContext(context);
  if (!normalized) {
    return null;
  }
  if (normalized.entryPoint === SACRED_BHARAT_ENTRY_POINTS.JOURNEY_PLANNER) {
    const temple = getTempleById(normalized.templeId);
    return temple
      ? {
          destination: `${temple.name}, ${temple.state}`,
          label: `Journey Planner · ${temple.name}`,
        }
      : null;
  }
  const trail = getTrailBySlug(normalized.trailSlug);
  return trail ? { destination: trail.title, label: `Trail · ${trail.title}` } : null;
}

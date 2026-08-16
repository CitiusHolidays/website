import { resolveCanonicalTempleId } from "@/data/sacredBharat/templeAliases";
import { getTempleById } from "@/data/sacredBharat/temples";
import { getTrailBySlug } from "@/data/sacredBharat/trails";
import { isRuntimeObject, isRuntimeString } from "../runtimeValues";

export const SACRED_BHARAT_ENTRY_POINTS = Object.freeze({
  JOURNEY_PLANNER: "journey_planner",
  TRAIL: "trail",
});

export function normalizeSacredBharatIntentContext(input) {
  if (!(input && isRuntimeObject(input) && !Array.isArray(input))) {
    return null;
  }
  if (input.entryPoint === SACRED_BHARAT_ENTRY_POINTS.JOURNEY_PLANNER) {
    const templeId = resolveCanonicalTempleId(
      isRuntimeString(input.templeId) ? input.templeId.trim() : ""
    );
    return getTempleById(templeId)
      ? { entryPoint: SACRED_BHARAT_ENTRY_POINTS.JOURNEY_PLANNER, templeId }
      : null;
  }
  if (input.entryPoint === SACRED_BHARAT_ENTRY_POINTS.TRAIL) {
    const trailSlug = isRuntimeString(input.trailSlug) ? input.trailSlug.trim() : "";
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

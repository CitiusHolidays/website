export type HeroMediaConditions = {
  effectiveType?: string;
  isVisible: boolean;
  prefersReducedMotion: boolean;
  saveData: boolean;
};

export function heroMediaDecision(conditions: HeroMediaConditions) {
  if (conditions.prefersReducedMotion) {
    return { load: false, reason: "reduced-motion" as const };
  }
  if (conditions.saveData) {
    return { load: false, reason: "data-saver" as const };
  }
  if (["slow-2g", "2g"].includes(conditions.effectiveType ?? "")) {
    return { load: false, reason: "slow-network" as const };
  }
  if (!conditions.isVisible) {
    return { load: false, reason: "outside-viewport" as const };
  }
  return { load: true, reason: "eligible" as const };
}

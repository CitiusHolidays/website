export const EFFECT_ADOPTION_PRESSURES = [
  "external-io",
  "retry-or-throttle",
  "concurrency-control",
  "typed-recoverable-errors",
  "rollback-or-cleanup",
  "test-time-dependency-substitution",
] as const;

export type EffectAdoptionPressure = (typeof EFFECT_ADOPTION_PRESSURES)[number];

export interface EffectAdoptionInventoryEntry {
  disposition: "effect" | "pilot" | "plain-ts";
  effectMajor: 3;
  matchedPressures: readonly EffectAdoptionPressure[];
  materialSimplification: string;
  path: string;
}

/**
 * Executable inventory for production Effect imports. Effect v3 is the current
 * repository convention; dependency upgrades require a separately reviewed
 * inventory and migration update. Plain-TypeScript candidates that do not
 * import Effect stay out of this import-reconciliation list.
 */
export const EFFECT_ADOPTION_INVENTORY: readonly EffectAdoptionInventoryEntry[] = [
  {
    disposition: "effect",
    effectMajor: 3,
    matchedPressures: [
      "external-io",
      "retry-or-throttle",
      "typed-recoverable-errors",
      "test-time-dependency-substitution",
    ],
    materialSimplification:
      "Keeps paced provider delivery, typed failures, and injected test delivery in one interruptible workflow.",
    path: "convex/crm/notificationEmailDelivery.ts",
  },
] as const;

export interface EffectAdoptionEvaluation {
  appropriate: boolean;
  matchedPressures: EffectAdoptionPressure[];
  missingPressureCount: number;
}

const pressureSet = new Set<EffectAdoptionPressure>(EFFECT_ADOPTION_PRESSURES);

export function evaluateEffectAdoption(
  pressures: Iterable<EffectAdoptionPressure>
): EffectAdoptionEvaluation {
  const matchedPressures = Array.from(
    new Set(Array.from(pressures).filter((pressure) => pressureSet.has(pressure)))
  );

  return {
    appropriate: matchedPressures.length >= 2,
    matchedPressures,
    missingPressureCount: Math.max(0, 2 - matchedPressures.length),
  };
}

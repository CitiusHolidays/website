import { Effect } from "effect";

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
  {
    disposition: "effect",
    effectMajor: 3,
    matchedPressures: ["external-io", "typed-recoverable-errors"],
    materialSimplification:
      "Maps Razorpay order creation failures through one typed route boundary instead of repeated promise catches.",
    path: "src/app/api/create-order/route.ts",
  },
  {
    disposition: "effect",
    effectMajor: 3,
    matchedPressures: ["typed-recoverable-errors", "test-time-dependency-substitution"],
    materialSimplification:
      "Centralizes the typed external-I/O adapter and injected async operation used by the approved integration seams.",
    path: "src/lib/effectAdoption.ts",
  },
  {
    disposition: "effect",
    effectMajor: 3,
    matchedPressures: ["external-io", "typed-recoverable-errors"],
    materialSimplification:
      "Keeps payment verification I/O and typed failure mapping consistent with the create-order route boundary.",
    path: "src/lib/paymentVerification.ts",
  },
  {
    disposition: "effect",
    effectMajor: 3,
    matchedPressures: ["external-io", "typed-recoverable-errors"],
    materialSimplification:
      "Keeps webhook verification I/O and typed failure mapping explicit without widening ordinary business state.",
    path: "src/lib/razorpayWebhook.ts",
  },
] as const;

export interface EffectAdoptionEvaluation {
  appropriate: boolean;
  matchedPressures: EffectAdoptionPressure[];
  missingPressureCount: number;
}

export class ExternalIoFailure {
  readonly _tag = "ExternalIoFailure";
  readonly cause: unknown;
  readonly operation: string;

  constructor(operation: string, cause: unknown) {
    this.operation = operation;
    this.cause = cause;
  }

  toString() {
    const message = this.cause instanceof Error ? this.cause.message : String(this.cause);
    return `${this.operation} failed: ${message}`;
  }
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

export function buildExternalIoEffect<Result>(
  operation: string,
  run: () => Promise<Result>
): Effect.Effect<Result, ExternalIoFailure> {
  return Effect.tryPromise({
    catch: (cause) => new ExternalIoFailure(operation, cause),
    try: run,
  });
}
